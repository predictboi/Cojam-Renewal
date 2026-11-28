// Draft timing and the long question window (DECISIONS "Longer questions mixed in"): the stored longMaxDays may go
// up to the contract's 90 day bound, and what applies is capped by the on chain maxResolveAfterClose.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { currentDayId, dayEnd } from "../../../shared/src/time.ts";
import { auth, buildTestApp, type TestKit, type TestUser } from "./helpers.ts";

let k: TestKit;
let owner: TestUser, operator: TestUser, viewer: TestUser;
const DAY = 86400;

beforeAll(async () => {
  k = await buildTestApp({ env: { LONG_QUESTIONS_ON_CHAIN: "1" } });
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
});
afterAll(async () => k.close());

/** Moves the API clock past the 60 s params cache so a changed stub value is read. */
const setChainMaxDays = (days: number) => {
  k.chain.params_ = { ...k.chain.params_, maxResolveAfterClose: days * DAY };
  k.clock.now += 61_000;
};

const timing = () => k.app.inject({ method: "GET", url: "/admin/v1/draft-timing", headers: auth(viewer) });
const setTiming = (who: TestUser, body: Record<string, unknown>) => k.app.inject({ method: "POST", url: "/admin/v1/draft-timing", headers: auth(who), payload: { reason: "test run", ...body } });

const text = (title: string) => ({ title, left: "No", right: "Yes", rule: "Close price on the date", settle: "On the date" });
const addQuestion = (dayId: number, slot: number, resolvesAt: number) =>
  k.app.inject({
    method: "POST",
    url: "/admin/v1/questions",
    headers: auth(operator),
    payload: { dayId, slot, reason: "long question test", question: { category: "Crypto", content: { en: text("Will BTC close above 100k?"), ko: text("BTC 10만 달러 위?"), ja: text("BTCは10万ドル超？") }, resolvesAt, sources: [{ name: "Binance", url: "https://www.binance.com" }], criteria: "Daily close on Binance." } },
  });

describe("draft timing", () => {
  test("defaults, capped by the on chain maxResolveAfterClose", async () => {
    const r = await timing();
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ minShort: 3, maxLong: 2, longMaxDays: 30, longQuestionsOnChain: true, effective: { maxLong: 2, longMaxDays: 30, chainMaxDays: 30 } });
    setChainMaxDays(7);
    expect((await timing()).json().effective).toEqual({ maxLong: 2, longMaxDays: 7, chainMaxDays: 7 });
    setChainMaxDays(30);
  });

  test("owner only; longMaxDays up to 90 (the contract bound), the sum of counts at most 5", async () => {
    expect((await setTiming(operator, { minShort: 3, maxLong: 2, longMaxDays: 30 })).statusCode).toBe(403);
    expect((await setTiming(owner, { minShort: 3, maxLong: 2, longMaxDays: 91 })).statusCode).toBe(400);
    expect((await setTiming(owner, { minShort: 4, maxLong: 2, longMaxDays: 30 })).statusCode).toBe(400);
    const ok = await setTiming(owner, { minShort: 3, maxLong: 2, longMaxDays: 90 });
    expect(ok.statusCode).toBe(200);
    // Stored as asked, applied up to the chain's 30 days.
    expect(ok.json()).toMatchObject({ longMaxDays: 90, effective: { longMaxDays: 30, chainMaxDays: 30 } });
    setChainMaxDays(90);
    expect((await timing()).json()).toMatchObject({ longMaxDays: 90, effective: { longMaxDays: 90, chainMaxDays: 90 } });
    const audits = await k.db.selectFrom("audit_log").select("action").where("action", "=", "draft.timing").execute();
    expect(audits).toHaveLength(1);
  });

  test("a question placed by hand may be long, up to the effective limit", async () => {
    const d = currentDayId(k.clock.now) + 3;
    setChainMaxDays(20);
    // 20 days after the close is the chain's limit; 21 is refused even though 90 is stored.
    expect((await addQuestion(d, 0, dayEnd(d) + 21 * DAY)).statusCode).toBe(400);
    const ok = await addQuestion(d, 0, dayEnd(d) + 20 * DAY);
    expect(ok.statusCode, ok.body).toBe(200);
    // A second long one fits (maxLong 2), a third does not.
    expect((await addQuestion(d, 1, dayEnd(d) + 5 * DAY)).statusCode).toBe(200);
    const third = await addQuestion(d, 2, dayEnd(d) + 3 * DAY);
    expect(third.statusCode).toBe(400);
    expect(third.json().error.message).toContain("long questions");
    // Short questions are unaffected.
    expect((await addQuestion(d, 2, dayEnd(d) + 12 * 3600)).statusCode).toBe(200);
    setChainMaxDays(30);
  });
});
