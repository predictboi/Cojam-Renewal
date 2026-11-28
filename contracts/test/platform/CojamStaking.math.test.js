const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { CT, DAY, LOCK_DAYS, RATES, interestOf, deployStaking, txTime } = require("./stakingHelpers");

const fixture = () => deployStaking();

// Hand computed with decimal arithmetic: amount x rate x days / 365, cut to 18 decimals.
// Columns: 500 CT (tier 0), 5,000 CT (tier 1), 50,000 CT (tier 2).
const HAND = [
  // 30 days: 500 x 8% x 30/365, 5,000 x 9% x 30/365, 50,000 x 10% x 30/365
  ["3.287671232876712328", "36.986301369863013698", "410.958904109589041095"],
  // 90 days: 12%, 13%, 14%
  ["14.794520547945205479", "160.273972602739726027", "1726.027397260273972602"],
  // 180 days: 18%, 19%, 20%
  ["44.383561643835616438", "468.493150684931506849", "4931.506849315068493150"],
  // 365 days: 25%, 26%, 27%
  ["125", "1300", "13500"],
];
const AMOUNTS = [CT(500), CT(5_000), CT(50_000)];
const toWei = (s) => {
  const [w, f = ""] = s.split(".");
  return BigInt(w) * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18));
};

describe("CojamStaking: rate table and tiers", function () {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      it(`${LOCK_DAYS[i]} days, tier ${j}: ${RATES[i][j]} bps gives ${HAND[i][j]} CT`, async function () {
        const { staking, users } = await loadFixture(fixture);
        const [tier, apr, interest] = await staking.quote(AMOUNTS[j], i);
        expect(tier).to.equal(BigInt(j));
        expect(apr).to.equal(RATES[i][j]);
        expect(interest).to.equal(toWei(HAND[i][j]));
        const tx = await staking.connect(users[j]).stake(AMOUNTS[j], i);
        const start = await txTime(tx);
        await expect(tx).to.emit(staking, "Staked")
          .withArgs(users[j].address, 0n, AMOUNTS[j], LOCK_DAYS[i], RATES[i][j], start + LOCK_DAYS[i] * DAY, toWei(HAND[i][j]));
      });
    }
  }

  it("the plan's example: 1,000 CT for 90 days at 13% gives about 32.05 CT", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const [tier, apr, interest] = await staking.quote(CT(1_000), 1);
    expect(tier).to.equal(1n);
    expect(apr).to.equal(1300n);
    expect(interest).to.equal(32_054_794_520_547_945_205n); // 32.054794520547945205 CT
    await staking.connect(alice).stake(CT(1_000), 1);
    expect((await staking.positionOf(alice.address, 0)).maxInterest).to.equal(interest);
  });

  it("the tier boundaries: 999.99..., 1,000, 9,999.99..., 10,000", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const cases = [
      [CT(1_000) - 1n, 0n, 1200n],
      [CT(1_000), 1n, 1300n],
      [CT(10_000) - 1n, 1n, 1300n],
      [CT(10_000), 2n, 1400n],
      [CT(100), 0n, 1200n],
    ];
    for (let k = 0; k < cases.length; k++) {
      const [amount, tier, apr] = cases[k];
      expect(await staking.tierOf(amount)).to.equal(tier);
      await staking.connect(alice).stake(amount, 1);
      const p = await staking.positionOf(alice.address, k);
      expect(p.aprBps).to.equal(apr);
      expect(p.maxInterest).to.equal(interestOf(amount, apr, 90n * DAY));
    }
  });
});

describe("CojamStaking: per second accrual", function () {
  it("claimable follows the formula at many timestamps, stops exactly at the end", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const principal = CT(12_345) + 678_901_234_567_890_123n; // odd amount, tier 2
    const tx = await staking.connect(alice).stake(principal, 2);
    const start = await txTime(tx);
    const dur = 180n * DAY;
    const end = start + dur;
    const max = (await staking.positionOf(alice.address, 0)).maxInterest;
    expect(max).to.equal(interestOf(principal, 2000n, dur));
    const offsets = [1n, 2n, 3n, 59n, 61n, 3_599n, 3_600n, DAY - 1n, DAY, DAY + 1n, 7n * DAY + 13n, 45n * DAY,
      90n * DAY, 123n * DAY + 4_567n, dur - DAY, dur - 2n, dur - 1n, dur, dur + 1n, dur + 2n, dur + DAY, dur + 1000n * DAY];
    for (const o of offsets) {
      await time.increaseTo(start + o);
      const t = start + o;
      const until = t < end ? t : end;
      const expected = interestOf(principal, 2000n, until - start);
      expect(await staking.claimable(alice.address, 0), `offset ${o}`).to.equal(expected);
      if (o >= dur) expect(expected).to.equal(max);
      else expect(expected < max).to.equal(true);
    }
  });

  it("one second before the end, at the end and one second after", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const tx = await staking.connect(alice).stake(CT(1_000), 0);
    const start = await txTime(tx);
    const end = start + 30n * DAY;
    const perSecondFloor = interestOf(CT(1_000), 900n, 1n);
    expect(perSecondFloor > 0n).to.equal(true);
    await time.increaseTo(end - 1n);
    const before = await staking.claimable(alice.address, 0);
    await time.increaseTo(end);
    const at = await staking.claimable(alice.address, 0);
    await time.increaseTo(end + 1n);
    const after = await staking.claimable(alice.address, 0);
    expect(before).to.equal(interestOf(CT(1_000), 900n, 30n * DAY - 1n));
    expect(at > before).to.equal(true);
    expect(at).to.equal(interestOf(CT(1_000), 900n, 30n * DAY));
    expect(after).to.equal(at);
  });
});

describe("CojamStaking: no drift from repeated claims", function () {
  it("many small claims sum to exactly the formula from the start and never exceed maxInterest", async function () {
    const { staking, token, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setMinimums(CT(100), 0); // claim every time
    const principal = CT(777) + 333_333_333_333_333_333n; // small, odd: rounding loss each time if it drifted
    const tx = await staking.connect(alice).stake(principal, 3);
    const start = await txTime(tx);
    const dur = 365n * DAY;
    const max = interestOf(principal, 2500n, dur);
    let paid = 0n;
    let t = start;
    let seed = 7n;
    const rand = () => { seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n; return seed; };
    for (let k = 0; k < 80; k++) {
      t += 1n + (rand() % (5n * DAY)); // 1 second to 5 days
      if (t >= start + dur) break;
      await time.setNextBlockTimestamp(t);
      const r = await (await staking.connect(alice).claimInterest(0)).wait();
      const ev = r.logs.map((l) => staking.interface.parseLog(l)).find((e) => e && e.name === "InterestClaimed");
      paid += ev.args.amount;
      // The total paid so far equals earned(t), computed once from the start.
      expect(paid).to.equal(interestOf(principal, 2500n, t - start));
      expect(paid <= max).to.equal(true);
    }
    const bal = await token.balanceOf(alice.address);
    await time.increaseTo(start + dur + 99n);
    const r = await (await staking.connect(alice).withdraw(0)).wait();
    const ev = r.logs.map((l) => staking.interface.parseLog(l)).find((e) => e && e.name === "Withdrawn");
    expect(paid + ev.args.interest).to.equal(max);
    expect(await token.balanceOf(alice.address)).to.equal(bal + principal + ev.args.interest);
    expect(await staking.totalInterestPaid()).to.equal(max);
    expect(await staking.totalCommitted()).to.equal(0n);
  });

  it("claims every second never pay more than earned in total", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setMinimums(CT(100), 0);
    const principal = CT(100) + 1n; // about 2.5e11 wei a second at 8%, so every second pays
    const tx = await staking.connect(alice).stake(principal, 0);
    const start = await txTime(tx);
    let paid = 0n;
    for (let s = 1n; s <= 30n; s++) {
      await time.setNextBlockTimestamp(start + s);
      const r = await (await staking.connect(alice).claimInterest(0)).wait();
      paid += r.logs.map((l) => staking.interface.parseLog(l)).find((e) => e && e.name === "InterestClaimed").args.amount;
      expect(paid).to.equal(interestOf(principal, 800n, s));
    }
  });

  it("the minimum claim while locked and any amount after the lock", async function () {
    const { staking, alice } = await loadFixture(fixture);
    // 2,000 CT at 9% for 30 days: 14.79 CT in total, so one locked claim of 10 CT or more is possible.
    const tx = await staking.connect(alice).stake(CT(2_000), 0);
    const start = await txTime(tx);
    const tenAt = (CT(10) * 10_000n * 365n * DAY) / (CT(2_000) * 900n); // first second with >= 10 CT
    const at = (s) => interestOf(CT(2_000), 900n, s);
    let first = tenAt;
    while (at(first) < CT(10)) first += 1n;
    await time.setNextBlockTimestamp(start + first - 1n);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "BelowMinClaim").withArgs(at(first - 1n), CT(10));
    await time.setNextBlockTimestamp(start + first);
    await expect(staking.connect(alice).claimInterest(0)).to.emit(staking, "InterestClaimed").withArgs(alice.address, 0n, at(first));
    // The rest is under 10 CT: refused while locked, paid after.
    await time.setNextBlockTimestamp(start + 30n * DAY - 1n);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "BelowMinClaim");
    await time.setNextBlockTimestamp(start + 30n * DAY + 3n);
    await expect(staking.connect(alice).claimInterest(0))
      .to.emit(staking, "InterestClaimed").withArgs(alice.address, 0n, at(30n * DAY) - at(first));
  });
});
