'use strict';
// Verifies the deployed SpikePredict on Sourcify API v2 (Kaiascan reads Sourcify).
// Usage: node verify-sourcify.js   (reads deployment.kairos.json and build/standard-input.json)
const fs = require('node:fs');
const path = require('node:path');
const API = 'https://sourcify.dev/server/v2';
const H = { 'content-type': 'application/json', 'user-agent': 'cojam-spike-verify/1.0' };

(async () => {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, 'deployment.kairos.json'), 'utf8'));
  const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'standard-input.json'), 'utf8'));
  const compilerVersion = dep.compiler.replace(/\.Emscripten.*$/, '');
  const r = await fetch(`${API}/verify/${dep.chainId}/${dep.address}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ stdJsonInput: input, compilerVersion, contractIdentifier: 'SpikePredict.sol:SpikePredict' }),
  });
  const j = await r.json();
  if (!r.ok) {
    console.log('verify request failed', r.status, j.customCode || j.message || JSON.stringify(j));
    return;
  }
  for (let i = 0; i < 40; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const s = await (await fetch(`${API}/verify/${j.verificationId}`, { headers: H })).json();
    if (s.isJobCompleted) {
      console.log(s.error ? `error: ${s.error.message || s.error.customCode}` : `verified: ${JSON.stringify((s.contract && s.contract.match) || s.contract)}`);
      return;
    }
  }
  console.log('still pending', j.verificationId);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
