// End to end with BOTH real processes: `src/server/main.ts` (cojam-app-api) and `src/worker/main.ts`
// (cojam-app-worker), started as child processes against a local Hardhat node with the real contracts
// and a fresh Postgres database.
//
// What a local node cannot do: Hardhat does not know Kaia's fee delegated type 0x31, so the player's
// `setPlayKey` and five `predict` calls are sent here as ordinary transactions from the player's dev
// wallet and play key (the same calldata the PWA signs). The sponsored 0x31 path through
// `/v1/tx/sponsor` is exercised live against Kairos by `test/worker/helpers/kairos-live.ts`.
//
// Dev switches used (all refused when NODE_ENV=production): AUTH_DEV_BYPASS (X-Dev-User instead of a
// Privy token), AI_PROVIDER=fake (deterministic drafts and answers), WORKER_CLOCK=chain (the worker
// follows the node's clock, which the test moves forward). Scheduled jobs are triggered at once with
// `operator_requests` kind `run_job` instead of waiting for their cron minute.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createWalletClient, http, parseEther, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { dayEnd, dayIdOf } from '../../../shared/src/time.ts';
import { devIdentity, devWalletKey } from '../../src/auth/privy.ts';
import { chainFor, cojamPredictAbi } from '../../src/worker/chain.ts';
import { createWorkerDb, deploy, HH_KEYS, postgresAvailable, warpTo, type Deployed, type Node, type TestDb, startHardhat } from './helpers/env.ts';

const pgProblem = await postgresAvailable();
// Needs at least 2 hours left in the current UTC day (the day is created late, then played).
const nowS = Math.floor(Date.now() / 1000);
const hoursLeft = (dayEnd(dayIdOf(nowS)) - nowS) / 3600;
const run = pgProblem || hoursLeft < 2 ? describe.skip : describe;
if (hoursLeft < 2) console.warn('e2e processes test skipped: less than 2 hours left in the UTC day');

function startService(name: string, script: string, env: Record<string, string>, logs: string[]): ChildProcess {
  const p = spawn(process.execPath, ['--import', 'tsx', script], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const push = (b: Buffer) => logs.push(...String(b).split('\n').filter(Boolean).map((l) => `[${name}] ${l}`));
  p.stdout!.on('data', push);
  p.stderr!.on('data', push);
  return p;
}

async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${(last as Error).message}` : ''}`);
}

run('end to end: API process + worker process + Hardhat + Postgres', () => {
  let node: Node;
  let d: Deployed;
  let t: TestDb;
  let api: ChildProcess;
  let worker: ChildProcess;
  const logs: string[] = [];
  const port = 19000 + Math.floor(Math.random() * 900);
  const base = `http://127.0.0.1:${port}`;
  const user = `e2e${Date.now() % 1_000_000}`;
  const me = devIdentity(user);
  const H = { 'x-dev-user': user, 'content-type': 'application/json', 'x-device-id': 'e2e-device-0001' };
  const A = { 'x-dev-admin': 'dev@cojam.app' };
  const get = async (p: string, h: Record<string, string> = H) => {
    const r = await fetch(base + p, { headers: h });
    const j = await r.json();
    if (!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(j)}`);
    return j as any;
  };
  const post = async (p: string, body: unknown, h: Record<string, string> = H) => {
    const r = await fetch(base + p, { method: 'POST', headers: h, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(j)}`);
    return j as any;
  };
  const runJob = async (job: string) => {
    const r = await t.db.insertInto('operator_requests').values({ kind: 'run_job', target: job, payload: '{}', requested_by: 'e2e' }).returning('id').executeTakeFirstOrThrow();
    return until(`job ${job}`, async () => {
      const row = await t.db.selectFrom('operator_requests').select(['status', 'result']).where('id', '=', r.id).executeTakeFirstOrThrow();
      if (row.status === 'failed') throw Object.assign(new Error(`job ${job} failed: ${JSON.stringify(row.result)}`), { fatal: true });
      return row.status === 'done' ? row : null;
    }, 90_000);
  };

  beforeAll(async () => {
    node = await startHardhat();
    d = await deploy(node.url);
    t = await createWorkerDb();
    const common = {
      NODE_ENV: 'development',
      LOG_LEVEL: 'warn',
      DATABASE_URL: t.url,
      NETWORK: 'local',
      CHAIN_ID: '31337',
      KAIA_RPC_URL: node.url,
      CT_ADDRESS: d.ct,
      PREDICT_ADDRESS: d.predict,
      PREDICT_DEPLOY_BLOCK: String(d.deployBlock),
      STAKING_ADDRESS: d.staking,
      STAKING_DEPLOY_BLOCK: String(d.deployBlock),
      EMAIL_HASH_KEY: 'e2e-email-key',
      IP_HASH_SALT: 'e2e-ip-salt',
    };
    api = startService('api', 'src/server/main.ts', { ...common, PORT: String(port), HOST: '127.0.0.1', AUTH_DEV_BYPASS: '1', ADMIN_OWNER_EMAIL: 'dev@cojam.app', APP_FEE_PAYER_PRIVATE_KEY: HH_KEYS[2] }, logs);
    worker = startService('worker', 'src/worker/main.ts', { ...common, OPERATOR_PRIVATE_KEY: HH_KEYS[1], AI_PROVIDER: 'fake', WORKER_CLOCK: 'chain', DRAFT_HORIZON_DAYS: '1' }, logs);
    await until('API health', async () => (await fetch(`${base}/v1/health`)).ok, 60_000);
    // Gas for the player's wallet (sponsorship is the API's job on Kaia; Hardhat has no 0x31).
    const h = await d.ownerWallet.sendTransaction({ to: me.wallet, value: parseEther('1'), account: d.owner, chain: chainFor(31337, [node.url]) });
    await d.client.waitForTransactionReceipt({ hash: h });
  }, 180_000);

  afterAll(async () => {
    api?.kill('SIGTERM');
    worker?.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    await t?.drop().catch(() => undefined);
    node?.stop();
    if (process.env.E2E_LOGS) console.log(logs.join('\n'));
  });

  it('signs up through the API and the worker registers the player on chain', async () => {
    const check = await post('/v1/auth/email-check', { email: me.email });
    expect(check.allowed).toBe(true);
    const s = await post('/v1/session', {});
    expect(s.registration).toBe('pending');
    const reg = await until('registration mined', async () => {
      const x = await get('/v1/session');
      return x.registration === 'registered' ? x : null;
    }, 60_000);
    expect(reg.registration).toBe('registered');
    const onChain = (await d.client.readContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'players', args: [me.wallet] })) as readonly unknown[];
    expect(onChain[2]).toBe(true);
    const u = await t.db.selectFrom('users').select(['email_shape_hash', 'registered_at']).where('wallet', '=', me.wallet).executeTakeFirstOrThrow();
    expect(u.email_shape_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(u.registered_at).toBeTruthy();
  }, 90_000);

  it('the worker drafts (fake AI) and publishes today late; the API serves the five questions', async () => {
    const r = await runJob('publish-late');
    expect((r.result as unknown) as string).toBe('published');
    const today = await until('today published', async () => {
      const x = await get('/v1/today');
      return x.published && x.markets.length === 5 ? x : null;
    });
    expect(today.markets.every((m: any) => m.text.en.title && m.text.ko.title && m.text.ja.title)).toBe(true);
    expect(today.markets.every((m: any) => m.closesAt === dayEnd(today.dayId))).toBe(true);
    if (process.env.E2E_SHOW) console.log(today.markets.map((m: any) => [m.category, m.imageUrl]));
    expect(today.markets.filter((m: any) => m.category !== 'culture').every((m: any) => typeof m.imageUrl === 'string' && m.imageUrl.startsWith('/assets/img/'))).toBe(true);
  }, 120_000);

  it('plays all five with a play key; the worker answers, settles, and every read endpoint shows it', async () => {
    const chain = chainFor(31337, [node.url]);
    const walletAcct = privateKeyToAccount(devWalletKey(user));
    const key = privateKeyToAccount(generatePrivateKey());
    const wallet = createWalletClient({ chain, transport: http(node.url), account: walletAcct });
    const keyWallet = createWalletClient({ chain, transport: http(node.url), account: key });
    const now = Number((await d.client.getBlock()).timestamp);
    await d.client.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'setPlayKey', args: [key.address, BigInt(now + 30 * 86400)], account: walletAcct, chain } as never) });
    await d.client.waitForTransactionReceipt({ hash: await wallet.sendTransaction({ to: key.address, value: parseEther('0.1'), account: walletAcct, chain }) });
    const today = await get('/v1/today');
    const picks = [1, 2, 1, 2, 2];
    for (const [i, m] of today.markets.entries()) {
      await d.client.waitForTransactionReceipt({ hash: await keyWallet.writeContract({ address: d.predict, abi: cojamPredictAbi, functionName: 'predict', args: [BigInt(m.marketId), picks[i]], account: key, chain } as never) });
    }
    const played = await until('answers indexed', async () => {
      const x = await get('/v1/today');
      return x.answered === 5 && x.completed && x.completion ? x : null;
    });
    expect(played.markets.map((m: any) => m.myChoice)).toEqual(picks);
    expect(played.completion?.points).toBe(100);

    // Answers: move the node past every resolvesAt, run the resolution sweep (two fake AI runs agree).
    const resolvesAt = Math.max(...today.markets.map((m: any) => m.resolvesAt));
    await warpTo(node.url, resolvesAt + 60);
    await new Promise((r) => setTimeout(r, 1500)); // the worker's chain clock refreshes every second
    await runJob('resolution');
    const settlesAt = await until('outcomes indexed', async () => {
      const ms = await t.db.selectFrom('markets').select(['outcome', 'settles_at']).where('day_id', '=', today.dayId).execute();
      return ms.every((m) => m.outcome && m.settles_at) ? Math.max(...ms.map((m) => new Date(m.settles_at!).getTime() / 1000)) : null;
    });
    await warpTo(node.url, settlesAt + 60);
    await new Promise((r) => setTimeout(r, 1500));
    await runJob('settle');

    // Fake answers: even market id -> A (1), odd -> B (2).
    const outcomes = today.markets.map((m: any) => (Number(m.marketId) % 2 === 0 ? 1 : 2));
    const hits = picks.filter((p, i) => p === outcomes[i]).length;
    const results = await until('settled results', async () => {
      const x = await get('/v1/results');
      const day = x.days.find((dd: any) => dd.dayId === today.dayId);
      return day && day.rows.every((r: any) => r.hitState !== 'pending' && r.result !== 'pending') ? x : null;
    });
    const day = results.days.find((dd: any) => dd.dayId === today.dayId);
    expect(day.completionPoints).toBe(100);
    expect(day.hits).toBe(hits);
    expect(day.rows.map((r: any) => r.outcome)).toEqual(outcomes);
    expect(day.rows.filter((r: any) => r.result === 'hit')).toHaveLength(hits);

    const wallet2 = await get('/v1/wallet');
    expect(wallet2.points).toBe(100 + hits * 50);
    const ranking = await get('/v1/ranking/week/current');
    expect(ranking.me.points).toBe(100 + hits * 50);
    expect(ranking.me.rank).toBe(1);

    await runJob('week-pool');
    const week = await t.db.selectFrom('weeks').selectAll().where('week_id', '=', ranking.weekId).executeTakeFirstOrThrow();
    // One player with one completed day: not qualified yet (3 completed days and 7 days of age needed).
    expect(week.qualified_players).toBe(0);

    await runJob('monitors');
    const overview = await get('/admin/v1/overview', A);
    expect(overview).toBeTruthy();
    if (process.env.E2E_SHOW) console.log(JSON.stringify({ today: played.markets.map((m: any) => [m.marketId, m.myChoice]), day, wallet: wallet2, ranking, overview }, null, 2));
  }, 240_000);
});
