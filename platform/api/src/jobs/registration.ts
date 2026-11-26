// Registration queue (DEV-PLAN 6.4 "Every 10 s"): `registerPlayers(wallets, referrers)` for sessions
// that passed the API's checks (with the inviter when a code was given before registration), then
// `setReferrers` for codes redeemed after registration (inside the contract's 24 hour window).
//
// Batches are all or nothing on chain, so every entry is checked against the chain first; an entry
// that would revert is taken out (or registered without its inviter) and recorded, so one bad row
// never blocks the queue.

import { INVITE_WINDOW_SECONDS } from '../../../shared/src/time.ts';
import { cojamPredictAbi, type Address } from '../worker/chain.ts';
import { SimulationRevert } from '../worker/sender.ts';
import type { JobContext } from './context.ts';

export interface PlayerState {
  referrer: string;
  registeredAt: number;
  registered: boolean;
  frozen: boolean;
  completedOnce: boolean;
}

const ZERO = '0x0000000000000000000000000000000000000000';

export async function readPlayer(ctx: JobContext, wallet: string): Promise<PlayerState> {
  const r = (await ctx.client.readContract({ address: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'players', args: [wallet as Address] })) as readonly unknown[];
  return { referrer: String(r[0]).toLowerCase(), registeredAt: Number(r[1] as bigint), registered: Boolean(r[2]), frozen: Boolean(r[3]), completedOnce: Boolean(r[4]) };
}

/** Why `referrer` cannot be linked to `player` on chain (contract `_link`), or null. */
export function referrerProblem(player: string, referrer: string, r: PlayerState): string | null {
  if (referrer === player) return 'self';
  if (!r.registered) return 'inviter not registered';
  if (r.frozen) return 'inviter on hold';
  if (r.referrer === player) return 'two way link';
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export interface RegistrationResult {
  registered: string[];
  linked: string[];
  failed: number;
}

export async function processRegistrations(ctx: JobContext): Promise<RegistrationResult> {
  const out: RegistrationResult = { registered: [], linked: [], failed: 0 };
  await registerBatch(ctx, out);
  await referrerBatch(ctx, out);
  return out;
}

async function registerBatch(ctx: JobContext, out: RegistrationResult): Promise<void> {
  const rows = await ctx.db
    .selectFrom('registration_requests')
    .select(['id', 'wallet', 'referrer', 'attempts'])
    .where('kind', '=', 'register')
    .where('status', '=', 'queued')
    .orderBy('id')
    .limit(ctx.settings.registerBatch)
    .execute();
  if (rows.length === 0) return;
  const now = new Date();
  const seen = new Set<string>();
  const wallets: string[] = [];
  const referrers: string[] = [];
  const ids: number[] = [];
  const notes = new Map<number, string>();
  const states = await mapLimit(rows, 8, async (r) => {
    const w = r.wallet.toLowerCase();
    const ref = r.referrer?.toLowerCase() ?? null;
    return { r, w, ref, me: await readPlayer(ctx, w), inv: ref ? await readPlayer(ctx, ref) : null };
  });
  for (const { r, w, ref, me, inv } of states) {
    if (me.registered) {
      await ctx.db.updateTable('registration_requests').set({ status: 'mined', error: 'already registered on chain', updated_at: now }).where('id', '=', r.id).execute();
      continue;
    }
    if (seen.has(w)) {
      await ctx.db.updateTable('registration_requests').set({ status: 'cancelled', error: 'duplicate in queue', updated_at: now }).where('id', '=', r.id).execute();
      continue;
    }
    seen.add(w);
    let referrer = ZERO;
    if (ref && inv) {
      // An inviter registered in this same batch is not registered yet when the batch runs in order
      // only if it comes later; registration order in the batch follows the queue, so an inviter
      // queued earlier in this batch counts as registered.
      const sameBatch = wallets.includes(ref);
      const problem = sameBatch ? null : referrerProblem(w, ref, inv);
      if (problem) notes.set(r.id, `registered without inviter: ${problem}`);
      else referrer = ref;
    }
    wallets.push(w);
    referrers.push(referrer);
    ids.push(r.id);
  }
  if (wallets.length === 0) return;
  await ctx.db.updateTable('registration_requests').set({ status: 'sent', updated_at: now }).where('id', 'in', ids).execute();
  try {
    const res = await ctx.sender.send({ job: 'registration', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'registerPlayers', args: [wallets as Address[], referrers as Address[]] });
    for (let i = 0; i < ids.length; i++) {
      await ctx.db
        .updateTable('registration_requests')
        .set({ status: 'mined', tx_hash: res.hash, error: notes.get(ids[i]) ?? null, updated_at: new Date() })
        .where('id', '=', ids[i])
        .execute();
    }
    await ctx.db
      .updateTable('users')
      .set({ registration: 'registered', registered_tx: res.hash, updated_at: new Date() })
      .where('wallet', 'in', wallets)
      .where('registration', '=', 'pending')
      .execute();
    out.registered.push(...wallets);
    ctx.log.info('registration: players registered', { count: wallets.length, tx: res.hash });
  } catch (e) {
    const name = e instanceof SimulationRevert ? e.errorName : null;
    await ctx.db
      .updateTable('registration_requests')
      .set((eb) => ({ status: 'queued', attempts: eb('attempts', '+', 1), error: `${name ?? (e as Error).message}`.slice(0, 300), updated_at: new Date() }))
      .where('id', 'in', ids)
      .execute();
    // Give up on rows that keep failing so the queue moves on.
    const dead = await ctx.db
      .updateTable('registration_requests')
      .set({ status: 'failed', updated_at: new Date() })
      .where('id', 'in', ids)
      .where('attempts', '>=', 5)
      .returning('wallet')
      .execute();
    out.failed += dead.length;
    if (dead.length) await ctx.alerts.raise('registration-failing', 'warn', 'Registrations keep failing', `${dead.length} registration requests failed 5 times (${name ?? (e as Error).message})`);
    ctx.log.warn('registration: batch failed, will retry', { error: (e as Error).message, name });
  }
}

async function referrerBatch(ctx: JobContext, out: RegistrationResult): Promise<void> {
  const rows = await ctx.db
    .selectFrom('registration_requests')
    .select(['id', 'wallet', 'referrer'])
    .where('kind', '=', 'set_referrer')
    .where('status', '=', 'queued')
    .orderBy('id')
    .limit(ctx.settings.registerBatch)
    .execute();
  if (rows.length === 0) return;
  const now = ctx.now();
  const players: string[] = [];
  const refs: string[] = [];
  const ids: number[] = [];
  for (const r of rows) {
    const w = r.wallet.toLowerCase();
    const ref = (r.referrer ?? '').toLowerCase();
    const me = await readPlayer(ctx, w);
    const fail = async (why: string) =>
      ctx.db.updateTable('registration_requests').set({ status: 'failed', error: why, updated_at: new Date() }).where('id', '=', r.id).execute();
    if (!ref) {
      await fail('no inviter given');
      continue;
    }
    if (!me.registered) continue; // registration not mined yet: try again next round
    if (me.referrer !== ZERO) {
      await ctx.db.updateTable('registration_requests').set({ status: me.referrer === ref ? 'mined' : 'failed', error: me.referrer === ref ? null : 'INVITE_ALREADY_LINKED', updated_at: new Date() }).where('id', '=', r.id).execute();
      continue;
    }
    if (now >= me.registeredAt + INVITE_WINDOW_SECONDS) {
      await fail('INVITE_TOO_LATE');
      continue;
    }
    if (players.includes(w)) continue;
    const problem = referrerProblem(w, ref, await readPlayer(ctx, ref));
    if (problem) {
      await fail(`INVITE_LIMIT: ${problem}`);
      continue;
    }
    players.push(w);
    refs.push(ref);
    ids.push(r.id);
  }
  if (players.length === 0) return;
  await ctx.db.updateTable('registration_requests').set({ status: 'sent', updated_at: new Date() }).where('id', 'in', ids).execute();
  try {
    const res = await ctx.sender.send({ job: 'registration', to: ctx.contracts.predict, abi: cojamPredictAbi, functionName: 'setReferrers', args: [players as Address[], refs as Address[]] });
    await ctx.db.updateTable('registration_requests').set({ status: 'mined', tx_hash: res.hash, updated_at: new Date() }).where('id', 'in', ids).execute();
    out.linked.push(...players);
  } catch (e) {
    await ctx.db
      .updateTable('registration_requests')
      .set((eb) => ({ status: 'queued', attempts: eb('attempts', '+', 1), error: (e as Error).message.slice(0, 300), updated_at: new Date() }))
      .where('id', 'in', ids)
      .execute();
    await ctx.db.updateTable('registration_requests').set({ status: 'failed', updated_at: new Date() }).where('id', 'in', ids).where('attempts', '>=', 5).execute();
    ctx.log.warn('registration: setReferrers failed, will retry', { error: (e as Error).message });
  }
}
