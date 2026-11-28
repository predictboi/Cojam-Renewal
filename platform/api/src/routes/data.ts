// Data room (DECISIONS "Data room", contract platform/shared/src/dataRoom.ts):
//   GET /public/data?cursor=                    no sign in: closed days, newest first, 7 a page, plus the crowd record
//   GET /admin/v1/data-room                     viewer: settings (minimum players)
//   POST /admin/v1/data-room                    owner: change the minimum players (audited)
//   GET|POST|DELETE /admin/v1/questions/:id/outside   viewer / operator: the linked Polymarket market (audited)
// The split on a result row (GET /v1/results) uses splitsFor() from here.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { audit, type Db } from "../db/index.ts";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { LimitHit, takeSlots, utcHour } from "../server/limits.ts";
import type { AuthedAdmin } from "../auth/index.ts";
import { LIVE_STATUSES, toUnix } from "./common.ts";
import { crowdRecord, crowdRightOf, dataRoomSettings, effectiveOutcome, EMPTY_COUNTS, saveDataRoomSettings, splitCounts, toSplit, type SplitCounts } from "../dataRoom/split.ts";
import { slugFromUrl } from "../dataRoom/polymarket.ts";
import { currentDayId } from "../../../shared/src/time.ts";
import { DATA_MIN_PLAYERS, DATA_MIN_TOP_PLAYERS, type DataDay, type DataMarket, type DataRoom, type DataSplit } from "../../../shared/src/dataRoom.ts";

export const DATA_PAGE_DAYS = 7;
/** Counts of a closed day are cached this long (only indexer lag right after the close can still add picks). */
const CLOSED_TTL_MS = 10 * 60_000;
/** Counts of the open day (the live figure a player sees after picking). */
const OPEN_TTL_MS = 15_000;
/** A whole /public/data page (outcomes and outside prices are re-read after this). */
const PAGE_TTL_MS = 60_000;

type DayCache = Map<number, { counts: Map<number, SplitCounts>; until: number }>;
const countsCache = new WeakMap<object, DayCache>();
const pageCache = new WeakMap<object, Map<string, { body: DataRoom; until: number }>>();
const crowdCache = new WeakMap<object, { key: string; v: DataRoom["crowd"]; until: number }>();

/** Raw counts of the markets of the given days (whole days are computed and cached together). */
async function dayCounts(db: Db, dayIds: number[], today: number, nowMs: number): Promise<Map<number, SplitCounts>> {
  let cache = countsCache.get(db);
  if (!cache) countsCache.set(db, (cache = new Map()));
  const out = new Map<number, SplitCounts>();
  const missing: number[] = [];
  for (const d of new Set(dayIds)) {
    const hit = cache.get(d);
    if (hit && hit.until > nowMs) for (const [k, v] of hit.counts) out.set(k, v);
    else missing.push(d);
  }
  if (missing.length) {
    const ms = await db.selectFrom("markets").select(["market_id", "day_id"]).where("day_id", "in", missing).where("status", "in", [...LIVE_STATUSES]).execute();
    const counts = await splitCounts(db, ms.map((m) => m.market_id));
    if (cache.size > 500) cache.clear();
    for (const d of missing) {
      const mine = new Map<number, SplitCounts>();
      for (const m of ms.filter((x) => x.day_id === d)) mine.set(m.market_id, counts.get(m.market_id) ?? EMPTY_COUNTS);
      cache.set(d, { counts: mine, until: nowMs + (d < today ? CLOSED_TTL_MS : OPEN_TTL_MS) });
      for (const [k, v] of mine) out.set(k, v);
    }
  }
  return out;
}

/** Splits (minimums applied) of the given markets, live for the open day and final for closed days. */
export async function splitsFor(db: Db, markets: { market_id: number; day_id: number }[], nowMs: number): Promise<Map<number, DataSplit>> {
  const out = new Map<number, DataSplit>();
  if (!markets.length) return out;
  const { minPlayers } = await dataRoomSettings(db, nowMs);
  const counts = await dayCounts(db, markets.map((m) => m.day_id), currentDayId(nowMs), nowMs);
  for (const m of markets) out.set(m.market_id, toSplit(counts.get(m.market_id) ?? EMPTY_COUNTS, minPlayers));
  return out;
}

const CATEGORIES = new Set(["crypto", "markets", "weather", "sports", "culture"]);

export function registerDataRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const db = deps.db;
  const env = deps.config.env;

  // ------------------------------------------------------------ public data room
  const query = z.object({ cursor: z.string().regex(/^\d{1,9}$/).optional() });
  const handler = async (req: FastifyRequest, reply: { header(k: string, v: string): unknown }): Promise<DataRoom> => {
    const q = query.parse(req.query ?? {});
    const ip = kit.ipHashOf(req);
    const nowMs = deps.now();
    if (ip) {
      try {
        await takeSlots(db, [{ bucket: utcHour(nowMs), key: `publicdata:ip:${ip}`, limit: env.PUBLIC_DATA_IP_PER_HOUR, code: "RATE_LIMITED_IP" }]);
      } catch (e) {
        if (e instanceof LimitHit) throw new ApiError("RATE_LIMITED_IP");
        throw e;
      }
    }
    reply.header("cache-control", "public, max-age=60");
    const today = currentDayId(nowMs);
    const { minPlayers } = await dataRoomSettings(db, nowMs);
    const key = `${q.cursor ?? ""}|${today}|${minPlayers}`;
    let pc = pageCache.get(db);
    if (!pc) pageCache.set(db, (pc = new Map()));
    const hit = pc.get(key);
    if (hit && hit.until > nowMs) return hit.body;

    // Only closed days: every question of day d closes at the start of day d + 1.
    const before = Math.min(q.cursor ? Number(q.cursor) : today, today);
    const dayRows = await db
      .selectFrom("markets")
      .select("day_id")
      .distinct()
      .where("status", "in", [...LIVE_STATUSES])
      .where("day_id", "<", before)
      .orderBy("day_id", "desc")
      .limit(DATA_PAGE_DAYS + 1)
      .execute();
    const pageDays = dayRows.slice(0, DATA_PAGE_DAYS).map((d) => d.day_id);
    const markets = pageDays.length
      ? await db.selectFrom("markets").selectAll().where("day_id", "in", pageDays).where("status", "in", [...LIVE_STATUSES]).orderBy("day_id", "desc").orderBy("slot").execute()
      : [];
    const counts = await dayCounts(db, pageDays, today, nowMs);
    const ids = markets.map((m) => m.market_id);
    const outside = ids.length
      ? await db.selectFrom("market_outside").selectAll().where("market_id", "in", ids).where("right_price", "is not", null).where("taken_at", "is not", null).execute()
      : [];
    const days: DataDay[] = pageDays.map((d) => {
      const ms = markets.filter((m) => m.day_id === d);
      return {
        dayId: d,
        closedAt: Math.max(...ms.map((m) => toUnix(m.closes_at)!)),
        markets: ms.map((m): DataMarket => {
          const c = counts.get(m.market_id) ?? EMPTY_COUNTS;
          const outcome = effectiveOutcome(m);
          const content = m.content as unknown as Record<"en" | "ko" | "ja", { title: string; left: string; right: string }>;
          const text = Object.fromEntries((["en", "ko", "ja"] as const).map((l) => [l, { title: content[l]?.title ?? "", a: content[l]?.left ?? "", b: content[l]?.right ?? "" }])) as DataMarket["text"];
          const cat = m.category.toLowerCase();
          const o = outside.find((x) => x.market_id === m.market_id);
          return {
            marketId: String(m.market_id),
            slot: m.slot,
            category: (CATEGORIES.has(cat) ? cat : "culture") as DataMarket["category"],
            text,
            split: toSplit(c, minPlayers),
            ...(o ? { outside: { source: o.source, url: o.url, rightPrice: o.right_price!, takenAt: toUnix(o.taken_at)! } } : {}),
            outcome,
            crowdRight: crowdRightOf(c, outcome, minPlayers),
          };
        }),
      };
    });

    const crowdKey = `${today}|${minPlayers}`;
    let crowd = crowdCache.get(db);
    if (!crowd || crowd.key !== crowdKey || crowd.until <= nowMs) {
      crowd = { key: crowdKey, v: await crowdRecord(db, today, minPlayers), until: nowMs + PAGE_TTL_MS };
      crowdCache.set(db, crowd);
    }
    const body: DataRoom = { crowd: crowd.v, days, nextCursor: dayRows.length > DATA_PAGE_DAYS ? String(pageDays[pageDays.length - 1]) : null };
    if (pc.size > 200) pc.clear();
    pc.set(key, { body, until: nowMs + PAGE_TTL_MS });
    return body;
  };
  app.get("/public/data", handler);
  app.get("/v1/public/data", handler);

  // ------------------------------------------------------------ admin
  type Role = "viewer" | "operator" | "owner";
  const route = (method: "GET" | "POST" | "DELETE", path: string, role: Role, fn: (req: FastifyRequest, a: AuthedAdmin) => Promise<unknown>) =>
    app.route({ method, url: path, handler: async (req) => fn(req, await kit.authAdmin(req, role)) });
  const reason = z.string().trim().min(3).max(500);

  route("GET", "/admin/v1/data-room", "viewer", async () => ({ ...(await dataRoomSettings(db, deps.now())), defaultMinPlayers: DATA_MIN_PLAYERS, minTopPlayers: DATA_MIN_TOP_PLAYERS }));
  route("POST", "/admin/v1/data-room", "owner", async (req, admin) => {
    const b = z.object({ minPlayers: z.number().int().min(1).max(10_000), reason }).parse(req.body);
    const prev = await dataRoomSettings(db, deps.now());
    await saveDataRoomSettings(db, { minPlayers: b.minPlayers });
    await audit(db, { actor: admin.email, action: "data_room.settings", payload: { reason: b.reason, previous: prev, next: { minPlayers: b.minPlayers } } });
    return { minPlayers: b.minPlayers };
  });

  const idParam = z.object({ id: z.coerce.number().int().nonnegative() });
  const outsideView = (o: { source: string; url: string; market_slug: string; right_outcome: string; right_price: number | null; taken_at: Date | null; attempted_at: Date | null; error: string | null; linked_by: string }) => ({
    source: o.source,
    url: o.url,
    marketSlug: o.market_slug,
    rightOutcome: o.right_outcome,
    rightPrice: o.right_price,
    takenAt: toUnix(o.taken_at),
    attemptedAt: toUnix(o.attempted_at),
    error: o.error,
    linkedBy: o.linked_by,
  });
  route("GET", "/admin/v1/questions/:id/outside", "viewer", async (req) => {
    const { id } = idParam.parse(req.params);
    const o = await db.selectFrom("market_outside").selectAll().where("market_id", "=", id).executeTakeFirst();
    return { marketId: id, outside: o ? outsideView(o) : null };
  });
  route("POST", "/admin/v1/questions/:id/outside", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const b = z
      .object({
        source: z.literal("polymarket"),
        url: z.string().url().max(500),
        /** Needed when the link is an event page with several markets. */
        marketSlug: z.string().regex(/^[a-z0-9-]{3,200}$/i).optional(),
        /** The outside outcome that corresponds to our right choice (choice B). */
        rightOutcome: z.string().trim().min(1).max(60).default("Yes"),
        reason: reason.optional(),
      })
      .parse(req.body);
    const slug = b.marketSlug ?? slugFromUrl(b.url);
    if (!slug) throw new ApiError("BAD_REQUEST", "url must be a polymarket.com market or event link (or pass marketSlug)");
    const m = await db.selectFrom("markets").select(["market_id", "status"]).where("market_id", "=", id).executeTakeFirst();
    if (!m) throw new ApiError("NOT_FOUND");
    if (m.status === "cancelled") throw new ApiError("CONFLICT", "The question is cancelled");
    const cur = await db.selectFrom("market_outside").selectAll().where("market_id", "=", id).executeTakeFirst();
    if (cur?.taken_at) throw new ApiError("CONFLICT", "The outside price was already read: the record is final");
    const now = new Date(deps.now());
    const row = { source: "polymarket" as const, url: b.url, market_slug: slug, right_outcome: b.rightOutcome, linked_by: admin.email, right_price: null, taken_at: null, attempted_at: null, error: null, updated_at: now };
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("market_outside")
        .values({ market_id: id, ...row })
        .onConflict((oc) => oc.column("market_id").doUpdateSet(row))
        .execute();
      await audit(trx as unknown as Db, { actor: admin.email, action: "question.outside.link", target: String(id), payload: { url: b.url, marketSlug: slug, rightOutcome: b.rightOutcome, reason: b.reason ?? null, previous: cur ? { url: cur.url, rightOutcome: cur.right_outcome } : null } });
    });
    const o = await db.selectFrom("market_outside").selectAll().where("market_id", "=", id).executeTakeFirstOrThrow();
    return { marketId: id, outside: outsideView(o) };
  });
  route("DELETE", "/admin/v1/questions/:id/outside", "operator", async (req, admin) => {
    const { id } = idParam.parse(req.params);
    const cur = await db.selectFrom("market_outside").selectAll().where("market_id", "=", id).executeTakeFirst();
    if (!cur) throw new ApiError("NOT_FOUND", "No outside market is linked");
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("market_outside").where("market_id", "=", id).execute();
      await audit(trx as unknown as Db, { actor: admin.email, action: "question.outside.unlink", target: String(id), payload: { url: cur.url, rightOutcome: cur.right_outcome, rightPrice: cur.right_price } });
    });
    return { marketId: id, outside: null };
  });
}
