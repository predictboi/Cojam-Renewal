// Longer questions mixed into a day (DECISIONS "Longer questions mixed in"): each market carries its own
// answer deadline (resolvesAt + RESOLVE_DEADLINE), resolvesAt may lie up to maxResolveAfterClose (30 days
// by default) after the close, and a hit credited after its week's airdrop counts in the current week.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  H, DAY, RESOLVE_DEADLINE, DEFAULTS, dayOpen, weekOf, weekEnd, marketsFor, deployPredict, at, goTo, play, passSettle,
  changeParams,
} = require("./predictHelpers");

const Z = ethers.ZeroAddress;
const R = ethers.encodeBytes32String("known early");

/** Markets of `dayId`: slots 0 to 2 short (1, 2 and 3 hours after the close), slots 3 and 4 at `long3` and `long4` after it. */
function mixedDay(dayId, long3 = 2n * DAY, long4 = 30n * DAY) {
  const m = marketsFor(dayId);
  const close = dayOpen(dayId) + DAY;
  [H, 2n * H, 3n * H, long3, long4].forEach((after, i) => { m[i].resolvesAt = close + after; });
  return m;
}

/** The fixture with only Monday to Saturday created; the Sunday of the first week holds 3 short and 2 long markets. */
async function mixed() {
  const ctx = await deployPredict({ days: 6 });
  const sunday = ctx.day0 + 6n;
  await ctx.op.createDay(sunday, mixedDay(sunday));
  return { ...ctx, sunday };
}

/** Sets the outcome of `id` at its own resolvesAt (or now when that is past). */
async function resolveAt(ctx, id, outcome) {
  await goTo((await ctx.predict.markets(id)).resolvesAt);
  await ctx.op.setOutcome(id, outcome);
}

describe("CojamPredict: longer questions mixed in", function () {
  it("accepts a market answered 30 days after the close and refuses one second more; the bound follows the parameter", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, day0 } = ctx;
    const d = day0 + 10n;
    const close = dayOpen(d) + DAY;
    expect((await predict.params()).maxResolveAfterClose).to.equal(30n * DAY);

    await expect(op.createDay(d, mixedDay(d, 2n * DAY, 30n * DAY + 1n))).to.be.revertedWithCustomError(predict, "BadTimes");
    await expect(op.createDay(d, mixedDay(d, 30n * DAY + 1n, 3n * DAY))).to.be.revertedWithCustomError(predict, "BadTimes");
    await expect(op.createDay(d, mixedDay(d, 2n * DAY, 30n * DAY))).to.emit(predict, "DayCreated");
    expect((await predict.markets(d * 5n + 4n)).resolvesAt).to.equal(close + 30n * DAY);

    // raised to 90 days through propose and apply: 60 days is accepted on a later day
    await changeParams(ctx, { maxResolveAfterClose: 90n * DAY });
    const d2 = day0 + 20n;
    await expect(op.createDay(d2, mixedDay(d2, 60n * DAY, 90n * DAY + 1n))).to.be.revertedWithCustomError(predict, "BadTimes");
    await op.createDay(d2, mixedDay(d2, 60n * DAY, 90n * DAY));
    // lowered to 1 day: only next day answers remain possible
    await changeParams(ctx, { maxResolveAfterClose: DAY });
    const d3 = day0 + 21n;
    await expect(op.createDay(d3, mixedDay(d3, DAY + 1n, DAY))).to.be.revertedWithCustomError(predict, "BadTimes");
    await op.createDay(d3, mixedDay(d3, DAY, DAY));
  });

  it("a long market can be answered weeks after the close and is not voidable before its own deadline", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, stranger, sunday } = ctx;
    const id = sunday * 5n + 4n; // resolves 30 days after the close
    const m = await predict.markets(id);
    const dayEnd = dayOpen(sunday) + DAY;
    // the old rule (day end plus 48 hours) no longer applies
    await goTo(dayEnd + RESOLVE_DEADLINE + 1n);
    await expect(predict.connect(stranger).voidExpired(id)).to.be.revertedWithCustomError(predict, "NotExpired");
    await expect(op.setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "NotResolvable");
    const deadline = m.resolvesAt + RESOLVE_DEADLINE;
    await goTo(deadline - 2n);
    await at(deadline - 1n);
    await expect(predict.connect(stranger).voidExpired(id)).to.be.revertedWithCustomError(predict, "NotExpired");
    await at(deadline);
    await expect(op.setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "ResolveDeadlinePassed");
    await expect(predict.connect(stranger).voidExpired(id)).to.emit(predict, "MarketVoided").withArgs(id, await predict.EXPIRED_REASON());
    expect((await predict.markets(id)).outcome).to.equal(3n);
  });

  it("a long market is resolvable from its resolvesAt until the last second of its own deadline", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, sunday } = ctx;
    const id = sunday * 5n + 3n; // 2 days after the close
    const m = await predict.markets(id);
    await goTo(m.resolvesAt + RESOLVE_DEADLINE - 2n);
    await at(m.resolvesAt + RESOLVE_DEADLINE - 1n);
    await expect(op.setOutcome(id, 2)).to.emit(predict, "OutcomeSet").withArgs(id, 2, false);
  });

  it("a day of 3 short and 2 long markets: completion at once, hits per market as each settles, late hits after the airdrop in the current week", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, alice, bob, sunday, week } = ctx;
    const base = sunday * 5n;
    await goTo(dayOpen(sunday));
    await play(predict, alice, sunday, [1, 1, 2, 1, 2]);
    // completion does not wait for the long questions
    await expect(predict.connect(bob).predict(base, 2)).to.not.emit(predict, "PointsCredited");
    await play(predict, bob, sunday, [0, 2, 2, 2, 2]);
    expect((await predict.dayOf(alice.address, sunday)).completed).to.equal(true);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(100n);

    // the three short ones: outcomes A, A, A; alice hits slots 0 and 1
    for (let i = 0n; i < 3n; i++) await resolveAt(ctx, base + i, 1);
    let [pts, landsAt] = await predict.pendingHits(alice.address, sunday);
    expect(pts).to.equal(100n);
    expect(landsAt).to.equal((await predict.markets(base + 2n)).settlesAt);
    await goTo(landsAt);
    expect(await predict.weekOf(await predict.currentDay())).to.equal(week + 1n); // settled in the next week
    await expect(predict.settle(alice.address, sunday)).to.emit(predict, "Settled").withArgs(alice.address, sunday, 7, 2, 100)
      .and.to.emit(predict, "PointsCredited").withArgs(alice.address, week, sunday, 2, 100);
    await expect(predict.settle(bob.address, sunday)).to.emit(predict, "Settled").withArgs(bob.address, sunday, 7, 0, 0);
    // the long ones are still open: not ready, not "already settled"
    await expect(predict.settle(alice.address, sunday)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
    [pts, landsAt] = await predict.pendingHits(alice.address, sunday);
    expect([pts, landsAt]).to.deep.equal([0n, 0n]);

    // slot 3 (2 days after the close) settles before the airdrop: still the market's week
    await resolveAt(ctx, base + 3n, 1);
    await passSettle(ctx, sunday);
    expect(BigInt(await time.latest())).to.be.lessThan(weekEnd(week) + DEFAULTS.airdropDelay);
    await expect(predict.settle(alice.address, sunday)).to.emit(predict, "PointsCredited").withArgs(alice.address, week, sunday, 2, 50);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(250n);

    // the airdrop of the week does not wait for slot 4 (30 days after the close)
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    expect((await predict.markets(base + 4n)).outcome).to.equal(0n);
    await op.airdrop(week, [alice.address], 0n);

    // slot 4: answer B lands weeks later in the current week, never in the paid one
    await resolveAt(ctx, base + 4n, 2);
    await passSettle(ctx, sunday);
    const cw = await predict.weekOf(await predict.currentDay());
    expect(cw).to.equal(weekOf(sunday + 1n + 30n));
    expect(cw).to.be.greaterThan(week + 3n);
    expect(await predict.airdropDone(cw)).to.equal(false);
    [pts] = await predict.pendingHits(alice.address, sunday);
    expect(pts).to.equal(50n);
    const users = [alice.address, bob.address];
    await expect(predict.settleMany(users, sunday))
      .to.emit(predict, "PointsCredited").withArgs(alice.address, cw, sunday, 2, 50)
      .and.to.emit(predict, "PointsCredited").withArgs(bob.address, cw, sunday, 2, 50)
      .and.to.emit(predict, "Settled").withArgs(alice.address, sunday, 16, 1, 50);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(250n); // the paid week is untouched
    expect((await predict.weekPoints(cw, alice.address)).points).to.equal(50n);
    expect((await predict.weekPoints(cw, alice.address)).lastCompletionAt).to.equal(0n);
    const da = await predict.dayOf(alice.address, sunday);
    expect([da.settledMask, da.hits]).to.deep.equal([31n, 4n]);
    const db = await predict.dayOf(bob.address, sunday);
    expect([db.settledMask, db.hits]).to.deep.equal([31n, 1n]); // only slot 4 (B) is a hit for bob
    await expect(predict.settle(alice.address, sunday)).to.be.revertedWithCustomError(predict, "AlreadySettled");
    await expect(predict.settleMany(users, sunday)).to.be.revertedWithCustomError(predict, "NotReadyToSettle");
  });

  it("compensation on a long market after the airdrop also lands in the current week", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, master, alice, bob, sunday, week } = ctx;
    const id = sunday * 5n + 4n;
    await goTo(dayOpen(sunday));
    await play(predict, alice, sunday, [1, 1, 1, 1, 1]);
    await play(predict, bob, sunday, [2, 2, 2, 2, 2]);
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    await op.airdrop(week, [alice.address], 0n);
    await resolveAt(ctx, id, 1); // wrong: the true answer is B
    await passSettle(ctx, sunday);
    await predict.settleMany([alice.address, bob.address], sunday);
    await predict.connect(master).setCorrectedOutcome(id, 2);
    const cw = await predict.weekOf(await predict.currentDay());
    await expect(op.compensate(id, [bob.address])).to.emit(predict, "PointsCredited").withArgs(bob.address, cw, sunday, 3, 50);
    expect((await predict.weekPoints(week, bob.address)).points).to.equal(100n); // only the completion
  });

  it("a long market whose outcome becomes known early is voided at once by the operator and settles with no hit", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, stranger, alice, sunday, week } = ctx;
    const id = sunday * 5n + 4n;
    await goTo(dayOpen(sunday) + H);
    // known before the close: voided during the day; picking stays possible so the day can be completed
    await expect(op.voidMarket(id, R)).to.emit(predict, "MarketVoided").withArgs(id, R);
    await play(predict, alice, sunday, [1, 1, 1, 1, 1]);
    expect((await predict.dayOf(alice.address, sunday)).completed).to.equal(true);
    await expect(op.setOutcome(id, 1)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    await expect(predict.connect(stranger).voidExpired(id)).to.be.revertedWithCustomError(predict, "AlreadyResolved");
    // after the close the void is ready at once: alice's pick on it is settled with no hit
    await goTo(dayOpen(sunday) + DAY);
    await expect(predict.settle(alice.address, sunday)).to.emit(predict, "Settled").withArgs(alice.address, sunday, 16, 0, 0);
    // slot 3 is voided after the close but before its resolvesAt
    const m3 = await predict.markets(id - 1n);
    expect(BigInt(await time.latest())).to.be.lessThan(m3.resolvesAt);
    await op.voidMarket(id - 1n, R);
    await expect(predict.settle(alice.address, sunday)).to.emit(predict, "Settled").withArgs(alice.address, sunday, 8, 0, 0);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(100n);
  });

  it("nothing changes for a day of five short markets: same bounds, deadlines near the old ones, hits in the day's week", async function () {
    const ctx = await loadFixture(mixed);
    const { predict, op, stranger, alice, day0, week } = ctx;
    const d = day0 + 2n; // created by the fixture: resolves 1 hour (plus i minutes) after the close
    const open = dayOpen(d);
    // the old latest resolve time (open + 2 days) is still accepted
    const d9 = day0 + 9n;
    const m9 = marketsFor(d9);
    m9[4].resolvesAt = dayOpen(d9) + 2n * DAY;
    await op.createDay(d9, m9);
    await goTo(open);
    await play(predict, alice, d, [1, 2, 1, 2, 1]);
    for (let i = 0n; i < 4n; i++) await resolveAt(ctx, d * 5n + i, 1);
    // each deadline is its own resolvesAt plus 48 hours: here 1 hour and 4 minutes after the old day end deadline
    const m4 = await predict.markets(d * 5n + 4n);
    expect(m4.resolvesAt + RESOLVE_DEADLINE).to.equal(open + DAY + RESOLVE_DEADLINE + H + 240n);
    await goTo(m4.resolvesAt + RESOLVE_DEADLINE - 2n);
    await at(m4.resolvesAt + RESOLVE_DEADLINE - 1n);
    await expect(predict.connect(stranger).voidExpired(d * 5n + 4n)).to.be.revertedWithCustomError(predict, "NotExpired");
    await at(m4.resolvesAt + RESOLVE_DEADLINE);
    await predict.connect(stranger).voidExpired(d * 5n + 4n);
    await passSettle(ctx, d);
    await expect(predict.settle(alice.address, d)).to.emit(predict, "Settled").withArgs(alice.address, d, 31, 2, 100)
      .and.to.emit(predict, "PointsCredited").withArgs(alice.address, week, d, 2, 100);
    expect((await predict.weekPoints(week, alice.address)).points).to.equal(200n);
    await expect(predict.settle(alice.address, d)).to.be.revertedWithCustomError(predict, "AlreadySettled");
  });
});
