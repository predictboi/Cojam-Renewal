const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { CT, DAY, YEAR, BPS, LOCK_DAYS, RATES, TIERS, deployStaking } = require("./stakingHelpers");

// Randomized sequences against a JavaScript model of the contract. After every step the
// solvency invariant (balance >= totalPrincipal + totalCommitted) and the model totals
// are checked; every success pays exactly what the model predicts and every revert is the
// error the model predicts. STAKING_FUZZ_RUNS x STAKING_FUZZ_STEPS (default 3 x 300).
const RUNS = Number(process.env.STAKING_FUZZ_RUNS || 3);
const STEPS = Number(process.env.STAKING_FUZZ_STEPS || 300);

function prng(seed) {
  let s = BigInt(seed) * 2654435761n + 1n;
  const next = () => { s = (s * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n; return s >> 11n; };
  return {
    big: (n) => next() % BigInt(n),
    int: (n) => Number(next() % BigInt(n)),
    pick: (arr) => arr[Number(next() % BigInt(arr.length))],
  };
}

const earned = (p, t) => {
  const until = t < p.end ? t : p.end;
  return (p.principal * p.apr * (until - p.start)) / (BPS * YEAR);
};

async function expectRevert(promise, staking, name) {
  await expect(promise).to.be.revertedWithCustomError(staking, name);
}

describe("CojamStaking: randomized sequences keep the solvency invariant", function () {
  this.timeout(600_000);

  for (let run = 0; run < RUNS; run++) {
    it(`run ${run + 1}: ${STEPS} random steps, then everyone withdraws`, async function () {
      const ctx = await deployStaking({ extraUsers: 3, rewards: CT(2_000) });
      const { staking, token, owner, treasury, pauser, users, addr } = ctx;
      const r = prng(1000 + run);
      const m = {
        pos: new Map(users.map((u) => [u.address, []])),
        P: 0n, C: 0n, paid: 0n,
        rates: RATES.map((row) => [...row]), tiers: [...TIERS],
        minStake: CT(100), minClaim: CT(10), maxOpen: 20, cap: 0n, paused: false,
      };
      const counts = {};
      const note = (k) => { counts[k] = (counts[k] || 0) + 1; };
      const tierOf = (a) => (a < m.tiers[0] ? 0 : a < m.tiers[1] ? 1 : 2);
      const openOf = (u) => m.pos.get(u).filter((p) => !p.closed).length;

      async function nextTime() {
        const latest = BigInt(await time.latest());
        const roll = r.int(100);
        const gap = roll < 60 ? 1n + r.big(3_600) : roll < 90 ? 1n + r.big(10n * DAY) : 1n + r.big(120n * DAY);
        const t = latest + gap;
        await time.setNextBlockTimestamp(t);
        return t;
      }
      // A refused transaction is not mined: mine the slot so the next step starts later.
      const settle = () => ethers.provider.send("evm_mine", []);

      async function check() {
        const bal = await token.balanceOf(addr);
        expect(await staking.totalPrincipal()).to.equal(m.P);
        expect(await staking.totalCommitted()).to.equal(m.C);
        expect(bal >= m.P + m.C, "solvency").to.equal(true);
        expect(await staking.availableRewards()).to.equal(bal - m.P - m.C);
        expect(await staking.totalInterestPaid()).to.equal(m.paid);
      }

      for (let step = 0; step < STEPS; step++) {
        if (m.paused && r.int(4) === 0) {
          await nextTime();
          await staking.connect(owner).unpause();
          m.paused = false;
          note("unpause");
        }
        const roll = r.int(100);
        const u = r.pick(users);
        const list = m.pos.get(u.address);

        if (roll < 34) {
          // stake
          const band = r.int(10);
          const amount = band === 0 ? r.big(CT(150)) : band < 5 ? CT(100) + r.big(CT(900)) : band < 8 ? CT(1_000) + r.big(CT(9_000)) : CT(10_000) + r.big(CT(60_000));
          const lock = r.int(25) === 0 ? 4 : r.int(4);
          const t = await nextTime();
          const bal = await token.balanceOf(addr);
          const avail = bal - m.P - m.C;
          let err = null;
          let interest = 0n, apr = 0n;
          if (m.paused) err = "EnforcedPause";
          else if (lock >= 4) err = "InvalidLock";
          else if (amount < m.minStake) err = "BelowMinStake";
          else if (openOf(u.address) >= m.maxOpen) err = "TooManyPositions";
          else if (m.cap !== 0n && m.P + amount > m.cap) err = "TotalCapReached";
          else {
            apr = BigInt(m.rates[lock][tierOf(amount)]);
            interest = (amount * apr * LOCK_DAYS[lock] * DAY) / (BPS * YEAR);
            if (avail < interest) err = "InsufficientRewards";
          }
          if (err) {
            await expectRevert(staking.connect(u).stake(amount, lock), staking, err);
            await settle();
            note(`stake:${err}`);
          } else {
            const id = BigInt(list.length);
            await expect(staking.connect(u).stake(amount, lock))
              .to.emit(staking, "Staked").withArgs(u.address, id, amount, LOCK_DAYS[lock], apr, t + LOCK_DAYS[lock] * DAY, interest);
            list.push({ principal: amount, max: interest, claimed: 0n, start: t, end: t + LOCK_DAYS[lock] * DAY, apr, closed: false });
            m.P += amount;
            m.C += interest;
            note("stake");
          }
        } else if (roll < 54) {
          // claimInterest
          if (list.length === 0) { note("claim:none"); continue; }
          const id = r.int(list.length);
          const p = list[id];
          const t = await nextTime();
          let err = null;
          let amount = 0n;
          if (p.closed) err = "PositionClosed";
          else {
            amount = earned(p, t) - p.claimed;
            if (amount === 0n) err = "NothingToClaim";
            else if (t < p.end && amount < m.minClaim) err = "BelowMinClaim";
          }
          if (err) {
            await expectRevert(staking.connect(u).claimInterest(id), staking, err);
            await settle();
            note(`claim:${err}`);
          } else {
            const before = await token.balanceOf(u.address);
            await expect(staking.connect(u).claimInterest(id)).to.emit(staking, "InterestClaimed").withArgs(u.address, id, amount);
            expect(await token.balanceOf(u.address)).to.equal(before + amount);
            p.claimed += amount;
            expect(p.claimed <= p.max).to.equal(true);
            m.C -= amount;
            m.paid += amount;
            note("claim");
          }
        } else if (roll < 68) {
          // withdraw
          if (list.length === 0) { note("withdraw:none"); continue; }
          const id = r.int(list.length);
          const p = list[id];
          const t = await nextTime();
          const err = p.closed ? "PositionClosed" : t < p.end ? "LockNotEnded" : null;
          if (err) {
            await expectRevert(staking.connect(u).withdraw(id), staking, err);
            await settle();
            note(`withdraw:${err}`);
          } else {
            const interest = p.max - p.claimed;
            expect(interest).to.equal(earned(p, t) - p.claimed); // no dust: earned(end) == max
            const before = await token.balanceOf(u.address);
            await expect(staking.connect(u).withdraw(id)).to.emit(staking, "Withdrawn").withArgs(u.address, id, p.principal, interest);
            expect(await token.balanceOf(u.address)).to.equal(before + p.principal + interest);
            p.closed = true;
            p.claimed = p.max;
            m.P -= p.principal;
            m.C -= interest;
            m.paid += interest;
            note("withdraw");
          }
        } else if (roll < 74) {
          // setRates (sometimes out of bounds)
          const rates = [0, 1, 2, 3].map(() => [0, 1, 2].map(() => r.int(5_001)));
          const bad = r.int(6) === 0;
          if (bad) rates[r.int(4)][r.int(3)] = 5_001 + r.int(1000);
          await nextTime();
          if (bad) { await expectRevert(staking.connect(owner).setRates(rates), staking, "RateOutOfBounds"); await settle(); note("rates:bad"); }
          else { await staking.connect(owner).setRates(rates); m.rates = rates; note("rates"); }
        } else if (roll < 77) {
          const lo = CT(1) + r.big(CT(5_000));
          const hi = lo + 1n + r.big(CT(50_000));
          await nextTime();
          await staking.connect(owner).setTiers([lo, hi]);
          m.tiers = [lo, hi];
          note("tiers");
        } else if (roll < 80) {
          const ms = CT(1) + r.big(CT(300));
          const mc = r.big(CT(30));
          await nextTime();
          await staking.connect(owner).setMinimums(ms, mc);
          m.minStake = ms; m.minClaim = mc;
          note("minimums");
        } else if (roll < 83) {
          const mo = 1 + r.int(20);
          const cap = r.int(3) !== 0 ? 0n : m.P + r.big(CT(200_000));
          await nextTime();
          await staking.connect(owner).setCaps(mo, cap);
          m.maxOpen = mo; m.cap = cap;
          note("caps");
        } else if (roll < 91) {
          // fund rewards by a plain transfer
          await nextTime();
          await token.connect(treasury).transfer(addr, r.big(CT(6_000)) + 1n);
          note("fund");
        } else if (roll < 97) {
          // withdraw rewards: within or beyond what is available
          const bal = await token.balanceOf(addr);
          const avail = bal - m.P - m.C;
          const over = r.int(3) === 0;
          const amount = over ? avail + 1n + r.big(CT(1_000)) : avail === 0n ? 0n : 1n + r.big(avail);
          await nextTime();
          if (amount === 0n) { await expectRevert(staking.connect(owner).withdrawRewards(0, treasury.address), staking, "ZeroAmount"); await settle(); note("rewards:zero"); }
          else if (over) { await expectRevert(staking.connect(owner).withdrawRewards(amount, treasury.address), staking, "InsufficientRewards"); await settle(); note("rewards:over"); }
          else { await staking.connect(owner).withdrawRewards(amount, treasury.address); note("rewards"); }
        } else {
          await nextTime();
          if (m.paused) { await staking.connect(owner).unpause(); m.paused = false; note("unpause"); }
          else { await staking.connect(pauser).pause(); m.paused = true; note("pause"); }
        }
        await check();
      }

      // Wind down: past every end, each open position withdraws principal plus the rest.
      await time.increase(366n * DAY);
      for (const u of users) {
        const list = m.pos.get(u.address);
        for (let id = 0; id < list.length; id++) {
          const p = list[id];
          if (p.closed) continue;
          const before = await token.balanceOf(u.address);
          await staking.connect(u).withdraw(id);
          expect(await token.balanceOf(u.address)).to.equal(before + p.principal + p.max - p.claimed);
          m.P -= p.principal; m.C -= p.max - p.claimed; m.paid += p.max - p.claimed;
          p.closed = true;
          await check();
        }
        expect(await staking.openPositions(u.address)).to.equal(0n);
      }
      expect(m.P).to.equal(0n);
      expect(m.C).to.equal(0n);
      // Everything left is reward CT, and the owner can take exactly that back.
      const left = await token.balanceOf(addr);
      expect(await staking.availableRewards()).to.equal(left);
      if (left > 0n) await staking.connect(owner).withdrawRewards(left, treasury.address);
      expect(await token.balanceOf(addr)).to.equal(0n);
      // Each position paid at most principal + maxInterest (exactly, here).
      const totalMax = [...m.pos.values()].flat().reduce((s, p) => s + p.max, 0n);
      expect(m.paid).to.equal(totalMax);
      if (process.env.STAKING_FUZZ_VERBOSE) console.log(counts);
      expect(counts.stake || 0).to.be.greaterThan(0);
    });
  }
});
