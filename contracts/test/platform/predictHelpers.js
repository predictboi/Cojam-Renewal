// Shared fixture and helpers for the CojamPredict tests (test/platform/CojamPredict*.js).
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const H = 3600n;
const DAY = 86400n;
const E18 = 10n ** 18n;
const RESOLVE_DEADLINE = 48n * H;
const PARAM_DELAY = 48n * H;
const MAX_TTL = 90n * DAY;

const PARAM_FIELDS = [
  "completionPoints", "hitPoints", "referralBps", "welcomePoints", "settleDelay", "pointsPerCT",
  "minConvertPoints", "maxConvertCtPerUserPerDay", "maxConvertCtPerDay", "minAccountAge", "minResolveGap",
  "maxWeeklyPool", "airdropDelay", "treasury", "splitBps",
];

const DEFAULTS = {
  completionPoints: 100n, hitPoints: 50n, referralBps: 1000n, welcomePoints: 100n, settleDelay: 6n * H,
  pointsPerCT: 1000n, minConvertPoints: 1000n, maxConvertCtPerUserPerDay: 50n, maxConvertCtPerDay: 20000n,
  minAccountAge: 7n * DAY, minResolveGap: H, maxWeeklyPool: 10000n, airdropDelay: 60n * H,
  splitBps: [3000n, 2000n, 1500n, 1000n, 700n, 500n, 400n, 300n, 300n, 300n],
};

/** Converts a Params result from the contract into a plain object of bigints (treasury stays a string). */
function paramsObj(r) {
  const o = {};
  PARAM_FIELDS.forEach((f, i) => {
    o[f] = f === "splitBps" ? Array.from(r[i]).map((x) => BigInt(x)) : f === "treasury" ? r[i] : BigInt(r[i]);
  });
  return o;
}

const weekOf = (d) => (BigInt(d) + 3n) / 7n;
const weekEnd = (w) => (BigInt(w) * 7n + 4n) * DAY;
const dayOpen = (d) => BigInt(d) * DAY;
const hash = (s) => ethers.keccak256(ethers.toUtf8Bytes(String(s)));

/** Default market inputs of a day: slot i closes at open + (12 + 2i) h and resolves `gap` later. */
function marketsFor(dayId, opts = {}) {
  const open = dayOpen(dayId);
  const gap = opts.gap === undefined ? H : opts.gap;
  return [0, 1, 2, 3, 4].map((i) => {
    const closesAt = opts.closes ? opts.closes[i] : open + (12n + 2n * BigInt(i)) * H;
    const resolvesAt = opts.resolves ? opts.resolves[i] : closesAt + gap;
    return { closesAt, resolvesAt, contentHash: hash(`day ${dayId} slot ${i}`) };
  });
}

/**
 * Moves time to 6 hours before a Monday (the start of a week) at least 2 days ahead, then deploys the
 * mock CT, the linked library and CojamPredict (owner = master), funds the reserve with 1,000,000 CT,
 * creates the first week's 7 days and registers alice, bob and carol (no inviter) and dave (invited by alice).
 */
async function deployPredict(opts = {}) {
  const signers = await ethers.getSigners();
  const [deployer, master, operator, treasury, alice, bob, carol, dave, eve, stranger, key1, key2, key3, ...rest] = signers;

  const now = BigInt(await time.latest());
  const today = now / DAY;
  let week = weekOf(today) + 1n;
  if (week * 7n - 3n <= today + 1n) week += 1n;
  const day0 = week * 7n - 3n; // a Monday
  await time.increaseTo(dayOpen(day0) - 6n * H);

  const ct = await (await ethers.getContractFactory("PredictMockCT")).deploy(18);
  const lib = await (await ethers.getContractFactory("PredictLogic")).deploy();
  const Predict = await ethers.getContractFactory("CojamPredict", { libraries: { PredictLogic: await lib.getAddress() } });
  const predict = await Predict.deploy(await ct.getAddress(), master.address, operator.address, treasury.address);
  const addr = await predict.getAddress();

  const fund = opts.fund === undefined ? 1_000_000n * E18 : opts.fund;
  await ct.mint(master.address, 10_000_000n * E18);
  if (fund > 0n) await ct.connect(master).transfer(addr, fund);

  const op = predict.connect(operator);
  const days = opts.days === undefined ? 7 : opts.days;
  for (let i = 0; i < days; i++) await op.createDay(day0 + BigInt(i), marketsFor(day0 + BigInt(i)));
  if (opts.register !== false) {
    for (const s of [alice, bob, carol]) await op.registerPlayer(s.address, ethers.ZeroAddress);
    await op.registerPlayer(dave.address, alice.address);
  }

  return {
    deployer, master, operator, treasury, alice, bob, carol, dave, eve, stranger, key1, key2, key3, rest,
    ct, lib, predict, op, Predict, addr, day0, week, fund,
  };
}

/** Sets the block time of the next transaction (works for the same second as the latest block too). */
async function at(ts) {
  const latest = BigInt(await time.latest());
  if (BigInt(ts) > latest) await time.setNextBlockTimestamp(ts);
}

/** Moves to `ts` (mines a block) unless time is already past it. */
async function goTo(ts) {
  const latest = BigInt(await time.latest());
  if (BigInt(ts) > latest) await time.increaseTo(ts);
}

/** Predicts the given choices (1 or 2; 0 skips) of `dayId` from `signer`. */
async function play(predict, signer, dayId, choices) {
  for (let i = 0; i < 5; i++) {
    if (!choices[i]) continue;
    await predict.connect(signer).predict(BigInt(dayId) * 5n + BigInt(i), choices[i]);
  }
}

/** Sets outcomes for the 5 markets of `dayId` at the latest resolve time (0 skips a slot). */
async function resolveDay(ctx, dayId, outcomes) {
  const base = BigInt(dayId) * 5n;
  let latest = 0n;
  for (let i = 0; i < 5; i++) {
    const m = await ctx.predict.markets(base + BigInt(i));
    if (m.resolvesAt > latest) latest = m.resolvesAt;
  }
  await goTo(latest);
  for (let i = 0; i < 5; i++) if (outcomes[i]) await ctx.op.setOutcome(base + BigInt(i), outcomes[i]);
}

/** Moves past every settle time of the day's resolved markets. */
async function passSettle(ctx, dayId) {
  const base = BigInt(dayId) * 5n;
  let latest = 0n;
  for (let i = 0; i < 5; i++) {
    const m = await ctx.predict.markets(base + BigInt(i));
    if (m.settlesAt > latest) latest = m.settlesAt;
  }
  await goTo(latest);
}

/** Full Params object with some fields replaced (treasury defaults to the fixture's treasury). */
function withParams(ctx, patch = {}) {
  return { ...DEFAULTS, treasury: ctx.treasury.address, ...patch };
}

/** Proposes and applies `patch` after the 48 hour delay. */
async function changeParams(ctx, patch) {
  await ctx.predict.connect(ctx.master).proposeParams(withParams(ctx, patch));
  await time.increase(PARAM_DELAY);
  await ctx.predict.connect(ctx.master).applyParams();
}

module.exports = {
  H, DAY, E18, RESOLVE_DEADLINE, PARAM_DELAY, MAX_TTL, PARAM_FIELDS, DEFAULTS,
  paramsObj, weekOf, weekEnd, dayOpen, hash, marketsFor, deployPredict, at, goTo, play, resolveDay, passSettle,
  withParams, changeParams,
};
