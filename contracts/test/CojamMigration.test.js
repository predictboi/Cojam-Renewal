const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { SUPPLY, DAY, WINDOW, LOCK, E18, split, deploySystem, approveAndMigrate } = require("./helpers");

const fixture = () => deploySystem("MockOldCojam");
const unfunded = () => deploySystem("MockOldCojam", [], { fund: 0n });

describe("CojamToken", function () {
  it("total supply equals the old on chain supply exactly (4,083,262,533.9560001 CT)", async function () {
    const { oldToken, newToken } = await loadFixture(fixture);
    expect(await newToken.totalSupply()).to.equal(SUPPLY);
    expect(await newToken.totalSupply()).to.equal(await oldToken.totalSupply());
    expect(await newToken.TOTAL_SUPPLY()).to.equal(4_083_262_533_956_000_100_000_000_000n);
    expect(ethers.formatUnits(await newToken.totalSupply(), 18)).to.equal("4083262533.9560001");
  });

  it("mints the whole supply to the master wallet; the deployer and the swap hold none", async function () {
    const { deployer, master, migration, newToken } = await loadFixture(unfunded);
    expect(await newToken.balanceOf(master.address)).to.equal(SUPPLY);
    expect(await newToken.balanceOf(deployer.address)).to.equal(0n);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(0n);
    expect(await migration.availableReserve()).to.equal(0n);
  });

  it("rejects the zero address as master", async function () {
    const Token = await ethers.getContractFactory("CojamToken");
    await expect(Token.deploy(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(Token, "ERC20InvalidReceiver").withArgs(ethers.ZeroAddress);
  });

  it("has standard metadata and no admin surface (no owner, mint, pause, blacklist)", async function () {
    const { newToken } = await loadFixture(fixture);
    expect(await newToken.name()).to.equal("Cojam Token");
    expect(await newToken.symbol()).to.equal("CT");
    expect(await newToken.decimals()).to.equal(18n);
    const names = newToken.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const banned of ["owner", "mint", "pause", "unpause", "blacklist", "freeze", "upgradeTo", "transferOwnership", "burn", "renounceOwnership"]) {
      expect(names, banned).to.not.include(banned);
    }
  });

  it("supports EIP-2612 permit", async function () {
    const { alice, bob, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 100n * E18); // 10 CT arrive at once

    const deadline = BigInt(await time.latest()) + 3600n;
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "Cojam Token", version: "1", chainId, verifyingContract: await newToken.getAddress() };
    const types = { Permit: [
      { name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
    ] };
    const value = { owner: alice.address, spender: bob.address, value: 5n * E18, nonce: 0n, deadline };
    const sig = ethers.Signature.from(await alice.signTypedData(domain, types, value));
    await newToken.permit(alice.address, bob.address, 5n * E18, deadline, sig.v, sig.r, sig.s);
    expect(await newToken.allowance(alice.address, bob.address)).to.equal(5n * E18);
  });
});

describe("CojamMigration: deployment", function () {
  it("opens the window at deploy and sets the tokens, the owner and the constants", async function () {
    const { migration, oldToken, newToken, master } = await loadFixture(fixture);
    const deployBlock = await ethers.provider.getBlock((await migration.deploymentTransaction().wait()).blockNumber);
    const start = BigInt(deployBlock.timestamp);
    expect(await migration.WINDOW_START()).to.equal(start);
    expect(await migration.WINDOW_END()).to.equal(start + WINDOW);
    expect(await migration.OLD_TOKEN()).to.equal(await oldToken.getAddress());
    expect(await migration.NEW_TOKEN()).to.equal(await newToken.getAddress());
    expect(await migration.owner()).to.equal(master.address);
    expect(await migration.pendingOwner()).to.equal(ethers.ZeroAddress);
    expect(await migration.paused()).to.equal(false);
    expect(await migration.LOCK_PERIOD()).to.equal(LOCK);
    expect(await migration.INSTANT_PERCENT()).to.equal(10n);
    expect(await migration.isOpen()).to.equal(true);
    // The removed design is really gone.
    const names = migration.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const gone of ["sweep", "TREASURY", "SWEEP_OPENS_AT"]) expect(names, gone).to.not.include(gone);
  });

  it("rejects bad constructor input", async function () {
    const [deployer, master] = await ethers.getSigners();
    const Migration = await ethers.getContractFactory("CojamMigration");
    const Old = await ethers.getContractFactory("MockOldCojam");
    const Token = await ethers.getContractFactory("CojamToken");
    const Dec = await ethers.getContractFactory("MockDecimals");
    const old = await Old.deploy(SUPPLY);
    const token = await Token.deploy(master.address);
    const o = await old.getAddress(), n = await token.getAddress();

    await expect(Migration.deploy(ethers.ZeroAddress, n, master.address)).to.be.revertedWithCustomError(Migration, "ZeroAddress");
    await expect(Migration.deploy(o, ethers.ZeroAddress, master.address)).to.be.revertedWithCustomError(Migration, "ZeroAddress");
    await expect(Migration.deploy(o, n, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(Migration, "OwnableInvalidOwner").withArgs(ethers.ZeroAddress);
    await expect(Migration.deploy(n, n, master.address)).to.be.revertedWithCustomError(Migration, "SameToken");

    const six = await Dec.deploy(SUPPLY, 6);
    await expect(Migration.deploy(await six.getAddress(), n, master.address)).to.be.revertedWithCustomError(Migration, "DecimalsMismatch");
    await expect(Migration.deploy(o, await six.getAddress(), master.address)).to.be.revertedWithCustomError(Migration, "DecimalsMismatch");

    // A new token with less supply than the old one cannot back every swap.
    const bigOld = await Old.deploy(SUPPLY + 1n);
    await expect(Migration.deploy(await bigOld.getAddress(), n, master.address))
      .to.be.revertedWithCustomError(Migration, "SupplyMismatch");

    // An old CT burn between the token deploy and the swap deploy does not block the swap
    // (the new supply still covers every old token).
    await old.connect(deployer).burn(1n);
    await expect(Migration.deploy(o, n, master.address)).to.not.be.reverted;
  });
});

describe("CojamMigration: funding and the reserve", function () {
  it("migrate fails before funding, succeeds once the owner transfers new CT, and never uses owed tokens", async function () {
    const { master, alice, bob, migration, oldToken, newToken } = await loadFixture(unfunded);
    const m = await migration.getAddress();
    await oldToken.connect(alice).approve(m, 1_000n * E18);
    await oldToken.connect(bob).approve(m, 1_000n * E18);

    await expect(migration.connect(alice).migrate(E18))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(0n, E18);

    // The owner funds the swap with a plain transfer.
    await newToken.connect(master).transfer(m, 100n * E18);
    expect(await migration.availableReserve()).to.equal(100n * E18);
    await expect(migration.connect(alice).migrate(100n * E18 + 1n))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(100n * E18, 100n * E18 + 1n);
    await expect(migration.connect(alice).migrate(100n * E18)).to.emit(migration, "Migrated");

    // The contract still holds 90 CT, but all of it is owed to alice's lot: nothing is available.
    expect(await newToken.balanceOf(m)).to.equal(90n * E18);
    expect(await migration.totalOwed()).to.equal(90n * E18);
    expect(await migration.availableReserve()).to.equal(0n);
    await expect(migration.connect(bob).migrate(1n))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(0n, 1n);

    // Topping up reopens it, exactly up to the new reserve.
    await newToken.connect(master).transfer(m, 50n * E18);
    await expect(migration.connect(bob).migrate(51n * E18))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(50n * E18, 51n * E18);
    await expect(migration.connect(bob).migrate(50n * E18)).to.emit(migration, "Migrated");
    expect(await migration.availableReserve()).to.equal(0n);

    // Both lots stay fully backed and pay in full.
    await time.increase(LOCK);
    await expect(migration.connect(alice).claim(5)).to.changeTokenBalance(newToken, alice, 90n * E18);
    await expect(migration.connect(bob).claim(5)).to.changeTokenBalance(newToken, bob, 45n * E18);
    expect(await newToken.balanceOf(m)).to.equal(0n);
  });

  it("a failed swap for a short reserve leaves no trace (no pull, no lot, no payout)", async function () {
    const { master, alice, migration, oldToken, newToken } = await loadFixture(unfunded);
    const m = await migration.getAddress();
    await newToken.connect(master).transfer(m, 10n * E18);
    await oldToken.connect(alice).approve(m, 20n * E18);
    await expect(migration.connect(alice).migrate(20n * E18)).to.be.revertedWithCustomError(migration, "InsufficientReserve");
    expect(await oldToken.balanceOf(alice.address)).to.equal(1_000_000n * E18);
    expect(await oldToken.allowance(alice.address, m)).to.equal(20n * E18);
    expect(await migration.lotCount(alice.address)).to.equal(0n);
    expect(await newToken.balanceOf(alice.address)).to.equal(0n);
  });
});

describe("CojamMigration: migrate", function () {
  it("swaps 1:1: 10% lands at once, 90% becomes a 7 day lot, old CT stays in the contract", async function () {
    const { alice, migration, oldToken, newToken } = await loadFixture(fixture);
    const amount = 12_500n * E18;
    await oldToken.connect(alice).approve(await migration.getAddress(), amount);
    const tx = await migration.connect(alice).migrate(amount);
    const t = BigInt(await time.latest());
    const instant = 1_250n * E18, locked = 11_250n * E18;
    await expect(tx).to.emit(migration, "Migrated").withArgs(alice.address, 0n, amount, instant, locked, t + LOCK);
    await expect(tx).to.changeTokenBalances(oldToken, [alice, migration], [-amount, amount]);
    await expect(tx).to.changeTokenBalances(newToken, [alice, migration], [instant, -instant]); // instant lands in the same tx

    const [lotAmount, unlockAt, claimed] = await migration.lotOf(alice.address, 0);
    expect(lotAmount).to.equal(locked);
    expect(unlockAt).to.equal(t + LOCK);
    expect(claimed).to.equal(false);
    expect(await migration.totalMigrated()).to.equal(amount);
    expect(await migration.totalInstant()).to.equal(instant);
    expect(await migration.totalOwed()).to.equal(locked);
    expect(await migration.availableReserve()).to.equal(SUPPLY - amount);
  });

  it("10% math rounds down and loses no dust (1, 9, 10, 11, 19, 99 wei, odd and full amounts)", async function () {
    const { alice, migration, oldToken, newToken } = await loadFixture(fixture);
    const cases = [1n, 9n, 10n, 11n, 19n, 99n, 100n, 123_456_789_012_345_678_901n];
    const expected = new Map([[1n, [0n, 1n]], [9n, [0n, 9n]], [10n, [1n, 9n]], [11n, [1n, 10n]], [19n, [1n, 18n]], [99n, [9n, 90n]], [100n, [10n, 90n]]]);
    await oldToken.connect(alice).approve(await migration.getAddress(), ethers.MaxUint256);
    let id = 0n, instantSum = 0n;
    for (const a of cases) {
      const [i, l] = split(a);
      if (expected.has(a)) expect([i, l]).to.deep.equal(expected.get(a));
      expect(await migration.previewSplit(a)).to.deep.equal([i, l]);
      await expect(migration.connect(alice).migrate(a))
        .to.emit(migration, "Migrated").withArgs(alice.address, id, a, i, l, (v) => v > 0n);
      expect((await migration.lotOf(alice.address, id))[0]).to.equal(l);
      expect(i + l).to.equal(a);
      instantSum += i;
      id++;
    }
    const rest = await oldToken.balanceOf(alice.address);
    await migration.connect(alice).migrate(rest);
    instantSum += split(rest)[0];
    expect(await oldToken.balanceOf(alice.address)).to.equal(0n);
    expect(await newToken.balanceOf(alice.address)).to.equal(instantSum);
    expect(instantSum + (await migration.pendingOf(alice.address))).to.equal(1_000_000n * E18);
  });

  it("reverts on a zero amount", async function () {
    const { alice, migration } = await loadFixture(fixture);
    await expect(migration.connect(alice).migrate(0)).to.be.revertedWithCustomError(migration, "ZeroAmount");
  });

  it("reverts without approval and when the amount exceeds the balance", async function () {
    const { alice, stranger, migration, oldToken } = await loadFixture(fixture);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "ERC20InsufficientAllowance");
    await oldToken.connect(stranger).approve(await migration.getAddress(), E18);
    await expect(migration.connect(stranger).migrate(E18)).to.be.revertedWithCustomError(oldToken, "ERC20InsufficientBalance");
  });

  it("window edges: open right after deploy, end minus 1 works, at end reverts", async function () {
    const { alice, master, oldToken, newToken } = await loadFixture(unfunded);
    // Fresh deploy: the very next blocks (fund, approve, migrate) are already inside the window.
    const migration = await (await ethers.getContractFactory("CojamMigration"))
      .deploy(await oldToken.getAddress(), await newToken.getAddress(), master.address);
    const start = await migration.WINDOW_START();
    const end = start + WINDOW;
    await newToken.connect(master).transfer(await migration.getAddress(), 1_000n * E18);
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await time.setNextBlockTimestamp(start + 3n);
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");

    await time.setNextBlockTimestamp(end - 1n);
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");

    await time.setNextBlockTimestamp(end);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "WindowClosed");
    expect(await migration.isOpen()).to.equal(false);
    expect(await migration.lotCount(alice.address)).to.equal(2n);
  });

  it("old token paused by its owner: migrate reverts cleanly with no state change, works again after unpause", async function () {
    const { deployer, alice, migration, oldToken, newToken } = await loadFixture(fixture);
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await oldToken.connect(deployer).pause();
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "TokenPaused");
    expect(await migration.lotCount(alice.address)).to.equal(0n);
    expect(await migration.totalMigrated()).to.equal(0n);
    expect(await migration.totalOwed()).to.equal(0n);
    expect(await newToken.balanceOf(alice.address)).to.equal(0n);

    await oldToken.connect(deployer).unPause();
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");
  });

  it("a frozen holder cannot migrate, but freezing the swap contract itself changes nothing", async function () {
    const { deployer, alice, bob, migration, oldToken, newToken } = await loadFixture(fixture);
    await oldToken.connect(deployer).freeze(alice.address);
    await oldToken.connect(alice).approve(await migration.getAddress(), E18);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "AccountFrozen");

    // The swap never sends old CT, so a freeze on its own address cannot block migrate or claim.
    await oldToken.connect(deployer).freeze(await migration.getAddress());
    await approveAndMigrate(oldToken, migration, bob, E18);
    await time.increase(LOCK);
    await expect(migration.connect(bob).claim(1)).to.changeTokenBalance(newToken, bob, split(E18)[1]);
  });

  it("fee on transfer old token: credits and splits only what arrived", async function () {
    const { alice, migration, oldToken, newToken } = await deploySystem("MockFeeOnTransfer", [100n]); // 1% fee
    const amount = 1_000n * E18;
    await oldToken.connect(alice).approve(await migration.getAddress(), amount);
    const arrived = amount - amount / 100n;
    const [i, l] = split(arrived);
    await expect(migration.connect(alice).migrate(amount))
      .to.emit(migration, "Migrated")
      .withArgs(alice.address, 0n, arrived, i, l, (v) => v > 0n);
    expect(await newToken.balanceOf(alice.address)).to.equal(i);
    expect((await migration.lotOf(alice.address, 0))[0]).to.equal(l);
    expect(await migration.totalMigrated()).to.equal(arrived);
    expect(await oldToken.balanceOf(await migration.getAddress())).to.equal(arrived);
  });

  it("rejects a token that reports more than was sent, or nothing at all", async function () {
    const { alice, migration, oldToken } = await deploySystem("MockMaliciousToken");
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);

    await oldToken.configure(5, await migration.getAddress()); // inflating
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "ReceivedMoreThanSent");

    await oldToken.configure(6, await migration.getAddress()); // lying, moves nothing
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "NothingReceived");
  });
});

describe("CojamMigration: release of the locked 90%", function () {
  it("lock edges: claim at unlock minus 1 reverts, at unlock pays and emits Claimed", async function () {
    const { alice, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 70n * E18);
    const [, unlockAt] = await migration.lotOf(alice.address, 0);
    const locked = 63n * E18;

    await time.setNextBlockTimestamp(unlockAt - 1n);
    await expect(migration.connect(alice).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");

    await time.setNextBlockTimestamp(unlockAt);
    const tx = migration.connect(alice).claim(10);
    await expect(tx).to.emit(migration, "Claimed").withArgs(alice.address, 0n, locked, alice.address);
    await expect(tx).to.changeTokenBalances(newToken, [alice, migration], [locked, -locked]);
    expect((await migration.lotOf(alice.address, 0))[2]).to.equal(true);
    expect(await migration.totalOwed()).to.equal(0n);
    expect(await migration.totalClaimed()).to.equal(locked);
    expect(await newToken.balanceOf(alice.address)).to.equal(70n * E18); // 10% + 90%
    await expect(migration.connect(alice).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");
  });

  it("claimFor by a stranger (keeper) pays the lot owner, never the caller", async function () {
    const { alice, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 100n * E18);
    const [, unlockAt] = await migration.lotOf(alice.address, 0);

    await time.setNextBlockTimestamp(unlockAt - 1n);
    await expect(migration.connect(stranger).claimFor(alice.address, 10))
      .to.be.revertedWithCustomError(migration, "NothingToClaim");

    await time.setNextBlockTimestamp(unlockAt);
    const tx = migration.connect(stranger).claimFor(alice.address, 10);
    await expect(tx).to.emit(migration, "Claimed").withArgs(alice.address, 0n, 90n * E18, stranger.address);
    await expect(tx).to.changeTokenBalances(newToken, [alice, stranger], [90n * E18, 0n]);
    await expect(migration.connect(stranger).claimFor(alice.address, 10))
      .to.be.revertedWithCustomError(migration, "NothingToClaim");
  });

  it("nobody can redirect or take someone else's lots", async function () {
    const { alice, bob, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 50n * E18);
    await time.increase(LOCK);
    // bob has no lots: claim pays him nothing, and claimFor(bob) cannot touch alice's lots
    await expect(migration.connect(bob).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    await expect(migration.connect(alice).claimFor(bob.address, 10)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    expect(await migration.claimable(alice.address, 10)).to.deep.equal([45n * E18, 1n]);
    // the only way out is to alice, whoever calls and whatever list is passed
    await expect(migration.connect(stranger).claimForMany([alice.address, bob.address, alice.address], 10))
      .to.changeTokenBalances(newToken, [alice, bob, stranger], [45n * E18, 0n, 0n]);
  });

  it("claimForMany releases matured lots for several owners and skips the rest", async function () {
    const { alice, bob, carol, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 10n * E18);
    await approveAndMigrate(oldToken, migration, bob, 20n * E18);
    await time.increase(LOCK);
    await approveAndMigrate(oldToken, migration, carol, 30n * E18); // still locked

    await expect(migration.connect(stranger).claimForMany([carol.address], 10))
      .to.be.revertedWithCustomError(migration, "NothingToClaim");
    const tx = migration.connect(stranger).claimForMany([alice.address, bob.address, carol.address], 10);
    await expect(tx).to.changeTokenBalances(newToken, [alice, bob, carol, stranger], [9n * E18, 18n * E18, 0n, 0n]);
    expect(await migration.pendingOf(carol.address)).to.equal(27n * E18);
  });

  it("multiple lots and partial claims, oldest first, bounded by maxLots", async function () {
    const { alice, migration, oldToken, newToken } = await loadFixture(fixture);
    await oldToken.connect(alice).approve(await migration.getAddress(), 1_000n * E18);
    await migration.connect(alice).migrate(10n * E18); // lot 0: 9 locked
    await time.increase(DAY);
    await migration.connect(alice).migrate(20n * E18); // lot 1: 18 locked
    await time.increase(3n * DAY);
    await migration.connect(alice).migrate(40n * E18); // lot 2: 36 locked
    const [, unlock1] = await migration.lotOf(alice.address, 1);
    await time.increaseTo(unlock1); // lots 0 and 1 matured, lot 2 locked

    expect(await migration.claimable(alice.address, 100)).to.deep.equal([27n * E18, 2n]);
    expect(await migration.claimable(alice.address, 1)).to.deep.equal([9n * E18, 1n]);

    await expect(migration.connect(alice).claim(0)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 9n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(1n);
    await expect(migration.connect(alice).claim(50)).to.changeTokenBalance(newToken, alice, 18n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(2n);
    await expect(migration.connect(alice).claim(50)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    expect(await migration.pendingOf(alice.address)).to.equal(36n * E18);

    const [, unlock2] = await migration.lotOf(alice.address, 2);
    await time.increaseTo(unlock2);
    await expect(migration.connect(alice).claim(50))
      .to.emit(migration, "Claimed").withArgs(alice.address, 2n, 36n * E18, alice.address);
    expect(await migration.pendingOf(alice.address)).to.equal(0n);
    expect(await newToken.balanceOf(alice.address)).to.equal(70n * E18);
  });

  it("a wallet with 60 lots is released in bounded chunks", async function () {
    const { alice, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await oldToken.connect(alice).approve(await migration.getAddress(), 600n * E18);
    for (let i = 0; i < 60; i++) await migration.connect(alice).migrate(10n * E18);
    expect(await newToken.balanceOf(alice.address)).to.equal(60n * E18);
    await time.increase(LOCK);

    const receipt = await (await migration.connect(alice).claim(25)).wait();
    expect(await newToken.balanceOf(alice.address)).to.equal(60n * E18 + 25n * 9n * E18);
    const many = await (await migration.connect(stranger).claimForMany([alice.address], 25)).wait();
    await migration.connect(alice).claim(25);
    expect(await newToken.balanceOf(alice.address)).to.equal(600n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(60n);
    console.log(`      gas: claim(25 lots) = ${receipt.gasUsed}, claimForMany(1 user, 25 lots) = ${many.gasUsed}`);
  });

  it("claimForMany over 25 users with one lot each (keeper batch, gas recorded)", async function () {
    const { deployer, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    const m = await migration.getAddress();
    const users = [];
    for (let i = 0; i < 25; i++) {
      const w = ethers.Wallet.createRandom().connect(ethers.provider);
      await setBalance(w.address, E18);
      await oldToken.connect(deployer).transfer(w.address, 100n * E18);
      await oldToken.connect(w).approve(m, 100n * E18);
      await migration.connect(w).migrate(100n * E18);
      users.push(w.address);
    }
    await time.increase(LOCK);
    const receipt = await (await migration.connect(stranger).claimForMany(users, 10)).wait();
    for (const u of users) expect(await newToken.balanceOf(u)).to.equal(100n * E18);
    expect(await newToken.balanceOf(stranger.address)).to.equal(0n);
    console.log(`      gas: claimForMany(25 users x 1 lot) = ${receipt.gasUsed}`);
  });
});

describe("CojamMigration: owner powers", function () {
  it("only the owner can call the admin functions", async function () {
    const { alice, stranger, deployer, migration, oldToken } = await loadFixture(fixture);
    for (const who of [stranger, alice, deployer]) {
      const c = migration.connect(who);
      const o = await oldToken.getAddress();
      for (const call of [
        () => c.pauseMigrate(),
        () => c.unpauseMigrate(),
        () => c.withdrawReserve(who.address, 1n),
        () => c.recoverERC20(o, who.address, 1n),
        () => c.transferOwnership(who.address),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount").withArgs(who.address);
      }
    }
  });

  it("pause blocks migrate only; claim, claimFor and claimForMany keep paying", async function () {
    const { master, alice, bob, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 100n * E18);
    await approveAndMigrate(oldToken, migration, bob, 200n * E18);
    await time.increase(LOCK);

    await expect(migration.connect(master).pauseMigrate()).to.emit(migration, "Paused").withArgs(master.address);
    expect(await migration.paused()).to.equal(true);
    expect(await migration.isOpen()).to.equal(false);
    await expect(migration.connect(master).pauseMigrate()).to.be.revertedWithCustomError(migration, "EnforcedPause");

    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await expect(migration.connect(alice).migrate(10n * E18)).to.be.revertedWithCustomError(migration, "EnforcedPause");

    // Releases are never pausable.
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 90n * E18);
    await expect(migration.connect(stranger).claimFor(bob.address, 1)).to.changeTokenBalance(newToken, bob, 180n * E18);
    // claimForMany while paused: set up two more matured lots first (unpause, migrate, pause again).
    await migration.connect(master).unpauseMigrate();
    await approveAndMigrate(oldToken, migration, alice, 10n * E18);
    await approveAndMigrate(oldToken, migration, bob, 20n * E18);
    await time.increase(LOCK);
    await migration.connect(master).pauseMigrate();
    await expect(migration.connect(stranger).claimForMany([alice.address, bob.address], 5))
      .to.changeTokenBalances(newToken, [alice, bob, stranger], [9n * E18, 18n * E18, 0n]);

    await expect(migration.connect(master).unpauseMigrate()).to.emit(migration, "Unpaused").withArgs(master.address);
    await expect(migration.connect(master).unpauseMigrate()).to.be.revertedWithCustomError(migration, "ExpectedPause");
    expect(await migration.isOpen()).to.equal(true);
    await expect(approveAndMigrate(oldToken, migration, alice, 10n * E18)).to.emit(migration, "Migrated");
  });

  it("withdrawReserve takes only the unowed balance; owed tokens can never be withdrawn", async function () {
    const { master, alice, bob, migration, oldToken, newToken } = await loadFixture(unfunded);
    const m = await migration.getAddress();
    await newToken.connect(master).transfer(m, 1_000n * E18);
    await approveAndMigrate(oldToken, migration, alice, 500n * E18); // 50 paid, 450 owed

    expect(await newToken.balanceOf(m)).to.equal(950n * E18);
    expect(await migration.availableReserve()).to.equal(500n * E18);

    await expect(migration.connect(master).withdrawReserve(master.address, 501n * E18))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(500n * E18, 501n * E18);
    await expect(migration.connect(master).withdrawReserve(master.address, 0n)).to.be.revertedWithCustomError(migration, "ZeroAmount");
    await expect(migration.connect(master).withdrawReserve(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(migration, "InvalidRecipient");
    await expect(migration.connect(master).withdrawReserve(m, 1n)).to.be.revertedWithCustomError(migration, "InvalidRecipient");

    // Withdraw to any address the owner names (here: bob), in parts.
    await expect(migration.connect(master).withdrawReserve(bob.address, 200n * E18))
      .to.emit(migration, "ReserveWithdrawn").withArgs(bob.address, 200n * E18);
    const tx = migration.connect(master).withdrawReserve(master.address, 300n * E18);
    await expect(tx).to.changeTokenBalances(newToken, [master, migration], [300n * E18, -300n * E18]);
    expect(await migration.totalWithdrawn()).to.equal(500n * E18);
    expect(await migration.availableReserve()).to.equal(0n);
    expect(await newToken.balanceOf(m)).to.equal(await migration.totalOwed());

    // Every owed token is still there: try to take even one base unit of it.
    await expect(migration.connect(master).withdrawReserve(master.address, 1n))
      .to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(0n, 1n);

    // With no reserve, new swaps stop until the owner funds again.
    await oldToken.connect(bob).approve(m, E18);
    await expect(migration.connect(bob).migrate(E18)).to.be.revertedWithCustomError(migration, "InsufficientReserve");

    // After the withdrawal the lot still pays in full.
    await time.increase(LOCK);
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 450n * E18);
    expect(await newToken.balanceOf(alice.address)).to.equal(500n * E18);
    expect(await newToken.balanceOf(m)).to.equal(0n);
  });

  it("after a full withdrawal mid window, claimFor and claimForMany by a keeper still pay in full", async function () {
    const { master, alice, bob, carol, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    await approveAndMigrate(oldToken, migration, alice, 10n * E18);
    await approveAndMigrate(oldToken, migration, bob, 20n * E18);
    await approveAndMigrate(oldToken, migration, carol, 30n * E18);
    const available = await migration.availableReserve();
    expect(available).to.equal(SUPPLY - 60n * E18);
    await migration.connect(master).withdrawReserve(master.address, available);
    expect(await newToken.balanceOf(master.address)).to.equal(available);

    await time.increase(LOCK);
    await expect(migration.connect(stranger).claimFor(alice.address, 5)).to.changeTokenBalance(newToken, alice, 9n * E18);
    await expect(migration.connect(stranger).claimForMany([bob.address, carol.address], 5))
      .to.changeTokenBalances(newToken, [bob, carol, stranger], [18n * E18, 27n * E18, 0n]);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(0n);
    expect(await migration.totalOwed()).to.equal(0n);
  });

  it("recoverERC20: never old CT, never new CT (use withdrawReserve), other tokens yes", async function () {
    const { deployer, master, alice, migration, oldToken, newToken } = await loadFixture(fixture);
    const m = await migration.getAddress();
    await approveAndMigrate(oldToken, migration, alice, 100n * E18);
    await oldToken.connect(deployer).transfer(m, 5n * E18); // old CT sent directly by mistake
    const oldHeld = await oldToken.balanceOf(m);
    expect(oldHeld).to.equal(105n * E18);

    await expect(migration.connect(master).recoverERC20(await oldToken.getAddress(), master.address, 1n))
      .to.be.revertedWithCustomError(migration, "CannotRecoverOldToken");
    await expect(migration.connect(master).recoverERC20(await newToken.getAddress(), master.address, 1n))
      .to.be.revertedWithCustomError(migration, "UseWithdrawReserve");

    const Stray = await ethers.getContractFactory("MockDecimals");
    const stray = await Stray.deploy(1_000n * E18, 18);
    await stray.transfer(m, 7n * E18);
    await expect(migration.connect(master).recoverERC20(await stray.getAddress(), ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(migration, "InvalidRecipient");
    await expect(migration.connect(master).recoverERC20(await stray.getAddress(), master.address, 0n))
      .to.be.revertedWithCustomError(migration, "ZeroAmount");
    const tx = migration.connect(master).recoverERC20(await stray.getAddress(), master.address, 7n * E18);
    await expect(tx).to.emit(migration, "ERC20Recovered").withArgs(await stray.getAddress(), master.address, 7n * E18);
    await expect(tx).to.changeTokenBalances(stray, [master, migration], [7n * E18, -7n * E18]);

    // Old CT never left the contract.
    expect(await oldToken.balanceOf(m)).to.equal(oldHeld);
  });

  it("no function can move old CT: the swap never approves, transfers or burns it", async function () {
    const { migration } = await loadFixture(fixture);
    const names = migration.interface.fragments.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f) => f.name).sort();
    expect(names).to.deep.equal([
      "acceptOwnership", "claim", "claimFor", "claimForMany", "migrate", "pauseMigrate",
      "recoverERC20", "transferOwnership", "unpauseMigrate", "withdrawReserve",
    ]);
  });

  it("Ownable2Step: ownership moves only when the new owner accepts; renounce is disabled", async function () {
    const { master, bob, stranger, migration } = await loadFixture(fixture);
    await expect(migration.connect(master).transferOwnership(bob.address))
      .to.emit(migration, "OwnershipTransferStarted").withArgs(master.address, bob.address);
    expect(await migration.owner()).to.equal(master.address);
    expect(await migration.pendingOwner()).to.equal(bob.address);
    await expect(migration.connect(bob).pauseMigrate()).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount");
    await expect(migration.connect(stranger).acceptOwnership())
      .to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount").withArgs(stranger.address);

    await expect(migration.connect(bob).acceptOwnership())
      .to.emit(migration, "OwnershipTransferred").withArgs(master.address, bob.address);
    expect(await migration.owner()).to.equal(bob.address);
    expect(await migration.pendingOwner()).to.equal(ethers.ZeroAddress);
    await expect(migration.connect(master).pauseMigrate()).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount");
    await expect(migration.connect(bob).pauseMigrate()).to.emit(migration, "Paused");

    await expect(migration.connect(bob).renounceOwnership()).to.be.revertedWithCustomError(migration, "RenounceDisabled");
    expect(await migration.owner()).to.equal(bob.address);
  });

  it("a Safe style contract wallet can take ownership and use the owner functions", async function () {
    const { master, alice, migration, newToken } = await loadFixture(fixture);
    const safe = await (await ethers.getContractFactory("MockSmartWallet")).deploy(alice.address);
    const s = await safe.getAddress();
    const m = await migration.getAddress();
    await migration.connect(master).transferOwnership(s);
    await safe.connect(alice).execute(m, migration.interface.encodeFunctionData("acceptOwnership", []));
    expect(await migration.owner()).to.equal(s);
    await safe.connect(alice).execute(m, migration.interface.encodeFunctionData("withdrawReserve", [s, 123n]));
    expect(await newToken.balanceOf(s)).to.equal(123n);
  });

  it("after the window: no new swaps (even unpaused and funded), the owner withdraws the rest, lots still pay years later", async function () {
    const { master, alice, bob, stranger, migration, oldToken, newToken, start } = await loadFixture(fixture);
    const end = start + WINDOW;
    await approveAndMigrate(oldToken, migration, bob, 20n * E18);
    await oldToken.connect(alice).approve(await migration.getAddress(), 20n * E18);
    await time.setNextBlockTimestamp(end - 1n);
    await migration.connect(alice).migrate(10n * E18);

    await time.setNextBlockTimestamp(end);
    await expect(migration.connect(alice).migrate(10n * E18)).to.be.revertedWithCustomError(migration, "WindowClosed");
    // Pausing and unpausing cannot reopen the window.
    await migration.connect(master).pauseMigrate();
    await migration.connect(master).unpauseMigrate();
    expect(await migration.isOpen()).to.equal(false);
    await expect(migration.connect(alice).migrate(10n * E18)).to.be.revertedWithCustomError(migration, "WindowClosed");

    // The owner takes the whole remainder; only the owed lots stay.
    const rest = await migration.availableReserve();
    expect(rest).to.equal(SUPPLY - 30n * E18);
    await migration.connect(master).withdrawReserve(master.address, rest);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(27n * E18);
    expect(await newToken.balanceOf(master.address)).to.equal(rest);

    await time.increaseTo(end + LOCK);
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 9n * E18);
    await time.increase(5n * 365n * DAY);
    await expect(migration.connect(stranger).claimFor(bob.address, 1)).to.changeTokenBalance(newToken, bob, 18n * E18);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(0n);
  });
});

describe("CojamMigration: reentrancy", function () {
  // The malicious old token is made the owner, so its re-entry into the owner
  // functions passes onlyOwner and is stopped by the reentrancy guard itself.
  const evil = () => deploySystem("MockMaliciousToken", [], { ownerOf: ({ oldToken }) => oldToken.getAddress() });

  for (const [mode, label] of [[1, "migrate"], [2, "claim"], [3, "withdrawReserve"], [7, "claimFor"], [8, "claimForMany"], [9, "recoverERC20"]]) {
    it(`a malicious old token re-entering ${label} from transferFrom is rejected`, async function () {
      const { alice, migration, oldToken } = await evil();
      await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
      await oldToken.configure(mode, await migration.getAddress());
      await expect(migration.connect(alice).migrate(E18))
        .to.be.revertedWithCustomError(migration, "ReentrancyGuardReentrantCall");
    });
  }

  it("a swallowed re-entry attempt gains nothing and leaves accounting exact", async function () {
    const { alice, migration, oldToken, newToken } = await evil();
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await oldToken.configure(4, await migration.getAddress());
    await migration.connect(alice).migrate(E18);
    expect(await oldToken.reentryAttempted()).to.equal(true);
    expect(await oldToken.reentrySucceeded()).to.equal(false);
    expect(await migration.lotCount(alice.address)).to.equal(1n);
    expect(await migration.lotCount(await oldToken.getAddress())).to.equal(0n);
    expect(await migration.totalOwed()).to.equal(split(E18)[1]);
    expect(await newToken.balanceOf(await oldToken.getAddress())).to.equal(0n);
  });
});

describe("CojamMigration: contract wallet caller (Safe style)", function () {
  it("a contract wallet migrates with an atomic approve + migrate batch, gets 10% at once and 90% later", async function () {
    const { deployer, alice, stranger, migration, oldToken, newToken } = await loadFixture(fixture);
    const Wallet = await ethers.getContractFactory("MockSmartWallet");
    const wallet = await Wallet.deploy(alice.address);
    const w = await wallet.getAddress();
    await oldToken.connect(deployer).transfer(w, 500n * E18);

    const m = await migration.getAddress();
    await wallet.connect(alice).executeBatch(
      [await oldToken.getAddress(), m],
      [
        oldToken.interface.encodeFunctionData("approve", [m, 500n * E18]),
        migration.interface.encodeFunctionData("migrate", [500n * E18]),
      ]
    );
    expect(await migration.lotCount(w)).to.equal(1n);
    expect(await migration.lotCount(alice.address)).to.equal(0n); // keyed by msg.sender, never tx.origin
    expect(await newToken.balanceOf(w)).to.equal(50n * E18);

    await time.increase(LOCK);
    await migration.connect(stranger).claimFor(w, 10); // a keeper releases it; the wallet sends nothing
    expect(await newToken.balanceOf(w)).to.equal(500n * E18);
    expect(await newToken.balanceOf(alice.address)).to.equal(0n);
  });
});
