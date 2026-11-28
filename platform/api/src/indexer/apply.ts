// Applies decoded contract events to the index tables (DEV-PLAN 6.5 and 7). Every handler is
// idempotent on (tx_hash, log_index) or on natural keys, so replaying a range after a crash between
// the writes and the cursor update (impossible inside one transaction, but cheap to guarantee) or a
// full rebuild from the deploy block gives the same rows.

import { sql, type Transaction } from 'kysely';
import { hexToString, type Hex } from 'viem';
import { dayIdOf, weekOf } from '../../../shared/src/time.ts';
import type { WorkerDatabase } from '../worker/db.ts';

export type Tx = Transaction<WorkerDatabase>;

export interface DecodedLog {
  address: string; // lower case
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  blockTime: number; // unix seconds
}

export interface ApplyContext {
  predict: string;
  staking: string | null;
  ct: string;
  /** Lower case wallets of known players (for CT transfers). */
  knownWallets: Set<string>;
  /** Event names per transaction in this range (to label CT transfers). */
  txEvents: Map<string, Set<string>>;
  /** settlesAt read from chain for markets resolved in this range. */
  settlesAt: Map<number, number>;
  /** Owner and role activity found in the range, raised as alerts after commit. */
  ownerActivity: { event: string; txHash: string; args: Record<string, unknown> }[];
  /** Day of the last ranked credit seen in a transaction: an invite bonus belongs to that credit's day. */
  creditDay?: Map<string, number>;
}

const lc = (a: unknown) => String(a).toLowerCase();
const num = (x: unknown) => Number(x as bigint | number);
const ts = (unix: number) => new Date(unix * 1000);
const str = (x: unknown) => (typeof x === 'bigint' ? x.toString() : String(x));

const KIND: Record<number, 'completion' | 'hits' | 'compensation'> = { 1: 'completion', 2: 'hits', 3: 'compensation' };
const LOCK_INDEX: Record<number, number> = { 30: 0, 90: 1, 180: 2, 365: 3 };

export function bytes32ToText(b: unknown): string {
  try {
    return hexToString(b as Hex, { size: 32 }).replace(/\0+$/, '');
  } catch {
    return String(b);
  }
}

const OWNER_EVENTS = new Set([
  'ParamsProposed',
  'ParamsApplied',
  'ParamsCancelled',
  'RoleGranted',
  'RoleRevoked',
  'ReserveWithdrawn',
  'RewardsWithdrawn',
  'Paused',
  'Unpaused',
  'TreasuryProposed',
  'TreasurySet',
  'DefaultAdminTransferScheduled',
  'RatesSet',
  'TiersSet',
  'MinimumsSet',
  'CapsSet',
]);

export async function applyLog(tx: Tx, l: DecodedLog, ctx: ApplyContext): Promise<void> {
  const a = l.args;
  if (l.address === ctx.ct) return applyCtTransfer(tx, l, ctx);
  if (OWNER_EVENTS.has(l.eventName)) ctx.ownerActivity.push({ event: l.eventName, txHash: l.txHash, args: a });

  if (ctx.staking && l.address === ctx.staking) return applyStaking(tx, l);
  if (l.address !== ctx.predict) return;

  switch (l.eventName) {
    case 'PlayerRegistered': {
      await tx
        .updateTable('users')
        .set({ registration: 'registered', registered_tx: l.txHash, registered_at: ts(l.blockTime), updated_at: new Date() })
        .where('wallet', '=', lc(a.wallet))
        .execute();
      await tx
        .updateTable('registration_requests')
        .set({ status: 'mined', tx_hash: l.txHash, updated_at: new Date() })
        .where('wallet', '=', lc(a.wallet))
        .where('kind', '=', 'register')
        .where('status', 'in', ['queued', 'sent'])
        .execute();
      return;
    }
    case 'PlayerFrozen': {
      const frozen = Boolean(a.frozen);
      const reason = bytes32ToText(a.reason);
      await tx
        .updateTable('users')
        .set({ frozen, frozen_reason: frozen ? reason : null, updated_at: new Date() })
        .where('wallet', '=', lc(a.wallet))
        .execute();
      await tx
        .updateTable('freezes')
        .set({ status: 'mined' })
        .where('wallet', '=', lc(a.wallet))
        .where('tx_hash', '=', l.txHash)
        .execute();
      return;
    }
    case 'PlayKeySet': {
      const key = lc(a.key);
      const wallet = lc(a.player);
      await tx
        .updateTable('play_keys')
        .set({ replaced_by: key, updated_at: new Date() })
        .where('wallet', '=', wallet)
        .where('key', '!=', key)
        .where('revoked_tx', 'is', null)
        .where('replaced_by', 'is', null)
        .execute();
      await tx
        .insertInto('play_keys')
        .values({ key, wallet, expires_at: ts(num(a.expiresAt)), set_tx: l.txHash })
        .onConflict((oc) => oc.column('key').doUpdateSet({ wallet, expires_at: ts(num(a.expiresAt)), set_tx: l.txHash, revoked_tx: null, updated_at: new Date() }))
        .execute();
      return;
    }
    case 'PlayKeyRevoked': {
      await tx.updateTable('play_keys').set({ revoked_tx: l.txHash, updated_at: new Date() }).where('key', '=', lc(a.key)).execute();
      return;
    }
    case 'DayCreated': {
      const dayId = num(a.dayId);
      const hashes = a.contentHashes as readonly string[];
      for (let slot = 0; slot < 5; slot++) {
        await tx
          .updateTable('markets')
          .set({ status: 'published', create_tx: l.txHash, updated_at: new Date() })
          .where('market_id', '=', dayId * 5 + slot)
          .where('status', 'in', ['draft', 'scheduled'])
          .where('content_hash', '=', lc(hashes[slot]))
          .execute();
      }
      return;
    }
    case 'Predicted': {
      const wallet = lc(a.user);
      const dayId = num(a.dayId);
      const answered = num(a.answered);
      await tx
        .insertInto('predictions')
        .values({ wallet, market_id: num(a.marketId), day_id: dayId, choice: num(a.choice), answered, tx_hash: l.txHash, block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.columns(['wallet', 'market_id']).doNothing())
        .execute();
      const completed = answered >= 5;
      await tx
        .insertInto('user_days')
        .values({ wallet, day_id: dayId, answered, completed, completed_at: completed ? ts(l.blockTime) : null })
        .onConflict((oc) =>
          oc.columns(['wallet', 'day_id']).doUpdateSet({
            answered: sql`greatest(user_days.answered, excluded.answered)`,
            completed: sql`user_days.completed or excluded.completed`,
            completed_at: sql`coalesce(user_days.completed_at, excluded.completed_at)`,
          }),
        )
        .execute();
      return;
    }
    case 'PointsCredited': {
      const wallet = lc(a.user);
      const kind = KIND[num(a.kind)];
      const amount = num(a.amount);
      const weekId = num(a.weekId);
      const dayId = num(a.dayId);
      (ctx.creditDay ??= new Map()).set(l.txHash, dayId);
      const inserted = await tx
        .insertInto('points_ledger')
        .values({ wallet, kind, amount, day_id: dayId, week_id: weekId, ranked: true, tx_hash: l.txHash, log_index: l.logIndex, block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.columns(['tx_hash', 'log_index']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!inserted) return; // replay
      const completionAt = kind === 'completion' ? ts(l.blockTime) : null;
      await tx
        .insertInto('week_totals')
        .values({ week_id: weekId, wallet, points: amount, last_completion_at: completionAt, last_credit_block: l.blockNumber })
        .onConflict((oc) =>
          oc.columns(['week_id', 'wallet']).doUpdateSet({
            points: sql`week_totals.points + excluded.points`,
            last_completion_at: completionAt ? completionAt : sql`week_totals.last_completion_at`,
            last_credit_block: l.blockNumber,
          }),
        )
        .execute();
      if (kind === 'completion' || kind === 'hits') {
        const col = kind === 'completion' ? 'completion_points' : 'hit_points';
        await tx
          .insertInto('user_days')
          .values({ wallet, day_id: dayId, [col]: amount })
          .onConflict((oc) => oc.columns(['wallet', 'day_id']).doUpdateSet({ [col]: sql`user_days.${sql.ref(col)} + ${amount}` }))
          .execute();
      }
      return;
    }
    case 'ReferrerSet': {
      const invitee = lc(a.player);
      const inviter = lc(a.referrer);
      await tx
        .insertInto('referrals')
        .values({ invitee, inviter, source: 'session', bound_tx: l.txHash, bound_at: ts(l.blockTime) })
        .onConflict((oc) => oc.column('invitee').doUpdateSet({ inviter, bound_tx: l.txHash, bound_at: ts(l.blockTime) }))
        .execute();
      await tx
        .updateTable('registration_requests')
        .set({ status: 'mined', tx_hash: l.txHash, updated_at: new Date() })
        .where('wallet', '=', invitee)
        .where('kind', '=', 'set_referrer')
        .where('status', 'in', ['queued', 'sent'])
        .execute();
      return;
    }
    case 'ReferralPaid': {
      const day = ctx.creditDay?.get(l.txHash) ?? dayIdOf(l.blockTime);
      const inserted = await tx
        .insertInto('points_ledger')
        .values({ wallet: lc(a.referrer), kind: 'referral', amount: num(a.amount), source_wallet: lc(a.player), day_id: day, week_id: weekOf(dayIdOf(l.blockTime)), ranked: false, tx_hash: l.txHash, log_index: l.logIndex, block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.columns(['tx_hash', 'log_index']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (inserted) {
        await tx.updateTable('referrals').set({ bonus_points: sql`bonus_points + ${num(a.amount)}` }).where('invitee', '=', lc(a.player)).execute();
      }
      return;
    }
    case 'WelcomePaid': {
      const inserted = await tx
        .insertInto('points_ledger')
        .values({ wallet: lc(a.player), kind: 'welcome', amount: num(a.amount), source_wallet: lc(a.referrer), day_id: num(a.dayId), week_id: weekOf(num(a.dayId)), ranked: false, tx_hash: l.txHash, log_index: l.logIndex, block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.columns(['tx_hash', 'log_index']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (inserted) {
        await tx
          .updateTable('referrals')
          .set({ welcome_tx: l.txHash, welcome_points: num(a.amount), first_day_at: sql`coalesce(first_day_at, ${ts(l.blockTime)})` })
          .where('invitee', '=', lc(a.player))
          .execute();
      }
      return;
    }
    case 'OutcomeSet': {
      const id = num(a.marketId);
      const outcome = num(a.outcome);
      const correction = Boolean(a.correction);
      const settles = ctx.settlesAt.get(id);
      await tx
        .updateTable('markets')
        .set({
          outcome,
          status: outcome === 3 ? 'voided' : 'resolved',
          outcome_tx: l.txHash,
          ...(correction ? {} : { resolved_at: ts(l.blockTime) }),
          ...(settles !== undefined ? { settles_at: ts(settles) } : {}),
          updated_at: new Date(),
        })
        .where('market_id', '=', id)
        .execute();
      return;
    }
    case 'MarketVoided': {
      await tx
        .updateTable('markets')
        .set({ outcome: 3, status: 'voided', outcome_tx: l.txHash, settles_at: ts(l.blockTime), resolved_at: sql`coalesce(resolved_at, ${ts(l.blockTime)})`, updated_at: new Date() })
        .where('market_id', '=', num(a.marketId))
        .execute();
      return;
    }
    case 'Settled': {
      await tx
        .insertInto('user_days')
        .values({ wallet: lc(a.user), day_id: num(a.dayId), settled_mask: num(a.slotsMask), hits: num(a.hits) })
        .onConflict((oc) =>
          oc.columns(['wallet', 'day_id']).doUpdateSet({
            // Replays: a mask bit already set means this log was applied; hits are only added for new bits.
            hits: sql`user_days.hits + case when (user_days.settled_mask & ${num(a.slotsMask)}) = 0 then ${num(a.hits)} else 0 end`,
            settled_mask: sql`user_days.settled_mask | ${num(a.slotsMask)}`,
          }),
        )
        .execute();
      return;
    }
    case 'CorrectedOutcomeSet': {
      await tx.updateTable('markets').set({ corrected_outcome: num(a.outcome), status: 'corrected', updated_at: new Date() }).where('market_id', '=', num(a.marketId)).execute();
      ctx.ownerActivity.push({ event: 'CorrectedOutcomeSet', txHash: l.txHash, args: a });
      return;
    }
    case 'Compensated': {
      await tx
        .insertInto('worker_compensations')
        .values({ market_id: num(a.marketId), wallet: lc(a.user), points: num(a.points), tx_hash: l.txHash, log_index: l.logIndex })
        .onConflict((oc) => oc.columns(['market_id', 'wallet']).doNothing())
        .execute();
      return;
    }
    case 'Converted': {
      const wallet = lc(a.user);
      await tx
        .insertInto('conversions')
        .values({ tx_hash: l.txHash, wallet, points: num(a.points), ct: str(a.ctAmount), block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.column('tx_hash').doNothing())
        .execute();
      await tx
        .insertInto('points_ledger')
        .values({ wallet, kind: 'convert', amount: -num(a.points), ranked: false, tx_hash: l.txHash, log_index: l.logIndex, block: l.blockNumber, block_time: ts(l.blockTime) })
        .onConflict((oc) => oc.columns(['tx_hash', 'log_index']).doNothing())
        .execute();
      return;
    }
    case 'AirdropPaid': {
      const weekId = num(a.weekId);
      await tx
        .insertInto('airdrop_rows')
        .values({ week_id: weekId, rank: num(a.rank), wallet: lc(a.user), points: 0, amount: str(a.amount), tx_hash: l.txHash })
        .onConflict((oc) => oc.columns(['week_id', 'rank']).doUpdateSet({ wallet: lc(a.user), amount: str(a.amount), tx_hash: l.txHash, skipped_reason: null }))
        .execute();
      await tx
        .insertInto('weeks')
        .values({ week_id: weekId, status: 'airdropped', airdrop_tx: l.txHash })
        .onConflict((oc) => oc.column('week_id').doUpdateSet({ status: 'airdropped', airdrop_tx: l.txHash, updated_at: new Date() }))
        .execute();
      return;
    }
    default:
      return; // Transfer (points), ReferralSkipped, role admin noise
  }
}

async function applyStaking(tx: Tx, l: DecodedLog): Promise<void> {
  const a = l.args;
  switch (l.eventName) {
    case 'Staked': {
      const lockDays = num(a.lockDays);
      await tx
        .insertInto('stakes')
        .values({
          wallet: lc(a.user),
          position_id: num(a.id),
          principal: str(a.amount),
          lock_index: LOCK_INDEX[lockDays] ?? 0,
          lock_days: lockDays,
          apr_bps: num(a.aprBps),
          max_interest: str(a.maxInterest),
          start_at: ts(l.blockTime),
          end_at: ts(num(a.end)),
          stake_tx: l.txHash,
        })
        .onConflict((oc) => oc.columns(['wallet', 'position_id']).doNothing())
        .execute();
      return;
    }
    case 'InterestClaimed': {
      await tx
        .updateTable('stakes')
        .set({ claimed: sql`claimed + ${str(a.amount)}::numeric` })
        .where('wallet', '=', lc(a.user))
        .where('position_id', '=', num(a.id))
        .execute();
      return;
    }
    case 'Withdrawn': {
      await tx
        .updateTable('stakes')
        .set({ closed: true, claimed: sql`claimed + ${str(a.interest)}::numeric`, withdraw_tx: l.txHash })
        .where('wallet', '=', lc(a.user))
        .where('position_id', '=', num(a.id))
        .where('closed', '=', false)
        .execute();
      return;
    }
    default:
      return;
  }
}

async function applyCtTransfer(tx: Tx, l: DecodedLog, ctx: ApplyContext): Promise<void> {
  if (l.eventName !== 'Transfer') return;
  const from = lc(l.args.from);
  const to = lc(l.args.to);
  const value = str(l.args.value);
  const events = ctx.txEvents.get(l.txHash) ?? new Set<string>();
  const kindFor = (counterparty: string, dir: 'in' | 'out'): string => {
    if (counterparty === ctx.predict) return events.has('AirdropPaid') ? 'airdrop' : events.has('Converted') ? 'convert' : 'transfer';
    if (ctx.staking && counterparty === ctx.staking) {
      if (dir === 'out') return 'stake';
      return events.has('Withdrawn') ? 'withdraw' : events.has('InterestClaimed') ? 'interest' : 'transfer';
    }
    return 'transfer';
  };
  const rows: { wallet: string; direction: 'in' | 'out'; counterparty: string }[] = [];
  if (ctx.knownWallets.has(to)) rows.push({ wallet: to, direction: 'in', counterparty: from });
  if (ctx.knownWallets.has(from)) rows.push({ wallet: from, direction: 'out', counterparty: to });
  for (const r of rows) {
    await tx
      .insertInto('wallet_transfers')
      .values({ tx_hash: l.txHash, log_index: l.logIndex, wallet: r.wallet, direction: r.direction, counterparty: r.counterparty, amount: value, kind: kindFor(r.counterparty, r.direction), block: l.blockNumber, block_time: ts(l.blockTime) })
      .onConflict((oc) => oc.columns(['tx_hash', 'log_index', 'wallet']).doNothing())
      .execute();
  }
}

/** Week of a day id (re-exported for callers that only import the indexer). */
export { weekOf };
