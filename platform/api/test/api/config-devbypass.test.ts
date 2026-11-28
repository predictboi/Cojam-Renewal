import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ConfigError, loadConfig } from "../../src/config/index.ts";
import { devIdentity, profileFromPrivyUser } from "../../src/auth/privy.ts";
import { matchesServiceToken } from "../../src/auth/index.ts";
import { normaliseEmail } from "../../../shared/src/email.ts";
import { normaliseInviteCode, isInviteCodeShape, maskName } from "../../../shared/src/invite.ts";
import { buildTestApp, type TestKit } from "./helpers.ts";
import { addresses as sharedAddresses } from "../../../shared/addresses/index.ts";

const prodBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://x",
  NETWORK: "kairos",
  EMAIL_HASH_KEY: "k",
  IP_HASH_SALT: "s",
  PRIVY_APP_ID: "app",
  PRIVY_APP_SECRET: "secret",
  PRIVY_ADMIN_APP_ID: "admin",
  APP_FEE_PAYER_PRIVATE_KEY: "0x" + "11".repeat(32),
};

describe("config", () => {
  test("AUTH_DEV_BYPASS can never be enabled in production", () => {
    expect(() => loadConfig({ ...prodBase, AUTH_DEV_BYPASS: "1" }, "api")).toThrow(ConfigError);
    expect(() => loadConfig({ ...prodBase, AUTH_DEV_BYPASS: "true" }, "api")).toThrow(/AUTH_DEV_BYPASS/);
    expect(loadConfig({ ...prodBase }, "api").devBypass).toBe(false);
  });
  test("the dev stub chain can never run in production", () => {
    expect(() => loadConfig({ ...prodBase, DEV_CHAIN: "stub" }, "api")).toThrow(/DEV_CHAIN/);
  });
  test("production needs its secrets, and keeps the operator key off the API", () => {
    expect(() => loadConfig({ ...prodBase, PRIVY_APP_SECRET: "" }, "api")).toThrow(/PRIVY_APP_SECRET/);
    expect(() => loadConfig({ ...prodBase, OPERATOR_PRIVATE_KEY: "0x" + "22".repeat(32) }, "api")).toThrow(/OPERATOR_PRIVATE_KEY/);
  });
  test("addresses default to platform/shared for the network", () => {
    const c = loadConfig({ DATABASE_URL: "postgres://x", NETWORK: "kairos" }, "test");
    expect(c.addresses.predict).toBe(sharedAddresses.kairos.predict!.toLowerCase());
    expect(c.deployBlocks.predict).toBeGreaterThan(0);
  });
  test("a malformed private key is refused without echoing it", () => {
    try {
      loadConfig({ DATABASE_URL: "postgres://x", APP_FEE_PAYER_PRIVATE_KEY: "zz-secret-zz" }, "test");
      throw new Error("should throw");
    } catch (e) {
      expect((e as Error).message).not.toMatch(/zz-secret-zz/);
    }
  });
  test("service token compare", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // sha256("test")
    expect(matchesServiceToken("test", hash)).toBe(true);
    expect(matchesServiceToken("test2", hash)).toBe(false);
    expect(matchesServiceToken("test", undefined)).toBe(false);
  });
});

describe("shared helpers", () => {
  test("email normalisation", () => {
    expect(normaliseEmail(" Min.Ji+promo@GoogleMail.com ")?.address).toBe("minji@gmail.com");
    expect(normaliseEmail("min.ji+x@naver.com")?.address).toBe("min.ji@naver.com");
    expect(normaliseEmail("a.b+c@naver.com", "none")?.address).toBe("a.b+c@naver.com");
    expect(normaliseEmail("a@@b.com")).toBeNull();
    expect(normaliseEmail("+x@gmail.com")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
  });
  test("invite codes and masking", () => {
    expect(normaliseInviteCode(" ab-c2 34x")).toBe("ABC234X");
    expect(isInviteCodeShape("ABC234X")).toBe(true);
    expect(isInviteCodeShape("ABC1234")).toBe(false);
    expect(maskName("minjikim")).toBe("mi*****m");
    expect(maskName("하늘")).toBe("하*");
  });
  test("Privy user record: email and the embedded wallet only", () => {
    const p = profileFromPrivyUser({
      linked_accounts: [
        { type: "wallet", chain_type: "ethereum", wallet_client_type: "metamask", address: "0x1111111111111111111111111111111111111111" },
        { type: "email", address: "a@gmail.com" },
        { type: "wallet", chain_type: "ethereum", wallet_client_type: "privy", connector_type: "embedded", address: "0xAbCdEf0000000000000000000000000000000001" },
      ],
    });
    expect(p).toEqual({ email: "a@gmail.com", wallet: "0xabcdef0000000000000000000000000000000001" });
  });
});

describe("dev bypass", () => {
  let k: TestKit;
  beforeAll(async () => {
    k = await buildTestApp({ devBypass: true });
  });
  afterAll(async () => k.close());

  test("X-Dev-User names a deterministic user", async () => {
    const r = await k.app.inject({ method: "POST", url: "/v1/session", headers: { "x-dev-user": "minji" }, payload: {} });
    expect(r.statusCode).toBe(200);
    expect(r.json().wallet).toBe(devIdentity("minji").wallet);
    const me = await k.app.inject({ method: "GET", url: "/v1/me", headers: { "x-dev-user": "minji" } });
    expect(me.json().emailDomain).toBe("gmail.com");
  });
  test("X-Dev-Admin works for an allow listed email", async () => {
    await k.db.insertInto("admin_users").values({ privy_user_id: "email:dev@cojam.app", email: "dev@cojam.app", role: "owner", added_by: "test" }).execute();
    const r = await k.app.inject({ method: "GET", url: "/admin/v1/me", headers: { "x-dev-admin": "dev@cojam.app" } });
    expect(r.json().role).toBe("owner");
  });
  test("without the bypass the header is ignored", async () => {
    const plain = await buildTestApp();
    try {
      const r = await plain.app.inject({ method: "POST", url: "/v1/session", headers: { "x-dev-user": "minji" }, payload: {} });
      expect(r.statusCode).toBe(401);
      const a = await plain.app.inject({ method: "GET", url: "/admin/v1/me", headers: { "x-dev-admin": "dev@cojam.app" } });
      expect(a.statusCode).toBe(401);
    } finally {
      await plain.close();
    }
  });
});
