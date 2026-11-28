// Risk check (DEV-PLAN 5.3, DECISIONS "Abuse blocking"): hourly over accounts active in the last 14
// days, and at every sign up on the new account and its cluster. At or above the block threshold the
// account is queued for an on chain freeze (`freezes` row, actor `risk-check`), sent by
// `processFreezes` with `setFrozenMany`; from the review threshold it is listed for AD7 review.
// Points already earned are never debited. Unblock and clear set a 30 day mark during which the
// rules that fired cannot freeze the account again.

import { sql } from 'kysely';
import { audit } from '../db/index.ts';
import { cojamPredictAbi, type Address } from '../worker/chain.ts';
import type { JobContext } from '../jobs/context.ts';
import { readPlayer } from '../jobs/registration.ts';
import { activeWallets, clusterOf, gatherFacts } from './facts.ts';
import { reasonToBytes32, RULE_LABEL, scoreAccount, type RuleId } from './rules.ts';

export const CLEAR_MARK_DAYS = 30;

export interface RiskRunResult {
  scored: number;
  review: string[];
  blocked: string[];
}

export async function riskCheck(ctx: JobContext, opts: { run: 'hourly' | 'signup' | 'manual'; wallets?: string[] }): Promise<RiskRunResult> {
  const now = ctx.now();
  const wallets = opts.wallets ? await clusterOf(ctx.db, opts.wallets.map((w) => w.toLowerCase())) : await activeWallets(ctx.db, now);
  const out: RiskRunResult = { scored: 0, review: [], blocked: [] };
  if (wallets.length === 0) return out;
  const facts = await gatherFacts(ctx.db, wallets, now);

  const users = await ctx.db.selectFrom('users').select(['wallet', 'frozen', 'risk_clear_until', 'registration']).where('wallet', 'in', wallets).execute();
  const byWallet = new Map(users.map((u) => [u.wallet!.toLowerCase(), u]));
  const cleared = await ctx.db.selectFrom('risk_flags').select(['wallet', 'rule']).where('wallet', 'in', wallets).where('status', '=', 'cleared').execute();
  const queued = new Set(
    (await ctx.db.selectFrom('freezes').select('wallet').where('wallet', 'in', wallets).where('status', 'in', ['queued', 'sent']).execute()).map((r) => r.wallet.toLowerCase()),
  );

  for (const f of facts) {
    const u = byWallet.get(f.wallet);
    if (!u || u.registration !== 'registered') continue;
    const markActive = u.risk_clear_until && new Date(u.risk_clear_until).getTime() / 1000 > now;
    const clearedRules = new Set<RuleId>(markActive ? (cleared.filter((c) => c.wallet.toLowerCase() === f.wallet).map((c) => c.rule) as RuleId[]) : []);
    const r = scoreAccount(f, clearedRules, { blockAt: ctx.settings.riskBlockAt, reviewAt: ctx.settings.riskReviewAt });
    out.scored++;
    await ctx.db.updateTable('users').set({ risk_score: r.score, updated_at: new Date() }).where('wallet', '=', f.wallet).execute();
    if (r.action === 'none') continue;

    // One open flag per wallet and rule: refreshed, not repeated.
    for (const h of r.counted) {
      const status = r.action === 'block' ? 'blocked' : 'open';
      const upd = await ctx.db
        .updateTable('risk_flags')
        .set({ score: r.score, details: JSON.stringify({ ...h.details, text: h.text, label: RULE_LABEL[h.rule], weight: h.weight }), status })
        .where('wallet', '=', f.wallet)
        .where('rule', '=', h.rule)
        .where('status', '=', 'open')
        .returning('id')
        .executeTakeFirst();
      if (!upd) {
        await ctx.db
          .insertInto('risk_flags')
          .values({ wallet: f.wallet, rule: h.rule, score: r.score, details: JSON.stringify({ ...h.details, text: h.text, label: RULE_LABEL[h.rule], weight: h.weight }), run: opts.run, status })
          .execute();
      }
    }
    if (r.action === 'review') {
      out.review.push(f.wallet);
      continue;
    }
    if (u.frozen || queued.has(f.wallet)) continue;
    await ctx.db
      .insertInto('freezes')
      .values({
        wallet: f.wallet,
        action: 'freeze',
        actor: 'risk-check',
        reason_code: r.reasonCode,
        reason: r.counted.map((h) => RULE_LABEL[h.rule]).join(', '),
        rules: JSON.stringify(r.counted.map((h) => ({ rule: h.rule, weight: h.weight, text: h.text }))),
        status: 'queued',
      })
      .execute();
    out.blocked.push(f.wallet);
  }

  if (out.blocked.length) {
    const hour = new Date(now * 1000).toISOString().slice(0, 13);
    await ctx.alerts.raise(`risk-freezes:${hour}`, 'warn', 'Accounts blocked by the risk check', `${out.blocked.length} account(s) queued for an on chain freeze this run`, { wallets: out.blocked });
  }
  const reviewOpen = await ctx.db.selectFrom('risk_flags').select(sql<number>`count(distinct wallet)::int`.as('n')).where('status', '=', 'open').executeTakeFirst();
  if ((reviewOpen?.n ?? 0) > 50) await ctx.alerts.raise('risk-review-list', 'warn', 'Review list above 50 accounts', `${reviewOpen!.n} accounts wait for review in AD7`);
  else await ctx.alerts.resolve('risk-review-list');
  ctx.log.info('risk: check done', { run: opts.run, scored: out.scored, review: out.review.length, blocked: out.blocked.length });
  return out;
}

/**
 * Sends queued freezes and unfreezes with `setFrozenMany` (operator key, no master wallet), and
 * applies admin "clear" entries. Entries for wallets already in the requested state are closed
 * without a transaction.
 */
export async function processFreezes(ctx: JobContext): Promise<{ frozen: number; unfrozen: number; cleared: number }> {
  const out = { frozen: 0, unfrozen: 0, cleared: 0 };
  const rows = await ctx.db.selectFrom('freezes').selectAll().where('status', '=', 'queued').orderBy('id').limit(ctx.settings.freezeBatch * 2).execute();
  const now = ctx.now();
  const mark = new Date((now + CLEAR_MARK_DAYS * 86400) * 1000);

  for (const r of rows.filter((x) => x.action === 'clear')) {
    await ctx.db.updateTable('freezes').set({ status: 'done' }).where('id', '=', r.id).execute();
    await ctx.db.updateTable('risk_flags').set({ status: 'cleared' }).where('wallet', '=', r.wallet).where('status', 'in', ['open', 'blocked']).execute();
    await ctx.db.updateTable('users').set({ risk_clear_until: mark, updated_at: new Date() }).where('wallet', '=', r.wallet).execute();
    out.cleared++;
  }

  for (const action of ['freeze', 'unfreeze'] as const) {
    const batch = rows.filter((x) => x.action === action).slice(0, ctx.settings.freezeBatch);
    if (batch.length === 0) continue;
    const frozen = action === 'freeze';
    const send: typeof batch = [];
    for (const r of batch) {
      const p = await readPlayer(ctx, r.wallet);
      if (!p.registered) {
        await ctx.db.updateTable('freezes').set({ status: 'failed', reason: `${r.reason ?? ''} (not registered on chain)`.trim() }).where('id', '=', r.id).execute();
        continue;
      }
      if (p.frozen === frozen) {
        await ctx.db.updateTable('freezes').set({ status: 'done' }).where('id', '=', r.id).execute();
        continue;
      }
      if (send.some((x) => x.wallet === r.wallet)) {
        await ctx.db.updateTable('freezes').set({ status: 'done' }).where('id', '=', r.id).execute();
        continue;
      }
      send.push(r);
    }
    if (send.length === 0) continue;
    const ids = send.map((r) => r.id);
    await ctx.db.updateTable('freezes').set({ status: 'sent' }).where('id', 'in', ids).execute();
    try {
      const res = await ctx.sender.send({
        job: 'freezes',
        to: ctx.contracts.predict,
        abi: cojamPredictAbi,
        functionName: 'setFrozenMany',
        args: [send.map((r) => r.wallet as Address), frozen, send.map((r) => reasonToBytes32(r.reason_code ?? (frozen ? 'risk' : 'unblock')))],
      });
      await ctx.db.updateTable('freezes').set({ status: 'mined', tx_hash: res.hash }).where('id', 'in', ids).execute();
      const wallets = send.map((r) => r.wallet);
      await ctx.db.updateTable('users').set({ frozen, frozen_reason: frozen ? send[0].reason_code : null, updated_at: new Date() }).where('wallet', 'in', wallets).execute();
      if (frozen) {
        await ctx.db.updateTable('risk_flags').set({ status: 'blocked' }).where('wallet', 'in', wallets).where('status', '=', 'open').execute();
        out.frozen += wallets.length;
      } else {
        await ctx.db.updateTable('risk_flags').set({ status: 'cleared' }).where('wallet', 'in', wallets).where('status', 'in', ['open', 'blocked']).execute();
        await ctx.db.updateTable('users').set({ risk_clear_until: mark }).where('wallet', 'in', wallets).execute();
        out.unfrozen += wallets.length;
      }
      for (const r of send) await audit(ctx.db as never, { actor: r.actor, action: frozen ? 'player.freeze' : 'player.unfreeze', target: r.wallet, payload: { reason: r.reason, reasonCode: r.reason_code, rules: r.rules }, txHash: res.hash });
      await ctx.alerts.raise(`freeze-tx:${res.hash}`, 'info', frozen ? `Blocked ${wallets.length} account(s)` : `Unblocked ${wallets.length} account(s)`, send.map((r) => `${r.wallet} by ${r.actor}: ${r.reason ?? ''}`).join('\n'));
    } catch (e) {
      await ctx.db.updateTable('freezes').set({ status: 'queued' }).where('id', 'in', ids).execute();
      ctx.log.warn('freezes: send failed, will retry', { action, error: (e as Error).message });
    }
  }
  return out;
}
