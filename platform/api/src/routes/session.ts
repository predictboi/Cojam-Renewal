// POST /v1/session, GET /v1/session, GET /v1/me, PATCH /v1/me.
// POST /v1/session is the login bootstrap (DEV-PLAN 6.2, 5.1, 5.2): it creates the user row, re-checks the
// verified email from Privy against the allow list and the normalised address, applies the sign up limits and
// queues the registration (registration_requests, sent by the worker within about 10 s, with the inviter when a
// valid code came along). It never registers on chain itself.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Address } from "viem";
import { sql, audit, type Db } from "../db/index.ts";
import type { User } from "../db/types.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { emailHash } from "../server/hash.ts";
import { peekCount, takeSlots, utcDay, utcHour, LimitHit } from "../server/limits.ts";
import type { AuthedUser } from "../auth/index.ts";
import { checkEmail } from "./public.ts";
import { ensureInviteCode, inviteSummary, redeemInvite } from "./invite.ts";
import { chainTry, popcount, requireUserRow, toUnix, userByPrivy } from "./common.ts";
import type { MeResponse, PlayKeyState, SessionResponse } from "../../../shared/src/api.ts";

async function playKeyState(kit: RouteKit, user: User): Promise<PlayKeyState | null> {
  if (!user.wallet || user.registration !== "registered") return null;
  const nowS = Math.floor(kit.deps.now() / 1000);
  const row = await kit.deps.db
    .selectFrom("play_keys")
    .select(["key", "expires_at"])
    .where("wallet", "=", user.wallet)
    .where("revoked_tx", "is", null)
    .where("replaced_by", "is", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (row) {
    const exp = toUnix(row.expires_at)!;
    return { key: row.key as Address, expiresAt: exp, valid: exp > nowS };
  }
  const live = await chainTry(() => kit.deps.chain.playKeyOf(user.wallet as Address));
  if (live && !/^0x0{40}$/i.test(live.key)) return { key: live.key.toLowerCase() as Address, expiresAt: live.expiresAt, valid: live.expiresAt > nowS };
  return null;
}

/** Self heal while pending: if the chain already shows the player, mark it registered (the worker normally does). */
async function syncRegistration(kit: RouteKit, user: User): Promise<User> {
  if (user.registration !== "pending" || !user.wallet) return user;
  const p = await chainTry(() => kit.deps.chain.player(user.wallet as Address));
  if (!p?.registered) return user;
  const registered_at = new Date(p.registeredAt * 1000);
  await kit.deps.db
    .updateTable("users")
    .set({ registration: "registered", registered_at, frozen: p.frozen, updated_at: new Date() })
    .where("id", "=", user.id)
    .where("registration", "=", "pending")
    .execute();
  return { ...user, registration: "registered", registered_at, frozen: p.frozen };
}

async function sessionBody(kit: RouteKit, user: User, extra: Partial<SessionResponse> = {}): Promise<SessionResponse> {
  return {
    registration: user.registration,
    reason: user.refusal_reason,
    wallet: (user.wallet as Address) ?? null,
    frozen: user.frozen,
    playKey: await playKeyState(kit, user),
    invite: await inviteSummary(kit.deps.db, user, kit.deps.config.env.APP_URL, kit.deps.now()),
    ...extra,
  };
}

/** Sign up limits of DEV-PLAN 5.2. Returns a refusal code, or null; records the counters when allowed. */
async function signupLimits(kit: RouteKit, ip: string | null, device: string | null): Promise<{ refuse: string | null; flags: string[] }> {
  const env = kit.deps.config.env;
  const db = kit.deps.db;
  const nowMs = kit.deps.now();
  const day = utcDay(nowMs);
  const flags: string[] = [];
  const slots = [];
  if (ip) slots.push({ bucket: day, key: `signup:ip:${ip}`, limit: env.SIGNUP_IP_PER_DAY, code: "SIGNUP_RATE_LIMITED" });
  if (device) {
    slots.push({ bucket: day, key: `signup:device:${device}`, limit: env.SIGNUP_DEVICE_PER_DAY, code: "SIGNUP_RATE_LIMITED" });
    slots.push({ bucket: "total", key: `signup:device:${device}`, limit: env.SIGNUP_DEVICE_TOTAL, code: "SIGNUP_RATE_LIMITED" });
  }
  try {
    await takeSlots(db, slots);
  } catch (e) {
    if (e instanceof LimitHit) return { refuse: "SIGNUP_RATE_LIMITED", flags };
    throw e;
  }
  if (ip && (await peekCount(db, day, `signup:ip:${ip}`)) > env.SIGNUP_IP_FLAG_PER_DAY) flags.push("cluster_network");
  // Global burst: 5x the 7 day hourly average, at least SIGNUP_GLOBAL_PER_HOUR_MIN. Above it sign ups still queue,
  // flagged for the risk check and an alert (the worker throttles registrations).
  const hourKey = utcHour(nowMs);
  await sql`INSERT INTO usage_daily (day, key, count) VALUES (${hourKey}, 'signup:global', 1)
            ON CONFLICT (day, key) DO UPDATE SET count = usage_daily.count + 1`.execute(db);
  const lastHour = await peekCount(db, hourKey, "signup:global");
  const week = await sql<{ n: number }>`SELECT count(*)::int AS n FROM users WHERE created_at > now() - interval '7 days'`.execute(db);
  const avg = (week.rows[0]?.n ?? 0) / (7 * 24);
  if (lastHour > Math.max(env.SIGNUP_GLOBAL_PER_HOUR_MIN, avg * 5)) flags.push("signup_burst");
  return { refuse: null, flags };
}

async function createOrLoad(kit: RouteKit, auth: AuthedUser, ip: string | null, device: string | null): Promise<{ user: User; created: boolean }> {
  const db: Db = kit.deps.db;
  const existing = await userByPrivy(db, auth.privyUserId);
  if (existing) {
    if (!existing.wallet && auth.wallet) {
      await db.updateTable("users").set({ wallet: auth.wallet, updated_at: new Date() }).where("id", "=", existing.id).execute();
      existing.wallet = auth.wallet;
    }
    return { user: existing, created: false };
  }
  if (!auth.email) throw new ApiError("EMAIL_MISSING");
  if (!auth.wallet) throw new ApiError("WALLET_MISSING");
  const walletOwner = await db.selectFrom("users").select("id").where("wallet", "=", auth.wallet).executeTakeFirst();
  if (walletOwner) throw new ApiError("CONFLICT", "This wallet already belongs to another account");

  const check = await checkEmail(db, auth.email);
  const hashKey = kit.deps.config.env.EMAIL_HASH_KEY ?? "dev-email-key";
  const base = {
    privy_user_id: auth.privyUserId,
    wallet: auth.wallet,
    device_id_first: device,
    ip_hash_first: ip,
  };
  const refuse = async (reason: string, domain: string | null, hash: string | null) => {
    const user = await db
      .insertInto("users")
      .values({ ...base, email_domain: domain, email_hash: hash, registration: "refused", refusal_reason: reason })
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(db, { actor: "session", action: "registration.refused", target: auth.wallet, payload: { reason } });
    return { user, created: true };
  };
  if (!check.ok) return refuse(check.reason, check.domain, null);
  const hash = emailHash(hashKey, check.normalised);
  const dup = await db.selectFrom("users").select("id").where("email_hash", "=", hash).where("registration", "<>", "refused").executeTakeFirst();
  if (dup) return refuse("EMAIL_DUPLICATE", check.domain, hash);
  const limits = await signupLimits(kit, ip, device);
  if (limits.refuse) return refuse(limits.refuse, check.domain, hash);

  let user: User;
  try {
    user = await db.transaction().execute(async (trx) => {
      const u = await trx
        .insertInto("users")
        .values({ ...base, email_domain: check.domain, email_hash: hash, registration: "pending" })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto("registration_requests").values({ kind: "register", wallet: auth.wallet! }).execute();
      for (const rule of limits.flags) {
        await trx
          .insertInto("risk_flags")
          .values({ wallet: auth.wallet!, rule, score: 0, run: "signup", details: JSON.stringify({ source: "session", ip, device }) })
          .execute();
      }
      return u;
    });
  } catch (e) {
    // Unique violation: a parallel session call created the same user or another player took the address.
    if ((e as { code?: string }).code === "23505") {
      const again = await userByPrivy(db, auth.privyUserId);
      if (again) return { user: again, created: false };
      return refuse("EMAIL_DUPLICATE", check.domain, null);
    }
    throw e;
  }
  await ensureInviteCode(db, auth.wallet);
  return { user, created: true };
}

export function registerSessionRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;

  const sessionReq = z.object({ inviteCode: z.string().max(32).optional().nullable() }).nullable().optional();
  app.post("/v1/session", async (req): Promise<SessionResponse> => {
    const body = sessionReq.parse(req.body ?? null) ?? {};
    let auth = (await kit.authUser(req))!;
    if (!auth.wallet) auth = (await kit.authUser(req, { fresh: true }))!;
    const { user: loaded } = await createOrLoad(kit, auth, kit.ipHashOf(req), kit.deviceOf(req));
    let user = await syncRegistration(kit, loaded);
    if (user.wallet && user.registration !== "refused") await ensureInviteCode(deps.db, user.wallet);

    let inviteResult: SessionResponse["inviteResult"];
    const code = body.inviteCode?.trim();
    if (code && user.registration !== "refused") {
      try {
        const r = await redeemInvite(kit, user, code, "session");
        inviteResult = { status: user.registration === "pending" ? "queued" : "linked", code, inviterName: r.inviterName };
        user = (await userByPrivy(deps.db, auth.privyUserId)) ?? user;
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        inviteResult = { status: "rejected", code, error: e.code, ...(e.details?.inviterName ? { inviterName: String(e.details.inviterName) } : {}) };
      }
    }
    return sessionBody(kit, user, inviteResult ? { inviteResult } : {});
  });

  app.get("/v1/session", async (req): Promise<SessionResponse> => {
    const { user } = await requireUserRow(kit, req);
    return sessionBody(kit, await syncRegistration(kit, user));
  });

  async function meBody(user: User): Promise<MeResponse> {
    const w = user.wallet ?? "";
    const days = await deps.db
      .selectFrom("user_days")
      .select(["answered", "completed", "hits", "settled_mask"])
      .where("wallet", "=", w)
      .execute();
    const pts = await deps.db
      .selectFrom("points_ledger")
      .select(sql<number>`coalesce(sum(amount), 0)::bigint`.as("s"))
      .where("wallet", "=", w)
      .where("kind", "<>", "convert")
      .executeTakeFirst();
    const settled = days.reduce((a, d) => a + popcount(d.settled_mask), 0);
    const hits = days.reduce((a, d) => a + d.hits, 0);
    return {
      id: user.id,
      wallet: (user.wallet as Address) ?? null,
      emailDomain: user.email_domain,
      displayName: user.display_name,
      language: user.language,
      onboarded: user.onboarded,
      registration: user.registration,
      registeredAt: toUnix(user.registered_at),
      frozen: user.frozen,
      supportEmail: deps.config.supportEmail,
      createdAt: toUnix(user.created_at)!,
      stats: {
        daysPlayed: days.filter((d) => d.answered > 0).length,
        daysCompleted: days.filter((d) => d.completed).length,
        predictions: days.reduce((a, d) => a + d.answered, 0),
        hits,
        hitRate: settled ? hits / settled : null,
        pointsAllTime: Number(pts?.s ?? 0),
      },
    };
  }

  app.get("/v1/me", async (req): Promise<MeResponse> => {
    const { user } = await requireUserRow(kit, req);
    return meBody(user);
  });

  const patchBody = z
    .object({
      language: z.enum(["en", "ko", "ja"]).optional(),
      displayName: z
        .string()
        .trim()
        .min(2)
        .max(20)
        .regex(/^[^\p{C}<>@]+$/u, "letters, digits and simple punctuation only")
        .nullable()
        .optional(),
      onboarded: z.boolean().optional(),
    })
    .strict();
  app.patch("/v1/me", async (req): Promise<MeResponse> => {
    const body = patchBody.parse(req.body ?? {});
    const { user } = await requireUserRow(kit, req);
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (body.language !== undefined) set.language = body.language;
    if (body.displayName !== undefined) set.display_name = body.displayName;
    if (body.onboarded !== undefined) set.onboarded = body.onboarded;
    const updated = await deps.db.updateTable("users").set(set).where("id", "=", user.id).returningAll().executeTakeFirstOrThrow();
    return meBody(updated);
  });
}
