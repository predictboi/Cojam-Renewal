// The device database (Dexie over IndexedDB): the outbox, the play key and small counters (DEV-PLAN 4.2, 4.3).
import Dexie, { type Table } from 'dexie';

export type OutboxState = 'held' | 'queued' | 'signing' | 'sent' | 'mined' | 'done_elsewhere' | 'failed';
export interface OutboxItem {
  id: string;                 // "predict:<marketId>": the idempotency key (4.5)
  kind: 'predict';
  marketId: string;
  dayId: number;
  slot: number;               // 0..4, for the day progress
  choice: 1 | 2;
  createdAt: number;
  sendAfter: number;          // createdAt + 3,000 ms (Undo window), or createdAt when the market closes within 15 s
  notAfter: number;           // market.closesAt: a pick that cannot reach the chain before close is dropped
  state: OutboxState;
  player: string;             // the player this pick belongs to (lower case)
  signer?: string;            // the play key address that signed raw
  nonce?: number;
  raw?: string;
  txHash?: string;
  sentAt?: number;
  resentAt?: number;
  attempts: number;
  nextTryAt?: number;
  firstFailAt?: number;
  lastError?: string;
}
export interface StoredPlayKey {
  id: 'playKey';
  address: string;
  player: string;
  createdAt: number;
  iv: Uint8Array;
  cipher: ArrayBuffer;
  wrap: CryptoKey;            // non extractable AES-GCM key (4.2)
  expiresAt?: number;         // unix seconds, once setPlayKey is mined
  authorisedTx?: string;
}
export interface Kv { k: string; v: unknown }

export class CojamDb extends Dexie {
  outbox!: Table<OutboxItem, string>;
  keys!: Table<StoredPlayKey, string>;
  kv!: Table<Kv, string>;
  constructor(name = 'cojam-app') {
    super(name);
    this.version(1).stores({ outbox: 'id, state, createdAt, dayId', keys: 'id', kv: 'k' });
  }
}
let _db: CojamDb | null = null;
export function db(): CojamDb { return (_db ||= new CojamDb()); }
export function setDb(d: CojamDb) { _db = d; }
