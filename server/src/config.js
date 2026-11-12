'use strict';

// All configuration comes from environment variables. Missing or malformed values
// stop the process at start (fail fast), and every problem is reported at once.
// The private key is validated here but never printed, logged or returned by an endpoint.

const { getAddress, parseUnits } = require('ethers');

const OLD_CT_MAINNET = '0x7f223b1607171b81ebd68d22f1ca79157fd4a44b';
const KNOWN_CHAINS = { 8217: 'Kaia mainnet', 1001: 'Kairos testnet' };

class ConfigError extends Error {
  constructor(problems) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function loadConfig(env = process.env) {
  const problems = [];

  const str = (name, { required = false, def } = {}) => {
    const raw = env[name];
    const v = raw === undefined || raw === '' ? def : String(raw).trim();
    if (required && (v === undefined || v === '')) problems.push(`${name} is required`);
    return v;
  };
  const int = (name, def, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const raw = str(name, { def: def === undefined ? undefined : String(def) });
    if (raw === undefined) {
      problems.push(`${name} is required`);
      return undefined;
    }
    if (!/^\d+$/.test(raw)) {
      problems.push(`${name} must be a whole number (got "${raw}")`);
      return undefined;
    }
    const n = Number(raw);
    if (n < min || n > max) problems.push(`${name} must be between ${min} and ${max}`);
    return n;
  };
  const kaia = (name, def) => {
    const raw = str(name, { def });
    try {
      const wei = parseUnits(raw, 18);
      if (wei < 0n) throw new Error('negative');
      return wei;
    } catch {
      problems.push(`${name} must be a KAIA amount such as "5" or "0.5" (got "${raw}")`);
      return undefined;
    }
  };
  const gkei = (name, def) => {
    const raw = str(name, { def });
    try {
      return parseUnits(raw, 9);
    } catch {
      problems.push(`${name} must be a gas price in gkei such as "50" (got "${raw}")`);
      return undefined;
    }
  };
  const address = (name, { required = false, def } = {}) => {
    const raw = str(name, { required, def });
    if (raw === undefined || raw === '') return undefined;
    try {
      return getAddress(raw.toLowerCase());
    } catch {
      problems.push(`${name} is not a valid address`);
      return undefined;
    }
  };

  const mode = str('RUN_MODE', { def: 'all' });
  if (!['all', 'api', 'keeper'].includes(mode)) problems.push('RUN_MODE must be all, api or keeper');

  const rpcUrl = str('KAIA_RPC_URL', { required: true });
  if (rpcUrl && !/^https?:\/\//.test(rpcUrl)) problems.push('KAIA_RPC_URL must start with http:// or https://');

  const chainId = int('CHAIN_ID', undefined, { min: 1 });
  if (chainId !== undefined && !KNOWN_CHAINS[chainId]) {
    problems.push('CHAIN_ID must be 8217 (Kaia mainnet) or 1001 (Kairos testnet)');
  }

  const oldCt = address('OLD_CT_ADDRESS', { def: OLD_CT_MAINNET });
  const swap = address('SWAP_CONTRACT_ADDRESS', { required: true });

  const pk = str('FEE_PAYER_PRIVATE_KEY', { required: true });
  if (pk && !/^(0x)?[0-9a-fA-F]{64}$/.test(pk)) {
    problems.push('FEE_PAYER_PRIVATE_KEY must be 32 bytes of hex (the value is not shown here)');
  }

  const origins = (str('ALLOWED_ORIGINS', { def: '' }) || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if ((mode === 'all' || mode === 'api') && origins.length === 0) {
    problems.push('ALLOWED_ORIGINS is required for the API (comma separated, for example https://cojam.example)');
  }
  for (const o of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) problems.push(`ALLOWED_ORIGINS entry "${o}" must be an origin like https://host`);
  }

  const cfg = {
    mode,
    port: int('PORT', 10000, { min: 1, max: 65535 }),
    rpcUrl,
    chainId,
    chainName: KNOWN_CHAINS[chainId],
    oldCtAddress: oldCt,
    swapAddress: swap,
    feePayerPrivateKey: pk && (pk.startsWith('0x') ? pk : `0x${pk}`),
    allowedOrigins: origins,
    trustProxy: str('TRUST_PROXY', { def: 'true' }) === 'true',

    policy: {
      maxGasPriceWei: gkei('MAX_GAS_PRICE_GKEI', '50'),
      maxGasLimitApprove: int('MAX_GAS_LIMIT_APPROVE', 120000, { min: 21000 }),
      maxGasLimitSwap: int('MAX_GAS_LIMIT_SWAP', 600000, { min: 21000 }),
      maxClaimLots: int('MAX_CLAIM_LOTS', 50, { min: 1, max: 1000 }),
      senderDailyLimit: int('SENDER_DAILY_TX_LIMIT', 10, { min: 1 }),
      ipDailyLimit: int('IP_DAILY_TX_LIMIT', 40, { min: 1 }),
      dailyBudgetWei: kaia('DAILY_BUDGET_KAIA', '50'),
      minBalanceWei: kaia('MIN_FEE_PAYER_BALANCE_KAIA', '5'),
      simulate: str('SIMULATE_BEFORE_SIGN', { def: 'true' }) === 'true',
    },

    keeper: {
      enabled: mode === 'all' || mode === 'keeper',
      startBlock: undefined,
      intervalMs: int('KEEPER_INTERVAL_SECONDS', 60, { min: 5 }) * 1000,
      unlockDelaySec: int('KEEPER_UNLOCK_DELAY_SECONDS', 120, { min: 0 }),
      batchSize: int('KEEPER_BATCH_SIZE', 40, { min: 1, max: 500 }),
      maxLotsEach: int('KEEPER_MAX_LOTS_EACH', 20, { min: 1, max: 500 }),
      logChunk: int('KEEPER_LOG_CHUNK_BLOCKS', 5000, { min: 10 }),
      confirmations: int('KEEPER_CONFIRMATIONS', 2, { min: 0, max: 100 }),
      minBalanceWei: kaia('KEEPER_MIN_BALANCE_KAIA', '1'),
      maxGasPriceWei: undefined,
    },
  };

  if (cfg.keeper.enabled) {
    cfg.keeper.startBlock = int('SWAP_DEPLOY_BLOCK', undefined, { min: 0 });
  } else if (env.SWAP_DEPLOY_BLOCK) {
    cfg.keeper.startBlock = int('SWAP_DEPLOY_BLOCK', undefined, { min: 0 });
  }
  cfg.keeper.maxGasPriceWei = cfg.policy.maxGasPriceWei;

  if (problems.length) throw new ConfigError(problems);
  return Object.freeze(cfg);
}

module.exports = { loadConfig, ConfigError, OLD_CT_MAINNET, KNOWN_CHAINS };
