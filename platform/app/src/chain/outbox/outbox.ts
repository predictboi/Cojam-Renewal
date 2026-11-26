// The outbox (DEV-PLAN 4.3): every swipe is written to IndexedDB before anything else, held for the Undo window,
// then signed by the play key and sent to the fee payer by one sender loop, in commit order, one nonce after another.
// All I/O comes in through OutboxDeps, so the same code runs against the chain, the mock adapter and the unit tests.
import type { CojamDb, OutboxItem } from '../db';
import {
  backoffMs, classify, nextNonce, sendAfterFor, RESEND_AFTER_MS, RESIGN_AFTER_MS, SPONSOR_DOWN_RETRY_MS, UNCERTAIN_WAIT_MS,
} from './policy';

export interface SponsorErrorLike { code: string; status?: number; txHash?: string; retryable?: boolean }
export interface OutboxDeps {
  db: CojamDb;
  now(): number;
  /** The play key that signs now, or null when there is none or it is expired, revoked or replaced (4.2). */
  key(): Promise<{ address: string } | null>;
  pendingNonce(address: string): Promise<number>;
  sign(item: OutboxItem, nonce: number, keyAddress: string): Promise<string>;
  sponsor(raw: string): Promise<{ txHash: string }>;
  receipt(hash: string): Promise<{ status: number } | null>;
  /** The choice stored on chain for this pick's player and market (0 none). */
  readChoice(item: OutboxItem): Promise<0 | 1 | 2>;
  /** Resend an identical raw transaction (same hash, so it cannot double). */
  resend?(raw: string): Promise<void>;
  onKeyProblem?(code: string): void;
  onFrozen?(): void;
  onFailed?(item: OutboxItem, closed: boolean): void;
  rand?(): number;
}

export interface CommitInput { marketId: string; dayId: number; slot: number; choice: 1 | 2; closesAt: number; player: string }
export type StepResult = 'idle' | 'held' | 'backoff' | 'sent' | 'paused' | 'waiting' | 'dropped' | 'frozen' | 'failed' | 'done';

const OPEN = ['held', 'queued', 'signing'] as const;
const nonceKey = (addr: string) => 'nonce:' + addr.toLowerCase();

export class Outbox {
  private listeners = new Set<() => void>();
  private paused = false;
  constructor(private d: OutboxDeps) {}

  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((f) => f()); }
  get isPaused() { return this.paused; }
  resume() { this.paused = false; this.emit(); }

  all() { return this.d.db.outbox.orderBy('createdAt').toArray(); }
  forDay(dayId: number) { return this.d.db.outbox.where('dayId').equals(dayId).sortBy('createdAt'); }

  /** A swipe. The item id is the idempotency key: a second swipe on the same market creates nothing (4.5). */
  async commit(p: CommitInput): Promise<OutboxItem | null> {
    const now = this.d.now();
    const id = 'predict:' + p.marketId;
    const { sendAfter, held } = sendAfterFor(now, p.closesAt);
    const item: OutboxItem = {
      id, kind: 'predict', marketId: p.marketId, dayId: p.dayId, slot: p.slot, choice: p.choice, createdAt: now, sendAfter,
      notAfter: p.closesAt, state: held ? 'held' : 'queued', player: p.player.toLowerCase(), attempts: 0,
    };
    const ok = await this.d.db.transaction('rw', this.d.db.outbox, async () => {
      const cur = await this.d.db.outbox.get(id);
      if (cur && cur.state !== 'failed') return false;
      await this.d.db.outbox.put(item);
      return true;
    });
    this.emit();
    return ok ? item : null;
  }

  /** Undo: delete the most recent held item, conditional on it still being held (races the hold timer, 4.3.1). */
  async undo(): Promise<OutboxItem | null> {
    const out = await this.d.db.transaction('rw', this.d.db.outbox, async () => {
      const held = (await this.d.db.outbox.where('state').equals('held').toArray()).sort((a, b) => b.createdAt - a.createdAt);
      const top = held[0];
      if (!top) return null;
      await this.d.db.outbox.delete(top.id);
      return top;
    });
    this.emit();
    return out;
  }

  /** held -> queued once the Undo window is over. */
  async promoteDue(): Promise<number> {
    const now = this.d.now();
    const n = await this.d.db.transaction('rw', this.d.db.outbox, async () => {
      const due = await this.d.db.outbox.where('state').equals('held').filter((i) => i.sendAfter <= now).toArray();
      for (const i of due) await this.d.db.outbox.update(i.id, { state: 'queued' });
      return due.length;
    });
    if (n) this.emit();
    return n;
  }

  /** All held items become queued at once: Finish now, leaving Home, pagehide, log out (4.3.1). */
  async flush(): Promise<number> {
    const n = await this.d.db.transaction('rw', this.d.db.outbox, async () => {
      const held = await this.d.db.outbox.where('state').equals('held').toArray();
      for (const i of held) await this.d.db.outbox.update(i.id, { state: 'queued', sendAfter: Math.min(i.sendAfter, this.d.now()) });
      return held.length;
    });
    if (n) this.emit();
    return n;
  }

  /** App start: a held item survived a kill (the player did not undo it) and a signing item was interrupted. */
  async startup(): Promise<void> {
    await this.d.db.transaction('rw', this.d.db.outbox, async () => {
      const open = await this.d.db.outbox.where('state').anyOf('held', 'signing').toArray();
      for (const i of open) await this.d.db.outbox.update(i.id, { state: 'queued' });
    });
    this.emit();
  }

  /** Drop every unsent pick (frozen account, log out of another player). */
  async dropOpen(): Promise<void> {
    await this.d.db.outbox.where('state').anyOf([...OPEN]).delete();
    this.emit();
  }

  private async lastUsed(addr: string): Promise<number | undefined> {
    const r = await this.d.db.kv.get(nonceKey(addr));
    return r ? (r.v as number) : undefined;
  }
  private async setLastUsed(addr: string, n: number) { await this.d.db.kv.put({ k: nonceKey(addr), v: n }); }

  private async update(id: string, patch: Partial<OutboxItem>) { await this.d.db.outbox.update(id, patch); this.emit(); }

  private async fail(item: OutboxItem, err: string, closed: boolean) {
    await this.update(item.id, { state: 'failed', lastError: err, raw: undefined });
    this.d.onFailed?.({ ...item, state: 'failed', lastError: err }, closed);
    return 'failed' as const;
  }

  /**
   * One pass of the sender loop: take the oldest open item. A held item is never overtaken by a newer queued one,
   * so commit order is kept (4.3 step 1).
   */
  async step(): Promise<StepResult> {
    if (this.paused) return 'paused';
    await this.promoteDue();
    const now = this.d.now();
    // an uncertain broadcast pauses the loop until it is resolved by poll()
    const uncertain = await this.d.db.outbox.where('state').equals('sent').filter((i) => i.lastError === 'BROADCAST_UNCERTAIN').count();
    if (uncertain) return 'waiting';
    const open = (await this.d.db.outbox.where('state').anyOf('held', 'queued').toArray()).sort((a, b) => a.createdAt - b.createdAt);
    const item = open[0];
    if (!item) return 'idle';
    if (item.state === 'held') return 'held';
    if (now >= item.notAfter) return this.fail(item, 'MARKET_CLOSED', true);
    if (item.nextTryAt && item.nextTryAt > now) return 'backoff';

    // before a retry, read the chain: a pick already stored counts as confirmed (4.7)
    if (item.attempts > 0) {
      const onChain = await this.d.readChoice(item).catch(() => 0 as const);
      if (onChain === item.choice) { await this.update(item.id, { state: 'done_elsewhere' }); return 'done'; }
    }

    const key = await this.d.key();
    if (!key) { this.paused = true; this.d.onKeyProblem?.('NO_KEY'); this.emit(); return 'paused'; }

    let raw = item.raw, nonce = item.nonce;
    if (!raw || !item.signer || item.signer.toLowerCase() !== key.address.toLowerCase() || nonce === undefined) {
      // a raw signed by a replaced key is discarded and the item signed again by the new key (4.3 signer)
      const forced = item.signer && item.signer.toLowerCase() === key.address.toLowerCase() && item.lastError === 'RESIGN' ? item.nonce : undefined;
      nonce = forced ?? nextNonce(await this.d.pendingNonce(key.address), await this.lastUsed(key.address));
      await this.update(item.id, { state: 'signing' });
      try {
        raw = await this.d.sign(item, nonce, key.address);
      } catch (e) {
        await this.update(item.id, { state: 'queued', attempts: item.attempts + 1, firstFailAt: item.firstFailAt ?? now, nextTryAt: now + backoffMs(item.attempts + 1, this.d.rand), lastError: 'SIGN:' + (e as Error).message });
        return 'backoff';
      }
      await this.update(item.id, { state: 'queued', raw, nonce, signer: key.address });
    }

    try {
      const { txHash } = await this.d.sponsor(raw!);
      await this.setLastUsed(key.address, nonce!);
      await this.update(item.id, { state: 'sent', txHash, sentAt: this.d.now(), lastError: undefined, nextTryAt: undefined });
      return 'sent';
    } catch (e) {
      const err = e as SponsorErrorLike;
      const v = classify(err.code || 'NETWORK', err.status, err.retryable);
      const attempts = item.attempts + 1;
      switch (v) {
        case 'done_elsewhere':
          await this.update(item.id, { state: 'done_elsewhere', raw: undefined });
          return 'done';
        case 'pause_key':
          // nonce not used; the new key signs from its own nonce (4.4)
          await this.update(item.id, { raw: undefined, signer: undefined, nonce: undefined, lastError: err.code });
          this.paused = true;
          this.d.onKeyProblem?.(err.code);
          this.emit();
          return 'paused';
        case 'uncertain':
          await this.setLastUsed(key.address, nonce!);
          await this.update(item.id, { state: 'sent', txHash: err.txHash, sentAt: this.d.now(), lastError: 'BROADCAST_UNCERTAIN' });
          return 'waiting';
        case 'frozen':
          await this.dropOpen();
          this.paused = true;
          this.d.onFrozen?.();
          return 'frozen';
        case 'sponsor_down':
          await this.update(item.id, { attempts, firstFailAt: item.firstFailAt ?? now, nextTryAt: now + SPONSOR_DOWN_RETRY_MS, lastError: err.code });
          return 'backoff';
        case 'retry':
          // the server refused before broadcast: the nonce is not used, the next try reuses it (4.4)
          await this.update(item.id, { attempts, firstFailAt: item.firstFailAt ?? now, nextTryAt: now + backoffMs(attempts, this.d.rand), lastError: err.code });
          return 'backoff';
        default:
          return this.fail({ ...item, attempts }, err.code, false);
      }
    }
  }

  /** Receipts for sent items (4.4): mined, reverted, dropped from the pool, uncertain broadcasts. */
  async poll(): Promise<void> {
    const sent = await this.d.db.outbox.where('state').equals('sent').toArray();
    const now = this.d.now();
    for (const it of sent) {
      if (!it.txHash) { await this.update(it.id, { state: 'queued', raw: undefined, lastError: 'NO_HASH' }); continue; }
      const r = await this.d.receipt(it.txHash).catch(() => null);
      if (r && r.status === 1) { await this.update(it.id, { state: 'mined', raw: undefined, lastError: undefined }); continue; }
      if (r && r.status === 0) {
        // mined but reverted: the nonce is used. Read the chain to decide (4.4)
        const c = await this.d.readChoice(it).catch(() => 0 as const);
        if (c === it.choice) await this.update(it.id, { state: 'mined', raw: undefined });
        else if (now >= it.notAfter) await this.fail(it, 'MARKET_CLOSED', true);
        else await this.update(it.id, { state: 'queued', raw: undefined, nonce: undefined, signer: undefined, attempts: it.attempts + 1, lastError: 'REVERTED' });
        continue;
      }
      const age = now - (it.sentAt || now);
      if (it.lastError === 'BROADCAST_UNCERTAIN') {
        const moved = it.signer ? (await this.d.pendingNonce(it.signer).catch(() => -1)) > (it.nonce ?? Infinity) : false;
        if (moved) { await this.update(it.id, { lastError: undefined }); continue; }
        if (age >= UNCERTAIN_WAIT_MS && it.raw && this.d.resend) { await this.d.resend(it.raw).catch(() => {}); await this.update(it.id, { lastError: undefined, resentAt: now }); }
        continue;
      }
      if (age >= RESIGN_AFTER_MS) {
        // still missing at 90 s: re-sign the same payload with the same nonce
        await this.update(it.id, { state: 'queued', raw: undefined, lastError: 'RESIGN' });
      } else if (age >= RESEND_AFTER_MS && !it.resentAt && it.raw && this.d.resend) {
        const passed = it.signer ? (await this.d.pendingNonce(it.signer).catch(() => -1)) > (it.nonce ?? Infinity) : false;
        if (!passed) { await this.d.resend(it.raw).catch(() => {}); await this.update(it.id, { resentAt: now }); }
      }
    }
  }

  /** When the loop should look again: the next held window, back off or receipt poll. */
  async nextWakeIn(): Promise<number> {
    const now = this.d.now();
    const items = await this.d.db.outbox.where('state').anyOf('held', 'queued', 'sent').toArray();
    let ms = 30_000;
    for (const i of items) {
      if (i.state === 'held') ms = Math.min(ms, i.sendAfter - now);
      else if (i.state === 'queued') ms = Math.min(ms, (i.nextTryAt || now) - now);
      else ms = Math.min(ms, 600);
    }
    return Math.max(20, ms);
  }
}
