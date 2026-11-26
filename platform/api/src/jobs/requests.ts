// Admin initiated work (`operator_requests`, written by the admin API in src/routes/admin.ts, consumed
// here every 10 s). The market or week id is the row's `target`; `payload` carries the rest.
//   question_replace    target marketId, {dayId, slot, reason, cancelled?}  cancel a scheduled question
//                       (the API may already have) and fill its slot from the reserve, else a new draft
//   void_market         target marketId, {reason}            voidMarket (unresolved or inside the window)
//   image_regenerate    target marketId                      generate the image again (category illustration today)
//   image_upload_check  target marketId, {imageKey|imageUrl} check an uploaded image and switch to it
//   resolve_rerun       target marketId                      re-run the resolution; acts like the sweeps would
//   correct_outcome     target marketId, {outcome 1|2|3}     inside the window: correctOutcome
//   compensate          target marketId, {outcome, awaitingOwnerTx?}  compensation batches once the owner's
//                       setCorrectedOutcome is on chain (the request waits up to 7 days for it)
//   airdrop             target weekId, {force?}              run or retry the week's airdrop
//   image_fallback      target marketId                      switch to the category illustration
//   risk_signup         {wallets}                            sign up risk check on accounts and their cluster
//   run_job             target or {job}: a name from CRON_JOBS   run a scheduled job now
// Block, unblock and clear are `freezes` rows (src/risk/check.ts sends them).

import { checkUploadedImage, fallbackUrl, prepareImage } from '../ai/images.ts';
import { decide, decideCorrection, loadPromptMarket, runResolution, type CorrectionDecision } from '../ai/resolve.ts';
import { draftDay, fillFromReserve } from '../ai/draft.ts';
import { audit } from '../db/index.ts';
import { cojamPredictAbi, readPredictParams } from '../worker/chain.ts';
import { riskCheck } from '../risk/check.ts';
import { compensationSweep, ownerCorrectionTx } from './compensation.ts';
import type { JobContext } from './context.ts';
import { aiDeps, resolveDeps, voidOnChain } from './markets.ts';
import { runAirdrop } from './weekly.ts';

type Payload = Record<string, unknown>;

/** Thrown by a handler that must run again later (the request goes back to `queued`). */
export class RetryLater extends Error {}

const WAIT_FOR_OWNER_SEC = 7 * 86400;

async function marketOnChain(ctx: JobContext, id: number) {
  const m = (await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(id)] })) as readonly unknown[];
  return { settlesAt: Number(m[3]), outcome: Number(m[4]), corrected: Number(m[5]) };
}

function idOf(p: Payload, target: string | null, key: 'marketId' | 'weekId'): number {
  const v = p[key] ?? target;
  const n = Number(v);
  if (v === null || v === undefined || !Number.isInteger(n)) throw new Error(`request needs a ${key} (target or payload)`);
  return n;
}

export interface RequestRow {
  kind: string;
  target: string | null;
  payload: Payload;
  requestedBy: string;
  createdAt: Date;
}

export async function handleRequest(ctx: JobContext, r: RequestRow): Promise<{ result: unknown; txHash?: string }> {
  const p = r.payload;
  switch (r.kind) {
    case 'resolve_rerun': {
      const id = idOf(p, r.target, 'marketId');
      const pm = await loadPromptMarket(ctx.db, id);
      const chain = await marketOnChain(ctx, id);
      const deps = resolveDeps(ctx);
      if (chain.outcome === 0) {
        const d = decide([await runResolution(deps, pm, 1), await runResolution(deps, pm, 2)], undefined, ctx.now(), pm.dayId);
        if (d.action === 'set') {
          const res = await ctx.sender.send({ job: 'resolution', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'setOutcome', args: [BigInt(id), d.outcome] });
          return { result: d, txHash: res.hash };
        }
        if (d.action === 'void') return { result: d, txHash: await voidOnChain(ctx, id, d.reason, r.requestedBy) };
        return { result: d };
      }
      const runs = [await runResolution(deps, pm, 3), await runResolution(deps, pm, 3)];
      const d: CorrectionDecision = chain.outcome === 3 ? { action: 'alert', reason: 'market is void' } : decideCorrection(chain.outcome as 1 | 2, runs, undefined);
      if (d.action === 'correct' && ctx.now() < chain.settlesAt) {
        const res = await ctx.sender.send({ job: 'correction', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'correctOutcome', args: [BigInt(id), d.outcome] });
        return { result: d, txHash: res.hash };
      }
      return { result: { ...d, windowOver: ctx.now() >= chain.settlesAt } };
    }
    case 'correct_outcome': {
      const id = idOf(p, r.target, 'marketId');
      const outcome = Number(p.outcome);
      if (![1, 2, 3].includes(outcome)) throw new Error('outcome must be 1, 2 or 3');
      const chain = await marketOnChain(ctx, id);
      if (chain.outcome === 0) throw new Error('market has no answer yet');
      if (ctx.now() < chain.settlesAt) {
        if (chain.outcome === outcome) return { result: { unchanged: true } };
        const res = await ctx.sender.send({ job: 'correction', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'correctOutcome', args: [BigInt(id), outcome] });
        return { result: { corrected: true, insideWindow: true }, txHash: res.hash };
      }
      if (outcome === 3) throw new Error('the window is over: a void can no longer be recorded');
      // After the window only the owner records the true answer; the API queues a `compensate` request with it.
      return { result: { insideWindow: false, ownerTx: ownerCorrectionTx(ctx.contracts.predict, id, outcome as 1 | 2) } };
    }
    case 'compensate': {
      const id = idOf(p, r.target, 'marketId');
      const chain = await marketOnChain(ctx, id);
      if (chain.corrected === 0) {
        if (ctx.now() - Math.floor(r.createdAt.getTime() / 1000) > WAIT_FOR_OWNER_SEC) throw new Error('setCorrectedOutcome was not signed by the owner within 7 days');
        throw new RetryLater('waiting for the owner to sign setCorrectedOutcome');
      }
      // The index must have the correction before the eligible list can be built.
      const row = await ctx.db.selectFrom('markets').select('corrected_outcome').where('market_id', '=', id).executeTakeFirst();
      if (!row?.corrected_outcome) throw new RetryLater('waiting for the indexer to see CorrectedOutcomeSet');
      return { result: await compensationSweep(ctx, id) };
    }
    case 'void_market': {
      const id = idOf(p, r.target, 'marketId');
      return { result: { voided: true }, txHash: await voidOnChain(ctx, id, String(p.reason ?? 'admin'), r.requestedBy) };
    }
    case 'airdrop':
      return { result: { status: await runAirdrop(ctx, idOf(p, r.target, 'weekId'), { force: Boolean(p.force) }) } };
    case 'image_regenerate': {
      const id = idOf(p, r.target, 'marketId');
      await ctx.db.updateTable('markets').set({ image_state: 'pending' }).where('market_id', '=', id).execute();
      return { result: { image: await prepareImage({ db: ctx.db, provider: ctx.ai, generator: ctx.images.generator, store: ctx.images.store, log: ctx.log }, id) } };
    }
    case 'image_upload_check': {
      const id = idOf(p, r.target, 'marketId');
      const check = await checkUploadedImage({ db: ctx.db, provider: ctx.ai, log: ctx.log, aiEnabled: ctx.settings.aiEnabled }, id, {
        imageKey: (p.imageKey as string | undefined) ?? null,
        imageUrl: (p.imageUrl as string | undefined) ?? null,
        baseUrl: ctx.settings.imageBaseUrl,
      });
      return { result: check };
    }
    case 'image_fallback': {
      const id = idOf(p, r.target, 'marketId');
      const m = await ctx.db.selectFrom('markets').select(['category']).where('market_id', '=', id).executeTakeFirstOrThrow();
      await ctx.db.updateTable('markets').set({ image_state: 'fallback', image_key: null, image_url: fallbackUrl(m.category, id), image_sha256: null }).where('market_id', '=', id).execute();
      return { result: { image: 'fallback' } };
    }
    case 'question_replace': {
      const id = idOf(p, r.target, 'marketId');
      const m = await ctx.db.selectFrom('markets').select(['day_id', 'status']).where('market_id', '=', id).executeTakeFirstOrThrow();
      if (m.status !== 'scheduled' && m.status !== 'cancelled') throw new Error(`cannot replace a ${m.status} question (published questions are on chain)`);
      await ctx.db.updateTable('markets').set({ status: 'cancelled', updated_at: new Date() }).where('market_id', '=', id).execute();
      const params = await readPredictParams(ctx.client, ctx.contracts.predict);
      let filled = await fillFromReserve(aiDeps(ctx, params.minResolveGap), m.day_id);
      if (filled.length === 0 && ctx.settings.aiEnabled) filled = (await draftDay(aiDeps(ctx, params.minResolveGap), m.day_id)).scheduled;
      if (filled.length) await prepareImageQuiet(ctx, filled);
      return { result: { replacedBy: filled } };
    }
    case 'run_job': {
      // Admin "run now" for a scheduled job (also used by the end to end test instead of waiting for cron).
      const { CRON_JOBS } = await import('./schedule.ts');
      const job = CRON_JOBS.find((j) => j.name === String(p.job ?? r.target));
      if (!job) throw new Error(`unknown job ${String(p.job ?? r.target)}`);
      const out = await job.run(ctx);
      return { result: JSON.parse(JSON.stringify(out ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))) };
    }
    case 'risk_signup':
      return { result: await riskCheck(ctx, { run: 'signup', wallets: (p.wallets as string[]) ?? [String(p.wallet)] }) };
    default:
      throw new Error(`unknown request kind ${r.kind}`);
  }
}

async function prepareImageQuiet(ctx: JobContext, ids: number[]) {
  for (const id of ids) await prepareImage({ db: ctx.db, provider: ctx.ai, generator: ctx.images.generator, store: ctx.images.store, log: ctx.log }, id).catch(() => undefined);
}

/** Request kinds the worker consumes (the admin API writes these). */
export const REQUEST_KINDS = ['question_replace', 'void_market', 'image_regenerate', 'image_upload_check', 'resolve_rerun', 'correct_outcome', 'compensate', 'airdrop', 'image_fallback', 'risk_signup', 'run_job'] as const;

export async function processOperatorRequests(ctx: JobContext, limit = 10): Promise<number> {
  let n = 0;
  const seen = new Set<number>();
  for (let i = 0; i < limit; i++) {
    // Oldest touched first, so a request that waits (RetryLater) does not hold up the others.
    const req = await ctx.db
      .updateTable('operator_requests')
      .set({ status: 'running', updated_at: new Date() })
      .where('id', '=', (eb) =>
        eb
          .selectFrom('operator_requests')
          .select('id')
          .where('status', '=', 'queued')
          .where('id', 'not in', seen.size ? [...seen] : [-1])
          .orderBy('updated_at')
          .orderBy('id')
          .limit(1),
      )
      .returningAll()
      .executeTakeFirst();
    if (!req) break;
    seen.add(req.id);
    n++;
    try {
      const { result, txHash } = await handleRequest(ctx, { kind: req.kind, target: req.target, payload: (req.payload ?? {}) as Payload, requestedBy: req.requested_by, createdAt: new Date(req.created_at) });
      await ctx.db.updateTable('operator_requests').set({ status: 'done', result: JSON.stringify(result ?? null), tx_hash: txHash ?? null, updated_at: new Date() }).where('id', '=', req.id).execute();
      await audit(ctx.db as never, { actor: req.requested_by, action: `request.${req.kind}`, target: req.target, payload: { payload: req.payload, result }, txHash: txHash ?? null });
    } catch (e) {
      if (e instanceof RetryLater) {
        await ctx.db.updateTable('operator_requests').set({ status: 'queued', result: JSON.stringify({ waiting: e.message }), updated_at: new Date() }).where('id', '=', req.id).execute();
        continue;
      }
      await ctx.db.updateTable('operator_requests').set({ status: 'failed', result: JSON.stringify({ error: (e as Error).message.slice(0, 500) }), updated_at: new Date() }).where('id', '=', req.id).execute();
      ctx.log.warn('requests: failed', { id: req.id, kind: req.kind, error: (e as Error).message });
    }
  }
  return n;
}
