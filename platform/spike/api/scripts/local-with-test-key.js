'use strict';
// Local testing only: starts the spike fee payer with the Kairos test key PRIVATE_KEY from
// contracts/.env as FEE_PAYER_PRIVATE_KEY (read from the file, never printed), and the
// SpikePredict address from contract/deployment.kairos.json. Other settings come from the shell.
//   node scripts/local-with-test-key.js            (PORT defaults to 8787)
const fs = require('node:fs');
const path = require('node:path');

const envFile = process.env.SPIKE_ENV_FILE || path.join(__dirname, '..', '..', '..', '..', 'contracts', '.env');
const m = fs.readFileSync(envFile, 'utf8').match(/^\s*PRIVATE_KEY\s*=\s*["']?([0-9a-fA-Fx]+)["']?\s*$/m);
if (!m) {
  console.error(`PRIVATE_KEY not found in ${envFile}`);
  process.exit(1);
}
process.env.FEE_PAYER_PRIVATE_KEY = m[1];
if (!process.env.SPIKE_CONTRACT_ADDRESS) {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'contract', 'deployment.kairos.json'), 'utf8'));
  process.env.SPIKE_CONTRACT_ADDRESS = dep.address;
}
process.env.PORT = process.env.PORT || '8787';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173';
process.env.TRUST_PROXY = process.env.TRUST_PROXY || 'false';
require('../index.js');
