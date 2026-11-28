// Data room figures (DECISIONS "Data room", contract in platform/shared/src/dataRoom.ts): how the players of a
// question picked, from the picks the indexer already stores in `predictions`. One player is one vote.
//
// Rules:
//   * Frozen (blocked) accounts are left out of every count, and out of the top players.
//   * "Top players" of a day D: the top fifth by hit rate among players with at least TOP_MIN_ANSWERED answered,
//     resolved questions (choice 1 or 2 answers, corrected answers win) on days before D. Using only earlier days
//     keeps the question's own answer out of the ranking and keeps a closed day's figure stable.
//   * Shares are whole percents of choice B (the right choice). Below the minimum players there is no share.
import { sql, getState, setState, type Db } from "../db/index.ts";
import { DATA_MIN_PLAYERS, DATA_MIN_TOP_PLAYERS, type DataSide, type DataSplit } from "../../../shared/src/dataRoom.ts";

/** Answered, resolved questions a player needs before counting toward the top players. */
export const TOP_MIN_ANSWERED = 20;
/** app_state key of the data room settings ({ minPlayers }), set by the admin. */
export const DATA_ROOM_KEY = "data.room";

/** Raw counts of one question (no minimum applied). */
export interface SplitCounts {
  players: number;
  right: number;
  topPlayers: number;
  topRight: number;
}

export const EMPTY_COUNTS: SplitCounts = { players: 0, right: 0, topPlayers: 0, topRight: 0 };

export interface DataRoomSettings {
  minPlayers: number;
}

const settingsCache = new WeakMap<object, { v: DataRoomSettings; until: number }>();

/** The admin parameters of the data room (app_state "data.room"), cached 60 s; defaults from the shared contract. */
export async function dataRoomSettings(db: Db, nowMs = Date.now()): Promise<DataRoomSettings> {
  const hit = settingsCache.get(db);
  if (hit && hit.until > nowMs) return hit.v;
  const row = await getState<Partial<DataRoomSettings>>(db, DATA_ROOM_KEY).catch(() => null);
  const m = Number(row?.value?.minPlayers);
  const v = { minPlayers: Number.isInteger(m) && m >= 1 ? m : DATA_MIN_PLAYERS };
  settingsCache.set(db, { v, until: nowMs + 60_000 });
  return v;
}

export async function saveDataRoomSettings(db: Db, v: DataRoomSettings): Promise<void> {
  await setState(db, DATA_ROOM_KEY, v);
  settingsCache.delete(db);
}

const pct = (n: number, of: number) => Math.round((100 * n) / of);

/** Applies the minimums to raw counts. */
export function toSplit(c: SplitCounts, minPlayers: number): DataSplit {
  const enough = c.players >= minPlayers && c.players > 0;
  return {
    players: c.players,
    rightShare: enough ? pct(c.right, c.players) : null,
    topRightShare: enough && c.topPlayers >= DATA_MIN_TOP_PLAYERS ? pct(c.topRight, c.topPlayers) : null,
  };
}

/** True when the larger share picked the answer; null before the answer, on an even split or below the minimum. */
export function crowdRightOf(c: Pick<SplitCounts, "players" | "right">, outcome: DataSide | null, minPlayers: number): boolean | null {
  if (outcome === null || c.players < minPlayers || c.players === 0) return null;
  const left = c.players - c.right;
  if (left === c.right) return null;
  return (c.right > left ? 2 : 1) === outcome;
}

/** The answer as the data room shows it: the corrected answer wins, a void is no answer. */
export function effectiveOutcome(m: { outcome: number | null; corrected_outcome: number | null }): DataSide | null {
  const o = m.corrected_outcome ?? m.outcome;
  return o === 1 || o === 2 ? o : null;
}

/**
 * Raw counts for the given markets (overall and among the top players of each market's day).
 * Markets without a pick are absent from the map (use EMPTY_COUNTS).
 */
export async function splitCounts(db: Db, marketIds: number[]): Promise<Map<number, SplitCounts>> {
  const out = new Map<number, SplitCounts>();
  if (!marketIds.length) return out;
  const r = await sql<{ market_id: number; players: number; right_n: number; top_players: number; top_right: number }>`
    WITH target AS (
      SELECT market_id, day_id FROM markets WHERE market_id IN (${sql.join(marketIds)})
    ), days AS (
      SELECT DISTINCT day_id FROM target
    ), hist AS (
      SELECT d.day_id AS d, p.wallet,
             count(*)::int AS n,
             count(*) FILTER (WHERE p.choice = coalesce(m.corrected_outcome, m.outcome))::int AS hits
      FROM days d
      JOIN predictions p ON p.day_id < d.day_id
      JOIN markets m ON m.market_id = p.market_id
      LEFT JOIN users u ON u.wallet = p.wallet
      WHERE coalesce(m.corrected_outcome, m.outcome) IN (1, 2) AND NOT coalesce(u.frozen, false)
      GROUP BY d.day_id, p.wallet
      HAVING count(*) >= ${TOP_MIN_ANSWERED}
    ), ranked AS (
      SELECT d, wallet,
             row_number() OVER (PARTITION BY d ORDER BY hits::float8 / n DESC, n DESC, wallet) AS rn,
             count(*) OVER (PARTITION BY d) AS eligible
      FROM hist
    ), top AS (
      SELECT d, wallet FROM ranked WHERE rn <= ceil(eligible / 5.0)
    )
    SELECT t.market_id,
           count(*)::int AS players,
           count(*) FILTER (WHERE p.choice = 2)::int AS right_n,
           count(tp.wallet)::int AS top_players,
           count(tp.wallet) FILTER (WHERE p.choice = 2)::int AS top_right
    FROM target t
    JOIN predictions p ON p.market_id = t.market_id
    LEFT JOIN users u ON u.wallet = p.wallet
    LEFT JOIN top tp ON tp.d = t.day_id AND tp.wallet = p.wallet
    WHERE NOT coalesce(u.frozen, false)
    GROUP BY t.market_id`.execute(db);
  for (const x of r.rows) out.set(Number(x.market_id), { players: x.players, right: x.right_n, topPlayers: x.top_players, topRight: x.top_right });
  return out;
}

/** Overall counts only (no top players), for the crowd record over many questions. */
export async function plainCounts(db: Db, beforeDay: number): Promise<{ market_id: number; outcome: number | null; corrected_outcome: number | null; players: number; right_n: number }[]> {
  const r = await sql<{ market_id: number; outcome: number | null; corrected_outcome: number | null; players: number; right_n: number }>`
    SELECT m.market_id, m.outcome, m.corrected_outcome,
           count(p.wallet)::int AS players,
           count(p.wallet) FILTER (WHERE p.choice = 2)::int AS right_n
    FROM markets m
    JOIN predictions p ON p.market_id = m.market_id
    LEFT JOIN users u ON u.wallet = p.wallet
    WHERE m.day_id < ${beforeDay}
      AND m.status IN ('published', 'closed', 'resolved', 'voided', 'corrected')
      AND coalesce(m.corrected_outcome, m.outcome) IN (1, 2)
      AND NOT coalesce(u.frozen, false)
    GROUP BY m.market_id`.execute(db);
  return r.rows;
}

/** How often the larger share was right, over every answered question that met the minimum (even splits excluded). */
export async function crowdRecord(db: Db, beforeDay: number, minPlayers: number): Promise<{ rightPercent: number | null; questions: number }> {
  let questions = 0;
  let right = 0;
  for (const m of await plainCounts(db, beforeDay)) {
    const c = crowdRightOf({ players: m.players, right: m.right_n }, effectiveOutcome(m), minPlayers);
    if (c === null) continue;
    questions++;
    if (c) right++;
  }
  return { rightPercent: questions ? pct(right, questions) : null, questions };
}
