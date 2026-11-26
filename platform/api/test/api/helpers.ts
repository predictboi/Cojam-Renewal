// Test kit: a fresh database per test file (cloned from the migrated template), a stubbed chain and RPC,
// a stubbed Privy verifier, and buildTestApp() that wires them into the real Fastify app.
import pg from "pg";
import { randomBytes } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { Address, Hex } from "viem";
import { createDb, type Db } from "../../src/db/index.ts";
import { loadConfig, type Config } from "../../src/config/index.ts";
import type { ChainReader, DayState, PlayKeyBinding, PlayerState, PredictParams, RawRpc, StakingPositionView, StakingState } from "../../src/chain/index.ts";
import { RpcError } from "../../src/chain/index.ts";
import type { AuthVerifier } from "../../src/auth/privy.ts";
import { AuthFailed, createDevVerifier } from "../../src/auth/privy.ts";
import { createFeePayerService, type FeePayerService } from "../../src/feeDelegation/service.ts";
import { buildApp } from "../../src/server/app.ts";
import type { Deps } from "../../src/server/deps.ts";
import { DEFAULT_PARAMS } from "../../src/routes/common.ts";

export const TEMPLATE = "cojam_test_template";
export const PREDICT = "0x8bf58c00a9f6b1894ee6562a30630fabf1ca0b7b" as Address;
export const STAKING = "0x4978c46902a626437f6f092abb1cfa91705d3017" as Address;
export const CTA = "0xa8e540c5b5804d4bf2dd2110a307a99e76c6bd9e" as Address;
export const CHAIN_ID = 1001;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export async function createTestDb(): Promise<{ db: Db; url: string; drop: () => Promise<void> }> {
  if (process.env.COJAM_TEST_PG_UNAVAILABLE) throw new Error(`Postgres unavailable: ${process.env.COJAM_TEST_PG_UNAVAILABLE}`);
  const adminUrl = process.env.TEST_PG_URL ?? "postgres://cojam:cojam@localhost:5432/postgres";
  const name = `cojam_t_${randomBytes(5).toString("hex")}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE}"`);
  await admin.end();
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  const db = createDb(u.toString(), { max: 5 });
  return {
    db,
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

// ---------------------------------------------------------------- identities

export interface TestUser {
  name: string;
  token: string;
  privyUserId: string;
  email: string;
  key: Hex;
  wallet: Address;
}
/** A test identity: bearer token "t:<name>" (accepted by stubVerifier). */
export function testUser(name: string, email?: string): TestUser {
  const key = generatePrivateKey();
  return { name, token: `t:${name}`, privyUserId: `did:privy:${name}`, email: email ?? `${name}@gmail.com`, key, wallet: privateKeyToAccount(key).address.toLowerCase() as Address };
}

/** Privy stand in: knows the registered test users; anything else is an invalid token. */
export function stubVerifier(users: Map<string, TestUser>): AuthVerifier {
  return {
    async verify(token) {
      const u = users.get(token);
      if (!u) throw new AuthFailed("bad token");
      return { privyUserId: u.privyUserId };
    },
    async profile(id) {
      const u = [...users.values()].find((x) => x.privyUserId === id);
      if (!u) throw new AuthFailed("unknown user");
      return { email: u.email, wallet: u.wallet };
    },
  };
}

// ---------------------------------------------------------------- chain stub

export class StubChain implements ChainReader {
  players = new Map<string, PlayerState>();
  keys = new Map<string, PlayKeyBinding>();
  days = new Map<string, DayState>();
  balances = { kaia: new Map<string, bigint>(), ct: new Map<string, bigint>(), points: new Map<string, bigint>() };
  params_: PredictParams = { ...DEFAULT_PARAMS };
  staking: StakingState = {
    minStake: 100n * 10n ** 18n,
    minClaim: 10n * 10n ** 18n,
    maxOpenPositions: 20,
    maxTotalPrincipal: 1_850_000n * 10n ** 18n,
    maxUserPrincipal: 1_000_000n * 10n ** 18n,
    totalPrincipal: 0n,
    availableRewards: 500_000n * 10n ** 18n,
    paused: false,
  };
  positions = new Map<string, StakingPositionView[]>();
  converted = new Map<string, bigint>();
  fail = false;
  feePayerBalance = 100n * 10n ** 18n;

  private guard() {
    if (this.fail) throw new Error("rpc down");
  }
  register(wallet: string, opts: Partial<PlayerState> = {}) {
    this.players.set(wallet.toLowerCase(), { referrer: ZERO, registeredAt: Math.floor(Date.now() / 1000) - 86400 * 10, registered: true, frozen: false, completedOnce: false, ...opts });
  }
  bindKey(key: string, player: string, expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30) {
    this.keys.set(key.toLowerCase(), { player: player.toLowerCase() as Address, expiresAt, valid: expiresAt > Math.floor(Date.now() / 1000) });
  }
  async blockNumber() {
    this.guard();
    return 1000;
  }
  async kaiaBalance(a: Address) {
    this.guard();
    return this.balances.kaia.get(a.toLowerCase()) ?? this.feePayerBalance;
  }
  async ctBalance(a: Address) {
    this.guard();
    return this.balances.ct.get(a.toLowerCase()) ?? 0n;
  }
  async ctAllowance() {
    return 0n;
  }
  async pointsBalance(a: Address) {
    this.guard();
    return this.balances.points.get(a.toLowerCase()) ?? 0n;
  }
  async player(w: Address) {
    this.guard();
    return this.players.get(w.toLowerCase()) ?? { referrer: ZERO, registeredAt: 0, registered: false, frozen: false, completedOnce: false };
  }
  async playerOf(k: Address) {
    this.guard();
    return this.keys.get(k.toLowerCase()) ?? { player: ZERO, expiresAt: 0, valid: false };
  }
  async playKeyOf(w: Address) {
    for (const [k, b] of this.keys) if (b.player === w.toLowerCase()) return { key: k as Address, expiresAt: b.expiresAt };
    return { key: ZERO, expiresAt: 0 };
  }
  async dayOf(w: Address, d: number) {
    return this.days.get(`${w.toLowerCase()}:${d}`) ?? { answered: 0, choices: [0, 0, 0, 0, 0], completed: false, settledMask: 0, hits: 0 };
  }
  async pendingHits() {
    return { points: 0n, landsAt: 0 };
  }
  async params() {
    this.guard();
    return this.params_;
  }
  async pendingParams() {
    return { params: this.params_, applyAfter: 0 };
  }
  async market() {
    return { closesAt: 0, resolvesAt: 0, resolvedAt: 0, settlesAt: 0, outcome: 0, correctedOutcome: 0, contentHash: "0x" as Hex };
  }
  async reserve() {
    return 100_000n * 10n ** 18n;
  }
  async convertedCtOnDay(w: Address) {
    return this.converted.get(w.toLowerCase()) ?? 0n;
  }
  async convertedCtTotalOnDay() {
    return 0n;
  }
  async predictPaused() {
    return false;
  }
  async stakingQuote(amount: bigint, lockIndex: number) {
    const rates = [
      [800, 900, 1000],
      [1200, 1300, 1400],
      [1800, 1900, 2000],
      [2500, 2600, 2700],
    ];
    const tier = amount >= 10_000n * 10n ** 18n ? 2 : amount >= 1000n * 10n ** 18n ? 1 : 0;
    const days = [30, 90, 180, 365][lockIndex];
    const apr = rates[lockIndex][tier];
    return { tier, aprBps: apr, interest: (amount * BigInt(apr) * BigInt(days * 86400)) / (10_000n * 365n * 86400n), end: Math.floor(Date.now() / 1000) + days * 86400 };
  }
  async stakingState() {
    this.guard();
    return this.staking;
  }
  async stakingPrincipalOf(w: Address) {
    return (this.positions.get(w.toLowerCase()) ?? []).filter((p) => !p.closed).reduce((a, p) => a + p.principal, 0n);
  }
  async stakingOpenPositions(w: Address) {
    return (this.positions.get(w.toLowerCase()) ?? []).filter((p) => !p.closed).length;
  }
  async stakingPositions(w: Address) {
    return this.positions.get(w.toLowerCase()) ?? [];
  }
  async stakingPosition(w: Address, id: number) {
    return (this.positions.get(w.toLowerCase()) ?? []).find((p) => p.id === id) ?? null;
  }
}

/** JSON-RPC stub for the fee payer: estimate, send, receipt. */
export class StubRpc {
  sent: string[] = [];
  estimate: bigint | RpcError | Error = 60_000n;
  sendError: RpcError | Error | null = null;
  receipts = new Map<string, unknown>();
  calls: { method: string; params: unknown[] }[] = [];
  fn: RawRpc = async (method, params) => {
    this.calls.push({ method, params });
    if (method === "eth_estimateGas") {
      if (this.estimate instanceof Error) throw this.estimate;
      return `0x${this.estimate.toString(16)}`;
    }
    if (method === "kaia_sendRawTransaction") {
      if (this.sendError) throw this.sendError;
      this.sent.push(params[0] as string);
      return `0x${(this.sent.length).toString(16).padStart(64, "a")}`;
    }
    if (method === "kaia_getTransactionReceipt") return this.receipts.get(params[0] as string) ?? null;
    throw new Error(`unexpected rpc ${method}`);
  };
}

export function revertData(err: RpcError | null, data: Hex): RpcError {
  return err ?? new RpcError("execution reverted", { isNodeReply: true, nodeMessage: "execution reverted", nodeData: data });
}

// ---------------------------------------------------------------- app

export const FEE_PAYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

export function testConfig(over: Record<string, string> = {}): Config {
  return loadConfig(
    {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://unused",
      NETWORK: "kairos",
      CHAIN_ID: String(CHAIN_ID),
      CT_ADDRESS: CTA,
      PREDICT_ADDRESS: PREDICT,
      STAKING_ADDRESS: STAKING,
      EMAIL_HASH_KEY: "test-email-key",
      IP_HASH_SALT: "test-salt",
      ALLOWED_ORIGINS: "https://app.cojam.app",
      ...over,
    },
    "test",
  );
}

export interface TestKit {
  app: Awaited<ReturnType<typeof buildApp>>;
  deps: Deps;
  db: Db;
  chain: StubChain;
  rpc: StubRpc;
  users: Map<string, TestUser>;
  feePayer: FeePayerService;
  addUser: (name: string, email?: string) => TestUser;
  clock: { now: number };
  close: () => Promise<void>;
}

export async function buildTestApp(opts: { env?: Record<string, string>; devBypass?: boolean; limits?: Partial<Parameters<typeof createFeePayerService>[0]["limits"]> } = {}): Promise<TestKit> {
  const { db, drop } = await createTestDb();
  const config = testConfig({ ...(opts.devBypass ? { AUTH_DEV_BYPASS: "1" } : {}), ...(opts.env ?? {}) });
  const chain = new StubChain();
  const rpc = new StubRpc();
  const users = new Map<string, TestUser>();
  const clock = { now: Date.now() };
  const verifier = stubVerifier(users);
  const feePayer = createFeePayerService({
    db,
    chain,
    rpc: rpc.fn,
    policy: { chainId: CHAIN_ID, predict: PREDICT, staking: STAKING, ct: CTA, maxGasPriceWei: 50_000_000_000n },
    privateKey: FEE_PAYER_KEY,
    limits: {
      predictPerDay: 10,
      setPlayKeyPerDay: 3,
      otherPerDay: 15,
      ipPerDay: 300,
      burstPerMinute: 20,
      dailyBudgetWei: 10n * 10n ** 18n,
      minBalanceWei: 10n * 10n ** 18n,
      simulate: true,
      ...(opts.limits ?? {}),
    },
    logger: { info() {}, warn() {}, error() {} },
    now: () => clock.now,
    receiptPollMs: 1,
    receiptTries: 0,
  });
  const deps: Deps = {
    config,
    db,
    chain,
    rpc: rpc.fn,
    userAuth: verifier,
    adminAuth: verifier,
    devAuth: config.devBypass ? createDevVerifier() : null,
    feePayer,
    now: () => clock.now,
    version: "test",
  };
  const app = await buildApp(deps);
  return {
    app,
    deps,
    db,
    chain,
    rpc,
    users,
    feePayer,
    clock,
    addUser(name, email) {
      const u = testUser(name, email);
      users.set(u.token, u);
      return u;
    },
    async close() {
      await feePayer.drain();
      await app.close();
      await drop();
    },
  };
}

export const auth = (u: TestUser) => ({ authorization: `Bearer ${u.token}` });

/** Registers a user through POST /v1/session and marks it registered (as the worker would). */
export async function registeredUser(k: TestKit, name: string, opts: { frozen?: boolean; registeredAgoSec?: number } = {}): Promise<TestUser> {
  const u = k.addUser(name);
  const r = await k.app.inject({ method: "POST", url: "/v1/session", headers: auth(u), payload: {} });
  if (r.statusCode !== 200) throw new Error(`session failed: ${r.body}`);
  const at = new Date(k.clock.now - (opts.registeredAgoSec ?? 3600) * 1000);
  await k.db.updateTable("users").set({ registration: "registered", registered_at: at, frozen: Boolean(opts.frozen) }).where("wallet", "=", u.wallet).execute();
  k.chain.register(u.wallet, { registeredAt: Math.floor(at.getTime() / 1000), frozen: Boolean(opts.frozen) });
  return u;
}

/** Inserts the five markets of a day as published. */
export async function seedDay(db: Db, dayId: number, status: "published" | "scheduled" = "published") {
  for (let slot = 0; slot < 5; slot++) {
    const t = { title: `Q${slot + 1} title`, left: "No", right: "Yes", rule: "Rule", settle: "09:00 tomorrow" };
    await db
      .insertInto("markets")
      .values({
        market_id: dayId * 5 + slot,
        day_id: dayId,
        slot,
        category: "crypto",
        content: JSON.stringify({ en: t, ko: t, ja: t }),
        closes_at: new Date((dayId + 1) * 86400 * 1000),
        resolves_at: new Date(((dayId + 1) * 86400 + 3600) * 1000),
        sources: JSON.stringify([{ name: "Binance", url: "https://www.binance.com" }]),
        status,
        image_key: `q/${dayId}-${slot}.webp`,
      })
      .execute();
  }
}
