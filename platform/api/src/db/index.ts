// Postgres access shared by the API and the worker: one Kysely instance per process.
//   import { createDb } from "../db/index.ts";  const db = createDb(config.databaseUrl);
import pg from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import type { Database } from "./types.ts";

export type { Database } from "./types.ts";
export * from "./types.ts";
export { sql };
export type Db = Kysely<Database>;

// int8 -> number (ids, blocks, days, points all fit in 2^53). numeric stays a string (wei amounts).
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(databaseUrl: string, max = 10): pg.Pool {
  const ssl = /sslmode=require|render\.com/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined;
  return new pg.Pool({ connectionString: databaseUrl, max, ssl });
}

export function createDb(databaseUrl: string, opts: { max?: number } = {}): Db {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: createPool(databaseUrl, opts.max) }) });
}

/** Write one audit row. Use inside the same transaction as the change it records. */
export async function audit(
  db: Db,
  row: { actor: string; action: string; target?: string | null; payload?: unknown; txHash?: string | null },
): Promise<void> {
  await db
    .insertInto("audit_log")
    .values({
      actor: row.actor,
      action: row.action,
      target: row.target ?? null,
      payload: row.payload === undefined ? null : JSON.stringify(row.payload),
      tx_hash: row.txHash ?? null,
    })
    .execute();
}

/** Read a snapshot written by the worker into app_state (null when missing). */
export async function getState<T = unknown>(db: Db, key: string): Promise<{ value: T; updatedAt: Date } | null> {
  const row = await db.selectFrom("app_state").select(["value", "updated_at"]).where("key", "=", key).executeTakeFirst();
  return row ? { value: row.value as T, updatedAt: row.updated_at } : null;
}

export async function setState(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insertInto("app_state")
    .values({ key, value: JSON.stringify(value) })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value: JSON.stringify(value), updated_at: new Date() }))
    .execute();
}

/** Keys of app_state the worker writes and the API reads. */
export const STATE_KEYS = {
  /** CojamPredict params() as JSON (numbers, treasury, splitBps), plus pendingParams. */
  predictParams: "predict.params",
  /** { reserve: wei string, availableRewards: wei string, totalPrincipal: wei string } */
  reserves: "chain.reserves",
  /** { feePayer: wei string, operator: wei string } */
  balances: "chain.balances",
  /** { block, lag, at } */
  indexer: "indexer.status",
  /** Staking params: { rates: number[4][3], tiers: [wei, wei], minStake, minClaim, maxOpenPositions, maxTotalPrincipal, maxUserPrincipal } */
  stakingParams: "staking.params",
  /** Job queue summary written by the worker. */
  jobs: "worker.jobs",
  /** Claude usage this month { costUsd, runs }. */
  aiUsage: "ai.usage",
} as const;
