import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { auth, buildTestApp, registeredUser, type TestKit, type TestUser } from "./helpers.ts";

let k: TestKit;
beforeAll(async () => {
  k = await buildTestApp();
});
afterAll(async () => k.close());

const codeOf = async (u: TestUser) => (await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(u) })).json().code as string;
const redeem = (u: TestUser, code: string) => k.app.inject({ method: "POST", url: "/v1/invite/redeem", headers: auth(u), payload: { code } });
const err = (r: { json: () => any }) => r.json().error?.code;

describe("invites", () => {
  test("GET /v1/invite: own code and link, stats", async () => {
    const u = await registeredUser(k, "i1");
    const r = await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(u) });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.code).toMatch(/^[A-Z2-9]{7}$/);
    expect(b.code).not.toMatch(/[01]/);
    expect(b.link).toBe(`https://app.cojam.app/i/${b.code}`);
    expect(b).toMatchObject({ available: true, referralBps: 1000, welcomePoints: 100, stats: { friendsJoined: 0 }, canEnterCode: true });
  });

  test("an account on hold cannot invite: code and link hidden, its code is unknown to others", async () => {
    const held = await registeredUser(k, "i2");
    const code = await codeOf(held);
    await k.db.updateTable("users").set({ frozen: true }).where("wallet", "=", held.wallet).execute();
    const r = await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(held) });
    expect(r.json()).toMatchObject({ code: null, link: null, available: false });
    const lookup = await k.app.inject({ method: "GET", url: `/v1/invite/lookup?code=${code}` });
    expect(lookup.json()).toEqual({ valid: false });
    const f = await registeredUser(k, "i2f");
    expect(err(await redeem(f, code))).toBe("INVITE_UNKNOWN");
  });

  test("lookup is public, normalises the code and says nothing else", async () => {
    const u = await registeredUser(k, "i3");
    await k.db.updateTable("users").set({ display_name: "minjikim" }).where("wallet", "=", u.wallet).execute();
    const code = await codeOf(u);
    const messy = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
    const r = await k.app.inject({ method: "GET", url: `/v1/invite/lookup?code=${encodeURIComponent(messy)}` });
    expect(r.json()).toEqual({ valid: true, inviterName: "mi*****m" });
    expect((await k.app.inject({ method: "GET", url: "/v1/invite/lookup?code=AB" })).json()).toEqual({ valid: false });
  });

  test("redeem within 24 hours of registration links and queues setReferrer", async () => {
    const inviter = await registeredUser(k, "i4");
    const friend = await registeredUser(k, "i4f", { registeredAgoSec: 3600 });
    const r = await redeem(friend, await codeOf(inviter));
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ status: "linked", chain: "queued" });
    const req = await k.db.selectFrom("registration_requests").selectAll().where("wallet", "=", friend.wallet).where("kind", "=", "set_referrer").executeTakeFirstOrThrow();
    expect(req.referrer).toBe(inviter.wallet);
    // Second attempt: already linked, with the inviter's name.
    const again = await redeem(friend, await codeOf(inviter));
    expect(err(again)).toBe("INVITE_ALREADY_LINKED");
    expect(again.json().error.details.inviterName).toBeTruthy();
    // The inviter's page counts the friend.
    const page = await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(inviter) });
    expect(page.json().stats.friendsJoined).toBe(1);
    expect(page.json().recent[0].state).toBe("joined");
  });

  test("after 24 hours the link is fixed for good", async () => {
    const inviter = await registeredUser(k, "i5");
    const late = await registeredUser(k, "i5f", { registeredAgoSec: 25 * 3600 });
    expect(err(await redeem(late, await codeOf(inviter)))).toBe("INVITE_TOO_LATE");
    const me = await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(late) });
    expect(me.json().canEnterCode).toBe(false);
  });

  test("own code, short code, two way link", async () => {
    const a = await registeredUser(k, "i6a");
    const b = await registeredUser(k, "i6b");
    expect(err(await redeem(a, await codeOf(a)))).toBe("INVITE_OWN");
    expect(err(await redeem(a, "AB2"))).toBe("INVITE_SHORT");
    expect((await redeem(b, await codeOf(a))).statusCode).toBe(200);
    expect(err(await redeem(a, await codeOf(b)))).toBe("INVITE_LIMIT");
  });

  test("the inviter's daily link cap", async () => {
    const small = await buildTestApp({ env: { INVITE_LINKS_PER_INVITER_PER_DAY: "1" } });
    try {
      const inv = await registeredUser(small, "c1");
      const code = (await small.app.inject({ method: "GET", url: "/v1/invite", headers: auth(inv) })).json().code;
      const f1 = await registeredUser(small, "c1a");
      const f2 = await registeredUser(small, "c1b");
      expect((await small.app.inject({ method: "POST", url: "/v1/invite/redeem", headers: auth(f1), payload: { code } })).statusCode).toBe(200);
      const r = await small.app.inject({ method: "POST", url: "/v1/invite/redeem", headers: auth(f2), payload: { code } });
      expect(r.json().error.code).toBe("INVITE_LIMIT");
    } finally {
      await small.close();
    }
  });

  test("a player on hold cannot redeem", async () => {
    const inv = await registeredUser(k, "i7");
    const held = await registeredUser(k, "i7f", { frozen: true });
    expect(err(await redeem(held, await codeOf(inv)))).toBe("FROZEN");
  });
});

describe("wallet and staking", () => {
  const CT = 10n ** 18n;
  test("GET /v1/wallet: balances and conversion preview inside the caps", async () => {
    const u = await registeredUser(k, "m1", { registeredAgoSec: 8 * 86400 });
    k.chain.balances.ct.set(u.wallet, 1840n * CT);
    k.chain.balances.kaia.set(u.wallet, 2n * CT);
    k.chain.balances.points.set(u.wallet, 75_400n);
    const r = await k.app.inject({ method: "GET", url: "/v1/wallet", headers: auth(u) });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b).toMatchObject({ address: u.wallet, ctWei: (1840n * CT).toString(), points: 75400 });
    // 50 CT per user per day at 1,000 points per CT: at most 50,000 points now.
    expect(b.conversion).toMatchObject({ maxPointsNow: 50000, ctPreviewWei: (50n * CT).toString(), blockedReason: null });
  });
  test("a new account must wait 7 days to convert", async () => {
    const u = await registeredUser(k, "m2", { registeredAgoSec: 3600 });
    k.chain.balances.points.set(u.wallet, 5000n);
    const b = (await k.app.inject({ method: "GET", url: "/v1/wallet", headers: auth(u) })).json();
    expect(b.conversion.blockedReason).toBe("ACCOUNT_TOO_NEW");
    expect(b.conversion.maxPointsNow).toBe(0);
  });
  test("GET /v1/staking/quote: tier, rate, interest and the per user cap", async () => {
    const u = await registeredUser(k, "m3");
    const r = await k.app.inject({ method: "GET", url: `/v1/staking/quote?amount=${(1000n * CT).toString()}&lock=90`, headers: auth(u) });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ lockIndex: 1, lockDays: 90, tier: 1, aprBps: 1300, interestWei: "32054794520547945205", krw: null, capacity: { fits: true } });
    const big = await k.app.inject({ method: "GET", url: `/v1/staking/quote?amount=${(1_000_001n * CT).toString()}&lock=365`, headers: auth(u) });
    expect(big.json().capacity).toMatchObject({ fits: false, reason: "STAKING_USER_CAP" });
    const small = await k.app.inject({ method: "GET", url: `/v1/staking/quote?amount=${CT.toString()}&lock=30`, headers: auth(u) });
    expect(small.json().capacity.reason).toBe("BELOW_MIN_STAKE");
    const bad = await k.app.inject({ method: "GET", url: `/v1/staking/quote?amount=1&lock=45`, headers: auth(u) });
    expect(bad.statusCode).toBe(400);
  });
  test("KRW only in the Korean quote, when a rate is configured", async () => {
    const kr = await buildTestApp({ env: { KRW_PER_CT: "200" } });
    try {
      const u = await registeredUser(kr, "m4");
      const r = await kr.app.inject({ method: "GET", url: `/v1/staking/quote?amount=${(1000n * CT).toString()}&lock=90&lang=ko`, headers: auth(u) });
      expect(r.json().krw).toEqual({ principal: 200000, interest: 6411 });
      const en = await kr.app.inject({ method: "GET", url: `/v1/staking/quote?amount=${(1000n * CT).toString()}&lock=90&lang=en`, headers: auth(u) });
      expect(en.json().krw).toBeNull();
    } finally {
      await kr.close();
    }
  });
  test("GET /v1/staking/positions: claimable and withdrawable flags", async () => {
    const u = await registeredUser(k, "m5");
    const now = Math.floor(k.clock.now / 1000);
    k.chain.positions.set(u.wallet, [
      { id: 0, principal: 1000n * CT, maxInterest: 32n * CT, claimed: 0n, claimable: 5n * CT, start: now - 86400 * 10, end: now + 86400 * 80, aprBps: 1300, lockIndex: 1, closed: false },
      { id: 1, principal: 500n * CT, maxInterest: 3n * CT, claimed: 0n, claimable: 3n * CT, start: now - 86400 * 31, end: now - 86400, aprBps: 800, lockIndex: 0, closed: false },
    ]);
    const b = (await k.app.inject({ method: "GET", url: "/v1/staking/positions", headers: auth(u) })).json();
    expect(b.positions[0]).toMatchObject({ canClaim: false, canWithdraw: false, lockDays: 90 }); // 5 CT < minClaim 10 while locked
    expect(b.positions[1]).toMatchObject({ canClaim: true, canWithdraw: true, lockDays: 30 });
    expect(b.totals).toMatchObject({ open: 2, principalWei: (1500n * CT).toString(), claimableWei: (8n * CT).toString() });
  });
  test("GET /v1/wallet/history pages through the index", async () => {
    const u = await registeredUser(k, "m6");
    for (let i = 0; i < 3; i++) {
      await k.db
        .insertInto("wallet_transfers")
        .values({ tx_hash: `0x${i}`, log_index: 0, wallet: u.wallet, direction: i === 2 ? "out" : "in", counterparty: "0x0000000000000000000000000000000000000001", amount: "1000", kind: i === 1 ? "convert" : "transfer", block: 10 + i })
        .execute();
    }
    await k.db.insertInto("conversions").values({ tx_hash: "0x1", wallet: u.wallet, points: 1000, ct: "1000" }).execute();
    const p1 = (await k.app.inject({ method: "GET", url: "/v1/wallet/history?limit=2", headers: auth(u) })).json();
    expect(p1.items.map((i: any) => i.kind)).toEqual(["withdrawal", "conversion"]);
    expect(p1.items[1].points).toBe(1000);
    const p2 = (await k.app.inject({ method: "GET", url: `/v1/wallet/history?limit=2&cursor=${p1.nextCursor}`, headers: auth(u) })).json();
    expect(p2.items.map((i: any) => i.kind)).toEqual(["deposit"]);
    expect(p2.nextCursor).toBeNull();
  });
  test("RPC down answers RPC_UNAVAILABLE", async () => {
    const u = await registeredUser(k, "m7");
    k.chain.fail = true;
    const r = await k.app.inject({ method: "GET", url: "/v1/wallet", headers: auth(u) });
    k.chain.fail = false;
    expect(r.statusCode).toBe(503);
    expect(r.json().error).toMatchObject({ code: "RPC_UNAVAILABLE", retryable: true });
  });
});
