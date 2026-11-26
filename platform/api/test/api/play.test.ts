import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { currentDayId, weekOf } from "../../../shared/src/time.ts";
import { auth, buildTestApp, registeredUser, seedDay, type TestKit } from "./helpers.ts";

let k: TestKit;
let day: number;
beforeAll(async () => {
  k = await buildTestApp();
  day = currentDayId(k.clock.now);
  await seedDay(k.db, day);
  await seedDay(k.db, day - 1);
});
afterAll(async () => k.close());

describe("GET /v1/today", () => {
  test("five markets in three languages, with chain, index and pending picks", async () => {
    const u = await registeredUser(k, "t1");
    await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: day * 5, day_id: day, choice: 2, tx_hash: "0xa", block: 1 }).execute();
    await k.db
      .insertInto("sponsored_txs")
      .values({ sender_tx_hash: "0xs1", sender: u.wallet, wallet: u.wallet, action: "predict", market_id: day * 5 + 1, choice: 1, status: "broadcast", tx_hash: "0xt1" })
      .execute();
    k.chain.days.set(`${u.wallet}:${day}`, { answered: 2, choices: [2, 0, 1, 0, 0], completed: false, settledMask: 0, hits: 0 });
    const r = await k.app.inject({ method: "GET", url: "/v1/today", headers: auth(u) });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b).toMatchObject({ dayId: day, published: true, weekId: weekOf(day), answered: 2 });
    expect(b.endsAt - b.opensAt).toBe(86400);
    expect(b.markets).toHaveLength(5);
    expect(Object.keys(b.markets[0].text)).toEqual(["en", "ko", "ja"]);
    expect(b.markets[0].myChoice).toBe(2);
    expect(b.markets[1]).toMatchObject({ myChoice: null, pendingChoice: 1 });
    expect(b.markets[2].myChoice).toBe(1); // from the live chain read
    expect(b.markets[0].imageUrl).toBe(`https://img.cojam.app/q/${day}-0.webp`);
    expect(b.markets[0].thumbUrl).toBe(`https://img.cojam.app/q/${day}-0.thumb.webp`);
    // Every market of the day closes at the day's end.
    expect(new Set(b.markets.map((m: any) => m.closesAt))).toEqual(new Set([b.endsAt]));
  });
  test("a day not published yet", async () => {
    const u = await registeredUser(k, "t2");
    k.clock.now += 86400_000;
    const r = await k.app.inject({ method: "GET", url: "/v1/today", headers: auth(u) });
    k.clock.now -= 86400_000;
    expect(r.json()).toMatchObject({ published: false, markets: [] });
  });
});

describe("GET /v1/results and /v1/markets/:id", () => {
  test("past day with a hit pending, a credited hit, a miss and the invite bonus line", async () => {
    const u = await registeredUser(k, "r1");
    const d = day - 1;
    // Outcomes: slot 0 resolved A and settled, slot 1 resolved B not settled yet, slot 2 void, rest open.
    const settles = new Date(k.clock.now + 3600_000);
    await k.db.updateTable("markets").set({ status: "resolved", outcome: 1, settles_at: new Date(k.clock.now - 1000), resolved_at: new Date() }).where("market_id", "=", d * 5).execute();
    await k.db.updateTable("markets").set({ status: "resolved", outcome: 2, settles_at: settles, resolved_at: new Date() }).where("market_id", "=", d * 5 + 1).execute();
    await k.db.updateTable("markets").set({ status: "voided", outcome: 3 }).where("market_id", "=", d * 5 + 2).execute();
    for (let s = 0; s < 5; s++) {
      await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: d * 5 + s, day_id: d, choice: s === 3 ? 2 : s === 0 ? 1 : 2, tx_hash: `0x${s}`, block: s }).execute();
    }
    await k.db.insertInto("user_days").values({ wallet: u.wallet, day_id: d, answered: 5, completed: true, settled_mask: 1, hits: 1, completion_points: 100, hit_points: 50 }).execute();
    await k.db
      .insertInto("points_ledger")
      .values([
        { wallet: u.wallet, kind: "completion", amount: 100, day_id: d, week_id: weekOf(d), ranked: true, tx_hash: "0xc", log_index: 0 },
        { wallet: u.wallet, kind: "hits", amount: 50, day_id: d, week_id: weekOf(d), ranked: true, tx_hash: "0xh", log_index: 0 },
        { wallet: u.wallet, kind: "referral", amount: 10, day_id: d, week_id: weekOf(d), ranked: false, tx_hash: "0xr", log_index: 0 },
      ])
      .execute();
    const r = await k.app.inject({ method: "GET", url: "/v1/results", headers: auth(u) });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    const past = b.days.find((x: any) => x.dayId === d);
    expect(past).toMatchObject({ completionPoints: 100, hitPointsCredited: 50, hitPointsPending: 50, inviteBonus: 10 });
    expect(past.rows.map((x: any) => x.result)).toEqual(["hit", "hit", "void", "pending", "pending"]);
    expect(past.rows[0].hitState).toBe("credited");
    expect(past.rows[1]).toMatchObject({ hitState: "pending", landsAt: Math.floor(settles.getTime() / 1000) });
    expect(b.summary.pendingPoints).toBe(50);
    expect(b.summary.allTime.points).toBe(150); // the invite bonus is not a ranked point
    const m = await k.app.inject({ method: "GET", url: `/v1/markets/${d * 5}`, headers: auth(u) });
    expect(m.json()).toMatchObject({ marketId: d * 5, outcome: 1, myChoice: 1, sources: [{ name: "Binance" }] });
    const none = await k.app.inject({ method: "GET", url: `/v1/markets/999999999`, headers: auth(u) });
    expect(none.statusCode).toBe(404);
  });
});

describe("GET /v1/ranking/week/:weekId", () => {
  test("ties go to the earlier last completion; accounts on hold leave the prize ranks", async () => {
    const w = weekOf(day);
    const a = await registeredUser(k, "k1");
    const b = await registeredUser(k, "k2");
    const c = await registeredUser(k, "k3", { frozen: true });
    const d = await registeredUser(k, "k4");
    const t = (h: number) => new Date(k.clock.now - h * 3600_000);
    await k.db
      .insertInto("week_totals")
      .values([
        { week_id: w, wallet: a.wallet, points: 300, last_completion_at: t(1) },
        { week_id: w, wallet: b.wallet, points: 300, last_completion_at: t(5) },
        { week_id: w, wallet: c.wallet, points: 900, last_completion_at: t(2) },
        { week_id: w, wallet: d.wallet, points: 100, last_completion_at: t(2) },
      ])
      .execute();
    const r = await k.app.inject({ method: "GET", url: "/v1/ranking/week/current", headers: auth(a) });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.top.map((x: any) => x.points)).toEqual([300, 300, 100]);
    expect(body.top[0].me).toBeUndefined();
    expect(body.top[1].me).toBe(true); // a completed later than b
    expect(body.me).toMatchObject({ rank: 2, points: 300, noPrize: false });
    expect(body.tieBreak).toBe("earlier_last_completion");
    expect(BigInt(body.top[0].prizeWei)).toBe((BigInt(body.poolWei) * 3000n) / 10000n);
    const held = await k.app.inject({ method: "GET", url: `/v1/ranking/week/${w}`, headers: auth(c) });
    expect(held.json().me).toMatchObject({ rank: null, points: 900, noPrize: true });
  });
});
