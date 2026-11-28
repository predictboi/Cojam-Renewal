// Scheduled AI work: drafting the coming days and preparing their images.
import { dayIdOf } from '../../../shared/src/time.ts';
import { daysNeedingQuestions, draftDay, matchOutsideDay, type DraftOutcome } from '../ai/draft.ts';
import { prepareImages } from '../ai/images.ts';
import { readPredictParams } from '../worker/chain.ts';
import type { JobContext } from './context.ts';
import { aiDeps } from './markets.ts';

/**
 * UTC hours in which the drafting run matches the next day's set with Polymarket: the 18:00 KST run (09:00 UTC) and
 * until the publish job starts putting that set on chain at 12:00 UTC. Short dated outside markets appear only a day
 * or two ahead, so days further out keep our own questions until their own run.
 */
export const MATCH_HOURS_UTC = { from: 9, to: 12 } as const;

/** Drafts every day from D+1 to D+horizon that has fewer than 5 questions, then prepares images. */
export async function draftJob(ctx: JobContext): Promise<DraftOutcome[]> {
  if (!ctx.settings.aiEnabled) return [];
  const today = dayIdOf(ctx.now());
  const params = await readPredictParams(ctx.client, ctx.contracts.predict);
  const out: DraftOutcome[] = [];
  const hourUtc = new Date(ctx.now() * 1000).getUTCHours();
  if (ctx.outside && hourUtc >= MATCH_HOURS_UTC.from && hourUtc < MATCH_HOURS_UTC.to) {
    // Never blocks drafting: a failure leaves the set to our own questions.
    const m = await matchOutsideDay({ ...aiDeps(ctx, params.minResolveGap), outside: ctx.outside }, today + 1).catch((e) => {
      ctx.log.warn('match: failed', { dayId: today + 1, error: (e as Error).message });
      return null;
    });
    if (m?.skipped) ctx.log.info('match: skipped', { dayId: today + 1, reason: m.skipped });
  }
  for (const d of await daysNeedingQuestions(ctx.db, today, ctx.settings.draftHorizonDays)) {
    const r = await draftDay(aiDeps(ctx, params.minResolveGap), d);
    out.push(r);
    if (r.missingSlots.length) await ctx.alerts.raise(`draft-short:${d}`, d === today + 1 ? 'critical' : 'warn', `Day ${d} has ${5 - r.missingSlots.length} of 5 questions after drafting`, `${r.drafted} drafted, ${r.accepted} accepted`);
    else await ctx.alerts.resolve(`draft-short:${d}`);
  }
  await imagesJob(ctx);
  return out;
}

export async function imagesJob(ctx: JobContext) {
  return prepareImages({ db: ctx.db, provider: ctx.ai, generator: ctx.images.generator, store: ctx.images.store, log: ctx.log });
}
