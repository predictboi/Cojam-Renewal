const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { SUPPLY, DAY, WINDOW, LOCK, GRACE, E18, deploySystem, approveAndMigrate } = require("./helpers");

const fixture = () => deploySystem("MockOldCojam");

describe("CojamToken", function () {
  it("total supply equals the old on chain supply exactly (4,083,262,533.9560001 CT)", async function () {
    const { oldToken, newToken } = await loadFixture(fixture);
    expect(await newToken.totalSupply()).to.equal(SUPPLY);
    expect(await newToken.totalSupply()).to.equal(await oldToken.totalSupply());
    expect(await newToken.TOTAL_SUPPLY()).to.equal(4_083_262_533_956_000_100_000_000_000n);
    expect(ethers.formatUnits(await newToken.totalSupply(), 18)).to.equal("4083262533.9560001");
  });

  it("the whole supply sits in the swap contract at deploy; the deployer holds none", async function () {
    const { deployer, migration, newToken } = await loadFixture(fixture);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(SUPPLY);
    expect(await newToken.balanceOf(deployer.address)).to.equal(0n);
    expect(await migration.availableReserve()).to.equal(SUPPLY);
  });

  it("has standard metadata and no admin surface (no owner, mint, pause, blacklist)", async function () {
    const { newToken } = await loadFixture(fixture);
    expect(await newToken.name()).to.equal("Cojam Token");
    expect(await newToken.symbol()).to.equal("CT");
    expect(await newToken.decimals()).to.equal(18n);
    const names = newToken.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const banned of ["owner", "mint", "pause", "unpause", "blacklist", "freeze", "upgradeTo", "transferOwnership", "burn"]) {
      expect(names, banned).to.not.include(banned);
    }
  });

  it("supports EIP-2612 permit", async function () {
    const { alice, bob, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await approveAndMigrate(oldToken, migration, alice, 10n * E18);
    await time.increase(LOCK);
    await migration.connect(alice).claim(1);

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
  it("sets immutable window, grace and addresses", async function () {
    const { migration, oldToken, treasury, start } = await loadFixture(fixture);
    expect(await migration.OLD_TOKEN()).to.equal(await oldToken.getAddress());
    expect(await migration.TREASURY()).to.equal(treasury.address);
    expect(await migration.START()).to.equal(start);
    expect(await migration.END()).to.equal(start + WINDOW);
    expect(await migration.SWEEP_OPENS_AT()).to.equal(start + WINDOW + GRACE);
    expect(await migration.LOCK_PERIOD()).to.equal(LOCK);
  });

  it("rejects bad constructor input", async function () {
    const [deployer, treasury] = await ethers.getSigners();
    const Migration = await ethers.getContractFactory("CojamMigration");
    const Old = await ethers.getContractFactory("MockOldCojam");
    const old = await Old.deploy(SUPPLY);
    const now = BigInt(await time.latest());
    const start = now + DAY;

    await expect(Migration.deploy(ethers.ZeroAddress, treasury.address, start, GRACE))
      .to.be.revertedWithCustomError(Migration, "ZeroAddress");
    await expect(Migration.deploy(await old.getAddress(), ethers.ZeroAddress, start, GRACE))
      .to.be.revertedWithCustomError(Migration, "ZeroAddress");
    await expect(Migration.deploy(await old.getAddress(), treasury.address, now - 10n, GRACE))
      .to.be.revertedWithCustomError(Migration, "StartInPast");
    await expect(Migration.deploy(await old.getAddress(), treasury.address, start, 366n * DAY))
      .to.be.revertedWithCustomError(Migration, "GracePeriodTooLong");

    const Dec = await ethers.getContractFactory("MockDecimals");
    const six = await Dec.deploy(SUPPLY, 6);
    await expect(Migration.deploy(await six.getAddress(), treasury.address, start, GRACE))
      .to.be.revertedWithCustomError(Migration, "DecimalsMismatch");

    const off = await Old.deploy(SUPPLY - 1n);
    await expect(Migration.deploy(await off.getAddress(), treasury.address, start, GRACE))
      .to.be.revertedWithCustomError(Migration, "SupplyMismatch");

    // A burn of old CT before deploy also trips the supply check.
    await old.connect(deployer).burn(1n);
    await expect(Migration.deploy(await old.getAddress(), treasury.address, start, GRACE))
      .to.be.revertedWithCustomError(Migration, "SupplyMismatch");
  });
});

describe("CojamMigration: migrate", function () {
  it("swaps 1:1, keeps old CT in the contract, opens a 7 day lot and emits Migrated", async function () {
    const { alice, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    const amount = 12_500n * E18;
    await oldToken.connect(alice).approve(await migration.getAddress(), amount);
    const tx = await migration.connect(alice).migrate(amount);
    const t = BigInt(await time.latest());
    await expect(tx).to.emit(migration, "Migrated").withArgs(alice.address, 0n, amount, amount, t + LOCK);
    await expect(tx).to.changeTokenBalances(oldToken, [alice, migration], [-amount, amount]);
    await expect(tx).to.changeTokenBalance(newToken, alice, 0n); // locked, nothing paid yet

    const [lotAmount, unlockAt, claimed] = await migration.lotOf(alice.address, 0);
    expect(lotAmount).to.equal(amount);
    expect(unlockAt).to.equal(t + LOCK);
    expect(claimed).to.equal(false);
    expect(await migration.totalMigrated()).to.equal(amount);
    expect(await migration.totalOwed()).to.equal(amount);
    expect(await migration.availableReserve()).to.equal(SUPPLY - amount);
  });

  it("loses no dust: odd amounts, 1 wei and the full balance all map exactly", async function () {
    const { alice, migration, oldToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    const odd = 123_456_789_012_345_678_901n;
    await approveAndMigrate(oldToken, migration, alice, odd);
    await approveAndMigrate(oldToken, migration, alice, 1n);
    const rest = await oldToken.balanceOf(alice.address);
    await approveAndMigrate(oldToken, migration, alice, rest);
    expect(await oldToken.balanceOf(alice.address)).to.equal(0n);
    expect((await migration.lotOf(alice.address, 0))[0]).to.equal(odd);
    expect((await migration.lotOf(alice.address, 1))[0]).to.equal(1n);
    expect((await migration.lotOf(alice.address, 2))[0]).to.equal(rest);
    expect(await migration.pendingOf(alice.address)).to.equal(1_000_000n * E18);
  });

  it("reverts on a zero amount", async function () {
    const { alice, migration, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await expect(migration.connect(alice).migrate(0)).to.be.revertedWithCustomError(migration, "ZeroAmount");
  });

  it("reverts without approval and when the amount exceeds the balance", async function () {
    const { alice, stranger, migration, oldToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "ERC20InsufficientAllowance");
    await oldToken.connect(stranger).approve(await migration.getAddress(), E18);
    await expect(migration.connect(stranger).migrate(E18)).to.be.revertedWithCustomError(oldToken, "ERC20InsufficientBalance");
  });

  it("window edges: before start reverts, at start works, end minus 1 works, at end reverts", async function () {
    const { alice, migration, oldToken, start } = await loadFixture(fixture);
    const end = start + WINDOW;
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);

    await time.setNextBlockTimestamp(start - 1n);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "NotStarted");

    await time.setNextBlockTimestamp(start);
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");

    await time.setNextBlockTimestamp(end - 1n);
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");

    await time.setNextBlockTimestamp(end);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "WindowClosed");
    expect(await migration.isOpen()).to.equal(false);
    expect(await migration.lotCount(alice.address)).to.equal(2n);
  });

  it("old token paused by its owner: migrate reverts cleanly with no state change, works again after unpause", async function () {
    const { deployer, alice, migration, oldToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await oldToken.connect(deployer).pause();
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "TokenPaused");
    expect(await migration.lotCount(alice.address)).to.equal(0n);
    expect(await migration.totalMigrated()).to.equal(0n);
    expect(await migration.totalOwed()).to.equal(0n);

    await oldToken.connect(deployer).unPause();
    await expect(migration.connect(alice).migrate(E18)).to.emit(migration, "Migrated");
  });

  it("a frozen holder cannot migrate, but freezing the swap contract itself changes nothing", async function () {
    const { deployer, alice, bob, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await oldToken.connect(deployer).freeze(alice.address);
    await oldToken.connect(alice).approve(await migration.getAddress(), E18);
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(oldToken, "AccountFrozen");

    // The swap never sends old CT, so a freeze on its own address cannot block migrate or claim.
    await oldToken.connect(deployer).freeze(await migration.getAddress());
    await approveAndMigrate(oldToken, migration, bob, E18);
    await time.increase(LOCK);
    await expect(migration.connect(bob).claim(1)).to.changeTokenBalance(newToken, bob, E18);
  });

  it("fee on transfer old token: credits only what arrived", async function () {
    const { alice, migration, oldToken, start } = await deploySystem("MockFeeOnTransfer", [100n]); // 1% fee
    await time.increaseTo(start);
    const amount = 1_000n * E18;
    await oldToken.connect(alice).approve(await migration.getAddress(), amount);
    const arrived = amount - amount / 100n;
    await expect(migration.connect(alice).migrate(amount))
      .to.emit(migration, "Migrated")
      .withArgs(alice.address, 0n, arrived, arrived, (v) => v > 0n);
    expect((await migration.lotOf(alice.address, 0))[0]).to.equal(arrived);
    expect(await migration.totalMigrated()).to.equal(arrived);
    expect(await oldToken.balanceOf(await migration.getAddress())).to.equal(arrived);
  });

  it("rejects a token that reports more than was sent, or nothing at all", async function () {
    const { alice, migration, oldToken, start } = await deploySystem("MockMaliciousToken");
    await time.increaseTo(start);
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);

    await oldToken.configure(5, await migration.getAddress()); // inflating
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "ReceivedMoreThanSent");

    await oldToken.configure(6, await migration.getAddress()); // lying, moves nothing
    await expect(migration.connect(alice).migrate(E18)).to.be.revertedWithCustomError(migration, "NothingReceived");
  });

  it("reverts with ReserveExhausted if the old supply ever exceeded the new reserve", async function () {
    const { deployer, alice, migration, oldToken, start } = await deploySystem("MockMaliciousToken");
    await time.increaseTo(start);
    await oldToken.mint(alice.address, 1n); // impossible for real old CT (no mint), shown for the guard
    const all = await oldToken.balanceOf(deployer.address);
    await approveAndMigrate(oldToken, migration, deployer, all);
    for (const s of await ethers.getSigners()) {
      const b = await oldToken.balanceOf(s.address);
      if (b > 0n && s.address !== alice.address) await approveAndMigrate(oldToken, migration, s, b);
    }
    // Every new CT is now owed except alice's 1,000,000 CT; she holds 1 wei more than that.
    const aliceBal = await oldToken.balanceOf(alice.address);
    expect(await migration.availableReserve()).to.equal(aliceBal - 1n);
    await oldToken.connect(alice).approve(await migration.getAddress(), aliceBal);
    await expect(migration.connect(alice).migrate(aliceBal)).to.be.revertedWithCustomError(migration, "ReserveExhausted");
    await expect(migration.connect(alice).migrate(aliceBal - 1n)).to.emit(migration, "Migrated");
    expect(await migration.availableReserve()).to.equal(0n);
  });
});

describe("CojamMigration: claim", function () {
  it("lock edges: claim at unlock minus 1 reverts, at unlock pays and emits Claimed", async function () {
    const { alice, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await approveAndMigrate(oldToken, migration, alice, 7n * E18);
    const [, unlockAt] = await migration.lotOf(alice.address, 0);

    await time.setNextBlockTimestamp(unlockAt - 1n);
    await expect(migration.connect(alice).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");

    await time.setNextBlockTimestamp(unlockAt);
    const tx = migration.connect(alice).claim(10);
    await expect(tx).to.emit(migration, "Claimed").withArgs(alice.address, 0n, 7n * E18);
    await expect(tx).to.changeTokenBalances(newToken, [alice, migration], [7n * E18, -7n * E18]);
    expect((await migration.lotOf(alice.address, 0))[2]).to.equal(true);
    expect(await migration.totalOwed()).to.equal(0n);
    expect(await migration.totalClaimed()).to.equal(7n * E18);
    await expect(migration.connect(alice).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");
  });

  it("multiple lots and partial claims, oldest first, bounded by maxLots", async function () {
    const { alice, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await oldToken.connect(alice).approve(await migration.getAddress(), 100n * E18);
    await migration.connect(alice).migrate(1n * E18); // lot 0
    await time.increase(DAY);
    await migration.connect(alice).migrate(2n * E18); // lot 1
    await time.increase(3n * DAY);
    await migration.connect(alice).migrate(4n * E18); // lot 2
    const [, unlock1] = await migration.lotOf(alice.address, 1);
    await time.increaseTo(unlock1); // lots 0 and 1 matured, lot 2 locked

    expect(await migration.claimable(alice.address, 100)).to.deep.equal([3n * E18, 2n]);
    expect(await migration.claimable(alice.address, 1)).to.deep.equal([1n * E18, 1n]);

    await expect(migration.connect(alice).claim(0)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 1n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(1n);
    await expect(migration.connect(alice).claim(50)).to.changeTokenBalance(newToken, alice, 2n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(2n);
    await expect(migration.connect(alice).claim(50)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    expect(await migration.pendingOf(alice.address)).to.equal(4n * E18);

    const [, unlock2] = await migration.lotOf(alice.address, 2);
    await time.increaseTo(unlock2);
    await expect(migration.connect(alice).claim(50))
      .to.emit(migration, "Claimed").withArgs(alice.address, 2n, 4n * E18);
    expect(await migration.pendingOf(alice.address)).to.equal(0n);
  });

  it("nobody can claim someone else's lots", async function () {
    const { alice, bob, migration, oldToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await approveAndMigrate(oldToken, migration, alice, 5n * E18);
    await time.increase(LOCK);
    await expect(migration.connect(bob).claim(10)).to.be.revertedWithCustomError(migration, "NothingToClaim");
    expect(await migration.claimable(alice.address, 10)).to.deep.equal([5n * E18, 1n]);
  });

  it("claims keep working after the window closes, and years later", async function () {
    const { alice, bob, migration, oldToken, newToken, start } = await loadFixture(fixture);
    const end = start + WINDOW;
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await oldToken.connect(bob).approve(await migration.getAddress(), 10n * E18);
    await time.increaseTo(start);
    await migration.connect(bob).migrate(2n * E18);
    await time.setNextBlockTimestamp(end - 1n);
    await migration.connect(alice).migrate(3n * E18);
    await time.increaseTo(end + LOCK);
    await expect(migration.connect(alice).claim(1)).to.changeTokenBalance(newToken, alice, 3n * E18);

    // Bob never claimed: after the sweep and five more years his lot still pays in full.
    await time.increaseTo(end + GRACE);
    await migration.sweep();
    await time.increase(5n * 365n * DAY);
    expect(await migration.isOpen()).to.equal(false);
    await expect(migration.connect(bob).claim(1)).to.changeTokenBalance(newToken, bob, 2n * E18);
  });

  it("a wallet with 60 lots claims in bounded chunks", async function () {
    const { alice, migration, oldToken, newToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    await oldToken.connect(alice).approve(await migration.getAddress(), 60n * E18);
    for (let i = 0; i < 60; i++) await migration.connect(alice).migrate(E18);
    await time.increase(LOCK);

    const tx = await migration.connect(alice).claim(25);
    const receipt = await tx.wait();
    expect(await newToken.balanceOf(alice.address)).to.equal(25n * E18);
    await migration.connect(alice).claim(25);
    await migration.connect(alice).claim(25);
    expect(await newToken.balanceOf(alice.address)).to.equal(60n * E18);
    expect(await migration.nextClaimIndex(alice.address)).to.equal(60n);
    console.log(`      gas: claim(25 lots) = ${receipt.gasUsed}`);
  });
});

describe("CojamMigration: sweep", function () {
  async function migratedAndClosed() {
    const f = await deploySystem("MockOldCojam");
    const { alice, bob, migration, oldToken, start } = f;
    await time.increaseTo(start);
    await approveAndMigrate(oldToken, migration, alice, 100n * E18);
    await approveAndMigrate(oldToken, migration, bob, 250n * E18);
    await time.increase(LOCK);
    await migration.connect(alice).claim(10); // alice claimed, bob did not
    return f;
  }

  it("is closed until END + grace, then sends only the unowed remainder to the treasury", async function () {
    const { bob, stranger, treasury, migration, newToken, start } = await loadFixture(migratedAndClosed);
    const end = start + WINDOW;
    const opens = end + GRACE;

    await time.setNextBlockTimestamp(end);
    await expect(migration.connect(stranger).sweep()).to.be.revertedWithCustomError(migration, "SweepNotOpen");
    await time.setNextBlockTimestamp(opens - 1n);
    await expect(migration.connect(stranger).sweep()).to.be.revertedWithCustomError(migration, "SweepNotOpen");

    const owed = 250n * E18;
    const expected = SUPPLY - 100n * E18 - owed;
    expect(await migration.availableReserve()).to.equal(expected);

    await time.setNextBlockTimestamp(opens);
    const tx = migration.connect(stranger).sweep(); // anyone can call it
    await expect(tx).to.emit(migration, "Swept").withArgs(treasury.address, expected);
    await expect(tx).to.changeTokenBalances(newToken, [treasury, migration], [expected, -expected]);

    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(owed);
    expect(await migration.totalOwed()).to.equal(owed);
    await expect(migration.sweep()).to.be.revertedWithCustomError(migration, "NothingToSweep");

    // Bob's unclaimed lot is untouched and still pays in full.
    await expect(migration.connect(bob).claim(10)).to.changeTokenBalance(newToken, bob, owed);
    expect(await newToken.balanceOf(await migration.getAddress())).to.equal(0n);
  });

  it("new CT sent to the contract by mistake later is swept to the treasury too, never below what is owed", async function () {
    const { bob, treasury, migration, newToken, start } = await loadFixture(migratedAndClosed);
    await time.increaseTo(start + WINDOW + GRACE);
    await migration.sweep();
    // A stray transfer of new CT arrives after the first sweep.
    await newToken.connect(treasury).transfer(await migration.getAddress(), 9n);
    await expect(migration.sweep()).to.emit(migration, "Swept").withArgs(treasury.address, 9n);
    expect(await migration.availableReserve()).to.equal(0n);
    expect(await migration.pendingOf(bob.address)).to.equal(250n * E18);
  });

  it("when every token is owed to lots there is nothing to sweep", async function () {
    const { deployer, alice, bob, carol, migration, oldToken, start } = await loadFixture(fixture);
    await time.increaseTo(start);
    for (const s of [deployer, alice, bob, carol]) {
      await approveAndMigrate(oldToken, migration, s, await oldToken.balanceOf(s.address));
    }
    expect(await migration.totalOwed()).to.equal(SUPPLY);
    await time.increaseTo(start + WINDOW + GRACE);
    await expect(migration.sweep()).to.be.revertedWithCustomError(migration, "NothingToSweep");
  });
});

describe("CojamMigration: reentrancy", function () {
  for (const [mode, label] of [[1, "migrate"], [2, "claim"], [3, "sweep"]]) {
    it(`a malicious old token re-entering ${label} from transferFrom is rejected`, async function () {
      const { alice, migration, oldToken, start } = await deploySystem("MockMaliciousToken");
      await time.increaseTo(start);
      await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
      await oldToken.configure(mode, await migration.getAddress());
      await expect(migration.connect(alice).migrate(E18))
        .to.be.revertedWithCustomError(migration, "ReentrancyGuardReentrantCall");
    });
  }

  it("a swallowed re-entry attempt gains nothing and leaves accounting exact", async function () {
    const { alice, migration, oldToken, start } = await deploySystem("MockMaliciousToken");
    await time.increaseTo(start);
    await oldToken.connect(alice).approve(await migration.getAddress(), 10n * E18);
    await oldToken.configure(4, await migration.getAddress());
    await migration.connect(alice).migrate(E18);
    expect(await oldToken.reentryAttempted()).to.equal(true);
    expect(await oldToken.reentrySucceeded()).to.equal(false);
    expect(await migration.lotCount(alice.address)).to.equal(1n);
    expect(await migration.lotCount(await oldToken.getAddress())).to.equal(0n);
    expect(await migration.totalOwed()).to.equal(E18);
  });
});

describe("CojamMigration: contract wallet caller (Safe style)", function () {
  it("a contract wallet migrates with an atomic approve + migrate batch and claims later", async function () {
    const { deployer, alice, migration, oldToken, newToken, start } = await loadFixture(fixture);
    const Wallet = await ethers.getContractFactory("MockSmartWallet");
    const wallet = await Wallet.deploy(alice.address);
    const w = await wallet.getAddress();
    await oldToken.connect(deployer).transfer(w, 500n * E18);
    await time.increaseTo(start);

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

    await time.increase(LOCK);
    await wallet.connect(alice).execute(m, migration.interface.encodeFunctionData("claim", [10]));
    expect(await newToken.balanceOf(w)).to.equal(500n * E18);
    expect(await newToken.balanceOf(alice.address)).to.equal(0n);
  });
});
