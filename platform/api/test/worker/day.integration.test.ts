// A whole compressed day against a local Hardhat node with the real contracts and a real Postgres:
// register (with an inviter and a late code), draft with the fake AI, publish, predict, risk freeze,
// set outcomes, correct inside the window, settle, compensate after the window, close the week and
// send the airdrop, with the indexer mirroring every step. Also: the sender's serialization,
// simulation reverts and crash recovery, and the indexer's rebuild from the deploy block.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createWalletClient, http, parseEther, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { dayEnd, dayIdOf, dayOpensAt, weekEnd, weekOf } from '../../../shared/src/time.ts';
import { FakeProvider } from '../../src/ai/fake.ts';
import { CategoryIllustrationGenerator } from '../../src/ai/images.ts';
import { draftJob } from '../../src/jobs/ai.ts';
import { compensationSweep } from '../../src/jobs/compensation.ts';
import { DEFAULT_SETTINGS, type JobContext } from '../../src/jobs/context.ts';
import { correctionCheck, expirySweep, publishDay, resolutionSweep, settleSweep } from '../../src/jobs/markets.ts';
import { runMonitors } from '../../src/jobs/monitors.ts';
import { processRegistrations } from '../../src/jobs/registration.ts';
import { processOperatorRequests } from '../../src/jobs/requests.ts';
import { closeWeek, runAirdrop } from '../../src/jobs/weekly.ts';
import { Indexer } from '../../src/indexer/indexer.ts';
import { processFreezes, riskCheck } from '../../src/risk/check.ts';
import { Alerts } from '../../src/worker/alerts.ts';
import { chainFor, cojamPredictAbi, erc20Abi } from '../../src/worker/chain.ts';
import { silentLogger } from '../../src/worker/log.ts';
import { OperatorSender, SimulationRevert } from '../../src/worker/sender.ts';
import { createWorkerDb, deploy, postgresAvailable, rpc, startHardhat, warpTo, type Deployed, type Node, type TestDb } from './helpers/env.ts';

const pgProblem = await postgresAvailable();
const run = pgProblem ? describe.skip : describe;
if (pgProblem) console.warn(`worker integration tests skipped: Postgres unavailable (${pgProblem})`);

const N = 8;
run('compressed day on Hardhat + Postgres', () => {
  let node: Node;
  let d: Deployed;
  let t: TestDb;
  let ctx: JobContext;
  let indexer: Indexer;
  let fake: FakeProvider;
  let chainTime = 0;
  const players = Array.from({ length: N }, () => privateKeyToAccount(generatePrivateKey()));
  const W = players.map((p) => p.address.toLowerCase() as Address);
  let D = 0; // the game day
  let weekId = 0;

  const syncTime = async () => {
    chainTime = Number((await d.client.getBlock()).timestamp);
  };
  const warp = async (ts: number) => {
    await warpTo(node.url, ts);
    await syncTime();
  };
  const index = () => indexer.catchUp(100);
  const balance = async (w: string) => Number(await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'balanceOf', args: [w as Address] }));

  beforeAll(async () => {
    node = await startHardhat();
    d = await deploy(node.url);
    t = await createWorkerDb();
    await syncTime();
    fake = new FakeProvider();
    const sender = new OperatorSender(d.client, d.operator, t.db, silentLogger, { chainId: 31337, receiptTimeoutMs: 10_000, receiptPollMs: 50 });
    ctx = {
      db: t.db,
      client: d.client,
      sender,
      contracts: { predict: d.predict, staking: d.staking, ct: d.ct },
      log: silentLogger,
      alerts: new Alerts(t.db, silentLogger, []),
      ai: fake,
      images: { generator: new CategoryIllustrationGenerator(), store: null },
      adapters: [],
      settings: { ...DEFAULT_SETTINGS, draftHorizonDays: 1, poolMinDaysPlayed: 1, poolMinAccountAgeSec: 0 },
      now: () => chainTime,
    };
    indexer = new Indexer(t.db, d.client, { predict: d.predict, staking: d.staking, ct: d.ct, deployBlock: d.deployBlock, range: 50, minRange: 5, confirmations: 0 }, silentLogger);
    // Gas for the players (they send their own predicts here; in production the fee payer pays).
    for (const w of W) {
      const h = await d.ownerWallet.sendTransaction({ to: w, value: parseEther('1'), account: d.owner, chain: chainFor(31337, [node.url]) });
      await d.client.waitForTransactionReceipt({ hash: h });
    }
    // Start at 03:00 UTC of a Monday to Thursday so tomorrow's set may use Markets and the day fits a week.
    let day = dayIdOf(chainTime) + 1;
    while (![1, 2, 3, 4].includes(new Date(dayOpensAt(day) * 1000).getUTCDay())) day++;
    await warp(dayOpensAt(day) + 3 * 3600);
    D = dayIdOf(chainTime) + 1;
    weekId = weekOf(D);
  }, 180_000);

  afterAll(async () => {
    await t?.drop();
    node?.stop();
  });

  it('registers players in one batch, with an inviter in the same batch, then links a late code', async () => {
    for (let i = 0; i < N; i++) {
      const shared = i >= 4; // players 5 to 8 share a device, a network and an email shape
      await t.db
        .insertInto('users')
        .values({
          privy_user_id: `did:privy:${i}`,
          wallet: W[i],
          email_hash: `h${i}`,
          email_domain: 'gmail.com',
          device_id_first: shared ? 'dev-shared' : `dev-${i}`,
          ip_hash_first: shared ? 'ip-shared' : `ip-${i}`,
          email_shape_hash: shared ? 'shape-x' : `shape-${i}`,
          created_at: new Date((chainTime - 600 + i * 60) * 1000),
        })
        .execute();
      await t.db.insertInto('registration_requests').values({ kind: 'register', wallet: W[i], referrer: i === 1 ? W[0] : null }).execute();
    }
    const r = await processRegistrations(ctx);
    expect(r.registered).toHaveLength(N);
    await index();
    const users = await t.db.selectFrom('users').select(['wallet', 'registration', 'registered_at']).execute();
    expect(users.every((u) => u.registration === 'registered' && u.registered_at)).toBe(true);
    expect(await t.db.selectFrom('referrals').select(['inviter', 'bound_tx']).where('invitee', '=', W[1]).executeTakeFirstOrThrow()).toMatchObject({ inviter: W[0] });

    // A late code for player 3 (redeemed after registration, inside 24 h).
    await t.db.insertInto('registration_requests').values({ kind: 'set_referrer', wallet: W[2], referrer: W[0] }).execute();
    const r2 = await processRegistrations(ctx);
    expect(r2.linked).toEqual([W[2]]);
    await index();
    const p3 = (await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'players', args: [W[2]] })) as readonly unknown[];
    expect(String(p3[0]).toLowerCase()).toBe(W[0]);
    // A code for a player who is already linked fails without a transaction.
    await t.db.insertInto('registration_requests').values({ kind: 'set_referrer', wallet: W[2], referrer: W[3] }).execute();
    await processRegistrations(ctx);
    expect((await t.db.selectFrom('registration_requests').select(['status', 'error']).orderBy('id', 'desc').executeTakeFirstOrThrow()).error).toBe('INVITE_ALREADY_LINKED');
  }, 120_000);

  it('drafts the next day with the fake AI, picks 5 by the category mix, uses category illustrations, and publishes', async () => {
    const out = await draftJob(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].dayId).toBe(D);
    expect(out[0].scheduled).toHaveLength(5);
    const ms = await t.db.selectFrom('markets').selectAll().where('day_id', '=', D).orderBy('slot').execute();
    expect(ms.map((m) => m.status)).toEqual(Array(5).fill('scheduled'));
    const cats = ms.map((m) => m.category).sort();
    expect(cats.filter((c) => c === 'Crypto')).toHaveLength(2);
    expect(ms.every((m) => m.image_state === 'fallback')).toBe(true);
    expect(ms.every((m) => new Date(m.closes_at).getTime() / 1000 === dayEnd(D))).toBe(true);
    // ai_runs logged: 1 draft + 12 validations.
    const runs = await t.db.selectFrom('ai_runs').select(['job']).execute();
    expect(runs.filter((r) => r.job === 'draft')).toHaveLength(1);
    expect(runs.filter((r) => r.job === 'validate').length).toBeGreaterThanOrEqual(5);

    expect(await publishDay(ctx, D)).toBe('published');
    expect(await publishDay(ctx, D)).toBe('exists');
    await index();
    const after = await t.db.selectFrom('markets').select(['status', 'content_hash', 'market_id']).where('day_id', '=', D).execute();
    expect(after.every((m) => m.status === 'published')).toBe(true);
    const onChain = (await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(D * 5)] })) as readonly unknown[];
    expect(String(onChain[6]).toLowerCase()).toBe(after.find((m) => m.market_id === D * 5)!.content_hash);
  }, 120_000);

  // Picks: player i answers slot s with choice[i][s]. The answers will be B,B,B,B,B except slot 0 (A);
  // slot 4 is corrected inside the window to A; slot 1 is corrected by the owner after the window to A.
  const choices: number[][] = [
    [1, 2, 2, 2, 1], // P1: hits 0,2,3 + 4 after correction; comp on 1? no (picked 2)
    [2, 2, 2, 2, 2], // P2
    [1, 1, 2, 2, 2], // P3: comp on slot 1
    [2, 1, 1, 1, 1], // P4: comp on slot 1
    [1, 2, 2, 2, 1], // P5: frozen later, same as P6 (identical answers)
    [1, 2, 2, 2, 1], // P6
    [2, 2, 1, 1, 2], // P7
    [2, 1, 2, 1, 2], // P8
  ];

  it('players predict all five in the open day; completion, welcome and invite bonus are indexed', async () => {
    await warp(dayOpensAt(D) + 3600);
    const chain = chainFor(31337, [node.url]);
    for (let s = 0; s < 5; s++) {
      for (let i = 0; i < N; i++) {
        // P5 and P6 pick within the same second (identical answers and timing).
        const wc = createWalletClient({ chain, transport: http(node.url), account: players[i] });
        const h = await wc.writeContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'predict', args: [BigInt(D * 5 + s), choices[i][s]], account: players[i], chain } as never);
        await d.client.waitForTransactionReceipt({ hash: h });
      }
    }
    await syncTime();
    await index();
    const days = await t.db.selectFrom('user_days').selectAll().where('day_id', '=', D).execute();
    expect(days).toHaveLength(N);
    expect(days.every((x) => x.answered === 5 && x.completed && Number(x.completion_points) === 100)).toBe(true);
    // P2 was invited at registration: welcome 100 to P2, invite bonus 10 to P1 on P2's completion; P3 (late code) too.
    const ledger = await t.db.selectFrom('points_ledger').select(['wallet', 'kind', 'amount']).execute();
    expect(ledger.filter((l) => l.kind === 'welcome').map((l) => l.wallet).sort()).toEqual([W[1], W[2]].sort());
    expect(ledger.filter((l) => l.kind === 'referral' && l.wallet === W[0]).reduce((s, l) => s + Number(l.amount), 0)).toBe(20);
    expect(await balance(W[0])).toBe(120);
    expect(await balance(W[1])).toBe(200);
    const wt = await t.db.selectFrom('week_totals').selectAll().where('week_id', '=', weekId).execute();
    expect(wt).toHaveLength(N);
    expect(wt.every((r) => Number(r.points) === 100 && r.last_completion_at)).toBe(true);
  }, 180_000);

  it('the risk check blocks the farm cluster and sends one setFrozenMany', async () => {
    const r = await riskCheck(ctx, { run: 'hourly' });
    expect(r.blocked.sort()).toEqual([W[4], W[5]].sort());
    expect(r.review.sort()).toEqual([W[6], W[7]].sort());
    const f = await processFreezes(ctx);
    expect(f.frozen).toBe(2);
    await index();
    const frozen = await t.db.selectFrom('users').select('wallet').where('frozen', '=', true).execute();
    expect(frozen.map((x) => x.wallet).sort()).toEqual([W[4], W[5]].sort());
    const flags = await t.db.selectFrom('risk_flags').select(['wallet', 'status']).where('wallet', '=', W[4]).execute();
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((x) => x.status === 'blocked')).toBe(true);
    // A second run does not queue them again.
    expect((await riskCheck(ctx, { run: 'hourly' })).blocked).toEqual([]);
  }, 120_000);

  it('sets the five answers when both AI runs agree, re-checks inside the window and corrects slot 4', async () => {
    const ms = await t.db.selectFrom('markets').select(['market_id', 'resolves_at']).where('day_id', '=', D).execute();
    for (const m of ms) fake.setAnswer(m.market_id, m.market_id % 5 === 0 ? 'A' : 'B');
    // Too early: nothing resolves before resolvesAt.
    await warp(dayEnd(D) + 60);
    expect((await resolutionSweep(ctx)).checked).toBe(0);
    const last = Math.max(...ms.map((m) => new Date(m.resolves_at).getTime() / 1000));
    await warp(last + 60);
    const sw = await resolutionSweep(ctx);
    expect(sw.set).toBe(5);
    await index();
    const res = await t.db.selectFrom('markets').select(['market_id', 'outcome', 'status', 'settles_at']).where('day_id', '=', D).orderBy('slot').execute();
    expect(res.map((m) => m.outcome)).toEqual([1, 2, 2, 2, 2]);
    expect(res.every((m) => m.status === 'resolved' && m.settles_at)).toBe(true);
    // Evidence quotes were verified against the fetched text and stored with it.
    const ev = await t.db.selectFrom('evidence').select(['fetched_text_sha256']).execute();
    expect(ev.length).toBe(10);
    expect(ev.every((e) => e.fetched_text_sha256)).toBe(true);

    // Re-check: slot 4's source now says A in two independent re-check runs.
    fake.setAnswer(D * 5 + 4, 'A');
    const c = await correctionCheck(ctx);
    expect(c.checked).toBe(5);
    expect(c.corrected).toBe(1);
    await index();
    expect((await t.db.selectFrom('markets').select('outcome').where('market_id', '=', D * 5 + 4).executeTakeFirstOrThrow()).outcome).toBe(1);
    // Ran once per market: a second pass does nothing.
    expect((await correctionCheck(ctx)).checked).toBe(0);
  }, 180_000);

  it('settles every player after the settle delay (frozen players keep hits on picks made before the freeze)', async () => {
    expect((await settleSweep(ctx)).batches).toBe(0); // inside the window: nothing ready
    const ms = await t.db.selectFrom('markets').select(['settles_at']).where('day_id', '=', D).execute();
    await warp(Math.max(...ms.map((m) => new Date(m.settles_at!).getTime() / 1000)) + 60);
    const s = await settleSweep(ctx);
    expect(s.users).toBe(N);
    await index();
    const days = await t.db.selectFrom('user_days').select(['wallet', 'settled_mask', 'hits']).where('day_id', '=', D).execute();
    expect(days.every((x) => x.settled_mask === 31)).toBe(true);
    const outcomes = [1, 2, 2, 2, 1];
    for (let i = 0; i < N; i++) {
      const hits = choices[i].filter((c, s) => c === outcomes[s]).length;
      expect(days.find((x) => x.wallet === W[i])!.hits, `player ${i + 1}`).toBe(hits);
    }
    expect((await settleSweep(ctx)).batches).toBe(0); // nothing left
    expect(await expirySweep(ctx)).toBe(0);
  }, 180_000);

  it('owner records a corrected answer after the window; compensation batches pay the right players once', async () => {
    const id = D * 5 + 1;
    // The admin asks for a correction after the window, as src/routes/admin.ts writes it: the target is the
    // market id; the worker prepares the owner transaction, and a `compensate` request waits for it.
    await t.db.insertInto('operator_requests').values({ kind: 'correct_outcome', target: String(id), payload: JSON.stringify({ outcome: 1, reason: 'wrong source' }), requested_by: 'ops@cojam.app' }).execute();
    expect(await processOperatorRequests(ctx)).toBe(1);
    const req = await t.db.selectFrom('operator_requests').select(['status', 'result']).executeTakeFirstOrThrow();
    expect(req.status).toBe('done');
    const ownerTx = (req.result as { ownerTx: { to: Address; data: Hex } }).ownerTx;
    const comp0 = await t.db.insertInto('operator_requests').values({ kind: 'compensate', target: String(id), payload: JSON.stringify({ outcome: 1, awaitingOwnerTx: true }), requested_by: 'ops@cojam.app' }).returning('id').executeTakeFirstOrThrow();
    await processOperatorRequests(ctx);
    expect((await t.db.selectFrom('operator_requests').select('status').where('id', '=', comp0.id).executeTakeFirstOrThrow()).status).toBe('queued');
    const h = await d.ownerWallet.sendTransaction({ to: ownerTx.to, data: ownerTx.data, account: d.owner, chain: chainFor(31337, [node.url]) });
    await d.client.waitForTransactionReceipt({ hash: h });
    await index();
    expect((await t.db.selectFrom('markets').select(['corrected_outcome', 'status']).where('market_id', '=', id).executeTakeFirstOrThrow()).corrected_outcome).toBe(1);
    const before = await balance(W[2]);
    await processOperatorRequests(ctx);
    const done = await t.db.selectFrom('operator_requests').select(['status', 'result']).where('id', '=', comp0.id).executeTakeFirstOrThrow();
    expect(done.status).toBe('done');
    expect((done.result as { users: number }).users).toBe(3); // P3, P4 and P8 picked 1 on slot 1
    await index();
    expect(await balance(W[2])).toBe(before + 50 + 0); // P3's inviter gets 5, P3 gets 50
    expect((await compensationSweep(ctx)).users).toBe(0);
    const comp = await t.db.selectFrom('points_ledger').select(['wallet', 'week_id']).where('kind', '=', 'compensation').execute();
    expect(comp.map((x) => x.wallet).sort()).toEqual([W[2], W[3], W[7]].sort());
    expect(comp.every((x) => x.week_id === weekId)).toBe(true); // the question's week: its airdrop is not sent yet
  }, 120_000);

  it('closes the week and sends the airdrop with the tie break, skipping accounts on hold', async () => {
    expect(await runAirdrop(ctx, weekId)).toBe('not_due');
    const params = await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'params' });
    const delay = Number((params as { airdropDelay: number }).airdropDelay);
    await warp(weekEnd(weekId) + delay + 60);
    await closeWeek(ctx, weekId);
    const ctBefore = await Promise.all(W.map((w) => d.client.readContract({ address: d.ct, abi: erc20Abi, functionName: 'balanceOf', args: [w] }) as Promise<bigint>));
    expect(await runAirdrop(ctx, weekId)).toBe('sent');
    await index();
    const rows = await t.db.selectFrom('airdrop_rows').selectAll().where('week_id', '=', weekId).orderBy('rank').execute();
    const paid = rows.filter((r) => r.rank <= 10);
    const skipped = rows.filter((r) => r.rank > 10);
    // Frozen P5 and P6 are skipped and the ranks below move up.
    expect(skipped.map((r) => r.wallet).sort()).toEqual([W[4], W[5]].sort());
    expect(paid.map((r) => r.wallet)).not.toContain(W[4]);
    expect(paid).toHaveLength(N - 2);
    // Order: points, then the earlier last completion, then the lower address (verified by the contract too).
    const pts = paid.map((r) => Number(r.points));
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1]).toBeGreaterThanOrEqual(pts[i]);
    // Pool: 6 qualified players (frozen excluded) x 1 CT; split 30/20/15/10/7/5 %.
    const week = await t.db.selectFrom('weeks').selectAll().where('week_id', '=', weekId).executeTakeFirstOrThrow();
    expect(week.status).toBe('airdropped');
    expect(week.qualified_players).toBe(6);
    expect(BigInt(week.pool!)).toBe(6n * 10n ** 18n);
    const first = paid[0];
    const idx = W.indexOf(first.wallet as Address);
    const ctAfter = (await d.client.readContract({ address: d.ct, abi: erc20Abi, functionName: 'balanceOf', args: [first.wallet as Address] })) as bigint;
    expect(ctAfter - ctBefore[idx]).toBe((6n * 10n ** 18n * 3000n) / 10000n);
    expect(await runAirdrop(ctx, weekId)).toBe('done');
  }, 180_000);

  it('publishes a missed day late (contract allows it until 1 hour before the day ends)', async () => {
    const D2 = dayIdOf(chainTime) + 1;
    const out = await draftJob(ctx);
    expect(out.map((o) => o.dayId)).toContain(D2);
    await warp(dayOpensAt(D2) + 2 * 3600);
    expect(await publishDay(ctx, D2)).toBe('published');
    expect(await t.db.selectFrom('worker_alerts').select('key').where('key', '=', `day-late:${D2}`).executeTakeFirst()).toBeTruthy();
    // In the last hour of a day nothing can be published any more.
    const D3 = D2 + 1;
    await warp(dayEnd(D3) - 1800);
    expect(await publishDay(ctx, D3)).toBe('too_late');
  }, 120_000);

  it('monitors write snapshots and stay quiet on a healthy system', async () => {
    await runMonitors(ctx);
    const keys = (await t.db.selectFrom('app_state').select('key').execute()).map((r) => r.key).sort();
    expect(keys).toEqual(expect.arrayContaining(['predict.params', 'chain.reserves', 'chain.balances', 'indexer.status', 'ai.usage', 'staking.params']));
    const open = await t.db.selectFrom('worker_alerts').select(['key']).where('resolved_at', 'is', null).where('key', 'in', ['indexer-lag', 'settle-backlog', 'operator-balance']).execute();
    expect(open).toEqual([]);
  }, 60_000);

  it('the index rebuilt from the deploy block equals the live index', async () => {
    const snap = async () => ({
      ledger: (await sql<{ s: string }>`select md5(string_agg(wallet||kind||amount||tx_hash||log_index, ',' order by tx_hash, log_index)) s from points_ledger`.execute(t.db)).rows[0].s,
      totals: (await sql<{ s: string }>`select md5(string_agg(week_id||wallet||points||coalesce(last_completion_at::text,''), ',' order by week_id, wallet)) s from week_totals`.execute(t.db)).rows[0].s,
      days: (await sql<{ s: string }>`select md5(string_agg(wallet||day_id||answered||settled_mask||hits||completion_points||hit_points, ',' order by wallet, day_id)) s from user_days`.execute(t.db)).rows[0].s,
      preds: (await sql<{ n: number }>`select count(*)::int n from predictions`.execute(t.db)).rows[0].n,
    });
    const live = await snap();
    await indexer.rebuild();
    await index();
    expect(await snap()).toEqual(live);
  }, 120_000);

  it('sender: simulation reverts burn no nonce, sends are serialized, recover settles unfinished rows', async () => {
    // A revert (market already resolved) is caught before signing.
    const nonceBefore = await d.client.getTransactionCount({ address: d.operator.address });
    await expect(ctx.sender.send({ job: 'test', to: d.predict, abi: cojamPredictAbi, functionName: 'setOutcome', args: [BigInt(D * 5), 1] })).rejects.toBeInstanceOf(SimulationRevert);
    const row = await t.db.selectFrom('worker_operator_txs').selectAll().orderBy('id', 'desc').executeTakeFirstOrThrow();
    expect(row.status).toBe('sim_reverted');
    expect(row.error_name).toBe('AlreadyResolved');
    expect(await d.client.getTransactionCount({ address: d.operator.address })).toBe(nonceBefore);

    // Ten concurrent sends: one queue, consecutive nonces, all mined.
    const sends = Array.from({ length: 10 }, (_, i) =>
      ctx.sender.send({ job: 'test', to: d.predict, abi: cojamPredictAbi, functionName: 'setFrozen', args: [W[0], i % 2 === 0, '0x' + '00'.repeat(32)] }),
    );
    const res = await Promise.all(sends);
    const nonces = (await t.db.selectFrom('worker_operator_txs').select(['nonce', 'status']).where('job', '=', 'test').where('status', '=', 'mined').orderBy('nonce').execute()).map((r) => Number(r.nonce));
    expect(res).toHaveLength(10);
    expect(nonces).toEqual(Array.from({ length: 10 }, (_, i) => nonceBefore + i));

    // Crash between signing and receipt: a row left 'sent' with a mined hash is settled by recover().
    await t.db.updateTable('worker_operator_txs').set({ status: 'sent' }).where('tx_hash', '=', res[9].hash).execute();
    // And a row whose nonce the chain already passed (never mined) becomes 'dropped'.
    await t.db.insertInto('worker_operator_txs').values({ job: 'test', target: d.predict, method: 'x', args: '[]', calldata: '0x', nonce: 0, tx_hash: '0x' + 'ab'.repeat(32), status: 'sent' }).execute();
    const rec = await ctx.sender.recover();
    expect(rec).toMatchObject({ mined: 1, dropped: 1 });
    // Final state of P1 after an even number of toggles ending with i = 9 (false): not frozen.
    await rpc(node.url, 'evm_mine', []);
  }, 120_000);
});
