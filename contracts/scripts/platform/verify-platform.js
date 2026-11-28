// Verifies the platform contracts on Sourcify API v2 (Kaiascan reads Sourcify).
//   node scripts/platform/verify-platform.js kairos     (reads deployments/platform.kairos.json)
//   node scripts/platform/verify-platform.js kaia       (reads deployments/platform.kaia.json)
// Same flow as scripts/verify-sourcify.js, but takes the standard JSON input from the build info that each
// artifact's .dbg.json points to (the exact compile that produced the deployed bytecode). Linked libraries need no
// extra input: Sourcify finds the PredictLogic address in CojamPredict's runtime code and reports it in the match.
// Run `npx hardhat compile` first. Writes the result into the deployment file under contracts.<key>.sourcify.
const fs = require("fs"), path = require("path");
const API = "https://sourcify.dev/server/v2";
const UA = { "content-type": "application/json", "user-agent": "cojam-contracts-verify/1.0" };
const ART = path.join(__dirname, "..", "..", "artifacts");
const SOURCES = {
  CojamToken: "contracts/CojamToken.sol",
  PredictLogic: "contracts/platform/PredictLogic.sol",
  CojamPredict: "contracts/platform/CojamPredict.sol",
  CojamStaking: "contracts/platform/CojamStaking.sol",
  StakingShortLock: "contracts/mocks/StakingShortLock.sol",
};

function buildFor(name) {
  const src = SOURCES[name];
  const dbg = JSON.parse(fs.readFileSync(path.join(ART, src, `${name}.dbg.json`), "utf8"));
  const b = JSON.parse(fs.readFileSync(path.join(ART, src, dbg.buildInfo), "utf8"));
  return { input: b.input, version: b.solcLongVersion, id: `${src}:${name}` };
}

async function lookup(chainId, address) {
  const r = await fetch(`${API}/contract/${chainId}/${address}`, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  return j.match || null;
}

async function verify(chainId, address, name) {
  const already = await lookup(chainId, address);
  if (already) return { status: "already verified", match: already };
  const { input, version, id } = buildFor(name);
  const r = await fetch(`${API}/verify/${chainId}/${address}`, {
    method: "POST", headers: UA, body: JSON.stringify({ stdJsonInput: input, compilerVersion: version, contractIdentifier: id }),
  });
  const j = await r.json();
  if (!r.ok) return { status: "error", error: j.customCode || j.message || JSON.stringify(j) };
  for (let i = 0; i < 40; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const s = await (await fetch(`${API}/verify/${j.verificationId}`, { headers: UA })).json();
    if (s.isJobCompleted) {
      if (s.error) return { status: "error", error: s.error.message || s.error.customCode };
      return { status: "verified", match: s.contract && (s.contract.match || s.contract.runtimeMatch), verificationId: j.verificationId };
    }
  }
  return { status: "pending", verificationId: j.verificationId };
}

(async () => {
  const net = process.argv[2] || "kairos";
  const file = path.join(__dirname, "..", "..", "deployments", `platform.${net}.json`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, rec] of Object.entries(d.contracts)) {
    if (rec.reused) { console.log(key, rec.address, "skipped (existing token)"); continue; }
    const res = await verify(d.chainId, rec.address, rec.contract);
    rec.sourcify = { ...res, checkedAt: new Date().toISOString(), url: `https://repo.sourcify.dev/${d.chainId}/${rec.address}` };
    console.log(key.padEnd(18), rec.contract.padEnd(17), rec.address, res.status, res.match || res.error || "");
  }
  fs.writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
})().catch((e) => { console.error(e); process.exitCode = 1; });
