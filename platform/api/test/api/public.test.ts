import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildTestApp, type TestKit } from "./helpers.ts";

let k: TestKit;
beforeAll(async () => {
  k = await buildTestApp();
});
afterAll(async () => k.close());

describe("GET /v1/config", () => {
  test("returns network, contracts, gas limits, params and time", async () => {
    const r = await k.app.inject({ method: "GET", url: "/v1/config" });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.chainId).toBe(1001);
    expect(b.contracts.predict).toMatch(/^0x8bf5/);
    expect(b.feePayer).toMatch(/^0x[0-9a-f]{40}$/);
    expect(b.gasLimits.predict).toBe(170000);
    expect(b.params.pointsPerCT).toBe(1000);
    expect(b.supportEmail).toBe("help@cojam.app");
    expect(b.time.dayEndsAt - b.time.dayOpensAt).toBe(86400);
  });
});

describe("GET /v1/health", () => {
  test("ok with db and rpc", async () => {
    const r = await k.app.inject({ method: "GET", url: "/v1/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, db: true, rpc: true, blockNumber: 1000 });
  });
  test("strict mode fails when the RPC is down", async () => {
    k.chain.fail = true;
    const r = await k.app.inject({ method: "GET", url: "/v1/health?strict=1" });
    k.chain.fail = false;
    expect(r.statusCode).toBe(503);
    expect(r.json().rpc).toBe(false);
  });
  test("strict mode fails when the fee payer is under its floor", async () => {
    k.chain.feePayerBalance = 1n;
    const r = await k.app.inject({ method: "GET", url: "/v1/health?strict=1" });
    k.chain.feePayerBalance = 100n * 10n ** 18n;
    expect(r.statusCode).toBe(503);
    expect(r.json().feePayer.low).toBe(true);
  });
});

describe("POST /v1/auth/email-check", () => {
  const check = (email: string, headers: Record<string, string> = {}) =>
    k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: { email }, headers: { "x-device-id": "device-abc-123", ...headers }, remoteAddress: headers["x-ip"] ?? "10.0.0.1" });

  test("allows listed providers and lists them", async () => {
    const r = await check("Min.Ji+promo@GoogleMail.com");
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.allowed).toBe(true);
    expect(b.reason).toBeNull();
    expect(b.supportedProviders.map((p: any) => p.domain)).toEqual(
      expect.arrayContaining(["gmail.com", "naver.com", "kakao.com", "daum.net", "hanmail.net", "icloud.com", "outlook.com", "hotmail.com", "yahoo.co.jp"]),
    );
  });
  test("refuses other domains and invalid addresses", async () => {
    expect((await check("a@example.com", { "x-device-id": "device-2-xxxxx" })).json()).toMatchObject({ allowed: false, reason: "EMAIL_DOMAIN_NOT_ALLOWED" });
    expect((await check("not-an-email", { "x-device-id": "device-3-xxxxx" })).json()).toMatchObject({ allowed: false, reason: "EMAIL_INVALID" });
    expect((await check("+tag@naver.com", { "x-device-id": "device-4-xxxxx" })).json()).toMatchObject({ allowed: false, reason: "EMAIL_INVALID" });
  });
  test("rate limits by normalised address (5 per hour)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await k.app.inject({
        method: "POST",
        url: "/v1/auth/email-check",
        payload: { email: `same.person+${i}@gmail.com` },
        headers: { "x-device-id": `dev-email-${i}-abcdef` },
        remoteAddress: `10.1.0.${i}`,
      });
      codes.push(r.statusCode);
      if (r.statusCode === 429) expect(r.json().error.code).toBe("RATE_LIMITED_EMAIL");
    }
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });
  test("rate limits by device (5 per hour)", async () => {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: { email: `user${i}@naver.com` }, headers: { "x-device-id": "one-device-xyz" }, remoteAddress: `10.2.0.${i}` });
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.json().error.code).toBe("RATE_LIMITED_DEVICE");
  });
  test("rate limits by network (10 per hour)", async () => {
    let last;
    for (let i = 0; i < 11; i++) {
      last = await k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: { email: `ip${i}@daum.net` }, headers: { "x-device-id": `ipdev-${i}-abcdef` }, remoteAddress: "10.9.9.9" });
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.json().error.code).toBe("RATE_LIMITED_IP");
  });
  test("rejects a bad body with BAD_REQUEST", async () => {
    const r = await k.app.inject({ method: "POST", url: "/v1/auth/email-check", payload: {} });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("BAD_REQUEST");
  });
});

describe("errors and CORS", () => {
  test("unknown route answers NOT_FOUND in the error shape", async () => {
    const r = await k.app.inject({ method: "GET", url: "/v1/nope" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toMatchObject({ error: { code: "NOT_FOUND", retryable: false } });
  });
  test("CORS allows only listed origins", async () => {
    const ok = await k.app.inject({ method: "OPTIONS", url: "/v1/config", headers: { origin: "https://app.cojam.app", "access-control-request-method": "GET" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("https://app.cojam.app");
    const bad = await k.app.inject({ method: "OPTIONS", url: "/v1/config", headers: { origin: "https://evil.example", "access-control-request-method": "GET" } });
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
