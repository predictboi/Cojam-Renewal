// Manual smoke run of the worker entry: node + contracts + fresh DB, then `tsx src/worker/main.ts` for 25 s.
// Usage: npx tsx test/worker/helpers/smoke-main.ts
import { spawn } from 'node:child_process';
import { createWorkerDb, deploy, startHardhat, HH_KEYS } from './env.ts';

const node = await startHardhat();
const d = await deploy(node.url);
const t = await createWorkerDb();
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: t.url,
  NETWORK: 'local',
  CHAIN_ID: '31337',
  KAIA_RPC_URL: node.url,
  PREDICT_ADDRESS: d.predict,
  STAKING_ADDRESS: d.staking,
  CT_ADDRESS: d.ct,
  PREDICT_DEPLOY_BLOCK: String(d.deployBlock),
  OPERATOR_PRIVATE_KEY: HH_KEYS[1],
  ANTHROPIC_API_KEY: '',
  LOG_LEVEL: 'info',
};
const p = spawn('npx', ['tsx', 'src/worker/main.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
p.stdout.on('data', (b) => (out += b));
p.stderr.on('data', (b) => (out += b));
await new Promise((r) => setTimeout(r, 25_000));
const schedules = await t.pool.query('select name, cron from pgboss.schedule order by name');
const jobs = await t.pool.query("select name, state, count(*)::int n from pgboss.job group by 1,2 order by 1");
const cursor = await t.pool.query('select * from chain_cursor');
const state = await t.pool.query("select key from app_state order by key");
p.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 3000));
console.log(out.split('\n').slice(0, 40).join('\n'));
console.log('schedules', schedules.rows);
console.log('jobs', jobs.rows);
console.log('cursor', cursor.rows, 'state', state.rows.map((r) => r.key));
await t.drop();
node.stop();
process.exit(0);
