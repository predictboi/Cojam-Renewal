// Randomized (fuzz style) sequences of migrate, claim, time travel and sweep,
// checked step by step against a plain JavaScript model, with invariants after
// every step. Reproducible: FUZZ_SEED picks the first seed, FUZZ_RUNS the count,
// FUZZ_STEPS the length of each run.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { SUPPLY, DAY, WINDOW, LOCK, GRACE, E18 } = require("./helpers");

const RUNS = Number(process.env.FUZZ_RUNS || 6);
const STEPS = Number(process.env.FUZZ_STEPS || 160);
const SEED0 = Number(process.env.FUZZ_SEED || 20261112);

function prng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n) => Math.floor(next() * n);
  const big = (max) => {
    // uniform-ish BigInt in [0, max]
    let r = 0n;
    for (let i = 0; i < 4; i++) r = (r << 32n) | BigInt(Math.floor(next() * 2 ** 32));
    return max === 0n ? 0n : r % (max + 1n);
  };
  return { next, int, big };
}

async function expectRevert(promise, contract, error) {
  await expect(promise).to.be.revertedWithCustomError(contract, error);
}

for (let run = 0; run < RUNS; run++) {
  const seed = SEED0 + run;
  const feeBps = run % 3 === 2 ? 37n : 0n; // every third run uses a fee on transfer old token

  describe(`fuzz run seed=${seed}${feeBps ? " (fee on transfer old token)" : ""}`, function () {
    it(`random migrate / claim / time / sweep sequence keeps every invariant (${STEPS} steps)`, async function () {
      const rnd = prng(seed);
      const signers = await ethers.getSigners();
      const [deployer, treasury] = signers;
      const users = signers.slice(2, 10);

      const oldToken = feeBps
        ? await (await ethers.getContractFactory("MockFeeOnTransfer")).deploy(SUPPLY, feeBps)
        : await (await ethers.getContractFactory("MockOldCojam")).deploy(SUPPLY);
      let now = BigInt(await time.latest());
      const start = now + 2n * DAY;
      const migration = await (await ethers.getContractFactory("CojamMigration"))
        .deploy(await oldToken.getAddress(), treasury.address, start, GRACE);
      const newToken = await ethers.getContractAt("CojamToken", await migration.NEW_TOKEN());
      const m = await migration.getAddress();
      const end = start + WINDOW;
      const sweepOpens = end + GRACE;
      const received = (x) => x - (x * feeBps) / 10_000n;

      // Random odd balances, including tiny ones.
      for (const u of users) {
        const amt = rnd.int(4) === 0 ? BigInt(1 + rnd.int(1000)) : rnd.big(50_000_000n * E18);
        await oldToken.connect(deployer).transfer(u.address, amt);
        await oldToken.connect(u).approve(m, ethers.MaxUint256);
      }
      now = BigInt(await time.latest());

      // Model
      const lots = new Map(users.map((u) => [u.address, []]));
      const cursor = new Map(users.map((u) => [u.address, 0]));
      const claimedBy = new Map(users.map((u) => [u.address, 0n]));
      let totalMigrated = 0n, totalOwed = 0n, totalClaimed = 0n, totalSwept = 0n;
      const counts = { migrate: 0, migrateRevert: 0, claim: 0, claimRevert: 0, sweep: 0, sweepRevert: 0 };

      const nextTs = async (advance) => {
        now = now + 1n + advance;
        await time.setNextBlockTimestamp(now);
      };

      const checkInvariants = async () => {
        const held = await newToken.balanceOf(m);
        expect(held >= totalOwed, "held >= owed").to.equal(true);
        expect(await migration.totalOwed()).to.equal(totalOwed);
        expect(await migration.totalMigrated()).to.equal(totalMigrated);
        expect(await migration.totalClaimed()).to.equal(totalClaimed);
        expect(await migration.totalSwept()).to.equal(totalSwept);
        let sumUnclaimed = 0n;
        for (const [addr, list] of lots) for (let i = cursor.get(addr); i < list.length; i++) sumUnclaimed += list[i][0];
        expect(sumUnclaimed).to.equal(totalOwed);
        expect(held + totalClaimed + totalSwept).to.equal(SUPPLY);
        expect(await oldToken.balanceOf(m)).to.equal(totalMigrated);
        expect(totalMigrated).to.equal(totalOwed + totalClaimed);
        expect(await migration.availableReserve()).to.equal(held - totalOwed);
      };

      for (let step = 0; step < STEPS; step++) {
        const u = users[rnd.int(users.length)];
        const list = lots.get(u.address);
        const r = rnd.next();

        if (r < 0.5) {
          // migrate
          // Top up drained wallets now and then, so later steps still have something to migrate.
          if ((await oldToken.balanceOf(u.address)) === 0n || rnd.int(8) === 0) {
            await oldToken.connect(deployer).transfer(u.address, 1n + rnd.big(5_000_000n * E18));
            now = BigInt(await time.latest());
          }
          const bal = await oldToken.balanceOf(u.address);
          const pick = rnd.int(6);
          const amount = pick === 0 ? 0n : pick === 1 ? bal : pick === 2 ? 1n : pick === 3 ? bal + 1n : rnd.big(bal);
          await nextTs(BigInt(rnd.int(3 * 86400)));
          const p = migration.connect(u).migrate(amount);
          if (amount === 0n) { await expectRevert(p, migration, "ZeroAmount"); counts.migrateRevert++; }
          else if (now < start) { await expectRevert(p, migration, "NotStarted"); counts.migrateRevert++; }
          else if (now >= end) { await expectRevert(p, migration, "WindowClosed"); counts.migrateRevert++; }
          else if (amount > bal) { await expectRevert(p, oldToken, "ERC20InsufficientBalance"); counts.migrateRevert++; }
          else if (received(amount) === 0n) { await expectRevert(p, migration, "NothingReceived"); counts.migrateRevert++; }
          else {
            const got = received(amount);
            await expect(p).to.emit(migration, "Migrated").withArgs(u.address, BigInt(list.length), got, got, now + LOCK);
            list.push([got, now + LOCK]);
            totalMigrated += got;
            totalOwed += got;
            counts.migrate++;
          }
        } else if (r < 0.85) {
          // claim; sometimes land exactly on, or one second before, the next unlock
          let advance = BigInt(rnd.int(5 * 86400));
          const c = cursor.get(u.address);
          if (c < list.length && rnd.int(3) === 0) {
            const target = list[c][1] - (rnd.int(2) === 0 ? 1n : 0n);
            if (target > now + 1n) advance = target - now - 1n;
          }
          await nextTs(advance);
          const maxLots = rnd.int(4) === 0 ? 0 : 1 + rnd.int(5);
          let i = c, amt = 0n;
          while (i < list.length && i < c + maxLots && now >= list[i][1]) { amt += list[i][0]; i++; }
          const p = migration.connect(u).claim(maxLots);
          if (amt === 0n) { await expectRevert(p, migration, "NothingToClaim"); counts.claimRevert++; }
          else {
            await expect(p).to.changeTokenBalance(newToken, u, amt);
            cursor.set(u.address, i);
            totalOwed -= amt;
            totalClaimed += amt;
            claimedBy.set(u.address, claimedBy.get(u.address) + amt);
            counts.claim++;
          }
        } else if (r < 0.94) {
          // sweep attempt
          await nextTs(BigInt(rnd.int(86400)));
          const avail = (await newToken.balanceOf(m)) - totalOwed;
          const p = migration.connect(users[0]).sweep();
          if (now < sweepOpens) { await expectRevert(p, migration, "SweepNotOpen"); counts.sweepRevert++; }
          else if (avail === 0n) { await expectRevert(p, migration, "NothingToSweep"); counts.sweepRevert++; }
          else {
            await expect(p).to.emit(migration, "Swept").withArgs(treasury.address, avail);
            totalSwept += avail;
            counts.sweep++;
          }
        } else {
          // Time jump. Late in the run the jumps get big, pushing it across END and
          // the grace period, so post window claims and sweeps get exercised too.
          now += step < STEPS * 0.6 ? BigInt(1 + rnd.int(3)) * DAY : BigInt(20 + rnd.int(60)) * DAY;
          await time.setNextBlockTimestamp(now);
          await ethers.provider.send("evm_mine", []);
        }
        await checkInvariants();
        for (const v of users) expect(await newToken.balanceOf(v.address)).to.equal(claimedBy.get(v.address));
      }

      // Drain: after everything is open, sweep and claim all; nothing may be missing or stranded.
      if (now < sweepOpens + LOCK) { now = sweepOpens + LOCK; await time.setNextBlockTimestamp(now); await ethers.provider.send("evm_mine", []); }
      const avail = (await newToken.balanceOf(m)) - totalOwed;
      if (avail > 0n) { await migration.sweep(); totalSwept += avail; }
      for (const u of users) {
        const list = lots.get(u.address);
        while (cursor.get(u.address) < list.length) {
          const c = cursor.get(u.address);
          const n = Math.min(50, list.length - c);
          let amt = 0n;
          for (let i = c; i < c + n; i++) amt += list[i][0];
          await migration.connect(u).claim(50);
          cursor.set(u.address, c + n);
          totalOwed -= amt; totalClaimed += amt;
          claimedBy.set(u.address, claimedBy.get(u.address) + amt);
        }
        const migratedByUser = list.reduce((s, l) => s + l[0], 0n);
        expect(await newToken.balanceOf(u.address)).to.equal(migratedByUser);
      }
      await checkInvariants();
      expect(await newToken.balanceOf(m)).to.equal(0n);
      expect(await newToken.balanceOf(treasury.address)).to.equal(SUPPLY - totalMigrated);
      console.log(`      seed ${seed}: ${JSON.stringify(counts)}, migrated ${ethers.formatUnits(totalMigrated, 18)} CT`);
    });
  });
}
