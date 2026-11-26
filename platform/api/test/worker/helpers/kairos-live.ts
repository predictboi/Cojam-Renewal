// Live end to end run against the deployed Kairos contracts (platform/shared/addresses/kairos.json),
// with BOTH real processes: the API (fee payer = the Kairos test key) and the worker (operator = the
// same key, which holds OPERATOR_ROLE there). It exercises what a local node cannot: real Kaia fee
// delegated 0x31 transactions through POST /v1/tx/sponsor (setPlayKey by the wallet, five predicts by
// the play key, no bearer). Spends a few hundredths of a KAIA. The key is read from contracts/.env by
// code and passed to the child processes in their environment; it is never printed.
//
//   npx tsx test/worker/helpers/kairos-live.ts
// Needs today's day to exist on Kairos (created by the deploy agent's live run, or by the worker) and
// at least 1 hour left in the UTC day. Uses a throwaway Postgres database.

import { readFileSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { createPublicClient, encodeFunctionData, http, formatEther, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import addrs from '../../../../shared/addresses/kairos.json' with { type: 'json' };
import { dayEnd, dayIdOf } from '../../../../shared/src/time.ts';
import { devIdentity, devWalletKey } from '../../../src/auth/privy.ts';
import { signSenderTx } from '../../../src/feeDelegation/decode.ts';
import { cojamPredictAbi } from '../../../src/worker/chain.ts';
import { createWorkerDb } from './env.ts';

const envFile = Object.fromEntries(
  readFileSync(new URL('../../../../../contracts/.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = (envFile.PRIVATE_KEY.startsWith('0x') ? envFile.PRIVATE_KEY : `0x${envFile.PRIVATE_KEY}`) as Hex;
const RPC = envFile.KAIROS_RPC_URL || 'https://public-en-kairos.node.kaia.io';
const client = createPublicClient({ transport: http(RPC), cacheTime: 0 });
const keyAddr = privateKeyToAccount(KEY).address;
if (keyAddr.toLowerCase() !== addrs.operator.toLowerCase()) throw new Error('the test key is not the Kairos operator');
const balanceBefore = await client.getBalance({ address: keyAddr });

const head = Number(await client.getBlockNumber());
const now = Number((await client.getBlock()).timestamp);
const dayId = dayIdOf(now);
if (dayEnd(dayId) - now < 3600) throw new Error('less than 1 hour left in the UTC day');
const t = await createWorkerDb();
const out: Record<string, unknown> = { network: 'kairos', predict: addrs.predict, dayId };

// Today's five markets as the worker would have stored them (the text is a placeholder: this run checks
// chain plumbing, not drafting). The index starts near the head, so their DayCreated is not replayed.
for (let slot = 0; slot < 5; slot++) {
  const id = dayId * 5 + slot;
  const m = (await client.readContract({ address: addrs.predict as Address, abi: cojamPredictAbi, functionName: 'markets', args: [BigInt(id)] })) as readonly unknown[];
  if (Number(m[0]) === 0) throw new Error(`day ${dayId} is not on Kairos`);
  const text = (lang: string) => ({ title: `Kairos live check ${slot + 1} (${lang})`, left: 'No', right: 'Yes', rule: 'Test market', settle: 'tomorrow' });
  await t.db
    .insertInto('markets')
    .values({
      market_id: id,
      day_id: dayId,
      slot,
      category: 'Crypto',
      content: JSON.stringify({ en: text('en'), ko: text('ko'), ja: text('ja') }),
      closes_at: new Date(Number(m[0]) * 1000),
      resolves_at: new Date(Number(m[1]) * 1000),
      sources: JSON.stringify([{ name: 'test', url: 'https://example.com', role: 'primary' }]),
      content_hash: String(m[6]).toLowerCase(),
      image_state: 'fallback',
      image_url: '/assets/img/q1-bitcoin.svg',
      status: 'published',
    })
    .execute();
}

const port = 19900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const common = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  DATABASE_URL: t.url,
  NETWORK: 'kairos',
  CHAIN_ID: '1001',
  KAIA_RPC_URL: RPC,
  CT_ADDRESS: addrs.ct,
  PREDICT_ADDRESS: addrs.predict,
  STAKING_ADDRESS: addrs.staking,
  PREDICT_DEPLOY_BLOCK: String(head - 20),
  STAKING_DEPLOY_BLOCK: String(head - 20),
  EMAIL_HASH_KEY: 'kairos-live-email',
  IP_HASH_SALT: 'kairos-live-ip',
};
const logs: string[] = [];
const start = (name: string, script: string, env: Record<string, string>): ChildProcess => {
  const p = spawn(process.execPath, ['--import', 'tsx', script], { env: { ...process.env, ...env, ANTHROPIC_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout!.on('data', (b) => logs.push(`[${name}] ${b}`));
  p.stderr!.on('data', (b) => logs.push(`[${name}] ${b}`));
  return p;
};
const api = start('api', 'src/server/main.ts', { ...common, PORT: String(port), HOST: '127.0.0.1', AUTH_DEV_BYPASS: '1', ADMIN_OWNER_EMAIL: 'dev@cojam.app', APP_FEE_PAYER_PRIVATE_KEY: KEY });
const worker = start('worker', 'src/worker/main.ts', { ...common, OPERATOR_PRIVATE_KEY: KEY, AI_ENABLED: '0' });

const until = async <T>(what: string, fn: () => Promise<T | null | false | undefined>, ms = 120_000): Promise<T> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out: ${what}`);
};

try {
  const user = `kairoslive${Date.now() % 1_000_000}`;
  const me = devIdentity(user);
  const H = { 'x-dev-user': user, 'content-type': 'application/json', 'x-device-id': 'kairos-live-0001' };
  const get = async (p: string, h: Record<string, string> = H) => (await fetch(base + p, { headers: h })).json() as Promise<any>;
  const post = async (p: string, b: unknown, h: Record<string, string> = H) => (await fetch(base + p, { method: 'POST', headers: h, body: JSON.stringify(b) })).json() as Promise<any>;
  await until('API health', async () => (await fetch(`${base}/v1/health`)).ok, 60_000);
  const cfg = await get('/v1/config');

  out.emailCheck = await post('/v1/auth/email-check', { email: me.email });
  out.sessionFirst = (await post('/v1/session', {})).registration;
  const reg = await until('registration mined by the worker', async () => {
    const s = await get('/v1/session');
    return s.registration === 'registered' ? s : null;
  });
  out.registration = reg.registration;
  out.registerTx = (await t.db.selectFrom('registration_requests').select('tx_hash').where('wallet', '=', me.wallet).executeTakeFirst())?.tx_hash;

  const gasPrice = await client.getGasPrice();
  const walletKey = devWalletKey(user);
  const wallet = privateKeyToAccount(walletKey).address;
  const playKey = generatePrivateKey();
  const keyAccount = privateKeyToAccount(playKey).address;
  const setKey = await signSenderTx(walletKey, {
    from: wallet,
    to: cfg.contracts.predict as Address,
    data: encodeFunctionData({ abi: cojamPredictAbi, functionName: 'setPlayKey', args: [keyAccount, BigInt(now + 30 * 86400)] }),
    gasLimit: cfg.gasLimits.setPlayKey,
    gasPrice,
    chainId: 1001,
    nonce: await client.getTransactionCount({ address: wallet }),
  });
  const sk = await post('/v1/tx/sponsor', { rawTransaction: setKey });
  out.setPlayKey = sk;
  if (!sk.txHash) throw new Error(`setPlayKey refused: ${JSON.stringify(sk)}`);
  await until('setPlayKey mined', async () => (await get(`/v1/tx/${sk.txHash}`)).status === 'mined');

  const today = await get('/v1/today');
  const picks = [2, 1, 2, 1, 2];
  const predicts: unknown[] = [];
  for (const [i, m] of today.markets.entries()) {
    const raw = await signSenderTx(playKey, {
      from: keyAccount,
      to: cfg.contracts.predict as Address,
      data: encodeFunctionData({ abi: cojamPredictAbi, functionName: 'predict', args: [BigInt(m.marketId), picks[i]] }),
      gasLimit: cfg.gasLimits.predict,
      gasPrice,
      chainId: 1001,
      nonce: i,
    });
    // No bearer token: a play key predict is sponsored on the strength of its on chain binding.
    const r = await post('/v1/tx/sponsor', { rawTransaction: raw }, { 'content-type': 'application/json' });
    predicts.push({ marketId: m.marketId, ...r });
    if (!r.txHash) throw new Error(`predict refused: ${JSON.stringify(r)}`);
    await until(`predict ${m.marketId} mined`, async () => (await get(`/v1/tx/${r.txHash}`)).status === 'mined');
  }
  out.predicts = predicts;
  const played = await until('index caught up', async () => {
    const x = await get('/v1/today');
    return x.answered === 5 && x.completion ? x : null;
  });
  out.today = { answered: played.answered, completed: played.completed, completion: played.completion, choices: played.markets.map((m: any) => m.myChoice) };
  const results = await get('/v1/results');
  out.results = { summary: results.summary, day: results.days?.[0] && { dayId: results.days[0].dayId, answered: results.days[0].answered, completionPoints: results.days[0].completionPoints, rows: results.days[0].rows.map((r: any) => r.result) } };
  const ranking = await get('/v1/ranking/week/current');
  out.ranking = { weekId: ranking.weekId, me: ranking.me, poolWei: ranking.poolWei, qualifiedPlayers: ranking.qualifiedPlayers };
  const w = await get('/v1/wallet');
  out.wallet = { points: w.points, pendingHitPoints: w.pendingHitPoints };
  const ov = await get('/admin/v1/overview', { 'x-dev-admin': 'dev@cojam.app' });
  out.adminOverview = ov;
  const opTxs = await t.db.selectFrom('worker_operator_txs').select(['method', 'status', 'tx_hash', 'fee_wei']).execute();
  out.workerTxs = opTxs;
  out.spentKaia = formatEther(balanceBefore - (await client.getBalance({ address: keyAddr })));
  console.log(JSON.stringify(out, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
} catch (e) {
  console.error('LIVE RUN FAILED:', (e as Error).message);
  console.error(logs.filter((l) => !l.includes('"level":30')).slice(-40).join(''));
  process.exitCode = 1;
} finally {
  api.kill('SIGTERM');
  worker.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 2000));
  await t.drop().catch(() => undefined);
}
