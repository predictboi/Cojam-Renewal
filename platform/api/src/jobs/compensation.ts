// Compensation (DEV-PLAN 6.4 "Compensation tool", DECISIONS: wrong answers are compensated, never
// clawed back). Once the owner has recorded the true answer on chain (`setCorrectedOutcome`, signed
// by the master wallet in the admin), every player whose on chain pick equals it and whose slot was
// settled gets `hitPoints` through `compensate` batches with the operator key. The contract checks
// every condition itself and skips anyone who does not qualify, so a stale index can only waste gas,
// never mint wrongly. Compensation counts in the question's week while that week's airdrop is not
// sent, else in the current week (contract rule).

import { encodeFunctionData, type Hex } from 'viem';
import { sql } from 'kysely';
import { cojamPredictAbi, type Address } from '../worker/chain.ts';
import { SimulationRevert } from '../worker/sender.ts';
import type { JobContext } from './context.ts';

/** Players owed compensation on a corrected market, from the index. */
export async function eligibleForCompensation(ctx: JobContext, marketId: number, corrected: number): Promise<string[]> {
  const rows = await sql<{ wallet: string }>`
    SELECT p.wallet
    FROM predictions p
    JOIN user_days u ON u.wallet = p.wallet AND u.day_id = p.day_id
    LEFT JOIN worker_compensations c ON c.market_id = p.market_id AND c.wallet = p.wallet
    WHERE p.market_id = ${marketId} AND p.choice = ${corrected}
      AND ((u.settled_mask >> (p.market_id % 5)::int) & 1) = 1
      AND c.wallet IS NULL
    ORDER BY p.wallet`.execute(ctx.db);
  return rows.rows.map((r) => r.wallet);
}

export async function compensationSweep(ctx: JobContext, onlyMarket?: number): Promise<{ markets: number; users: number }> {
  const out = { markets: 0, users: 0 };
  let q = ctx.db.selectFrom('markets').select(['market_id', 'corrected_outcome']).where('corrected_outcome', 'is not', null);
  if (onlyMarket !== undefined) q = q.where('market_id', '=', onlyMarket);
  const markets = await q.execute();
  for (const m of markets) {
    const users = await eligibleForCompensation(ctx, m.market_id, m.corrected_outcome!);
    if (users.length === 0) continue;
    out.markets++;
    for (let i = 0; i < users.length; i += ctx.settings.compensateBatch) {
      const batch = users.slice(i, i + ctx.settings.compensateBatch) as Address[];
      try {
        await ctx.sender.send({ job: 'compensation', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'compensate', args: [BigInt(m.market_id), batch] });
        out.users += batch.length;
      } catch (e) {
        if (e instanceof SimulationRevert && e.errorName === 'NothingToCompensate') continue; // index behind; next round
        ctx.log.warn('compensation: batch failed', { marketId: m.market_id, error: (e as Error).message });
      }
    }
  }
  return out;
}

/** The unsigned owner transaction the admin hands to the master wallet (`setCorrectedOutcome`). */
export function ownerCorrectionTx(predict: Address, marketId: number, outcome: 1 | 2): { to: Address; data: Hex; value: '0' } {
  return { to: predict, data: encodeFunctionData({ abi: cojamPredictAbi, functionName: 'setCorrectedOutcome', args: [BigInt(marketId), outcome] }), value: '0' };
}
