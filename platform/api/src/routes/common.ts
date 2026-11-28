// Helpers shared by the route modules.
import type { Address } from "viem";
import type { Db } from "../db/index.ts";
import { getState, STATE_KEYS } from "../db/index.ts";
import type { Market, User } from "../db/types.ts";
import type { ChainReader, PredictParams } from "../chain/index.ts";
import { ApiError } from "../server/errors.ts";
import type { RouteKit } from "../server/app.ts";
import type { FastifyRequest } from "fastify";
import type { AuthedUser } from "../auth/index.ts";
import { maskName, shortAddress } from "../../../shared/src/invite.ts";
import type { MarketTexts, Choice } from "../../../shared/src/api.ts";
import { dayEnd, isLongQuestion, SECONDS_PER_DAY } from "../../../shared/src/time.ts";
import { effectiveTiming, storedTiming } from "../ai/timing.ts";

export const toUnix = (d: Date | null | undefined): number | null => (d ? Math.floor(d.getTime() / 1000) : null);

/** Wraps a chain read: transport failures become RPC_UNAVAILABLE. */
export async function chainRead<T>(fn: () => Promise<T>, what = "chain read"): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("RPC_UNAVAILABLE", `Kaia RPC is unavailable (${what})`);
  }
}

/** Same, but null instead of an error (for optional live enrichments). */
export async function chainTry<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function userByPrivy(db: Db, privyUserId: string): Promise<User | undefined> {
  return db.selectFrom("users").selectAll().where("privy_user_id", "=", privyUserId).executeTakeFirst();
}

/** Authenticated caller plus their users row (404 NOT_REGISTERED when POST /v1/session was never called). */
export async function requireUserRow(kit: RouteKit, req: FastifyRequest): Promise<{ auth: AuthedUser; user: User }> {
  const auth = (await kit.authUser(req))!;
  const user = await userByPrivy(kit.deps.db, auth.privyUserId);
  if (!user) throw new ApiError("NOT_REGISTERED", "Call POST /v1/session first");
  return { auth, user };
}

/** Same, and the user must have a wallet. */
export async function requirePlayer(kit: RouteKit, req: FastifyRequest): Promise<{ auth: AuthedUser; user: User; wallet: Address }> {
  const r = await requireUserRow(kit, req);
  const wallet = (r.user.wallet ?? r.auth.wallet) as Address | null;
  if (!wallet) throw new ApiError("WALLET_MISSING");
  return { ...r, wallet };
}

/** Public display name of a player: masked display name or the short address. */
export function publicName(u: { display_name: string | null; wallet: string | null } | undefined, wallet?: string): string {
  if (u?.display_name) return maskName(u.display_name);
  const w = u?.wallet ?? wallet ?? "";
  return shortAddress(w);
}

const paramsCache = new WeakMap<object, { p: PredictParams; until: number }>();
/** CojamPredict params: the worker's snapshot in app_state, else a live read (cached 60 s). */
export async function predictParams(db: Db, chain: ChainReader, nowMs: number): Promise<PredictParams | null> {
  const hit = paramsCache.get(chain);
  if (hit && hit.until > nowMs) return hit.p;
  const snap = await getState<PredictParams>(db, STATE_KEYS.predictParams);
  let p: PredictParams | null = snap?.value && typeof (snap.value as any).pointsPerCT === "number" ? snap.value : null;
  if (!p) p = await chainTry(() => chain.params());
  if (p) paramsCache.set(chain, { p, until: nowMs + 60_000 });
  return p;
}

export const DEFAULT_PARAMS: PredictParams = {
  completionPoints: 100,
  hitPoints: 50,
  referralBps: 1000,
  welcomePoints: 100,
  settleDelay: 6 * 3600,
  pointsPerCT: 1000,
  minConvertPoints: 1000,
  maxConvertCtPerUserPerDay: 50,
  maxConvertCtPerDay: 20000,
  minAccountAge: 7 * 86400,
  minResolveGap: 3600,
  maxWeeklyPool: 10000,
  airdropDelay: 60 * 3600,
  treasury: "0x0000000000000000000000000000000000000000",
  splitBps: [3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300],
  maxResolveAfterClose: 30 * 86400,
};

/** Statuses of markets that are on chain (visible to players). */
export const LIVE_STATUSES = ["published", "closed", "resolved", "voided", "corrected"] as const;

export function imageUrls(m: Pick<Market, "image_url" | "image_key">, base: string): { imageUrl: string | null; thumbUrl: string | null } {
  const b = base.replace(/\/$/, "");
  const imageUrl = m.image_url ?? (m.image_key ? `${b}/${m.image_key}` : null);
  // Thumbnails are stored next to the image: <key without extension>.thumb.webp (worker convention).
  const thumbUrl = m.image_key ? `${b}/${m.image_key.replace(/\.[a-z0-9]+$/i, "")}.thumb.webp` : null;
  return { imageUrl, thumbUrl };
}

export function marketTexts(m: Pick<Market, "content">): MarketTexts {
  const c = m.content as unknown as MarketTexts;
  return { en: c.en, ko: c.ko, ja: c.ja };
}

export function asChoice(n: number | null | undefined): Choice | null {
  return n === 1 || n === 2 ? n : null;
}

export function popcount(n: number): number {
  let c = 0;
  for (let x = n; x; x &= x - 1) c++;
  return c;
}

/**
 * Answer window of a question placed by hand (DECISIONS "Longer questions mixed in"): due between the day's end and
 * 24 hours after it, or a long question up to the admin's longMaxDays after it while the day has room for one more long
 * question. Long questions need LONG_QUESTIONS_ON_CHAIN (the contract with a per market answer deadline).
 */
export async function checkAnswerWindow(deps: RouteKit["deps"], dayId: number, resolvesAt: number, replacing?: number): Promise<void> {
  const end = dayEnd(dayId);
  if (!Number.isFinite(resolvesAt) || resolvesAt < end) throw new ApiError("BAD_REQUEST", "The answer must be due after the day's end");
  if (!isLongQuestion(dayId, resolvesAt)) return;
  const t = effectiveTiming(await storedTiming(deps.db), Boolean(deps.config.env.LONG_QUESTIONS_ON_CHAIN));
  if (t.maxLong === 0) throw new ApiError("BAD_REQUEST", "The answer must be due between the day's end and 24 hours after it (long questions are off)");
  if (resolvesAt > end + t.longMaxDays * SECONDS_PER_DAY) throw new ApiError("BAD_REQUEST", `A long question must be answered at most ${t.longMaxDays} days after the day's end`);
  const others = await deps.db
    .selectFrom("markets")
    .select(["market_id", "resolves_at"])
    .where("day_id", "=", dayId)
    .where("status", "not in", ["cancelled"])
    .execute();
  const longs = others.filter((m) => m.market_id !== replacing && isLongQuestion(dayId, Math.floor(m.resolves_at.getTime() / 1000))).length;
  if (longs >= t.maxLong) throw new ApiError("BAD_REQUEST", `The day already has ${longs} long questions (at most ${t.maxLong})`);
}
