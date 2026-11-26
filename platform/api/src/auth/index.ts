// Request authentication for user and admin routes.
//   userAuth(deps)(req, { optional })  -> AuthedUser | null
//   adminAuth(deps)(req, minRole)      -> AuthedAdmin
// Users: Authorization: Bearer <Privy access token>. With AUTH_DEV_BYPASS=1 (refused in production by
// loadConfig) the header X-Dev-User: <name> stands in for a token. Admins: a token of the separate admin Privy
// app, accepted only for an email on admin_users; dev bypass header X-Dev-Admin: <email>.
import type { FastifyRequest } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import { takeSlots, utcMinute, LimitHit } from "../server/limits.ts";
import type { Address } from "viem";
import { ApiError } from "../server/errors.ts";
import type { Deps } from "../server/deps.ts";
import { AuthFailed, type AuthVerifier } from "./privy.ts";
import type { AdminRole } from "../db/types.ts";

export interface AuthedUser {
  privyUserId: string;
  email: string | null;
  wallet: Address | null;
}
export interface AuthedAdmin {
  privyUserId: string;
  email: string;
  role: AdminRole;
}

const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, operator: 1, owner: 2 };

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

function header(req: FastifyRequest, name: string): string | null {
  const v = req.headers[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function verifyWith(v: AuthVerifier, token: string, fresh = false): Promise<AuthedUser> {
  let t;
  try {
    t = await v.verify(token);
  } catch (e) {
    throw new ApiError("UNAUTHORIZED", e instanceof AuthFailed ? "The access token is invalid or expired" : "Token verification failed");
  }
  let profile;
  try {
    profile = await v.profile(t.privyUserId, { fresh });
  } catch {
    throw new ApiError("INTERNAL", "Could not read the Privy user record; try again shortly");
  }
  return { privyUserId: t.privyUserId, email: profile.email, wallet: profile.wallet };
}

export function makeUserAuth(deps: Deps) {
  return async function authUser(req: FastifyRequest, opts: { optional?: boolean; fresh?: boolean } = {}): Promise<AuthedUser | null> {
    const dev = deps.devAuth && !deps.config.isProduction ? header(req, "x-dev-user") : null;
    if (dev && deps.devAuth) return verifyWith(deps.devAuth, `dev:${dev}`, opts.fresh);
    const token = bearer(req);
    if (!token) {
      if (opts.optional) return null;
      throw new ApiError("UNAUTHORIZED");
    }
    if (!deps.userAuth) throw new ApiError("NOT_CONFIGURED", "PRIVY_APP_ID is not configured");
    return verifyWith(deps.userAuth, token, opts.fresh);
  };
}

/** Actor name of the operations agent (service token). Never more than the operator role. */
export const OPS_AGENT = "ops-agent";

/** True when `token` hashes to the configured ADMIN_SERVICE_TOKEN_SHA256 (constant time compare). */
export function matchesServiceToken(token: string, expectedHex: string | undefined): boolean {
  if (!expectedHex) return false;
  const got = createHash("sha256").update(token, "utf8").digest();
  const want = Buffer.from(expectedHex, "hex");
  return want.length === got.length && timingSafeEqual(got, want);
}

export function makeAdminAuth(deps: Deps) {
  return async function authAdmin(req: FastifyRequest, minRole: AdminRole = "viewer"): Promise<AuthedAdmin> {
    const raw = bearer(req);
    if (raw && matchesServiceToken(raw, deps.config.env.ADMIN_SERVICE_TOKEN_SHA256)) {
      try {
        await takeSlots(deps.db, [
          { bucket: utcMinute(deps.now()), key: `admin:${OPS_AGENT}`, limit: deps.config.env.ADMIN_SERVICE_PER_MINUTE, code: "RATE_LIMITED_USER" },
        ]);
      } catch (e) {
        if (e instanceof LimitHit) throw new ApiError("RATE_LIMITED_USER", "The operations agent is over its per minute limit");
        throw e;
      }
      if (ROLE_RANK.operator < ROLE_RANK[minRole]) throw new ApiError("ADMIN_FORBIDDEN", `Needs the ${minRole} role (the operations agent is an operator)`);
      return { privyUserId: OPS_AGENT, email: OPS_AGENT, role: "operator" };
    }
    let identity: { privyUserId: string; email: string | null };
    const dev = deps.devAuth && !deps.config.isProduction ? header(req, "x-dev-admin") : null;
    if (dev) {
      identity = { privyUserId: `dev-admin:${dev.toLowerCase()}`, email: dev.toLowerCase() };
    } else {
      const token = bearer(req);
      if (!token) throw new ApiError("UNAUTHORIZED");
      if (!deps.adminAuth) throw new ApiError("NOT_CONFIGURED", "PRIVY_ADMIN_APP_ID is not configured");
      const u = await verifyWith(deps.adminAuth, token);
      identity = { privyUserId: u.privyUserId, email: u.email?.toLowerCase() ?? null };
    }
    let row = await deps.db.selectFrom("admin_users").selectAll().where("privy_user_id", "=", identity.privyUserId).executeTakeFirst();
    if (!row && identity.email) {
      row = await deps.db.selectFrom("admin_users").selectAll().where("email", "=", identity.email).executeTakeFirst();
      // First login binds the seeded placeholder id ('email:<address>') to the real Privy id.
      if (row && row.privy_user_id.startsWith("email:") && !dev) {
        await deps.db.updateTable("admin_users").set({ privy_user_id: identity.privyUserId }).where("email", "=", row.email).execute();
        row = { ...row, privy_user_id: identity.privyUserId };
      }
    }
    if (!row) throw new ApiError("FORBIDDEN", "This account is not on the admin allow list");
    if (ROLE_RANK[row.role] < ROLE_RANK[minRole]) throw new ApiError("ADMIN_FORBIDDEN", `Needs the ${minRole} role (you are ${row.role})`);
    return { privyUserId: row.privy_user_id, email: row.email, role: row.role };
  };
}
