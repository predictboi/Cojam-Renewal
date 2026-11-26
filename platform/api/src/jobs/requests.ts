// Admin initiated work (`operator_requests`, written by the admin API, consumed here every 10 s).
//   resolve_rerun     {marketId}            re-run the resolution; acts like the sweeps would
//   correct_outcome   {marketId, outcome}   inside the window: correctOutcome; after it: returns the
//                                           unsigned setCorrectedOutcome for the owner wallet, then
//                                           compensation runs by itself once it is mined
//   void_market       {marketId, reason}    voidMarket (unresolved or inside the window)
//   compensate        {marketId}            run compensation batches now
//   airdrop           {weekId, force?}      run or retry the week's airdrop
//   image_regenerate  {marketId}            generate the image again (category illustration today)
//   image_fallback    {marketId}            switch to the category illustration
//   question_replace  {marketId}            cancel a scheduled question and fill its slot from the reserve
//   risk_signup       {wallets}             sign up risk check on accounts and their cluster
// Block, unblock and clear are `freezes` rows (API writes them, src/risk/check.ts sends them).

import { prepareImage } from '../ai/images.ts';
import { decide, decideCorrection, loadPromptMarket, runResolution, type CorrectionDecision } from '../ai/resolve.ts';
import { audit } from '../db/index.ts';
import { cojamPredictAbi, readPredictParams } from '../worker/chain.ts';
import { riskCheck } from '../risk/check.ts';
import { compensationSweep, ownerCorrectionTx } from './compensation.ts';
import type { JobContext } from './context.ts';
import { aiDeps, resolveDeps, voidOnChain } from './markets.ts';
import { fillFromReserve, draftDay } from '../ai/draft.ts';
import { fallbackKey } from '../ai/images.ts';
import { runAirdrop } from './weekly.ts';

type Payload = Record<string, unknown>;

async function marketOnChain(ctx: JobContext, id: number) {
  const m = (await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(id)] })) as readonly unknown[];
  return { settlesAt: Number(m[3]), outcome: Number(m[4]), corrected: Number(m[5]) };
}

export async function handleRequest(ctx: JobContext, kind: string, p: Payload, actor: string): Promise<{ result: unknown; txHash?: string }> {
  const id = Number(p.marketId);
  switch (kind) {
    case 'resolve_rerun': {
      const pm = await loadPromptMarket(ctx.db, id);
      const chain = await marketOnChain(ctx, id);
      const deps = resolveDeps(ctx);
      if (chain.outcome === 0) {
        const d = decide([await runResolution(deps, pm, 1), await runResolution(deps, pm, 2)], undefined, ctx.now(), pm.dayId);
        if (d.action === 'set') {
          const res = await ctx.sender.send({ job: 'resolution', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'setOutcome', args: [BigInt(id), d.outcome] });
          return { result: d, txHash: res.hash };
        }
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
      const outcome = Number(p.outcome) as 1 | 2;
      if (outcome !== 1 && outcome !== 2) throw new Error('outcome must be 1 or 2');
      const chain = await marketOnChain(ctx, id);
      if (chain.outcome === 0) throw new Error('market has no answer yet');
      if (ctx.now() < chain.settlesAt) {
        if (chain.outcome === outcome) return { result: { unchanged: true } };
        const res = await ctx.sender.send({ job: 'correction', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'correctOutcome', args: [BigInt(id), outcome] });
        return { result: { corrected: true, insideWindow: true }, txHash: res.hash };
      }
      // After the window only the owner can record the true answer; compensation follows on its own.
      return { result: { insideWindow: false, ownerTx: ownerCorrectionTx(ctx.contracts.predict, id, outcome), next: 'sign with the master wallet; compensation batches run once CorrectedOutcomeSet is indexed' } };
    }
    case 'void_market': {
      const hash = await voidOnChain(ctx, id, String(p.reason ?? 'admin'), actor);
      return { result: { voided: true }, txHash: hash };
    }
    case 'compensate':
      return { result: await compensationSweep(ctx, id) };
    case 'airdrop':
      return { result: { status: await runAirdrop(ctx, Number(p.weekId), { force: Boolean(p.force) }) } };
    case 'image_regenerate': {
      await ctx.db.updateTable('markets').set({ image_state: 'pending' }).where('market_id', '=', id).execute();
      const r = await prepareImage({ db: ctx.db, provider: ctx.ai, generator: ctx.images.generator, store: ctx.images.store, log: ctx.log }, id);
      return { result: { image: r } };
    }
    case 'image_fallback': {
      const m = await ctx.db.selectFrom('markets').select(['category']).where('market_id', '=', id).executeTakeFirstOrThrow();
      await ctx.db.updateTable('markets').set({ image_state: 'fallback', image_key: fallbackKey(m.category, id), image_url: null, image_sha256: null }).where('market_id', '=', id).execute();
      return { result: { image: 'fallback' } };
    }
    case 'question_replace': {
      const m = await ctx.db.selectFrom('markets').select(['day_id', 'status']).where('market_id', '=', id).executeTakeFirstOrThrow();
      if (m.status !== 'scheduled' && m.status !== 'cancelled') throw new Error(`cannot replace a ${m.status} question (published questions are on chain)`);
      await ctx.db.updateTable('markets').set({ status: 'cancelled', updated_at: new Date() }).where('market_id', '=', id).execute();
      const params = await readPredictParams(ctx.client, ctx.contracts.predict);
      let filled = await fillFromReserve(aiDeps(ctx, params.minResolveGap), m.day_id);
      if (filled.length === 0 && ctx.settings.aiEnabled) filled = (await draftDay(aiDeps(ctx, params.minResolveGap), m.day_id)).scheduled;
      return { result: { replacedBy: filled } };
    }
    case 'risk_signup':
      return { result: await riskCheck(ctx, { run: 'signup', wallets: (p.wallets as string[]) ?? [String(p.wallet)] }) };
    default:
      throw new Error(`unknown request kind ${kind}`);
  }
}

export async function processOperatorRequests(ctx: JobContext, limit = 10): Promise<number> {
  let n = 0;
  for (let i = 0; i < limit; i++) {
    // Claim one request (single worker, but the claim keeps a crashed run from being repeated blindly).
    const req = await ctx.db
      .updateTable('operator_requests')
      .set({ status: 'running', updated_at: new Date() })
      .where('id', '=', (eb) => eb.selectFrom('operator_requests').select('id').where('status', '=', 'queued').orderBy('id').limit(1))
      .returningAll()
      .executeTakeFirst();
    if (!req) break;
    n++;
    try {
      const { result, txHash } = await handleRequest(ctx, req.kind, (req.payload ?? {}) as Payload, req.requested_by);
      await ctx.db.updateTable('operator_requests').set({ status: 'done', result: JSON.stringify(result ?? null), tx_hash: txHash ?? null, updated_at: new Date() }).where('id', '=', req.id).execute();
      await audit(ctx.db as never, { actor: req.requested_by, action: `request.${req.kind}`, target: req.target, payload: { payload: req.payload, result }, txHash: txHash ?? null });
    } catch (e) {
      await ctx.db.updateTable('operator_requests').set({ status: 'failed', result: JSON.stringify({ error: (e as Error).message.slice(0, 500) }), updated_at: new Date() }).where('id', '=', req.id).execute();
      ctx.log.warn('requests: failed', { id: req.id, kind: req.kind, error: (e as Error).message });
    }
  }
  return n;
}
