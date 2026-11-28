// Admin endpoints the admin web app (platform/admin) needs beyond the first admin API (admin.ts):
// staking and reserve owner transactions (built unsigned for the master wallet), a record of an owner transaction
// the admin sent from the browser, the maintenance switch, the AI queue (market_drafts) with schedule, swap and
// discard, "Add question" into an empty slot, "Run now" for a worker job, display name reset, and the extra
// dashboard figures. Same rules as admin.ts: every write is audited with the actor; the server never holds the owner key.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import { sql, audit, getState, setState, STATE_KEYS } from "../db/index.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { cojamPredictAbi, cojamStakingAbi } from "../chain/abi.ts";
import { DEFAULT_PARAMS, chainTry, checkAnswerWindow, predictParams, toUnix } from "./common.ts";
import { currentDayId, dayEnd, weekOf, weekFirstDay } from "../../../shared/src/time.ts";
import type { AuthedAdmin } from "../auth/index.ts";
import { DEFAULT_TIMING, DRAFT_TIMING_KEY, effectiveTiming, storedTiming } from "../ai/timing.ts";

/** app_state key of the maintenance switch (read by GET /v1/config once the player API exposes it). */
export const MAINTENANCE_KEY = "app.maintenance";
/** Names of the worker's scheduled jobs (src/jobs/schedule.ts CRON_JOBS), for `run_job`. */
export const JOB_NAMES = ["draft", "draft-catchup", "images", "publish", "publish-late", "resolution", "settle", "expiry", "correction", "compensation", "week-close", "airdrop", "week-pool", "risk", "monitors", "outside-prices"] as const;
const LOCK_DAYS = [30, 90, 180, 365];
const CT = 10n ** 18n;
const intStr = (v: string | null | undefined) => (v ?? "0").split(".")[0] || "0";

const wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s.toLowerCase() as Address);
const reason = z.string().trim().min(3).max(500);
/** A CT amount typed by a person: up to 18 decimals, no exponent. */
const ctAmount = z.string().trim().regex(/^\d{1,12}(\.\d{1,18})?$/, "a CT amount like 1250 or 0.5");
const textSchema = z.object({ title: z.string().min(1).max(120), left: z.string().min(1).max(24), right: z.string().min(1).max(24), rule: z.string().min(1).max(120), settle: z.string().min(1).max(60) });
const questionSchema = z.object({
  category: z.string().min(1).max(30),
  content: z.object({ en: textSchema, ko: textSchema, ja: textSchema }),
  resolvesAt: z.number().int(),
  sources: z.array(z.object({ name: z.string().min(1), url: z.string().url(), role: z.enum(["primary", "secondary"]).optional() })).min(1),
  criteria: z.string().min(1).max(1000),
});

export interface ExtraHelpers {
  owner: Address;
  unsignedPredict: (data: Hex, description: string) => unknown;
  operatorRequest: (admin: AuthedAdmin, kind: string, target: string, payload: Record<string, unknown>) => Promise<{ requestId: number; status: string }>;
}

export function registerAdminExtraRoutes(app: FastifyInstance, kit: RouteKit, h: ExtraHelpers): void {
  const { deps } = kit;
  const db = deps.db;
  const actor = (a: AuthedAdmin) => a.email;
  type Role = "viewer" | "operator" | "owner";
  const get = (path: string, role: Role, fn: (req: FastifyRequest, a: AuthedAdmin) => Promise<unknown>) => app.get(path, async (req) => fn(req, await kit.authAdmin(req, role)));
  const post = (path: string, role: Role, fn: (req: FastifyRequest, a: AuthedAdmin) => Promise<unknown>) => app.post(path, async (req) => fn(req, await kit.authAdmin(req, role)));
  const unsignedStaking = (data: Hex, description: string) => {
    const to = deps.config.addresses.staking;
    if (!to) throw new ApiError("NOT_CONFIGURED", "STAKING_ADDRESS is not configured");
    return { chainId: deps.config.chainId, from: h.owner, to, data, value: "0" as const, description };
  };

  // ------------------------------------------------------------ staking (owner transactions, unsigned)
  get("/admin/v1/staking", "viewer", async () => {
    const snap = await getState<{ rates?: number[][]; tiers?: string[]; minStake?: string; minClaim?: string; maxOpenPositions?: number; maxTotalPrincipal?: string; maxUserPrincipal?: string }>(db, STATE_KEYS.stakingParams);
    const live = await chainTry(() => deps.chain.stakingState());
    const open = await sql<{ n: number; principal: string; owed: string }>`
      SELECT count(*)::int AS n, coalesce(sum(principal::numeric), 0)::text AS principal,
             coalesce(sum(max_interest::numeric - coalesce(claimed::numeric, 0)), 0)::text AS owed
      FROM stakes WHERE NOT closed`.execute(db);
    const s = snap?.value ?? {};
    return {
      address: deps.config.addresses.staking ?? null,
      owner: h.owner,
      lockDays: LOCK_DAYS,
      /** yearly rate in basis points, [lock period][tier] */
      ratesBps: s.rates ?? null,
      tiersWei: s.tiers ?? null,
      minStakeWei: s.minStake ?? live?.minStake.toString() ?? null,
      minClaimWei: s.minClaim ?? live?.minClaim.toString() ?? null,
      maxOpenPositions: s.maxOpenPositions ?? live?.maxOpenPositions ?? null,
      maxTotalPrincipalWei: s.maxTotalPrincipal ?? live?.maxTotalPrincipal.toString() ?? null,
      maxUserPrincipalWei: s.maxUserPrincipal ?? live?.maxUserPrincipal.toString() ?? null,
      totalPrincipalWei: live?.totalPrincipal.toString() ?? open.rows[0]?.principal ?? "0",
      availableRewardsWei: live?.availableRewards.toString() ?? null,
      paused: live?.paused ?? null,
      openStakes: open.rows[0]?.n ?? 0,
      owedInterestWei: open.rows[0]?.owed ?? "0",
      snapshotAt: toUnix(snap?.updatedAt),
    };
  });

  const ratesSchema = z.array(z.array(z.number().int().min(0).max(5000)).length(3)).length(4);
  post("/admin/v1/staking", "owner", async (req, admin) => {
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("setRates"), ratesBps: ratesSchema }),
        z.object({ action: z.literal("setTiers"), tiersCt: z.tuple([ctAmount, ctAmount]) }),
        z.object({ action: z.literal("setCaps"), maxOpenPositions: z.number().int().min(1).max(1000), maxTotalPrincipalCt: ctAmount, maxUserPrincipalCt: ctAmount }),
        z.object({ action: z.literal("setMinimums"), minStakeCt: ctAmount, minClaimCt: ctAmount }),
        z.object({ action: z.literal("withdrawRewards"), amountCt: ctAmount, to: wallet.optional() }),
        z.object({ action: z.literal("proposeTreasury"), treasury: wallet }),
        z.object({ action: z.literal("applyTreasury") }),
        z.object({ action: z.literal("cancelTreasury") }),
      ])
      .parse(req.body);
    const ct = (s: string) => parseUnits(s, 18);
    let tx;
    switch (body.action) {
      case "setRates":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "setRates", args: [body.ratesBps as any] }), "setRates: applies to stakes opened after it confirms");
        break;
      case "setTiers": {
        const [a, b] = body.tiersCt.map(ct);
        if (!(a > 0n && b > a)) throw new ApiError("BAD_REQUEST", "Tier limits must go up");
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "setTiers", args: [[a, b]] }), "setTiers");
        break;
      }
      case "setCaps":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "setCaps", args: [BigInt(body.maxOpenPositions), ct(body.maxTotalPrincipalCt), ct(body.maxUserPrincipalCt)] }), "setCaps");
        break;
      case "setMinimums":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "setMinimums", args: [ct(body.minStakeCt), ct(body.minClaimCt)] }), "setMinimums");
        break;
      case "withdrawRewards": {
        const amount = ct(body.amountCt);
        if (amount <= 0n) throw new ApiError("BAD_REQUEST", "Enter an amount above 0");
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "withdrawRewards", args: [amount, body.to ?? h.owner] }), `withdrawRewards(${body.amountCt} CT): only the free rewards balance, never principal or reserved interest`);
        break;
      }
      case "proposeTreasury":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "proposeTreasury", args: [body.treasury] }), "proposeTreasury: applies after the delay with applyTreasury");
        break;
      case "applyTreasury":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "applyTreasury", args: [] }), "applyTreasury");
        break;
      case "cancelTreasury":
        tx = unsignedStaking(encodeFunctionData({ abi: cojamStakingAbi, functionName: "cancelTreasury", args: [] }), "cancelTreasury");
        break;
    }
    await audit(db, { actor: actor(admin), action: `staking.${body.action}.built`, payload: body });
    return { unsignedTx: tx };
  });

  // ------------------------------------------------------------ prediction reserve withdrawal (owner, unsigned)
  post("/admin/v1/reserve/withdraw", "owner", async (req, admin) => {
    const b = z.object({ amountCt: ctAmount, to: wallet.optional(), reason }).parse(req.body);
    const amount = parseUnits(b.amountCt, 18);
    if (amount <= 0n) throw new ApiError("BAD_REQUEST", "Enter an amount above 0");
    const reserve = await chainTry(() => deps.chain.reserve());
    if (reserve !== null && amount > reserve) throw new ApiError("BAD_REQUEST", "The amount is more than the prediction reserve holds");
    const tx = h.unsignedPredict(
      encodeFunctionData({ abi: cojamPredictAbi, functionName: "withdrawReserve", args: [amount, b.to ?? h.owner] }),
      `withdrawReserve(${b.amountCt} CT): conversions and the weekly airdrop are paid from what stays`,
    );
    await audit(db, { actor: actor(admin), action: "reserve.withdraw.built", payload: b });
    return { unsignedTx: tx };
  });

  // ------------------------------------------------------------ an owner transaction sent from the admin
  // The master wallet signs in the browser; the admin then records the hash so the audit log carries it.
  post("/admin/v1/owner-tx", "owner", async (req, admin) => {
    const b = z
      .object({ action: z.string().min(3).max(60).regex(/^[a-zA-Z0-9_.:-]+$/), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), target: z.string().max(100).optional(), from: wallet.optional(), note: z.string().max(500).optional() })
      .parse(req.body);
    await audit(db, { actor: actor(admin), action: `owner_tx.${b.action}`, target: b.target ?? null, payload: { from: b.from, note: b.note }, txHash: b.txHash.toLowerCase() });
    return { ok: true };
  });

  // ------------------------------------------------------------ draft timing (DECISIONS "Longer questions mixed in")
  get("/admin/v1/draft-timing", "viewer", async () => {
    const t = await storedTiming(db);
    return { ...t, longQuestionsOnChain: Boolean(deps.config.env.LONG_QUESTIONS_ON_CHAIN), effective: effectiveTiming(t, Boolean(deps.config.env.LONG_QUESTIONS_ON_CHAIN)), defaults: DEFAULT_TIMING };
  });
  post("/admin/v1/draft-timing", "owner", async (req, admin) => {
    const b = z.object({ minShort: z.number().int().min(0).max(5), maxLong: z.number().int().min(0).max(5), longMaxDays: z.number().int().min(1).max(60), reason }).parse(req.body);
    if (b.minShort + b.maxLong > 5) throw new ApiError("BAD_REQUEST", "minShort plus maxLong must be at most 5");
    const prev = await storedTiming(db);
    const next = { minShort: b.minShort, maxLong: b.maxLong, longMaxDays: b.longMaxDays };
    await db.transaction().execute(async (trx) => {
      await setState(trx as any, DRAFT_TIMING_KEY, next);
      await audit(trx as any, { actor: actor(admin), action: "draft.timing", payload: { reason: b.reason, previous: prev, next } });
    });
    return { ...next, effective: effectiveTiming(next, Boolean(deps.config.env.LONG_QUESTIONS_ON_CHAIN)) };
  });

  // ------------------------------------------------------------ app: maintenance switch
  async function appState() {
    const m = await getState<{ on?: boolean; message?: string; endsAt?: string; since?: number; by?: string }>(db, MAINTENANCE_KEY);
    return {
      maintenance: { on: Boolean(m?.value?.on), message: m?.value?.message ?? "Cojam is being updated. Your points and picks are safe.", endsAt: m?.value?.endsAt ?? "", since: m?.value?.since ?? null, by: m?.value?.by ?? null },
      minAppVersion: deps.config.env.MIN_APP_VERSION,
      /** settings kept in the server environment (changed in Render, not here) */
      server: {
        inviteLinksPerDay: deps.config.env.INVITE_LINKS_PER_INVITER_PER_DAY,
        riskBlockScore: deps.config.env.RISK_BLOCK_SCORE,
        riskReviewScore: deps.config.env.RISK_REVIEW_SCORE,
        weeklyPoolPerPlayerCt: Number(process.env.WEEKLY_POOL_PER_PLAYER_CT ?? 1),
        weeklyPoolCapCt: Number(process.env.WEEKLY_POOL_CAP_CT ?? 10000),
        minFeePayerBalanceKaia: deps.config.env.MIN_FEE_PAYER_BALANCE_KAIA,
        minOperatorBalanceKaia: deps.config.env.MIN_OPERATOR_BALANCE_KAIA,
      },
    };
  }
  get("/admin/v1/app", "viewer", async () => appState());
  post("/admin/v1/app", "operator", async (req, admin) => {
    const b = z.object({ maintenance: z.boolean(), message: z.string().trim().min(1).max(200).optional(), endsAt: z.string().trim().max(40).optional(), reason }).parse(req.body);
    const cur = (await appState()).maintenance;
    const next = { on: b.maintenance, message: b.message ?? cur.message, endsAt: b.endsAt ?? cur.endsAt, since: b.maintenance ? (cur.on && cur.since ? cur.since : Math.floor(deps.now() / 1000)) : null, by: actor(admin) };
    await db.transaction().execute(async (trx) => {
      await setState(trx as any, MAINTENANCE_KEY, next);
      await audit(trx as any, { actor: actor(admin), action: b.maintenance ? "app.maintenance.on" : "app.maintenance.off", payload: { reason: b.reason, message: next.message, endsAt: next.endsAt } });
    });
    return appState();
  });

  // ------------------------------------------------------------ AI queue (market_drafts not on a day yet)
  get("/admin/v1/drafts", "viewer", async () => {
    const today = currentDayId(deps.now());
    const rows = await db
      .selectFrom("market_drafts")
      .select(["id", "target_day", "payload", "validator_result", "created_at"])
      .where("selected", "=", false)
      .where("rejected_reason", "is", null)
      .where("target_day", ">", today)
      .orderBy("created_at", "desc")
      .limit(100)
      .execute();
    return {
      drafts: rows.map((r) => {
        const d = r.payload as any;
        const v = r.validator_result as any;
        return {
          id: Number(r.id),
          targetDay: Number(r.target_day),
          category: d?.category ?? null,
          en: d?.en ?? null,
          ko: d?.ko ?? null,
          ja: d?.ja ?? null,
          criteria: d?.criteria ?? null,
          sources: [d?.primarySource, d?.secondarySource].filter(Boolean),
          resolvesAt: d?.resolvesAt ?? null,
          quality: typeof v?.ai?.qualityScore === "number" ? v.ai.qualityScore : null,
          createdAt: toUnix(r.created_at),
        };
      }),
    };
  });

  const draftParam = z.object({ id: z.coerce.number().int().positive() });
  post("/admin/v1/drafts/:id/discard", "operator", async (req, admin) => {
    const { id } = draftParam.parse(req.params);
    const b = z.object({ reason: reason.optional() }).parse(req.body ?? {});
    const r = await db.updateTable("market_drafts").set({ rejected_reason: `discarded by ${actor(admin)}${b.reason ? `: ${b.reason}` : ""}` }).where("id", "=", id).where("selected", "=", false).executeTakeFirst();
    if (Number(r.numUpdatedRows) === 0) throw new ApiError("NOT_FOUND");
    await audit(db, { actor: actor(admin), action: "draft.discard", target: String(id), payload: b });
    return { draftId: id, discarded: true };
  });

  /** Puts a market row in `slot` of `dayId` (content hash left null: publishDay hashes the stored text). */
  async function placeMarket(trx: any, dayId: number, slot: number, values: Record<string, unknown>) {
    const marketId = dayId * 5 + slot;
    const old = await trx.selectFrom("markets").select(["market_id", "status", "create_tx"]).where("market_id", "=", marketId).executeTakeFirst();
    if (old) {
      if (old.status !== "cancelled" || old.create_tx) throw new ApiError("CONFLICT", "That slot is not empty");
      // keep the cancelled row for the record under a negative id, as the drafter does
      await trx.updateTable("markets").set({ market_id: -(marketId * 100 + Math.floor(Math.random() * 90 + 10)), replaced_by: marketId, updated_at: new Date() }).where("market_id", "=", marketId).execute();
    }
    await trx.insertInto("markets").values({ market_id: marketId, day_id: dayId, slot, closes_at: new Date(dayEnd(dayId) * 1000), content_hash: null, image_state: "pending", status: "scheduled", ...values }).execute();
    return marketId;
  }
  function checkFutureDay(dayId: number) {
    const today = currentDayId(deps.now());
    if (dayId <= today) throw new ApiError("QUESTION_PUBLISHED", "Only days that are not live yet can be changed");
  }
  async function draftRow(id: number) {
    const r = await db.selectFrom("market_drafts").selectAll().where("id", "=", id).executeTakeFirst();
    if (!r || r.selected || r.rejected_reason) throw new ApiError("NOT_FOUND", "The draft is not in the queue any more");
    const d = r.payload as any;
    const sources = [d.primarySource && { ...d.primarySource, role: "primary" }, d.secondarySource && { ...d.secondarySource, role: "secondary" }].filter(Boolean);
    const resolvesAt = Math.floor(Date.parse(d.resolvesAt) / 1000);
    const observesAt = d.observesAt ? Math.floor(Date.parse(d.observesAt) / 1000) : null;
    return { r, d, sources, resolvesAt, observesAt };
  }
  async function draftValues(x: Awaited<ReturnType<typeof draftRow>>, dayId: number, replacing?: number) {
    try {
      await checkAnswerWindow(deps, dayId, x.resolvesAt, replacing);
    } catch (e) {
      if (e instanceof ApiError) throw new ApiError("BAD_REQUEST", `This draft does not fit that day: ${e.message}`);
      throw e;
    }
    return {
      category: x.d.category, content: JSON.stringify({ en: x.d.en, ko: x.d.ko, ja: x.d.ja }), resolves_at: new Date(x.resolvesAt * 1000),
      observes_at: x.observesAt ? new Date(x.observesAt * 1000) : null, kind: x.d.kind ?? null, sources: JSON.stringify(x.sources), criteria: x.d.criteria, rationale: x.d.rationale ?? null, draft_id: Number(x.r.id),
    };
  }

  post("/admin/v1/drafts/:id/schedule", "operator", async (req, admin) => {
    const { id } = draftParam.parse(req.params);
    const b = z.object({ dayId: z.number().int(), slot: z.number().int().min(0).max(4), reason: reason.optional() }).parse(req.body);
    checkFutureDay(b.dayId);
    const x = await draftRow(id);
    const values = await draftValues(x, b.dayId);
    const marketId = await db.transaction().execute(async (trx) => {
      const mid = await placeMarket(trx, b.dayId, b.slot, values);
      await trx.updateTable("market_drafts").set({ selected: true }).where("id", "=", id).execute();
      await audit(trx as any, { actor: actor(admin), action: "draft.schedule", target: String(mid), payload: { draftId: id, dayId: b.dayId, slot: b.slot, reason: b.reason } });
      return mid;
    });
    const r = await h.operatorRequest(admin, "image_regenerate", String(marketId), { reason: "scheduled from the AI queue" });
    return { marketId, draftId: id, ...r };
  });

  post("/admin/v1/questions/:id/swap", "operator", async (req, admin) => {
    const { id: marketId } = z.object({ id: z.coerce.number().int().nonnegative() }).parse(req.params);
    const b = z.object({ draftId: z.number().int().positive(), reason }).parse(req.body);
    const m = await db.selectFrom("markets").selectAll().where("market_id", "=", marketId).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (m.create_tx || !["draft", "scheduled"].includes(m.status)) throw new ApiError("QUESTION_PUBLISHED");
    const x = await draftRow(b.draftId);
    const values = await draftValues(x, m.day_id, marketId);
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("markets").set({ status: "cancelled", updated_at: new Date() }).where("market_id", "=", marketId).execute();
      await placeMarket(trx, m.day_id, m.slot, values);
      await trx.updateTable("market_drafts").set({ selected: true }).where("id", "=", b.draftId).execute();
      await audit(trx as any, { actor: actor(admin), action: "question.swap", target: String(marketId), payload: { reason: b.reason, draftId: b.draftId, previous: m.content } });
    });
    const r = await h.operatorRequest(admin, "image_regenerate", String(marketId), { reason: "swapped with a draft" });
    return { marketId, draftId: b.draftId, questionStatus: "scheduled", ...r };
  });

  // ------------------------------------------------------------ Add question (by hand, into an empty slot)
  post("/admin/v1/questions", "operator", async (req, admin) => {
    const b = z.object({ dayId: z.number().int(), slot: z.number().int().min(0).max(4), reason, question: questionSchema }).parse(req.body);
    checkFutureDay(b.dayId);
    const end = dayEnd(b.dayId);
    await checkAnswerWindow(deps, b.dayId, b.question.resolvesAt);
    const q = b.question;
    const marketId = await db.transaction().execute(async (trx) => {
      const mid = await placeMarket(trx, b.dayId, b.slot, { category: q.category, content: JSON.stringify(q.content), resolves_at: new Date(q.resolvesAt * 1000), sources: JSON.stringify(q.sources), criteria: q.criteria, rationale: `Written by ${actor(admin)}` });
      await audit(trx as any, { actor: actor(admin), action: "question.add", target: String(mid), payload: { reason: b.reason, question: q } });
      return mid;
    });
    const r = await h.operatorRequest(admin, "image_regenerate", String(marketId), { reason: "question added by hand" });
    return { marketId, questionStatus: "scheduled", ...r };
  });

  // ------------------------------------------------------------ Run a worker job now
  post("/admin/v1/jobs/:name/run", "operator", async (req, admin) => {
    const { name } = z.object({ name: z.enum(JOB_NAMES) }).parse(req.params);
    const r = await h.operatorRequest(admin, "run_job", name, { job: name });
    await audit(db, { actor: actor(admin), action: "job.run", target: name });
    return { job: name, ...r };
  });

  // ------------------------------------------------------------ Reset a display name
  post("/admin/v1/players/:wallet/reset-name", "operator", async (req, admin) => {
    const { wallet: w } = z.object({ wallet }).parse(req.params);
    const b = z.object({ reason }).parse(req.body);
    const u = await db.selectFrom("users").select(["id", "display_name"]).where("wallet", "=", w).executeTakeFirst();
    if (!u) throw new ApiError("NOT_FOUND");
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("users").set({ display_name: null, updated_at: new Date() }).where("id", "=", u.id).execute();
      await audit(trx as any, { actor: actor(admin), action: "player.reset_name", target: w, payload: { reason: b.reason, previous: u.display_name } });
    });
    return { wallet: w, displayName: null };
  });

  // ------------------------------------------------------------ dashboard figures the design shows
  get("/admin/v1/dashboard/detail", "viewer", async () => {
    const nowMs = deps.now();
    const today = currentDayId(nowMs);
    const week = weekOf(today);
    const q1 = async <T>(query: ReturnType<typeof sql<T>>) => (await query.execute(db)).rows[0] as T;
    const params = (await predictParams(db, deps.chain, nowMs)) ?? DEFAULT_PARAMS;
    const pk = await sql<{ kind: string; today: number; week: number; rows_today: number; rows_week: number }>`
      SELECT kind, coalesce(sum(amount) FILTER (WHERE day_id = ${today}), 0)::bigint AS today,
             coalesce(sum(amount) FILTER (WHERE week_id = ${week} OR day_id >= ${weekFirstDay(week)}), 0)::bigint AS week,
             count(*) FILTER (WHERE day_id = ${today})::int AS rows_today,
             count(*) FILTER (WHERE week_id = ${week} OR day_id >= ${weekFirstDay(week)})::int AS rows_week
      FROM points_ledger WHERE day_id >= ${Math.min(today, weekFirstDay(week))} OR week_id = ${week} GROUP BY kind`.execute(db);
    const kinds = Object.fromEntries(pk.rows.map((r) => [r.kind, { today: Number(r.today), week: Number(r.week), rowsToday: r.rows_today, rowsWeek: r.rows_week }]));
    const daily = await sql<{ day_id: number; players: number; completed: number }>`
      SELECT day_id, count(*) FILTER (WHERE answered > 0)::int AS players, count(*) FILTER (WHERE completed)::int AS completed
      FROM user_days WHERE day_id > ${today - 30} GROUP BY day_id ORDER BY day_id`.execute(db);
    const users = await q1(sql<{ registered: number; new_today: number; new_week: number }>`
      SELECT count(*) FILTER (WHERE registration = 'registered')::int AS registered,
             count(*) FILTER (WHERE created_at >= to_timestamp(${today * 86400}))::int AS new_today,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new_week
      FROM users`);
    const activeWeek = await q1(sql<{ n: number }>`SELECT count(DISTINCT wallet)::int AS n FROM user_days WHERE day_id >= ${weekFirstDay(week)} AND answered > 0`);
    const weekRow = await db.selectFrom("weeks").select(["qualified_players"]).where("week_id", "=", week).executeTakeFirst();
    const picks = await q1(sql<{ n: number }>`SELECT count(*)::int AS n FROM predictions WHERE day_id = ${today}`);
    const conv = await q1(sql<{ today_ct: string; today_n: number; week_ct: string; week_n: number }>`
      SELECT coalesce(sum(ct::numeric) FILTER (WHERE block_time >= to_timestamp(${today * 86400})), 0)::text AS today_ct,
             count(*) FILTER (WHERE block_time >= to_timestamp(${today * 86400}))::int AS today_n,
             coalesce(sum(ct::numeric) FILTER (WHERE block_time >= to_timestamp(${weekFirstDay(week) * 86400})), 0)::text AS week_ct,
             count(*) FILTER (WHERE block_time >= to_timestamp(${weekFirstDay(week) * 86400}))::int AS week_n
      FROM conversions WHERE block_time >= to_timestamp(${Math.min(today, weekFirstDay(week)) * 86400})`);
    const perUser = await sql<{ ct: string }>`
      SELECT sum(ct::numeric)::text AS ct FROM conversions WHERE block_time >= to_timestamp(${today * 86400}) GROUP BY wallet ORDER BY sum(ct::numeric) DESC`.execute(db);
    const capWei = BigInt(params.maxConvertCtPerUserPerDay) * CT;
    const waiting = await q1(sql<{ n: number }>`SELECT count(*)::int AS n FROM users WHERE registration = 'registered' AND registered_at > to_timestamp(${Math.floor(nowMs / 1000) - params.minAccountAge})`);
    const abuse = await q1(sql<{ blocked: number; week: number; hour: number }>`
      SELECT (SELECT count(*)::int FROM users WHERE frozen) AS blocked,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
             count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour
      FROM freezes WHERE action = 'freeze'`);
    const review = await q1(sql<{ n: number }>`SELECT count(DISTINCT wallet)::int AS n FROM risk_flags WHERE status = 'open'`);
    const inv = await q1(sql<{ today: number; week: number }>`
      SELECT count(*) FILTER (WHERE requested_at >= to_timestamp(${today * 86400}))::int AS today,
             count(*) FILTER (WHERE requested_at > now() - interval '7 days')::int AS week
      FROM referrals`);
    const settledToday = await q1(sql<{ n: number }>`SELECT count(*)::int AS n FROM markets WHERE settles_at >= to_timestamp(${today * 86400}) AND settles_at <= now() AND outcome IN (1, 2)`);
    return {
      at: Math.floor(nowMs / 1000),
      dayId: today,
      weekId: week,
      dayOpensAt: today * 86400,
      dayEndsAt: dayEnd(today),
      weekEndsAt: (weekFirstDay(week) + 7) * 86400,
      params,
      points: kinds,
      daily: daily.rows,
      users: { ...users, activeWeek: activeWeek?.n ?? 0, qualified: weekRow?.qualified_players ?? null },
      picksToday: picks?.n ?? 0,
      settledToday: settledToday?.n ?? 0,
      conversions: {
        todayCtWei: intStr(conv?.today_ct),
        todayN: conv?.today_n ?? 0,
        weekCtWei: intStr(conv?.week_ct),
        weekN: conv?.week_n ?? 0,
        topUserTodayWei: intStr(perUser.rows[0]?.ct),
        atUserCap: perUser.rows.filter((r) => BigInt(r.ct.split(".")[0]) >= capWei).length,
        waiting: waiting?.n ?? 0,
      },
      abuse: { blocked: abuse?.blocked ?? 0, blockedWeek: abuse?.week ?? 0, blockedHour: abuse?.hour ?? 0, review: review?.n ?? 0 },
      invites: { linkedToday: inv?.today ?? 0, linkedWeek: inv?.week ?? 0, welcomeToday: kinds.welcome?.rowsToday ?? 0, welcomeWeek: kinds.welcome?.rowsWeek ?? 0 },
    };
  });
}
