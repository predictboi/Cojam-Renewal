// Integration kit for the worker: a local Hardhat node with the real contracts (contracts/ artifacts:
// PredictMockCT, PredictLogic linked into CojamPredict, CojamStaking) and a fresh Postgres database
// migrated with every file in src/db/migrations.
//
// Postgres: TEST_PG_URL (default postgres://cojam:cojam@localhost:5432/postgres, the role the API
// tests use). Hardhat: `npx hardhat node` started from contracts/ on a free port.

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import '../../../src/db/index.ts'; // int8 -> number parser
import { migrate } from '../../../src/db/migrate.ts';
import { chainFor } from '../../../src/worker/chain.ts';
import type { WDb, WorkerDatabase } from '../../../src/worker/db.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS = path.resolve(here, '../../../../../contracts');

export const HH_KEYS: Hex[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];

function artifact(rel: string): { abi: Abi; bytecode: Hex; linkReferences: Record<string, Record<string, { start: number; length: number }[]>> } {
  return JSON.parse(readFileSync(path.join(CONTRACTS, 'artifacts/contracts', rel), 'utf8'));
}

export interface Node {
  url: string;
  stop: () => void;
}

export async function startHardhat(port = 18545 + Math.floor(Math.random() * 1000)): Promise<Node> {
  const proc: ChildProcess = spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: CONTRACTS, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('hardhat node did not start in 60 s')), 60_000);
    let buf = '';
    proc.stdout!.on('data', (d) => {
      buf += String(d);
      if (buf.includes('Started HTTP')) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.on('exit', (c) => reject(new Error(`hardhat node exited ${c}: ${buf.slice(-500)}`)));
  });
  return { url: `http://127.0.0.1:${port}`, stop: () => proc.kill('SIGTERM') };
}

export interface Deployed {
  client: PublicClient;
  owner: PrivateKeyAccount;
  operator: PrivateKeyAccount;
  ownerWallet: WalletClient;
  ct: Address;
  predict: Address;
  staking: Address;
  deployBlock: number;
  ctAbi: Abi;
  predictAbi: Abi;
}

export async function deploy(url: string): Promise<Deployed> {
  const chain = chainFor(31337, [url]);
  const client = createPublicClient({ chain, transport: http(url), pollingInterval: 50, cacheTime: 0 }) as PublicClient;
  const owner = privateKeyToAccount(HH_KEYS[0]);
  const operator = privateKeyToAccount(HH_KEYS[1]);
  const ownerWallet = createWalletClient({ chain, transport: http(url), account: owner });
  const dep = async (rel: string, args: unknown[], bytecode?: Hex) => {
    const a = artifact(rel);
    const hash = await ownerWallet.deployContract({ abi: a.abi, bytecode: bytecode ?? a.bytecode, args, account: owner, chain } as never);
    const rc = await client.waitForTransactionReceipt({ hash });
    return { address: rc.contractAddress!.toLowerCase() as Address, block: Number(rc.blockNumber), abi: a.abi };
  };
  const ct = await dep('mocks/PredictMockCT.sol/PredictMockCT.json', [18]);
  const logic = await dep('platform/PredictLogic.sol/PredictLogic.json', []);
  const pa = artifact('platform/CojamPredict.sol/CojamPredict.json');
  let code = pa.bytecode.slice(2);
  for (const refs of Object.values(pa.linkReferences)) {
    for (const list of Object.values(refs)) {
      for (const r of list) code = code.slice(0, r.start * 2) + logic.address.slice(2) + code.slice((r.start + r.length) * 2);
    }
  }
  const predict = await dep('platform/CojamPredict.sol/CojamPredict.json', [ct.address, owner.address, operator.address, owner.address], `0x${code}`);
  const staking = await dep('platform/CojamStaking.sol/CojamStaking.json', [ct.address, owner.address, owner.address, owner.address]);
  // Fund the prediction reserve with 100,000 CT.
  const mint = await ownerWallet.writeContract({ address: ct.address, abi: ct.abi, functionName: 'mint', args: [predict.address, 100_000n * 10n ** 18n], account: owner, chain } as never);
  await client.waitForTransactionReceipt({ hash: mint });
  return { client, owner, operator, ownerWallet, ct: ct.address, predict: predict.address, staking: staking.address, deployBlock: predict.block, ctAbi: ct.abi, predictAbi: pa.abi };
}

export async function rpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await r.json()) as { result?: unknown; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

/** Mines one block at exactly `ts` (unix seconds). */
export async function warpTo(url: string, ts: number): Promise<void> {
  await rpc(url, 'evm_setNextBlockTimestamp', [ts]);
  await rpc(url, 'evm_mine', []);
}

export interface TestDb {
  db: WDb;
  pool: pg.Pool;
  url: string;
  drop: () => Promise<void>;
}

export async function createWorkerDb(): Promise<TestDb> {
  const adminUrl = process.env.TEST_PG_URL ?? 'postgres://cojam:cojam@localhost:5432/postgres';
  const name = `cojam_w_${randomBytes(5).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: u.toString(), max: 5 });
  pool.on('error', () => undefined); // DROP DATABASE ... WITH (FORCE) ends idle clients
  await migrate(pool);
  const db = new Kysely<WorkerDatabase>({ dialect: new PostgresDialect({ pool }) });
  return {
    db,
    pool,
    url: u.toString(),
    drop: async () => {
      await db.destroy();
      const a = new pg.Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await a.end();
    },
  };
}

/** True when the test Postgres answers (integration tests skip with a reason otherwise). */
export async function postgresAvailable(): Promise<string | null> {
  const c = new pg.Client({ connectionString: process.env.TEST_PG_URL ?? 'postgres://cojam:cojam@localhost:5432/postgres', connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.end();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
