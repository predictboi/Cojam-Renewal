// Randomized sequence test of CojamPredict against a JavaScript model of the contract.
// Every step picks an action (register with random inviters, link inviters, freeze, unfreeze, play keys,
// predict through wallets and keys, outcomes, corrections, voids, settle, corrected outcomes, compensation,
// conversion, airdrop, parameter changes, time jumps), predicts from the model whether it must succeed,
// sends it, and then checks the invariants of DEV-PLAN 3.4 and 3.9 against the chain and the event log.
// FUZZ_RUNS (default 3) and FUZZ_STEPS (default 220) scale it; FUZZ_SEED fixes the first seed.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { H, DAY, E18, deployPredict, hash } = require("./predictHelpers");

const RUNS = Number(process.env.FUZZ_RUNS || 2);
const STEPS = Number(process.env.FUZZ_STEPS || 200);
const SEED = Number(process.env.FUZZ_SEED || 20261126);
const Z = ethers.ZeroAddress;
const DEADLINE = 48n * H;

function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}

const PRESETS = [
  { completionPoints: 100n, hitPoints: 50n, referralBps: 1000n, welcomePoints: 100n, settleDelay: 6n * H, airdropDelay: 60n * H },
  { completionPoints: 13n, hitPoints: 77n, referralBps: 333n, welcomePoints: 0n, settleDelay: 0n, airdropDelay: 48n * H },
  { completionPoints: 0n, hitPoints: 0n, referralBps: 2000n, welcomePoints: 1000n, settleDelay: 48n * H, airdropDelay: 7n * DAY },
  { completionPoints: 1000n, hitPoints: 50n, referralBps: 0n, welcomePoints: 100n, settleDelay: 2n * H, airdropDelay: 50n * H },
];

async function runOne(seed) {
  const r = rng(seed);
  const ctx = await deployPredict({ register: false, days: 0 });
  const { predict, op, master, treasury, ct } = ctx;
  const own = predict.connect(master);
  const iface = predict.interface;
  const named = [ctx.alice, ctx.bob, ctx.carol, ctx.dave, ctx.eve, ctx.stranger, ...ctx.rest.slice(0, 4)];
  const keySigners = [ctx.key1, ctx.key2, ctx.key3, ...ctx.rest.slice(4)];
  const all = [...named, ...keySigners];
  const byAddr = new Map(all.map((s) => [s.address, s]));

  // ---------------- model ----------------
  const M = {
    params: { ...PRESETS[0], pointsPerCT: 1000n, minConvertPoints: 1000n, userCap: 50n * E18, dayCap: 20000n * E18, minAge: 7n * DAY, pool: 10000n * E18, split: [3000n, 2000n, 1500n, 1000n, 700n, 500n, 400n, 300n, 300n, 300n] },
    pending: null,
    players: new Map(), // addr -> {registered, frozen, referrer, registeredAt, completedOnce}
    keyOf: new Map(), // player -> {key, exp}
    playerOfKey: new Map(), // key -> player
    markets: new Map(), // id -> {closesAt, resolvesAt, resolvedAt, settlesAt, outcome, corrected}
    days: new Map(), // `${addr}:${day}` -> {choices[5], answered, completed, settled, hits}
    bal: new Map(),
    supply: 0n,
    week: new Map(), // `${w}:${addr}` -> {points, last}
    refPoints: new Map(),
    refCount: new Map(),
    compensated: new Set(),
    convUser: new Map(),
    convDay: new Map(),
    airdropDone: new Set(),
    reserve: ctx.fund,
    finalOutcomes: new Map(), // id -> outcome, once final (invariant 5)
  };
  // event based tallies (checked against chain state, independent of the model)
  const ev = { weekCredited: new Map(), referral: new Map(), welcome: new Map(), completion: new Set() };
  const P = (a) => M.players.get(a) || { registered: false, frozen: false, referrer: Z, registeredAt: 0n, completedOnce: false };
  const UD = (a, d) => M.days.get(`${a}:${d}`) || { choices: [0, 0, 0, 0, 0], answered: 0, completed: false, settled: 0, hits: 0 };
  const add = (map, k, v) => map.set(k, (map.get(k) || 0n) + v);
  const weekOf = (d) => (d + 3n) / 7n;

  function mint(to, amt) { add(M.bal, to, amt); M.supply += amt; }
  function credit(player, amt, now, w) {
    mint(player, amt);
    const k = `${w}:${player}`;
    const s = M.week.get(k) || { points: 0n, last: 0n };
    M.week.set(k, { points: s.points + amt, last: now });
    const p = P(player);
    if (p.referrer === Z || p.frozen || M.params.referralBps === 0n) return;
    const rp = P(p.referrer);
    if (!rp.registered || rp.frozen) return;
    const bonus = (amt * M.params.referralBps) / 10000n;
    if (bonus === 0n) return;
    mint(p.referrer, bonus);
    add(M.refPoints, p.referrer, bonus);
  }

  // ---------------- tx helper ----------------
  let now = 0n;
  async function tick() { now = BigInt(await time.latest()) + 1n; await time.setNextBlockTimestamp(now); }
  async function send(ok, label, fn, apply) {
    await tick();
    let receipt;
    try {
      receipt = await (await fn()).wait();
    } catch (e) {
      if (ok) throw new Error(`seed ${seed}: ${label} reverted but the model expected success: ${e.message}`);
      return false;
    }
    if (!ok) throw new Error(`seed ${seed}: ${label} succeeded but the model expected a revert`);
    if (apply) apply();
    for (const log of receipt.logs) {
      let parsed;
      try { parsed = iface.parseLog(log); } catch { continue; }
      if (!parsed) continue;
      const a = parsed.args;
      if (parsed.name === "PointsCredited") {
        add(ev.weekCredited, a.weekId, a.amount);
        if (a.kind === 1n) {
          const k = `${a.user}:${a.dayId}`;
          expect(ev.completion.has(k), "completion twice").to.equal(false);
          ev.completion.add(k);
        }
      } else if (parsed.name === "ReferralPaid") {
        add(ev.referral, a.referrer, a.amount);
        expect(P(a.player).referrer).to.equal(a.referrer);
      } else if (parsed.name === "WelcomePaid") {
        expect(ev.welcome.has(a.player), "welcome twice").to.equal(false);
        ev.welcome.set(a.player, a.amount);
        expect(P(a.player).referrer).to.equal(a.referrer);
      } else if (parsed.name === "Transfer") {
        expect(a.from === Z || a.to === Z, "points moved between holders").to.equal(true);
      }
    }
    // invariant 2: within one tx, mints are explained by ranked credits, invite and welcome bonuses
    let mints = 0n, explained = 0n;
    for (const log of receipt.logs) {
      let parsed; try { parsed = iface.parseLog(log); } catch { continue; }
      if (!parsed) continue;
      if (parsed.name === "Transfer" && parsed.args.from === Z) mints += parsed.args.value;
      if (["PointsCredited", "ReferralPaid", "WelcomePaid"].includes(parsed.name)) explained += parsed.args.amount;
    }
    expect(mints).to.equal(explained);
    return true;
  }

  // ---------------- days ----------------
  async function ensureDays() {
    const today = (BigInt(await time.latest()) + 2n) / DAY;
    for (const d of [today + 1n, today + 2n]) {
      if (M.markets.has(d * 5n)) continue;
      const open = d * DAY;
      const inputs = [];
      for (let i = 0; i < 5; i++) {
        const closesAt = open + BigInt(1 + r.int(24 * 3600 - 1));
        let resolvesAt = closesAt + H + BigInt(r.int(20 * 3600));
        if (resolvesAt > open + 2n * DAY) resolvesAt = open + 2n * DAY;
        inputs.push({ closesAt, resolvesAt, contentHash: hash(`${seed}:${d}:${i}`) });
      }
      // createDay reads minResolveGap, which stays 1 h in this test
      await send(true, "createDay", () => op.createDay(d, inputs), () => {
        inputs.forEach((x, i) => M.markets.set(d * 5n + BigInt(i), { closesAt: x.closesAt, resolvesAt: x.resolvesAt, resolvedAt: 0n, settlesAt: 0n, outcome: 0, corrected: 0 }));
      });
    }
  }

  const playerAddrs = () => named.map((s) => s.address).filter((a) => P(a).registered);
  const anyMarket = (pred) => {
    const ids = [...M.markets.keys()].filter((id) => pred(id, M.markets.get(id)));
    return ids.length ? r.pick(ids) : null;
  };

  // ---------------- actions ----------------
  const actions = [
    [6, async function jump() {
      const big = r.chance(0.1);
      await time.increase(big ? BigInt(DAY) + BigInt(r.int(Number(DAY))) : BigInt(r.int(6 * 3600) + 1));
    }],
    [5, async function register() {
      const w = r.chance(0.9) ? r.pick(named).address : r.pick(keySigners).address;
      const refCands = [Z, Z, ...playerAddrs(), r.pick(all).address, w];
      const ref = r.pick(refCands);
      const p = P(w);
      let ok = !p.registered && !M.playerOfKey.has(w);
      if (ok && ref !== Z) { const rp = P(ref); ok = ref !== w && rp.registered && !rp.frozen && rp.referrer !== w; }
      await send(ok, "registerPlayer", () => op.registerPlayer(w, ref), () => {
        M.players.set(w, { registered: true, frozen: false, referrer: ref, registeredAt: now, completedOnce: false });
        if (ref !== Z) add(M.refCount, ref, 1n);
      });
    }],
    [2, async function setReferrer() {
      const w = r.pick(named).address, ref = r.pick(all).address;
      const p = P(w), rp = P(ref);
      const ok = p.registered && p.referrer === Z && !p.completedOnce && ref !== w && rp.registered && !rp.frozen && rp.referrer !== w;
      await send(ok, "setReferrer", () => op.setReferrer(w, ref), () => { p.referrer = ref; add(M.refCount, ref, 1n); });
    }],
    [2, async function freeze() {
      const w = r.pick(named).address, f = r.chance(0.6);
      const p = P(w);
      await send(p.registered, "setFrozen", () => op.setFrozen(w, f, ethers.ZeroHash), () => { p.frozen = f; });
    }],
    [3, async function setKey() {
      const caller = r.pick(named), key = r.chance(0.85) ? r.pick(keySigners).address : r.pick(all).address;
      const ttl = r.chance(0.05) ? 91n * DAY : BigInt(r.int(10 * 86400) + 1);
      await tick();
      const exp = now + ttl;
      const p = P(caller.address);
      const bound = M.playerOfKey.get(key);
      const ok = p.registered && !p.frozen && key !== caller.address && !P(key).registered && (!bound || bound === caller.address) && exp <= now + 90n * DAY;
      now -= 1n; // send() ticks again
      await time.setNextBlockTimestamp(now + 1n);
      const exp2 = exp; // computed against the same block time
      await send(ok, "setPlayKey", () => predict.connect(caller).setPlayKey(key, exp2), () => {
        const old = M.keyOf.get(caller.address);
        if (old && old.key !== key) M.playerOfKey.delete(old.key);
        M.keyOf.set(caller.address, { key, exp: exp2 });
        M.playerOfKey.set(key, caller.address);
      });
    }],
    [1, async function revoke() {
      const s = r.pick(all);
      let player = M.playerOfKey.get(s.address), key;
      if (player) key = s.address; else { player = s.address; key = M.keyOf.get(player)?.key; }
      await send(!!key, "revokePlayKey", () => predict.connect(s).revokePlayKey(), () => { M.keyOf.delete(player); M.playerOfKey.delete(key); });
    }],
    [12, async function predictOne() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const today = t / DAY;
      const day = r.chance(0.9) ? today : today + BigInt(r.int(3)) - 1n;
      const id = day * 5n + BigInt(r.int(5));
      // mostly a useful pick: an active player, an open unanswered market of today, through the wallet or a bound key
      let sender, idPick = id;
      const active = named.filter((x) => P(x.address).registered && !P(x.address).frozen);
      if (r.chance(0.8) && active.length) {
        const pl = r.pick(active);
        const ud0 = UD(pl.address, today);
        const open = [0, 1, 2, 3, 4].filter((i) => ud0.choices[i] === 0 && (M.markets.get(today * 5n + BigInt(i))?.closesAt ?? 0n) > t);
        if (open.length) idPick = today * 5n + BigInt(r.pick(open));
        const k = M.keyOf.get(pl.address);
        sender = k && r.chance(0.6) ? byAddr.get(k.key) : pl;
      } else if (r.chance(0.4) && M.playerOfKey.size) sender = byAddr.get(r.pick([...M.playerOfKey.keys()]));
      else sender = r.chance(0.9) ? r.pick(named) : r.pick(all);
      const choice = r.chance(0.97) ? 1 + r.int(2) : r.pick([0, 3]);
      let player = sender.address, ok = true;
      const boundTo = M.playerOfKey.get(sender.address);
      if (boundTo) { const k = M.keyOf.get(boundTo); if (!k || k.key !== sender.address || t >= k.exp) ok = false; player = boundTo; }
      const p = P(player);
      const pid = idPick, pday = pid / 5n;
      const m = M.markets.get(pid);
      const slot = Number(pid % 5n);
      const ud = UD(player, pday);
      ok = ok && p.registered && !p.frozen && (choice === 1 || choice === 2) && !!m && t >= pday * DAY && t < m.closesAt && ud.choices[slot] === 0;
      await send(ok, "predict", () => predict.connect(sender).predict(pid, choice), () => {
        ud.choices[slot] = choice; ud.answered += 1;
        M.days.set(`${player}:${pday}`, ud);
        if (ud.answered === 5) {
          ud.completed = true;
          if (M.params.completionPoints > 0n) credit(player, M.params.completionPoints, now, weekOf(pday));
          if (!p.completedOnce) {
            p.completedOnce = true;
            const rp = P(p.referrer);
            if (p.referrer !== Z && M.params.welcomePoints > 0n && rp.registered && !rp.frozen) mint(player, M.params.welcomePoints);
          }
        }
      });
    }],
    [4, async function setOutcome() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const id = anyMarket((i, m) => m.outcome === 0 && t >= m.resolvesAt) ?? anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const o = r.chance(0.95) ? 1 + r.int(3) : 0;
      const ok = o >= 1 && o <= 3 && m.outcome === 0 && t >= m.resolvesAt && t < (id / 5n + 1n) * DAY + DEADLINE;
      await send(ok, "setOutcome", () => op.setOutcome(id, o), () => { m.outcome = o; m.resolvedAt = now; m.settlesAt = now + M.params.settleDelay; });
    }],
    [1, async function correct() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const id = anyMarket((i, m) => m.outcome !== 0 && t < m.settlesAt) ?? anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const o = 1 + r.int(3);
      const ok = m.outcome !== 0 && t < m.settlesAt && o !== m.outcome;
      await send(ok, "correctOutcome", () => op.correctOutcome(id, o), () => { m.outcome = o; });
    }],
    [1, async function voidIt() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const id = anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const ok = m.outcome !== 3 && (m.outcome === 0 || t < m.settlesAt);
      await send(ok, "voidMarket", () => op.voidMarket(id, ethers.ZeroHash), () => { m.outcome = 3; if (m.resolvedAt === 0n) m.resolvedAt = now; m.settlesAt = now; });
    }],
    [2, async function voidExp() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const id = anyMarket((i, m) => m.outcome === 0 && t >= (i / 5n + 1n) * DAY + DEADLINE) ?? anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const ok = m.outcome === 0 && t >= (id / 5n + 1n) * DAY + DEADLINE;
      await send(ok, "voidExpired", () => predict.connect(ctx.stranger).voidExpired(id), () => { m.outcome = 3; m.resolvedAt = now; m.settlesAt = now; });
    }],
    [6, async function settleSome() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const today = t / DAY;
      const day = today - BigInt(r.int(4));
      const users = Array.from({ length: 1 + r.int(4) }, () => r.pick(named).address);
      const plan = (u) => {
        const ud = UD(u, day);
        let answered = 0, todo = 0, hits = 0;
        for (let i = 0; i < 5; i++) if (ud.choices[i]) answered |= 1 << i;
        const open = answered & ~ud.settled;
        if (answered !== 0 && open === 0) return { status: 2 };
        for (let i = 0; i < 5; i++) {
          const m = M.markets.get(day * 5n + BigInt(i));
          if ((open >> i) & 1 && m && m.outcome !== 0 && t >= m.settlesAt) { todo |= 1 << i; if (ud.choices[i] === m.outcome) hits++; }
        }
        return todo === 0 ? { status: 1 } : { status: 0, todo, hits, ud };
      };
      const applyFor = (u) => {
        const x = plan(u);
        if (x.status !== 0) return 0;
        x.ud.settled |= x.todo; x.ud.hits += x.hits;
        M.days.set(`${u}:${day}`, x.ud);
        const pts = BigInt(x.hits) * M.params.hitPoints;
        if (pts > 0n) credit(u, pts, now, weekOf(day));
        return 1;
      };
      if (users.length === 1 && r.chance(0.5)) {
        const ok = plan(users[0]).status === 0;
        await send(ok, "settle", () => predict.settle(users[0], day), () => applyFor(users[0]));
      } else {
        // dry run on a copy is not needed: statuses are evaluated in order, as the contract does
        const snapshot = JSON.stringify([...M.days.entries()]);
        const restore = () => { M.days = new Map(JSON.parse(snapshot)); };
        let count = 0;
        const balSnap = new Map(M.bal), weekSnap = new Map([...M.week].map(([k, v]) => [k, { ...v }])), refSnap = new Map(M.refPoints), sup = M.supply;
        for (const u of users) count += applyFor(u);
        restore(); M.bal = balSnap; M.week = weekSnap; M.refPoints = refSnap; M.supply = sup;
        await send(count > 0, "settleMany", () => predict.settleMany(users, day), () => { for (const u of users) applyFor(u); });
      }
    }],
    [1, async function setCorrected() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const id = anyMarket((i, m) => m.outcome !== 0 && t >= m.settlesAt && m.corrected === 0) ?? anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const o = 1 + r.int(2);
      const ok = m.outcome !== 0 && t >= m.settlesAt && m.corrected === 0 && m.outcome !== o;
      await send(ok, "setCorrectedOutcome", () => own.setCorrectedOutcome(id, o), () => { m.corrected = o; });
    }],
    [2, async function compensate() {
      const id = anyMarket((i, m) => m.corrected !== 0) ?? anyMarket(() => true);
      if (id === null) return;
      const m = M.markets.get(id);
      const users = Array.from({ length: 1 + r.int(5) }, () => r.pick(named).address);
      const day = id / 5n, slot = Number(id % 5n);
      const elig = (u, seen) => {
        const ud = UD(u, day);
        return ((ud.settled >> slot) & 1) === 1 && ud.choices[slot] === m.corrected && !M.compensated.has(`${id}:${u}`) && !seen.has(u);
      };
      const seen = new Set();
      let count = 0;
      for (const u of users) if (m.corrected !== 0 && elig(u, seen)) { seen.add(u); count++; }
      await send(m.corrected !== 0 && count > 0, "compensate", () => op.compensate(id, users), () => {
        const s2 = new Set();
        for (const u of users) {
          if (!elig(u, s2)) continue;
          s2.add(u); M.compensated.add(`${id}:${u}`);
          if (M.params.hitPoints > 0n) credit(u, M.params.hitPoints, now, weekOf(day));
        }
      });
    }],
    [4, async function convert() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const s = r.pick(named);
      const p = P(s.address);
      const bal = M.bal.get(s.address) || 0n;
      let pts = r.chance(0.8) ? (bal / 1000n) * 1000n : BigInt(r.int(5000));
      if (pts > 60000n && r.chance(0.7)) pts = 50000n;
      const ctAmt = (pts * E18) / M.params.pointsPerCT;
      const day = t / DAY;
      const uKey = `${s.address}:${day}`;
      const ok = p.registered && !p.frozen && pts >= M.params.minConvertPoints && pts % M.params.pointsPerCT === 0n && t >= p.registeredAt + M.params.minAge &&
        bal >= pts && (M.convUser.get(uKey) || 0n) + ctAmt <= M.params.userCap && (M.convDay.get(day) || 0n) + ctAmt <= M.params.dayCap && M.reserve >= ctAmt;
      await send(ok, "convert", () => predict.connect(s).convert(pts), () => {
        M.bal.set(s.address, bal - pts); M.supply -= pts; add(M.convUser, uKey, ctAmt); add(M.convDay, day, ctAmt); M.reserve -= ctAmt;
      });
    }],
    [2, async function airdrop() {
      await tick(); now -= 1n; await time.setNextBlockTimestamp(now + 1n);
      const t = now + 1n;
      const w = weekOf(t / DAY) - 1n - BigInt(r.int(2));
      const scores = named.map((s) => s.address)
        .map((a) => ({ a, s: M.week.get(`${w}:${a}`) || { points: 0n, last: 0n } }))
        .filter((x) => x.s.points > 0n && P(x.a).registered && !P(x.a).frozen)
        .sort((x, y) => (x.s.points !== y.s.points ? (x.s.points > y.s.points ? -1 : 1) : x.s.last !== y.s.last ? (x.s.last < y.s.last ? -1 : 1) : BigInt(x.a) < BigInt(y.a) ? -1 : 1));
      let winners = scores.slice(0, 10).map((x) => x.a);
      let ordered = true;
      if (winners.length >= 2 && r.chance(0.2)) { [winners[0], winners[1]] = [winners[1], winners[0]]; ordered = false; }
      const pool = r.chance(0.1) ? M.params.pool + 1n : BigInt(r.int(2000)) * E18;
      const amounts = winners.map((_, i) => (pool * M.params.split[i]) / 10000n);
      const total = amounts.reduce((x, y) => x + y, 0n);
      const ok = t >= (w * 7n + 4n) * DAY + M.params.airdropDelay && !M.airdropDone.has(w) && winners.length > 0 && ordered && pool <= M.params.pool && M.reserve >= total;
      await send(ok, "airdrop", () => op.airdrop(w, winners, pool), () => { M.airdropDone.add(w); M.reserve -= total; });
    }],
    [1, async function params() {
      if (M.pending && r.chance(0.7)) {
        const ok = BigInt(await time.latest()) + 1n >= M.pending.after;
        await send(ok, "applyParams", () => own.applyParams(), () => { Object.assign(M.params, M.pending.p); M.pending = null; });
        return;
      }
      const preset = r.pick(PRESETS);
      const full = { ...preset, pointsPerCT: 1000n, minConvertPoints: 1000n, maxConvertCtPerUserPerDay: 50n, maxConvertCtPerDay: 20000n, minAccountAge: 7n * DAY, minResolveGap: H, maxWeeklyPool: 10000n, treasury: treasury.address, splitBps: M.params.split };
      await send(true, "proposeParams", () => own.proposeParams(full), () => { M.pending = { p: { ...preset }, after: now + 48n * H }; });
    }],
  ];
  const total = actions.reduce((x, [w]) => x + w, 0);
  const choose = () => { let k = r.int(total); for (const [w, f] of actions) { if (k < w) return f; k -= w; } return actions[0][1]; };

  // ---------------- invariants ----------------
  async function check(step) {
    const tag = `seed ${seed} step ${step}`;
    let sum = 0n;
    for (const s of all) {
      const b = await predict.balanceOf(s.address);
      expect(b, `${tag} balance`).to.equal(M.bal.get(s.address) || 0n);
      sum += b;
      const k = await predict.playKeyOf(s.address);
      if (k.key !== Z) expect(await predict.playerOfKey(k.key), `${tag} key back link`).to.equal(s.address);
      const pl = await predict.playerOfKey(s.address);
      if (pl !== Z) expect((await predict.playKeyOf(pl)).key, `${tag} player link`).to.equal(s.address);
      expect(pl !== Z && (await predict.players(s.address)).registered, `${tag} a key is a player`).to.equal(false);
      const rs = await predict.referralStats(s.address);
      expect(rs.points, `${tag} referral points`).to.equal(M.refPoints.get(s.address) || 0n);
      expect(rs.points, `${tag} referral events`).to.equal(ev.referral.get(s.address) || 0n);
      expect(rs.count, `${tag} referral count`).to.equal(M.refCount.get(s.address) || 0n);
      const p = await predict.players(s.address);
      const mp = P(s.address);
      expect([p.registered, p.frozen, p.referrer, p.completedOnce], `${tag} player`).to.deep.equal([mp.registered, mp.frozen, mp.referrer, mp.completedOnce]);
      if (ev.welcome.has(s.address)) expect(mp.referrer).to.not.equal(Z);
    }
    expect(await predict.totalSupply(), `${tag} supply`).to.equal(M.supply); // invariant 1
    expect(sum, `${tag} sum of balances`).to.equal(M.supply);
    expect(await ct.balanceOf(ctx.addr), `${tag} reserve`).to.equal(M.reserve); // invariant 6
    // invariant 11: weekPoints of a week equal the PointsCredited of that week
    const t = BigInt(await time.latest());
    const cw = weekOf(t / DAY);
    for (const w of [cw - 1n, cw]) {
      let ws = 0n;
      for (const s of named) {
        const x = await predict.weekPoints(w, s.address);
        const mx = M.week.get(`${w}:${s.address}`) || { points: 0n, last: 0n };
        expect([x.points, x.lastCreditAt], `${tag} weekPoints`).to.deep.equal([mx.points, mx.last]);
        ws += x.points;
      }
      expect(ws, `${tag} week sum`).to.equal(ev.weekCredited.get(w) || 0n);
    }
    // user days and markets near now; invariant 5 (a final outcome never changes)
    const today = t / DAY;
    for (let d = today - 2n; d <= today; d++) {
      for (const s of named) {
        const u = await predict.userDays(s.address, d);
        const mu = UD(s.address, d);
        let choices = 0; mu.choices.forEach((c, i) => { choices |= c << (2 * i); });
        expect([Number(u.answered), Number(u.choices), u.completed, Number(u.settledMask), Number(u.hits)], `${tag} day`).to.deep.equal([mu.answered, choices, mu.completed, mu.settled, mu.hits]);
      }
      for (let i = 0n; i < 5n; i++) {
        const id = d * 5n + i;
        const mm = M.markets.get(id);
        if (!mm) continue;
        const m = await predict.markets(id);
        expect([m.outcome, m.resolvedAt, m.settlesAt, m.correctedOutcome], `${tag} market`).to.deep.equal([BigInt(mm.outcome), mm.resolvedAt, mm.settlesAt, BigInt(mm.corrected)]);
        if (mm.outcome !== 0) {
          expect(mm.resolvedAt === 0n || mm.outcome === 3 || mm.resolvedAt >= mm.resolvesAt, `${tag} set before resolvesAt`).to.equal(true);
          if (t >= mm.settlesAt) {
            if (M.finalOutcomes.has(id)) expect(mm.outcome, `${tag} final outcome changed`).to.equal(M.finalOutcomes.get(id));
            else M.finalOutcomes.set(id, mm.outcome);
          }
        }
      }
    }
  }

  await ensureDays();
  // a starting population so that most steps do something
  for (const s of named.slice(0, 6)) {
    const refs = playerAddrs();
    const ref = refs.length && r.chance(0.6) ? r.pick(refs) : Z;
    await send(true, "seed register", () => op.registerPlayer(s.address, ref), () => {
      M.players.set(s.address, { registered: true, frozen: false, referrer: ref, registeredAt: now, completedOnce: false });
      if (ref !== Z) add(M.refCount, ref, 1n);
    });
  }
  const counts = {};
  for (let step = 0; step < STEPS; step++) {
    await ensureDays();
    const f = choose();
    counts[f.name] = (counts[f.name] || 0) + 1;
    await f();
    await check(step);
  }
  return { counts, supply: M.supply, credits: ev.completion.size };
}

describe("CojamPredict: randomized sequences against a model (invariants 1 to 13)", function () {
  this.timeout(0);
  for (let i = 0; i < RUNS; i++) {
    it(`seed ${SEED + i}: ${STEPS} random steps keep every invariant`, async function () {
      const res = await runOne(SEED + i);
      if (process.env.FUZZ_VERBOSE) console.log(res);
      expect(res.supply).to.be.greaterThan(0n);
      expect(res.credits).to.be.greaterThan(0);
    });
  }
});
