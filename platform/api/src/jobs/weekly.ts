// Week close and the weekly airdrop (DEV-PLAN 3.4 and 6.4, DECISIONS "Ranking ties",
// "On hold: ranking"). Monday 00:05 UTC the week is closed in the index (K1 shows "Week closed").
// From weekEnd + airdropDelay (Wednesday 12:00 UTC = 21:00 KST by default) the airdrop first settles every
// market of the week that is ready (settleMany, anyone may call it), then runs once the week's backlog is empty.
// The backlog counts only markets answered before the due time: a long question still open does not hold the
// airdrop back, and its hits, settled later by the regular settle job, count in the current week (contract week
// rule for late hits, DECISIONS "Longer questions mixed in"). The pool is qualified players x 1 CT capped at 10,000 CT (and the
// on chain maxWeeklyPool), the winners are built from the index with the contract's tie break,
// re-read from the chain before sending, accounts on hold are skipped and the ranks below move up.

import { sql } from 'kysely';
import { weekEnd, weekFirstDay } from '../../../shared/src/time.ts';
import { audit } from '../db/index.ts';
import { cojamPredictAbi, erc20Abi, readPredictParams, type Address } from '../worker/chain.ts';
import type { JobContext } from './context.ts';
import { settleSweep } from './markets.ts';
import { readPlayer } from './registration.ts';
import { assertContractOrder, buildWinners, computePool, type QualifyInput, type WeekScoreRow } from './winners.ts';

export async function closeWeek(ctx: JobContext, weekId: number): Promise<void> {
  await ctx.db
    .insertInto('weeks')
    .values({ week_id: weekId, status: 'closed', closed_at: new Date() })
    .onConflict((oc) => oc.column('week_id').doUpdateSet({ status: sql`case when weeks.status = 'open' then 'closed' else weeks.status end`, closed_at: sql`coalesce(weeks.closed_at, now())`, updated_at: new Date() }))
    .execute();
}

/**
 * What the week's airdrop waits for: markets of the week due (resolvesAt) before `dueAt` that have no outcome yet,
 * and picks on such markets that have an outcome but are not settled (still inside the settle window, or a settle
 * that failed). Markets due at or after `dueAt` (long questions) are left out: their hits land in a later week.
 */
export async function weekBacklog(ctx: JobContext, weekId: number, dueAt: number): Promise<{ unresolved: number; unsettled: number }> {
  const first = weekFirstDay(weekId);
  const last = first + 6;
  const due = new Date(dueAt * 1000);
  const unresolved = await ctx.db
    .selectFrom('markets')
    .select(sql<number>`count(*)::int`.as('n'))
    .where('day_id', '>=', first)
    .where('day_id', '<=', last)
    .where('status', 'in', ['published', 'closed'])
    .where('outcome', 'is', null)
    .where('resolves_at', '<', due)
    .executeTakeFirst();
  const unsettled = await sql<{ n: number }>`
    SELECT count(*)::int AS n
    FROM predictions p
    JOIN markets m ON m.market_id = p.market_id
    LEFT JOIN user_days u ON u.wallet = p.wallet AND u.day_id = p.day_id
    WHERE p.day_id BETWEEN ${first} AND ${last}
      AND m.outcome IS NOT NULL
      AND m.resolves_at < ${due}
      AND ((coalesce(u.settled_mask, 0) >> (p.market_id % 5)::int) & 1) = 0`.execute(ctx.db);
  return { unresolved: unresolved?.n ?? 0, unsettled: unsettled.rows[0]?.n ?? 0 };
}

export async function qualifyInputs(ctx: JobContext, weekId: number): Promise<QualifyInput[]> {
  const first = weekFirstDay(weekId);
  const rows = await sql<{ wallet: string; registered_at: Date | null; frozen: boolean; registration: string; days: number }>`
    SELECT u.wallet, u.registered_at, u.frozen, u.registration,
           (SELECT count(*)::int FROM user_days d WHERE d.wallet = u.wallet AND d.day_id BETWEEN ${first} AND ${first + 6} AND d.completed) AS days
    FROM users u
    WHERE u.wallet IS NOT NULL AND u.registration = 'registered'`.execute(ctx.db);
  return rows.rows.map((r) => ({
    wallet: r.wallet,
    registered: r.registration === 'registered',
    frozen: r.frozen,
    registeredAt: r.registered_at ? Math.floor(new Date(r.registered_at).getTime() / 1000) : Number.MAX_SAFE_INTEGER,
    daysPlayed: r.days,
  }));
}

export type AirdropStatus = 'done' | 'not_due' | 'backlog' | 'no_winners' | 'sent';

/** Top candidates from the index, re-read from the chain (weekPoints and players) before ranking. */
export async function verifiedScores(ctx: JobContext, weekId: number, take = 60): Promise<WeekScoreRow[]> {
  const top = await ctx.db
    .selectFrom('week_totals')
    .select(['wallet'])
    .where('week_id', '=', weekId)
    .where('points', '>', 0)
    .orderBy('points', 'desc')
    .orderBy(sql`last_completion_at asc nulls last`)
    .orderBy('wallet')
    .limit(take)
    .execute();
  const out: WeekScoreRow[] = [];
  for (const t of top) {
    const s = (await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'weekPoints', args: [weekId, t.wallet as Address] })) as readonly unknown[];
    const p = await readPlayer(ctx, t.wallet);
    out.push({ wallet: t.wallet, points: BigInt(s[0] as bigint), lastCompletionAt: Number(s[1] as bigint), registered: p.registered, frozen: p.frozen });
  }
  return out;
}

export async function runAirdrop(ctx: JobContext, weekId: number, opts: { force?: boolean } = {}): Promise<AirdropStatus> {
  const done = await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'airdropDone', args: [weekId] });
  if (done) {
    await ctx.db.updateTable('weeks').set({ status: 'airdropped', updated_at: new Date() }).where('week_id', '=', weekId).where('status', '!=', 'airdropped').execute();
    return 'done';
  }
  const params = await readPredictParams(ctx.client, ctx.contracts.predict);
  const due = weekEnd(weekId) + params.airdropDelay;
  const now = ctx.now();
  if (now < due) return 'not_due';
  // Settle the week's ready markets first, so no ready hit of the week is left to land in a later week.
  const first = weekFirstDay(weekId);
  await settleSweep(ctx, { from: first, to: first + 6 }).catch((e) => ctx.log.warn('airdrop: settle before the airdrop failed', { weekId, error: (e as Error).message }));
  const backlog = await weekBacklog(ctx, weekId, due);
  if ((backlog.unresolved > 0 || backlog.unsettled > 0) && !opts.force) {
    if (now > due + 6 * 3600) await ctx.alerts.raise(`airdrop-backlog:${weekId}`, 'warn', `Week ${weekId} airdrop waits for the settle backlog`, `${backlog.unresolved} unresolved markets, ${backlog.unsettled} unsettled picks`);
    return 'backlog';
  }

  const q = computePool(await qualifyInputs(ctx, weekId), weekEnd(weekId), {
    perPlayerCt: ctx.settings.poolPerPlayerWei,
    serverCapCt: ctx.settings.poolCapWei,
    chainMaxWeeklyPoolWholeCt: BigInt(params.maxWeeklyPool),
    minDaysPlayed: ctx.settings.poolMinDaysPlayed,
    minAccountAgeSec: ctx.settings.poolMinAccountAgeSec,
  });
  const scores = await verifiedScores(ctx, weekId);
  const { winners, skipped, total } = buildWinners(scores, q.pool, params.splitBps);

  await ctx.db.transaction().execute(async (tx) => {
    await tx.deleteFrom('airdrop_rows').where('week_id', '=', weekId).where('tx_hash', 'is', null).execute();
    for (const w of winners) {
      await tx
        .insertInto('airdrop_rows')
        .values({ week_id: weekId, rank: w.rank, wallet: w.wallet.toLowerCase(), points: Number(w.points), amount: w.amount.toString() })
        .onConflict((oc) => oc.columns(['week_id', 'rank']).doUpdateSet({ wallet: w.wallet.toLowerCase(), points: Number(w.points), amount: w.amount.toString(), skipped_reason: null }))
        .execute();
    }
    // Skipped accounts are kept for AD5 with rank 100 + n (outside the paid ranks 1..10).
    for (let i = 0; i < skipped.length; i++) {
      const s = skipped[i];
      await tx
        .insertInto('airdrop_rows')
        .values({ week_id: weekId, rank: 100 + i, wallet: s.wallet.toLowerCase(), points: Number(s.points), amount: '0', skipped_reason: `${s.reason}: would have been rank ${s.wouldBeRank}` })
        .onConflict((oc) => oc.columns(['week_id', 'rank']).doNothing())
        .execute();
    }
    await tx
      .insertInto('weeks')
      .values({ week_id: weekId, status: 'airdrop_pending', qualified_players: q.qualified, pool: q.pool.toString() })
      .onConflict((oc) => oc.column('week_id').doUpdateSet({ status: 'airdrop_pending', qualified_players: q.qualified, pool: q.pool.toString(), updated_at: new Date() }))
      .execute();
  });

  if (winners.length === 0) {
    ctx.log.info('airdrop: no eligible winner, nothing sent', { weekId });
    return 'no_winners';
  }
  assertContractOrder(winners);
  const reserve = (await ctx.client.readContract({ address: ctx.contracts.ct, abi: erc20Abi, functionName: 'balanceOf', args: [ctx.contracts.predict] })) as bigint;
  if (reserve < total) {
    await ctx.alerts.raise(`airdrop-reserve:${weekId}`, 'critical', `Week ${weekId} airdrop needs ${total} CT wei, reserve holds ${reserve}`, 'Fund the prediction contract from the master wallet.');
    return 'backlog';
  }
  try {
    const res = await ctx.sender.send({ job: 'airdrop', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'airdrop', args: [weekId, winners.map((w) => w.wallet as Address), q.pool] });
    await ctx.db.updateTable('weeks').set({ status: 'airdropped', airdrop_tx: res.hash, updated_at: new Date() }).where('week_id', '=', weekId).execute();
    await ctx.db.updateTable('airdrop_rows').set({ tx_hash: res.hash }).where('week_id', '=', weekId).where('rank', '<=', 10).execute();
    await audit(ctx.db as never, { actor: 'airdrop-sender', action: 'week.airdrop', target: String(weekId), payload: { pool: q.pool.toString(), qualified: q.qualified, winners: winners.map((w) => w.wallet), skipped: skipped.map((s) => s.wallet) }, txHash: res.hash });
    await ctx.alerts.raise(`airdrop-sent:${weekId}`, 'info', `Week ${weekId} airdrop sent`, `${winners.length} payouts, pool ${q.pool} wei (${q.qualified} qualified players)${skipped.length ? `, ${skipped.length} account(s) on hold skipped` : ''}`);
    return 'sent';
  } catch (e) {
    await ctx.db.updateTable('weeks').set({ status: 'failed', updated_at: new Date() }).where('week_id', '=', weekId).execute();
    await ctx.alerts.raise(`airdrop-failed:${weekId}`, 'critical', `Week ${weekId} airdrop failed`, (e as Error).message.slice(0, 500));
    throw e;
  }
}

/**
 * The week's running pool for K1 and AD5 (`weeks.pool`, `weeks.qualified_players`): qualified players x
 * 1 CT, capped at the server cap and the on chain maxWeeklyPool. Refreshed every 5 minutes for the
 * current and the last week until the airdrop freezes it.
 */
export async function refreshWeekPool(ctx: JobContext, weekId: number): Promise<{ qualified: number; pool: bigint } | null> {
  const row = await ctx.db.selectFrom('weeks').select('status').where('week_id', '=', weekId).executeTakeFirst();
  if (row && (row.status === 'airdropped' || row.status === 'airdrop_pending')) return null;
  const params = await readPredictParams(ctx.client, ctx.contracts.predict);
  const q = computePool(await qualifyInputs(ctx, weekId), weekEnd(weekId), {
    perPlayerCt: ctx.settings.poolPerPlayerWei,
    serverCapCt: ctx.settings.poolCapWei,
    chainMaxWeeklyPoolWholeCt: BigInt(params.maxWeeklyPool),
    minDaysPlayed: ctx.settings.poolMinDaysPlayed,
    minAccountAgeSec: ctx.settings.poolMinAccountAgeSec,
  });
  await ctx.db
    .insertInto('weeks')
    .values({ week_id: weekId, status: ctx.now() >= weekEnd(weekId) ? 'closed' : 'open', qualified_players: q.qualified, pool: q.pool.toString() })
    .onConflict((oc) => oc.column('week_id').doUpdateSet({ qualified_players: q.qualified, pool: q.pool.toString(), updated_at: new Date() }))
    .execute();
  return { qualified: q.qualified, pool: q.pool };
}
