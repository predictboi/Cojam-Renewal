// Outside price read (DECISIONS "Data room: outside comparison"): once our day has closed, read the price of the
// linked Polymarket outcome that matches our right choice, once, and store it as a whole percent with the time.
// A failure (network, closed or unknown market, missing outcome) leaves the price empty with the reason in `error`
// and never blocks anything else. Runs every 5 minutes from the worker (job "outside-prices").
import type { Kysely } from 'kysely';
import type { Database } from '../db/index.ts';
import { priceOf, type OutsideMarkets } from '../dataRoom/polymarket.ts';

/** The read happens within this many seconds after our close; later it is skipped (a late price is not comparable). */
export const OUTSIDE_READ_WINDOW_SEC = 2 * 3600;

export interface OutsideJobDeps {
  db: Kysely<Database>;
  source: OutsideMarkets;
  /** unix seconds */
  now: () => number;
  log: { info(msg: string, data?: Record<string, unknown>): void; warn(msg: string, data?: Record<string, unknown>): void };
}

export async function outsidePriceSweep(d: OutsideJobDeps): Promise<{ read: number; failed: number; missed: number }> {
  const now = d.now();
  const nowDate = new Date(now * 1000);
  const due = await d.db
    .selectFrom('market_outside as o')
    .innerJoin('markets as m', 'm.market_id', 'o.market_id')
    .select(['o.market_id', 'o.market_slug', 'o.right_outcome', 'm.closes_at'])
    .where('o.attempted_at', 'is', null)
    .where('m.closes_at', '<=', nowDate)
    .execute();
  let read = 0;
  let failed = 0;
  let missed = 0;
  for (const row of due) {
    const closedAt = Math.floor(row.closes_at.getTime() / 1000);
    if (now - closedAt > OUTSIDE_READ_WINDOW_SEC) {
      await d.db.updateTable('market_outside').set({ attempted_at: nowDate, error: 'missed the read window after the close', updated_at: nowDate }).where('market_id', '=', row.market_id).execute();
      missed++;
      continue;
    }
    // Claim the row first so a second worker run never reads it twice.
    const claimed = await d.db.updateTable('market_outside').set({ attempted_at: nowDate, updated_at: nowDate }).where('market_id', '=', row.market_id).where('attempted_at', 'is', null).executeTakeFirst();
    if (Number(claimed.numUpdatedRows) === 0) continue;
    try {
      const m = await d.source.market(row.market_slug);
      if (m.closed) throw new Error('the outside market is already closed');
      const p = priceOf(m, row.right_outcome);
      await d.db
        .updateTable('market_outside')
        .set({ right_price: Math.round(p * 100), taken_at: nowDate, error: null, updated_at: nowDate })
        .where('market_id', '=', row.market_id)
        .execute();
      read++;
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 300) || 'read failed';
      await d.db.updateTable('market_outside').set({ error: msg, updated_at: nowDate }).where('market_id', '=', row.market_id).execute();
      d.log.warn('outside price read failed', { marketId: row.market_id, slug: row.market_slug, error: msg });
      failed++;
    }
  }
  if (read + failed + missed) d.log.info('outside prices', { read, failed, missed });
  return { read, failed, missed };
}
