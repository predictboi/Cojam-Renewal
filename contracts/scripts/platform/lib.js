// Helpers shared by the platform deploy, fund and E2E scripts.
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
const DEPLOYMENTS = path.join(__dirname, "..", "..", "deployments");
const SHARED_ADDRESSES = path.join(ROOT, "platform", "shared", "addresses");

function readJson(file, fallback = null) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
}

/** Gas record of a mined receipt: gas used, effective price in gkei and the fee in KAIA. */
function gasOf(rc) {
  const price = rc.gasPrice ?? rc.effectiveGasPrice ?? 0n;
  return {
    tx: rc.hash,
    block: rc.blockNumber,
    gasUsed: Number(rc.gasUsed),
    gasPriceGkei: Number(price) / 1e9,
    feeKaia: Number(rc.gasUsed * price) / 1e18,
  };
}

/** Sends a transaction, waits for it, retries once on a nonce race (the test key is shared with the spike). */
async function send(label, fn, log = console.log) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tx = await fn();
      const rc = await tx.wait();
      if (rc.status !== 1) throw new Error(`${label}: reverted (${rc.hash})`);
      const g = gasOf(rc);
      log(`  ${label.padEnd(44)} gas ${String(g.gasUsed).padStart(9)}  tx ${rc.hash}`);
      return { rc, gas: g };
    } catch (e) {
      lastErr = e;
      const m = String(e.shortMessage || e.message || e);
      if (!/nonce|replacement|already known|underpriced/i.test(m)) throw e;
      log(`  ${label}: ${m.split("\n")[0]}; retrying`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

/** Decodes a revert into the custom error name (for refusal checks). */
function errorName(e, ...ifaces) {
  const data = e?.data ?? e?.info?.error?.data ?? e?.error?.data;
  if (e?.revert?.name) return e.revert.name;
  for (const i of ifaces) {
    try {
      const p = i.parseError(data);
      if (p) return p.name;
    } catch (_) { /* next */ }
  }
  return String(e?.shortMessage || e?.message || e).split("\n")[0];
}

module.exports = { ROOT, DEPLOYMENTS, SHARED_ADDRESSES, readJson, writeJson, gasOf, send, errorName };
