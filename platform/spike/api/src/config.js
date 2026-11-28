'use strict';

// Spike fee payer configuration, adapted from server/src/config.js. Every value comes from an
// environment variable; problems stop the process at start and are all reported at once.
// The private key is validated but never printed, logged or returned by an endpoint.
// Kairos (1001) only: this service refuses to start on any other chain id.

const { getAddress, parseUnits } = require('ethers');

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

  const rpcUrl = str('KAIA_RPC_URL', { def: 'https://public-en-kairos.node.kaia.io' });
  if (rpcUrl && !/^https?:\/\//.test(rpcUrl)) problems.push('KAIA_RPC_URL must start with http:// or https://');

  const chainId = int('CHAIN_ID', 1001, { min: 1 });
  if (chainId !== undefined && chainId !== 1001) problems.push('CHAIN_ID must be 1001: the spike fee payer runs on Kairos only');

  let spike;
  const spikeRaw = str('SPIKE_CONTRACT_ADDRESS', { required: true });
  if (spikeRaw) {
    try {
      spike = getAddress(spikeRaw.toLowerCase());
    } catch {
      problems.push('SPIKE_CONTRACT_ADDRESS is not a valid address');
    }
  }

  const pk = str('FEE_PAYER_PRIVATE_KEY', { required: true });
  if (pk && !/^(0x)?[0-9a-fA-F]{64}$/.test(pk)) {
    problems.push('FEE_PAYER_PRIVATE_KEY must be 32 bytes of hex (the value is not shown here)');
  }

  const origins = (str('ALLOWED_ORIGINS', { def: '' }) || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (origins.length === 0) problems.push('ALLOWED_ORIGINS is required (comma separated, for example https://cojam-spike.onrender.com)');
  for (const o of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) problems.push(`ALLOWED_ORIGINS entry "${o}" must be an origin like https://host`);
  }

  const cfg = {
    port: int('PORT', 10000, { min: 1, max: 65535 }),
    rpcUrl,
    chainId,
    spikeAddress: spike,
    feePayerPrivateKey: pk && (pk.startsWith('0x') ? pk : `0x${pk}`),
    allowedOrigins: origins,
    trustProxy: str('TRUST_PROXY', { def: 'true' }) === 'true',
    policy: {
      maxGasPriceWei: gkei('MAX_GAS_PRICE_GKEI', '50'),
      maxGasLimit: int('MAX_GAS_LIMIT', 250000, { min: 21000, max: 2000000 }),
      maxKeyLifetimeSec: int('MAX_PLAY_KEY_DAYS', 90, { min: 1, max: 90 }) * 86400,
      senderDailyLimit: int('SENDER_DAILY_TX_LIMIT', 60, { min: 1 }),
      senderPerMinuteLimit: int('SENDER_PER_MINUTE_LIMIT', 20, { min: 1 }),
      ipDailyLimit: int('IP_DAILY_TX_LIMIT', 300, { min: 1 }),
      dailyBudgetWei: kaia('DAILY_BUDGET_KAIA', '5'),
      minBalanceWei: kaia('MIN_FEE_PAYER_BALANCE_KAIA', '0.5'),
      simulate: str('SIMULATE_BEFORE_SIGN', { def: 'true' }) === 'true',
    },
  };

  if (problems.length) throw new ConfigError(problems);
  return Object.freeze(cfg);
}

module.exports = { loadConfig, ConfigError };
