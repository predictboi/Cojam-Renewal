// Endpoints added for the admin web app (src/routes/adminExtra.ts and the extended admin reads).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { decodeFunctionData } from "viem";
import { cojamPredictAbi, cojamStakingAbi } from "../../src/chain/abi.ts";
import { currentDayId } from "../../../shared/src/time.ts";
import { auth, buildTestApp, registeredUser, seedDay, STAKING, type TestKit, type TestUser } from "./helpers.ts";

let k: TestKit;
let owner: TestUser, operator: TestUser, viewer: TestUser;
let day: number;
const err = (r: { json: () => any }) => r.json().error?.code;

beforeAll(async () => {
  k = await buildTestApp();
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

const lastAudit = async () => k.db.selectFrom("audit_log").selectAll().orderBy("id", "desc").executeTakeFirstOrThrow();

describe("owner transactions for staking and the reserve", () => {
  test("setRates and withdrawRewards are built unsigned for the staking contract; operators are refused", async () => {
    const rates = [[800, 900, 1000], [1200, 1300, 1400], [1800, 1900, 2000], [2500, 2600, 2700]];
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/staking", headers: auth(owner), payload: { action: "setRates", ratesBps: rates } });
    expect(r.statusCode).toBe(200);
    const tx = r.json().unsignedTx;
    expect(tx.to.toLowerCase()).toBe(STAKING);
    expect(decodeFunctionData({ abi: cojamStakingAbi, data: tx.data }).functionName).toBe("setRates");
    const w = await k.app.inject({ method: "POST", url: "/admin/v1/staking", headers: auth(owner), payload: { action: "withdrawRewards", amountCt: "1250.5" } });
    const d = decodeFunctionData({ abi: cojamStakingAbi, data: w.json().unsignedTx.data });
    expect(d.args?.[0]).toBe(1250_500000000000000000n);
    expect(err(await k.app.inject({ method: "POST", url: "/admin/v1/staking", headers: auth(operator), payload: { action: "applyTreasury" } }))).toBe("ADMIN_FORBIDDEN");
    expect(err(await k.app.inject({ method: "POST", url: "/admin/v1/staking", headers: auth(owner), payload: { action: "setRates", ratesBps: [[1, 2]] } }))).toBeTruthy();
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/staking", headers: auth(viewer) })).statusCode).toBe(200);
  });
  test("withdrawReserve is built for the prediction contract and audited", async () => {
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/reserve/withdraw", headers: auth(owner), payload: { amountCt: "100", reason: "move to treasury" } });
    expect(r.statusCode).toBe(200);
    expect(decodeFunctionData({ abi: cojamPredictAbi, data: r.json().unsignedTx.data }).functionName).toBe("withdrawReserve");
    expect((await lastAudit()).action).toBe("reserve.withdraw.built");
  });
  test("a sent owner transaction is recorded with its hash", async () => {
    const hash = "0x" + "ab".repeat(32);
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/owner-tx", headers: auth(owner), payload: { action: "params.propose", txHash: hash } });
    expect(r.statusCode).toBe(200);
    const a = await lastAudit();
    expect(a).toMatchObject({ action: "owner_tx.params.propose", tx_hash: hash, actor: "founder@gmail.com" });
  });
});

describe("maintenance switch", () => {
  test("operator turns it on and off with a note; viewers cannot", async () => {
    expect(err(await k.app.inject({ method: "POST", url: "/admin/v1/app", headers: auth(viewer), payload: { maintenance: true, reason: "deploy" } }))).toBe("ADMIN_FORBIDDEN");
    const on = await k.app.inject({ method: "POST", url: "/admin/v1/app", headers: auth(operator), payload: { maintenance: true, message: "Back soon.", endsAt: "16:00 KST", reason: "database upgrade" } });
    expect(on.json().maintenance).toMatchObject({ on: true, message: "Back soon.", endsAt: "16:00 KST", by: "ops@gmail.com" });
    expect((await lastAudit()).action).toBe("app.maintenance.on");
    const off = await k.app.inject({ method: "POST", url: "/admin/v1/app", headers: auth(operator), payload: { maintenance: false, reason: "upgrade done" } });
    expect(off.json().maintenance.on).toBe(false);
    expect(err(await k.app.inject({ method: "POST", url: "/admin/v1/app", headers: auth(operator), payload: { maintenance: true } }))).toBeTruthy();
  });
});

describe("AI queue, add question, jobs", () => {
  const draft = (dayId: number) => {
    const t = (title: string) => ({ title, left: "No", right: "Yes", rule: "Official close", settle: "09:00 tomorrow" });
    const resolves = new Date(((dayId + 1) * 86400 + 3600) * 1000).toISOString();
    return { category: "Crypto", kind: "continuous", en: t("Will BTC rise?"), ko: t("비트코인 오를까요?"), ja: t("ビットコインは上がる？"), criteria: "Binance close", primarySource: { name: "Binance", url: "https://www.binance.com" }, secondarySource: { name: "CoinGecko", url: "https://www.coingecko.com" }, observesAt: resolves, resolvesAt: resolves, probabilityRight: 0.5, entities: [], imageSubject: "coin", rationale: "test" };
  };
  test("lists drafts, swaps one into a scheduled slot, schedules and discards", async () => {
    const ids = await k.db
      .insertInto("market_drafts")
      .values([1, 2, 3].map(() => ({ target_day: day + 1, payload: JSON.stringify(draft(day + 1)), validator_result: JSON.stringify({ ai: { qualityScore: 0.93 } }) })))
      .returning("id")
      .execute();
    const list = await k.app.inject({ method: "GET", url: "/admin/v1/drafts", headers: auth(viewer) });
    expect(list.json().drafts).toHaveLength(3);
    expect(list.json().drafts[0].quality).toBe(0.93);
    const target = (day + 1) * 5 + 2;
    const sw = await k.app.inject({ method: "POST", url: `/admin/v1/questions/${target}/swap`, headers: auth(operator), payload: { draftId: Number(ids[0].id), reason: "better question" } });
    expect(sw.statusCode).toBe(200);
    const m = await k.db.selectFrom("markets").selectAll().where("market_id", "=", target).executeTakeFirstOrThrow();
    expect(m).toMatchObject({ status: "scheduled", draft_id: Number(ids[0].id), content_hash: null, image_state: "pending" });
    // the slot is full: scheduling another draft there is refused; cancel then schedule works
    expect(err(await k.app.inject({ method: "POST", url: `/admin/v1/drafts/${ids[1].id}/schedule`, headers: auth(operator), payload: { dayId: day + 1, slot: 2 } }))).toBe("CONFLICT");
    await k.app.inject({ method: "POST", url: `/admin/v1/questions/${target}/cancel`, headers: auth(operator), payload: { reason: "make room" } });
    const sc = await k.app.inject({ method: "POST", url: `/admin/v1/drafts/${ids[1].id}/schedule`, headers: auth(operator), payload: { dayId: day + 1, slot: 2, reason: "fill" } });
    expect(sc.json().marketId).toBe(target);
    expect(err(await k.app.inject({ method: "POST", url: `/admin/v1/drafts/${ids[2].id}/schedule`, headers: auth(operator), payload: { dayId: day, slot: 0 } }))).toBe("QUESTION_PUBLISHED");
    const dc = await k.app.inject({ method: "POST", url: `/admin/v1/drafts/${ids[2].id}/discard`, headers: auth(operator), payload: {} });
    expect(dc.json().discarded).toBe(true);
    expect((await k.app.inject({ method: "GET", url: "/admin/v1/drafts", headers: auth(viewer) })).json().drafts).toHaveLength(0);
  });
  test("adds a question by hand into an empty slot", async () => {
    const d = day + 3;
    const t = (title: string) => ({ title, left: "No", right: "Yes", rule: "KMA daily high", settle: "18:00 tomorrow" });
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/questions", headers: auth(operator), payload: { dayId: d, slot: 4, reason: "short day", question: { category: "Weather", content: { en: t("Will Seoul reach 10°C?"), ko: t("서울 10도?"), ja: t("ソウル10℃？") }, resolvesAt: (d + 1) * 86400 + 9 * 3600, sources: [{ name: "KMA", url: "https://www.weather.go.kr" }], criteria: "KMA station 108 daily maximum." } } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ marketId: d * 5 + 4, status: "queued" });
    expect((await k.db.selectFrom("audit_log").select("action").where("action", "=", "question.add").execute()).length).toBe(1);
  });
  test("run a job now queues run_job; unknown jobs are refused", async () => {
    const r = await k.app.inject({ method: "POST", url: "/admin/v1/jobs/settle/run", headers: auth(operator), payload: {} });
    expect(r.json()).toMatchObject({ job: "settle", status: "queued" });
    const row = await k.db.selectFrom("operator_requests").selectAll().where("id", "=", r.json().requestId).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ kind: "run_job", target: "settle" });
    expect((await k.app.inject({ method: "POST", url: "/admin/v1/jobs/nope/run", headers: auth(operator), payload: {} })).statusCode).toBe(400);
  });
});

describe("reads for the admin screens", () => {
  test("dashboard detail, answers sides, ranking rows, players play figures, display name reset", async () => {
    const p = await registeredUser(k, "dalgona");
    const det = await k.app.inject({ method: "GET", url: "/admin/v1/dashboard/detail", headers: auth(viewer) });
    expect(det.statusCode).toBe(200);
    expect(det.json()).toHaveProperty("conversions.waiting");
    const ans = await k.app.inject({ method: "GET", url: "/admin/v1/answers?status=all", headers: auth(viewer) });
    expect(ans.json().answers[0]).toHaveProperty("picks.left");
    const rk = await k.app.inject({ method: "GET", url: "/admin/v1/ranking/current", headers: auth(viewer) });
    expect(rk.json()).toHaveProperty("backlog.total");
    expect(rk.json()).toHaveProperty("airdropDueAt");
    const pl = await k.app.inject({ method: "GET", url: "/admin/v1/players?list=all&q=" + p.wallet.slice(0, 10), headers: auth(viewer) });
    expect(pl.json().players[0].play).toMatchObject({ days: 0, friends: 0 });
    await k.db.updateTable("users").set({ display_name: "badname" }).where("wallet", "=", p.wallet).execute();
    const rs = await k.app.inject({ method: "POST", url: `/admin/v1/players/${p.wallet}/reset-name`, headers: auth(operator), payload: { reason: "offensive name" } });
    expect(rs.statusCode).toBe(200);
    expect((await k.db.selectFrom("users").select("display_name").where("wallet", "=", p.wallet).executeTakeFirstOrThrow()).display_name).toBeNull();
    const dom = await k.app.inject({ method: "GET", url: "/admin/v1/email-domains", headers: auth(viewer) });
    expect(dom.json()).toHaveProperty("refusedNotListed7d.total");
  });
});
