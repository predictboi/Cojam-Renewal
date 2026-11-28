// Data room: the split and its minimums, frozen accounts left out, top players, closed days only on the public
// route, the crowd record, the split on result rows only after the player's own pick, the admin link and settings.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { currentDayId } from "../../../shared/src/time.ts";
import { DATA_MIN_PLAYERS } from "../../../shared/src/dataRoom.ts";
import { crowdRightOf, toSplit } from "../../src/dataRoom/split.ts";
import { auth, buildTestApp, registeredUser, seedDay, type TestKit, type TestUser } from "./helpers.ts";

const w = (tag: number, i: number) => `0x${(tag * 100_000 + i).toString(16).padStart(40, "0")}`;
let k: TestKit;
let day: number;
let d1: number;
let owner: TestUser, operator: TestUser, viewer: TestUser;
let player: TestUser, other: TestUser;
let tx = 0;

async function pick(wallet: string, marketId: number, choice: 1 | 2) {
  await k.db.insertInto("predictions").values({ wallet, market_id: marketId, day_id: Math.floor(marketId / 5), choice, tx_hash: `0x${(tx++).toString(16)}`, block: tx }).execute();
}
async function picks(tag: number, from: number, to: number, marketId: number, choice: 1 | 2) {
  for (let i = from; i < to; i++) await pick(w(tag, i), marketId, choice);
}
async function frozenUser(wallet: string) {
  await k.db.insertInto("users").values({ privy_user_id: `did:privy:frozen-${wallet}`, wallet, frozen: true, registration: "registered" }).execute();
}
async function resolve(marketId: number, outcome: 1 | 2 | 3) {
  await k.db.updateTable("markets").set({ status: outcome === 3 ? "voided" : "resolved", outcome, resolved_at: new Date() }).where("market_id", "=", marketId).execute();
}

beforeAll(async () => {
  k = await buildTestApp();
  day = currentDayId(k.clock.now);
  d1 = day - 1;
  owner = k.addUser("own", "founder@gmail.com");
  operator = k.addUser("op", "ops@gmail.com");
  viewer = k.addUser("view", "cs@gmail.com");
  await k.db
    .insertInto("admin_users")
    .values([
      { privy_user_id: "email:founder@gmail.com", email: "founder@gmail.com", role: "owner", added_by: "test" },
      { privy_user_id: "email:ops@gmail.com", email: "ops@gmail.com", role: "operator", added_by: "test" },
      { privy_user_id: "email:cs@gmail.com", email: "cs@gmail.com", role: "viewer", added_by: "test" },
    ])
    .execute();
  for (let d = day - 5; d <= day; d++) await seedDay(k.db, d);
  await seedDay(k.db, day + 1, "scheduled");

  // History (days day-5 .. day-2, 20 questions, all answered B): 50 players h0..h49, h0..h9 always right, the rest
  // always wrong, so the top fifth is exactly h0..h9. Frozen f0 is always right but must not count.
  await frozenUser(w(9, 0));
  for (let d = day - 5; d <= day - 2; d++) {
    for (let s = 0; s < 5; s++) {
      const id = d * 5 + s;
      await resolve(id, 2);
      await picks(1, 0, 10, id, 2);
      await picks(1, 10, 50, id, 1);
      await pick(w(9, 0), id, 2);
    }
  }
  // Day d1 (closed). Slot 0: 50 players, 30 on B (60%), top players 8 of 10 on B (80%), 5 frozen on B left out.
  const m0 = d1 * 5;
  await picks(1, 0, 8, m0, 2);
  await picks(1, 8, 10, m0, 1);
  await picks(1, 10, 32, m0, 2);
  await picks(1, 32, 50, m0, 1);
  for (let i = 0; i < 5; i++) {
    if (i > 0) await frozenUser(w(9, i));
    await pick(w(9, i), m0, 2);
  }
  await resolve(m0, 2); // the larger share was right
  // Slot 1: 29 players, below the minimum.
  await picks(2, 0, 29, m0 + 1, 2);
  await resolve(m0 + 1, 2);
  // Slot 2: exactly 30 players with no history (no top players), 20 on B, answer A: the larger share was wrong.
  await picks(3, 0, 20, m0 + 2, 2);
  await picks(3, 20, 30, m0 + 2, 1);
  await resolve(m0 + 2, 1);
  // Slot 3: 30 players split 15 to 15, answer B: an even split has no crowd verdict.
  await picks(4, 0, 15, m0 + 3, 2);
  await picks(4, 15, 30, m0 + 3, 1);
  await resolve(m0 + 3, 2);
  // Slot 4: no answer yet, with an outside price.
  await picks(5, 0, 40, m0 + 4, 1);
  await k.db
    .insertInto("market_outside")
    .values({ market_id: m0 + 4, source: "polymarket", url: "https://polymarket.com/event/x/y", market_slug: "y", right_outcome: "Yes", right_price: 41, taken_at: new Date((d1 + 1) * 86400_000 + 60_000), attempted_at: new Date(), linked_by: "ops@gmail.com" })
    .execute();

  // Today (open): 35 picks on slot 0.
  await picks(6, 0, 35, day * 5, 2);
  player = await registeredUser(k, "dr1");
  other = await registeredUser(k, "dr2");
  // The player picked today's slot 0 and day d1 slot 0; the other player only picked today's slot 1.
  await pick(player.wallet, day * 5, 1);
  await pick(player.wallet, m0, 2);
  await pick(other.wallet, day * 5 + 1, 2);
  await k.db.insertInto("user_days").values([
    { wallet: player.wallet, day_id: day, answered: 1 },
    { wallet: player.wallet, day_id: d1, answered: 1 },
    { wallet: other.wallet, day_id: day, answered: 1 },
  ]).execute();
});
afterAll(async () => k.close());

describe("split rules", () => {
  test("whole percents, minimum players and minimum top players", () => {
    expect(toSplit({ players: 40, right: 25, topPlayers: 10, topRight: 7 }, 30)).toEqual({ players: 40, rightShare: 63, topRightShare: 70 });
    expect(toSplit({ players: 29, right: 29, topPlayers: 12, topRight: 12 }, 30)).toEqual({ players: 29, rightShare: null, topRightShare: null });
    expect(toSplit({ players: 30, right: 10, topPlayers: 9, topRight: 9 }, 30)).toEqual({ players: 30, rightShare: 33, topRightShare: null });
    expect(toSplit({ players: 0, right: 0, topPlayers: 0, topRight: 0 }, 0).rightShare).toBeNull();
    expect(DATA_MIN_PLAYERS).toBe(30);
  });
  test("crowd verdict", () => {
    expect(crowdRightOf({ players: 40, right: 30 }, 2, 30)).toBe(true);
    expect(crowdRightOf({ players: 40, right: 30 }, 1, 30)).toBe(false);
    expect(crowdRightOf({ players: 40, right: 20 }, 2, 30)).toBeNull();
    expect(crowdRightOf({ players: 40, right: 30 }, null, 30)).toBeNull();
    expect(crowdRightOf({ players: 20, right: 15 }, 2, 30)).toBeNull();
  });
});

describe("GET /public/data", () => {
  test("no sign in, closed days only, newest first, splits and minimums, frozen accounts left out", async () => {
    const r = await k.app.inject({ method: "GET", url: "/public/data" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toContain("max-age=60");
    const b = r.json();
    expect(b.days.map((d: any) => d.dayId)).toEqual([d1, day - 2, day - 3, day - 4, day - 5]);
    expect(b.days.some((d: any) => d.dayId === day)).toBe(false);
    expect(b.nextCursor).toBeNull();
    const d = b.days[0];
    expect(d.closedAt).toBe((d1 + 1) * 86400);
    expect(d.markets).toHaveLength(5);
    const [s0, s1, s2, s3, s4] = d.markets;
    expect(s0).toMatchObject({ marketId: String(d1 * 5), slot: 0, category: "crypto", outcome: 2, crowdRight: true });
    expect(s0.text.en).toEqual({ title: "Q1 title", a: "No", b: "Yes" });
    // 50 history players plus the signed in player below (on B); the 5 frozen accounts are left out.
    expect(s0.split).toEqual({ players: 51, rightShare: 61, topRightShare: 80 });
    expect(s0.outside).toBeUndefined();
    expect(s1.split).toEqual({ players: 29, rightShare: null, topRightShare: null });
    expect(s1.crowdRight).toBeNull();
    expect(s2.split).toEqual({ players: 30, rightShare: 67, topRightShare: null });
    expect(s2).toMatchObject({ outcome: 1, crowdRight: false });
    expect(s3).toMatchObject({ outcome: 2, crowdRight: null, split: { players: 30, rightShare: 50 } });
    expect(s4).toMatchObject({ outcome: null, crowdRight: null, split: { players: 40, rightShare: 0 } });
    expect(s4.outside).toEqual({ source: "polymarket", url: "https://polymarket.com/event/x/y", rightPrice: 41, takenAt: (d1 + 1) * 86400 + 60 });
  });

  test("the crowd record counts answered questions that met the minimum (no even splits)", async () => {
    const b = (await k.app.inject({ method: "GET", url: "/public/data" })).json();
    // 20 history questions (the larger share, 40 of 50, was wrong), d1 slot 0 right, d1 slot 2 wrong.
    expect(b.crowd).toEqual({ questions: 22, rightPercent: Math.round(100 / 22) });
  });

  test("cursor pages to older days; a cursor in the future never shows the open day", async () => {
    const b = (await k.app.inject({ method: "GET", url: `/public/data?cursor=${day - 2}` })).json();
    expect(b.days.map((d: any) => d.dayId)).toEqual([day - 3, day - 4, day - 5]);
    const f = (await k.app.inject({ method: "GET", url: `/public/data?cursor=${day + 5}` })).json();
    expect(f.days[0].dayId).toBe(d1);
    expect((await k.app.inject({ method: "GET", url: "/public/data?cursor=abc" })).statusCode).toBe(400);
    expect((await k.app.inject({ method: "GET", url: "/v1/public/data" })).statusCode).toBe(200);
  });

  test("the top players are measured on earlier days only", async () => {
    // Day day-2's slot 0: history before it is 15 questions per player, under 20, so no top players.
    const b = (await k.app.inject({ method: "GET", url: "/public/data" })).json();
    const m = b.days.find((d: any) => d.dayId === day - 2).markets[0];
    expect(m.split).toEqual({ players: 50, rightShare: 20, topRightShare: null });
  });
});

describe("GET /v1/results split", () => {
  test("live split on today's picked row, final split on a closed picked row, nothing on unpicked rows", async () => {
    const r = await k.app.inject({ method: "GET", url: "/v1/results", headers: auth(player) });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    const t = b.days.find((d: any) => d.dayId === day);
    expect(t.rows[0].myChoice).toBe(1);
    // 35 others on B plus the player on A.
    expect(t.rows[0].split).toEqual({ players: 36, rightShare: 97, topRightShare: null });
    for (const row of t.rows.slice(1)) expect(row.split).toBeUndefined();
    const y = b.days.find((d: any) => d.dayId === d1);
    expect(y.rows[0].split).toEqual({ players: 51, rightShare: 61, topRightShare: 80 });
    for (const row of y.rows.slice(1)) expect(row.split).toBeUndefined();
  });
  test("a player who has not picked a question of the open day never gets its split", async () => {
    const b = (await k.app.inject({ method: "GET", url: "/v1/results", headers: auth(other) })).json();
    const t = b.days.find((d: any) => d.dayId === day);
    expect(t.rows[0].myChoice).toBeNull();
    expect(t.rows[0].split).toBeUndefined();
    expect(t.rows[1].split).toMatchObject({ players: 1, rightShare: null });
  });
});

describe("admin: data room settings and outside links", () => {
  test("minimum players is an owner parameter, audited", async () => {
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/data-room", headers: auth(viewer) })).json()).toMatchObject({ minPlayers: 30, defaultMinPlayers: 30 });
    const denied = await k.app.inject({ method: "POST", url: "/admin/v1/data-room", headers: auth(operator), payload: { minPlayers: 20, reason: "test" } });
    expect(denied.statusCode).toBe(403);
    const ok = await k.app.inject({ method: "POST", url: "/admin/v1/data-room", headers: auth(owner), payload: { minPlayers: 25, reason: "launch week" } });
    expect(ok.json()).toEqual({ minPlayers: 25 });
    const b = (await k.app.inject({ method: "GET", url: "/public/data" })).json();
    expect(b.days[0].markets[1].split.rightShare).toBe(100); // 29 players now meet the minimum
    const a = await k.db.selectFrom("audit_log").selectAll().where("action", "=", "data_room.settings").executeTakeFirstOrThrow();
    expect(a.actor).toBe("founder@gmail.com");
    await k.app.inject({ method: "POST", url: "/admin/v1/data-room", headers: auth(owner), payload: { minPlayers: 30, reason: "back to default" } });
  });

  test("an operator links, relinks and unlinks a Polymarket market; the read record is final", async () => {
    const id = (day + 1) * 5 + 2;
    const url = `/admin/v1/questions/${id}/outside`;
    expect((await k.app.inject({ method: "POST", url, headers: auth(viewer), payload: { source: "polymarket", url: "https://polymarket.com/market/btc-above-100k" } })).statusCode).toBe(403);
    const bad = await k.app.inject({ method: "POST", url, headers: auth(operator), payload: { source: "polymarket", url: "https://example.com/x" } });
    expect(bad.statusCode).toBe(400);
    const r = await k.app.inject({ method: "POST", url, headers: auth(operator), payload: { source: "polymarket", url: "https://polymarket.com/event/bitcoin-above-on-december-1/bitcoin-above-100k-on-december-1", rightOutcome: "Yes" } });
    expect(r.statusCode).toBe(200);
    expect(r.json().outside).toMatchObject({ marketSlug: "bitcoin-above-100k-on-december-1", rightOutcome: "Yes", rightPrice: null, linkedBy: "ops@gmail.com" });
    const re = await k.app.inject({ method: "POST", url, headers: auth(operator), payload: { source: "polymarket", url: "https://polymarket.com/market/btc-below-100k", rightOutcome: "No", reason: "asked the other way round" } });
    expect(re.json().outside).toMatchObject({ marketSlug: "btc-below-100k", rightOutcome: "No" });
    expect((await k.app.inject({ method: "GET", url, headers: auth(viewer) })).json().outside.url).toBe("https://polymarket.com/market/btc-below-100k");
    const audits = await k.db.selectFrom("audit_log").select("action").where("target", "=", String(id)).execute();
    expect(audits.map((a) => a.action)).toEqual(["question.outside.link", "question.outside.link"]);
    await k.db.updateTable("market_outside").set({ right_price: 55, taken_at: new Date() }).where("market_id", "=", id).execute();
    const locked = await k.app.inject({ method: "POST", url, headers: auth(operator), payload: { source: "polymarket", url: "https://polymarket.com/market/other" } });
    expect(locked.statusCode).toBe(409);
    expect((await k.app.inject({ method: "DELETE", url, headers: auth(operator) })).json()).toEqual({ marketId: id, outside: null });
    expect((await k.app.inject({ method: "DELETE", url, headers: auth(operator) })).statusCode).toBe(404);
  });
});

describe("rate limit", () => {
  test("the public route is limited per network", async () => {
    const k2 = await buildTestApp({ env: { PUBLIC_DATA_IP_PER_HOUR: "2" } });
    try {
      expect((await k2.app.inject({ method: "GET", url: "/public/data" })).statusCode).toBe(200);
      expect((await k2.app.inject({ method: "GET", url: "/public/data" })).statusCode).toBe(200);
      const r = await k2.app.inject({ method: "GET", url: "/public/data" });
      expect(r.statusCode).toBe(429);
      expect(r.json().error.code).toBe("RATE_LIMITED_IP");
      expect((await k2.app.inject({ method: "GET", url: "/public/data" })).json()).not.toHaveProperty("days");
    } finally {
      await k2.close();
    }
  });
});
