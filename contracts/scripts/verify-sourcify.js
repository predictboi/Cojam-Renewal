// Verify deployed contracts on Sourcify API v2 (Kaiascan shows Sourcify verified sources).
//   node scripts/verify-sourcify.js <chainId> <address> <contractName> [<address> <contractName> ...]
// Reads the standard JSON input and compiler version from Hardhat's build info (run `npx hardhat compile` first).
const fs = require("fs"), path = require("path");
const API = "https://sourcify.dev/server/v2";
const UA = { "content-type": "application/json", "user-agent": "cojam-contracts-verify/1.0" };

function buildFor(name) {
  const dir = path.join(__dirname, "..", "artifacts", "build-info");
  // newest build first: older build info files can hold earlier versions of the same contract
  const files = fs.readdirSync(dir).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t).map((x) => x.f);
  for (const f of files) {
    const b = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [src, cs] of Object.entries(b.output.contracts || {})) {
      if (cs[name]) return { input: b.input, version: b.solcLongVersion, id: `${src}:${name}` };
    }
  }
  throw new Error("no build info for " + name);
}
async function verify(chainId, address, name) {
  const { input, version, id } = buildFor(name);
  const r = await fetch(`${API}/verify/${chainId}/${address}`, { method: "POST", headers: UA,
    body: JSON.stringify({ stdJsonInput: input, compilerVersion: version, contractIdentifier: id }) });
  const j = await r.json();
  if (!r.ok) { console.log(name, address, r.status, j.customCode || j.message || JSON.stringify(j)); return; }
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const s = await (await fetch(`${API}/verify/${j.verificationId}`, { headers: UA })).json();
    if (s.isJobCompleted) { console.log(name, address, s.error ? "error: " + (s.error.message || s.error.customCode) : "verified: " + JSON.stringify(s.contract && s.contract.match || s.contract)); return; }
  }
  console.log(name, address, "still pending", j.verificationId);
}
(async () => {
  const [chainId, ...rest] = process.argv.slice(2);
  for (let i = 0; i < rest.length; i += 2) await verify(chainId, rest[i], rest[i + 1]);
})();
