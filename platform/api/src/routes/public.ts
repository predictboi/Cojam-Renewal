// Public endpoints: GET /v1/config, GET /v1/health, POST /v1/auth/email-check.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql, getState, STATE_KEYS, type Db } from "../db/index.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { LimitHit, takeSlots, utcHour } from "../server/limits.ts";
import { emailHash } from "../server/hash.ts";
import { GAS_CAPS } from "../feeDelegation/policy.ts";
import { chainTry, predictParams } from "./common.ts";
import { normaliseEmail, splitEmail, type EmailRule } from "../../../shared/src/email.ts";
import { currentDayId, dayEnd, dayOpensAt, weekOf } from "../../../shared/src/time.ts";
import type { ConfigResponse, EmailCheckResponse, HealthResponse } from "../../../shared/src/api.ts";
import { kaiaToWei, type Config } from "../config/index.ts";

interface DomainRow {
  domain: string;
  display_name: string;
  rule: EmailRule;
  enabled: boolean;
}
let domainCache: { rows: DomainRow[]; until: number; db: Db } | null = null;

/** The email allow list (cached 60 s; admin edits call invalidateDomains). */
export async function emailDomains(db: Db): Promise<DomainRow[]> {
  if (domainCache && domainCache.db === db && domainCache.until > Date.now()) return domainCache.rows;
  const rows = await db.selectFrom("email_domains").select(["domain", "display_name", "rule", "enabled"]).orderBy("added_at").orderBy("domain").execute();
  domainCache = { rows, until: Date.now() + 60_000, db };
  return rows;
}
export function invalidateDomains(): void {
  domainCache = null;
}

/** Normalises an address against the allow list. */
export async function checkEmail(
  db: Db,
  email: string,
): Promise<{ ok: true; normalised: string; domain: string } | { ok: false; reason: "EMAIL_INVALID" | "EMAIL_DOMAIN_NOT_ALLOWED"; domain: string | null }> {
  const parts = splitEmail(email);
  if (!parts) return { ok: false, reason: "EMAIL_INVALID", domain: null };
  const row = (await emailDomains(db)).find((d) => d.domain === parts.domain && d.enabled);
  if (!row) return { ok: false, reason: "EMAIL_DOMAIN_NOT_ALLOWED", domain: parts.domain };
  const n = normaliseEmail(email, row.rule);
  if (!n) return { ok: false, reason: "EMAIL_INVALID", domain: parts.domain };
  return { ok: true, normalised: n.address, domain: n.domain };
}

const PUBLIC_RPC: Record<string, string> = {
  kaia: "https://public-en.node.kaia.io",
  kairos: "https://public-en-kairos.node.kaia.io",
  local: "http://localhost:8545",
};
const EXPLORER: Record<string, string> = { kaia: "https://kaiascan.io", kairos: "https://kairos.kaiascan.io", local: "https://kairos.kaiascan.io" };
export const publicRpcUrl = (network: string, override?: string): string => override ?? PUBLIC_RPC[network] ?? PUBLIC_RPC.kairos;
export const explorerUrlOf = (network: string): string => EXPLORER[network] ?? EXPLORER.kairos;

/** unix seconds from a number, a numeric string or an ISO date; null otherwise. */
function toUnixLoose(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim()) {
    if (/^\d+$/.test(v.trim())) return Number(v.trim());
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : Math.floor(t / 1000);
  }
  return null;
}

/** Maintenance: the app_state row "app.maintenance" when present, else the MAINTENANCE env fallback. */
export async function maintenanceState(db: Db, env: Config["env"]): Promise<ConfigResponse["maintenance"]> {
  // written by the admin switch (POST /admin/v1/app: { on, message, endsAt, since, by }) or by hand ({ on, message, backAt })
  const row = await getState<{ on?: boolean; message?: unknown; backAt?: unknown; endsAt?: unknown }>(db, STATE_KEYS.maintenance).catch(() => null);
  const v = row?.value ?? (env.MAINTENANCE ? { on: true, message: env.MAINTENANCE_MESSAGE, backAt: env.MAINTENANCE_BACK_AT } : null);
  if (!v || !v.on) return { on: false, message: null, backAt: null };
  let message: ConfigResponse["maintenance"]["message"] = null;
  if (typeof v.message === "string" && v.message.trim()) message = { en: v.message, ko: v.message, ja: v.message };
  else if (v.message && typeof v.message === "object") {
    const m = v.message as Record<string, unknown>;
    message = {};
    for (const l of ["en", "ko", "ja"] as const) if (typeof m[l] === "string" && (m[l] as string).trim()) message[l] = m[l] as string;
    if (!Object.keys(message).length) message = null;
  }
  return { on: true, message, backAt: toUnixLoose(v.backAt ?? (v as { endsAt?: unknown }).endsAt) };
}

const stakingCache = new WeakMap<object, { v: ConfigResponse["stakingLimits"]; until: number }>();
const CT_WEI = 10n ** 18n;
/** Staking limits: the worker's snapshot, else a live read (cached 60 s), else the launch defaults (DECISIONS). */
async function stakingLimits(deps: RouteKit["deps"], snap: any, nowMs: number): Promise<ConfigResponse["stakingLimits"]> {
  const fromSnap = snap && snap.maxOpenPositions !== undefined;
  if (fromSnap) {
    return {
      maxOpenPositions: Number(snap.maxOpenPositions),
      maxUserPrincipalWei: String(snap.maxUserPrincipal ?? 1_000_000n * CT_WEI),
      maxTotalPrincipalWei: snap.maxTotalPrincipal && String(snap.maxTotalPrincipal) !== "0" ? String(snap.maxTotalPrincipal) : null,
      paused: Boolean(snap.paused),
    };
  }
  const hit = stakingCache.get(deps.chain);
  if (hit && hit.until > nowMs) return hit.v;
  const live = deps.config.addresses.staking ? await chainTry(() => deps.chain.stakingState()) : null;
  const v = live
    ? {
        maxOpenPositions: live.maxOpenPositions,
        maxUserPrincipalWei: live.maxUserPrincipal.toString(),
        maxTotalPrincipalWei: live.maxTotalPrincipal === 0n ? null : live.maxTotalPrincipal.toString(),
        paused: live.paused,
      }
    : { maxOpenPositions: 20, maxUserPrincipalWei: (1_000_000n * CT_WEI).toString(), maxTotalPrincipalWei: (1_850_000n * CT_WEI).toString(), paused: false };
  if (live) stakingCache.set(deps.chain, { v, until: nowMs + 60_000 });
  return v;
}

export function registerPublicRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const env = deps.config.env;

  app.get("/v1/config", async (req): Promise<ConfigResponse> => {
    const nowMs = deps.now();
    const params = await predictParams(deps.db, deps.chain, nowMs);
    const stakingSnap = await getState<any>(deps.db, STATE_KEYS.stakingParams);
    const day = currentDayId(nowMs);
    const s = stakingSnap?.value;
    return {
      network: deps.config.network,
      chainId: deps.config.chainId,
      contracts: {
        ct: deps.config.addresses.ct ?? null,
        predict: deps.config.addresses.predict ?? null,
        staking: deps.config.addresses.staking ?? null,
      },
      feePayer: (deps.feePayer?.address.toLowerCase() as `0x${string}`) ?? null,
      privyAppId: env.PRIVY_APP_ID ?? null,
      minAppVersion: env.MIN_APP_VERSION,
      supportEmail: deps.config.supportEmail,
      playKeyTtlDays: env.PLAY_KEY_TTL_DAYS,
      maxGasPriceGkei: env.MAX_GAS_PRICE_GKEI,
      gasLimits: GAS_CAPS,
      params: params
        ? {
            completionPoints: params.completionPoints,
            hitPoints: params.hitPoints,
            referralBps: params.referralBps,
            welcomePoints: params.welcomePoints,
            pointsPerCT: params.pointsPerCT,
            minConvertPoints: params.minConvertPoints,
            maxConvertCtPerUserPerDay: params.maxConvertCtPerUserPerDay,
            maxConvertCtPerDay: params.maxConvertCtPerDay,
            minAccountAgeSeconds: params.minAccountAge,
            settleDelaySeconds: params.settleDelay,
            maxWeeklyPoolCt: params.maxWeeklyPool,
            splitBps: params.splitBps,
          }
        : null,
      staking: s
        ? {
            lockDays: [30, 90, 180, 365],
            rates: s.rates,
            tierThresholdsWei: (s.tiers ?? []).map(String),
            minStakeWei: String(s.minStake),
            minClaimWei: String(s.minClaim),
            maxUserPrincipalWei: String(s.maxUserPrincipal),
          }
        : null,
      time: { now: Math.floor(nowMs / 1000), dayId: day, dayOpensAt: dayOpensAt(day), dayEndsAt: dayEnd(day), weekId: weekOf(day) },
      features: { invites: true, staking: Boolean(deps.config.addresses.staking), conversion: true, krwDisplay: env.KRW_PER_CT > 0 },
      // Stub chain (dev only): the API answers the PWA's JSON-RPC reads itself at /dev/rpc.
      rpcUrl: env.DEV_CHAIN === "stub" && !deps.config.isProduction ? `${req.protocol}://${req.host}/dev/rpc` : publicRpcUrl(deps.config.network, env.PUBLIC_RPC_URL),
      explorerUrl: (env.EXPLORER_URL ?? explorerUrlOf(deps.config.network)).replace(/\/$/, ""),
      krwPerCt: env.KRW_PER_CT > 0 ? env.KRW_PER_CT : null,
      userTxFeeWei: kaiaToWei(env.USER_TX_FEE_KAIA).toString(),
      maintenance: await maintenanceState(deps.db, env),
      emailProviders: (await emailDomains(deps.db)).filter((d) => d.enabled).map((d) => ({ domain: d.domain, name: d.display_name })),
      stakingLimits: await stakingLimits(deps, s, nowMs),
    };
  });

  app.get("/v1/health", async (req, reply) => {
    const strict = (req.query as Record<string, string>)?.strict === "1";
    let db = false;
    try {
      await sql`SELECT 1`.execute(deps.db);
      db = true;
    } catch {
      db = false;
    }
    const blockNumber = await chainTry(() => deps.chain.blockNumber());
    const feeAddr = deps.feePayer?.address ?? null;
    const bal = feeAddr ? await chainTry(() => deps.chain.kaiaBalance(feeAddr)) : null;
    const low = bal !== null && bal < kaiaToWei(env.MIN_FEE_PAYER_BALANCE_KAIA);
    const idx = db ? await getState<{ block?: number }>(deps.db, STATE_KEYS.indexer).catch(() => null) : null;
    const idxBlock = idx?.value?.block ?? null;
    const body: HealthResponse = {
      ok: db && (!strict || (blockNumber !== null && !low)),
      db,
      rpc: blockNumber !== null,
      blockNumber,
      feePayer: { address: (feeAddr?.toLowerCase() as `0x${string}`) ?? null, balanceWei: bal?.toString() ?? null, low },
      indexer: { block: idxBlock, lagBlocks: idxBlock !== null && blockNumber !== null ? Math.max(0, blockNumber - idxBlock) : null },
      version: deps.version,
    };
    if (strict && body.indexer.lagBlocks !== null && body.indexer.lagBlocks > 30) body.ok = false;
    return reply.status(body.ok ? 200 : 503).send(body);
  });

  const emailBody = z.object({ email: z.string().max(320) });
  app.post("/v1/auth/email-check", async (req): Promise<EmailCheckResponse> => {
    const { email } = emailBody.parse(req.body);
    const ip = kit.ipHashOf(req);
    const device = kit.deviceOf(req);
    const hour = utcHour(deps.now());
    const check = await checkEmail(deps.db, email);
    const hashKey = env.EMAIL_HASH_KEY ?? "dev-email-key";
    const eh = check.ok ? emailHash(hashKey, check.normalised) : null;
    const slots = [];
    if (ip) slots.push({ bucket: hour, key: `emailcheck:ip:${ip}`, limit: env.EMAIL_CHECK_IP_PER_HOUR, code: "RATE_LIMITED_IP" });
    if (device) slots.push({ bucket: hour, key: `emailcheck:device:${device}`, limit: env.EMAIL_CHECK_DEVICE_PER_HOUR, code: "RATE_LIMITED_DEVICE" });
    if (eh) slots.push({ bucket: hour, key: `emailcheck:email:${eh}`, limit: env.EMAIL_CHECK_EMAIL_PER_HOUR, code: "RATE_LIMITED_EMAIL" });
    try {
      await takeSlots(deps.db, slots);
    } catch (e) {
      if (e instanceof LimitHit) {
        await deps.db
          .insertInto("auth_checks")
          .values({ email_hash: eh, domain: check.domain, ip_hash: ip, device_id: device, result: e.code.toLowerCase() })
          .execute();
        throw new ApiError(e.code as "RATE_LIMITED_IP" | "RATE_LIMITED_DEVICE" | "RATE_LIMITED_EMAIL");
      }
      throw e;
    }
    await deps.db
      .insertInto("auth_checks")
      .values({ email_hash: eh, domain: check.domain, ip_hash: ip, device_id: device, result: check.ok ? "allowed" : check.reason.toLowerCase() })
      .execute();
    const providers = (await emailDomains(deps.db)).filter((d) => d.enabled).map((d) => ({ domain: d.domain, name: d.display_name }));
    return { allowed: check.ok, reason: check.ok ? null : check.reason, supportedProviders: providers };
  });
}
