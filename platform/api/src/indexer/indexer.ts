// Chain indexer (DEV-PLAN 6.5). Polls `eth_getLogs` for CojamPredict and CojamStaking, and CT
// Transfer logs (kept only when a known player wallet is on either side), from the deploy block.
// Each block range is written to Postgres in one transaction together with the cursor, so a restart
// resumes exactly where it stopped and never applies a range twice. Ranges shrink when the node
// refuses a range (as server/src/keeper.js does) and grow back slowly. Kaia has immediate finality,
// so the default is no extra confirmations. `rebuild()` empties the index and starts over from the
// deploy block: everything here can be recomputed from logs.

import { decodeEventLog, type Abi, type Log, type PublicClient } from 'viem';
import { sql } from 'kysely';
import { cojamPredictAbi, cojamStakingAbi, erc20Abi, type Address } from '../worker/chain.ts';
import type { WDb } from '../worker/db.ts';
import type { Logger } from '../worker/log.ts';
import { applyLog, type ApplyContext, type DecodedLog } from './apply.ts';

export const CURSOR_NAME = 'indexer:main';

export interface IndexerOptions {
  predict: Address;
  staking: Address | null;
  ct: Address;
  deployBlock: number;
  range: number; // starting and largest block range
  minRange: number;
  confirmations: number;
}

export interface TickResult {
  from: number;
  to: number;
  logs: number;
  head: number;
}

const transferEvent = (erc20Abi as Abi).find((x) => x.type === 'event' && x.name === 'Transfer')!;

function isRangeRefusal(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e).toLowerCase();
  return /range|too many|limit|exceed|response size|query returned more|timeout|413/.test(m);
}

export class Indexer {
  private range: number;
  private blockTimes = new Map<number, number>();
  onOwnerActivity: (items: ApplyContext['ownerActivity']) => Promise<void> = async () => {};

  constructor(
    private db: WDb,
    private client: PublicClient,
    private opts: IndexerOptions,
    private log: Logger,
  ) {
    this.range = opts.range;
  }

  async cursor(): Promise<number> {
    const row = await this.db.selectFrom('chain_cursor').select('block').where('name', '=', CURSOR_NAME).executeTakeFirst();
    return row ? Number(row.block) : this.opts.deployBlock - 1;
  }

  /** Indexes one range. Returns null when already at the head. */
  async tick(): Promise<TickResult | null> {
    const head = Number(await this.client.getBlockNumber({ cacheTime: 0 })) - this.opts.confirmations;
    const last = await this.cursor();
    const from = last + 1;
    if (from > head) return null;
    for (;;) {
      const to = Math.min(head, from + this.range - 1);
      let raw: Log[];
      try {
        raw = await this.fetch(from, to);
      } catch (e) {
        if (isRangeRefusal(e) && this.range > this.opts.minRange) {
          this.range = Math.max(this.opts.minRange, Math.floor(this.range / 2));
          this.log.warn('indexer: range refused, shrinking', { range: this.range, error: (e as Error).message.slice(0, 160) });
          continue;
        }
        throw e;
      }
      const decoded = await this.decode(raw);
      await this.write(decoded, to);
      if (this.range < this.opts.range) this.range = Math.min(this.opts.range, this.range * 2);
      return { from, to, logs: decoded.length, head };
    }
  }

  /** Runs ranges until the head is reached (or `maxRanges`). */
  async catchUp(maxRanges = 1_000): Promise<number> {
    let n = 0;
    while (n < maxRanges) {
      const r = await this.tick();
      if (!r) break;
      n++;
      if (r.to >= r.head) break;
    }
    return n;
  }

  private async fetch(from: number, to: number): Promise<Log[]> {
    const addrs = [this.opts.predict, ...(this.opts.staking ? [this.opts.staking] : [])];
    const [main, ct] = await Promise.all([
      this.client.getLogs({ address: addrs, fromBlock: BigInt(from), toBlock: BigInt(to) }),
      this.client.getLogs({ address: this.opts.ct, event: transferEvent as never, fromBlock: BigInt(from), toBlock: BigInt(to) }),
    ]);
    return [...main, ...(ct as Log[])];
  }

  private async blockTime(n: number): Promise<number> {
    const hit = this.blockTimes.get(n);
    if (hit !== undefined) return hit;
    const b = await this.client.getBlock({ blockNumber: BigInt(n) });
    const t = Number(b.timestamp);
    if (this.blockTimes.size > 5_000) this.blockTimes.clear();
    this.blockTimes.set(n, t);
    return t;
  }

  private async decode(raw: Log[]): Promise<DecodedLog[]> {
    const predict = this.opts.predict.toLowerCase();
    const staking = this.opts.staking?.toLowerCase() ?? null;
    const out: DecodedLog[] = [];
    for (const l of raw) {
      const address = l.address.toLowerCase();
      const abi = (address === predict ? cojamPredictAbi : address === staking ? cojamStakingAbi : erc20Abi) as Abi;
      let ev: { eventName: string; args: unknown };
      try {
        ev = decodeEventLog({ abi, data: l.data, topics: l.topics }) as never;
      } catch {
        continue; // an event this ABI does not know (library noise): nothing to index
      }
      const blockNumber = Number(l.blockNumber);
      out.push({
        address,
        eventName: ev.eventName,
        args: (ev.args ?? {}) as Record<string, unknown>,
        blockNumber,
        logIndex: Number(l.logIndex),
        txHash: (l.transactionHash ?? '').toLowerCase(),
        blockTime: await this.blockTime(blockNumber),
      });
    }
    out.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    return out;
  }

  private async write(logs: DecodedLog[], to: number): Promise<void> {
    const predict = this.opts.predict.toLowerCase();
    const txEvents = new Map<string, Set<string>>();
    for (const l of logs) {
      const s = txEvents.get(l.txHash) ?? new Set<string>();
      s.add(l.eventName);
      txEvents.set(l.txHash, s);
    }
    // Reads the handlers need, done before the transaction opens.
    const settlesAt = new Map<number, number>();
    for (const l of logs) {
      if (l.address === predict && l.eventName === 'OutcomeSet') {
        const id = Number(l.args.marketId as bigint);
        const m = (await this.client.readContract({ address: this.opts.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(id)] })) as readonly unknown[];
        // markets(id) -> (closesAt, resolvesAt, resolvedAt, settlesAt, outcome, correctedOutcome, contentHash)
        settlesAt.set(id, Number(m[3] as bigint | number));
      }
    }
    const hasCt = logs.some((l) => l.address === this.opts.ct.toLowerCase());
    const knownWallets = new Set<string>();
    if (hasCt) {
      const rows = await this.db.selectFrom('users').select('wallet').where('wallet', 'is not', null).execute();
      for (const r of rows) knownWallets.add(r.wallet!.toLowerCase());
      // Wallets registered in this very range are known too.
      for (const l of logs) if (l.eventName === 'PlayerRegistered') knownWallets.add(String(l.args.wallet).toLowerCase());
    }
    const ctx: ApplyContext = {
      predict,
      staking: this.opts.staking?.toLowerCase() ?? null,
      ct: this.opts.ct.toLowerCase(),
      knownWallets,
      txEvents,
      settlesAt,
      ownerActivity: [],
    };
    await this.db.transaction().execute(async (tx) => {
      for (const l of logs) await applyLog(tx, l, ctx);
      await tx
        .insertInto('chain_cursor')
        .values({ name: CURSOR_NAME, block: to })
        .onConflict((oc) => oc.column('name').doUpdateSet({ block: to, updated_at: new Date() }))
        .execute();
    });
    if (ctx.ownerActivity.length) {
      // After the commit: a failing alert must not stall the index (the range is already written).
      await this.onOwnerActivity(ctx.ownerActivity).catch((e) => this.log.error('indexer: owner activity alert failed', { error: (e as Error).message }));
    }
  }

  /**
   * Empties every index table and resets the cursor to the deploy block. Off chain data (users,
   * markets text, drafts, AI runs, risk flags) is kept; chain mirrored columns on those rows are
   * reset and filled again by the replay.
   */
  async rebuild(): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await sql`TRUNCATE predictions, user_days, points_ledger, week_totals, conversions, stakes, wallet_transfers, play_keys, worker_compensations`.execute(tx);
      await tx.updateTable('referrals').set({ bound_tx: null, bound_at: null, welcome_tx: null, welcome_points: 0, bonus_points: 0, first_day_at: null }).execute();
      await tx.updateTable('airdrop_rows').set({ tx_hash: null }).execute();
      await tx.deleteFrom('chain_cursor').where('name', '=', CURSOR_NAME).execute();
    });
    this.range = this.opts.range;
    this.log.warn('indexer: index emptied, replaying from the deploy block', { deployBlock: this.opts.deployBlock });
  }
}
