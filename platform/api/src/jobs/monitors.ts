// Monitors (DEV-PLAN 6.6), every minute: refresh the snapshots the API reads from `app_state`
// (params, reserves, balances, indexer status, AI usage) and raise or resolve the standing alerts.
// Delivery (Telegram, email) is the alert sink's job (src/worker/alerts.ts).

import { sql } from 'kysely';
import { formatEther } from 'viem';
import { dayEnd, dayIdOf, dayOpensAt } from '../../../shared/src/time.ts';
import { setState, STATE_KEYS } from '../db/index.ts';
import { cojamPredictAbi, cojamStakingAbi, erc20Abi, readPredictParams } from '../worker/chain.ts';
import { CURSOR_NAME } from '../indexer/indexer.ts';
import type { JobContext } from './context.ts';

const json = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

export async function runMonitors(ctx: JobContext): Promise<void> {
  const { db, client, alerts } = ctx;
  const now = ctx.now();
  const today = dayIdOf(now);

  // Snapshots.
  const params = await readPredictParams(client, ctx.contracts.predict);
  const [pending, reserve] = await Promise.all([
    client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'pendingParams' }),
    client.readContract({ address: ctx.contracts.ct, abi: erc20Abi, functionName: 'balanceOf', args: [ctx.contracts.predict] }) as Promise<bigint>,
  ]);
  await setState(db as never, STATE_KEYS.predictParams, json({ ...params, pending }));
  const reserves: Record<string, string> = { reserve: reserve.toString() };
  if (ctx.contracts.staking) {
    const [avail, principal] = await Promise.all([
      client.readContract({ address: ctx.contracts.staking, abi: cojamStakingAbi, functionName: 'availableRewards' }) as Promise<bigint>,
      client.readContract({ address: ctx.contracts.staking, abi: cojamStakingAbi, functionName: 'totalPrincipal' }) as Promise<bigint>,
    ]);
    reserves.availableRewards = avail.toString();
    reserves.totalPrincipal = principal.toString();
    const st = ctx.contracts.staking;
    const read = (functionName: string, args: unknown[] = []) => client.readContract({ address: st, abi: cojamStakingAbi, functionName, args } as never) as Promise<unknown>;
    const [rates, t0, t1, minStake, minClaim, maxOpen, maxTotal, maxUser] = await Promise.all([
      read('rates'),
      read('tierThresholds', [0n]),
      read('tierThresholds', [1n]),
      read('minStake'),
      read('minClaim'),
      read('maxOpenPositions'),
      read('maxTotalPrincipal'),
      read('maxUserPrincipal'),
    ]);
    await setState(db as never, STATE_KEYS.stakingParams, json({
      rates: (rates as readonly (readonly (number | bigint)[])[]).map((r) => r.map(Number)),
      tiers: [t0, t1],
      minStake,
      minClaim,
      maxOpenPositions: maxOpen,
      maxTotalPrincipal: maxTotal,
      maxUserPrincipal: maxUser,
    }));
  }
  await setState(db as never, STATE_KEYS.reserves, reserves);
  const opBal = await client.getBalance({ address: ctx.sender.address });
  const feeBal = ctx.settings.feePayerAddress ? await client.getBalance({ address: ctx.settings.feePayerAddress }) : null;
  await setState(db as never, STATE_KEYS.balances, { operator: opBal.toString(), feePayer: feeBal?.toString() ?? null });

  const head = Number(await client.getBlockNumber());
  const cur = await db.selectFrom('chain_cursor').select(['block', 'updated_at']).where('name', '=', CURSOR_NAME).executeTakeFirst();
  const lag = cur ? head - Number(cur.block) : head;
  await setState(db as never, STATE_KEYS.indexer, { block: cur ? Number(cur.block) : null, head, lag, at: new Date().toISOString() });

  const monthStart = new Date(Date.UTC(new Date(now * 1000).getUTCFullYear(), new Date(now * 1000).getUTCMonth(), 1));
  const ai = await db.selectFrom('ai_runs').select([sql<string>`coalesce(sum(cost_usd), 0)::text`.as('cost'), sql<number>`count(*)::int`.as('runs')]).where('created_at', '>=', monthStart).executeTakeFirst();
  const aiCost = Number(ai?.cost ?? 0);
  await setState(db as never, STATE_KEYS.aiUsage, { costUsd: aiCost, runs: ai?.runs ?? 0, month: monthStart.toISOString().slice(0, 7) });

  // Standing conditions.
  const check = async (key: string, bad: boolean, severity: 'warn' | 'critical', title: string, body?: string) => {
    if (bad) await alerts.raise(key, severity, title, body);
    else await alerts.resolve(key);
  };
  await check('operator-balance', opBal < ctx.settings.minOperatorBalanceWei * 2n, opBal < ctx.settings.minOperatorBalanceWei ? 'critical' : 'warn', 'Operator balance low', `${formatEther(opBal)} KAIA (floor ${formatEther(ctx.settings.minOperatorBalanceWei)})`);
  if (feeBal !== null) await check('fee-payer-balance', feeBal < ctx.settings.minFeePayerBalanceWei * 2n, feeBal < ctx.settings.minFeePayerBalanceWei ? 'critical' : 'warn', 'Fee payer balance low', `${formatEther(feeBal)} KAIA`);
  await check('indexer-lag', lag > 30, lag > 300 ? 'critical' : 'warn', 'Indexer lag', `${lag} blocks behind the head`);

  // The next day must be on chain by 18:00 UTC.
  const hourUtc = new Date(now * 1000).getUTCHours();
  if (hourUtc >= ctx.settings.publishAlertHourUtc) {
    const m = (await client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt((today + 1) * 5)] })) as readonly unknown[];
    await check(`day-not-on-chain:${today + 1}`, Number(m[0]) === 0 && now < dayOpensAt(today + 1), 'critical', `Day ${today + 1} is not on chain yet`, 'createDay retries every 15 minutes; at 22:00 UTC the reserve fills missing slots.');
  }

  // Outcome missing 6 h after resolvesAt, again from day end + 36 h.
  const late = await db
    .selectFrom('markets')
    .select(['market_id', 'day_id', 'resolves_at'])
    .where('status', 'in', ['published', 'closed'])
    .where('outcome', 'is', null)
    .where('resolves_at', '<=', new Date((now - 6 * 3600) * 1000))
    .execute();
  for (const m of late) {
    const severe = now >= dayEnd(m.day_id) + 36 * 3600;
    await alerts.raise(`outcome-late:${m.market_id}${severe ? ':36h' : ''}`, severe ? 'critical' : 'warn', `Market ${m.market_id} has no answer ${severe ? '36 hours after the day end' : '6 hours after it was due'}`);
  }

  // Settle backlog: final for more than an hour with unsettled players.
  const backlog = await sql<{ market_id: number; n: number }>`
    SELECT m.market_id, count(*)::int AS n
    FROM markets m JOIN predictions p ON p.market_id = m.market_id
    LEFT JOIN user_days u ON u.wallet = p.wallet AND u.day_id = p.day_id
    WHERE m.outcome IS NOT NULL AND m.settles_at <= ${new Date((now - 3600) * 1000)}
      AND ((coalesce(u.settled_mask, 0) >> (p.market_id % 5)::int) & 1) = 0
    GROUP BY m.market_id`.execute(db);
  await check('settle-backlog', backlog.rows.length > 0, 'warn', 'Settle backlog', backlog.rows.map((r) => `market ${r.market_id}: ${r.n} players`).join(', '));

  // Void rate: more than 1 market in 7 days.
  const voids = await db.selectFrom('markets').select(sql<number>`count(*)::int`.as('n')).where('status', '=', 'voided').where('day_id', '>=', today - 7).executeTakeFirst();
  await check('void-rate', (voids?.n ?? 0) > 1, 'warn', 'More than 1 voided market in 7 days', `${voids?.n} voided`);

  // Images: tomorrow or the day after has a question without an image decision.
  const pendingImg = await db.selectFrom('markets').select(sql<number>`count(*)::int`.as('n')).where('day_id', 'in', [today + 1, today + 2]).where('image_state', '=', 'pending').where('status', 'in', ['scheduled', 'published']).executeTakeFirst();
  await check('images-pending', (pendingImg?.n ?? 0) > 0 && hourUtc >= 4, 'warn', 'Questions without an image or fallback', `${pendingImg?.n} question(s) for the next two days`);

  // Claude: errors in the last hour and the monthly budget.
  const errs = await db.selectFrom('ai_runs').select(sql<number>`count(*)::int`.as('n')).where('error', 'is not', null).where('created_at', '>=', new Date((now - 3600) * 1000)).executeTakeFirst();
  await check('ai-errors', (errs?.n ?? 0) >= 3, 'warn', 'Claude API errors or refusals', `${errs?.n} failed runs in the last hour`);
  await check('ai-budget', aiCost > ctx.settings.aiMonthlyBudgetUsd, 'warn', 'Claude spend above the monthly budget', `${aiCost.toFixed(2)} USD this month (budget ${ctx.settings.aiMonthlyBudgetUsd})`);

  // Reserve: under 14 days of conversions plus the next pool.
  const conv = await db.selectFrom('conversions').select(sql<string>`coalesce(sum(ct), 0)::text`.as('ct')).where('block_time', '>=', new Date((now - 7 * 86400) * 1000)).executeTakeFirst();
  const perDay = BigInt(conv?.ct ?? '0') / 7n;
  const need = perDay * 14n + BigInt(params.maxWeeklyPool) * 10n ** 18n;
  await check('reserve-runway', reserve < need, 'warn', 'Prediction reserve runway under 14 days', `reserve ${formatEther(reserve)} CT, needs ${formatEther(need)} CT (14 days of conversions plus a full pool)`);
}
