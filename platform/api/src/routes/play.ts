// GET /v1/today, GET /v1/results, GET /v1/markets/:id, GET /v1/ranking/week/:weekId.
// They read the index tables the worker fills (markets, predictions, user_days, points_ledger, week_totals),
// with a live chain read of the player's day on /v1/today to cover indexer lag.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Address } from "viem";
import { sql } from "../db/index.ts";
import type { Market } from "../db/types.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import {
  DEFAULT_PARAMS,
  LIVE_STATUSES,
  asChoice,
  chainTry,
  imageUrls,
  marketTexts,
  popcount,
  predictParams,
  publicName,
  requirePlayer,
  toUnix,
} from "./common.ts";
import { currentDayId, dayEnd, dayOpensAt, weekEnd, weekFirstDay, weekOf, weekStart } from "../../../shared/src/time.ts";
import type {
  Choice,
  MarketDetailResponse,
  RankingResponse,
  RankingRow,
  ResultDay,
  ResultRow,
  ResultsResponse,
  TodayResponse,
} from "../../../shared/src/api.ts";

const CT = 10n ** 18n;

export function registerPlayRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const base = deps.config.env.IMAGE_BASE_URL;

  async function liveMarkets(dayIds: number[]): Promise<Market[]> {
    if (!dayIds.length) return [];
    return deps.db
      .selectFrom("markets")
      .selectAll()
      .where("day_id", "in", dayIds)
      .where("status", "in", [...LIVE_STATUSES])
      .orderBy("day_id", "desc")
      .orderBy("slot")
      .execute();
  }

  /** First evidence link of each market's latest decisive resolution run. */
  async function evidenceUrls(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const r = await sql<{ market_id: number; url: string }>`
      SELECT DISTINCT ON (r.market_id) r.market_id, e.url
      FROM resolutions r JOIN evidence e ON e.resolution_id = r.id
      WHERE r.market_id IN (${sql.join(ids)}) AND r.outcome IN ('A', 'B', 'void')
      ORDER BY r.market_id, r.created_at DESC, e.id ASC`.execute(deps.db);
    return new Map(r.rows.map((x) => [Number(x.market_id), x.url]));
  }

  // ------------------------------------------------------------ today
  app.get("/v1/today", async (req): Promise<TodayResponse> => {
    const { user, wallet } = await requirePlayer(kit, req);
    const nowMs = deps.now();
    const dayId = currentDayId(nowMs);
    const markets = await liveMarkets([dayId]);
    const ids = markets.map((m) => m.market_id);
    const picks = ids.length
      ? await deps.db.selectFrom("predictions").select(["market_id", "choice"]).where("wallet", "=", wallet).where("market_id", "in", ids).execute()
      : [];
    const pending = ids.length
      ? await deps.db
          .selectFrom("sponsored_txs")
          .select(["market_id", "choice"])
          .where("wallet", "=", wallet)
          .where("action", "=", "predict")
          .where("market_id", "in", ids)
          .where("status", "in", ["broadcast", "uncertain", "mined"])
          .execute()
      : [];
    const chosen = new Map<number, Choice>();
    for (const p of picks) chosen.set(p.market_id, p.choice as Choice);
    // Live read covers the indexer lag (the chain is the source of truth).
    if (user.registration === "registered" && ids.length && chosen.size < ids.length) {
      const live = await chainTry(() => deps.chain.dayOf(wallet, dayId));
      live?.choices.forEach((c, slot) => {
        const m = markets.find((x) => x.slot === slot);
        if (m && (c === 1 || c === 2)) chosen.set(m.market_id, c);
      });
    }
    const pendingMap = new Map<number, Choice>();
    for (const p of pending) if (p.market_id !== null && asChoice(p.choice)) pendingMap.set(p.market_id, p.choice as Choice);

    const ud = await deps.db.selectFrom("user_days").selectAll().where("wallet", "=", wallet).where("day_id", "=", dayId).executeTakeFirst();
    const credits = await deps.db
      .selectFrom("points_ledger")
      .select(["kind", "amount", "tx_hash"])
      .where("wallet", "=", wallet)
      .where("day_id", "=", dayId)
      .where("kind", "in", ["completion", "welcome"])
      .execute();
    const completionRow = credits.find((c) => c.kind === "completion");
    const ref = await deps.db.selectFrom("referrals").select("inviter").where("invitee", "=", wallet).executeTakeFirst();
    const inviter = ref ? await deps.db.selectFrom("users").select(["display_name", "wallet"]).where("wallet", "=", ref.inviter).executeTakeFirst() : undefined;
    const answered = Math.max(ud?.answered ?? 0, chosen.size);
    const completed = Boolean(ud?.completed) || (ids.length === 5 && chosen.size === 5);

    return {
      dayId,
      opensAt: dayOpensAt(dayId),
      endsAt: dayEnd(dayId),
      nextOpensAt: dayEnd(dayId),
      weekId: weekOf(dayId),
      published: markets.length === 5,
      markets: markets.map((m) => ({
        marketId: m.market_id,
        slot: m.slot,
        category: m.category.toLowerCase(),
        text: marketTexts(m),
        ...imageUrls(m, base),
        closesAt: toUnix(m.closes_at)!,
        resolvesAt: toUnix(m.resolves_at)!,
        myChoice: chosen.get(m.market_id) ?? null,
        pendingChoice: chosen.has(m.market_id) ? null : (pendingMap.get(m.market_id) ?? null),
      })),
      answered,
      completed,
      completion: completionRow
        ? {
            points: completionRow.amount,
            welcomePoints: credits.filter((c) => c.kind === "welcome").reduce((a, c) => a + c.amount, 0),
            creditedTx: completionRow.tx_hash,
          }
        : null,
      inviterName: ref ? publicName(inviter, ref.inviter) : null,
    };
  });

  // ------------------------------------------------------------ results
  const resultsQuery = z.object({ cursor: z.string().regex(/^\d+$/).optional(), limit: z.coerce.number().int().min(1).max(14).optional() });

  function rowOf(m: Market, choice: Choice | null, settledMask: number, hitPoints: number, nowS: number, evidence?: Map<number, string>): ResultRow {
    const outcome = (m.outcome ?? null) as 1 | 2 | 3 | null;
    const settled = (settledMask >> m.slot) & 1;
    let result: ResultRow["result"] = "pending";
    let hitState: ResultRow["hitState"] = "none";
    let pts = 0;
    if (!choice) result = "unanswered";
    else if (outcome === 3) result = "void";
    else if (outcome === 1 || outcome === 2) {
      result = choice === outcome ? "hit" : "miss";
      if (result === "hit") {
        pts = hitPoints;
        hitState = settled ? "credited" : "pending";
      }
    }
    const settlesAt = toUnix(m.settles_at);
    return {
      marketId: m.market_id,
      slot: m.slot,
      category: m.category.toLowerCase(),
      text: marketTexts(m),
      thumbUrl: imageUrls(m, base).thumbUrl,
      myChoice: choice,
      outcome,
      correctedOutcome: (m.corrected_outcome ?? null) as 1 | 2 | null,
      result,
      hitPoints: pts,
      hitState,
      landsAt: hitState === "pending" ? (settlesAt !== null && settlesAt > nowS ? settlesAt : settlesAt) : null,
      resolvesAt: toUnix(m.resolves_at)!,
      resolvedAt: toUnix(m.resolved_at),
      evidenceUrl: evidence?.get(m.market_id) ?? (m.sources as any[])?.[0]?.url ?? null,
    };
  }

  app.get("/v1/results", async (req): Promise<ResultsResponse> => {
    const q = resultsQuery.parse(req.query);
    const { wallet } = await requirePlayer(kit, req);
    const nowMs = deps.now();
    const nowS = Math.floor(nowMs / 1000);
    const today = currentDayId(nowMs);
    const limit = q.limit ?? 7;
    const params = (await predictParams(deps.db, deps.chain, nowMs)) ?? DEFAULT_PARAMS;
    const before = q.cursor ? Number(q.cursor) : today + 1;

    const dayRows = await deps.db
      .selectFrom("user_days")
      .selectAll()
      .where("wallet", "=", wallet)
      .where("day_id", "<", before)
      .orderBy("day_id", "desc")
      .limit(limit + 1)
      .execute();
    const page = dayRows.slice(0, limit);
    const dayIds = page.map((d) => d.day_id);
    const markets = await liveMarkets(dayIds);
    const preds = dayIds.length
      ? await deps.db.selectFrom("predictions").select(["market_id", "choice"]).where("wallet", "=", wallet).where("day_id", "in", dayIds).execute()
      : [];
    const choiceOf = new Map(preds.map((p) => [p.market_id, p.choice as Choice]));
    const ledger = dayIds.length
      ? await deps.db
          .selectFrom("points_ledger")
          .select(["day_id", "kind", sql<number>`sum(amount)::bigint`.as("s")])
          .where("wallet", "=", wallet)
          .where("day_id", "in", dayIds)
          .groupBy(["day_id", "kind"])
          .execute()
      : [];
    const sumOf = (d: number, k: string) => Number(ledger.find((l) => l.day_id === d && l.kind === k)?.s ?? 0);
    const friendRows = dayIds.length
      ? await deps.db
          .selectFrom("points_ledger")
          .select(["day_id", sql<number>`count(DISTINCT source_wallet)::int`.as("n")])
          .where("wallet", "=", wallet)
          .where("kind", "=", "referral")
          .where("day_id", "in", dayIds)
          .groupBy("day_id")
          .execute()
      : [];
    const evidence = await evidenceUrls(markets.filter((m) => m.resolved_at).map((m) => m.market_id));

    const days: ResultDay[] = page.map((ud) => {
      const rows = markets
        .filter((m) => m.day_id === ud.day_id)
        .map((m) => rowOf(m, choiceOf.get(m.market_id) ?? null, ud.settled_mask, params.hitPoints, nowS, evidence));
      return {
        dayId: ud.day_id,
        weekId: weekOf(ud.day_id),
        answered: ud.answered,
        completed: ud.completed,
        completionPoints: sumOf(ud.day_id, "completion") || ud.completion_points,
        hits: ud.hits,
        hitPointsCredited: sumOf(ud.day_id, "hits") || ud.hit_points,
        hitPointsPending: rows.filter((r) => r.hitState === "pending").reduce((a, r) => a + r.hitPoints, 0),
        welcomePoints: sumOf(ud.day_id, "welcome"),
        inviteBonus: sumOf(ud.day_id, "referral"),
        inviteFriends: Number(friendRows.find((f) => f.day_id === ud.day_id)?.n ?? 0),
        rows,
      };
    });

    // Summary: this week (ranked points), all time, and points still pending (resolved, not settled; last 3 days).
    const week = weekOf(today);
    const wt = await deps.db.selectFrom("week_totals").select("points").where("week_id", "=", week).where("wallet", "=", wallet).executeTakeFirst();
    const weekDays = await deps.db
      .selectFrom("user_days")
      .select(["answered", "hits", "settled_mask"])
      .where("wallet", "=", wallet)
      .where("day_id", ">=", weekFirstDay(week))
      .where("day_id", "<=", today)
      .execute();
    const allDays = await deps.db.selectFrom("user_days").select(["hits", "settled_mask"]).where("wallet", "=", wallet).execute();
    const all = { hits: allDays.reduce((a, d) => a + d.hits, 0), settled: allDays.reduce((a, d) => a + popcount(d.settled_mask), 0) };
    const allPts = await deps.db
      .selectFrom("points_ledger")
      .select(sql<number>`coalesce(sum(amount),0)::bigint`.as("s"))
      .where("wallet", "=", wallet)
      .where("ranked", "=", true)
      .executeTakeFirst();
    const recentIds = [today, today - 1, today - 2, today - 3];
    const recentUd = await deps.db.selectFrom("user_days").select(["day_id", "settled_mask"]).where("wallet", "=", wallet).where("day_id", "in", recentIds).execute();
    const recentMarkets = await liveMarkets(recentIds);
    const recentPreds = await deps.db.selectFrom("predictions").select(["market_id", "choice"]).where("wallet", "=", wallet).where("day_id", "in", recentIds).execute();
    const rc = new Map(recentPreds.map((p) => [p.market_id, p.choice as Choice]));
    let pendingPoints = 0;
    for (const m of recentMarkets) {
      const mask = recentUd.find((u) => u.day_id === m.day_id)?.settled_mask ?? 0;
      const r = rowOf(m, rc.get(m.market_id) ?? null, mask, params.hitPoints, nowS);
      if (r.hitState === "pending") pendingPoints += r.hitPoints;
    }
    const settledAll = Number(all?.settled ?? 0);
    const hitsAll = Number(all?.hits ?? 0);
    return {
      summary: {
        week: {
          weekId: week,
          points: wt?.points ?? 0,
          hits: weekDays.reduce((a, d) => a + d.hits, 0),
          answered: weekDays.reduce((a, d) => a + d.answered, 0),
          daysPlayed: weekDays.filter((d) => d.answered > 0).length,
        },
        allTime: { points: Number(allPts?.s ?? 0), hits: hitsAll, settled: settledAll, hitRate: settledAll ? hitsAll / settledAll : null },
        pendingPoints,
      },
      days,
      nextCursor: dayRows.length > limit ? String(page[page.length - 1].day_id) : null,
    };
  });

  // ------------------------------------------------------------ one market
  app.get("/v1/markets/:id", async (req): Promise<MarketDetailResponse> => {
    const { id } = z.object({ id: z.coerce.number().int().nonnegative() }).parse(req.params);
    const { wallet } = await requirePlayer(kit, req);
    const m = await deps.db.selectFrom("markets").selectAll().where("market_id", "=", id).where("status", "in", [...LIVE_STATUSES]).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND", `No published market ${id}`);
    const pick = await deps.db.selectFrom("predictions").select("choice").where("wallet", "=", wallet).where("market_id", "=", id).executeTakeFirst();
    // Evidence of the latest decisive run (adapter, admin, or an AI run with a definite answer).
    const res = await deps.db
      .selectFrom("resolutions")
      .selectAll()
      .where("market_id", "=", id)
      .where("outcome", "in", ["A", "B", "void"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    const ev = res
      ? await deps.db.selectFrom("evidence").select(["url", "quote", "observed_at"]).where("resolution_id", "=", res.id).orderBy("id").execute()
      : [];
    return {
      marketId: m.market_id,
      dayId: m.day_id,
      slot: m.slot,
      category: m.category.toLowerCase(),
      status: m.status,
      text: marketTexts(m),
      imageUrl: imageUrls(m, base).imageUrl,
      closesAt: toUnix(m.closes_at)!,
      resolvesAt: toUnix(m.resolves_at)!,
      sources: (m.sources as any[]) ?? [],
      outcome: (m.outcome ?? null) as 1 | 2 | 3 | null,
      correctedOutcome: (m.corrected_outcome ?? null) as 1 | 2 | null,
      resolvedAt: toUnix(m.resolved_at),
      settlesAt: toUnix(m.settles_at),
      myChoice: asChoice(pick?.choice),
      evidence: ev.map((e) => ({ url: e.url, quote: e.quote, observedAt: toUnix(e.observed_at) })),
      resolutionSummary: res?.reasoning ?? null,
    };
  });

  // ------------------------------------------------------------ ranking
  app.get("/v1/ranking/week/:weekId", async (req): Promise<RankingResponse> => {
    const { weekId: raw } = z.object({ weekId: z.union([z.literal("current"), z.string().regex(/^\d+$/)]) }).parse(req.params);
    const { user, wallet } = await requirePlayer(kit, req);
    const nowMs = deps.now();
    const weekId = raw === "current" ? weekOf(currentDayId(nowMs)) : Number(raw);
    const r = await buildRanking(kit, weekId, { wallet, frozen: user.frozen }, nowMs);
    const drops = await deps.db
      .selectFrom("airdrop_rows")
      .select(["week_id", "rank", "wallet", "amount", "tx_hash", "skipped_reason"])
      .where("week_id", "in", [weekId, weekId - 1])
      .orderBy("rank")
      .execute();
    const week = await deps.db.selectFrom("weeks").select("airdrop_tx").where("week_id", "=", weekId).executeTakeFirst();
    const thisWeek = drops.filter((d) => d.week_id === weekId);
    const mineNow = thisWeek.find((d) => d.wallet === wallet && d.tx_hash);
    const prev = drops.find((d) => d.week_id === weekId - 1 && d.wallet === wallet && !d.skipped_reason && d.amount && d.amount !== "0");
    return {
      ...r,
      airdropTx: mineNow?.tx_hash ?? week?.airdrop_tx ?? thisWeek.find((d) => d.tx_hash)?.tx_hash ?? null,
      lastWeek: prev ? { weekId: weekId - 1, rank: prev.rank, prizeWei: String(prev.amount), txHash: prev.tx_hash } : null,
    };
  });
}

/** The weekly ranking: accounts on hold are left out of the prize ranks (the players below move up). */
export async function buildRanking(
  kit: RouteKit,
  weekId: number,
  me: { wallet: Address; frozen: boolean } | null,
  nowMs: number,
  topN = 10,
): Promise<Omit<RankingResponse, "airdropTx" | "lastWeek">> {
  const { db } = kit.deps;
  const params = (await predictParams(db, kit.deps.chain, nowMs)) ?? DEFAULT_PARAMS;
  const ranked = await sql<{ wallet: string; points: number; rank: number; display_name: string | null }>`
    SELECT t.wallet, t.points, u.display_name,
           row_number() OVER (ORDER BY t.points DESC, t.last_completion_at ASC NULLS LAST, t.wallet ASC)::int AS rank
    FROM week_totals t LEFT JOIN users u ON u.wallet = t.wallet
    WHERE t.week_id = ${weekId} AND t.points > 0 AND coalesce(u.frozen, false) = false
    ORDER BY rank`.execute(db);
  const rows = ranked.rows;
  const week = await db.selectFrom("weeks").selectAll().where("week_id", "=", weekId).executeTakeFirst();
  // Pool: the worker's figure for the week, else an estimate of 1 CT per ranked player, capped at maxWeeklyPool.
  const poolWei = week?.pool ? BigInt(week.pool) : BigInt(Math.min(rows.length, params.maxWeeklyPool)) * CT;
  const prize = (rank: number) => (rank <= params.splitBps.length ? ((poolWei * BigInt(params.splitBps[rank - 1])) / 10_000n).toString() : null);
  const toRow = (r: (typeof rows)[number]): RankingRow => ({
    rank: r.rank,
    name: publicName({ display_name: r.display_name, wallet: r.wallet }),
    points: r.points,
    prizeWei: prize(r.rank),
    ...(me && r.wallet === me.wallet ? { me: true } : {}),
  });
  const top = rows.slice(0, topN).map(toRow);
  let meOut: RankingResponse["me"] = null;
  let around: RankingRow[] = [];
  if (me) {
    const mine = rows.find((r) => r.wallet === me.wallet);
    if (me.frozen) {
      const own = await db.selectFrom("week_totals").select("points").where("week_id", "=", weekId).where("wallet", "=", me.wallet).executeTakeFirst();
      meOut = { rank: null, points: own?.points ?? 0, gapToTenth: null, noPrize: true };
    } else if (mine) {
      const tenth = rows[topN - 1];
      meOut = { rank: mine.rank, points: mine.points, gapToTenth: mine.rank > topN && tenth ? tenth.points - mine.points : null, noPrize: false };
      if (mine.rank > topN) around = rows.slice(Math.max(topN, mine.rank - 3), mine.rank + 2).map(toRow);
    } else {
      meOut = { rank: null, points: 0, gapToTenth: rows[topN - 1]?.points ?? null, noPrize: false };
    }
  }
  const status: RankingResponse["status"] = week?.status === "airdropped" ? "airdropped" : nowMs / 1000 >= weekEnd(weekId) ? "closed" : "open";
  return {
    weekId,
    startsAt: weekStart(weekId),
    endsAt: weekEnd(weekId),
    status,
    poolWei: poolWei.toString(),
    qualifiedPlayers: week?.qualified_players ?? null,
    splitBps: params.splitBps,
    top,
    me: meOut,
    around,
    tieBreak: "earlier_last_completion",
  };
}
