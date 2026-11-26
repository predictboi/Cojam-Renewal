// Rebuilds the chain index from the deploy block: `npx tsx src/indexer/rebuild-cli.ts --yes`.
// Stop the worker first (Render: suspend cojam-app-worker), run this as a one off job with the
// worker's environment, then resume the worker; the indexer loop continues from where this stopped.
import { Kysely, PostgresDialect } from 'kysely';
import { loadConfig } from '../config/index.ts';
import { createPool } from '../db/index.ts';
import { createChainClient } from '../worker/chain.ts';
import type { WorkerDatabase } from '../worker/db.ts';
import { createLogger } from '../worker/log.ts';
import { Indexer } from './indexer.ts';

if (!process.argv.includes('--yes')) {
  console.error('This empties every index table and replays all logs from the deploy block. Stop the worker, then run again with --yes.');
  process.exit(2);
}
const cfg = loadConfig(process.env, 'worker');
const log = createLogger(cfg.env.LOG_LEVEL, { service: 'indexer-rebuild' });
const pool = createPool(cfg.databaseUrl, 4);
const lock = await pool.query<{ ok: boolean }>('SELECT pg_try_advisory_lock(86152099) AS ok');
if (!lock.rows[0].ok) {
  console.error('The worker is running (it holds the worker lock). Stop it first.');
  process.exit(1);
}
const db = new Kysely<WorkerDatabase>({ dialect: new PostgresDialect({ pool }) });
const { predict, staking, ct } = cfg.addresses;
if (!predict || !ct) throw new Error('PREDICT_ADDRESS and CT_ADDRESS are required');
const indexer = new Indexer(db, createChainClient(cfg.chainId, cfg.rpcUrls), { predict, staking: staking ?? null, ct, deployBlock: cfg.deployBlocks.predict, range: Number(process.env.INDEXER_RANGE ?? 2000), minRange: 10, confirmations: 0 }, log);
await indexer.rebuild();
let ranges = 0;
for (;;) {
  const r = await indexer.tick();
  if (!r) break;
  ranges++;
  if (ranges % 50 === 0) log.info('rebuild progress', { block: r.to, head: r.head });
}
log.info('rebuild done', { ranges, block: await indexer.cursor() });
await db.destroy();
