// Full cycle E2E of the platform contracts with real transactions.
//   npx hardhat run scripts/platform/e2e-kairos.js --network kairos     live, against deployments/platform.kairos.json
//   npx hardhat run scripts/platform/e2e-kairos.js                      whole cycle on the in process Hardhat network
//                                                                        (fresh contracts, time travel between phases)
// The contract's day is a real UTC day: createDay must be mined before 23:00 UTC of that day (late creation is allowed
// while at least 1 hour remains), predictions run during it, outcomes from close + minResolveGap (1 h), hits land settleDelay (6 h) after the outcome, the week's airdrop
// from weekEnd + airdropDelay (60 h), conversion 7 days after registration. None of this can be compressed on Kairos
// without changing parameters (48 h delay) or the code, so the live run is phased: each run does every phase whose
// time has come and that is not yet recorded, and prints when the next one opens. Re-run it later to continue.
//
//   setup    now: players, invite at registration and late invite code, play keys, today's day (late creation, when
//            more than 65 minutes remain) and the next two days, refusals (predict before the open, createDay for a past
//            day, convert by a new account, second referrer), freeze and unfreeze, pause and unpause, withdrawReserve
//   staking  short lock staking stake / claim / withdraw, main staking stake, withdrawRewards (once per staking deploy)
//   play     a created day is open: A and B answer all 5 by play key (B invited: bonus to A, welcome to B), C by wallet,
//            B revokes its play key, predict after revoke refused
//   resolve  close + 1 h: setOutcome on all five (one void), one correction inside the window
//   settle   settlesAt passed: settleMany, second settle refused
//   params   only when a change is pending: applyParams 48 h after proposeParams. Live, setup proposes nothing unless
//            E2E_TEST_PARAMS=1 (pointsPerCT 100, minConvertPoints 100, minAccountAge 1 day, recorded under `testParams`),
//            because the API and the PWA read params() from this contract. The Hardhat run always uses the test change.
//   airdrop  weekEnd + 60 h: airdrop of the week to the ranked players
//   convert  account age passed and player A holds at least minConvertPoints: A converts the minimum
//
// Player wallets and play keys are derived from PRIVATE_KEY (never printed or stored), so every run finds the same
// accounts. Results (addresses, tx hashes, gas) go to deployments/platform.kairos.e2e.json.
const { ethers, network } = require("hardhat");
const path = require("path");
const { DEPLOYMENTS, readJson, writeJson, send, errorName } = require("./lib");

const DAY = 86400;
const OUT = path.join(DEPLOYMENTS, "platform.kairos.e2e.json");
const CT1 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const live = network.name === "kairos";
  if (!live && network.name !== "hardhat") throw new Error("kairos or the in process hardhat network only");
  const provider = ethers.provider;
  const [op] = await ethers.getSigners();
  const rec = (live && readJson(OUT)) || { network: live ? "kairos" : "hardhat", phases: {}, gas: {} };
  rec.network = live ? "kairos" : "hardhat";
  rec.phases = rec.phases || {};
  rec.gas = rec.gas || {};
  const save = () => { if (live) writeJson(OUT, rec); };

  // ---------- contracts ----------
  let ct, predict, staking, shortLock, logic;
  if (live) {
    const d = readJson(path.join(DEPLOYMENTS, "platform.kairos.json"));
    if (!d) throw new Error("deploy first: scripts/platform/deploy-kairos.js");
    const c = d.contracts;
    ct = await ethers.getContractAt("CojamToken", c.ct.address);
    predict = await ethers.getContractAt("CojamPredict", c.predict.address);
    logic = await ethers.getContractAt("PredictLogic", c.predictLogic.address);
    staking = await ethers.getContractAt("CojamStaking", c.staking.address);
    shortLock = await ethers.getContractAt("StakingShortLock", c.stakingShortLock.address);
    const contracts = { ct: c.ct.address, predict: c.predict.address, staking: c.staking.address, stakingShortLock: c.stakingShortLock.address };
    if (rec.contracts && rec.contracts.predict && rec.contracts.predict !== contracts.predict) {
      // CojamPredict was redeployed: archive the old run; staking results carry over when the staking contracts are the same.
      const old = { contracts: rec.contracts, days: rec.days, playDay: rec.playDay, phases: rec.phases, gas: rec.gas, status: rec.status, archivedAt: new Date().toISOString() };
      rec.retired = [...(rec.retired || []), old];
      const sameStaking = rec.contracts.staking === contracts.staking && rec.contracts.stakingShortLock === contracts.stakingShortLock;
      const oldStaking = rec.phases.staking || (rec.phases.setup && rec.phases.setup.shortLockPosition ? rec.phases.setup : null);
      rec.phases = {};
      rec.gas = {};
      delete rec.days; delete rec.playDay; delete rec.status;
      if (sameStaking && oldStaking && oldStaking.done) {
        rec.phases.staking = { done: true, carriedOver: `staking ran live against the same staking contracts: see retired[${rec.retired.length - 1}].phases.${old.phases.staking ? "staking" : "setup"}`,
          shortLockPosition: oldStaking.shortLockPosition, mainStakingPosition: oldStaking.mainStakingPosition };
      }
    }
    rec.contracts = contracts;
  } else {
    ct = await (await ethers.getContractFactory("CojamToken")).deploy(op.address);
    logic = await (await ethers.getContractFactory("PredictLogic")).deploy();
    predict = await (await ethers.getContractFactory("CojamPredict", { libraries: { PredictLogic: await logic.getAddress() } }))
      .deploy(await ct.getAddress(), op.address, op.address, op.address);
    staking = await (await ethers.getContractFactory("CojamStaking")).deploy(await ct.getAddress(), op.address, op.address, op.address);
    shortLock = await (await ethers.getContractFactory("StakingShortLock")).deploy(await ct.getAddress(), op.address, op.address, op.address, 2);
    for (const c of [predict, staking, shortLock]) await (await ct.transfer(await c.getAddress(), 100_000n * CT1)).wait();
  }
  const ifaces = [predict.interface, logic.interface, staking.interface];

  // ---------- accounts ----------
  const seed = live ? process.env.PRIVATE_KEY : "hardhat-local-seed";
  const derive = (label) => new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes(`cojam-platform-e2e:${label}:${seed}`)), provider);
  const A = derive("playerA"), B = derive("playerB"), C = derive("playerC"), keyA = derive("playKeyA"), keyB = derive("playKeyB");
  rec.accounts = { operatorOwnerTreasury: op.address, playerA: A.address, playerB: B.address, playerC: C.address, playKeyA: keyA.address, playKeyB: keyB.address,
    note: "A registered without inviter; B registered with A as inviter; C registered alone and linked to A later (late invite code). Keys derived from the test key, never stored." };

  // ---------- helpers ----------
  const now = async () => Number((await provider.getBlock("latest")).timestamp);
  const log = (...a) => console.log(...a);
  let phase;
  const step = async (label, fn) => {
    const { gas } = await send(label, fn);
    phase.steps.push({ label, tx: gas.tx, block: gas.block, gasUsed: gas.gasUsed, gasPriceGkei: gas.gasPriceGkei, feeKaia: gas.feeKaia });
    const key = label.replace(/\s*\[.*\]$/, "");
    (rec.gas[key] = rec.gas[key] || []).includes(gas.gasUsed) || rec.gas[key].push(gas.gasUsed);
    save();
    return gas;
  };
  const refuse = async (label, fn, expected) => {
    let name = "NO REVERT";
    try { await fn(); } catch (e) { name = errorName(e, ...ifaces); }
    const ok = [].concat(expected).includes(name);
    phase.refusals.push({ label, expected, got: name, ok });
    log(`  refusal ${label.padEnd(42)} ${ok ? "ok" : "UNEXPECTED"}: ${name}`);
    if (!ok) throw new Error(`${label}: expected ${expected}, got ${name}`);
  };
  const travel = async (to) => {
    if (live) return false;
    const t = await now();
    if (to > t) { await provider.send("evm_setNextBlockTimestamp", [to]); await provider.send("evm_mine", []); }
    return true;
  };
  const begin = (name) => { phase = rec.phases[name] = { startedAt: new Date().toISOString(), steps: [], refusals: [] }; log(`\n== ${name} ==`); };
  const done = (extra = {}) => { Object.assign(phase, extra, { done: true, finishedAt: new Date().toISOString() }); save(); };
  const pts = async (a) => Number(await predict.balanceOf(a));
  const topUp = async (w, kaia) => {
    const want = ethers.parseEther(kaia);
    if ((await provider.getBalance(w.address)) < want / 2n) await step(`fund ${kaia} KAIA [${w.address.slice(0, 8)}]`, () => op.sendTransaction({ to: w.address, value: want }));
  };
  const hash = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

  // ================= setup =================
  if (!rec.phases.setup || !rec.phases.setup.done) {
    begin("setup");
    for (const [w, k] of [[A, "1"], [B, "0.5"], [C, "0.5"], [keyA, "0.5"], [keyB, "0.5"]]) await topUp(w, k);
    if ((await ct.balanceOf(A.address)) < 20_000n * CT1) await step("CT transfer 20,000 to player A", () => ct.transfer(A.address, 20_000n * CT1));

    // registration and invites
    if (!(await predict.players(A.address)).registered) await step("registerPlayer (no inviter)", () => predict.registerPlayer(A.address, ethers.ZeroAddress));
    if (!(await predict.players(B.address)).registered) await step("registerPlayer (with inviter)", () => predict.registerPlayer(B.address, A.address));
    if (!(await predict.players(C.address)).registered) await step("registerPlayer (no inviter) [C]", () => predict.registerPlayer(C.address, ethers.ZeroAddress));
    if ((await predict.players(C.address)).referrer === ethers.ZeroAddress) await step("setReferrer (late code within 24 h)", () => predict.setReferrer(C.address, A.address));
    await refuse("setReferrer a second time", () => predict.setReferrer.staticCall(C.address, B.address), "ReferrerAlreadySet");
    await refuse("registerPlayer twice", () => predict.registerPlayer.staticCall(A.address, ethers.ZeroAddress), "AlreadyRegistered");

    // play keys
    const exp = (await now()) + 30 * DAY;
    await step("setPlayKey first", () => predict.connect(A).setPlayKey(keyA.address, exp));
    await step("setPlayKey renew (same key)", () => predict.connect(A).setPlayKey(keyA.address, exp + 60));
    await step("setPlayKey first [B]", () => predict.connect(B).setPlayKey(keyB.address, exp));
    await refuse("setPlayKey with another player's key", () => predict.connect(C).setPlayKey.staticCall(keyA.address, exp), "PlayKeyTaken");
    await refuse("setPlayKey by an unregistered address", () => predict.connect(keyA).setPlayKey.staticCall(keyB.address, exp), "NotRegistered");

    // days: createDay works before the open, or late while at least 1 hour of the day remains, never for a past day
    const t = await now();
    const today = Math.floor(t / DAY);
    const mkDay = (d, tag) => Array.from({ length: 5 }, (_, s) => ({
      closesAt: (d + 1) * DAY, resolvesAt: (d + 1) * DAY + 3600, contentHash: hash(`cojam-e2e ${tag} day ${d} slot ${s}`),
    }));
    await refuse("createDay for a past day", () => predict.createDay.staticCall(today - 1, mkDay(today - 1, "past")), "BadTimes");
    rec.days = rec.days || [];
    const lateOk = (today + 1) * DAY - t > 3600 + 300; // keep 5 minutes of margin over the 1 hour rule
    const toCreate = lateOk ? [today, today + 1, today + 2] : [today + 1, today + 2];
    if (!lateOk) log("  less than 65 minutes of today remain: today is not created");
    for (const d of toCreate) {
      const tag = d === today ? "late, day already open" : "before the open";
      if ((await predict.markets(d * 5)).closesAt === 0n) await step(`createDay ${tag} [${d}]`, () => predict.createDay(d, mkDay(d, "e2e")));
      if (!rec.days.includes(d)) rec.days.push(d);
    }
    await refuse("createDay twice", () => predict.createDay.staticCall(today + 1, mkDay(today + 1, "e2e")), "DayExists");
    await refuse("predict on a day not created", () => predict.connect(keyA).predict.staticCall((today + 3) * 5, 1), "DayNotOpen");
    await refuse("predict before the day opens", () => predict.connect(keyA).predict.staticCall((today + 1) * 5, 1), "DayNotOpen");
    await refuse("convert by a new account", () => predict.connect(A).convert.staticCall(1000), "AccountTooNew");

    // freeze and unfreeze (operator), pause and unpause (pauser, then owner)
    await step("setFrozen true", () => predict.setFrozen(C.address, true, ethers.encodeBytes32String("e2e test")));
    await refuse("setPlayKey while frozen", () => predict.connect(C).setPlayKey.staticCall(derive("playKeyC").address, exp), "Frozen");
    await step("setFrozen false", () => predict.setFrozen(C.address, false, ethers.ZeroHash));
    await step("predict pause", () => predict.pause());
    await refuse("predict while paused", () => predict.connect(keyA).predict.staticCall((today + 1) * 5, 1), "EnforcedPause");
    await refuse("convert while paused", () => predict.connect(A).convert.staticCall(1000), "EnforcedPause");
    await step("predict unpause", () => predict.unpause());

    // reserve withdrawal to the treasury (owner)
    await step("predict withdrawReserve 1,000 CT", () => predict.withdrawReserve(1000n * CT1, op.address));
    await refuse("withdrawReserve to a non treasury", () => predict.withdrawReserve.staticCall(1n, A.address), "NotTreasury");

    // parameters (owner, 48 h delay). Off by default: the API and PWA read params() from this contract. With
    // E2E_TEST_PARAMS=1 the conversion rate drops to 100 points per CT, the minimum to 100 and the account age to 1 day
    // so test points can be converted inside the week; recorded under `testParams` in the E2E file.
    if ((process.env.E2E_TEST_PARAMS === "1" || !live) && (await predict.pendingParams())[1] === 0n && (await predict.params()).pointsPerCT !== 100n) {
      const cur = await predict.params();
      const next = { ...cur.toObject(true), pointsPerCT: 100, minConvertPoints: 100, minAccountAge: DAY };
      next.splitBps = [...cur.splitBps];
      const g = await step("proposeParams", () => predict.proposeParams(next));
      rec.testParams = { contract: await predict.getAddress(), proposedTx: g.tx, applyAfter: new Date(Number((await predict.pendingParams())[1]) * 1000).toISOString(),
        change: { pointsPerCT: [Number(cur.pointsPerCT), 100], minConvertPoints: [Number(cur.minConvertPoints), 100], minAccountAge: [Number(cur.minAccountAge), DAY] },
        note: "TEST ONLY on Kairos. Undo with cancelParams() before it is applied." };
      await refuse("applyParams before 48 h", () => predict.applyParams.staticCall(), "TooEarly");
    }
    done({ days: rec.days });
  }

  // ================= staking =================
  if (!rec.phases.staking || !rec.phases.staking.done) {
    begin("staking");
    if ((await ct.balanceOf(A.address)) < 12_000n * CT1) await step("CT transfer 20,000 to player A", () => ct.transfer(A.address, 20_000n * CT1));
    // staking on the short lock TEST instance (2 s days: lock 0 is 60 s)
    const sl = shortLock.connect(A);
    const shortAddr = await shortLock.getAddress(), mainAddr = await staking.getAddress();
    await step("shortLock setMinimums (owner, minClaim 0 for the test)", () => shortLock.setMinimums(100n * CT1, 0));
    await step("CT approve (staking)", () => ct.connect(A).approve(shortAddr, ethers.MaxUint256));
    await step("shortLock pause", () => shortLock.pause());
    await refuse("stake while paused", () => sl.stake.staticCall(10_000n * CT1, 0), "EnforcedPause");
    await step("shortLock unpause", () => shortLock.unpause());
    await refuse("stake below the minimum", () => sl.stake.staticCall(99n * CT1, 0), "BelowMinStake");
    const id = Number(await shortLock.positionCount(A.address));
    await step("stake (a user's first position) [shortLock 10,000 CT 30 d]", () => sl.stake(10_000n * CT1, 0));
    await step("stake (a later position) [shortLock 1,000 CT 30 d]", () => sl.stake(1_000n * CT1, 0));
    const pos = await shortLock.positionOf(A.address, id);
    await refuse("withdraw before the lock ends", () => sl.withdraw.staticCall(id), "LockNotEnded");
    if (!live) await travel(Number(pos.end) - 30); else await sleep(6000);
    await step("claimInterest while locked [shortLock]", () => sl.claimInterest(id));
    const waitEnd = async () => { while ((await now()) < Number(pos.end) + 1) { if (!(await travel(Number(pos.end) + 1))) await sleep(4000); } };
    await waitEnd();
    await step("claimInterest after the lock [shortLock]", () => sl.claimInterest(id));
    await step("withdraw [shortLock]", () => sl.withdraw(id));
    await step("withdraw (no claim before) [shortLock]", () => sl.withdraw(id + 1));
    await refuse("withdraw twice", () => sl.withdraw.staticCall(id), "PositionClosed");
    const shortRes = await shortLock.positionOf(A.address, id);
    phase.shortLockPosition = { id, principalCt: ethers.formatUnits(shortRes.principal, 18), interestPaidCt: ethers.formatUnits(shortRes.claimed, 18), aprBps: Number(shortRes.aprBps), lockSeconds: Number(shortRes.end - shortRes.start) };

    // main staking (real 30 day lock): one stake, claim below minimum refused
    await step("CT approve (main staking)", () => ct.connect(A).approve(mainAddr, ethers.MaxUint256));
    const mid = Number(await staking.positionCount(A.address));
    await step("stake (a user's first position) [main 1,000 CT 30 d]", () => staking.connect(A).stake(1_000n * CT1, 0));
    await refuse("claimInterest below minClaim (main)", () => staking.connect(A).claimInterest.staticCall(mid), live ? "BelowMinClaim" : ["BelowMinClaim", "NothingToClaim"]);
    phase.mainStakingPosition = { id: mid, unlocksAt: new Date(Number((await staking.positionOf(A.address, mid)).end) * 1000).toISOString() };

    // reward withdrawals (owner, to the treasury)
    await step("withdrawRewards 1,000 CT [shortLock]", () => shortLock.withdrawRewards(1000n * CT1, op.address));
    await step("withdrawRewards 1,000 CT [main]", () => staking.withdrawRewards(1000n * CT1, op.address));
    await refuse("withdrawRewards to a non treasury", () => staking.withdrawRewards.staticCall(1n, A.address), "NotTreasury");
    done();
  }

  // ================= play =================
  const days = rec.days;
  if (!rec.phases.play || !rec.phases.play.done) {
    let t = await now();
    if (!live) await travel(days[0] * DAY + 120), (t = await now());
    const d = days.find((x) => t >= x * DAY && t < (x + 1) * DAY - 600);
    if (d === undefined) {
      const next = days.find((x) => x * DAY > t);
      log(`\nplay: no created day is open now; next opens ${next ? new Date(next * DAY * 1000).toISOString() : "(none: re-run setup)"}`);
      return finish(rec, save);
    }
    begin("play");
    phase.dayId = d;
    rec.playDay = d;
    for (const [w, k] of [[keyA, "0.5"], [keyB, "0.5"], [C, "0.5"]]) await topUp(w, k);
    const choicesA = [1, 1, 2, 2, 1], choicesB = [1, 2, 1, 2, 1], choicesC = [2, 2, 2, 2, 2];
    for (let s = 0; s < 5; s++) {
      const tag = s === 0 ? "first of the day" : s < 4 ? "second to fourth" : "fifth, first completed day, no inviter";
      if (((await predict.userDays(A.address, d)).choices >> BigInt(s * 2)) % 4n === 0n) await step(`predict by play key, ${tag} [A]`, () => predict.connect(keyA).predict(d * 5 + s, choicesA[s]));
    }
    for (let s = 0; s < 5; s++) {
      const tag = s === 0 ? "first of the day" : s < 4 ? "second to fourth" : "fifth, invited, first completed day (bonus and welcome)";
      if (((await predict.userDays(B.address, d)).choices >> BigInt(s * 2)) % 4n === 0n) await step(`predict by play key, ${tag} [B]`, () => predict.connect(keyB).predict(d * 5 + s, choicesB[s]));
    }
    for (let s = 0; s < 5; s++) {
      const tag = s < 4 ? "by wallet" : "by wallet, fifth, late code (bonus and welcome)";
      if (((await predict.userDays(C.address, d)).choices >> BigInt(s * 2)) % 4n === 0n) await step(`predict ${tag} [C]`, () => predict.connect(C).predict(d * 5 + s, choicesC[s]));
    }
    await refuse("predict the same market twice", () => predict.connect(keyA).predict.staticCall(d * 5, 1), "AlreadyPredicted");
    await step("revokePlayKey (by the player)", () => predict.connect(B).revokePlayKey());
    await refuse("predict by a revoked key", () => predict.connect(keyB).predict.staticCall((d + 1) * 5, 1), "NotRegistered");
    phase.points = { A: await pts(A.address), B: await pts(B.address), C: await pts(C.address) };
    log("  points after the day:", JSON.stringify(phase.points), "(A: 100 completion + 10% of B and C completion and welcome rules)");
    done();
  }

  // ================= resolve =================
  const d = rec.playDay;
  if (!rec.phases.resolve || !rec.phases.resolve.done) {
    const at = (d + 1) * DAY + 3600;
    if ((await now()) < at && !(await travel(at))) { log(`\nresolve: opens ${new Date(at * 1000).toISOString()}`); return finish(rec, save); }
    begin("resolve");
    const outcomes = [1, 2, 1, 1, 3]; // slot 4 is voided through setOutcome(3)
    for (let s = 0; s < 5; s++) if ((await predict.markets(d * 5 + s)).outcome === 0n) await step(`setOutcome [slot ${s}]`, () => predict.setOutcome(d * 5 + s, outcomes[s]));
    await step("correctOutcome (inside the window)", () => predict.correctOutcome(d * 5 + 3, 2));
    await refuse("setOutcome twice", () => predict.setOutcome.staticCall(d * 5, 2), "AlreadyResolved");
    await refuse("settle before settlesAt", () => predict.settle.staticCall(A.address, d), "NotReadyToSettle");
    phase.finalOutcomes = [1, 2, 1, 2, 3];
    done();
  }

  // ================= settle =================
  if (!rec.phases.settle || !rec.phases.settle.done) {
    let at = 0;
    for (let s = 0; s < 5; s++) at = Math.max(at, Number((await predict.markets(d * 5 + s)).settlesAt));
    if ((await now()) < at && !(await travel(at))) { log(`\nsettle: opens ${new Date(at * 1000).toISOString()}`); return finish(rec, save); }
    begin("settle");
    const before = { A: await pts(A.address), B: await pts(B.address), C: await pts(C.address) };
    await step("settleMany 3 users", () => predict.settleMany([A.address, B.address, C.address], d));
    await refuse("settle twice", () => predict.settle.staticCall(A.address, d), "AlreadySettled");
    const after = { A: await pts(A.address), B: await pts(B.address), C: await pts(C.address) };
    phase.points = { before, after };
    log("  points before / after settle:", JSON.stringify(phase.points));
    done();
  }

  // ================= params =================
  if (!rec.phases.params || !rec.phases.params.done) {
    const [, applyAfter] = await predict.pendingParams();
    if (applyAfter !== 0n) {
      const at = Number(applyAfter);
      if ((await now()) < at && !(await travel(at))) { log(`\nparams: applyParams opens ${new Date(at * 1000).toISOString()}`); return finish(rec, save); }
      begin("params");
      await step("applyParams", () => predict.applyParams());
    } else begin("params");
    const q = await predict.params();
    phase.applied = { pointsPerCT: Number(q.pointsPerCT), minConvertPoints: Number(q.minConvertPoints), minAccountAge: Number(q.minAccountAge) };
    done();
  }

  // ================= airdrop =================
  if (!rec.phases.airdrop || !rec.phases.airdrop.done) {
    const w = Number(await predict.weekOf(d));
    const p = await predict.params();
    const at = Number(await predict.weekEnd(w)) + Number(p.airdropDelay);
    if ((await now()) < at && !(await travel(at))) { log(`\nairdrop: opens ${new Date(at * 1000).toISOString()} (week ${w})`); return finish(rec, save); }
    begin("airdrop");
    const players = [A, B, C].map((x) => x.address);
    const scores = await Promise.all(players.map(async (a) => ({ a, s: await predict.weekPoints(w, a) })));
    const ranked = scores.filter((x) => x.s.points > 0n).sort((x, y) => {
      if (x.s.points !== y.s.points) return x.s.points > y.s.points ? -1 : 1;
      const lx = x.s.lastCompletionAt === 0n ? 2n ** 64n : x.s.lastCompletionAt, ly = y.s.lastCompletionAt === 0n ? 2n ** 64n : y.s.lastCompletionAt;
      if (lx !== ly) return lx < ly ? -1 : 1;
      return BigInt(x.a) < BigInt(y.a) ? -1 : 1;
    }).map((x) => x.a);
    await step(`airdrop ${ranked.length} winners, pool 100 CT`, () => predict.airdrop(w, ranked, 100n * CT1));
    await refuse("airdrop twice", () => predict.airdrop.staticCall(w, ranked, 0), "AirdropDone");
    phase.week = w; phase.winners = ranked;
    done();
  }

  // ================= convert =================
  if (!rec.phases.convert || !rec.phases.convert.done) {
    const p = await predict.params();
    const at = Number((await predict.players(A.address)).registeredAt) + Number(p.minAccountAge);
    if ((await now()) < at && !(await travel(at))) { log(`\nconvert: opens ${new Date(at * 1000).toISOString()}`); return finish(rec, save); }
    const rate = p.pointsPerCT, amount = ((p.minConvertPoints + rate - 1n) / rate) * rate;
    const bal = await predict.balanceOf(A.address);
    if (bal < amount) { log(`\nconvert: player A holds ${bal} points, needs ${amount} (pointsPerCT ${rate}); re-run after more days are played`); return finish(rec, save); }
    begin("convert");
    await refuse("convert not a multiple of the rate", () => predict.connect(A).convert.staticCall(amount + rate / 2n), "NotMultipleOfRate");
    const ctBefore = await ct.balanceOf(A.address);
    await step(`convert ${amount} points`, () => predict.connect(A).convert(amount));
    phase.ctReceived = ethers.formatUnits((await ct.balanceOf(A.address)) - ctBefore, 18);
    done();
  }
  return finish(rec, save);
}

function finish(rec, save) {
  const order = ["setup", "staking", "play", "resolve", "settle", "params", "airdrop", "convert"];
  rec.status = Object.fromEntries(order.map((k) => [k, rec.phases[k] && rec.phases[k].done ? "done" : "pending"]));
  rec.updatedAt = new Date().toISOString();
  save();
  console.log("\nphases:", JSON.stringify(rec.status));
  if (rec.network === "hardhat") {
    console.log("gas per call (hardhat):");
    for (const [k, v] of Object.entries(rec.gas)) console.log(`  ${k.padEnd(60)} ${v.join(" / ")}`);
  }
}

main().catch((e) => { console.error(process.env.DEBUG_E2E ? e : e.shortMessage || e.message || e); process.exitCode = 1; });
