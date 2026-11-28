// Admin API (/admin/v1/*), DEV-PLAN 6.2 plus the admin design (platform/design/admin) and the operations agent
// (docs/platform/OPS-AGENT.md). Roles: viewer (read), operator (writes that the operator key performs through the
// worker), owner (everything; owner transactions are only built unsigned for the master wallet to sign).
// Every write goes to audit_log with the actor (admin email, or "ops-agent" for the service token).
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { sql, audit, getState, STATE_KEYS } from "../db/index.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { cojamPredictAbi } from "../chain/abi.ts";
import { addresses as sharedAddresses } from "../../../shared/addresses/index.ts";
import { DEFAULT_PARAMS, LIVE_STATUSES, chainTry, checkAnswerWindow, imageUrls, predictParams, toUnix } from "./common.ts";
import { emailDomains, invalidateDomains } from "./public.ts";
import { buildRanking } from "./play.ts";
import { currentDayId, dayEnd, weekOf, weekFirstDay } from "../../../shared/src/time.ts";
import type { AuthedAdmin } from "../auth/index.ts";
import { kaiaToWei } from "../config/index.ts";
import { registerAdminExtraRoutes } from "./adminExtra.ts";

const MASTER_WALLET = "0xd9da67b7dcf94c2837d55614a430ea4ff477ecab";
const CT = 10n ** 18n;
const wallet = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((s) => s.toLowerCase());
const reasonBody = z.object({ reason: z.string().trim().min(3).max(500) });

export interface UnsignedTx {
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value: "0";
  description: string;
}

export function registerAdminRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const db = deps.db;
  const network = deps.config.network;
  const owner = ((network !== "local" ? sharedAddresses[network]?.owner : null) ?? MASTER_WALLET).toLowerCase() as Address;

  const actorOf = (a: AuthedAdmin) => a.email;
  const unsigned = (data: Hex, description: string): UnsignedTx => {
    if (!deps.config.addresses.predict) throw new ApiError("NOT_CONFIGURED", "PREDICT_ADDRESS is not configured");
    return { chainId: deps.config.chainId, from: owner, to: deps.config.addresses.predict, data, value: "0", description };
  };
  const operatorRequest = async (admin: AuthedAdmin, kind: string, target: string, payload: Record<string, unknown>) => {
    const r = await db
      .insertInto("operator_requests")
      .values({ kind, target, payload: JSON.stringify(payload), requested_by: actorOf(admin) })
      .returning(["id", "status", "created_at"])
      .executeTakeFirstOrThrow();
    return { requestId: r.id, status: r.status };
  };
  // Endpoints added for the admin web app (platform/admin): staking and reserve owner txs, maintenance, AI queue, jobs.
  registerAdminExtraRoutes(app, kit, { owner, unsignedPredict: unsigned, operatorRequest });
  const get = (path: string, role: "viewer" | "operator" | "owner", handler: (req: FastifyRequest, admin: AuthedAdmin) => Promise<unknown>) =>
    app.get(path, async (req) => handler(req, await kit.authAdmin(req, role)));
  const post = (path: string, role: "viewer" | "operator" | "owner", handler: (req: FastifyRequest, admin: AuthedAdmin) => Promise<unknown>) =>
    app.post(path, async (req) => handler(req, await kit.authAdmin(req, role)));
  const patch = (path: string, role: "viewer" | "operator" | "owner", handler: (req: FastifyRequest, admin: AuthedAdmin) => Promise<unknown>) =>
    app.patch(path, async (req) => handler(req, await kit.authAdmin(req, role)));

  // ------------------------------------------------------------ figures shared by dashboard and overview
  async function figures() {
    const nowMs = deps.now();
    const today = currentDayId(nowMs);
    const week = weekOf(today);
    const q1 = <T>(query: ReturnType<typeof sql<T>>) => query.execute(db).then((r) => r.rows[0]);
    const players = await q1(sql<{ total: number; registered: number; pending: number; refused: number; frozen: number; new_today: number }>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE registration = 'registered')::int AS registered,
             count(*) FILTER (WHERE registration = 'pending')::int AS pending,
             count(*) FILTER (WHERE registration = 'refused')::int AS refused,
             count(*) FILTER (WHERE frozen)::int AS frozen,
             count(*) FILTER (WHERE created_at >= to_timestamp(${today * 86400}))::int AS new_today
      FROM users`);
    const activity = await q1(sql<{ active: number; completed: number }>`
      SELECT count(*) FILTER (WHERE answered > 0)::int AS active, count(*) FILTER (WHERE completed)::int AS completed
      FROM user_days WHERE day_id = ${today}`);
    const pts = await q1(sql<{ issued_today: number; issued_week: number; converted_today: number; converted_week: number; referral_today: number }>`
      SELECT coalesce(sum(amount) FILTER (WHERE kind <> 'convert' AND day_id = ${today}), 0)::bigint AS issued_today,
             coalesce(sum(amount) FILTER (WHERE kind <> 'convert' AND week_id = ${week}), 0)::bigint AS issued_week,
             coalesce(-sum(amount) FILTER (WHERE kind = 'convert' AND day_id = ${today}), 0)::bigint AS converted_today,
             coalesce(-sum(amount) FILTER (WHERE kind = 'convert' AND week_id = ${week}), 0)::bigint AS converted_week,
             coalesce(sum(amount) FILTER (WHERE kind = 'referral' AND day_id = ${today}), 0)::bigint AS referral_today
      FROM points_ledger WHERE day_id >= ${weekFirstDay(week)} OR week_id = ${week}`);
    const conv7 = await q1(sql<{ ct: string }>`
      SELECT coalesce(sum(ct), 0)::text AS ct FROM conversions WHERE block_time > now() - interval '7 days'`);
    const gasToday = await db.selectFrom("usage_daily").select(["spent_wei", "count"]).where("day", "=", new Date(nowMs).toISOString().slice(0, 10)).where("key", "=", "budget").executeTakeFirst();
    const gas7 = await q1(sql<{ wei: string }>`SELECT coalesce(sum(spent_wei), 0)::text AS wei FROM usage_daily WHERE key = 'budget' AND day >= ${new Date(nowMs - 7 * 86400000).toISOString().slice(0, 10)}`);

    const reservesSnap = await getState<{ reserve?: string; availableRewards?: string; totalPrincipal?: string }>(db, STATE_KEYS.reserves);
    const balSnap = await getState<{ feePayer?: string; operator?: string }>(db, STATE_KEYS.balances);
    const reserve = reservesSnap?.value?.reserve ?? (await chainTry(() => deps.chain.reserve()))?.toString() ?? null;
    const feeAddr = deps.feePayer?.address;
    const feeBal = balSnap?.value?.feePayer ?? (feeAddr ? (await chainTry(() => deps.chain.kaiaBalance(feeAddr)))?.toString() : undefined) ?? null;
    const convPerDay = BigInt(conv7?.ct ?? "0") / 7n;
    const gasPerDay = BigInt(gas7?.wei ?? "0") / 7n;
    const params = (await predictParams(db, deps.chain, nowMs)) ?? DEFAULT_PARAMS;
    const nextPool = BigInt(params.maxWeeklyPool) * CT;
    const runwayDays = (bal: string | null, perDay: bigint) => (bal === null || perDay === 0n ? null : Number(BigInt(bal) / perDay));
    return {
      nowMs,
      today,
      week,
      players: { ...players, activeToday: activity?.active ?? 0, completedToday: activity?.completed ?? 0 },
      completionRate: activity?.active ? (activity.completed ?? 0) / activity.active : null,
      points: pts,
      reserves: {
        predictReserveWei: reserve,
        predictRunwayDays: reserve === null ? null : convPerDay === 0n ? null : Number((BigInt(reserve) - nextPool > 0n ? BigInt(reserve) - nextPool : 0n) / convPerDay),
        stakingAvailableRewardsWei: reservesSnap?.value?.availableRewards ?? null,
        stakingTotalPrincipalWei: reservesSnap?.value?.totalPrincipal ?? null,
        feePayerWei: feeBal,
        feePayerRunwayDays: runwayDays(feeBal, gasPerDay),
        operatorWei: balSnap?.value?.operator ?? null,
        conversionsPerDayWei: convPerDay.toString(),
        snapshotAt: toUnix(reservesSnap?.updatedAt),
      },
      gas: { todayWei: gasToday?.spent_wei ?? "0", sponsoredToday: gasToday?.count ?? 0, perDay7Wei: gasPerDay.toString() },
    };
  }

  async function alerts(f: Awaited<ReturnType<typeof figures>>) {
    const out: { level: "critical" | "warning"; code: string; message: string }[] = [];
    const env = deps.config.env;
    if (f.reserves.feePayerWei !== null && BigInt(f.reserves.feePayerWei) < kaiaToWei(env.MIN_FEE_PAYER_BALANCE_KAIA) * 2n)
      out.push({ level: "critical", code: "FEE_PAYER_LOW", message: "Fee payer balance is under twice its floor" });
    if (f.reserves.feePayerRunwayDays !== null && f.reserves.feePayerRunwayDays < 14)
      out.push({ level: "warning", code: "FEE_PAYER_RUNWAY", message: `Fee payer runway ${f.reserves.feePayerRunwayDays} days` });
    if (f.reserves.predictRunwayDays !== null && f.reserves.predictRunwayDays < 14)
      out.push({ level: "warning", code: "RESERVE_RUNWAY", message: `Conversion reserve runway ${f.reserves.predictRunwayDays} days` });
    const days = await sql<{ day_id: number; n: number }>`
      SELECT day_id, count(*)::int AS n FROM markets WHERE day_id BETWEEN ${f.today} AND ${f.today + 7} AND status NOT IN ('draft', 'cancelled')
      GROUP BY day_id`.execute(db);
    for (let d = f.today; d <= f.today + 2; d++) {
      const n = days.rows.find((r) => r.day_id === d)?.n ?? 0;
      if (n < 5) out.push({ level: d <= f.today + 1 ? "critical" : "warning", code: "DAY_INCOMPLETE", message: `Day ${d} has ${n} of 5 questions` });
    }
    const late = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM markets WHERE status IN ('published', 'closed') AND outcome IS NULL AND resolves_at < now() - interval '6 hours'`.execute(db);
    if (late.rows[0]?.n) out.push({ level: "critical", code: "ANSWER_LATE", message: `${late.rows[0].n} answers are more than 6 hours late` });
    const review = await sql<{ n: number }>`SELECT count(DISTINCT wallet)::int AS n FROM risk_flags WHERE status = 'open'`.execute(db);
    if ((review.rows[0]?.n ?? 0) > 50) out.push({ level: "warning", code: "REVIEW_LIST", message: `${review.rows[0].n} accounts wait for review` });
    const failedReg = await sql<{ n: number }>`SELECT count(*)::int AS n FROM registration_requests WHERE status = 'failed' AND updated_at > now() - interval '1 day'`.execute(db);
    if (failedReg.rows[0]?.n) out.push({ level: "warning", code: "REGISTRATION_FAILED", message: `${failedReg.rows[0].n} registrations failed in the last day` });
    const idx = await getState<{ lag?: number }>(db, STATE_KEYS.indexer);
    if ((idx?.value?.lag ?? 0) > 30) out.push({ level: "warning", code: "INDEXER_LAG", message: `Indexer is ${idx!.value.lag} blocks behind` });
    // Alerts raised by the worker (its own table; absent until the worker migration ran).
    try {
      const w = await sql<{ level: string; code: string; message: string }>`
        SELECT level, code, message FROM worker_alerts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 20`.execute(db);
      for (const r of w.rows) out.push({ level: r.level === "critical" ? "critical" : "warning", code: r.code, message: r.message });
    } catch {
      // table or columns not there: ignore
    }
    return out;
  }

  get("/admin/v1/me", "viewer", async (_req, admin) => admin);

  get("/admin/v1/dashboard", "viewer", async () => {
    const f = await figures();
    const invites = await sql<{ linked_today: number; invited_share: number | null }>`
      SELECT count(*) FILTER (WHERE requested_at >= to_timestamp(${f.today * 86400}))::int AS linked_today,
             (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE count(r.invitee)::float / count(*) END
                FROM users u LEFT JOIN referrals r ON r.invitee = u.wallet WHERE u.created_at > now() - interval '7 days') AS invited_share
      FROM referrals`.execute(db);
    const ai = await getState(db, STATE_KEYS.aiUsage);
    const jobs = await getState(db, STATE_KEYS.jobs);
    return {
      at: Math.floor(f.nowMs / 1000),
      dayId: f.today,
      weekId: f.week,
      players: f.players,
      completionRate: f.completionRate,
      points: f.points,
      reserves: f.reserves,
      gas: f.gas,
      invites: invites.rows[0],
      ai: ai?.value ?? null,
      jobs: jobs?.value ?? null,
      alerts: await alerts(f),
    };
  });

  // One compact call for the operations agent: "how is today going".
  get("/admin/v1/overview", "viewer", async () => {
    const f = await figures();
    const markets = await db
      .selectFrom("markets")
      .select(["market_id", "slot", "category", "content", "status", "outcome", "resolves_at"])
      .where("day_id", "=", f.today)
      .where("status", "not in", ["draft", "cancelled"])
      .orderBy("slot")
      .execute();
    const split = await sql<{ market_id: number; left: number; right: number }>`
      SELECT market_id, count(*) FILTER (WHERE choice = 1)::int AS left, count(*) FILTER (WHERE choice = 2)::int AS right
      FROM predictions WHERE day_id = ${f.today} GROUP BY market_id`.execute(db);
    const lateOrLow = await sql<{ market_id: number; title: string; resolves_at: Date; confidence: string | null; outcome: number | null }>`
      SELECT m.market_id, m.content->'en'->>'title' AS title, m.resolves_at, m.outcome,
             (SELECT min(confidence)::text FROM resolutions r WHERE r.market_id = m.market_id AND r.created_at > now() - interval '3 days') AS confidence
      FROM markets m
      WHERE m.day_id BETWEEN ${f.today - 3} AND ${f.today}
        AND ((m.status IN ('published', 'closed') AND m.outcome IS NULL AND m.resolves_at < now() - interval '1 hour')
          OR EXISTS (SELECT 1 FROM resolutions r WHERE r.market_id = m.market_id AND r.confidence < 0.9 AND r.created_at > now() - interval '3 days'))
      ORDER BY m.market_id`.execute(db);
    const review = await sql<{ n: number }>`SELECT count(DISTINCT wallet)::int AS n FROM risk_flags WHERE status = 'open'`.execute(db);
    const jobs = await getState(db, STATE_KEYS.jobs);
    const queue = await sql<{ status: string; n: number }>`
      SELECT status, count(*)::int AS n FROM operator_requests WHERE created_at > now() - interval '2 days' GROUP BY status`.execute(db);
    return {
      at: Math.floor(f.nowMs / 1000),
      network,
      dayId: f.today,
      weekId: f.week,
      alerts: await alerts(f),
      today: markets.map((m) => {
        const s = split.rows.find((x) => x.market_id === m.market_id);
        const c = m.content as any;
        return {
          marketId: m.market_id,
          slot: m.slot,
          category: m.category,
          title: c?.en?.title,
          left: c?.en?.left,
          right: c?.en?.right,
          status: m.status,
          outcome: m.outcome,
          picks: { left: s?.left ?? 0, right: s?.right ?? 0, total: (s?.left ?? 0) + (s?.right ?? 0) },
          resolvesAt: toUnix(m.resolves_at),
        };
      }),
      players: f.players,
      points: f.points,
      reserves: f.reserves,
      gas: f.gas,
      jobs: jobs?.value ?? null,
      operatorRequests: Object.fromEntries(queue.rows.map((r) => [r.status, r.n])),
      answersNeedingAttention: lateOrLow.rows.map((r) => ({
        marketId: r.market_id,
        title: r.title,
        resolvesAt: toUnix(r.resolves_at),
        outcome: r.outcome,
        lowestConfidence: r.confidence === null ? null : Number(r.confidence),
      })),
      reviewListCount: review.rows[0]?.n ?? 0,
    };
  });

  // ------------------------------------------------------------ params (owner txs unsigned)
  get("/admin/v1/params", "viewer", async () => {
    const current = await chainTry(() => deps.chain.params());
    const pending = await chainTry(() => deps.chain.pendingParams());
    return { current: current ?? (await predictParams(db, deps.chain, deps.now())), pending: pending && pending.applyAfter > 0 ? pending : null, owner };
  });

  const paramsSchema = z.object({
    completionPoints: z.number().int().min(0).max(1000),
    hitPoints: z.number().int().min(0).max(1000),
    referralBps: z.number().int().min(0).max(2000),
    welcomePoints: z.number().int().min(0).max(1000),
    settleDelay: z.number().int().min(0).max(48 * 3600),
    pointsPerCT: z.number().int().min(100).max(100_000),
    minConvertPoints: z.number().int().min(100).max(1_000_000),
    maxConvertCtPerUserPerDay: z.number().int().min(1).max(10_000),
    maxConvertCtPerDay: z.number().int().min(100).max(1_000_000),
    minAccountAge: z.number().int().min(0).max(30 * 86400),
    minResolveGap: z.number().int().min(0).max(7 * 86400),
    maxWeeklyPool: z.number().int().min(0).max(1_000_000),
    airdropDelay: z.number().int().min(0).max(7 * 86400),
    treasury: wallet,
    splitBps: z.array(z.number().int().min(0).max(10_000)).length(10),
  });
  post("/admin/v1/params", "owner", async (req, admin) => {
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("propose"), params: paramsSchema }),
        z.object({ action: z.literal("apply") }),
        z.object({ action: z.literal("cancel") }),
      ])
      .parse(req.body);
    let tx: UnsignedTx;
    if (body.action === "propose") {
      const p = body.params;
      if (p.splitBps.reduce((a, b) => a + b, 0) !== 10_000) throw new ApiError("BAD_REQUEST", "splitBps must sum to 10,000");
      if (p.splitBps.some((v, i) => i > 0 && v > p.splitBps[i - 1])) throw new ApiError("BAD_REQUEST", "splitBps must be non increasing");
      if (p.minConvertPoints < p.pointsPerCT) throw new ApiError("BAD_REQUEST", "minConvertPoints must be at least pointsPerCT");
      if (p.airdropDelay < 48 * 3600 + p.settleDelay) throw new ApiError("BAD_REQUEST", "airdropDelay must be at least 48 h plus settleDelay");
      const data = encodeFunctionData({ abi: cojamPredictAbi, functionName: "proposeParams", args: [p as any] });
      tx = unsigned(data, "proposeParams: takes effect with applyParams after 48 hours");
    } else if (body.action === "apply") {
      tx = unsigned(encodeFunctionData({ abi: cojamPredictAbi, functionName: "applyParams", args: [] }), "applyParams");
    } else {
      tx = unsigned(encodeFunctionData({ abi: cojamPredictAbi, functionName: "cancelParams", args: [] }), "cancelParams");
    }
    await audit(db, { actor: actorOf(admin), action: `params.${body.action}.built`, payload: body });
    return { unsignedTx: tx };
  });

  // ------------------------------------------------------------ questions
  const qQuery = z.object({
    status: z.enum(["draft", "scheduled", "cancelled", "published", "closed", "resolved", "voided", "corrected", "live", "all"]).optional(),
    from: z.coerce.number().int().optional(),
    to: z.coerce.number().int().optional(),
  });
  get("/admin/v1/questions", "viewer", async (req) => {
    const q = qQuery.parse(req.query);
    const today = currentDayId(deps.now());
    let qb = db.selectFrom("markets").selectAll().where("day_id", ">=", q.from ?? today - 1).where("day_id", "<=", q.to ?? today + 7);
    if (q.status === "live") qb = qb.where("status", "in", [...LIVE_STATUSES]);
    else if (q.status && q.status !== "all") qb = qb.where("status", "=", q.status);
    const rows = await qb.orderBy("day_id").orderBy("slot").execute();
    const ids = rows.map((r) => r.market_id);
    const picks = ids.length
      ? await sql<{ market_id: number; n: number }>`SELECT market_id, count(*)::int AS n FROM predictions WHERE market_id IN (${sql.join(ids)}) GROUP BY market_id`.execute(db)
      : { rows: [] };
    const base = deps.config.env.IMAGE_BASE_URL;
    return {
      questions: rows.map((m) => {
        const c = m.content as any;
        const counts = Object.fromEntries(
          (["en", "ko", "ja"] as const).map((l) => [l, { title: [...(c?.[l]?.title ?? "")].length, left: [...(c?.[l]?.left ?? "")].length, right: [...(c?.[l]?.right ?? "")].length, rule: [...(c?.[l]?.rule ?? "")].length }]),
        );
        return {
          marketId: m.market_id,
          dayId: m.day_id,
          slot: m.slot,
          category: m.category,
          status: m.status,
          text: c,
          charCounts: counts,
          sources: m.sources,
          criteria: m.criteria,
          rationale: m.rationale,
          closesAt: toUnix(m.closes_at),
          resolvesAt: toUnix(m.resolves_at),
          outcome: m.outcome,
          image: { ...imageUrls(m, base), state: m.image_state, prompt: m.image_prompt, model: m.image_model },
          contentHash: m.content_hash,
          createTx: m.create_tx,
          picks: picks.rows.find((p) => p.market_id === m.market_id)?.n ?? 0,
          editable: !m.create_tx && (m.status === "draft" || m.status === "scheduled"),
        };
      }),
    };
  });

  const idParam = z.object({ id: z.coerce.number().int().nonnegative() });
  async function editableMarket(id: number) {
    const m = await db.selectFrom("markets").selectAll().where("market_id", "=", id).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (m.create_tx || !["draft", "scheduled"].includes(m.status)) throw new ApiError("QUESTION_PUBLISHED");
    return m;
  }

  post("/admin/v1/questions/:id/cancel", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    const m = await editableMarket(id);
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("markets").set({ status: "cancelled", updated_at: new Date() }).where("market_id", "=", id).execute();
      await audit(trx as any, { actor: actorOf(admin), action: "question.cancel", target: String(id), payload: { reason, previous: m.content } });
    });
    // The worker refills the slot from the selected drafts or the reserve pool before publishing the day.
    const r = await operatorRequest(admin, "question_replace", String(id), { dayId: m.day_id, slot: m.slot, reason, cancelled: true });
    return { marketId: id, questionStatus: "cancelled", ...r };
  });

  const textSchema = z.object({
    title: z.string().min(1).max(120),
    left: z.string().min(1).max(24),
    right: z.string().min(1).max(24),
    rule: z.string().min(1).max(120),
    settle: z.string().min(1).max(60),
  });
  const replaceBody = z.object({
    reason: z.string().trim().min(3).max(500),
    question: z
      .object({
        category: z.string().min(1).max(30),
        content: z.object({ en: textSchema, ko: textSchema, ja: textSchema }),
        resolvesAt: z.number().int(),
        sources: z.array(z.object({ name: z.string(), url: z.string().url(), role: z.enum(["primary", "secondary"]).optional() })).min(1),
        criteria: z.string().min(1).max(1000),
      })
      .optional(),
  });
  post("/admin/v1/questions/:id/replace", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const body = replaceBody.parse(req.body);
    const m = await editableMarket(id);
    if (!body.question) {
      const r = await operatorRequest(admin, "question_replace", String(id), { dayId: m.day_id, slot: m.slot, reason: body.reason });
      await audit(db, { actor: actorOf(admin), action: "question.replace.requested", target: String(id), payload: { reason: body.reason } });
      return { marketId: id, questionStatus: m.status, ...r };
    }
    const q = body.question;
    const end = dayEnd(m.day_id);
    await checkAnswerWindow(deps, m.day_id, q.resolvesAt, id);
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("markets")
        .set({
          category: q.category,
          content: JSON.stringify(q.content),
          resolves_at: new Date(q.resolvesAt * 1000),
          sources: JSON.stringify(q.sources),
          criteria: q.criteria,
          content_hash: null,
          image_key: null,
          image_url: null,
          image_sha256: null,
          image_state: "pending",
          status: "scheduled",
          updated_at: new Date(),
        })
        .where("market_id", "=", id)
        .execute();
      await audit(trx as any, { actor: actorOf(admin), action: "question.replace", target: String(id), payload: { reason: body.reason, previous: m.content, next: q } });
    });
    const r = await operatorRequest(admin, "image_regenerate", String(id), { reason: "question replaced" });
    return { marketId: id, questionStatus: "scheduled", ...r };
  });

  post("/admin/v1/questions/:id/void", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    const m = await db.selectFrom("markets").selectAll().where("market_id", "=", id).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (!m.create_tx && !LIVE_STATUSES.includes(m.status as any)) throw new ApiError("CONFLICT", "Not on chain: cancel it instead");
    if (m.outcome === 3) throw new ApiError("CONFLICT", "Already void");
    if (m.outcome && m.settles_at && m.settles_at.getTime() <= deps.now()) throw new ApiError("CORRECTION_WINDOW_OVER");
    const r = await operatorRequest(admin, "void_market", String(id), { reason });
    await audit(db, { actor: actorOf(admin), action: "question.void", target: String(id), payload: { reason } });
    return { marketId: id, ...r };
  });

  const imageBody = z.object({ action: z.enum(["regenerate", "fallback", "upload"]), imageKey: z.string().max(300).optional(), imageUrl: z.string().url().optional() });
  post("/admin/v1/questions/:id/image", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const body = imageBody.parse(req.body);
    const m = await db.selectFrom("markets").select(["market_id"]).where("market_id", "=", id).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (body.action === "fallback") {
      await db.updateTable("markets").set({ image_state: "fallback", image_key: null, image_url: null, updated_at: new Date() }).where("market_id", "=", id).execute();
      await audit(db, { actor: actorOf(admin), action: "question.image.fallback", target: String(id) });
      return { marketId: id, imageState: "fallback" };
    }
    if (body.action === "upload") {
      // The upload itself goes to the image store; the worker checks it (4:5, size, no text) before switching.
      if (!body.imageKey && !body.imageUrl) throw new ApiError("BAD_REQUEST", "upload needs imageKey or imageUrl of the stored file");
      const r = await operatorRequest(admin, "image_upload_check", String(id), { imageKey: body.imageKey, imageUrl: body.imageUrl });
      await audit(db, { actor: actorOf(admin), action: "question.image.upload", target: String(id), payload: body });
      return { marketId: id, ...r };
    }
    const r = await operatorRequest(admin, "image_regenerate", String(id), {});
    await audit(db, { actor: actorOf(admin), action: "question.image.regenerate", target: String(id) });
    return { marketId: id, ...r };
  });

  // ------------------------------------------------------------ answers
  get("/admin/v1/answers", "viewer", async (req) => {
    const { status } = z.object({ status: z.enum(["due", "window", "final", "all"]).optional() }).parse(req.query);
    const nowS = Math.floor(deps.now() / 1000);
    const today = currentDayId(deps.now());
    let qb = db.selectFrom("markets").selectAll().where("status", "in", [...LIVE_STATUSES]).where("day_id", ">=", today - 14);
    if (status === "due") qb = qb.where("outcome", "is", null).where("resolves_at", "<=", new Date(nowS * 1000));
    if (status === "window") qb = qb.where("outcome", "is not", null).where("settles_at", ">", new Date(nowS * 1000));
    if (status === "final") qb = qb.where("outcome", "is not", null).where("settles_at", "<=", new Date(nowS * 1000));
    const rows = await qb.orderBy("day_id", "desc").orderBy("slot").limit(200).execute();
    const ids = rows.map((r) => r.market_id);
    const runs = ids.length ? await db.selectFrom("resolutions").selectAll().where("market_id", "in", ids).orderBy("created_at").execute() : [];
    const ev = runs.length ? await db.selectFrom("evidence").select(["resolution_id", "url", "quote", "observed_at"]).where("resolution_id", "in", runs.map((r) => r.id)).execute() : [];
    // Picks per side and how many of those players were invited (the admin's correction impact table).
    const sides = ids.length
      ? await sql<{ market_id: number; choice: number; n: number; invited: number }>`
          SELECT p.market_id, p.choice, count(*)::int AS n, count(r.invitee)::int AS invited
          FROM predictions p LEFT JOIN referrals r ON r.invitee = p.wallet
          WHERE p.market_id IN (${sql.join(ids)}) GROUP BY p.market_id, p.choice`.execute(db)
      : { rows: [] as { market_id: number; choice: number; n: number; invited: number }[] };
    const side = (id: number, c: number) => sides.rows.find((x) => x.market_id === id && x.choice === c);
    return {
      answers: rows.map((m) => ({
        marketId: m.market_id,
        dayId: m.day_id,
        slot: m.slot,
        title: (m.content as any)?.en?.title,
        left: (m.content as any)?.en?.left ?? null,
        right: (m.content as any)?.en?.right ?? null,
        rule: (m.content as any)?.en?.rule ?? null,
        criteria: m.criteria,
        closesAt: toUnix(m.closes_at),
        outcomeTx: m.outcome_tx,
        picks: { left: side(m.market_id, 1)?.n ?? 0, right: side(m.market_id, 2)?.n ?? 0 },
        invited: { left: side(m.market_id, 1)?.invited ?? 0, right: side(m.market_id, 2)?.invited ?? 0 },
        status: m.status,
        resolvesAt: toUnix(m.resolves_at),
        outcome: m.outcome,
        correctedOutcome: m.corrected_outcome,
        resolvedAt: toUnix(m.resolved_at),
        settlesAt: toUnix(m.settles_at),
        correctionWindowLeft: m.settles_at ? Math.max(0, toUnix(m.settles_at)! - nowS) : null,
        late: !m.outcome && toUnix(m.resolves_at)! < nowS - 6 * 3600,
        runs: runs
          .filter((r) => r.market_id === m.market_id)
          .map((r) => ({
            run: r.run,
            outcome: r.outcome,
            confidence: r.confidence === null ? null : Number(r.confidence),
            reasoning: r.reasoning,
            at: toUnix(r.created_at),
            evidence: ev.filter((e) => e.resolution_id === r.id).map((e) => ({ url: e.url, quote: e.quote, observedAt: toUnix(e.observed_at) })),
          })),
      })),
    };
  });

  const marketParam = z.object({ marketId: z.coerce.number().int().nonnegative() });
  post("/admin/v1/answers/:marketId/rerun", "operator", async (req, admin) => {
    const { marketId } = marketParam.parse(req.params);
    const m = await db.selectFrom("markets").select(["market_id", "status"]).where("market_id", "=", marketId).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    const body = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
    const r = await operatorRequest(admin, "resolve_rerun", String(marketId), { reason: body.reason ?? null });
    await audit(db, { actor: actorOf(admin), action: "answer.rerun", target: String(marketId), payload: body });
    return { marketId, ...r };
  });

  post("/admin/v1/answers/:marketId/correct", "operator", async (req, admin) => {
    const { marketId } = marketParam.parse(req.params);
    const body = z.object({ outcome: z.union([z.literal(1), z.literal(2), z.literal(3)]), reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const m = await db.selectFrom("markets").selectAll().where("market_id", "=", marketId).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (!m.outcome) throw new ApiError("CONFLICT", "No answer yet: use rerun");
    if (m.outcome === body.outcome) throw new ApiError("CONFLICT", "The answer is already that outcome");
    const inWindow = m.settles_at !== null && m.settles_at.getTime() > deps.now();
    if (inWindow) {
      const r = await operatorRequest(admin, "correct_outcome", String(marketId), { outcome: body.outcome, reason: body.reason });
      await audit(db, { actor: actorOf(admin), action: "answer.correct", target: String(marketId), payload: body });
      return { marketId, path: "correctOutcome", ...r };
    }
    // After the window: the owner records the true answer, then the worker pays compensation batches.
    if (body.outcome === 3) throw new ApiError("CORRECTION_WINDOW_OVER", "After the window an answer can only be corrected to choice 1 or 2");
    if (m.corrected_outcome) throw new ApiError("CONFLICT", "A corrected outcome is already recorded");
    const tx = unsigned(
      encodeFunctionData({ abi: cojamPredictAbi, functionName: "setCorrectedOutcome", args: [BigInt(marketId), body.outcome] }),
      `setCorrectedOutcome(${marketId}, ${body.outcome}): then the worker runs compensate batches`,
    );
    const r = await operatorRequest(admin, "compensate", String(marketId), { outcome: body.outcome, reason: body.reason, awaitingOwnerTx: true });
    await audit(db, { actor: actorOf(admin), action: "answer.correct.owner_tx_built", target: String(marketId), payload: body });
    return { marketId, path: "setCorrectedOutcome", unsignedTx: tx, ...r };
  });

  // ------------------------------------------------------------ ranking and airdrop
  get("/admin/v1/ranking/:weekId", "viewer", async (req) => {
    const { weekId: raw } = z.object({ weekId: z.union([z.literal("current"), z.string().regex(/^\d+$/)]) }).parse(req.params);
    const nowMs = deps.now();
    const weekId = raw === "current" ? weekOf(currentDayId(nowMs)) : Number(raw);
    const r = await buildRanking(kit, weekId, null, nowMs, 50);
    const rows = await db.selectFrom("airdrop_rows").selectAll().where("week_id", "=", weekId).orderBy("rank").execute();
    const onHold = await sql<{ wallet: string; points: number }>`
      SELECT t.wallet, t.points FROM week_totals t JOIN users u ON u.wallet = t.wallet WHERE t.week_id = ${weekId} AND u.frozen ORDER BY t.points DESC LIMIT 50`.execute(db);
    // For the admin screen: every ranked row with its wallet, the week row, what the airdrop still waits for.
    const full = await sql<{ wallet: string; points: number; rank: number; display_name: string | null; last_completion_at: Date | null }>`
      SELECT t.wallet, t.points, u.display_name, t.last_completion_at,
             row_number() OVER (ORDER BY t.points DESC, t.last_completion_at ASC NULLS LAST, t.wallet ASC)::int AS rank
      FROM week_totals t LEFT JOIN users u ON u.wallet = t.wallet
      WHERE t.week_id = ${weekId} AND t.points > 0 AND coalesce(u.frozen, false) = false
      ORDER BY rank LIMIT 50`.execute(db);
    const ranked = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM week_totals t LEFT JOIN users u ON u.wallet = t.wallet WHERE t.week_id = ${weekId} AND t.points > 0 AND coalesce(u.frozen, false) = false`.execute(db);
    const weekRow = await db.selectFrom("weeks").selectAll().where("week_id", "=", weekId).executeTakeFirst();
    const first = weekFirstDay(weekId);
    const backlog = await sql<{ open: number; total: number; settled: number }>`
      SELECT count(*) FILTER (WHERE outcome IS NULL AND status IN ('published', 'closed'))::int AS open,
             count(*) FILTER (WHERE status NOT IN ('draft', 'scheduled', 'cancelled'))::int AS total,
             count(*) FILTER (WHERE outcome IS NOT NULL)::int AS settled
      FROM markets WHERE day_id BETWEEN ${first} AND ${first + 6}`.execute(db);
    const lastRequest = await db.selectFrom("operator_requests").selectAll().where("kind", "=", "airdrop").where("target", "=", String(weekId)).orderBy("id", "desc").executeTakeFirst();
    const params = (await predictParams(db, deps.chain, nowMs)) ?? DEFAULT_PARAMS;
    const reserve = await chainTry(() => deps.chain.reserve());
    return {
      ...r,
      airdrop: rows,
      onHoldExcluded: onHold.rows,
      rows: full.rows.map((x) => ({ ...x, last_completion_at: toUnix(x.last_completion_at) })),
      rankedPlayers: ranked.rows[0]?.n ?? 0,
      week: weekRow ? { ...weekRow, closed_at: toUnix(weekRow.closed_at), updated_at: toUnix(weekRow.updated_at) } : null,
      backlog: backlog.rows[0],
      airdropDueAt: (first + 7) * 86400 + params.airdropDelay,
      lastRequest: lastRequest ?? null,
      reserveWei: reserve === null ? null : reserve.toString(),
    };
  });

  post("/admin/v1/ranking/:weekId/airdrop", "operator", async (req, admin) => {
    const { weekId } = z.object({ weekId: z.coerce.number().int().nonnegative() }).parse(req.params);
    const r = await operatorRequest(admin, "airdrop", String(weekId), {});
    await audit(db, { actor: actorOf(admin), action: "airdrop.trigger", target: String(weekId) });
    return { weekId, ...r };
  });

  // ------------------------------------------------------------ players
  get("/admin/v1/players", "viewer", async (req) => {
    const q = z.object({ list: z.enum(["review", "blocked", "all"]).optional(), q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).parse(req.query);
    let qb = db
      .selectFrom("users as u")
      .select(["u.id", "u.wallet", "u.display_name", "u.email_domain", "u.registration", "u.frozen", "u.frozen_reason", "u.risk_score", "u.created_at", "u.registered_at"])
      .orderBy("u.created_at", "desc")
      .limit(q.limit ?? 100);
    if (q.list === "blocked") qb = qb.where("u.frozen", "=", true);
    if (q.list === "review") qb = qb.where("u.wallet", "in", db.selectFrom("risk_flags").select("wallet").where("status", "=", "open")).where("u.frozen", "=", false);
    if (q.q) {
      const s = q.q.toLowerCase();
      qb = qb.where((eb) => eb.or([eb("u.wallet", "like", `${s}%`), eb(sql`lower(u.display_name)`, "like", `%${s}%`)]));
    }
    const users = await qb.execute();
    const wallets = users.map((u) => u.wallet).filter((w): w is string => Boolean(w));
    const flags = wallets.length ? await db.selectFrom("risk_flags").selectAll().where("wallet", "in", wallets).where("status", "=", "open").execute() : [];
    const lastFreeze = wallets.length
      ? await db.selectFrom("freezes").selectAll().where("wallet", "in", wallets).orderBy("created_at", "desc").execute()
      : [];
    // Play figures and invite links of the listed players (the admin review and blocked tables).
    const agg = wallets.length
      ? await sql<{ wallet: string; days: number; points: number; friends: number; inviter: string | null; inviter_name: string | null }>`
          SELECT w.wallet,
                 (SELECT count(*)::int FROM user_days d WHERE d.wallet = w.wallet AND d.answered > 0) AS days,
                 (SELECT coalesce(sum(amount), 0)::bigint FROM points_ledger l WHERE l.wallet = w.wallet) AS points,
                 (SELECT count(*)::int FROM referrals r WHERE r.inviter = w.wallet) AS friends,
                 r.inviter, iu.display_name AS inviter_name
          FROM unnest(${sql.val(wallets)}::text[]) AS w(wallet)
          LEFT JOIN referrals r ON r.invitee = w.wallet
          LEFT JOIN users iu ON iu.wallet = r.inviter`.execute(db)
      : { rows: [] as { wallet: string; days: number; points: number; friends: number; inviter: string | null; inviter_name: string | null }[] };
    return {
      players: users.map((u) => ({
        ...u,
        play: (() => {
          const a = agg.rows.find((x) => x.wallet === u.wallet);
          return a ? { days: a.days, points: Number(a.points), friends: a.friends, inviter: a.inviter, inviterName: a.inviter_name } : null;
        })(),
        created_at: toUnix(u.created_at),
        registered_at: toUnix(u.registered_at),
        openFlags: flags.filter((f) => f.wallet === u.wallet).map((f) => ({ id: f.id, rule: f.rule, score: f.score, details: f.details, at: toUnix(f.created_at) })),
        lastFreeze: (() => {
          const f = lastFreeze.find((x) => x.wallet === u.wallet);
          return f ? { action: f.action, actor: f.actor, reason: f.reason, status: f.status, txHash: f.tx_hash, at: toUnix(f.created_at) } : null;
        })(),
      })),
    };
  });

  get("/admin/v1/players/:wallet", "viewer", async (req) => {
    const { wallet: w } = z.object({ wallet }).parse(req.params);
    const user = await db.selectFrom("users").selectAll().where("wallet", "=", w).executeTakeFirst();
    if (!user) throw new ApiError("NOT_FOUND");
    const byKind = await sql<{ kind: string; s: number }>`SELECT kind, sum(amount)::bigint AS s FROM points_ledger WHERE wallet = ${w} GROUP BY kind`.execute(db);
    const freezes = await db.selectFrom("freezes").selectAll().where("wallet", "=", w).orderBy("created_at", "desc").execute();
    const flags = await db.selectFrom("risk_flags").selectAll().where("wallet", "=", w).orderBy("created_at", "desc").limit(100).execute();
    const inviter = await db.selectFrom("referrals").selectAll().where("invitee", "=", w).executeTakeFirst();
    const friends = await db.selectFrom("referrals").selectAll().where("inviter", "=", w).orderBy("requested_at", "desc").limit(100).execute();
    const code = await db.selectFrom("invites").selectAll().where("wallet", "=", w).executeTakeFirst();
    const chainPlayer = await chainTry(() => deps.chain.player(w as Address));
    const { email_hash: _h, ...safe } = user;
    return {
      user: { ...safe, created_at: toUnix(user.created_at), registered_at: toUnix(user.registered_at) },
      chain: chainPlayer,
      pointsByKind: Object.fromEntries(byKind.rows.map((r) => [r.kind, Number(r.s)])),
      freezes,
      riskFlags: flags,
      inviter: inviter ?? null,
      friends,
      inviteCode: code ?? null,
    };
  });

  async function playerOr404(w: string) {
    const u = await db.selectFrom("users").select(["id", "wallet", "frozen", "registration"]).where("wallet", "=", w).executeTakeFirst();
    if (!u) throw new ApiError("NOT_FOUND");
    return u;
  }

  post("/admin/v1/players/:wallet/block", "operator", async (req, admin) => {
    const { wallet: w } = z.object({ wallet }).parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    const u = await playerOr404(w);
    if (u.registration !== "registered") throw new ApiError("CONFLICT", "Only registered players can be frozen on chain");
    await db.transaction().execute(async (trx) => {
      // Sponsorship stops at once (users.frozen); the worker sends setFrozen(wallet, true) with the operator key.
      await trx.updateTable("users").set({ frozen: true, frozen_reason: reason, updated_at: new Date() }).where("id", "=", u.id).execute();
      await trx.insertInto("freezes").values({ wallet: w, action: "freeze", actor: actorOf(admin), reason_code: "admin", reason }).execute();
      await trx.updateTable("risk_flags").set({ status: "blocked" }).where("wallet", "=", w).where("status", "=", "open").execute();
      await audit(trx as any, { actor: actorOf(admin), action: "player.block", target: w, payload: { reason } });
    });
    return { wallet: w, frozen: true, chain: "queued" };
  });

  post("/admin/v1/players/:wallet/unblock", "operator", async (req, admin) => {
    const { wallet: w } = z.object({ wallet }).parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    await playerOr404(w);
    await db.transaction().execute(async (trx) => {
      // users.frozen turns false when the indexer sees PlayerFrozen(false); the 30 day mark starts now.
      await trx.insertInto("freezes").values({ wallet: w, action: "unfreeze", actor: actorOf(admin), reason_code: "admin", reason }).execute();
      await trx.updateTable("users").set({ risk_clear_until: new Date(deps.now() + 30 * 86400_000), updated_at: new Date() }).where("wallet", "=", w).execute();
      await trx.updateTable("risk_flags").set({ status: "cleared" }).where("wallet", "=", w).where("status", "in", ["open", "blocked"]).execute();
      await audit(trx as any, { actor: actorOf(admin), action: "player.unblock", target: w, payload: { reason } });
    });
    return { wallet: w, chain: "queued" };
  });

  post("/admin/v1/players/:wallet/clear", "operator", async (req, admin) => {
    const { wallet: w } = z.object({ wallet }).parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    await playerOr404(w);
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("freezes").values({ wallet: w, action: "clear", actor: actorOf(admin), reason_code: "admin", reason, status: "done" }).execute();
      await trx.updateTable("users").set({ risk_clear_until: new Date(deps.now() + 30 * 86400_000), updated_at: new Date() }).where("wallet", "=", w).execute();
      await trx.updateTable("risk_flags").set({ status: "cleared" }).where("wallet", "=", w).where("status", "=", "open").execute();
      await audit(trx as any, { actor: actorOf(admin), action: "player.clear", target: w, payload: { reason } });
    });
    return { wallet: w, cleared: true };
  });

  // ------------------------------------------------------------ invites
  get("/admin/v1/invites", "viewer", async () => {
    const perDay = await sql<{ day: string; links: number }>`
      SELECT to_char(date_trunc('day', requested_at), 'YYYY-MM-DD') AS day, count(*)::int AS links
      FROM referrals WHERE requested_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`.execute(db);
    const issued = await sql<{ kind: string; s: number }>`
      SELECT kind, coalesce(sum(amount), 0)::bigint AS s FROM points_ledger WHERE kind IN ('referral', 'welcome') GROUP BY kind`.execute(db);
    const top = await sql<{ inviter: string; friends: number; bonus: number; first_done: number; name: string | null; risk_score: number | null; frozen: boolean | null; week_bonus: number }>`
      SELECT r.inviter, count(*)::int AS friends, coalesce(sum(r.bonus_points), 0)::bigint AS bonus,
             count(r.first_day_at)::int AS first_done, u.display_name AS name, u.risk_score, u.frozen,
             (SELECT coalesce(sum(amount), 0)::bigint FROM points_ledger l WHERE l.wallet = r.inviter AND l.kind = 'referral' AND l.block_time > now() - interval '7 days') AS week_bonus
      FROM referrals r LEFT JOIN users u ON u.wallet = r.inviter
      GROUP BY r.inviter, u.display_name, u.risk_score, u.frozen ORDER BY friends DESC LIMIT 20`.execute(db);
    const flagged = await db.selectFrom("risk_flags").selectAll().where("rule", "in", ["invite_cluster", "welcome_farm"]).where("status", "=", "open").limit(100).execute();
    const share = await sql<{ share: number | null }>`
      SELECT CASE WHEN count(*) = 0 THEN NULL ELSE count(r.invitee)::float / count(*) END AS share
      FROM users u LEFT JOIN referrals r ON r.invitee = u.wallet WHERE u.created_at > now() - interval '7 days'`.execute(db);
    return {
      linksPerDay: perDay.rows,
      invitedShare7d: share.rows[0]?.share ?? null,
      pointsIssued: Object.fromEntries(issued.rows.map((r) => [r.kind, Number(r.s)])),
      topInviters: top.rows.map((r) => ({ ...r, bonus: Number(r.bonus), week_bonus: Number(r.week_bonus) })),
      flaggedClusters: flagged,
    };
  });

  // ------------------------------------------------------------ email domains
  get("/admin/v1/email-domains", "viewer", async () => {
    const rows = await db.selectFrom("email_domains").selectAll().orderBy("added_at").orderBy("domain").execute();
    const signups = await sql<{ domain: string; n: number }>`
      SELECT email_domain AS domain, count(*)::int AS n FROM users WHERE created_at > now() - interval '7 days' GROUP BY email_domain`.execute(db);
    // Email checks of the last 7 days that were refused: per listed domain (other refusals, e.g. an already
    // linked address) and the top domains refused because they are not on the list.
    const refused = await sql<{ domain: string; result: string; n: number }>`
      SELECT domain, result, count(*)::int AS n FROM auth_checks
      WHERE created_at > now() - interval '7 days' AND result <> 'allowed' AND result NOT LIKE 'rate_limited%'
      GROUP BY domain, result`.execute(db);
    const notListed = refused.rows.filter((r) => r.result === "domain_not_allowed").sort((a, b) => b.n - a.n);
    return {
      domains: rows.map((r) => ({
        ...r,
        signups7d: signups.rows.find((s) => s.domain === r.domain)?.n ?? 0,
        refused7d: refused.rows.filter((x) => x.domain === r.domain && x.result !== "domain_not_allowed").reduce((a, x) => a + x.n, 0),
      })),
      refusedNotListed7d: { total: notListed.reduce((a, x) => a + x.n, 0), top: notListed.slice(0, 5).map((x) => ({ domain: x.domain, n: x.n })) },
    };
  });

  const domainSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);
  post("/admin/v1/email-domains", "operator", async (req, admin) => {
    const b = z.object({ domain: domainSchema, displayName: z.string().trim().min(1).max(40), rule: z.enum(["gmail", "plus", "none"]).default("plus"), reason: z.string().trim().max(500).optional() }).parse(req.body);
    if (b.domain === "googlemail.com") throw new ApiError("BAD_REQUEST", "googlemail.com is folded into gmail.com");
    const r = await db
      .insertInto("email_domains")
      .values({ domain: b.domain, display_name: b.displayName, rule: b.rule, added_by: actorOf(admin) })
      .onConflict((oc) => oc.column("domain").doNothing())
      .executeTakeFirst();
    if (Number(r.numInsertedOrUpdatedRows ?? 0) === 0) throw new ApiError("CONFLICT", "The domain is already listed");
    await audit(db, { actor: actorOf(admin), action: "email_domain.add", target: b.domain, payload: b });
    invalidateDomains();
    return { domains: await emailDomains(db) };
  });

  patch("/admin/v1/email-domains/:domain", "operator", async (req, admin) => {
    const { domain } = z.object({ domain: domainSchema }).parse(req.params);
    const b = z.object({ enabled: z.boolean().optional(), rule: z.enum(["gmail", "plus", "none"]).optional(), displayName: z.string().trim().min(1).max(40).optional(), reason: z.string().trim().max(500).optional() }).parse(req.body);
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (b.enabled !== undefined) set.enabled = b.enabled;
    if (b.rule !== undefined) set.rule = b.rule;
    if (b.displayName !== undefined) set.display_name = b.displayName;
    const r = await db.updateTable("email_domains").set(set).where("domain", "=", domain).executeTakeFirst();
    if (Number(r.numUpdatedRows) === 0) throw new ApiError("NOT_FOUND");
    await audit(db, { actor: actorOf(admin), action: "email_domain.update", target: domain, payload: b });
    invalidateDomains();
    return { domains: await emailDomains(db) };
  });

  // ------------------------------------------------------------ system and audit
  get("/admin/v1/system", "viewer", async () => {
    const f = await figures();
    const jobs = await getState(db, STATE_KEYS.jobs);
    const idx = await getState(db, STATE_KEYS.indexer);
    const ai = await getState(db, STATE_KEYS.aiUsage);
    const block = await chainTry(() => deps.chain.blockNumber());
    const sponsored = await sql<{ status: string; n: number }>`
      SELECT status, count(*)::int AS n FROM sponsored_txs WHERE created_at > now() - interval '1 day' GROUP BY status`.execute(db);
    const errors = await sql<{ error_code: string; n: number }>`
      SELECT error_code, count(*)::int AS n FROM sponsored_txs WHERE error_code IS NOT NULL AND created_at > now() - interval '1 day' GROUP BY error_code`.execute(db);
    const reg = await sql<{ status: string; n: number }>`SELECT status, count(*)::int AS n FROM registration_requests GROUP BY status`.execute(db);
    const ops = await sql<{ kind: string; status: string; n: number }>`
      SELECT kind, status, count(*)::int AS n FROM operator_requests WHERE created_at > now() - interval '7 days' GROUP BY kind, status`.execute(db);
    const recentAudit = await db.selectFrom("audit_log").selectAll().orderBy("id", "desc").limit(50).execute();
    return {
      at: Math.floor(f.nowMs / 1000),
      network,
      chainId: deps.config.chainId,
      contracts: deps.config.addresses,
      feePayer: deps.feePayer?.address ?? null,
      owner,
      reserves: f.reserves,
      gas: f.gas,
      budgets: {
        dailyBudgetKaia: deps.config.env.DAILY_BUDGET_KAIA,
        minFeePayerBalanceKaia: deps.config.env.MIN_FEE_PAYER_BALANCE_KAIA,
        sponsorPredictPerDay: deps.config.env.SPONSOR_PREDICT_PER_DAY,
        sponsorOtherPerDay: deps.config.env.SPONSOR_OTHER_PER_DAY,
      },
      rpc: { block },
      indexer: idx?.value ?? null,
      jobs: jobs?.value ?? null,
      ai: ai?.value ?? null,
      sponsored24h: Object.fromEntries(sponsored.rows.map((r) => [r.status, r.n])),
      sponsorErrors24h: Object.fromEntries(errors.rows.map((r) => [r.error_code, r.n])),
      registrationQueue: Object.fromEntries(reg.rows.map((r) => [r.status, r.n])),
      operatorRequests7d: ops.rows,
      audit: recentAudit,
    };
  });

  get("/admin/v1/audit", "viewer", async (req) => {
    const q = z.object({ before: z.coerce.number().int().optional(), actor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).parse(req.query);
    let qb = db.selectFrom("audit_log").selectAll().orderBy("id", "desc").limit(q.limit ?? 100);
    if (q.before) qb = qb.where("id", "<", q.before);
    if (q.actor) qb = qb.where("actor", "=", q.actor);
    const rows = await qb.execute();
    return { entries: rows, nextBefore: rows.length ? rows[rows.length - 1].id : null };
  });

  get("/admin/v1/operator-requests", "viewer", async (req) => {
    const q = z.object({ status: z.string().max(20).optional() }).parse(req.query);
    let qb = db.selectFrom("operator_requests").selectAll().orderBy("id", "desc").limit(100);
    if (q.status) qb = qb.where("status", "=", q.status as any);
    return { requests: await qb.execute() };
  });

  // ------------------------------------------------------------ admin allow list (owner)
  get("/admin/v1/admins", "viewer", async () => ({
    admins: await db.selectFrom("admin_users").select(["email", "role", "added_by", "created_at"]).orderBy("created_at").execute(),
  }));
  post("/admin/v1/admins", "owner", async (req, admin) => {
    const b = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["viewer", "operator", "owner"]) }).parse(req.body);
    await db
      .insertInto("admin_users")
      .values({ privy_user_id: `email:${b.email}`, email: b.email, role: b.role, added_by: actorOf(admin) })
      .onConflict((oc) => oc.column("email").doUpdateSet({ role: b.role }))
      .execute();
    await audit(db, { actor: actorOf(admin), action: "admin.upsert", target: b.email, payload: b });
    return { ok: true };
  });
  app.delete("/admin/v1/admins/:email", async (req) => {
    const admin = await kit.authAdmin(req, "owner");
    const { email } = z.object({ email: z.string().toLowerCase() }).parse(req.params);
    if (email === admin.email) throw new ApiError("CONFLICT", "You cannot remove yourself");
    const r = await db.deleteFrom("admin_users").where("email", "=", email).executeTakeFirst();
    if (Number(r.numDeletedRows) === 0) throw new ApiError("NOT_FOUND");
    await audit(db, { actor: actorOf(admin), action: "admin.remove", target: email });
    return { ok: true };
  });
}
