// Fields the PWA needs (added after the first API build): config extras, the Results badge, the inviter name on
// /v1/today, resolve times and invite friends on /v1/results, last week's prize, pending hit landing, conversion
// pause, paid out on closed stakes, and the dev stub chain's JSON-RPC.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { encodeFunctionData, decodeFunctionResult, type Address } from "viem";
import { currentDayId, weekOf } from "../../../shared/src/time.ts";
import { setState, STATE_KEYS } from "../../src/db/index.ts";
import { createDevStubChain } from "../../src/chain/devStub.ts";
import { cojamPredictAbi } from "../../src/chain/abi.ts";
import { devSet, outcomeDayIsWeekend } from "../../../shared/src/devQuestions.ts";
import { dayEnd } from "../../../shared/src/time.ts";
import { auth, buildTestApp, registeredUser, seedDay, type TestKit } from "./helpers.ts";

let k: TestKit;
let day: number;
beforeAll(async () => {
  k = await buildTestApp({ env: { KRW_PER_CT: "200", USER_TX_FEE_KAIA: "0.004" } });
  day = currentDayId(k.clock.now);
  await seedDay(k.db, day);
  await seedDay(k.db, day - 1);
});
afterAll(async () => k.close());

describe("GET /v1/config extras", () => {
  test("rpc, explorer, KRW, fee estimate, providers, staking limits; maintenance from app_state", async () => {
    let b = (await k.app.inject({ method: "GET", url: "/v1/config" })).json();
    expect(b.rpcUrl).toBe("https://public-en-kairos.node.kaia.io");
    expect(b.explorerUrl).toBe("https://kairos.kaiascan.io");
    expect(b.krwPerCt).toBe(200);
    expect(b.userTxFeeWei).toBe("4000000000000000");
    expect(b.maintenance).toEqual({ on: false, message: null, backAt: null });
    expect(b.emailProviders).toContainEqual({ domain: "gmail.com", name: "Gmail" });
    expect(b.stakingLimits).toEqual({ maxOpenPositions: 20, maxUserPrincipalWei: (1_000_000n * 10n ** 18n).toString(), maxTotalPrincipalWei: (1_850_000n * 10n ** 18n).toString(), paused: false });
    await setState(k.db, STATE_KEYS.maintenance, { on: true, message: { en: "Upgrading", ko: "점검 중입니다" }, backAt: "2026-11-27T01:00:00Z" });
    b = (await k.app.inject({ method: "GET", url: "/v1/config" })).json();
    expect(b.maintenance).toEqual({ on: true, message: { en: "Upgrading", ko: "점검 중입니다" }, backAt: Date.parse("2026-11-27T01:00:00Z") / 1000 });
    // the admin switch's shape (POST /admin/v1/app): a plain message and endsAt
    await setState(k.db, STATE_KEYS.maintenance, { on: true, message: "Cojam is being updated.", endsAt: "2026-11-27T02:00:00Z", since: 1, by: "ops" });
    b = (await k.app.inject({ method: "GET", url: "/v1/config" })).json();
    expect(b.maintenance).toEqual({ on: true, message: { en: "Cojam is being updated.", ko: "Cojam is being updated.", ja: "Cojam is being updated." }, backAt: Date.parse("2026-11-27T02:00:00Z") / 1000 });
    await setState(k.db, STATE_KEYS.maintenance, { on: false });
    expect((await k.app.inject({ method: "GET", url: "/v1/config" })).json().maintenance.on).toBe(false);
  });
  test("maintenance falls back to the env when app_state has no row", async () => {
    const k2 = await buildTestApp({ env: { MAINTENANCE: "1", MAINTENANCE_MESSAGE: "Back soon", MAINTENANCE_BACK_AT: "1795800000" } });
    try {
      const b = (await k2.app.inject({ method: "GET", url: "/v1/config" })).json();
      expect(b.maintenance).toEqual({ on: true, message: { en: "Back soon", ko: "Back soon", ja: "Back soon" }, backAt: 1795800000 });
    } finally {
      await k2.close();
    }
  });
});

describe("Results badge", () => {
  test("newResults counts answers set since Results was last opened; PATCH resultsSeen resets it", async () => {
    const u = await registeredUser(k, "badge1");
    const d = day - 1;
    for (let s = 0; s < 3; s++) await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: d * 5 + s, day_id: d, choice: 1, tx_hash: `0xb${s}`, block: s }).execute();
    await k.db.updateTable("markets").set({ status: "resolved", outcome: 1, resolved_at: new Date(k.clock.now - 3600_000) }).where("market_id", "in", [d * 5, d * 5 + 1]).execute();
    let me = (await k.app.inject({ method: "GET", url: "/v1/me", headers: auth(u) })).json();
    expect(me).toMatchObject({ newResults: 2, resultsSeenAt: null });
    const p = await k.app.inject({ method: "PATCH", url: "/v1/me", headers: auth(u), payload: { resultsSeen: true } });
    expect(p.statusCode).toBe(200);
    expect(p.json()).toMatchObject({ newResults: 0, resultsSeenAt: Math.floor(k.clock.now / 1000) });
    k.clock.now += 1000;
    await k.db.updateTable("markets").set({ status: "resolved", outcome: 2, resolved_at: new Date(k.clock.now) }).where("market_id", "=", d * 5 + 2).execute();
    me = (await k.app.inject({ method: "GET", url: "/v1/me", headers: auth(u) })).json();
    expect(me.newResults).toBe(1);
    expect((await k.app.inject({ method: "PATCH", url: "/v1/me", headers: auth(u), payload: { resultsSeen: false } })).statusCode).toBe(400);
  });
});

describe("today, results, ranking, wallet and positions extras", () => {
  test("inviterName on /v1/today", async () => {
    const inviter = await registeredUser(k, "inv1");
    await k.db.updateTable("users").set({ display_name: "dalgona" }).where("wallet", "=", inviter.wallet).execute();
    const u = await registeredUser(k, "inv2");
    expect((await k.app.inject({ method: "GET", url: "/v1/today", headers: auth(u) })).json().inviterName).toBeNull();
    await k.db.insertInto("referrals").values({ invitee: u.wallet, inviter: inviter.wallet, source: "first_run" }).execute();
    expect((await k.app.inject({ method: "GET", url: "/v1/today", headers: auth(u) })).json().inviterName).toBe("da****a");
  });

  test("resolvesAt per row, evidence of the deciding run, friends behind the invite bonus", async () => {
    const u = await registeredUser(k, "res1");
    const d = day - 1;
    await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: d * 5, day_id: d, choice: 1, tx_hash: "0xr0", block: 1 }).execute();
    await k.db.insertInto("user_days").values({ wallet: u.wallet, day_id: d, answered: 1 }).execute();
    await k.db.updateTable("markets").set({ status: "resolved", outcome: 1, resolved_at: new Date(k.clock.now - 60_000) }).where("market_id", "=", d * 5).execute();
    const run = await k.db.insertInto("resolutions").values({ market_id: d * 5, run: "1", outcome: "A" }).returning("id").executeTakeFirstOrThrow();
    await k.db.insertInto("evidence").values({ resolution_id: run.id, url: "https://example.com/close", quote: "close 101,000" }).execute();
    const f1 = "0x00000000000000000000000000000000000000f1", f2 = "0x00000000000000000000000000000000000000f2";
    await k.db
      .insertInto("points_ledger")
      .values([
        { wallet: u.wallet, kind: "referral", amount: 10, day_id: d, week_id: weekOf(d), ranked: false, source_wallet: f1, tx_hash: "0xq1", log_index: 0 },
        { wallet: u.wallet, kind: "referral", amount: 5, day_id: d, week_id: weekOf(d), ranked: false, source_wallet: f2, tx_hash: "0xq2", log_index: 0 },
        { wallet: u.wallet, kind: "referral", amount: 5, day_id: d, week_id: weekOf(d), ranked: false, source_wallet: f2, tx_hash: "0xq3", log_index: 0 },
      ])
      .execute();
    const b = (await k.app.inject({ method: "GET", url: "/v1/results", headers: auth(u) })).json();
    const past = b.days.find((x: any) => x.dayId === d);
    expect(past).toMatchObject({ inviteBonus: 20, inviteFriends: 2 });
    expect(past.rows[0].resolvesAt).toBe((d + 1) * 86400 + 3600);
    expect(past.rows[0].evidenceUrl).toBe("https://example.com/close");
    expect(past.rows[1].evidenceUrl).toBe("https://www.binance.com"); // no run yet: the primary source
  });

  test("last week's prize and the airdrop transaction", async () => {
    const u = await registeredUser(k, "rk1");
    const w = weekOf(day);
    await k.db.insertInto("weeks").values({ week_id: w - 1, status: "airdropped", airdrop_tx: "0xweekly" }).execute();
    await k.db
      .insertInto("airdrop_rows")
      .values([
        { week_id: w - 1, rank: 1, wallet: "0x00000000000000000000000000000000000000aa", points: 900, amount: "300000000000000000000", tx_hash: "0xdrop" },
        { week_id: w - 1, rank: 4, wallet: u.wallet, points: 700, amount: "119600000000000000000", tx_hash: "0xdrop" },
      ])
      .execute();
    const cur = (await k.app.inject({ method: "GET", url: "/v1/ranking/week/current", headers: auth(u) })).json();
    expect(cur.lastWeek).toEqual({ weekId: w - 1, rank: 4, prizeWei: "119600000000000000000", txHash: "0xdrop" });
    expect(cur.airdropTx).toBeNull();
    const last = (await k.app.inject({ method: "GET", url: `/v1/ranking/week/${w - 1}`, headers: auth(u) })).json();
    expect(last.airdropTx).toBe("0xdrop");
    expect(last.status).toBe("airdropped");
  });

  test("pendingHitLandsAt, conversion paused, paidWei on closed stakes", async () => {
    const u = await registeredUser(k, "w1", { registeredAgoSec: 30 * 86400 });
    k.chain.balances.points.set(u.wallet, 5000n);
    k.chain.pending.set(`${u.wallet}:${day - 1}`, { points: 50n, landsAt: 1795800000 });
    k.chain.pending.set(`${u.wallet}:${day - 2}`, { points: 100n, landsAt: 1795700000 });
    let w = (await k.app.inject({ method: "GET", url: "/v1/wallet", headers: auth(u) })).json();
    expect(w).toMatchObject({ pendingHitPoints: 150, pendingHitLandsAt: 1795700000 });
    expect(w.conversion).toMatchObject({ paused: false, maxPointsNow: 5000 });
    k.chain.paused = true;
    w = (await k.app.inject({ method: "GET", url: "/v1/wallet", headers: auth(u) })).json();
    k.chain.paused = false;
    expect(w.conversion).toMatchObject({ paused: true, maxPointsNow: 0 });
    const CT = 10n ** 18n;
    k.chain.positions.set(u.wallet, [
      { id: 0, principal: 100n * CT, maxInterest: 5n * CT, claimed: 3n * CT, claimable: 0n, start: 1, end: 2, aprBps: 800, lockIndex: 0, closed: true },
      { id: 1, principal: 200n * CT, maxInterest: 5n * CT, claimed: 0n, claimable: 1n * CT, start: 1, end: 9_999_999_999, aprBps: 800, lockIndex: 0, closed: false },
    ]);
    const p = (await k.app.inject({ method: "GET", url: "/v1/staking/positions", headers: auth(u) })).json();
    expect(p.positions[0].paidWei).toBe((103n * CT).toString());
    expect(p.positions[1].paidWei).toBeNull();
  });
});

describe("dev stub chain JSON-RPC (DEV_CHAIN=stub)", () => {
  test("nonces from accepted sponsored transactions, dayOf and playKeyOf by eth_call, receipts after a restart", async () => {
    const stub = createDevStubChain(k.db);
    const u = await registeredUser(k, "rpc1");
    expect(await stub.rpc("eth_getTransactionCount", [u.wallet, "pending"])).toBe("0x0");
    await k.db.insertInto("sponsored_txs").values({ sender_tx_hash: "0xst1", sender: u.wallet, wallet: u.wallet, action: "predict", nonce: 4, status: "mined", tx_hash: "0xmined1" }).execute();
    expect(await stub.rpc("eth_getTransactionCount", [u.wallet, "pending"])).toBe("0x5");
    await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: day * 5 + 2, day_id: day, choice: 2, tx_hash: "0xp", block: 1 }).execute();
    const data = encodeFunctionData({ abi: cojamPredictAbi, functionName: "dayOf", args: [u.wallet as Address, day] });
    const out = (await stub.rpc("eth_call", [{ to: "0x0", data }, "latest"])) as `0x${string}`;
    const r = decodeFunctionResult({ abi: cojamPredictAbi, functionName: "dayOf", data: out }) as unknown as [number, number[]];
    expect([...r[1]]).toEqual([0, 0, 2, 0, 0]);
    const pk = encodeFunctionData({ abi: cojamPredictAbi, functionName: "playKeyOf", args: [u.wallet as Address] });
    const kout = (await stub.rpc("eth_call", [{ to: "0x0", data: pk }, "latest"])) as `0x${string}`;
    expect((decodeFunctionResult({ abi: cojamPredictAbi, functionName: "playKeyOf", data: kout }) as unknown as [string])[0]).toMatch(/^0x0{40}$/);
    expect(await stub.rpc("kaia_getTransactionReceipt", ["0xmined1"])).toMatchObject({ status: "0x1" });
    expect(await stub.rpc("kaia_getTransactionReceipt", ["0xunknown"])).toBeNull();
  });
  test("POST /dev/rpc exists only with DEV_CHAIN=stub and serves reads only", async () => {
    expect((await k.app.inject({ method: "POST", url: "/dev/rpc", payload: { id: 1, method: "eth_chainId" } })).statusCode).toBe(404);
    const k2 = await buildTestApp({ env: { DEV_CHAIN: "stub" } });
    try {
      const send = await k2.app.inject({ method: "POST", url: "/dev/rpc", payload: { jsonrpc: "2.0", id: 2, method: "kaia_sendRawTransaction", params: ["0x"] } });
      expect(send.json().error.code).toBe(-32601);
      const cfg = (await k2.app.inject({ method: "GET", url: "/v1/config", headers: { host: "localhost:8080" } })).json();
      expect(cfg.rpcUrl).toBe("http://localhost:8080/dev/rpc");
    } finally {
      await k2.close();
    }
  });
});

describe("dev question sets", () => {
  test("every dev question resolves after the day's end, in three languages; weekend outcome days drop market questions", () => {
    for (let d = day - 7; d <= day + 7; d++) {
      for (const which of ["today", "yesterday", "earlier"] as const) {
        const set = devSet(which, d);
        expect(set).toHaveLength(5);
        for (const q of set) {
          expect(q.resolveAfterMin).toBeGreaterThan(0);
          expect(dayEnd(d) + q.resolveAfterMin * 60).toBeGreaterThan(dayEnd(d));
          for (const l of ["en", "ko", "ja"] as const) expect(q.text[l].title.length).toBeGreaterThan(5);
          // Each asks about the day after the set (its outcome falls after the close).
          expect(q.text.en.title).toMatch(/tomorrow/i);
          expect(q.text.ko.title).toMatch(/내일/);
          expect(q.text.ja.title).toMatch(/明日/);
        }
        if (outcomeDayIsWeekend(d)) expect(set.some((q) => q.category === "markets")).toBe(false);
      }
    }
  });
});
