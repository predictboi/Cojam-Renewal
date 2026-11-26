// Scheduled AI work: drafting the coming days and preparing their images.
import { dayIdOf } from '../../../shared/src/time.ts';
import { daysNeedingQuestions, draftDay, type DraftOutcome } from '../ai/draft.ts';
import { prepareImages } from '../ai/images.ts';
import { readPredictParams } from '../worker/chain.ts';
import type { JobContext } from './context.ts';
import { aiDeps } from './markets.ts';

/** Drafts every day from D+1 to D+horizon that has fewer than 5 questions, then prepares images. */
export async function draftJob(ctx: JobContext): Promise<DraftOutcome[]> {
  if (!ctx.settings.aiEnabled) return [];
  const today = dayIdOf(ctx.now());
  const params = await readPredictParams(ctx.client, ctx.contracts.predict);
  const out: DraftOutcome[] = [];
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
