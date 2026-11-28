import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { decodeFunctionData } from "viem";
import { cojamPredictAbi } from "../../src/chain/abi.ts";
import { currentDayId } from "../../../shared/src/time.ts";
import { addresses as sharedAddresses } from "../../../shared/addresses/index.ts";
import { auth, buildTestApp, registeredUser, seedDay, type TestKit, type TestUser } from "./helpers.ts";

const SERVICE_TOKEN = "cjops_test_token_value_that_is_long_enough_123456";
let k: TestKit;
let owner: TestUser, operator: TestUser, viewer: TestUser;
let day: number;

beforeAll(async () => {
  k = await buildTestApp({ env: { ADMIN_SERVICE_TOKEN_SHA256: createHash("sha256").update(SERVICE_TOKEN).digest("hex"), ADMIN_SERVICE_PER_MINUTE: "50" } });
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
  day = currentDayId(k.clock.now);
  await seedDay(k.db, day);
  await seedDay(k.db, day + 1, "scheduled");
});
afterAll(async () => k.close());

const svc = { authorization: `Bearer ${SERVICE_TOKEN}` };
const err = (r: { json: () => any }) => r.json().error?.code;

describe("admin auth and roles", () => {
  test("allow list only; the first login binds the Privy id", async () => {
    const stranger = k.addUser("stranger", "x@gmail.com");
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: auth(stranger) })).statusCode).toBe(403);
    const me = await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: auth(owner) });
    expect(me.json()).toMatchObject({ email: "founder@gmail.com", role: "owner" });
    const row = await k.db.selectFrom("admin_users").select("privy_user_id").where("email", "=", "founder@gmail.com").executeTakeFirstOrThrow();
    expect(row.privy_user_id).toBe(owner.privyUserId);
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/me" })).statusCode).toBe(401);
  });
  test("viewer reads, cannot write; operator cannot build owner transactions", async () => {
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/dashboard", headers: auth(viewer) })).statusCode).toBe(200);
    const w = await k.app.inject({ method: "POST", url: `/admin/v1/questions/${(day + 1) * 5}/cancel`, headers: auth(viewer), payload: { reason: "test" } });
    expect(err(w)).toBe("ADMIN_FORBIDDEN");
    const p = await k.app.inject({ method: "POST", url: "/admin/v1/params", headers: auth(operator), payload: { action: "apply" } });
    expect(err(p)).toBe("ADMIN_FORBIDDEN");
  });
});

describe("operations agent service token", () => {
  test("authenticates as ops-agent with the operator role, never owner", async () => {
    const me = await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: svc });
    expect(me.json()).toEqual({ privyUserId: "ops-agent", email: "ops-agent", role: "operator" });
    const p = await k.app.inject({ method: "POST", url: "/admin/v1/params", headers: svc, payload: { action: "apply" } });
    expect(err(p)).toBe("ADMIN_FORBIDDEN");
    const wrong = await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: { authorization: `Bearer ${SERVICE_TOKEN}x` } });
    expect(wrong.statusCode).toBe(401);
  });
  test("overview in one call", async () => {
    const u = await registeredUser(k, "ov1");
    await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: day * 5, day_id: day, choice: 2, tx_hash: "0x1", block: 1 }).execute();
    const r = await k.app.inject({ method: "GET", url: "/admin/v1/overview", headers: svc });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.network).toBe("kairos");
    expect(b.today).toHaveLength(5);
    expect(b.today[0].picks).toEqual({ left: 0, right: 1, total: 1 });
    expect(b.alerts.some((a: any) => a.code === "DAY_INCOMPLETE")).toBe(true); // day + 2 has no questions
    expect(b).toHaveProperty("reserves.feePayerWei");
    expect(typeof b.reviewListCount).toBe("number");
  });
  test("writes are audited with actor ops-agent", async () => {
    const id = (day + 1) * 5 + 4;
    const r = await k.app.inject({ method: "POST", url: `/admin/v1/questions/${id}/cancel`, headers: svc, payload: { reason: "duplicate topic" } });
    expect(r.statusCode).toBe(200);
    const a = await k.db.selectFrom("audit_log").selectAll().where("action", "=", "question.cancel").where("target", "=", String(id)).executeTakeFirstOrThrow();
    expect(a.actor).toBe("ops-agent");
  });
  test("rate limited per minute", async () => {
    let last;
    for (let i = 0; i < 60; i++) last = await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: svc });
    expect(err(last!)).toBe("RATE_LIMITED_USER");
    k.clock.now += 60_000;
  });
});

describe("questions", () => {
  test("cancel and replace only before publish", async () => {
    const id = (day + 1) * 5;
    const rep = await k.app.inject({
      method: "POST",
      url: `/admin/v1/questions/${id}/replace`,
      headers: auth(operator),
      payload: {
        reason: "better wording",
        question: {
          category: "crypto",
          content: Object.fromEntries(["en", "ko", "ja"].map((l) => [l, { title: `New ${l}`, left: "No", right: "Yes", rule: "Rule", settle: "09:00" }])),
          resolvesAt: (day + 2) * 86400 + 3600,
          sources: [{ name: "Binance", url: "https://www.binance.com" }],
          criteria: "Close above",
        },
      },
    });
    expect(rep.statusCode).toBe(200);
    const m = await k.db.selectFrom("markets").selectAll().where("market_id", "=", id).executeTakeFirstOrThrow();
    expect((m.content as any).en.title).toBe("New en");
    expect(m.image_state).toBe("pending");
    const live = await k.app.inject({ method: "POST", url: `/admin/v1/questions/${day * 5}/cancel`, headers: auth(operator), payload: { reason: "too late" } });
    expect(err(live)).toBe("QUESTION_PUBLISHED");
    const list = await k.app.inject({ method: "GET", url: "/admin/v1/questions?status=all", headers: auth(viewer) });
    const q = list.json().questions.find((x: any) => x.marketId === id);
    expect(q.charCounts.en.title).toBe(6);
    expect(q.editable).toBe(true);
  });
  test("void a live question queues an operator request", async () => {
    const r = await k.app.inject({ method: "POST", url: `/admin/v1/questions/${day * 5 + 1}/void`, headers: auth(operator), payload: { reason: "event cancelled" } });
    expect(r.statusCode).toBe(200);
    const req = await k.db.selectFrom("operator_requests").selectAll().where("id", "=", r.json().requestId).executeTakeFirstOrThrow();
    expect(req).toMatchObject({ kind: "void_market", target: String(day * 5 + 1), status: "queued", requested_by: "ops@gmail.com" });
  });
});

describe("answers", () => {
  test("inside the window: correctOutcome through the worker", async () => {
    const id = day * 5 + 2;
    await k.db.updateTable("markets").set({ outcome: 1, status: "resolved", settles_at: new Date(k.clock.now + 3600_000) }).where("market_id", "=", id).execute();
    const r = await k.app.inject({ method: "POST", url: `/admin/v1/answers/${id}/correct`, headers: auth(operator), payload: { outcome: 2, reason: "source revised" } });
    expect(r.json()).toMatchObject({ path: "correctOutcome", status: "queued" });
  });
  test("after the window: unsigned setCorrectedOutcome for the owner plus a compensation request", async () => {
    const id = day * 5 + 3;
    await k.db.updateTable("markets").set({ outcome: 1, status: "resolved", settles_at: new Date(k.clock.now - 1000) }).where("market_id", "=", id).execute();
    const r = await k.app.inject({ method: "POST", url: `/admin/v1/answers/${id}/correct`, headers: auth(operator), payload: { outcome: 2, reason: "wrong source" } });
    const b = r.json();
    expect(b.path).toBe("setCorrectedOutcome");
    expect(b.unsignedTx.from).toBe(sharedAddresses.kairos.owner!.toLowerCase()); // Kairos owner from platform/shared
    const call = decodeFunctionData({ abi: cojamPredictAbi, data: b.unsignedTx.data });
    expect(call.functionName).toBe("setCorrectedOutcome");
    expect(call.args).toEqual([BigInt(id), 2]);
    const void3 = await k.app.inject({ method: "POST", url: `/admin/v1/answers/${id}/correct`, headers: auth(operator), payload: { outcome: 3, reason: "void it" } });
    expect(err(void3)).toBe("CORRECTION_WINDOW_OVER");
  });
  test("rerun and list", async () => {
    expect((await k.app.inject({ method: "POST", url: `/admin/v1/answers/${day * 5}/rerun`, headers: auth(operator), payload: {} })).statusCode).toBe(200);
    const list = await k.app.inject({ method: "GET", url: "/admin/v1/answers?status=all", headers: auth(viewer) });
    expect(list.json().answers.length).toBeGreaterThanOrEqual(5);
  });
});

describe("players", () => {
  test("block stops sponsorship at once and queues setFrozen; unblock and clear set the 30 day mark", async () => {
    const p = await registeredUser(k, "pl1");
    await k.db.insertInto("risk_flags").values({ wallet: p.wallet, rule: "cluster_device", score: 60 }).execute();
    const review = await k.app.inject({ method: "GET", url: "/admin/v1/players?list=review", headers: auth(viewer) });
    expect(review.json().players.some((x: any) => x.wallet === p.wallet)).toBe(true);
    const b = await k.app.inject({ method: "POST", url: `/admin/v1/players/${p.wallet}/block`, headers: auth(operator), payload: { reason: "device cluster" } });
    expect(b.json()).toMatchObject({ frozen: true, chain: "queued" });
    const f = await k.db.selectFrom("freezes").selectAll().where("wallet", "=", p.wallet).execute();
    expect(f[0]).toMatchObject({ action: "freeze", status: "queued", actor: "ops@gmail.com" });
    const blocked = await k.app.inject({ method: "GET", url: "/admin/v1/players?list=blocked", headers: auth(viewer) });
    expect(blocked.json().players[0].lastFreeze.reason).toBe("device cluster");
    const u = await k.app.inject({ method: "POST", url: `/admin/v1/players/${p.wallet}/unblock`, headers: auth(operator), payload: { reason: "false positive" } });
    expect(u.statusCode).toBe(200);
    const row = await k.db.selectFrom("users").select("risk_clear_until").where("wallet", "=", p.wallet).executeTakeFirstOrThrow();
    expect(row.risk_clear_until!.getTime()).toBeGreaterThan(k.clock.now + 29 * 86400_000);
    const detail = await k.app.inject({ method: "GET", url: `/admin/v1/players/${p.wallet}`, headers: auth(viewer) });
    expect(detail.json().freezes).toHaveLength(2);
    expect(detail.json().user.email_hash).toBeUndefined();
    const needsReason = await k.app.inject({ method: "POST", url: `/admin/v1/players/${p.wallet}/clear`, headers: auth(operator), payload: {} });
    expect(needsReason.statusCode).toBe(400);
  });
});

describe("email domains", () => {
  test("add, disable and the API cache follows", async () => {
    const add = await k.app.inject({ method: "POST", url: "/admin/v1/email-domains", headers: auth(operator), payload: { domain: "proton.me", displayName: "Proton", rule: "plus" } });
    expect(add.statusCode).toBe(200);
    const ok = await k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: { email: "a@proton.me" }, remoteAddress: "10.77.0.1" });
    expect(ok.json().allowed).toBe(true);
    await k.app.inject({ method: "PATCH", url: "/admin/v1/email-domains/proton.me", headers: auth(operator), payload: { enabled: false } });
    const no = await k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: { email: "b@proton.me" }, remoteAddress: "10.77.0.2" });
    expect(no.json()).toMatchObject({ allowed: false, reason: "EMAIL_DOMAIN_NOT_ALLOWED" });
    const dup = await k.app.inject({ method: "POST", url: "/admin/v1/email-domains", headers: auth(operator), payload: { domain: "gmail.com", displayName: "Gmail" } });
    expect(err(dup)).toBe("CONFLICT");
    const audits = await k.db.selectFrom("audit_log").select("action").where("target", "=", "proton.me").execute();
    expect(audits.map((a) => a.action)).toEqual(["email_domain.add", "email_domain.update"]);
  });
});

describe("params, ranking, system", () => {
  test("owner gets an unsigned proposeParams; bad splits are refused", async () => {
    const params = {
      completionPoints: 100, hitPoints: 50, referralBps: 1000, welcomePoints: 100, settleDelay: 21600, pointsPerCT: 1000, minConvertPoints: 1000,
      maxConvertCtPerUserPerDay: 50, maxConvertCtPerDay: 20000, minAccountAge: 604800, minResolveGap: 3600, maxWeeklyPool: 10000, airdropDelay: 216000,
      treasury: "0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb", splitBps: [3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300],
      maxResolveAfterClose: 45 * 86400,
    };
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/params", headers: auth(owner), payload: { action: "propose", params } });
    expect(r.statusCode).toBe(200);
    expect(decodeFunctionData({ abi: cojamPredictAbi, data: r.json().unsignedTx.data }).functionName).toBe("proposeParams");
    const bad = await k.app.inject({ method: "POST", url: "/admin/v1/params", headers: auth(owner), payload: { action: "propose", params: { ...params, splitBps: [1000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 2300] } } });
    expect(bad.statusCode).toBe(400);
  });
  test("maxResolveAfterClose (parameter 15): encoded in the proposal, 1 to 90 days, at least minResolveGap, default 30 days", async () => {
    const params = {
      completionPoints: 100, hitPoints: 50, referralBps: 1000, welcomePoints: 100, settleDelay: 21600, pointsPerCT: 1000, minConvertPoints: 1000,
      maxConvertCtPerUserPerDay: 50, maxConvertCtPerDay: 20000, minAccountAge: 604800, minResolveGap: 3600, maxWeeklyPool: 10000, airdropDelay: 216000,
      treasury: "0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb", splitBps: [3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300],
    };
    const propose = (p: Record<string, unknown>) => k.app.inject({ method: "POST", url: "/admin/v1/params", headers: auth(owner), payload: { action: "propose", params: p } });
    const proposed = async (p: Record<string, unknown>) => {
      const r = await propose(p);
      expect(r.statusCode, r.body).toBe(200);
      const args = decodeFunctionData({ abi: cojamPredictAbi, data: r.json().unsignedTx.data }).args as unknown as [{ maxResolveAfterClose: number | bigint }];
      return Number(args[0].maxResolveAfterClose);
    };
    expect(await proposed({ ...params, maxResolveAfterClose: 45 * 86400 })).toBe(45 * 86400);
    expect(await proposed(params)).toBe(30 * 86400); // omitted: the contract default
    expect(await proposed({ ...params, maxResolveAfterClose: 90 * 86400 })).toBe(90 * 86400);
    expect((await propose({ ...params, maxResolveAfterClose: 91 * 86400 })).statusCode).toBe(400);
    expect((await propose({ ...params, maxResolveAfterClose: 86399 })).statusCode).toBe(400);
    expect((await propose({ ...params, minResolveGap: 2 * 86400, maxResolveAfterClose: 86400 })).statusCode).toBe(400);
  });
  test("ranking, airdrop trigger, invites, system, audit", async () => {
    for (const url of ["/admin/v1/ranking/current", "/admin/v1/invites", "/admin/v1/system", "/admin/v1/audit", "/admin/v1/params", "/admin/v1/email-domains", "/admin/v1/operator-requests", "/admin/v1/admins"]) {
      const r = await k.app.inject({ method: "GET", url, headers: auth(viewer) });
      expect(r.statusCode, url).toBe(200);
    }
    const a = await k.app.inject({ method: "POST", url: "/admin/v1/ranking/2970/airdrop", headers: auth(operator), payload: {} });
    expect(a.json()).toMatchObject({ weekId: 2970, status: "queued" });
  });
  test("owner manages the admin allow list", async () => {
    expect((await k.app.inject({ method: "POST", url: "/admin/v1/admins", headers: auth(operator), payload: { email: "n@gmail.com", role: "viewer" } })).statusCode).toBe(403);
    expect((await k.app.inject({ method: "POST", url: "/admin/v1/admins", headers: auth(owner), payload: { email: "n@gmail.com", role: "viewer" } })).statusCode).toBe(200);
    expect((await k.app.inject({ method: "DELETE", url: "/admin/v1/admins/n@gmail.com", headers: auth(owner) })).statusCode).toBe(200);
    expect(err(await k.app.inject({ method: "DELETE", url: "/admin/v1/admins/founder@gmail.com", headers: auth(owner) }))).toBe("CONFLICT");
  });
});
