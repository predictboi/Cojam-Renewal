// Longer questions on the real contracts (DECISIONS "Longer questions mixed in", CojamPredict.md 10.22):
// a day with four short questions and one long one answered 10 days after the close. The short ones are answered,
// the long one is neither answered nor voided at the old day wide deadline, the week's airdrop settles the week
// itself and does not wait for the long question, and the long question's hits, settled later by the regular
// settle job, count in the current week (the week of the day was already paid).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletClient, http, parseEther, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { answerDeadline, dayEnd, dayIdOf, dayOpensAt, weekEnd, weekOf } from '../../../shared/src/time.ts';
import { FakeProvider } from '../../src/ai/fake.ts';
import { CategoryIllustrationGenerator } from '../../src/ai/images.ts';
import { draftJob } from '../../src/jobs/ai.ts';
import { DEFAULT_SETTINGS, type JobContext } from '../../src/jobs/context.ts';
import { expirySweep, publishDay, resolutionSweep, settleSweep } from '../../src/jobs/markets.ts';
import { processRegistrations } from '../../src/jobs/registration.ts';
import { closeWeek, runAirdrop, weekBacklog } from '../../src/jobs/weekly.ts';
import { Indexer } from '../../src/indexer/indexer.ts';
import { Alerts } from '../../src/worker/alerts.ts';
import { chainFor, cojamPredictAbi, readPredictParams } from '../../src/worker/chain.ts';
import { silentLogger } from '../../src/worker/log.ts';
import { OperatorSender } from '../../src/worker/sender.ts';
import { createWorkerDb, deploy, postgresAvailable, startHardhat, warpTo, type Deployed, type Node, type TestDb } from './helpers/env.ts';

const pgProblem = await postgresAvailable();
const run = pgProblem ? describe.skip : describe;
if (pgProblem) console.warn(`long question integration tests skipped: Postgres unavailable (${pgProblem})`);

const N = 2;
const LONG_SLOT = 4;
const LONG_AFTER_CLOSE = 10 * 86400;

run('long question on Hardhat + Postgres', () => {
  let node: Node;
  let d: Deployed;
  let t: TestDb;
  let ctx: JobContext;
  let indexer: Indexer;
  let fake: FakeProvider;
  let chainTime = 0;
  const players = Array.from({ length: N }, () => privateKeyToAccount(generatePrivateKey()));
  const W = players.map((p) => p.address.toLowerCase() as Address);
  let D = 0;
  let weekId = 0;
  const longId = () => D * 5 + LONG_SLOT;

  const syncTime = async () => {
    chainTime = Number((await d.client.getBlock()).timestamp);
  };
  const warp = async (ts: number) => {
    await warpTo(node.url, ts);
    await syncTime();
  };
  const index = () => indexer.catchUp(100);

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
      settings: { ...DEFAULT_SETTINGS, draftHorizonDays: 1, poolMinDaysPlayed: 1, poolMinAccountAgeSec: 0, longQuestionsOnChain: true },
      now: () => chainTime,
    };
    indexer = new Indexer(t.db, d.client, { predict: d.predict, staking: d.staking, ct: d.ct, deployBlock: d.deployBlock, range: 50, minRange: 5, confirmations: 0 }, silentLogger);
    for (const w of W) {
      const h = await d.ownerWallet.sendTransaction({ to: w, value: parseEther('1'), account: d.owner, chain: chainFor(31337, [node.url]) });
      await d.client.waitForTransactionReceipt({ hash: h });
    }
    // Monday to Thursday, so the day's week ends (and its airdrop is due) before the long question is answered.
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

  it('reads maxResolveAfterClose from the contract (default 30 days)', async () => {
    const p = await readPredictParams(d.client, d.predict);
    expect(p.maxResolveAfterClose).toBe(30 * 86400);
  });

  it('registers two players, publishes a day with one long question, both players answer all five', async () => {
    for (let i = 0; i < N; i++) {
      await t.db
        .insertInto('users')
        .values({ privy_user_id: `did:privy:long:${i}`, wallet: W[i], email_hash: `lh${i}`, email_domain: 'gmail.com', device_id_first: `ldev-${i}`, ip_hash_first: `lip-${i}`, email_shape_hash: `lshape-${i}`, created_at: new Date((chainTime - 600) * 1000) })
        .execute();
      await t.db.insertInto('registration_requests').values({ kind: 'register', wallet: W[i], referrer: null }).execute();
    }
    expect((await processRegistrations(ctx)).registered).toHaveLength(N);
    await index();

    const out = await draftJob(ctx);
    expect(out[0].scheduled).toHaveLength(5);
    // Slot 4 becomes a long question (as an admin edit before publish would make it); publish rehashes the text.
    await t.db.updateTable('markets').set({ resolves_at: new Date((dayEnd(D) + LONG_AFTER_CLOSE) * 1000) }).where('market_id', '=', longId()).execute();
    expect(await publishDay(ctx, D)).toBe('published');
    await index();
    const onChain = (await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(longId())] })) as readonly unknown[];
    expect(Number(onChain[1])).toBe(dayEnd(D) + LONG_AFTER_CLOSE);

    await warp(dayOpensAt(D) + 3600);
    const chain = chainFor(31337, [node.url]);
    for (let i = 0; i < N; i++) {
      const wc = createWalletClient({ chain, transport: http(node.url), account: players[i] });
      for (let s = 0; s < 5; s++) {
        // Player 1 picks B everywhere (hits on every slot), player 2 picks A everywhere (no hit).
        const h = await wc.writeContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'predict', args: [BigInt(D * 5 + s), i === 0 ? 2 : 1], account: players[i], chain } as never);
        await d.client.waitForTransactionReceipt({ hash: h });
      }
    }
    await syncTime();
    await index();
    const days = await t.db.selectFrom('user_days').selectAll().where('day_id', '=', D).execute();
    // Completion does not wait for the long question.
    expect(days.every((x) => x.answered === 5 && x.completed)).toBe(true);
  }, 180_000);

  it('answers the short questions; the long one is neither answered early nor voided at the old day wide deadline', async () => {
    for (let s = 0; s < 5; s++) fake.setAnswer(D * 5 + s, 'B');
    const ms = await t.db.selectFrom('markets').select(['market_id', 'resolves_at']).where('day_id', '=', D).execute();
    const lastShort = Math.max(...ms.filter((m) => m.market_id !== longId()).map((m) => new Date(m.resolves_at).getTime() / 1000));
    await warp(lastShort + 60);
    expect((await resolutionSweep(ctx)).set).toBe(4);
    await index();
    // Past the old rule (day end + 48 h) and past every short deadline: the long market keeps its own deadline.
    await warp(Math.max(dayEnd(D) + 48 * 3600, answerDeadline(D, lastShort)) + 60);
    expect(await expirySweep(ctx)).toBe(0);
    expect((await resolutionSweep(ctx)).checked).toBe(0);
    const long = await t.db.selectFrom('markets').select(['outcome', 'status']).where('market_id', '=', longId()).executeTakeFirstOrThrow();
    expect(long).toEqual({ outcome: null, status: 'published' });
  }, 180_000);

  it('the airdrop settles its week first and does not wait for the long question', async () => {
    const p = await readPredictParams(d.client, d.predict);
    const due = weekEnd(weekId) + p.airdropDelay;
    expect(dayEnd(D) + LONG_AFTER_CLOSE).toBeGreaterThan(due);
    await warp(due + 60);
    await closeWeek(ctx, weekId);
    // Nothing settled yet: no settle sweep ran. The long market is not part of the backlog.
    expect((await weekBacklog(ctx, weekId, due)).unresolved).toBe(0);
    // First round: settles the week's four ready markets; the index has not seen those settles yet.
    expect(await runAirdrop(ctx, weekId)).toBe('backlog');
    await index();
    const settled = await t.db.selectFrom('user_days').select(['wallet', 'settled_mask', 'hits']).where('day_id', '=', D).execute();
    expect(settled.every((x) => x.settled_mask === 0b01111)).toBe(true);
    expect(await runAirdrop(ctx, weekId)).toBe('sent');
    await index();
    const hits = await t.db.selectFrom('points_ledger').select(['wallet', 'amount', 'week_id']).where('kind', '=', 'hits').where('day_id', '=', D).execute();
    expect(hits).toEqual([{ wallet: W[0], amount: 4 * p.hitPoints, week_id: weekId }]);
  }, 180_000);

  it('the long question is answered later and its hit lands in the current week', async () => {
    const resolvesAt = dayEnd(D) + LONG_AFTER_CLOSE;
    await warp(resolvesAt + 60);
    expect((await resolutionSweep(ctx)).set).toBe(1);
    await index();
    const m = await t.db.selectFrom('markets').select(['outcome', 'settles_at']).where('market_id', '=', longId()).executeTakeFirstOrThrow();
    expect(m.outcome).toBe(2);
    await warp(new Date(m.settles_at!).getTime() / 1000 + 60);
    const s = await settleSweep(ctx);
    expect(s.users).toBe(N);
    await index();
    const p = await readPredictParams(d.client, d.predict);
    const late = await t.db.selectFrom('points_ledger').select(['wallet', 'amount', 'week_id']).where('kind', '=', 'hits').where('day_id', '=', D).where('week_id', '!=', weekId).execute();
    expect(late).toEqual([{ wallet: W[0], amount: p.hitPoints, week_id: weekOf(dayIdOf(chainTime)) }]);
    expect(weekOf(dayIdOf(chainTime))).toBeGreaterThan(weekId);
    const days = await t.db.selectFrom('user_days').select(['settled_mask']).where('day_id', '=', D).execute();
    expect(days.every((x) => x.settled_mask === 31)).toBe(true);
    expect((await settleSweep(ctx)).batches).toBe(0);
  }, 180_000);
});
