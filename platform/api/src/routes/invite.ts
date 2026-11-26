// Friend invites: GET /v1/invite, GET /v1/invite/lookup (public), POST /v1/invite/redeem.
// Rules (DECISIONS "Friend invites", "Invite code entry", "On hold: staking and invites", "Welcome bonus with a late code"):
//   * a code can be bound at registration or once within 24 h after it (setReferrer); the welcome bonus is still paid
//   * no self invites, no two way links, one inviter for good, 30 links per inviter per day
//   * codes of an inviter on hold (or unregistered) are refused as unknown; a player on hold cannot invite (code hidden)
import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Address } from "viem";
import { sql, type Db } from "../db/index.ts";
import type { User } from "../db/types.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { LimitHit, takeSlots, utcHour } from "../server/limits.ts";
import { DEFAULT_PARAMS, chainTry, predictParams, publicName, requirePlayer, toUnix } from "./common.ts";
import { INVITE_ALPHABET, INVITE_LENGTH, INVITE_MIN_LENGTH, inviteLink, isInviteCodeShape, normaliseInviteCode } from "../../../shared/src/invite.ts";
import { INVITE_WINDOW_SECONDS, currentDayId, weekOf, weekFirstDay } from "../../../shared/src/time.ts";
import type { InviteResponse, InviteSummary, InviteLookupResponse, InviteRedeemResponse } from "../../../shared/src/api.ts";

export function newInviteCode(): string {
  let s = "";
  for (let i = 0; i < INVITE_LENGTH; i++) s += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return s;
}

/** The player's own code, created once (at session creation), never changed. */
export async function ensureInviteCode(db: Db, wallet: string): Promise<string> {
  const existing = await db.selectFrom("invites").select("code").where("wallet", "=", wallet).executeTakeFirst();
  if (existing) return existing.code;
  for (let i = 0; i < 8; i++) {
    const code = newInviteCode();
    const r = await db.insertInto("invites").values({ code, wallet }).onConflict((oc) => oc.doNothing()).executeTakeFirst();
    if (Number(r.numInsertedOrUpdatedRows ?? 0) > 0) return code;
    const mine = await db.selectFrom("invites").select("code").where("wallet", "=", wallet).executeTakeFirst();
    if (mine) return mine.code;
  }
  throw new ApiError("INTERNAL", "Could not create an invite code");
}

/** Unix seconds until which a code may still be entered (null when not registered yet). */
function enterUntil(user: User): number | null {
  return user.registered_at ? Math.floor(user.registered_at.getTime() / 1000) + INVITE_WINDOW_SECONDS : null;
}

export async function inviteSummary(db: Db, user: User, appUrl: string, nowMs: number): Promise<InviteSummary> {
  const wallet = user.wallet;
  const code = wallet ? (await db.selectFrom("invites").select(["code", "enabled"]).where("wallet", "=", wallet).executeTakeFirst()) : undefined;
  const visible = Boolean(code && code.enabled && user.registration === "registered" && !user.frozen);
  const ref = wallet ? await db.selectFrom("referrals").select("inviter").where("invitee", "=", wallet).executeTakeFirst() : undefined;
  let linkedTo: { name: string } | null = null;
  if (ref) {
    const inviter = await db.selectFrom("users").select(["display_name", "wallet"]).where("wallet", "=", ref.inviter).executeTakeFirst();
    linkedTo = { name: publicName(inviter, ref.inviter) };
  }
  const until = enterUntil(user);
  const canEnterCode =
    !ref && user.registration !== "refused" && !user.frozen && (user.registration === "pending" || (until !== null && nowMs / 1000 < until));
  return {
    code: visible ? code!.code : null,
    link: visible ? inviteLink(code!.code, appUrl) : null,
    linkedTo,
    canEnterCode,
    enterCodeUntil: until,
  };
}

/** Resolves a code to a usable inviter, or throws INVITE_SHORT / INVITE_UNKNOWN. */
export async function resolveCode(db: Db, rawCode: string): Promise<{ code: string; inviter: User }> {
  const code = normaliseInviteCode(rawCode);
  if (code.length < INVITE_MIN_LENGTH) throw new ApiError("INVITE_SHORT");
  if (!isInviteCodeShape(code)) throw new ApiError("INVITE_UNKNOWN");
  const row = await db.selectFrom("invites").select(["wallet", "enabled"]).where("code", "=", code).executeTakeFirst();
  if (!row || !row.enabled) throw new ApiError("INVITE_UNKNOWN");
  const inviter = await db.selectFrom("users").selectAll().where("wallet", "=", row.wallet).executeTakeFirst();
  if (!inviter || inviter.registration !== "registered" || inviter.frozen) throw new ApiError("INVITE_UNKNOWN");
  return { code, inviter };
}

/**
 * Validates and binds a code for `user`, then queues the operator transaction: the pending registerPlayer gets the
 * inviter, or a setReferrer is queued (registered players, inside 24 h). Returns the inviter's public name.
 */
export async function redeemInvite(
  kit: RouteKit,
  user: User,
  rawCode: string,
  source: "session" | "first_run" | "profile",
): Promise<{ inviterName: string }> {
  const { db } = kit.deps;
  const nowMs = kit.deps.now();
  const wallet = user.wallet as Address | null;
  if (!wallet) throw new ApiError("WALLET_MISSING");
  if (user.frozen) throw new ApiError("FROZEN");
  if (user.registration === "refused") throw new ApiError("REGISTRATION_REFUSED");
  const { code, inviter } = await resolveCode(db, rawCode);
  const inviterWallet = inviter.wallet!;
  if (inviterWallet === wallet) throw new ApiError("INVITE_OWN");

  const existing = await db.selectFrom("referrals").select("inviter").where("invitee", "=", wallet).executeTakeFirst();
  if (existing) {
    const who = await db.selectFrom("users").select(["display_name", "wallet"]).where("wallet", "=", existing.inviter).executeTakeFirst();
    throw new ApiError("INVITE_ALREADY_LINKED", undefined, { inviterName: publicName(who, existing.inviter) });
  }
  if (user.registration === "registered") {
    let registeredAt = toUnix(user.registered_at);
    if (registeredAt === null) {
      const p = await chainTry(() => kit.deps.chain.player(wallet));
      registeredAt = p?.registered ? p.registeredAt : null;
    }
    if (registeredAt === null || nowMs / 1000 >= registeredAt + INVITE_WINDOW_SECONDS) throw new ApiError("INVITE_TOO_LATE");
  }
  // Two way link: the inviter was invited by this player.
  const reverse = await db.selectFrom("referrals").select("invitee").where("invitee", "=", inviterWallet).where("inviter", "=", wallet).executeTakeFirst();
  if (reverse) throw new ApiError("INVITE_LIMIT", "A two way link is not allowed");

  const today = currentDayId(nowMs);
  const cap = kit.deps.config.env.INVITE_LINKS_PER_INVITER_PER_DAY;
  const inviterName = publicName(inviter, inviterWallet);
  await db.transaction().execute(async (trx) => {
    const bumped = await sql<{ links_today: number }>`
      UPDATE invites SET links_today = CASE WHEN links_day = ${today} THEN links_today + 1 ELSE 1 END, links_day = ${today}
      WHERE code = ${code} AND (links_day IS DISTINCT FROM ${today} OR links_today < ${cap})
      RETURNING links_today`.execute(trx);
    if (!bumped.rows.length) throw new ApiError("INVITE_LIMIT", "The inviter reached the daily link cap");
    const ins = await trx
      .insertInto("referrals")
      .values({ invitee: wallet, inviter: inviterWallet, code, source })
      .onConflict((oc) => oc.column("invitee").doNothing())
      .executeTakeFirst();
    if (Number(ins.numInsertedOrUpdatedRows ?? 0) === 0) throw new ApiError("INVITE_ALREADY_LINKED", undefined, { inviterName });

    if (user.registration === "pending") {
      // Put the inviter on the queued registration if it has not been sent yet; otherwise follow up with setReferrer.
      const upd = await trx
        .updateTable("registration_requests")
        .set({ referrer: inviterWallet, invite_code: code, updated_at: new Date() })
        .where("wallet", "=", wallet)
        .where("kind", "=", "register")
        .where("status", "=", "queued")
        .executeTakeFirst();
      if (Number(upd.numUpdatedRows) === 0) {
        await trx
          .insertInto("registration_requests")
          .values({ kind: "set_referrer", wallet, referrer: inviterWallet, invite_code: code })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
      await trx.updateTable("users").set({ pending_invite_code: code, updated_at: new Date() }).where("id", "=", user.id).execute();
    } else {
      await trx
        .insertInto("registration_requests")
        .values({ kind: "set_referrer", wallet, referrer: inviterWallet, invite_code: code })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  });
  return { inviterName };
}

export function registerInviteRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const env = deps.config.env;

  app.get("/v1/invite/lookup", async (req): Promise<InviteLookupResponse> => {
    const { code } = z.object({ code: z.string().max(32) }).parse(req.query);
    const ip = kit.ipHashOf(req);
    if (ip) {
      try {
        await takeSlots(deps.db, [{ bucket: utcHour(deps.now()), key: `invitelookup:ip:${ip}`, limit: env.INVITE_LOOKUP_IP_PER_HOUR, code: "RATE_LIMITED_IP" }]);
      } catch (e) {
        if (e instanceof LimitHit) throw new ApiError("RATE_LIMITED_IP");
        throw e;
      }
    }
    try {
      const { inviter } = await resolveCode(deps.db, code);
      return { valid: true, inviterName: publicName(inviter) };
    } catch (e) {
      if (e instanceof ApiError && (e.code === "INVITE_SHORT" || e.code === "INVITE_UNKNOWN")) return { valid: false };
      throw e;
    }
  });

  app.get("/v1/invite", async (req): Promise<InviteResponse> => {
    const { user, wallet } = await requirePlayer(kit, req);
    const nowMs = deps.now();
    const summary = await inviteSummary(deps.db, user, env.APP_URL, nowMs);
    const params = (await predictParams(deps.db, deps.chain, nowMs)) ?? DEFAULT_PARAMS;
    const friends = await deps.db
      .selectFrom("referrals as r")
      .leftJoin("users as u", "u.wallet", "r.invitee")
      .select(["r.invitee", "r.requested_at", "r.bound_at", "r.first_day_at", "r.bonus_points", "u.display_name", "u.wallet"])
      .where("r.inviter", "=", wallet)
      .orderBy("r.requested_at", "desc")
      .execute();
    const week = weekOf(currentDayId(nowMs));
    const weekBonus = await deps.db
      .selectFrom("points_ledger")
      .select(sql<number>`coalesce(sum(amount), 0)::bigint`.as("s"))
      .where("wallet", "=", wallet)
      .where("kind", "=", "referral")
      .where("day_id", ">=", weekFirstDay(week))
      .executeTakeFirst();
    const lifetime = await deps.db
      .selectFrom("points_ledger")
      .select(sql<number>`coalesce(sum(amount), 0)::bigint`.as("s"))
      .where("wallet", "=", wallet)
      .where("kind", "=", "referral")
      .executeTakeFirst();
    return {
      code: summary.code,
      link: summary.link,
      available: summary.code !== null,
      referralBps: params.referralBps,
      welcomePoints: params.welcomePoints,
      stats: {
        friendsJoined: friends.length,
        friendsFirstDayDone: friends.filter((f) => f.first_day_at).length,
        bonusLifetime: Number(lifetime?.s ?? 0),
        bonusThisWeek: Number(weekBonus?.s ?? 0),
      },
      recent: friends.slice(0, 10).map((f) => ({
        name: publicName({ display_name: f.display_name, wallet: f.wallet }, f.invitee),
        joinedAt: toUnix(f.bound_at ?? f.requested_at)!,
        state: f.first_day_at ? "first_day_done" : "joined",
        bonusPoints: f.bonus_points,
      })),
      linkedTo: summary.linkedTo,
      canEnterCode: summary.canEnterCode,
      enterCodeUntil: summary.enterCodeUntil,
    };
  });

  const redeemBody = z.object({ code: z.string().max(32), source: z.enum(["first_run", "profile"]).optional() });
  app.post("/v1/invite/redeem", async (req): Promise<InviteRedeemResponse> => {
    const { code, source } = redeemBody.parse(req.body);
    const { user } = await requirePlayer(kit, req);
    try {
      await takeSlots(deps.db, [{ bucket: utcHour(deps.now()), key: `inviteredeem:${user.id}`, limit: env.INVITE_REDEEM_PER_HOUR, code: "RATE_LIMITED_USER" }]);
    } catch (e) {
      if (e instanceof LimitHit) throw new ApiError("RATE_LIMITED_USER");
      throw e;
    }
    const r = await redeemInvite(kit, user, code, source ?? "first_run");
    return { status: "linked", inviterName: r.inviterName, chain: "queued" };
  });
}
