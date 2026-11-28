import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { auth, buildTestApp, registeredUser, type TestKit } from "./helpers.ts";

let k: TestKit;
beforeAll(async () => {
  k = await buildTestApp();
});
afterAll(async () => k.close());

const session = (token: Record<string, string>, payload: object = {}, extra: Record<string, string> = {}, ip = "10.0.0.1") =>
  k.app.inject({ method: "POST", url: "/v1/session", headers: { ...token, ...extra }, payload, remoteAddress: ip });

describe("POST /v1/session", () => {
  test("needs a token", async () => {
    const r = await k.app.inject({ method: "POST", url: "/v1/session", payload: {} });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.code).toBe("UNAUTHORIZED");
    const bad = await k.app.inject({ method: "POST", url: "/v1/session", payload: {}, headers: { authorization: "Bearer nope" } });
    expect(bad.statusCode).toBe(401);
  });

  test("creates a pending player and queues registration", async () => {
    const u = k.addUser("alice", "Al.Ice+x@gmail.com");
    const r = await session(auth(u), {}, { "x-device-id": "dev-alice-0001" });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b).toMatchObject({ registration: "pending", reason: null, wallet: u.wallet, frozen: false, playKey: null });
    expect(b.invite.code).toBeNull(); // hidden until registered
    expect(b.invite.canEnterCode).toBe(true);
    const req = await k.db.selectFrom("registration_requests").selectAll().where("wallet", "=", u.wallet).execute();
    expect(req).toHaveLength(1);
    expect(req[0]).toMatchObject({ kind: "register", status: "queued", referrer: null });
    const row = await k.db.selectFrom("users").selectAll().where("wallet", "=", u.wallet).executeTakeFirstOrThrow();
    expect(row.email_domain).toBe("gmail.com");
    expect(row.email_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.email_hash).not.toContain("alice");
    // Calling again is idempotent.
    const again = await session(auth(u));
    expect(again.json().registration).toBe("pending");
    expect(await k.db.selectFrom("registration_requests").select("id").where("wallet", "=", u.wallet).execute()).toHaveLength(1);
  });

  test("refuses a duplicate normalised address", async () => {
    const u = k.addUser("alice2", "alice@gmail.com"); // same as Al.Ice+x@gmail.com after the gmail rule
    const r = await session(auth(u), {}, { "x-device-id": "dev-alice-0002" });
    expect(r.json()).toMatchObject({ registration: "refused", reason: "EMAIL_DUPLICATE" });
    expect(await k.db.selectFrom("registration_requests").select("id").where("wallet", "=", u.wallet).execute()).toHaveLength(0);
  });

  test("refuses a domain that is not on the allow list", async () => {
    const u = k.addUser("bob", "bob@example.org");
    const r = await session(auth(u));
    expect(r.json()).toMatchObject({ registration: "refused", reason: "EMAIL_DOMAIN_NOT_ALLOWED" });
  });

  test("device sign up limit: 2 per day", async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const u = k.addUser(`dev${i}`, `devuser${i}@naver.com`);
      results.push((await session(auth(u), {}, { "x-device-id": "shared-device-01" }, `10.5.0.${i}`)).json());
    }
    expect(results.map((r) => r.registration)).toEqual(["pending", "pending", "refused"]);
    expect(results[2].reason).toBe("SIGNUP_RATE_LIMITED");
  });

  test("GET /v1/session self heals when the chain already registered the player", async () => {
    const u = k.addUser("carol", "carol@kakao.com");
    await session(auth(u));
    k.chain.register(u.wallet);
    const r = await k.app.inject({ method: "GET", url: "/v1/session", headers: auth(u) });
    expect(r.json().registration).toBe("registered");
    expect(r.json().invite.code).toMatch(/^[A-Z2-9]{7}$/);
  });

  test("an invite code given at sign up rides on the registration", async () => {
    const inviter = await registeredUser(k, "inv1");
    const code = (await k.app.inject({ method: "GET", url: "/v1/invite", headers: auth(inviter) })).json().code;
    const u = k.addUser("friend1", "friend1@daum.net");
    const r = await session(auth(u), { inviteCode: code.toLowerCase() });
    expect(r.json().inviteResult).toMatchObject({ status: "queued", inviterName: expect.any(String) });
    expect(r.json().invite.linkedTo).not.toBeNull();
    const req = await k.db.selectFrom("registration_requests").selectAll().where("wallet", "=", u.wallet).executeTakeFirstOrThrow();
    expect(req.referrer).toBe(inviter.wallet);
  });

  test("an unknown code does not block registration", async () => {
    const u = k.addUser("friend2", "friend2@daum.net");
    const r = await session(auth(u), { inviteCode: "ZZZZZZZ" });
    expect(r.json().registration).toBe("pending");
    expect(r.json().inviteResult).toMatchObject({ status: "rejected", error: "INVITE_UNKNOWN" });
  });
});

describe("/v1/me", () => {
  test("GET and PATCH", async () => {
    const u = await registeredUser(k, "dana");
    const r = await k.app.inject({ method: "GET", url: "/v1/me", headers: auth(u) });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ language: "en", onboarded: false, registration: "registered", frozen: false, supportEmail: "help@cojam.app" });
    const p = await k.app.inject({ method: "PATCH", url: "/v1/me", headers: auth(u), payload: { language: "ko", displayName: "다나", onboarded: true } });
    expect(p.statusCode).toBe(200);
    expect(p.json()).toMatchObject({ language: "ko", displayName: "다나", onboarded: true });
    const bad = await k.app.inject({ method: "PATCH", url: "/v1/me", headers: auth(u), payload: { language: "fr" } });
    expect(bad.statusCode).toBe(400);
    const unknown = await k.app.inject({ method: "PATCH", url: "/v1/me", headers: auth(u), payload: { frozen: false } });
    expect(unknown.statusCode).toBe(400);
  });
  test("before POST /v1/session the user is unknown", async () => {
    const u = k.addUser("ghost");
    const r = await k.app.inject({ method: "GET", url: "/v1/me", headers: auth(u) });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("NOT_REGISTERED");
  });
});
