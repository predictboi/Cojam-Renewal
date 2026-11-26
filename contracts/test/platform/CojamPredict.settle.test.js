const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  H, RESOLVE_DEADLINE, DEFAULTS, dayOpen, weekEnd, marketsFor, deployPredict, at, goTo, play, resolveDay, passSettle, changeParams,
} = require("./predictHelpers");

const Z = ethers.ZeroAddress;
const fixture = () => deployPredict();
const R = ethers.encodeBytes32String("reason");

/** Fixture after alice, bob and dave (invited by alice) answered all of day0: alice A A A A A, bob B B B B B, dave A B A B A. */
async function played() {
  const ctx = await deployPredict();
  await goTo(dayOpen(ctx.day0));
  await play(ctx.predict, ctx.alice, ctx.day0, [1, 1, 1, 1, 1]);
  await play(ctx.predict, ctx.bob, ctx.day0, [2, 2, 2, 2, 2]);
  await play(ctx.predict, ctx.dave, ctx.day0, [1, 2, 1, 2, 1]);
  return ctx;
}

describe("CojamPredict: outcomes", function () {
  it("setOutcome stores the outcome, resolvedAt and the settle time snapshot", async function () {
    const { predict, op, day0 } = await loadFixture(played);
    const id = day0 * 5n;
    const m0 = await predict.markets(id);
    await goTo(m0.resolvesAt - 1n);
    await at(m0.resolvesAt);
    await expect(op.setOutcome(id, 1)).to.emit(predict, "OutcomeSet").withArgs(id, 1, false);
    const m = await predict.markets(id);
    expect(m.outcome).to.equal(1n);
    expect(m.resolvedAt).to.equal(m0.resolvesAt);
    expect(m.settlesAt).to.equal(m0.resolvesAt + DEFAULTS.settleDelay);
    expect(m.correctedOutcome).to.equal(0n);
  });

  it("setOutcome refusals: role, unknown market, bad outcome, before resolvesAt, at the deadline, twice", async function () {
    const { predict, op, stranger, day0 } = await loadFixture(played);
    const id = day0 * 5n + 4n;
    const m = await predict.markets(id);
    await expect(predict.connect(stranger).setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.setOutcome(day0 * 5n + 100n, 1)).to.be.revertedWithCustomError(predict, "UnknownMarket");
    await expect(op.setOutcome(id, 0)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(op.setOutcome(id, 4)).to.be.revertedWithCustomError(predict, "BadChoice");
    await goTo(m.resolvesAt - 2n);
    await at(m.resolvesAt - 1n);
    await expect(op.setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "NotResolvable");
    const deadline = dayOpen(day0 + 1n) + RESOLVE_DEADLINE;
    await goTo(deadline - 2n);
    await at(deadline - 1n);
    await op.setOutcome(id, 3); // the last second; 3 = void through setOutcome
    await expect(op.setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    await at(deadline);
    await expect(op.setOutcome(id - 1n, 1)).to.be.revertedWithCustomError(predict, "ResolveDeadlinePassed");
  });

  it("correctOutcome changes the outcome inside the window only", async function () {
    const { predict, op, stranger, day0 } = await loadFixture(played);
    const id = day0 * 5n;
    await expect(op.correctOutcome(id, 1)).to.be.revertedWithCustomError(predict, "NotResolvable");
    await resolveDay({ predict, op }, day0, [1, 0, 0, 0, 0]);
    await expect(predict.connect(stranger).correctOutcome(id, 2)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.correctOutcome(id, 0)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(op.correctOutcome(id, 1)).to.be.revertedWithCustomError(predict, "SameOutcome");
    await expect(op.correctOutcome(id, 2)).to.emit(predict, "OutcomeSet").withArgs(id, 2, true);
    await expect(op.correctOutcome(id, 3)).to.emit(predict, "OutcomeSet").withArgs(id, 3, true);
    await op.correctOutcome(id, 1);
    const m = await predict.markets(id);
    await goTo(m.settlesAt - 2n);
    await at(m.settlesAt - 1n);
    await op.correctOutcome(id, 2);
    await at(m.settlesAt);
    await expect(op.correctOutcome(id, 1)).to.be.revertedWithCustomError(predict, "CorrectionWindowOver");
    expect((await predict.markets(id)).outcome).to.equal(2n);
    expect((await predict.markets(id)).settlesAt).to.equal(m.settlesAt); // a correction keeps the settle time
  });

  it("voidMarket: before resolution or inside the window; final at once", async function () {
    const { predict, op, stranger, day0 } = await loadFixture(played);
    const a = day0 * 5n, b = a + 1n;
    await expect(predict.connect(stranger).voidMarket(a, R)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.voidMarket(a + 100n, R)).to.be.revertedWithCustomError(predict, "UnknownMarket");
    await expect(op.voidMarket(a, R)).to.emit(predict, "MarketVoided").withArgs(a, R);
    let m = await predict.markets(a);
    const now = BigInt(await time.latest());
    expect([m.outcome, m.resolvedAt, m.settlesAt]).to.deep.equal([3n, now, now]);
    await expect(op.voidMarket(a, R)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    await expect(op.setOutcome(a, 1)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    await expect(op.correctOutcome(a, 1)).to.be.revertedWithCustomError(predict, "CorrectionWindowOver");
    // b resolved, voided inside the window: resolvedAt keeps the first resolution
    await resolveDay({ predict, op }, day0, [0, 1, 0, 0, 0]);
    const first = (await predict.markets(b)).resolvedAt;
    await op.voidMarket(b, R);
    m = await predict.markets(b);
    expect(m.resolvedAt).to.equal(first);
    expect(m.outcome).to.equal(3n);
    // c resolved and its window over: no void
    await op.setOutcome(a + 2n, 1);
    await time.increase(DEFAULTS.settleDelay);
    await expect(op.voidMarket(a + 2n, R)).to.be.revertedWithCustomError(predict, "CorrectionWindowOver");
  });

  it("voidExpired: anyone, from the day's end plus 48 hours, only when nothing was set", async function () {
    const { predict, op, stranger, day0 } = await loadFixture(played);
    const id = day0 * 5n + 3n;
    const deadline = dayOpen(day0 + 1n) + RESOLVE_DEADLINE;
    await expect(predict.connect(stranger).voidExpired(day0 * 5n + 100n)).to.be.revertedWithCustomError(predict, "UnknownMarket");
    await goTo(deadline - 3n);
    await op.setOutcome(id + 1n, 2);
    await at(deadline - 1n);
    await expect(predict.connect(stranger).voidExpired(id)).to.be.revertedWithCustomError(predict, "NotExpired");
    await at(deadline);
    await expect(predict.connect(stranger).voidExpired(id)).to.emit(predict, "MarketVoided").withArgs(id, await predict.EXPIRED_REASON());
    await expect(predict.connect(stranger).voidExpired(id)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    await expect(predict.connect(stranger).voidExpired(id + 1n)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    expect((await predict.markets(id)).outcome).to.equal(3n);
  });

  it("setCorrectedOutcome: owner only, after the window, once, a different A or B", async function () {
    const { predict, op, master, day0 } = await loadFixture(played);
    const id = day0 * 5n;
    const own = predict.connect(master);
    await expect(own.setCorrectedOutcome(id, 2)).to.be.revertedWithCustomError(predict, "TooEarly"); // unresolved
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await expect(op.setCorrectedOutcome(id, 2)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(own.setCorrectedOutcome(id, 2)).to.be.revertedWithCustomError(predict, "TooEarly"); // inside the window
    await passSettle({ predict }, day0);
    await expect(own.setCorrectedOutcome(id, 0)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(own.setCorrectedOutcome(id, 3)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(own.setCorrectedOutcome(id, 1)).to.be.revertedWithCustomError(predict, "SameOutcome");
    await expect(own.setCorrectedOutcome(id, 2)).to.emit(predict, "CorrectedOutcomeSet").withArgs(id, 2);
    await expect(own.setCorrectedOutcome(id, 2)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    expect((await predict.markets(id)).correctedOutcome).to.equal(2n);
    expect((await predict.markets(id)).outcome).to.equal(1n);
    await expect(own.setCorrectedOutcome(id + 100n, 2)).to.be.revertedWithCustomError(predict, "UnknownMarket");
  });
});

describe("CojamPredict: settle", function () {
  it("credits hits per market as each one's settle time passes (lazy, anyone may call)", async function () {
    const { predict, op, alice, stranger, day0, week } = await loadFixture(played);
    // slots 0 and 1 resolve first; the rest later
    await resolveDay({ predict, op }, day0, [1, 2, 0, 0, 0]);
    await expect(predict.settle(alice.address, day0)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
    let [pts, landsAt] = await predict.pendingHits(alice.address, day0);
    expect(pts).to.equal(50n);
    expect(landsAt).to.equal((await predict.markets(day0 * 5n + 1n)).settlesAt);
    await passSettle({ predict }, day0);
    const tx = predict.connect(stranger).settle(alice.address, day0);
    await expect(tx).to.emit(predict, "Settled").withArgs(alice.address, day0, 3, 1, 50)
      .and.to.emit(predict, "PointsCredited").withArgs(alice.address, week, day0, 2, 50);
    expect(await predict.balanceOf(alice.address)).to.equal(160n); // 100 completion, 50 hit, 10 from dave's completion
    [pts, landsAt] = await predict.pendingHits(alice.address, day0);
    expect([pts, landsAt]).to.deep.equal([0n, 0n]);
    await expect(predict.settle(alice.address, day0)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
    // the remaining three
    await op.setOutcome(day0 * 5n + 2n, 1);
    await op.setOutcome(day0 * 5n + 3n, 3);
    await op.setOutcome(day0 * 5n + 4n, 2);
    await passSettle({ predict }, day0);
    await expect(predict.settle(alice.address, day0)).to.emit(predict, "Settled").withArgs(alice.address, day0, 28, 1, 50);
    const d = await predict.dayOf(alice.address, day0);
    expect(d.settledMask).to.equal(31n);
    expect(d.hits).to.equal(2n);
    await expect(predict.settle(alice.address, day0)).to.be.revertedWithCustomError(predict, "AlreadySettled");
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(200n);
  });

  it("settle with no hits marks the slots and credits nothing; a user with no answers is not ready", async function () {
    const { predict, op, bob, carol, day0 } = await loadFixture(played);
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, day0);
    await expect(predict.settle(bob.address, day0)).to.emit(predict, "Settled").withArgs(bob.address, day0, 31, 0, 0)
      .and.not.to.emit(predict, "PointsCredited");
    await expect(predict.settle(carol.address, day0)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
  });

  it("only answered slots are settled; unanswered resolved slots are left alone", async function () {
    const { predict, op, carol, day0 } = await loadFixture(played);
    await play(predict, carol, day0, [1, 0, 1, 0, 0]);
    await resolveDay({ predict, op }, day0, [1, 1, 2, 1, 1]);
    await passSettle({ predict }, day0);
    await expect(predict.settle(carol.address, day0)).to.emit(predict, "Settled").withArgs(carol.address, day0, 5, 1, 50);
    expect((await predict.dayOf(carol.address, day0)).settledMask).to.equal(5n);
  });

  it("void markets settle with no hit", async function () {
    const { predict, op, alice, day0 } = await loadFixture(played);
    await resolveDay({ predict, op }, day0, [3, 3, 3, 3, 1]);
    await passSettle({ predict }, day0);
    await expect(predict.settle(alice.address, day0)).to.emit(predict, "Settled").withArgs(alice.address, day0, 31, 1, 50);
  });

  it("settleMany skips users with nothing ready, caps at 200 and reverts when nobody settled", async function () {
    const { predict, op, alice, bob, carol, dave, day0 } = await loadFixture(played);
    await expect(predict.settleMany([alice.address], day0)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, day0);
    const users = [alice.address, carol.address, bob.address, dave.address, alice.address];
    expect(await predict.settleMany.staticCall(users, day0)).to.equal(3n);
    await predict.settleMany(users, day0);
    expect(await predict.balanceOf(alice.address)).to.equal(350n + 10n + 15n); // own, plus 10% of dave's 100 and 150
    expect(await predict.balanceOf(dave.address)).to.equal(100n + 150n + 100n); // completion, 3 hits, welcome
    await expect(predict.settleMany(users, day0)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
    await expect(predict.settleMany(Array(201).fill(alice.address), day0)).to.be.revertedWithCustomError(predict, "BatchTooLarge");
  });

  it("hit points count in the week of the market's day, even when settled in the next week", async function () {
    const { predict, op, alice, day0, week } = await loadFixture(fixture);
    const sunday = day0 + 6n;
    await goTo(dayOpen(sunday));
    await play(predict, alice, sunday, [1, 1, 1, 1, 1]);
    await resolveDay({ predict, op }, sunday, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, sunday);
    expect(await predict.weekOf(await predict.currentDay())).to.equal(week + 1n);
    await expect(predict.settle(alice.address, sunday)).to.emit(predict, "PointsCredited").withArgs(alice.address, week, sunday, 2, 250);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(350n);
    expect((await predict.weekPoints(week + 1n, alice.address)).points).to.equal(0n);
  });

  it("a change of settleDelay does not move the settle time of a market already resolved", async function () {
    const ctx = await loadFixture(played);
    const { predict, op, alice, day0 } = ctx;
    await resolveDay(ctx, day0, [1, 0, 0, 0, 0]);
    const before = (await predict.markets(day0 * 5n)).settlesAt;
    await changeParams(ctx, { settleDelay: 48n * H, airdropDelay: 96n * H });
    expect((await predict.markets(day0 * 5n)).settlesAt).to.equal(before);
    // settle time long past: settles now
    await expect(predict.settle(alice.address, day0)).to.emit(predict, "Settled");
    // a market resolved now gets the new delay
    const d = (await predict.currentDay()) - 1n;
    await goTo((await predict.markets(d * 5n)).resolvesAt);
    expect(await time.latest()).to.be.lessThan(Number(dayOpen(d + 1n) + RESOLVE_DEADLINE));
    await op.setOutcome(d * 5n, 2);
    const m = await predict.markets(d * 5n);
    expect(m.settlesAt - m.resolvedAt).to.equal(48n * H);
  });

  it("a frozen player's hits are still credited; nothing is ever debited", async function () {
    const { predict, op, alice, day0 } = await loadFixture(played);
    await op.setFrozen(alice.address, true, R);
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, day0);
    await predict.settle(alice.address, day0);
    expect(await predict.balanceOf(alice.address)).to.equal(360n); // 350 plus 10 from dave's completion
  });

  it("settle keeps working while paused", async function () {
    const { predict, op, alice, day0 } = await loadFixture(played);
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, day0);
    await op.pause();
    await predict.settle(alice.address, day0);
    expect(await predict.balanceOf(alice.address)).to.equal(360n); // 350 plus 10 from dave's completion
  });
});

describe("CojamPredict: corrected outcome and compensation", function () {
  async function corrected() {
    const ctx = await played();
    const { predict, op, master, day0 } = ctx;
    await resolveDay(ctx, day0, [1, 1, 1, 1, 1]); // slot 1 is wrong: the true answer is B
    await passSettle(ctx, day0);
    await predict.settleMany([ctx.alice.address, ctx.bob.address, ctx.dave.address], day0);
    await predict.connect(master).setCorrectedOutcome(day0 * 5n + 1n, 2);
    return ctx;
  }

  it("pays hitPoints once to settled users whose choice equals the corrected outcome; never takes back", async function () {
    const { predict, op, alice, bob, carol, dave, day0, week } = await loadFixture(corrected);
    const id = day0 * 5n + 1n;
    const aliceBefore = await predict.balanceOf(alice.address);
    const users = [alice.address, bob.address, carol.address, dave.address, bob.address];
    expect(await op.compensate.staticCall(id, users)).to.equal(2n);
    const tx = op.compensate(id, users);
    await expect(tx).to.emit(predict, "Compensated").withArgs(id, bob.address, 50)
      .and.to.emit(predict, "Compensated").withArgs(id, dave.address, 50)
      .and.to.emit(predict, "PointsCredited").withArgs(bob.address, week, day0, 3, 50)
      .and.to.emit(predict, "ReferralPaid").withArgs(alice.address, dave.address, 3, 5);
    expect(await predict.compensated(id, bob.address)).to.equal(true);
    expect(await predict.compensated(id, alice.address)).to.equal(false);
    expect(await predict.balanceOf(alice.address)).to.equal(aliceBefore + 5n); // her wrong hit stays; plus dave's bonus
    expect(await predict.balanceOf(bob.address)).to.equal(150n);
    await expect(op.compensate(id, [bob.address, dave.address])).to.be.revertedWithCustomError(predict, "NothingToCompensate");
  });

  it("refusals: role, unknown market, no corrected outcome, nobody eligible, batch cap", async function () {
    const { predict, op, stranger, alice, bob, day0 } = await loadFixture(corrected);
    const id = day0 * 5n + 1n;
    await expect(predict.connect(stranger).compensate(id, [bob.address])).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.compensate(id + 100n, [bob.address])).to.be.revertedWithCustomError(predict, "UnknownMarket");
    await expect(op.compensate(id + 1n, [bob.address])).to.be.revertedWithCustomError(predict, "NothingToCompensate");
    await expect(op.compensate(id, [alice.address])).to.be.revertedWithCustomError(predict, "NothingToCompensate");
    await expect(op.compensate(id, Array(501).fill(bob.address))).to.be.revertedWithCustomError(predict, "BatchTooLarge");
    await op.compensate(id, Array(500).fill(bob.address));
  });

  it("compensation counts in the question's week before its airdrop, in the current week after it", async function () {
    const { predict, op, alice, bob, dave, day0, week } = await loadFixture(corrected);
    const id = day0 * 5n + 1n;
    await expect(op.compensate(id, [bob.address])).to.emit(predict, "PointsCredited").withArgs(bob.address, week, day0, 3, 50);
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    await op.airdrop(week, [alice.address], 0n);
    const now = await predict.weekOf(await predict.currentDay());
    expect(now).to.equal(week + 1n);
    await expect(op.compensate(id, [dave.address])).to.emit(predict, "PointsCredited").withArgs(dave.address, week + 1n, day0, 3, 50);
    expect((await predict.weekPoints(week + 1n, dave.address)).points).to.equal(50n);
  });

  it("a user not yet settled on the market is skipped until settled", async function () {
    const ctx = await played();
    const { predict, op, master, carol, day0 } = ctx;
    // carol answers only after the others; she is not settled yet
    await play(predict, carol, day0, [2, 2, 0, 0, 0]);
    await resolveDay(ctx, day0, [1, 1, 1, 1, 1]);
    await passSettle(ctx, day0);
    await predict.connect(master).setCorrectedOutcome(day0 * 5n + 1n, 2);
    await expect(op.compensate(day0 * 5n + 1n, [carol.address])).to.be.revertedWithCustomError(predict, "NothingToCompensate");
    await predict.settle(carol.address, day0);
    await expect(op.compensate(day0 * 5n + 1n, [carol.address])).to.emit(predict, "Compensated").withArgs(day0 * 5n + 1n, carol.address, 50);
  });

  it("a voided market corrected to A compensates those who picked A", async function () {
    const ctx = await played();
    const { predict, op, master, alice, bob, day0 } = ctx;
    await op.voidMarket(day0 * 5n, R);
    await predict.settle(alice.address, day0);
    await predict.settle(bob.address, day0);
    await predict.connect(master).setCorrectedOutcome(day0 * 5n, 1);
    expect(await op.compensate.staticCall(day0 * 5n, [alice.address, bob.address])).to.equal(1n);
  });
});

describe("CojamPredict: friend invites and the welcome bonus", function () {
  it("the inviter earns 10% of completion and of each settle call, outside weekPoints; the friend gets the welcome once", async function () {
    const { predict, op, alice, dave, day0, week } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await play(predict, dave, day0, [1, 1, 1, 1, 0]);
    const tx = predict.connect(dave).predict(day0 * 5n + 4n, 1);
    await expect(tx).to.emit(predict, "PointsCredited").withArgs(dave.address, week, day0, 1, 100)
      .and.to.emit(predict, "ReferralPaid").withArgs(alice.address, dave.address, 1, 10)
      .and.to.emit(predict, "WelcomePaid").withArgs(dave.address, alice.address, day0, 100);
    expect(await predict.balanceOf(dave.address)).to.equal(200n);
    expect(await predict.balanceOf(alice.address)).to.equal(10n);
    expect((await predict.weekPoints(week, dave.address)).points).to.equal(100n);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(0n);
    expect(await predict.referralPointsOf(alice.address)).to.equal(10n);
    // the second day: no welcome again
    await goTo(dayOpen(day0 + 1n));
    await play(predict, dave, day0 + 1n, [2, 2, 2, 2, 2]);
    expect(await predict.balanceOf(dave.address)).to.equal(300n);
    expect(await predict.balanceOf(alice.address)).to.equal(20n);
    // hits: 3 of 5 on day0 = 150, bonus 15
    await resolveDay({ predict, op }, day0, [1, 1, 1, 2, 2]);
    await passSettle({ predict }, day0);
    await expect(predict.settle(dave.address, day0)).to.emit(predict, "ReferralPaid").withArgs(alice.address, dave.address, 2, 15);
    expect(await predict.referralPointsOf(alice.address)).to.equal(35n);
    expect((await predict.referralStats(alice.address)).count).to.equal(1n);
  });

  it("rounds the bonus down: 50 at 3.33% gives 1, 150 at 3.33% gives 4, 20 at 1% gives nothing", async function () {
    const ctx = await loadFixture(fixture);
    const { predict, op, alice, dave, day0 } = ctx;
    await changeParams(ctx, { referralBps: 333n });
    const d = day0 + 2n;
    await goTo(dayOpen(d));
    await play(predict, dave, d, [1, 1, 1, 1, 1]); // completion 100 -> 3
    expect(await predict.referralPointsOf(alice.address)).to.equal(3n);
    await resolveDay(ctx, d, [1, 2, 2, 2, 2]);
    await passSettle(ctx, d);
    await predict.settle(dave.address, d); // 50 -> 1 (1.665)
    expect(await predict.referralPointsOf(alice.address)).to.equal(4n);
    await goTo(dayOpen(d + 1n));
    await play(predict, dave, d + 1n, [1, 1, 1, 1, 1]);
    await resolveDay(ctx, d + 1n, [1, 1, 1, 2, 2]);
    await passSettle(ctx, d + 1n);
    await predict.settle(dave.address, d + 1n); // 150 -> 4 (4.995)
    expect(await predict.referralPointsOf(alice.address)).to.equal(4n + 3n + 4n);
    // 1% of 50 is 0.5: no bonus, no event
    await changeParams(ctx, { referralBps: 100n });
    const e = (await predict.currentDay()) + 1n;
    await op.createDay(e, marketsFor(e));
    await goTo(dayOpen(e));
    await play(predict, dave, e, [1, 2, 2, 2, 2]);
    await resolveDay(ctx, e, [1, 1, 1, 1, 1]);
    await passSettle(ctx, e);
    await expect(predict.settle(dave.address, e)).to.not.emit(predict, "ReferralPaid");
    expect(await predict.balanceOf(alice.address)).to.equal(await predict.referralPointsOf(alice.address));
  });

  it("a frozen friend pays no bonus; a frozen inviter receives none and is owed nothing later", async function () {
    const { predict, op, alice, dave, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await op.setFrozen(alice.address, true, R);
    await expect(predict.connect(dave).predict(day0 * 5n, 1)).to.not.emit(predict, "ReferralSkipped");
    await play(predict, dave, day0, [0, 1, 1, 1, 0]);
    await expect(predict.connect(dave).predict(day0 * 5n + 4n, 1)).to.emit(predict, "ReferralSkipped").withArgs(alice.address, dave.address, 1, 10)
      .and.not.to.emit(predict, "ReferralPaid").and.not.to.emit(predict, "WelcomePaid");
    expect(await predict.balanceOf(alice.address)).to.equal(0n);
    expect(await predict.balanceOf(dave.address)).to.equal(100n); // no welcome either: the inviter was frozen
    await op.setFrozen(alice.address, false, R);
    // the welcome is never paid later
    await goTo(dayOpen(day0 + 1n));
    await play(predict, dave, day0 + 1n, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(dave.address)).to.equal(200n);
    expect(await predict.balanceOf(alice.address)).to.equal(10n);
    // frozen friend: hits still credited, no bonus
    await resolveDay({ predict, op }, day0, [1, 1, 1, 1, 1]);
    await passSettle({ predict }, day0);
    await op.setFrozen(dave.address, true, R);
    await expect(predict.settle(dave.address, day0)).to.not.emit(predict, "ReferralPaid");
    expect(await predict.balanceOf(dave.address)).to.equal(450n);
    expect(await predict.balanceOf(alice.address)).to.equal(10n);
    // bonus already minted is kept when the inviter goes on hold
    await op.setFrozen(alice.address, true, R);
    expect(await predict.balanceOf(alice.address)).to.equal(10n);
    expect(await predict.referralPointsOf(alice.address)).to.equal(10n);
  });

  it("no welcome without an inviter, or with welcomePoints 0; the welcome earns the inviter nothing", async function () {
    const ctx = await loadFixture(fixture);
    const { predict, op, alice, bob, dave, eve, day0 } = ctx;
    await goTo(dayOpen(day0));
    await play(predict, bob, day0, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(bob.address)).to.equal(100n);
    await changeParams(ctx, { welcomePoints: 0n });
    await op.registerPlayer(eve.address, alice.address);
    const d = (await predict.currentDay()) + 1n;
    await goTo(dayOpen(d));
    await play(predict, eve, d, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(eve.address)).to.equal(100n);
    expect(await predict.balanceOf(alice.address)).to.equal(10n);
    expect((await predict.players(eve.address)).completedOnce).to.equal(true);
    await play(predict, dave, d, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(dave.address)).to.equal(100n); // first completed day, welcome now 0
  });

  it("a late code before the first full day pays the welcome at that day; with a frozen inviter at the link it is never paid", async function () {
    const { predict, op, alice, bob, carol, eve, day0 } = await loadFixture(fixture);
    await op.setReferrer(bob.address, alice.address); // late code, nothing played yet: no welcome yet
    expect(await predict.balanceOf(bob.address)).to.equal(0n);
    await goTo(dayOpen(day0));
    await play(predict, bob, day0, [1, 1, 1, 1, 0]);
    await expect(predict.connect(bob).predict(day0 * 5n + 4n, 1)).to.emit(predict, "WelcomePaid").withArgs(bob.address, alice.address, day0, 100);
    // carol completes, then her inviter goes on hold: a frozen inviter cannot be linked at all
    await play(predict, carol, day0, [1, 1, 1, 1, 1]);
    await op.setFrozen(alice.address, true, R);
    await expect(op.setReferrer(carol.address, alice.address)).to.be.revertedWithCustomError(predict, "BadReferrer");
    // eve registers invited by alice while alice is active, alice is frozen at eve's first full day: no welcome, ever
    await op.setFrozen(alice.address, false, R);
    await op.registerPlayer(eve.address, alice.address);
    await op.setFrozen(alice.address, true, R);
    await play(predict, eve, day0, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(eve.address)).to.equal(100n);
    await op.setFrozen(alice.address, false, R);
    await goTo(dayOpen(day0 + 1n));
    await play(predict, eve, day0 + 1n, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(eve.address)).to.equal(200n);
  });

  it("referralBps 0 pays no bonus", async function () {
    const ctx = await loadFixture(fixture);
    const { predict, alice, dave } = ctx;
    await changeParams(ctx, { referralBps: 0n });
    const d = (await predict.currentDay()) + 1n;
    await goTo(dayOpen(d));
    await play(predict, dave, d, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(alice.address)).to.equal(0n);
    expect(await predict.balanceOf(dave.address)).to.equal(200n);
  });

  it("only the direct inviter earns (one level)", async function () {
    const { predict, op, alice, dave, eve, day0 } = await loadFixture(fixture);
    await op.registerPlayer(eve.address, dave.address); // alice -> dave -> eve
    await goTo(dayOpen(day0));
    await play(predict, eve, day0, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(dave.address)).to.equal(10n);
    expect(await predict.balanceOf(alice.address)).to.equal(0n);
  });
});
