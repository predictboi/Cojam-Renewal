// Randomized (fuzz style) sequences of migrate, claim, claimFor, claimForMany,
// time travel and owner actions (funding by plain transfer, withdrawReserve,
// pause and unpause), checked step by step against a plain JavaScript model,
// with invariants after every step. Reproducible: FUZZ_SEED picks the first seed, FUZZ_RUNS the count,
// FUZZ_STEPS the length of each run.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { SUPPLY, DAY, WINDOW, LOCK, E18, split } = require("./helpers");

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
    it(`random migrate / release / time / owner sequence keeps every invariant (${STEPS} steps)`, async function () {
      const rnd = prng(seed);
      const signers = await ethers.getSigners();
      const [deployer, master, keeper] = signers;
      const users = signers.slice(3, 11);
      const callers = [...users, keeper];

      const oldToken = feeBps
        ? await (await ethers.getContractFactory("MockFeeOnTransfer")).deploy(SUPPLY, feeBps)
        : await (await ethers.getContractFactory("MockOldCojam")).deploy(SUPPLY);
      const newToken = await (await ethers.getContractFactory("CojamToken")).deploy(master.address);
      const migration = await (await ethers.getContractFactory("CojamMigration"))
        .deploy(await oldToken.getAddress(), await newToken.getAddress(), master.address);
      const m = await migration.getAddress();
      const start = await migration.WINDOW_START();
      const end = start + WINDOW;
      const received = (x) => x - (x * feeBps) / 10_000n;

      // Partial funding, so a short reserve (InsufficientReserve) is exercised too.
      let funded = rnd.int(3) === 0 ? 0n : rnd.big(300_000_000n * E18);
      if (funded > 0n) await newToken.connect(master).transfer(m, funded);

      // Random odd balances, including tiny ones (1 to 1000 wei).
      for (const u of users) {
        const amt = rnd.int(4) === 0 ? BigInt(1 + rnd.int(1000)) : rnd.big(50_000_000n * E18);
        await oldToken.connect(deployer).transfer(u.address, amt);
        await oldToken.connect(u).approve(m, ethers.MaxUint256);
      }
      let now = BigInt(await time.latest());

      // Model
      const lots = new Map(users.map((u) => [u.address, []]));
      const cursor = new Map(users.map((u) => [u.address, 0]));
      const paidTo = new Map(callers.map((u) => [u.address, 0n])); // new CT each address should hold
      let totalMigrated = 0n, totalInstant = 0n, totalOwed = 0n, totalClaimed = 0n, totalWithdrawn = 0n;
      let paused = false;
      const counts = { migrate: 0, migrateRevert: 0, shortReserve: 0, release: 0, releaseRevert: 0, fund: 0, withdraw: 0, ownerRevert: 0, pauseToggle: 0 };

      const nextTs = async (advance) => {
        now = now + 1n + advance;
        await time.setNextBlockTimestamp(now);
      };
      // What releasing `maxLots` of `addr`'s lots at `now` would pay, and the new cursor.
      const releasable = (addr, maxLots) => {
        const list = lots.get(addr);
        const c = cursor.get(addr);
        let i = c, amt = 0n;
        while (i < list.length && i < c + maxLots && now >= list[i][1]) { amt += list[i][0]; i++; }
        return [amt, i];
      };
      const applyRelease = (addr, amt, i) => {
        cursor.set(addr, i);
        totalOwed -= amt;
        totalClaimed += amt;
        paidTo.set(addr, paidTo.get(addr) + amt);
      };

      const checkInvariants = async () => {
        const held = await newToken.balanceOf(m);
        // The core safety property: the swap always holds at least what the locked lots are owed.
        expect(held >= totalOwed, "held >= owed").to.equal(true);
        expect(await migration.totalOwed()).to.equal(totalOwed);
        expect(await migration.totalMigrated()).to.equal(totalMigrated);
        expect(await migration.totalInstant()).to.equal(totalInstant);
        expect(await migration.totalClaimed()).to.equal(totalClaimed);
        expect(await migration.totalWithdrawn()).to.equal(totalWithdrawn);
        expect(await migration.paused()).to.equal(paused);
        let sumUnreleased = 0n;
        for (const [addr, list] of lots) for (let i = cursor.get(addr); i < list.length; i++) sumUnreleased += list[i][0];
        expect(sumUnreleased).to.equal(totalOwed);
        expect(held + totalInstant + totalClaimed + totalWithdrawn).to.equal(funded);
        expect(await newToken.balanceOf(master.address)).to.equal(SUPPLY - funded + totalWithdrawn);
        expect(await oldToken.balanceOf(m)).to.equal(totalMigrated);
        expect(totalMigrated).to.equal(totalInstant + totalOwed + totalClaimed);
        expect(await migration.availableReserve()).to.equal(held - totalOwed);
        for (const v of callers) expect(await newToken.balanceOf(v.address)).to.equal(paidTo.get(v.address));
      };

      for (let step = 0; step < STEPS; step++) {
        const u = users[rnd.int(users.length)];
        const list = lots.get(u.address);
        const r = rnd.next();

        if (r < 0.5) {
          // migrate. Top up drained wallets now and then, so later steps still have something to migrate.
          if ((await oldToken.balanceOf(u.address)) === 0n || rnd.int(8) === 0) {
            await oldToken.connect(deployer).transfer(u.address, 1n + rnd.big(5_000_000n * E18));
            now = BigInt(await time.latest());
          }
          const bal = await oldToken.balanceOf(u.address);
          const pick = rnd.int(7);
          const amount = [0n, bal, 1n, 9n, bal + 1n][pick] ?? rnd.big(bal);
          await nextTs(BigInt(rnd.int(3 * 86400)));
          const available = (await newToken.balanceOf(m)) - totalOwed;
          const p = migration.connect(u).migrate(amount);
          if (paused) { await expectRevert(p, migration, "EnforcedPause"); counts.migrateRevert++; }
          else if (amount === 0n) { await expectRevert(p, migration, "ZeroAmount"); counts.migrateRevert++; }
          else if (now >= end) { await expectRevert(p, migration, "WindowClosed"); counts.migrateRevert++; }
          else if (available < amount) {
            await expect(p).to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(available, amount);
            counts.shortReserve++;
          }
          else if (amount > bal) { await expectRevert(p, oldToken, "ERC20InsufficientBalance"); counts.migrateRevert++; }
          else if (received(amount) === 0n) { await expectRevert(p, migration, "NothingReceived"); counts.migrateRevert++; }
          else {
            const got = received(amount);
            const [inst, locked] = split(got);
            expect(inst + locked).to.equal(got);
            await expect(p).to.emit(migration, "Migrated").withArgs(u.address, BigInt(list.length), got, inst, locked, now + LOCK);
            list.push([locked, now + LOCK]);
            totalMigrated += got;
            totalInstant += inst;
            totalOwed += locked;
            paidTo.set(u.address, paidTo.get(u.address) + inst);
            counts.migrate++;
          }
        } else if (r < 0.85) {
          // release by the owner (claim), by anyone (claimFor), or in a batch (claimForMany);
          // sometimes land exactly on, or one second before, the next unlock
          let advance = BigInt(rnd.int(5 * 86400));
          const c = cursor.get(u.address);
          if (c < list.length && rnd.int(3) === 0) {
            const target = list[c][1] - (rnd.int(2) === 0 ? 1n : 0n);
            if (target > now + 1n) advance = target - now - 1n;
          }
          await nextTs(advance);
          const maxLots = rnd.int(4) === 0 ? 0 : 1 + rnd.int(5);
          const caller = callers[rnd.int(callers.length)];
          const mode = rnd.int(3);
          if (mode === 2) {
            const batch = Array.from({ length: 1 + rnd.int(4) }, () => users[rnd.int(users.length)].address);
            let total = 0n;
            const plan = [];
            // the contract processes the list in order, so duplicates see the moved cursor
            const saved = new Map([...cursor]);
            for (const a of batch) {
              const [amt, i] = releasable(a, maxLots);
              if (amt > 0n) { plan.push([a, amt, i]); cursor.set(a, i); total += amt; }
            }
            for (const [a, c0] of saved) cursor.set(a, c0);
            const p = migration.connect(caller).claimForMany(batch, maxLots);
            if (total === 0n) { await expectRevert(p, migration, "NothingToClaim"); counts.releaseRevert++; }
            else { await p; for (const [a, amt, i] of plan) applyRelease(a, amt, i); counts.release++; }
          } else {
            const owner = mode === 0 ? caller : u; // mode 0: caller claims own lots; mode 1: caller releases u's lots
            const [amt, i] = lots.has(owner.address) ? releasable(owner.address, maxLots) : [0n, 0];
            const p = mode === 0 ? migration.connect(caller).claim(maxLots) : migration.connect(caller).claimFor(owner.address, maxLots);
            if (amt === 0n) { await expectRevert(p, migration, "NothingToClaim"); counts.releaseRevert++; }
            else {
              await expect(p).to.changeTokenBalance(newToken, owner, amt);
              applyRelease(owner.address, amt, i);
              counts.release++;
            }
          }
        } else if (r < 0.94) {
          // Owner actions: fund by plain transfer, withdraw reserve, pause / unpause,
          // and a non owner trying an owner function.
          await nextTs(BigInt(rnd.int(86400)));
          const sub = rnd.int(4);
          if (sub === 0) {
            const masterBal = await newToken.balanceOf(master.address);
            const cap = masterBal < 200_000_000n * E18 ? masterBal : 200_000_000n * E18;
            const amt = rnd.int(3) === 0 ? BigInt(1 + rnd.int(1000)) : rnd.big(cap);
            if (amt > 0n && amt <= masterBal) {
              await newToken.connect(master).transfer(m, amt);
              funded += amt;
              counts.fund++;
            }
          } else if (sub === 1) {
            const avail = (await newToken.balanceOf(m)) - totalOwed;
            const amount = [avail, avail + 1n, 0n][rnd.int(4)] ?? rnd.big(avail);
            const p = migration.connect(master).withdrawReserve(master.address, amount);
            if (amount === 0n) { await expectRevert(p, migration, "ZeroAmount"); counts.ownerRevert++; }
            else if (amount > avail) {
              await expect(p).to.be.revertedWithCustomError(migration, "InsufficientReserve").withArgs(avail, amount);
              counts.ownerRevert++;
            } else {
              await expect(p).to.emit(migration, "ReserveWithdrawn").withArgs(master.address, amount);
              totalWithdrawn += amount;
              counts.withdraw++;
            }
          } else if (sub === 2) {
            if (paused) { await migration.connect(master).unpauseMigrate(); paused = false; counts.pauseToggle++; }
            else if (rnd.int(2) === 0) { await migration.connect(master).pauseMigrate(); paused = true; counts.pauseToggle++; }
          } else {
            const who = callers[rnd.int(callers.length)];
            const p = rnd.int(2) === 0
              ? migration.connect(who).withdrawReserve(who.address, 1n)
              : migration.connect(who).pauseMigrate();
            await expect(p).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount");
            counts.ownerRevert++;
            if (paused) { await migration.connect(master).unpauseMigrate(); paused = false; counts.pauseToggle++; }
          }
        } else {
          // Time jump. Late in the run the jumps get big, pushing it across END,
          // so post window releases and withdrawals get exercised too.
          now += step < STEPS * 0.6 ? BigInt(1 + rnd.int(3)) * DAY : BigInt(20 + rnd.int(60)) * DAY;
          await time.setNextBlockTimestamp(now);
          await ethers.provider.send("evm_mine", []);
        }
        await checkInvariants();
      }

      // Drain: after the window and the last lock, the owner withdraws the whole reserve,
      // then a keeper releases every lot. Nothing may be missing or stranded.
      if (now < end + LOCK) { now = end + LOCK; await time.setNextBlockTimestamp(now); await ethers.provider.send("evm_mine", []); }
      now = BigInt(await time.latest()) + 1n;
      const avail = (await newToken.balanceOf(m)) - totalOwed;
      if (avail > 0n) { await migration.connect(master).withdrawReserve(master.address, avail); totalWithdrawn += avail; now++; }
      for (const u of users) {
        while (true) {
          const [amt, i] = releasable(u.address, 50);
          if (amt === 0n) break;
          await migration.connect(keeper).claimFor(u.address, 50);
          applyRelease(u.address, amt, i);
          now++;
        }
        expect(cursor.get(u.address)).to.equal(lots.get(u.address).length);
      }
      await checkInvariants();
      expect(await newToken.balanceOf(m)).to.equal(0n);
      expect(await newToken.balanceOf(keeper.address)).to.equal(0n);
      expect(await newToken.balanceOf(master.address)).to.equal(SUPPLY - totalMigrated);
      let usersHold = 0n;
      for (const u of users) usersHold += await newToken.balanceOf(u.address);
      expect(usersHold).to.equal(totalMigrated); // every credited old CT became exactly one new CT
      console.log(`      seed ${seed}: ${JSON.stringify(counts)}, migrated ${ethers.formatUnits(totalMigrated, 18)} CT`);
    });
  });
}
