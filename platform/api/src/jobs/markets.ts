// Market operations on chain (DEV-PLAN 6.4 schedule, adapted to one common close per day):
//   publishDay       createDay(D+1) from the 5 scheduled markets (retries every 15 min from 12:00 UTC,
//                    reserve fill at 22:00 UTC, alert from 18:00 UTC)
//   resolutionSweep  every 5 min: markets past resolvesAt without an outcome -> AI runs -> setOutcome
//                    or voidMarket (retry hourly, void 40 h after the day's end)
//   correctionCheck  every 15 min: one re-check inside the settle window -> correctOutcome or alert
//   settleSweep      every 10 min: settleMany for every player with a ready, unsettled slot
//   expirySweep      every 10 min: voidExpired for anything past dayEnd + 48 h (should never happen)

import { sql } from 'kysely';
import { stringToHex, type Hex } from 'viem';
import { canCreateDay, dayEnd, dayOpensAt, LATE_CREATE_MARGIN_SECONDS, resolveDeadline } from '../../../shared/src/time.ts';
import { contentHash } from '../ai/contentHash.ts';
import { draftDay, fillFromReserve, type AiDeps } from '../ai/draft.ts';
import { prepareImage } from '../ai/images.ts';
import { recheckMarket, resolveMarket, RETRY_EVERY_SEC, type ResolveDeps } from '../ai/resolve.ts';
import { audit } from '../db/index.ts';
import { cojamPredictAbi, readPredictParams, type Address } from '../worker/chain.ts';
import { SimulationRevert } from '../worker/sender.ts';
import type { JobContext } from './context.ts';

/** createDay refuses a day with less than this left before its end (shared time rule). */
export const LATE_CREATE_MARGIN_SEC = LATE_CREATE_MARGIN_SECONDS;

const b32 = (s: string): Hex => stringToHex(s.slice(0, 31), { size: 32 });
const unix = (d: Date | string | null) => (d ? Math.floor(new Date(d).getTime() / 1000) : 0);

export function aiDeps(ctx: JobContext, minResolveGapSec: number): AiDeps {
  return { db: ctx.db, provider: ctx.ai, log: ctx.log, now: ctx.now, minResolveGapSec, candidates: ctx.settings.draftCandidates, longOnChain: ctx.settings.longQuestionsOnChain };
}

export function resolveDeps(ctx: JobContext): ResolveDeps {
  return { db: ctx.db, provider: ctx.ai, log: ctx.log, now: ctx.now, adapters: ctx.adapters };
}

async function chainMarket(ctx: JobContext, id: number) {
  const m = (await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(id)] })) as readonly unknown[];
  return { closesAt: Number(m[0]), resolvesAt: Number(m[1]), resolvedAt: Number(m[2]), settlesAt: Number(m[3]), outcome: Number(m[4]), correctedOutcome: Number(m[5]), contentHash: String(m[6]) };
}

// ---------------------------------------------------------------- publish

export type PublishResult = 'exists' | 'published' | 'incomplete' | 'too_late';

export async function publishDay(ctx: JobContext, dayId: number): Promise<PublishResult> {
  if ((await chainMarket(ctx, dayId * 5)).closesAt !== 0) return 'exists';
  const now = ctx.now();
  // createDay is accepted before the open, or late while at least 1 hour of the day remains
  // (contract change "late day creation"); a late day is playable from the block that creates it.
  if (!canCreateDay(dayId, now)) {
    await ctx.alerts.raise(`day-missed:${dayId}`, 'critical', `Day ${dayId} was never published`, 'createDay is refused in the last hour of the day: the day has no questions.');
    return 'too_late';
  }
  if (now >= dayOpensAt(dayId)) {
    await ctx.alerts.raise(`day-late:${dayId}`, 'critical', `Day ${dayId} opened without questions; publishing late`, 'Players who opened the app before the late creation saw no questions.');
  }
  const hourUtc = new Date(now * 1000).getUTCHours();
  const load = () => ctx.db.selectFrom('markets').selectAll().where('day_id', '=', dayId).where('status', '=', 'scheduled').orderBy('slot').execute();
  let rows = await load();
  const late = now >= dayOpensAt(dayId);
  if (rows.length < 5 && (late || hourUtc >= ctx.settings.publishReserveHourUtc)) {
    const params = await readPredictParams(ctx.client, ctx.contracts.predict);
    await fillFromReserve(aiDeps(ctx, params.minResolveGap), dayId);
    if (ctx.settings.aiEnabled && (await load()).length < 5) await draftDay(aiDeps(ctx, params.minResolveGap), dayId).catch(() => undefined);
    rows = await load();
  }
  if (rows.length < 5 || rows.map((r) => r.slot).join() !== '0,1,2,3,4') {
    await ctx.alerts.raise(`day-incomplete:${dayId}`, late || hourUtc >= ctx.settings.publishAlertHourUtc ? 'critical' : 'warn', `Day ${dayId} has ${rows.length} of 5 questions`, 'The day cannot be published until all 5 slots are scheduled.');
    return 'incomplete';
  }
  // Every published question has an image decision: generate (or fall back) for any still pending.
  for (const r of rows.filter((x) => x.image_state === 'pending')) {
    await prepareImage({ db: ctx.db, provider: ctx.ai, generator: ctx.images.generator, store: ctx.images.store, log: ctx.log }, r.market_id).catch((e) =>
      ctx.log.warn('publish: image preparation failed', { marketId: r.market_id, error: (e as Error).message }),
    );
  }
  const closesAt = dayEnd(dayId);
  const inputs = [];
  for (const r of rows) {
    const sources = (r.sources as { name: string; url: string }[]).map(({ name, url }) => ({ name, url }));
    const hash = contentHash({ ...r.content, closesAt, resolvesAt: unix(r.resolves_at), sources });
    if (hash !== r.content_hash) {
      // The text was edited before publish (admin veto): the hash follows the stored text.
      await ctx.db.updateTable('markets').set({ content_hash: hash, updated_at: new Date() }).where('market_id', '=', r.market_id).execute();
    }
    inputs.push({ closesAt: BigInt(closesAt), resolvesAt: BigInt(unix(r.resolves_at)), contentHash: hash });
  }
  const res = await ctx.sender.send({ job: 'publish', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'createDay', args: [dayId, inputs] });
  await ctx.db.updateTable('markets').set({ status: 'published', create_tx: res.hash, updated_at: new Date() }).where('day_id', '=', dayId).where('status', '=', 'scheduled').execute();
  await audit(ctx.db as never, { actor: 'worker', action: 'day.publish', target: String(dayId), payload: { markets: rows.map((r) => r.market_id) }, txHash: res.hash });
  await ctx.alerts.resolve(`day-incomplete:${dayId}`);
  ctx.log.info('publish: day created on chain', { dayId, tx: res.hash });
  return 'published';
}

// ---------------------------------------------------------------- resolution

export interface SweepResult {
  checked: number;
  set: number;
  voided: number;
  waiting: number;
}

async function sendOutcome(ctx: JobContext, id: number, outcome: 1 | 2 | 3, actor: string): Promise<string> {
  const res = await ctx.sender.send({ job: 'resolution', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'setOutcome', args: [BigInt(id), outcome] });
  await ctx.db.updateTable('markets').set({ outcome, status: outcome === 3 ? 'voided' : 'resolved', outcome_tx: res.hash, updated_at: new Date() }).where('market_id', '=', id).execute();
  await audit(ctx.db as never, { actor, action: 'market.set_outcome', target: String(id), payload: { outcome }, txHash: res.hash });
  return res.hash;
}

export async function voidOnChain(ctx: JobContext, id: number, reason: string, actor: string): Promise<string> {
  const res = await ctx.sender.send({ job: 'resolution', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'voidMarket', args: [BigInt(id), b32(reason)] });
  await ctx.db.updateTable('markets').set({ outcome: 3, status: 'voided', outcome_tx: res.hash, updated_at: new Date() }).where('market_id', '=', id).execute();
  await audit(ctx.db as never, { actor, action: 'market.void', target: String(id), payload: { reason }, txHash: res.hash });
  return res.hash;
}

export async function resolutionSweep(ctx: JobContext): Promise<SweepResult> {
  const out: SweepResult = { checked: 0, set: 0, voided: 0, waiting: 0 };
  const now = ctx.now();
  const rows = await ctx.db
    .selectFrom('markets')
    .select(['market_id', 'day_id', 'resolves_at'])
    .where('status', 'in', ['published', 'closed'])
    .where('outcome', 'is', null)
    .where('resolves_at', '<=', new Date(now * 1000))
    .orderBy('resolves_at')
    .execute();
  for (const m of rows) {
    if (now >= resolveDeadline(m.day_id)) continue; // expiry sweep's job
    const onChain = await chainMarket(ctx, m.market_id);
    if (onChain.outcome !== 0) continue; // set already; the indexer will mirror it
    const last = await ctx.db.selectFrom('resolutions').select(sql<Date>`max(created_at)`.as('at')).where('market_id', '=', m.market_id).where('run', 'in', ['1', '2']).executeTakeFirst();
    if (last?.at && now - unix(last.at) < RETRY_EVERY_SEC) continue;
    if (!ctx.settings.aiEnabled) continue;
    out.checked++;
    const d = await resolveMarket(resolveDeps(ctx), m.market_id);
    try {
      if (d.action === 'set') {
        await sendOutcome(ctx, m.market_id, d.outcome, 'answer-setter');
        out.set++;
        await ctx.alerts.resolve(`outcome-missing:${m.market_id}`);
      } else if (d.action === 'void') {
        await voidOnChain(ctx, m.market_id, d.reason, 'answer-setter');
        out.voided++;
        await ctx.alerts.raise(`market-voided:${m.market_id}`, 'warn', `Market ${m.market_id} voided (${d.reason})`, 'No hit points on this market; completion points are unaffected.');
      } else {
        out.waiting++;
        if (now >= dayEnd(m.day_id) + 24 * 3600) await ctx.alerts.raise(`outcome-missing:${m.market_id}`, 'warn', `Market ${m.market_id} still without an answer`, d.reason);
      }
    } catch (e) {
      ctx.log.warn('resolution: send failed', { marketId: m.market_id, error: (e as Error).message });
    }
  }
  return out;
}

export async function correctionCheck(ctx: JobContext): Promise<{ checked: number; corrected: number; alerts: number }> {
  const out = { checked: 0, corrected: 0, alerts: 0 };
  if (!ctx.settings.aiEnabled) return out;
  const now = ctx.now();
  const rows = await ctx.db
    .selectFrom('markets')
    .select(['market_id', 'outcome', 'resolved_at', 'settles_at'])
    .where('status', '=', 'resolved')
    .where('outcome', 'in', [1, 2])
    .where('settles_at', '>', new Date(now * 1000))
    .execute();
  for (const m of rows) {
    // One re-check per answer: a run 3 newer (by id) than the runs that set the answer.
    const ids = await ctx.db
      .selectFrom('resolutions')
      .select([sql<number>`max(id) filter (where run in ('1', '2'))`.as('first'), sql<number>`max(id) filter (where run = '3')`.as('recheck')])
      .where('market_id', '=', m.market_id)
      .executeTakeFirst();
    if (ids?.recheck && (!ids.first || Number(ids.recheck) > Number(ids.first))) continue;
    out.checked++;
    const d = await recheckMarket(resolveDeps(ctx), m.market_id, m.outcome as 1 | 2);
    if (d.action === 'correct') {
      try {
        const res = await ctx.sender.send({ job: 'correction', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'correctOutcome', args: [BigInt(m.market_id), d.outcome] });
        await ctx.db.updateTable('markets').set({ outcome: d.outcome, outcome_tx: res.hash, updated_at: new Date() }).where('market_id', '=', m.market_id).execute();
        await audit(ctx.db as never, { actor: 'answer-setter', action: 'market.correct_outcome', target: String(m.market_id), payload: { from: m.outcome, to: d.outcome }, txHash: res.hash });
        await ctx.alerts.raise(`corrected:${m.market_id}`, 'warn', `Market ${m.market_id} corrected inside the window`, `Answer changed from ${m.outcome} to ${d.outcome} before any hit was paid.`);
        out.corrected++;
      } catch (e) {
        ctx.log.warn('correction: send failed', { marketId: m.market_id, error: (e as Error).message });
      }
    } else if (d.action === 'alert') {
      await ctx.alerts.raise(`recheck-disagrees:${m.market_id}`, 'warn', `Re-check disagrees on market ${m.market_id}`, `${d.reason}. The answer stands; review in AD4 before ${new Date(unix(m.settles_at)).toISOString()}.`);
      out.alerts++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- settle and expiry

export async function settleSweep(ctx: JobContext): Promise<{ batches: number; users: number }> {
  const out = { batches: 0, users: 0 };
  const now = new Date(ctx.now() * 1000);
  const rows = await sql<{ wallet: string; day_id: number }>`
    SELECT DISTINCT p.wallet, p.day_id
    FROM predictions p
    JOIN markets m ON m.market_id = p.market_id
    LEFT JOIN user_days u ON u.wallet = p.wallet AND u.day_id = p.day_id
    WHERE m.outcome IS NOT NULL AND m.settles_at IS NOT NULL AND m.settles_at <= ${now}
      AND ((coalesce(u.settled_mask, 0) >> (p.market_id % 5)::int) & 1) = 0
    ORDER BY p.day_id, p.wallet`.execute(ctx.db);
  const byDay = new Map<number, string[]>();
  for (const r of rows.rows) byDay.set(Number(r.day_id), [...(byDay.get(Number(r.day_id)) ?? []), r.wallet]);
  for (const [dayId, wallets] of byDay) {
    for (let i = 0; i < wallets.length; i += ctx.settings.settleBatch) {
      const batch = wallets.slice(i, i + ctx.settings.settleBatch) as Address[];
      try {
        await ctx.sender.send({ job: 'settle', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'settleMany', args: [batch, dayId] });
        out.batches++;
        out.users += batch.length;
      } catch (e) {
        if (e instanceof SimulationRevert && e.errorName === 'NotReadyToSettle') continue; // index behind the chain; next round
        ctx.log.warn('settle: batch failed', { dayId, error: (e as Error).message });
      }
    }
  }
  return out;
}

export async function expirySweep(ctx: JobContext): Promise<number> {
  const now = ctx.now();
  const rows = await ctx.db.selectFrom('markets').select(['market_id', 'day_id']).where('status', 'in', ['published', 'closed']).where('outcome', 'is', null).execute();
  let n = 0;
  for (const m of rows) {
    if (now < resolveDeadline(m.day_id)) continue;
    if ((await chainMarket(ctx, m.market_id)).outcome !== 0) continue;
    await ctx.alerts.raise(`expired:${m.market_id}`, 'critical', `Market ${m.market_id} passed the 48 hour deadline without an answer`, 'voidExpired is being sent.');
    try {
      await ctx.sender.send({ job: 'expiry', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'voidExpired', args: [BigInt(m.market_id)] });
      n++;
    } catch (e) {
      ctx.log.warn('expiry: voidExpired failed', { marketId: m.market_id, error: (e as Error).message });
    }
  }
  return n;
}
