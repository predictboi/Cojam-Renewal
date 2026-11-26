// Environment parsing for the API and the worker (DEV-PLAN 9.3 plus the few names this package adds).
// No secret has a default. `.env.example` lists every name. Call loadConfig(process.env, "api" | "worker").
import { z } from "zod";
import { addresses as sharedAddresses } from "../../../shared/addresses/index.ts";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true" || v === "yes");
const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number(v)))
    .pipe(z.number().int().nonnegative());
const num = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number(v)))
    .pipe(z.number().nonnegative());
const optStr = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v));
const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address")
  .transform((v) => v.toLowerCase() as `0x${string}`);
const optAddress = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .pipe(address.optional());
const privateKey = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v.startsWith("0x") ? v : `0x${v}`))
  .pipe(z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 32 byte hex private key").optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: int(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  NETWORK: z.enum(["local", "kairos", "kaia"]).default("kairos"),
  CHAIN_ID: int(1001),
  KAIA_RPC_URL: z.string().url().default("https://public-en-kairos.node.kaia.io"),
  KAIA_RPC_URL_FALLBACK: optStr,
  DATABASE_URL: z.string().min(1),
  CT_ADDRESS: optAddress,
  PREDICT_ADDRESS: optAddress,
  PREDICT_DEPLOY_BLOCK: int(0),
  STAKING_ADDRESS: optAddress,
  STAKING_DEPLOY_BLOCK: int(0),
  ALLOWED_ORIGINS: z.string().default("https://app.cojam.app,https://admin.cojam.app"),
  APP_URL: z.string().default("https://app.cojam.app"),
  MIN_APP_VERSION: z.string().default("0.0.0"),
  TRUST_PROXY: bool,

  // Privy
  PRIVY_APP_ID: optStr,
  PRIVY_APP_SECRET: optStr,
  PRIVY_VERIFICATION_KEY: optStr,
  PRIVY_ADMIN_APP_ID: optStr,
  PRIVY_ADMIN_APP_SECRET: optStr,
  PRIVY_ADMIN_VERIFICATION_KEY: optStr,
  ADMIN_OWNER_EMAIL: optStr,
  /** Hex SHA-256 of the operations agent's service token (docs/platform/OPS-AGENT.md). Unset: the path is off. */
  ADMIN_SERVICE_TOKEN_SHA256: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v.toLowerCase()))
    .pipe(z.string().regex(/^[0-9a-f]{64}$/, "must be a hex SHA-256").optional()),
  ADMIN_SERVICE_PER_MINUTE: int(120),
  /** Dev only: trust the X-Dev-User header instead of a Privy token. Refused when NODE_ENV=production. */
  AUTH_DEV_BYPASS: bool,
  /** Dev only: "stub" runs without a Kaia node (src/chain/devStub.ts). Refused when NODE_ENV=production. */
  DEV_CHAIN: z.enum(["none", "stub"]).default("none"),

  // Sign up and abuse
  EMAIL_HASH_KEY: optStr,
  IP_HASH_SALT: optStr,
  PLAY_KEY_TTL_DAYS: int(30),
  SIGNUP_IP_PER_DAY: int(20),
  SIGNUP_IP_FLAG_PER_DAY: int(5),
  SIGNUP_DEVICE_PER_DAY: int(2),
  SIGNUP_DEVICE_TOTAL: int(3),
  SIGNUP_GLOBAL_PER_HOUR_MIN: int(200),
  EMAIL_CHECK_IP_PER_HOUR: int(10),
  EMAIL_CHECK_DEVICE_PER_HOUR: int(5),
  EMAIL_CHECK_EMAIL_PER_HOUR: int(5),
  INVITE_LOOKUP_IP_PER_HOUR: int(30),
  INVITE_REDEEM_PER_HOUR: int(10),
  INVITE_LINKS_PER_INVITER_PER_DAY: int(30),
  RISK_BLOCK_SCORE: int(80),
  RISK_REVIEW_SCORE: int(50),
  SUPPORT_EMAIL: z.string().default("help@cojam.app"),

  // Sponsorship
  APP_FEE_PAYER_PRIVATE_KEY: privateKey,
  MAX_GAS_PRICE_GKEI: num(50),
  SPONSOR_PREDICT_PER_DAY: int(10),
  SPONSOR_SETPLAYKEY_PER_DAY: int(3),
  SPONSOR_OTHER_PER_DAY: int(15),
  SPONSOR_IP_PER_DAY: int(300),
  SPONSOR_BURST_PER_MIN: int(20),
  SPONSOR_SIMULATE: z
    .string()
    .optional()
    .transform((v) => v !== "0" && v !== "false"),
  DAILY_BUDGET_KAIA: num(10),
  MIN_FEE_PAYER_BALANCE_KAIA: num(10),
  MIN_OPERATOR_BALANCE_KAIA: num(5),
  /** KRW per CT for the Korean staking quote (optional; omitted from the quote when unset). */
  KRW_PER_CT: num(0),
  /** Public RPC endpoint handed to the PWA (GET /v1/config rpcUrl). Default: the public Kaia endpoint of NETWORK. */
  PUBLIC_RPC_URL: optStr,
  /** Block explorer base URL handed to the PWA. Default: kaiascan of NETWORK. */
  EXPLORER_URL: optStr,
  /** Estimated KAIA fee of one user paid transaction, shown before a CT transfer or an on hold claim. */
  USER_TX_FEE_KAIA: num(0.005),
  /** Maintenance fallback when app_state has no "app.maintenance" row: 1 shows the maintenance screen. */
  MAINTENANCE: bool,
  /** Maintenance message (plain text, shown in every language) and the expected end, ISO 8601 or unix seconds. */
  MAINTENANCE_MESSAGE: optStr,
  MAINTENANCE_BACK_AT: optStr,

  // Worker
  OPERATOR_PRIVATE_KEY: privateKey,
  ANTHROPIC_API_KEY: optStr,
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_MONTHLY_BUDGET_USD: num(300),
  IMAGE_API_KEY: optStr,
  IMAGE_MODEL: optStr,
  R2_ACCOUNT_ID: optStr,
  R2_ACCESS_KEY_ID: optStr,
  R2_SECRET_ACCESS_KEY: optStr,
  R2_BUCKET: optStr,
  IMAGE_BASE_URL: z.string().default("https://img.cojam.app"),

  // Monitoring
  SENTRY_DSN: optStr,
  ALERT_TELEGRAM_BOT_TOKEN: optStr,
  ALERT_TELEGRAM_CHAT_ID: optStr,
  ALERT_EMAIL: optStr,
});

export type Env = z.infer<typeof schema>;
export type Role = "api" | "worker" | "test";

export interface Config {
  env: Env;
  nodeEnv: Env["NODE_ENV"];
  isProduction: boolean;
  network: Env["NETWORK"];
  chainId: number;
  databaseUrl: string;
  rpcUrls: string[];
  addresses: {
    ct?: `0x${string}`;
    predict?: `0x${string}`;
    staking?: `0x${string}`;
  };
  deployBlocks: { predict: number; staking: number };
  allowedOrigins: string[];
  devBypass: boolean;
  supportEmail: string;
}

export class ConfigError extends Error {}

/** Wei per KAIA. */
const KAIA = 10n ** 18n;
export function kaiaToWei(kaia: number): bigint {
  return (BigInt(Math.round(kaia * 1e6)) * KAIA) / 1_000_000n;
}

export function loadConfig(raw: Record<string, string | undefined> = process.env, role: Role = "api"): Config {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new ConfigError(`invalid environment:\n  ${lines.join("\n  ")}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  // The dev bypass trusts a header to name the user: it must never run in production.
  if (env.AUTH_DEV_BYPASS && isProduction) {
    throw new ConfigError("AUTH_DEV_BYPASS cannot be enabled when NODE_ENV=production");
  }

  if (env.DEV_CHAIN === "stub" && isProduction) {
    throw new ConfigError("DEV_CHAIN=stub cannot be enabled when NODE_ENV=production");
  }

  if (isProduction) {
    const missing: string[] = [];
    const need = (name: keyof Env) => {
      if (env[name] === undefined || env[name] === "") missing.push(name);
    };
    ["EMAIL_HASH_KEY", "IP_HASH_SALT"].forEach((n) => need(n as keyof Env));
    if (role === "api") {
      ["PRIVY_APP_ID", "PRIVY_APP_SECRET", "PRIVY_ADMIN_APP_ID", "APP_FEE_PAYER_PRIVATE_KEY"].forEach((n) => need(n as keyof Env));
    }
    if (role === "worker") {
      ["OPERATOR_PRIVATE_KEY", "ANTHROPIC_API_KEY"].forEach((n) => need(n as keyof Env));
    }
    if (missing.length) throw new ConfigError(`missing required production variables: ${missing.join(", ")}`);
    if (role === "api" && env.OPERATOR_PRIVATE_KEY) throw new ConfigError("OPERATOR_PRIVATE_KEY must not be set on the API service");
    if (role === "worker" && env.APP_FEE_PAYER_PRIVATE_KEY) throw new ConfigError("APP_FEE_PAYER_PRIVATE_KEY must not be set on the worker");
  }

  // Addresses default to platform/shared/addresses/<network>.json; env values win.
  const shared = env.NETWORK === "local" ? undefined : sharedAddresses[env.NETWORK];
  const lc = (a: string | null | undefined) => (a ? (a.toLowerCase() as `0x${string}`) : undefined);
  const addresses = {
    ct: env.CT_ADDRESS ?? lc(shared?.ct),
    predict: env.PREDICT_ADDRESS ?? lc(shared?.predict),
    staking: env.STAKING_ADDRESS ?? lc(shared?.staking),
  };
  const deployBlocks = {
    predict: env.PREDICT_DEPLOY_BLOCK || shared?.predictDeployBlock || 0,
    staking: env.STAKING_DEPLOY_BLOCK || shared?.stakingDeployBlock || 0,
  };
  if (isProduction && (!addresses.ct || !addresses.predict || !addresses.staking)) {
    throw new ConfigError("CT, CojamPredict and CojamStaking addresses must be known in production (env or platform/shared/addresses)");
  }

  return {
    env,
    nodeEnv: env.NODE_ENV,
    isProduction,
    network: env.NETWORK,
    chainId: env.CHAIN_ID,
    databaseUrl: env.DATABASE_URL,
    rpcUrls: [env.KAIA_RPC_URL, env.KAIA_RPC_URL_FALLBACK].filter((u): u is string => Boolean(u)),
    addresses,
    deployBlocks,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    devBypass: env.AUTH_DEV_BYPASS,
    supportEmail: env.SUPPORT_EMAIL,
  };
}
