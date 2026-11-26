// Kairos (1001) deploy of the platform contracts with the Kairos TEST key (PRIVATE_KEY in contracts/.env).
//   npx hardhat run scripts/platform/deploy-kairos.js --network kairos
// Local rehearsal on the in process Hardhat network (fresh test CT, nothing broadcast, nothing written):
//   npx hardhat run scripts/platform/deploy-kairos.js
//
// Order: test CT (reused from deployments/kairos.json when it is an 18 decimal token the signer holds, else a fresh
// CojamToken minted to the signer), PredictLogic, CojamPredict linked to it, CojamStaking, and a second, clearly
// labelled test instance StakingShortLock (`stakingShortLock`, days of SHORT_LOCK_SECONDS_PER_DAY seconds, default 2,
// so the 30 day lock is 60 s and the 365 day lock is 730 s) for full cycle staking tests. The short lock build is never
// the main staking contract. Owner = operator = treasury = pauser = the signer.
//
// Resumable: a contract already recorded in deployments/platform.kairos.json with code on chain is reused unless
// REDEPLOY=1. REDEPLOY_PREDICT=1 redeploys PredictLogic and CojamPredict only (after a change to either), keeping CT and
// both staking instances; the old pair moves to `retired` in the deployment file.
// Writes deployments/platform.kairos.json and platform/shared/addresses/kairos.json.
const { ethers, network } = require("hardhat");
const path = require("path");
const { DEPLOYMENTS, SHARED_ADDRESSES, readJson, writeJson, gasOf } = require("./lib");

const OUT = path.join(DEPLOYMENTS, "platform.kairos.json");
const SHARED = path.join(SHARED_ADDRESSES, "kairos.json");
const SHORT = BigInt(process.env.SHORT_LOCK_SECONDS_PER_DAY || "2");
const MIN_CT = ethers.parseUnits("1000000", 18); // the signer must hold at least this much test CT

async function main() {
  const live = network.name === "kairos";
  if (!live && network.name !== "hardhat") throw new Error("Kairos or the in process hardhat network only");
  const { chainId } = await ethers.provider.getNetwork();
  if (live && chainId !== 1001n) throw new Error(`expected Kairos 1001, connected to ${chainId}`);
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("no signer: PRIVATE_KEY missing in contracts/.env");
  const me = signer.address;
  console.log(`${live ? "KAIROS" : "LOCAL HARDHAT"} | signer ${me} | ${ethers.formatEther(await ethers.provider.getBalance(me))} KAIA`);

  const prev = (live && !process.env.REDEPLOY && readJson(OUT)) || {};
  const out = Object.assign({ network: "kairos", chainId: 1001 }, prev, {
    note: "Platform test deploy on Kairos with the throwaway test key. Owner, operator, treasury and pauser are all the test key. stakingShortLock is a TEST build (StakingShortLock, short days), never the main staking contract.",
    updatedAt: new Date().toISOString(),
    owner: me, operator: me, treasury: me, pauser: me,
  });
  out.contracts = out.contracts || {};
  if (live && process.env.REDEPLOY_PREDICT === "1" && out.contracts.predict) {
    out.retired = out.retired || [];
    out.retired.push({
      retiredAt: new Date().toISOString(),
      reason: process.env.RETIRE_REASON || "CojamPredict / PredictLogic changed; redeployed",
      predictLogic: out.contracts.predictLogic, predict: out.contracts.predict,
      funding: (out.funding || []).filter((f) => f.to === "predict"),
    });
    out.funding = (out.funding || []).filter((f) => f.to !== "predict");
    delete out.contracts.predictLogic;
    delete out.contracts.predict;
  }
  const hasCode = async (a) => a && (await ethers.provider.getCode(a)) !== "0x";

  async function deploy(key, name, args, opts = {}) {
    const rec = out.contracts[key];
    if (rec && (await hasCode(rec.address))) {
      console.log(`  ${key.padEnd(18)} reused ${rec.address}`);
      return ethers.getContractAt(name, rec.address);
    }
    const f = await ethers.getContractFactory(name, opts);
    const c = await f.deploy(...args);
    const rc = await c.deploymentTransaction().wait();
    const address = await c.getAddress();
    out.contracts[key] = {
      contract: name, address, deployBlock: rc.blockNumber, tx: rc.hash,
      constructorArgs: args.map(String), ...(opts.libraries ? { libraries: opts.libraries } : {}),
      gas: gasOf(rc),
    };
    console.log(`  ${key.padEnd(18)} ${name} ${address} block ${rc.blockNumber} gas ${rc.gasUsed}`);
    if (live) writeJson(OUT, out); // save after every step so a failure can resume
    return c;
  }

  // 1. test CT
  let ct;
  const known = readJson(path.join(DEPLOYMENTS, "kairos.json"), {});
  const candidate = (out.contracts.ct && out.contracts.ct.address) || (live && known.newToken);
  if (candidate && (await hasCode(candidate))) {
    const t = await ethers.getContractAt("CojamToken", candidate);
    if ((await t.decimals()) === 18n && (await t.balanceOf(me)) >= MIN_CT) {
      ct = t;
      if (!out.contracts.ct) out.contracts.ct = { contract: "CojamToken", address: candidate, reused: "deployments/kairos.json newToken (rehearsal Cojam Token, 18 decimals, held by the test key)" };
      console.log(`  ${"ct".padEnd(18)} reused ${candidate} (signer holds ${ethers.formatUnits(await t.balanceOf(me), 18)} CT)`);
    }
  }
  if (!ct) ct = await deploy("ct", "CojamToken", [me]);
  const ctAddr = await ct.getAddress();

  // 2. PredictLogic, then CojamPredict linked to it
  const lib = await deploy("predictLogic", "PredictLogic", []);
  const libAddr = await lib.getAddress();
  const predict = await deploy("predict", "CojamPredict", [ctAddr, me, me, me], { libraries: { PredictLogic: libAddr } });
  // 3. staking (main) and the short lock test instance
  const staking = await deploy("staking", "CojamStaking", [ctAddr, me, me, me]);
  const shortLock = await deploy("stakingShortLock", "StakingShortLock", [ctAddr, me, me, me, SHORT]);

  // post deploy checks
  const fail = (m) => { throw new Error("CHECK FAILED: " + m); };
  const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  if (!eq(await predict.CT(), ctAddr)) fail("predict CT");
  if (!(await predict.hasRole(await predict.DEFAULT_ADMIN_ROLE(), me))) fail("predict owner");
  if (!(await predict.hasRole(await predict.OPERATOR_ROLE(), me))) fail("predict operator");
  if (!(await predict.hasRole(await predict.PAUSER_ROLE(), me))) fail("predict pauser");
  const p = await predict.params();
  if (!eq(p.treasury, me)) fail("predict treasury");
  for (const s of [staking, shortLock]) {
    if (!eq(await s.CT(), ctAddr)) fail("staking CT");
    if (!eq(await s.treasury(), me)) fail("staking treasury");
    if (!eq(await s.owner(), me)) fail("staking owner");
    if (!(await s.hasRole(await s.PAUSER_ROLE(), me))) fail("staking pauser");
  }
  if ((await staking.lockDuration(0)) !== 30n * 86400n) fail("main staking must have real 30 day locks");
  if ((await shortLock.lockDuration(0)) !== 30n * SHORT) fail("short lock duration");
  out.stakingShortLockSecondsPerDay = Number(SHORT);
  console.log("  checks passed: CT, roles, treasury, lock durations, library link (params() read through the contract)");

  if (!live) { console.log("local rehearsal done (nothing written)"); return; }
  writeJson(OUT, out);
  const c = out.contracts;
  writeJson(SHARED, {
    network: "kairos", chainId: 1001,
    ct: c.ct.address,
    predictLogic: c.predictLogic.address,
    predict: c.predict.address, predictDeployBlock: c.predict.deployBlock,
    staking: c.staking.address, stakingDeployBlock: c.staking.deployBlock,
    stakingShortLock: c.stakingShortLock.address, stakingShortLockDeployBlock: c.stakingShortLock.deployBlock,
    stakingShortLockSecondsPerDay: Number(SHORT),
    owner: me, treasury: me, operator: me, pauser: me,
  });
  console.log(`saved ${path.relative(process.cwd(), OUT)} and platform/shared/addresses/kairos.json`);
  console.log(`next: node scripts/platform/verify-platform.js kairos  |  npx hardhat run scripts/platform/fund.js --network kairos`);
}
main().catch((e) => { console.error(process.env.DEBUG_DEPLOY ? e : e.message || e); process.exitCode = 1; });
