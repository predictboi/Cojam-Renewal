'use strict';
// Reads KEY=VALUE pairs from contracts/.env (or SPIKE_ENV_FILE) without printing anything.
// Values already present in process.env win. Used by deploy.js and the local e2e scripts only.
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(file = process.env.SPIKE_ENV_FILE || path.join(__dirname, '..', '..', '..', 'contracts', '.env')) {
  const out = {};
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function spikeEnv() {
  const file = loadEnvFile();
  const get = (k) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : file[k]);
  const pk = get('PRIVATE_KEY');
  if (!pk || !/^(0x)?[0-9a-fA-F]{64}$/.test(pk)) throw new Error('PRIVATE_KEY is missing or malformed in contracts/.env (value not shown)');
  return {
    privateKey: pk.startsWith('0x') ? pk : `0x${pk}`,
    rpcUrl: get('KAIROS_RPC_URL') || 'https://public-en-kairos.node.kaia.io',
  };
}

module.exports = { loadEnvFile, spikeEnv };
