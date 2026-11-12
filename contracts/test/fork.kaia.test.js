// Fork tests against the real old CT on Kaia mainnet (chain 8217).
// Skipped automatically when the RPC is unreachable, or when SKIP_FORK=1.
// RPC: KAIA_RPC_URL, default https://public-en.node.kaia.io
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time, reset, impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { SUPPLY, LOCK, GRACE, E18, split } = require("./helpers");

const RPC = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";
const OLD_CT = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const OLD_OWNER = "0xeb1622d0377da1f9815bfc6eff61afe3257a0518";

const OLD_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function pause()",
  "function unPause()",
  "function freeze(address)",
  "function unFreeze(address)",
  "function isFrozen(address) view returns (bool)",
];

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

describe("fork: real old CT on Kaia mainnet", function () {
  this.timeout(300000);
  let remote, forkBlock;

  before(async function () {
    if (process.env.SKIP_FORK === "1") return this.skip();
    try {
      remote = new ethers.JsonRpcProvider(RPC, 8217, { staticNetwork: true });
      forkBlock = (await withTimeout(remote.getBlockNumber(), 15000)) - 5;
    } catch (e) {
      console.log(`      Kaia RPC unreachable (${e.message}); skipping fork tests`);
      return this.skip();
    }
  });

  after(async function () {
    if (remote) remote.destroy();
    await reset(); // back to a clean local chain for the other test files
  });

  it("reads the live contract: name, symbol, decimals, exact supply, owner, not paused", async function () {
    const ct = new ethers.Contract(OLD_CT, OLD_ABI, remote);
    const [name, symbol, decimals, supply, owner, paused] = await Promise.all([
      ct.name(), ct.symbol(), ct.decimals(), ct.totalSupply(), ct.owner(), ct.paused(),
    ]);
    console.log(`      on chain at ~${forkBlock}: ${name} (${symbol}), ${decimals} decimals, supply ${supply} = ${ethers.formatUnits(supply, 18)} CT, owner ${owner}, paused ${paused}`);
    expect(symbol).to.equal("CT");
    expect(decimals).to.equal(18n);
    expect(supply, "old supply changed: update CojamToken.TOTAL_SUPPLY before deploy").to.equal(SUPPLY);
    expect(owner.toLowerCase()).to.equal(OLD_OWNER);
    expect(paused, "old CT is paused: migrate would revert, use the snapshot fallback").to.equal(false);
  });

  describe("on a local fork", function () {
    let old, migration, newToken, treasury, holder, other, keeper, owner, balanceSlot;

    // Credit a test wallet with old CT by writing the balances mapping slot directly,
    // instead of moving a real holder's tokens. This does not change totalSupply.
    async function credit(addr, amount) {
      const key = ethers.solidityPackedKeccak256(["uint256", "uint256"], [addr, balanceSlot]);
      await network.provider.send("hardhat_setStorageAt", [OLD_CT, key, ethers.toBeHex(amount, 32)]);
    }

    before(async function () {
      await reset(RPC, forkBlock);
      [, treasury, holder, other, keeper] = await ethers.getSigners();
      old = await ethers.getContractAt(OLD_ABI, OLD_CT);
      migration = await (await ethers.getContractFactory("CojamMigration")).deploy(OLD_CT, treasury.address, GRACE);
      newToken = await ethers.getContractAt("CojamToken", await migration.NEW_TOKEN());

      for (let slot = 0; slot <= 20 && balanceSlot === undefined; slot++) {
        balanceSlot = slot;
        await credit(holder.address, 7n);
        if ((await old.balanceOf(holder.address)) !== 7n) {
          await credit(holder.address, 0n);
          balanceSlot = undefined;
        }
      }
      if (balanceSlot === undefined) throw new Error("balances slot not found in slots 0..20");
      console.log(`      old CT balances mapping is at storage slot ${balanceSlot}`);

      await impersonateAccount(OLD_OWNER);
      await setBalance(OLD_OWNER, 10n * E18);
      owner = await ethers.getSigner(OLD_OWNER);
    });

    it("deploys against the real old CT (supply and decimals guards pass)", async function () {
      expect(await newToken.totalSupply()).to.equal(await old.totalSupply());
      expect(await newToken.balanceOf(await migration.getAddress())).to.equal(SUPPLY);
    });

    it("migrates real old CT 1:1 (no transfer fee): 10% at once, 90% released by a keeper after 7 days", async function () {
      const bal = 1_234_567n * E18 + 89n;
      const [instant, locked] = split(bal);
      await credit(holder.address, bal);
      await old.connect(holder).approve(await migration.getAddress(), bal);
      await expect(migration.connect(holder).migrate(bal)).to.emit(migration, "Migrated");
      expect(await old.balanceOf(holder.address)).to.equal(0n);
      expect(await old.balanceOf(await migration.getAddress())).to.equal(bal);
      expect(await newToken.balanceOf(holder.address)).to.equal(instant);
      expect((await migration.lotOf(holder.address, 0))[0]).to.equal(locked);
      await time.increase(LOCK);
      await migration.connect(keeper).claimFor(holder.address, 10);
      expect(await newToken.balanceOf(holder.address)).to.equal(bal);
      expect(await newToken.balanceOf(keeper.address)).to.equal(0n);
    });

    it("real pause() by the old owner: migrate reverts, claims of existing lots still pay, unPause() restores", async function () {
      await credit(other.address, 100n * E18);
      await old.connect(other).approve(await migration.getAddress(), 100n * E18);
      await migration.connect(other).migrate(40n * E18); // lot 0, before the pause
      await time.increase(LOCK);

      await old.connect(owner).pause();
      expect(await old.paused()).to.equal(true);
      await expect(migration.connect(other).migrate(10n * E18)).to.be.reverted;
      expect(await migration.lotCount(other.address)).to.equal(1n);
      await expect(migration.connect(other).claim(10)).to.changeTokenBalance(newToken, other, 36n * E18);

      await old.connect(owner).unPause();
      await expect(migration.connect(other).migrate(10n * E18)).to.emit(migration, "Migrated");
    });

    it("real freeze(): a frozen holder cannot migrate; freezing the swap contract does not block migrate or claim", async function () {
      await old.connect(owner).freeze(other.address);
      expect(await old.isFrozen(other.address)).to.equal(true);
      await expect(migration.connect(other).migrate(1n * E18)).to.be.reverted;
      await old.connect(owner).unFreeze(other.address);

      const m = await migration.getAddress();
      await old.connect(owner).freeze(m);
      expect(await old.isFrozen(m)).to.equal(true);
      await expect(migration.connect(other).migrate(5n * E18)).to.emit(migration, "Migrated");
      await time.increase(LOCK);
      await expect(migration.connect(other).claim(10)).to.emit(migration, "Claimed");
      await old.connect(owner).unFreeze(m);
    });
  });
});
