const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  H, DAY, E18, PARAM_DELAY, DEFAULTS, PARAM_FIELDS, paramsObj, weekEnd, dayOpen, marketsFor, deployPredict, at, goTo, play,
  resolveDay, passSettle, withParams, changeParams,
} = require("./predictHelpers");

const Z = ethers.ZeroAddress;
const R = ethers.encodeBytes32String("reason");

/** Alice, bob and carol each play 7 days (all A) of week `week`; markets all resolve A. Ends after the week's last settle. */
async function richWeek() {
  const ctx = await deployPredict();
  const { predict, alice, bob, carol, day0 } = ctx;
  for (let i = 0n; i < 7n; i++) {
    const d = day0 + i;
    await goTo(dayOpen(d));
    await play(predict, alice, d, [1, 1, 1, 1, 1]);
    await play(predict, bob, d, [1, 1, 1, 1, 2]);
    await play(predict, carol, d, [2, 2, 2, 2, 2]);
    await resolveDay(ctx, d, [1, 1, 1, 1, 1]);
  }
  await passSettle(ctx, day0 + 6n);
  for (let i = 0n; i < 7n; i++) await predict.settleMany([alice.address, bob.address, carol.address], day0 + i);
  return ctx;
}

describe("CojamPredict: convert", function () {
  it("burns points and pays CT after the account age; emits Transfer to zero and Converted", async function () {
    const { predict, ct, alice, day0 } = await loadFixture(richWeek);
    // registered 6 h before day0: account age 7 days reached at day0 + 6d 18h
    const reg = (await predict.players(alice.address)).registeredAt;
    expect(await time.latest()).to.be.greaterThan(Number(reg + 7n * DAY));
    const bal = await predict.balanceOf(alice.address);
    const supply = await predict.totalSupply();
    const ctBefore = await ct.balanceOf(alice.address);
    expect(bal).to.equal(2450n);
    expect(await predict.previewConvert(2000)).to.equal(2n * E18);
    expect(await predict.connect(alice).convert.staticCall(2000)).to.equal(2n * E18);
    await expect(predict.connect(alice).convert(2000))
      .to.emit(predict, "Transfer").withArgs(alice.address, Z, 2000)
      .and.to.emit(predict, "Converted").withArgs(alice.address, 2000, 2n * E18);
    expect(await predict.balanceOf(alice.address)).to.equal(bal - 2000n);
    expect(await predict.totalSupply()).to.equal(supply - 2000n);
    expect(await ct.balanceOf(alice.address)).to.equal(ctBefore + 2n * E18);
    const today = await predict.currentDay();
    expect(await predict.convertedCtOnDay(alice.address, today)).to.equal(2n * E18);
    expect(await predict.convertedCtTotalOnDay(today)).to.equal(2n * E18);
    expect(day0).to.be.a("bigint");
  });

  it("account age boundary: refused one second before registeredAt + minAccountAge, accepted at it", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, op, alice, eve } = ctx;
    // eve registers now and earns nothing; use alice's points with a longer age instead
    await changeParams(ctx, { minAccountAge: 30n * DAY });
    const reg = (await predict.players(alice.address)).registeredAt;
    await goTo(reg + 30n * DAY - 2n);
    await at(reg + 30n * DAY - 1n);
    await expect(predict.connect(alice).convert(1000)).to.be.revertedWithCustomError(predict, "AccountTooNew");
    await at(reg + 30n * DAY);
    await predict.connect(alice).convert(1000);
    await op.registerPlayer(eve.address, Z);
    await expect(predict.connect(eve).convert(1000)).to.be.revertedWithCustomError(predict, "AccountTooNew");
  });

  it("refusals: unregistered, frozen, paused, below minimum, not a multiple, not enough points", async function () {
    const { predict, op, master, alice, eve } = await loadFixture(richWeek);
    await expect(predict.connect(eve).convert(1000)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(predict.connect(alice).convert(999)).to.be.revertedWithCustomError(predict, "BelowMinimum");
    await expect(predict.connect(alice).convert(0)).to.be.revertedWithCustomError(predict, "BelowMinimum");
    await expect(predict.connect(alice).convert(1500)).to.be.revertedWithCustomError(predict, "NotMultipleOfRate");
    const bal = await predict.balanceOf(alice.address);
    const tooMuch = (bal / 1000n + 1n) * 1000n;
    await expect(predict.connect(alice).convert(tooMuch)).to.be.revertedWithCustomError(predict, "InsufficientPoints").withArgs(bal, tooMuch);
    await op.pause();
    await expect(predict.connect(alice).convert(1000)).to.be.revertedWithCustomError(predict, "EnforcedPause");
    await predict.connect(master).unpause();
    await op.setFrozen(alice.address, true, R);
    await expect(predict.connect(alice).convert(1000)).to.be.revertedWithCustomError(predict, "Frozen");
  });

  it("per user daily cap: 50 CT a day, the left amount in the error, a new day resets it", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, alice, bob } = ctx;
    await changeParams(ctx, { maxConvertCtPerUserPerDay: 1n });
    await goTo(dayOpen((await predict.currentDay()) + 1n));
    await expect(predict.connect(alice).convert(2000)).to.be.revertedWithCustomError(predict, "DailyCapReached").withArgs(1n * E18);
    await predict.connect(alice).convert(1000);
    await expect(predict.connect(alice).convert(1000)).to.be.revertedWithCustomError(predict, "DailyCapReached").withArgs(0n);
    await predict.connect(bob).convert(1000); // the cap is per user
    await goTo(dayOpen((await predict.currentDay()) + 1n));
    await predict.connect(alice).convert(1000);
  });

  it("global daily cap across users", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, op, alice, bob } = ctx;
    await changeParams(ctx, {
      maxConvertCtPerDay: 100n, pointsPerCT: 100n, minConvertPoints: 100n, maxConvertCtPerUserPerDay: 90n, completionPoints: 1000n, hitPoints: 1000n,
    });
    const d = (await predict.currentDay()) + 1n;
    await op.createDay(d, marketsFor(d));
    await goTo(dayOpen(d));
    await play(predict, alice, d, [1, 1, 1, 1, 1]);
    await play(predict, bob, d, [1, 1, 1, 1, 1]);
    await resolveDay(ctx, d, [1, 1, 1, 1, 1]);
    await passSettle(ctx, d);
    await predict.settleMany([alice.address, bob.address], d);
    expect(await predict.balanceOf(alice.address)).to.equal(8450n);
    await predict.connect(alice).convert(8400); // 84 CT
    await expect(predict.connect(bob).convert(1700)).to.be.revertedWithCustomError(predict, "DailyCapReached").withArgs(16n * E18);
    await predict.connect(bob).convert(1600);
    expect(await predict.convertedCtTotalOnDay(await predict.currentDay())).to.equal(100n * E18);
  });

  it("a cap lowered below what was already used that day reports 0 left (no underflow)", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, master, alice } = ctx;
    await predict.connect(master).proposeParams(withParams(ctx, { maxConvertCtPerUserPerDay: 1n, pointsPerCT: 100n, minConvertPoints: 100n }));
    await time.increase(PARAM_DELAY);
    await predict.connect(alice).convert(2000); // 2 CT under the old 50 CT cap
    await predict.connect(master).applyParams(); // same day: the user cap is now 1 CT
    await expect(predict.connect(alice).convert(100)).to.be.revertedWithCustomError(predict, "DailyCapReached").withArgs(0n);
  });

  it("reserve shortfall reverts instead of overdrawing", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, master, treasury, alice, addr, ct } = ctx;
    const res = await predict.reserve();
    expect(res).to.equal(await ct.balanceOf(addr));
    await predict.connect(master).withdrawReserve(res - E18 / 2n, treasury.address);
    await expect(predict.connect(alice).convert(1000)).to.be.revertedWithCustomError(predict, "InsufficientReserve").withArgs(E18 / 2n, E18);
  });
});

describe("CojamPredict: weekly airdrop", function () {
  it("pays the ordered winners their split of the pool once, after the week's end plus airdropDelay", async function () {
    const { predict, op, ct, alice, bob, carol, week } = await loadFixture(richWeek);
    const sa = await predict.weekPoints(week, alice.address);
    const sb = await predict.weekPoints(week, bob.address);
    const sc = await predict.weekPoints(week, carol.address);
    expect(sa.points).to.equal(7n * 350n);
    expect(sb.points).to.equal(7n * 300n);
    expect(sc.points).to.equal(7n * 100n);
    const pool = 1000n * E18;
    const end = weekEnd(week) + DEFAULTS.airdropDelay;
    await goTo(end - 2n);
    await at(end - 1n);
    await expect(op.airdrop(week, [alice.address, bob.address, carol.address], pool)).to.be.revertedWithCustomError(predict, "WeekNotOver");
    const before = await predict.reserve();
    await at(end);
    const tx = op.airdrop(week, [alice.address, bob.address, carol.address], pool);
    await expect(tx).to.emit(predict, "AirdropPaid").withArgs(week, 1, alice.address, 300n * E18)
      .and.to.emit(predict, "AirdropPaid").withArgs(week, 2, bob.address, 200n * E18)
      .and.to.emit(predict, "AirdropPaid").withArgs(week, 3, carol.address, 150n * E18);
    await expect(tx).to.changeTokenBalances(ct, [alice, bob, carol], [300n * E18, 200n * E18, 150n * E18]);
    expect(await predict.reserve()).to.equal(before - 650n * E18); // unpaid ranks stay in the reserve
    expect(await predict.airdropDone(week)).to.equal(true);
    await expect(op.airdrop(week, [alice.address], pool)).to.be.revertedWithCustomError(predict, "AirdropDone");
  });

  it("refuses bad lists: empty, more than 10, wrong order, duplicates, zero points, unregistered, frozen", async function () {
    const { predict, op, alice, bob, carol, eve, rest, week } = await loadFixture(richWeek);
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    const pool = 100n * E18;
    await expect(op.airdrop(week, [], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await expect(op.airdrop(week, Array(11).fill(alice.address), pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await expect(op.airdrop(week, [bob.address, alice.address], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await expect(op.airdrop(week, [alice.address, alice.address], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await op.registerPlayer(rest[0].address, Z);
    await expect(op.airdrop(week, [alice.address, rest[0].address], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await expect(op.airdrop(week, [alice.address, eve.address], pool)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await op.setFrozen(alice.address, true, R);
    await expect(op.airdrop(week, [alice.address, bob.address], pool)).to.be.revertedWithCustomError(predict, "Frozen");
    // the frozen winner is skipped: the next ranks move up
    await op.airdrop(week, [bob.address, carol.address], pool);
    expect(await predict.airdropDone(week)).to.equal(true);
  });

  it("ties: equal points rank by the earlier last completion, then by the lower address; settles never move it", async function () {
    const ctx = await deployPredict({ register: false });
    const { predict, op, day0, week, rest } = ctx;
    const [p1, p2, p3] = rest.slice(0, 3).sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1));
    for (const s of [p1, p2, p3]) await op.registerPlayer(s.address, Z);
    await goTo(dayOpen(day0));
    // p3 completes first, then p1 and p2 complete in the same block (same lastCompletionAt)
    await play(predict, p3, day0, [1, 1, 1, 1, 1]);
    await play(predict, p1, day0, [1, 1, 1, 1, 0]);
    await play(predict, p2, day0, [1, 1, 1, 1, 0]);
    await ethers.provider.send("evm_setAutomine", [false]);
    await predict.connect(p2).predict(day0 * 5n + 4n, 1);
    await predict.connect(p1).predict(day0 * 5n + 4n, 1);
    await ethers.provider.send("evm_mine", []);
    await ethers.provider.send("evm_setAutomine", [true]);
    const s1 = await predict.weekPoints(week, p1.address);
    const s2 = await predict.weekPoints(week, p2.address);
    const s3 = await predict.weekPoints(week, p3.address);
    expect(s1.points).to.equal(s2.points);
    expect(s1.lastCompletionAt).to.equal(s2.lastCompletionAt);
    expect(s3.lastCompletionAt).to.be.lessThan(s1.lastCompletionAt);
    // hits settled later (p3 last, by a keeper or a racing bot) do not change the tie break
    await resolveDay(ctx, day0, [1, 1, 1, 1, 1]);
    await passSettle(ctx, day0);
    await predict.settle(p1.address, day0);
    await predict.settle(p2.address, day0);
    await predict.settle(p3.address, day0);
    const t3 = await predict.weekPoints(week, p3.address);
    expect(t3.points).to.equal(350n);
    expect(t3.lastCompletionAt).to.equal(s3.lastCompletionAt);
    expect((await predict.weekPoints(week, p1.address)).lastCompletionAt).to.equal(s1.lastCompletionAt);
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    const pool = 10n * E18;
    await expect(op.airdrop(week, [p1.address, p3.address, p2.address], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await expect(op.airdrop(week, [p3.address, p2.address, p1.address], pool)).to.be.revertedWithCustomError(predict, "BadWinners");
    await op.airdrop(week, [p3.address, p1.address, p2.address], pool);
  });

  it("pool cap, reserve check, role", async function () {
    const { predict, op, master, treasury, stranger, alice, bob, week } = await loadFixture(richWeek);
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    await expect(predict.connect(stranger).airdrop(week, [alice.address], 1n)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.airdrop(week, [alice.address], 10_000n * E18 + 1n)).to.be.revertedWithCustomError(predict, "PoolTooLarge");
    await predict.connect(master).withdrawReserve(await predict.reserve() - 100n * E18, treasury.address);
    await expect(op.airdrop(week, [alice.address, bob.address], 10_000n * E18)).to.be.revertedWithCustomError(predict, "InsufficientReserve").withArgs(100n * E18, 5000n * E18);
    await op.airdrop(week, [alice.address, bob.address], 10_000n * E18 / 100n); // 30 + 20 CT
    expect(await predict.reserve()).to.equal(50n * E18);
  });

  it("a pool of 0 marks the week done without payments; a max pool of 0 allows only 0", async function () {
    const ctx = await loadFixture(richWeek);
    const { predict, op, alice, week } = ctx;
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    await changeParams(ctx, { maxWeeklyPool: 0n });
    await expect(op.airdrop(week, [alice.address], 1n)).to.be.revertedWithCustomError(predict, "PoolTooLarge");
    await expect(op.airdrop(week, [alice.address], 0n)).to.emit(predict, "AirdropPaid").withArgs(week, 1, alice.address, 0);
  });
});

describe("CojamPredict: parameters", function () {
  it("propose, wait 48 hours, apply; events and views", async function () {
    const ctx = await loadFixture(deployPredict);
    const { predict, master, treasury } = ctx;
    const own = predict.connect(master);
    const p = withParams(ctx, { hitPoints: 70n, completionPoints: 120n });
    const tx = own.proposeParams(p);
    await expect(tx).to.emit(predict, "ParamsProposed");
    const proposedAt = BigInt(await time.latest());
    const [pend, applyAfter] = await predict.pendingParams();
    expect(applyAfter).to.equal(proposedAt + PARAM_DELAY);
    expect(paramsObj(pend)).to.deep.equal(p);
    await at(applyAfter - 1n);
    await expect(own.applyParams()).to.be.revertedWithCustomError(predict, "TooEarly");
    await at(applyAfter);
    await expect(own.applyParams()).to.emit(predict, "ParamsApplied");
    expect(paramsObj(await predict.params())).to.deep.equal(p);
    const [pend2, after2] = await predict.pendingParams();
    expect(after2).to.equal(0n);
    expect(pend2[0]).to.equal(0n);
    await expect(own.applyParams()).to.be.revertedWithCustomError(predict, "NoPendingParams");
    expect(treasury.address).to.equal(p.treasury);
  });

  it("a new proposal replaces the pending one and restarts the delay; cancel drops it", async function () {
    const ctx = await loadFixture(deployPredict);
    const { predict, master } = ctx;
    const own = predict.connect(master);
    await own.proposeParams(withParams(ctx, { hitPoints: 70n }));
    await time.increase(40n * H);
    await own.proposeParams(withParams(ctx, { hitPoints: 80n }));
    await time.increase(10n * H);
    await expect(own.applyParams()).to.be.revertedWithCustomError(predict, "TooEarly");
    await expect(own.cancelParams()).to.emit(predict, "ParamsCancelled");
    await expect(own.cancelParams()).to.be.revertedWithCustomError(predict, "NoPendingParams");
    await time.increase(48n * H);
    await expect(own.applyParams()).to.be.revertedWithCustomError(predict, "NoPendingParams");
    expect((await predict.params()).hitPoints).to.equal(50n);
  });

  it("every bound is enforced and the edges are accepted", async function () {
    const ctx = await loadFixture(deployPredict);
    const { predict, master } = ctx;
    const own = predict.connect(master);
    const bad = [
      [0, { completionPoints: 1001n }], [1, { hitPoints: 1001n }], [2, { referralBps: 2001n }], [3, { welcomePoints: 1001n }],
      [4, { settleDelay: 48n * H + 1n, airdropDelay: 7n * DAY }], [5, { pointsPerCT: 99n }], [5, { pointsPerCT: 100001n, minConvertPoints: 1_000_000n }],
      [6, { minConvertPoints: 999n }], [6, { minConvertPoints: 1_000_001n }], [7, { maxConvertCtPerUserPerDay: 0n }],
      [7, { maxConvertCtPerUserPerDay: 10001n }], [8, { maxConvertCtPerDay: 99n }], [8, { maxConvertCtPerDay: 1_000_001n }],
      [9, { minAccountAge: 30n * DAY + 1n }], [10, { minResolveGap: 7n * DAY + 1n }], [11, { maxWeeklyPool: 1_000_001n }],
      [12, { airdropDelay: 54n * H - 1n }], [12, { airdropDelay: 7n * DAY + 1n }], [12, { settleDelay: 24n * H, airdropDelay: 60n * H }],
      [13, { treasury: Z }],
      [14, { splitBps: [3000n, 2000n, 1500n, 1000n, 700n, 500n, 400n, 300n, 300n, 299n] }],
      [14, { splitBps: [2000n, 3000n, 1500n, 1000n, 700n, 500n, 400n, 300n, 300n, 300n] }],
    ];
    for (const [which, patch] of bad) {
      await expect(own.proposeParams(withParams(ctx, patch)), JSON.stringify(patch, (k, v) => (typeof v === "bigint" ? v.toString() : v)))
        .to.be.revertedWithCustomError(predict, "ParamOutOfBounds").withArgs(which);
    }
    const edges = [
      { completionPoints: 1000n, hitPoints: 1000n, referralBps: 2000n, welcomePoints: 1000n },
      { completionPoints: 0n, hitPoints: 0n, referralBps: 0n, welcomePoints: 0n, minAccountAge: 0n, minResolveGap: 0n, maxWeeklyPool: 0n },
      { settleDelay: 48n * H, airdropDelay: 96n * H }, { settleDelay: 0n, airdropDelay: 48n * H },
      { pointsPerCT: 100n, minConvertPoints: 100n }, { pointsPerCT: 100000n, minConvertPoints: 1_000_000n },
      { maxConvertCtPerUserPerDay: 1n, maxConvertCtPerDay: 100n }, { maxConvertCtPerUserPerDay: 10000n, maxConvertCtPerDay: 1_000_000n },
      { minAccountAge: 30n * DAY, minResolveGap: 7n * DAY, maxWeeklyPool: 1_000_000n, airdropDelay: 7n * DAY },
      { splitBps: [10000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] }, { splitBps: Array(10).fill(1000n) },
    ];
    for (const patch of edges) await own.proposeParams(withParams(ctx, patch));
    expect(PARAM_FIELDS.length).to.equal(15);
  });

  it("applied parameters take effect: points, rate, treasury", async function () {
    const ctx = await loadFixture(deployPredict);
    const { predict, master, alice, stranger, treasury } = ctx;
    await changeParams(ctx, { completionPoints: 7n, treasury: stranger.address });
    const d = (await predict.currentDay()) + 1n;
    await goTo(dayOpen(d));
    await play(predict, alice, d, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(alice.address)).to.equal(7n);
    await expect(predict.connect(master).withdrawReserve(1n, treasury.address)).to.be.revertedWithCustomError(predict, "NotTreasury");
    await predict.connect(master).withdrawReserve(1n, stranger.address);
  });
});

describe("CojamPredict: pause, reserve and access control", function () {
  it("PAUSER pauses, cannot unpause; only the owner unpauses", async function () {
    const { predict, op, master, stranger } = await loadFixture(deployPredict);
    await expect(predict.connect(stranger).pause()).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await op.pause();
    expect(await predict.paused()).to.equal(true);
    await expect(op.unpause()).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await predict.connect(master).unpause();
    await predict.connect(master).pause(); // the master also holds PAUSER
    await predict.connect(master).unpause();
    expect(await predict.paused()).to.equal(false);
  });

  it("withdrawReserve: owner only, to the treasury, not zero, not above the reserve", async function () {
    const { predict, ct, op, master, treasury, fund } = await loadFixture(deployPredict);
    const own = predict.connect(master);
    await expect(op.withdrawReserve(1n, treasury.address)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(own.withdrawReserve(1n, master.address)).to.be.revertedWithCustomError(predict, "NotTreasury");
    await expect(own.withdrawReserve(0n, treasury.address)).to.be.revertedWithCustomError(predict, "ZeroAmount");
    await expect(own.withdrawReserve(fund + 1n, treasury.address)).to.be.revertedWithCustomError(predict, "InsufficientReserve").withArgs(fund, fund + 1n);
    const tx = own.withdrawReserve(fund, treasury.address);
    await expect(tx).to.emit(predict, "ReserveWithdrawn").withArgs(treasury.address, fund);
    await expect(tx).to.changeTokenBalance(ct, treasury, fund);
    expect(await predict.reserve()).to.equal(0n);
  });

  it("every restricted function refuses an outsider (and the operator for owner functions)", async function () {
    const ctx = await loadFixture(deployPredict);
    const { predict, op, stranger, alice, day0 } = ctx;
    const s = predict.connect(stranger);
    const ERR = "AccessControlUnauthorizedAccount";
    const p = withParams(ctx);
    const calls = [
      () => s.registerPlayer(stranger.address, Z), () => s.registerPlayers([stranger.address], [Z]),
      () => s.setReferrer(alice.address, Z), () => s.setReferrers([alice.address], [Z]),
      () => s.setFrozen(alice.address, true, R), () => s.setFrozenMany([alice.address], true, [R]),
      () => s.createDay(day0 + 20n, marketsFor(day0 + 20n)), () => s.setOutcome(day0 * 5n, 1), () => s.correctOutcome(day0 * 5n, 1),
      () => s.voidMarket(day0 * 5n, R), () => s.setCorrectedOutcome(day0 * 5n, 1), () => s.compensate(day0 * 5n, [alice.address]),
      () => s.airdrop(1, [alice.address], 0), () => s.proposeParams(p), () => s.applyParams(), () => s.cancelParams(),
      () => s.pause(), () => s.unpause(), () => s.withdrawReserve(1, stranger.address),
      () => s.grantRole(ethers.id("OPERATOR_ROLE"), stranger.address),
    ];
    for (const c of calls) await expect(c()).to.be.revertedWithCustomError(predict, ERR);
    for (const c of [() => op.setCorrectedOutcome(day0 * 5n, 1), () => op.proposeParams(p), () => op.applyParams(), () => op.cancelParams(),
      () => op.unpause(), () => op.withdrawReserve(1, ctx.treasury.address), () => op.grantRole(ethers.id("OPERATOR_ROLE"), stranger.address)]) {
      await expect(c()).to.be.revertedWithCustomError(predict, ERR);
    }
  });

  it("the owner rotates the operator; the owner transfer waits 3 days", async function () {
    const { predict, operator, master, stranger, day0 } = await loadFixture(deployPredict);
    const own = predict.connect(master);
    const ROLE = await predict.OPERATOR_ROLE();
    await own.revokeRole(ROLE, operator.address);
    await expect(predict.connect(operator).createDay(day0 + 20n, marketsFor(day0 + 20n))).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await own.grantRole(ROLE, stranger.address);
    await predict.connect(stranger).createDay(day0 + 20n, marketsFor(day0 + 20n));
    await own.beginDefaultAdminTransfer(stranger.address);
    await expect(predict.connect(stranger).acceptDefaultAdminTransfer()).to.be.revertedWithCustomError(predict, "AccessControlEnforcedDefaultAdminDelay");
    await time.increase(3n * DAY + 1n);
    await predict.connect(stranger).acceptDefaultAdminTransfer();
    expect(await predict.owner()).to.equal(stranger.address);
  });
});
