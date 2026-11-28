// Kaia mainnet (8217) deploy of the platform contracts: PredictLogic, CojamPredict linked to it, CojamStaking.
// NOT RUN YET. Deploy only after the external audit and the founder's go.
//   DEPLOYER_PRIVATE_KEY=0x.. OPERATOR_ADDRESS=0x.. [PAUSER_ADDRESS=0x..] CONFIRM_MAINNET=yes \
//     npx hardhat run scripts/platform/deploy-mainnet.js --network kaia
// Dry run against a local fork of mainnet (no key, nothing broadcast, nothing written):
//   FORK_DRY_RUN=1 [OPERATOR_ADDRESS=0x..] npx hardhat run scripts/platform/deploy-mainnet.js
//
// Roles: owner and treasury = the master wallet 0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb (both contracts);
// operator = OPERATOR_ADDRESS (the cojam-app-worker key; CojamPredict OPERATOR_ROLE and PAUSER_ROLE);
// staking pauser = PAUSER_ADDRESS, default the operator. The deployer (deployments/wallets.mainnet.json) pays gas only
// and must end with no role. CT is the live new token 0x91cb3B346C80ff965a9667ba6228834dbedD71a2; the short lock
// staking build is never deployed here. Nothing is funded: the master sends plain CT transfers from its wallet app.
const { ethers, network } = require("hardhat");
const fs = require("fs"), path = require("path");
const { DEPLOYMENTS, SHARED_ADDRESSES, readJson, writeJson, gasOf } = require("./lib");

const CT = "0x91cb3B346C80ff965a9667ba6228834dbedD71a2";
const MASTER = "0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb";
const W = readJson(path.join(DEPLOYMENTS, "wallets.mainnet.json"));
const OUT = path.join(DEPLOYMENTS, "platform.kaia.json");
const DAY = 86400n;

async function main() {
  const dry = process.env.FORK_DRY_RUN === "1";
  if (dry) {
    if (network.name !== "hardhat") throw new Error("FORK_DRY_RUN runs on the in process hardhat network only");
    const url = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";
    const head = await new ethers.JsonRpcProvider(url, 8217, { staticNetwork: true }).getBlockNumber();
    await require("@nomicfoundation/hardhat-network-helpers").reset(url, head - 5);
    await network.provider.send("hardhat_mine", ["0x1"]);
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [W.deployer] });
    await network.provider.send("hardhat_setBalance", [W.deployer, "0x1BC16D674EC80000"]); // 2 KAIA
  }
  const { chainId } = await ethers.provider.getNetwork();
  if (!dry && chainId !== 8217n) throw new Error(`Kaia mainnet (8217) only; connected to ${chainId}.`);
  if (!dry && process.env.CONFIRM_MAINNET !== "yes") throw new Error("Set CONFIRM_MAINNET=yes to broadcast on mainnet.");

  const fail = (m) => { throw new Error("CHECK FAILED: " + m); };
  const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const deployer = dry ? await ethers.getSigner(W.deployer) : (await ethers.getSigners())[0];
  if (!deployer) throw new Error("No signer: set DEPLOYER_PRIVATE_KEY.");
  const master = ethers.getAddress(MASTER);
  let operatorEnv = process.env.OPERATOR_ADDRESS;
  if (!operatorEnv && dry) {
    operatorEnv = ethers.Wallet.createRandom().address;
    console.log(`(dry run: no OPERATOR_ADDRESS, using a random placeholder ${operatorEnv})`);
  }
  if (!operatorEnv) fail("set OPERATOR_ADDRESS (the cojam-app-worker operator key's address)");
  const operator = ethers.getAddress(operatorEnv);
  const pauser = ethers.getAddress(process.env.PAUSER_ADDRESS || operator);

  // checks before any transaction
  if (!eq(master, W.master)) fail("master differs from wallets.mainnet.json");
  if (!eq(deployer.address, W.deployer)) fail(`signer ${deployer.address} is not the recorded deployer ${W.deployer}`);
  const roleHolders = { master, operator, pauser };
  for (const [k, a] of Object.entries(roleHolders)) {
    if (a === ethers.ZeroAddress) fail(`${k} is zero`);
    if (eq(a, deployer.address)) fail(`${k} must not be the deployer (the deployer holds nothing)`);
    if ((await ethers.provider.getCode(a)) !== "0x") fail(`${k} ${a} has code; expected an EOA`);
  }
  if (eq(operator, master)) fail("operator must not be the master wallet (the master key never sits on a server)");
  for (const k of ["feePayer", "pool"]) if (W[k] && (eq(operator, W[k]) || eq(pauser, W[k]))) fail(`operator or pauser reuses the swap ${k} wallet`);
  if ((await ethers.provider.getCode(CT)) === "0x") fail("CT has no code");
  const ct = await ethers.getContractAt("CojamToken", CT, deployer);
  if ((await ct.name()) !== "Cojam Token" || (await ct.symbol()) !== "CT" || (await ct.decimals()) !== 18n) fail("CT is not Cojam Token (CT), 18 decimals");
  const bal = await ethers.provider.getBalance(deployer.address);
  if (bal < ethers.parseEther("0.5")) fail(`deployer has ${ethers.formatEther(bal)} KAIA; keep at least 0.5 (about 10.4M gas)`);
  const prev = readJson(OUT);
  if (!dry && prev && prev.contracts && prev.contracts.predict) fail("deployments/platform.kaia.json already records a deploy; move it away to deploy again");
  console.log(`${dry ? "DRY RUN on a mainnet fork" : "MAINNET"} | deployer ${deployer.address} (${ethers.formatEther(bal)} KAIA)`);
  console.log(`  owner+treasury ${master} | operator ${operator} | staking pauser ${pauser} | CT ${CT}`);

  const contracts = {};
  async function deploy(key, name, args, opts = {}) {
    const c = await (await ethers.getContractFactory(name, { ...opts, signer: deployer })).deploy(...args);
    const rc = await c.deploymentTransaction().wait();
    const address = await c.getAddress();
    contracts[key] = { contract: name, address, deployBlock: rc.blockNumber, tx: rc.hash, constructorArgs: args.map(String), ...(opts.libraries ? { libraries: opts.libraries } : {}), gas: gasOf(rc) };
    console.log(`  ${key.padEnd(13)} ${name} ${address} block ${rc.blockNumber} gas ${rc.gasUsed}`);
    return c;
  }
  const lib = await deploy("predictLogic", "PredictLogic", []);
  const libAddr = await lib.getAddress();
  const predict = await deploy("predict", "CojamPredict", [CT, master, operator, master], { libraries: { PredictLogic: libAddr } });
  const staking = await deploy("staking", "CojamStaking", [CT, master, master, pauser]);

  // post deploy checks of every constructor value and role
  const ADMIN = await predict.DEFAULT_ADMIN_ROLE(), OP = await predict.OPERATOR_ROLE(), PA = await predict.PAUSER_ROLE();
  if (!eq(await predict.CT(), CT)) fail("predict CT");
  if (!eq(await predict.owner(), master)) fail("predict owner");
  if (!(await predict.hasRole(ADMIN, master))) fail("predict admin role");
  if (!(await predict.hasRole(OP, operator))) fail("predict operator role");
  if (!(await predict.hasRole(PA, operator)) || !(await predict.hasRole(PA, master))) fail("predict pauser roles");
  if ((await predict.hasRole(OP, master))) fail("master must not hold OPERATOR_ROLE");
  for (const r of [ADMIN, OP, PA]) if (await predict.hasRole(r, deployer.address)) fail("deployer holds a predict role");
  if ((await predict.defaultAdminDelay()) !== 3n * DAY) fail("predict owner transfer delay");
  const p = await predict.params(); // read through PredictLogic: a bad library link would revert here
  if (!eq(p.treasury, master)) fail("predict treasury");
  if (p.completionPoints !== 100n || p.hitPoints !== 50n || p.referralBps !== 1000n || p.welcomePoints !== 100n) fail("predict point defaults");
  if (p.pointsPerCT !== 1000n || p.minAccountAge !== 7n * DAY || p.settleDelay !== 6n * 3600n) fail("predict conversion or timing defaults");
  if (p.maxResolveAfterClose !== 30n * DAY) fail("predict maxResolveAfterClose default (30 days, longer questions)");
  if ((await predict.paused())) fail("predict paused");
  if ((await predict.reserve()) !== 0n) fail("predict reserve should start empty");
  const pending = await predict.pendingParams();
  if (pending[1] !== 0n) fail("predict has pending params");

  const SA = await staking.DEFAULT_ADMIN_ROLE(), SP = await staking.PAUSER_ROLE();
  if (!eq(await staking.CT(), CT)) fail("staking CT");
  if (!eq(await staking.owner(), master) || !(await staking.hasRole(SA, master))) fail("staking owner");
  if (!eq(await staking.treasury(), master)) fail("staking treasury");
  if (!(await staking.hasRole(SP, master)) || !(await staking.hasRole(SP, pauser))) fail("staking pauser roles");
  for (const r of [SA, SP]) if (await staking.hasRole(r, deployer.address)) fail("deployer holds a staking role");
  if ((await staking.defaultAdminDelay()) !== 3n * DAY) fail("staking owner transfer delay");
  for (const [i, d] of [[0, 30n], [1, 90n], [2, 180n], [3, 365n]]) if ((await staking.lockDuration(i)) !== d * DAY) fail(`staking lock ${i} is not ${d} days (short lock build?)`);
  if ((await staking.minStake()) !== ethers.parseUnits("100", 18) || (await staking.minClaim()) !== ethers.parseUnits("10", 18)) fail("staking minimums");
  if ((await staking.maxOpenPositions()) !== 20n || (await staking.maxUserPrincipal()) !== ethers.parseUnits("1000000", 18)) fail("staking caps");
  if ((await staking.availableRewards()) !== 0n || (await staking.totalPrincipal()) !== 0n) fail("staking should start empty");
  if ((await ct.balanceOf(deployer.address)) !== 0n) fail("deployer holds CT");
  console.log("  post deploy checks passed: CT, owner, treasury, operator, pausers, no deployer roles, 3 day owner delay, defaults, real lock lengths, library link");

  const out = {
    network: dry ? "kaia-fork-dry-run" : "kaia", chainId: 8217, deployedAt: new Date().toISOString(),
    deployer: deployer.address, owner: master, treasury: master, operator, pauser, ct: CT, contracts,
  };
  console.log(JSON.stringify(out, null, 2));
  if (dry) { console.log("dry run: nothing written"); return; }
  writeJson(OUT, out);
  const sharedFile = path.join(SHARED_ADDRESSES, "kaia.json");
  const shared = readJson(sharedFile, {});
  writeJson(sharedFile, Object.assign(shared, {
    network: "kaia", chainId: 8217, ct: CT,
    predictLogic: libAddr, predict: contracts.predict.address, predictDeployBlock: contracts.predict.deployBlock,
    staking: contracts.staking.address, stakingDeployBlock: contracts.staking.deployBlock,
    stakingShortLock: null, stakingShortLockDeployBlock: null,
    owner: master, treasury: master, operator, pauser,
  }));
  console.log("Saved deployments/platform.kaia.json and platform/shared/addresses/kaia.json.");
  console.log("Next: node scripts/platform/verify-platform.js kaia");
  console.log("Then the master wallet (its own wallet app): setCaps(20, 1850000e18, 1000000e18) on staking (DECISIONS launch cap),");
  console.log("and plain CT transfers to fund staking interest (500,000 CT decided) and the predict reserve.");
}
main().catch((e) => { console.error(process.env.DEBUG_DEPLOY ? e : e.message || e); process.exitCode = 1; });
