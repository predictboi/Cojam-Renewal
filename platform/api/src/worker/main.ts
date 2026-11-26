// cojam-app-worker entry (`npm run start:worker`). Exactly one instance: it owns the operator key's
// nonce, which a Postgres advisory lock enforces (a second instance exits). It runs the indexer, the
// registration, freeze and admin request loops in process, and every scheduled job on pg-boss.

import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { PgBoss } from 'pg-boss';
import { privateKeyToAccount } from 'viem/accounts';
import { loadConfig, kaiaToWei } from '../config/index.ts';
import { createPool } from '../db/index.ts';
import { migrate } from '../db/migrate.ts';
import { AnthropicProvider } from '../ai/anthropic.ts';
import { CategoryIllustrationGenerator } from '../ai/images.ts';
import type { AiProvider } from '../ai/provider.ts';
import { DEFAULT_SETTINGS, type JobContext, type WorkerSettings } from '../jobs/context.ts';
import { processRegistrations } from '../jobs/registration.ts';
import { processOperatorRequests } from '../jobs/requests.ts';
import { CRON_JOBS, LOOPS, RISK_SIGNUP_QUEUE } from '../jobs/schedule.ts';
import { Indexer } from '../indexer/indexer.ts';
import { processFreezes, riskCheck } from '../risk/check.ts';
import { Alerts, EmailStubSink, LogSink, TelegramSink, type AlertSink } from './alerts.ts';
import { createChainClient, type Address } from './chain.ts';
import type { WorkerDatabase } from './db.ts';
import { createLogger } from './log.ts';
import { OperatorSender } from './sender.ts';

const WORKER_LOCK_ID = 861_520_99;

function intEnv(name: string, def: number): number {
  const v = process.env[name];
  return v === undefined || v === '' ? def : Number(v);
}

/** Worker only settings read from the environment (names listed in WORKER.md). */
export function workerSettings(env: NodeJS.ProcessEnv, base: Partial<WorkerSettings> = {}): WorkerSettings {
  const ct = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;
  return {
    ...DEFAULT_SETTINGS,
    ...base,
    draftHorizonDays: intEnv('DRAFT_HORIZON_DAYS', DEFAULT_SETTINGS.draftHorizonDays),
    draftCandidates: intEnv('DRAFT_CANDIDATES', DEFAULT_SETTINGS.draftCandidates),
    settleBatch: Math.min(200, intEnv('SETTLE_BATCH', DEFAULT_SETTINGS.settleBatch)),
    registerBatch: Math.min(200, intEnv('REGISTER_BATCH', DEFAULT_SETTINGS.registerBatch)),
    compensateBatch: Math.min(500, intEnv('COMPENSATE_BATCH', DEFAULT_SETTINGS.compensateBatch)),
    poolPerPlayerWei: ct(Number(env.WEEKLY_POOL_PER_PLAYER_CT ?? 1)),
    poolCapWei: ct(Number(env.WEEKLY_POOL_CAP_CT ?? 10_000)),
    aiEnabled: env.AI_ENABLED !== '0' && env.AI_ENABLED !== 'false',
  };
}

async function main() {
  const cfg = loadConfig(process.env, 'worker');
  const log = createLogger(cfg.env.LOG_LEVEL, { service: 'cojam-app-worker', network: cfg.network });
  const pool: pg.Pool = createPool(cfg.databaseUrl, 10);

  // One worker only: hold an advisory lock on a dedicated connection for the life of the process.
  const lockClient = await pool.connect();
  const got = await lockClient.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [WORKER_LOCK_ID]);
  if (!got.rows[0].ok) {
    log.error('another worker holds the lock; exiting (the worker must run as exactly one instance)');
    process.exit(1);
  }
  await migrate(pool, (m) => log.info(m));
  const db = new Kysely<WorkerDatabase>({ dialect: new PostgresDialect({ pool }) });

  const { predict, staking, ct } = cfg.addresses;
  if (!predict || !ct) throw new Error('PREDICT_ADDRESS and CT_ADDRESS are required');
  if (!cfg.env.OPERATOR_PRIVATE_KEY) throw new Error('OPERATOR_PRIVATE_KEY is required');
  const client = createChainClient(cfg.chainId, cfg.rpcUrls);
  const account = privateKeyToAccount(cfg.env.OPERATOR_PRIVATE_KEY as `0x${string}`);
  const sender = new OperatorSender(client, account, db, log.child({ part: 'sender' }), {
    chainId: cfg.chainId,
    txType: process.env.OPERATOR_TX_TYPE === 'eip1559' ? 'eip1559' : 'legacy',
    maxGasPriceWei: BigInt(Math.round(cfg.env.MAX_GAS_PRICE_GKEI * 1e9)),
    minBalanceWei: kaiaToWei(cfg.env.MIN_OPERATOR_BALANCE_KAIA) / 2n,
  });
  log.info('worker starting', { operator: sender.address, predict, staking, chainId: cfg.chainId });
  const rec = await sender.recover();
  if (rec.mined + rec.dropped + rec.rebroadcast) log.info('sender: recovered unfinished transactions', rec);
  await db.updateTable('operator_requests').set({ status: 'failed', result: JSON.stringify({ error: 'interrupted by a worker restart; request again' }) }).where('status', '=', 'running').execute();

  const sinks: AlertSink[] = [new LogSink(log.child({ part: 'alerts' }))];
  if (cfg.env.ALERT_TELEGRAM_BOT_TOKEN && cfg.env.ALERT_TELEGRAM_CHAT_ID) sinks.push(new TelegramSink(cfg.env.ALERT_TELEGRAM_BOT_TOKEN, cfg.env.ALERT_TELEGRAM_CHAT_ID));
  if (cfg.env.ALERT_EMAIL) sinks.push(new EmailStubSink(cfg.env.ALERT_EMAIL, log));
  const alerts = new Alerts(db, log, sinks);

  const settings = workerSettings(process.env, {
    riskBlockAt: cfg.env.RISK_BLOCK_SCORE,
    riskReviewAt: cfg.env.RISK_REVIEW_SCORE,
    minOperatorBalanceWei: kaiaToWei(cfg.env.MIN_OPERATOR_BALANCE_KAIA),
    minFeePayerBalanceWei: kaiaToWei(cfg.env.MIN_FEE_PAYER_BALANCE_KAIA),
    feePayerAddress: (process.env.APP_FEE_PAYER_ADDRESS?.toLowerCase() as Address | undefined) ?? null,
    aiMonthlyBudgetUsd: cfg.env.AI_MONTHLY_BUDGET_USD,
  });
  let ai: AiProvider;
  if (cfg.env.ANTHROPIC_API_KEY && settings.aiEnabled) {
    ai = new AnthropicProvider({ apiKey: cfg.env.ANTHROPIC_API_KEY, model: cfg.env.AI_MODEL });
  } else {
    settings.aiEnabled = false;
    ai = { name: 'disabled', model: 'none', complete: async () => Promise.reject(new Error('AI is disabled (no ANTHROPIC_API_KEY)')) };
    log.warn('AI disabled: drafting and answer setting will not run');
  }

  const ctx: JobContext = {
    db,
    client,
    sender,
    contracts: { predict, staking: staking ?? null, ct },
    log,
    alerts,
    ai,
    images: { generator: new CategoryIllustrationGenerator(), store: null },
    adapters: [],
    settings,
    now: () => Math.floor(Date.now() / 1000),
  };

  const indexer = new Indexer(db, client, { predict, staking: staking ?? null, ct, deployBlock: cfg.deployBlocks.predict, range: intEnv('INDEXER_RANGE', 2_000), minRange: 10, confirmations: intEnv('INDEXER_CONFIRMATIONS', 0) }, log.child({ part: 'indexer' }));
  indexer.onOwnerActivity = async (items) => {
    for (const it of items) await alerts.raise(`owner:${it.txHash}:${it.event}`, 'warn', `Owner activity: ${it.event}`, `tx ${it.txHash}`, it.args);
  };

  // pg-boss for the scheduled jobs.
  const boss = new PgBoss({ connectionString: cfg.databaseUrl, schema: 'pgboss', ...(/render\.com|sslmode=require/.test(cfg.databaseUrl) ? { ssl: { rejectUnauthorized: false } } : {}) });
  boss.on('error', (e: Error) => log.error('pg-boss error', { error: e.message }));
  await boss.start();
  const status: Record<string, { lastRunAt?: string; lastOkAt?: string; lastError?: string | null; tookMs?: number }> = {};
  const record = async (name: string, started: number, error: Error | null) => {
    status[name] = { ...status[name], lastRunAt: new Date(started).toISOString(), tookMs: Date.now() - started, lastError: error ? error.message.slice(0, 300) : null, ...(error ? {} : { lastOkAt: new Date().toISOString() }) };
    await db.insertInto('app_state').values({ key: 'worker.jobs', value: JSON.stringify(status) }).onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(status), updated_at: new Date() })).execute().catch(() => undefined);
  };
  for (const job of CRON_JOBS) {
    await boss.createQueue(job.name, { policy: 'exclusive', retryLimit: 0, expireInSeconds: 3_600 }).catch(() => undefined);
    await boss.schedule(job.name, job.cron, null, { tz: 'UTC' });
    await boss.work(job.name, { localConcurrency: 1 }, async () => {
      const t = Date.now();
      try {
        const r = await job.run(ctx);
        await record(job.name, t, null);
        return r === undefined ? null : JSON.parse(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
      } catch (e) {
        log.error(`job ${job.name} failed`, { error: (e as Error).message });
        await record(job.name, t, e as Error);
        throw e;
      }
    });
  }
  await boss.createQueue(RISK_SIGNUP_QUEUE, { retryLimit: 3, retryDelay: 30 }).catch(() => undefined);
  await boss.work<{ wallets: string[] }>(RISK_SIGNUP_QUEUE, { localConcurrency: 1, batchSize: 20 }, async (jobs) => {
    const wallets = [...new Set(jobs.flatMap((j) => j.data.wallets ?? []))];
    if (wallets.length) await riskCheck(ctx, { run: 'signup', wallets });
  });

  // In process loops.
  let stopping = false;
  const loop = (name: string, every: number, fn: () => Promise<unknown>) => {
    let failures = 0;
    const tick = async () => {
      if (stopping) return;
      const t = Date.now();
      try {
        await fn();
        failures = 0;
        status[name] = { ...status[name], lastOkAt: new Date().toISOString(), lastError: null };
      } catch (e) {
        failures++;
        status[name] = { ...status[name], lastError: (e as Error).message.slice(0, 300) };
        log.warn(`loop ${name} failed`, { error: (e as Error).message, failures });
        if (failures === 10) await alerts.raise(`loop-failing:${name}`, 'critical', `Worker loop ${name} keeps failing`, (e as Error).message.slice(0, 300)).catch(() => undefined);
      }
      status[name] = { ...status[name], lastRunAt: new Date(t).toISOString(), tookMs: Date.now() - t };
      const delay = failures ? Math.min(5 * 60_000, every * 2 ** Math.min(failures, 6)) : every;
      setTimeout(tick, delay);
    };
    setTimeout(tick, 0);
  };
  loop('indexer', LOOPS.indexerMs, () => indexer.catchUp(50));
  loop('registration', LOOPS.registrationMs, async () => {
    const r = await processRegistrations(ctx);
    if (r.registered.length) await boss.send(RISK_SIGNUP_QUEUE, { wallets: r.registered });
  });
  loop('freezes', LOOPS.freezesMs, () => processFreezes(ctx));
  loop('requests', LOOPS.requestsMs, () => processOperatorRequests(ctx));
  loop('alerts', LOOPS.alertsMs, () => alerts.deliver());

  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    log.info('worker stopping', { signal: sig });
    await boss.stop({ graceful: true, timeout: 30_000 }).catch(() => undefined);
    await lockClient.query('SELECT pg_advisory_unlock($1)', [WORKER_LOCK_ID]).catch(() => undefined);
    lockClient.release();
    await db.destroy().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(JSON.stringify({ level: 'error', msg: 'worker crashed', error: (e as Error).stack ?? String(e) }));
    process.exit(1);
  });
}
