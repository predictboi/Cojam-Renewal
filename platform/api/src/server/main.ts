// cojam-app-api entry point: npm run start:api
import { readFileSync } from "node:fs";
import { loadConfig, kaiaToWei } from "../config/index.ts";
import { createDb, createPool } from "../db/index.ts";
import { migrate } from "../db/migrate.ts";
import { createChainClients, createChainReader } from "../chain/index.ts";
import { createDevStubChain } from "../chain/devStub.ts";
import { createDevVerifier, createPrivyVerifier } from "../auth/privy.ts";
import { createFeePayerService } from "../feeDelegation/service.ts";
import { buildApp } from "./app.ts";
import type { Deps } from "./deps.ts";

const config = loadConfig(process.env, "api");
const env = config.env;
const version = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version as string;
  } catch {
    return "0.0.0";
  }
})();

const pool = createPool(config.databaseUrl, 2);
await migrate(pool, (m) => console.log(m));
await pool.end();

const db = createDb(config.databaseUrl);
if (env.ADMIN_OWNER_EMAIL) {
  const email = env.ADMIN_OWNER_EMAIL.toLowerCase();
  await db
    .insertInto("admin_users")
    .values({ privy_user_id: `email:${email}`, email, role: "owner", added_by: "ADMIN_OWNER_EMAIL" })
    .onConflict((oc) => oc.column("email").doNothing())
    .execute();
}

const clients = createChainClients(config);
const stub = env.DEV_CHAIN === "stub" && !config.isProduction ? createDevStubChain(db, () => deps.feePayer?.address) : null;
const chain = stub ? stub.chain : createChainReader(clients);
const rpc = stub ? stub.rpc : clients.rpc;
// Dev stub only: a well known throwaway key (Hardhat account #1) when no fee payer key is set.
const feePayerKey = env.APP_FEE_PAYER_PRIVATE_KEY ?? (stub ? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" : undefined);

const deps: Deps = {
    config,
    db,
    chain,
    rpc,
    userAuth: env.PRIVY_APP_ID ? createPrivyVerifier({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET, verificationKey: env.PRIVY_VERIFICATION_KEY }) : null,
    adminAuth: env.PRIVY_ADMIN_APP_ID
      ? createPrivyVerifier({ appId: env.PRIVY_ADMIN_APP_ID, appSecret: env.PRIVY_ADMIN_APP_SECRET, verificationKey: env.PRIVY_ADMIN_VERIFICATION_KEY })
      : null,
    devAuth: config.devBypass && !config.isProduction ? createDevVerifier() : null,
    feePayer: null,
    now: () => Date.now(),
    version,
};
const app = await buildApp(deps, { logger: { level: env.LOG_LEVEL } });

// The fee payer is built after the app so it can use the app's logger; routes read deps.feePayer per request.
const { predict, staking, ct } = config.addresses;
if (feePayerKey && predict && staking && ct) {
  const fp = createFeePayerService({
    db,
    chain,
    rpc,
    policy: { chainId: config.chainId, predict, staking, ct, maxGasPriceWei: BigInt(Math.round(env.MAX_GAS_PRICE_GKEI * 1e9)) },
    privateKey: feePayerKey as `0x${string}`,
    limits: {
      predictPerDay: env.SPONSOR_PREDICT_PER_DAY,
      setPlayKeyPerDay: env.SPONSOR_SETPLAYKEY_PER_DAY,
      otherPerDay: env.SPONSOR_OTHER_PER_DAY,
      ipPerDay: env.SPONSOR_IP_PER_DAY,
      burstPerMinute: env.SPONSOR_BURST_PER_MIN,
      dailyBudgetWei: kaiaToWei(env.DAILY_BUDGET_KAIA),
      minBalanceWei: kaiaToWei(env.MIN_FEE_PAYER_BALANCE_KAIA),
      simulate: env.SPONSOR_SIMULATE,
    },
    logger: app.log,
  });
  deps.feePayer = fp;
  fp.sweep().catch((e) => app.log.warn({ err: String(e) }, "startup sweep failed"));
  setInterval(() => fp.sweep().catch(() => {}), 5 * 60_000).unref();
} else {
  app.log.warn("fee payer disabled: APP_FEE_PAYER_PRIVATE_KEY or a contract address is missing");
}

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info({ network: config.network, chainId: config.chainId, devBypass: config.devBypass, devChain: env.DEV_CHAIN }, "cojam-app-api listening");

const stop = async () => {
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
