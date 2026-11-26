// Worker view of the database: the shared schema (src/db/types.ts) plus the worker's own tables and
// columns from src/db/migrations/0900_worker_tables.sql.
import type { ColumnType, Generated, Kysely } from 'kysely';
import type { Database, MarketsTable, UsersTable } from '../db/index.ts';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DefaultTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Wei = ColumnType<string, string | bigint | number, string | bigint | number>;
type Json<T = unknown> = ColumnType<T, T | string, T | string>;
type JsonDefault<T = unknown> = ColumnType<T, T | string | undefined, T | string>;

export type OperatorTxStatus = 'simulating' | 'sim_reverted' | 'signed' | 'sent' | 'mined' | 'reverted' | 'dropped' | 'failed';

export interface WorkerOperatorTxsTable {
  id: Generated<number>;
  job: string;
  target: string;
  method: string;
  args: Json;
  calldata: string;
  nonce: number | null;
  tx_type: string | null;
  gas_limit: Wei | null;
  gas_price: Wei | null;
  tx_hash: string | null;
  raw_tx: string | null;
  replaced_hashes: JsonDefault<string[]>;
  status: ColumnType<OperatorTxStatus, OperatorTxStatus | undefined, OperatorTxStatus>;
  error: string | null;
  error_name: string | null;
  gas_used: Wei | null;
  fee_wei: Wei | null;
  block: number | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export type AlertSeverity = 'info' | 'warn' | 'critical';

export interface WorkerAlertsTable {
  id: Generated<number>;
  key: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  details: Json | null;
  count: ColumnType<number, number | undefined, number>;
  created_at: DefaultTimestamp;
  last_seen_at: DefaultTimestamp;
  delivered_at: Timestamp | null;
  resolved_at: Timestamp | null;
}

export interface WorkerCompensationsTable {
  market_id: number;
  wallet: string;
  points: number;
  tx_hash: string;
  log_index: number;
}

export interface WorkerDatabase extends Omit<Database, 'markets' | 'users'> {
  markets: MarketsTable & { observes_at: Timestamp | null; kind: string | null };
  users: UsersTable & { email_shape_hash: string | null };
  worker_operator_txs: WorkerOperatorTxsTable;
  worker_alerts: WorkerAlertsTable;
  worker_compensations: WorkerCompensationsTable;
}

export type WDb = Kysely<WorkerDatabase>;
