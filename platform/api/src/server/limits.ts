// Counters in Postgres (usage_daily) for rate limits and budgets, safe with several API instances.
// takeSlots() checks and increments several counters in one transaction: either every counter is under its
// limit and all are incremented, or nothing changes and the first failing counter is reported.
import { sql, type Db } from "../db/index.ts";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types.ts";

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
export function utcHour(ms: number): string {
  return "h:" + new Date(ms).toISOString().slice(0, 13);
}
export function utcMinute(ms: number): string {
  return "m:" + new Date(ms).toISOString().slice(0, 16);
}

export interface Slot {
  bucket: string;
  key: string;
  /** Maximum count after increment. */
  limit: number;
  /** Code reported when this counter is full. */
  code: string;
}

type Executor = Kysely<Database> | Transaction<Database>;

async function bump(ex: Executor, s: Slot): Promise<boolean> {
  const r = await sql<{ count: number }>`
    INSERT INTO usage_daily (day, key, count) VALUES (${s.bucket}, ${s.key}, 1)
    ON CONFLICT (day, key) DO UPDATE SET count = usage_daily.count + 1 WHERE usage_daily.count < ${s.limit}
    RETURNING count`.execute(ex);
  return r.rows.length > 0 && s.limit > 0;
}

export class LimitHit extends Error {
  constructor(public code: string, public slot: Slot) {
    super(code);
  }
}

/** Increments every slot or none. Throws LimitHit with the first full counter. */
export async function takeSlots(db: Db, slots: Slot[]): Promise<void> {
  if (!slots.length) return;
  await db.transaction().execute(async (trx) => {
    for (const s of slots) {
      if (!(await bump(trx, s))) throw new LimitHit(s.code, s);
    }
  });
}

/** Same as takeSlots inside an existing transaction. */
export async function takeSlotsIn(trx: Transaction<Database>, slots: Slot[]): Promise<void> {
  for (const s of slots) {
    if (!(await bump(trx, s))) throw new LimitHit(s.code, s);
  }
}

/** Undo one increment of each slot (a reservation that was released). */
export async function giveBack(ex: Executor, slots: { bucket: string; key: string }[]): Promise<void> {
  for (const s of slots) {
    await sql`UPDATE usage_daily SET count = GREATEST(count - 1, 0) WHERE day = ${s.bucket} AND key = ${s.key}`.execute(ex);
  }
}

/** Current value of a counter (0 when missing). */
export async function peekCount(db: Executor, bucket: string, key: string): Promise<number> {
  const r = await db.selectFrom("usage_daily").select("count").where("day", "=", bucket).where("key", "=", key).executeTakeFirst();
  return r?.count ?? 0;
}

/** Sum of count rows of a key prefix inside a bucket (for example sign ups per IP over a day). */
export async function addSpent(ex: Executor, bucket: string, key: string, deltaWei: bigint): Promise<void> {
  await sql`
    INSERT INTO usage_daily (day, key, count, spent_wei) VALUES (${bucket}, ${key}, 0, ${deltaWei.toString()})
    ON CONFLICT (day, key) DO UPDATE SET spent_wei = GREATEST(usage_daily.spent_wei + ${deltaWei.toString()}::numeric, 0)`.execute(ex);
}

/** Reserves `costWei` of the daily budget if it fits under `budgetWei`; returns false when it does not. */
export async function reserveBudget(ex: Executor, bucket: string, costWei: bigint, budgetWei: bigint): Promise<boolean> {
  const r = await sql<{ spent_wei: string }>`
    INSERT INTO usage_daily (day, key, count, spent_wei)
      SELECT ${bucket}, 'budget', 1, ${costWei.toString()}::numeric WHERE ${costWei.toString()}::numeric <= ${budgetWei.toString()}::numeric
    ON CONFLICT (day, key) DO UPDATE SET spent_wei = usage_daily.spent_wei + EXCLUDED.spent_wei, count = usage_daily.count + 1
      WHERE usage_daily.spent_wei + EXCLUDED.spent_wei <= ${budgetWei.toString()}::numeric
    RETURNING spent_wei`.execute(ex);
  return r.rows.length > 0;
}
