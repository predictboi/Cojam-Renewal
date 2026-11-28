// Kaia mainnet deploy of CojamMigration (and CojamToken only if deployments/kaia.json records none). Nothing else: no funding (the master funds the swap itself
// from its own wallet app, in steps), no other transactions.
//   DEPLOYER_PRIVATE_KEY=0x.. CONFIRM_MAINNET=yes npx hardhat run scripts/deploy-mainnet.js --network kaia
// Dry run against a local fork of mainnet (no key, nothing broadcast):
//   FORK_DRY_RUN=1 npx hardhat run scripts/deploy-mainnet.js
// Addresses come from deployments/wallets.mainnet.json. The script stops before sending anything unless every check passes.
const { ethers, network } = require("hardhat");
const fs = require("fs"), path = require("path");

const OLD_CT = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const OLD_OWNER = "0xeb1622d0377da1f9815bfc6eff61afe3257a0518";
const SUPPLY = 2_000_000_000n * 10n ** 18n; // new CT fixed supply: 2,000,000,000 CT
const RATIO_NUM = 1n, RATIO_DEN = 5n; // 0.2 new CT per old CT (5 old CT give 1 new CT)
const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "wallets.mainnet.json"), "utf8"));

async function main() {
  const dry = process.env.FORK_DRY_RUN === "1";
  if (dry) {
    if (network.name !== "hardhat") throw new Error("FORK_DRY_RUN runs on the in-process hardhat network only");
    const url = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";
    const head = await new ethers.JsonRpcProvider(url, 8217, { staticNetwork: true }).getBlockNumber();
    await require("@nomicfoundation/hardhat-network-helpers").reset(url, head - 5); // a pinned block, as the fork tests do
    await network.provider.send("hardhat_mine", ["0x1"]); // calls at the fork block itself count as historical on Kaia
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [W.deployer] });
    await network.provider.send("hardhat_setBalance", [W.deployer, "0x1BC16D674EC80000"]); // 2 KAIA, the real balance
  }
  const { chainId } = await ethers.provider.getNetwork();
  if (!dry && chainId !== 8217n) throw new Error(`Kaia mainnet (8217) only; connected to ${chainId}.`);
  if (!dry && process.env.CONFIRM_MAINNET !== "yes") throw new Error("Set CONFIRM_MAINNET=yes to broadcast on mainnet.");

  const deployer = dry ? await ethers.getSigner(W.deployer) : (await ethers.getSigners())[0];
  if (!deployer) throw new Error("No signer: set DEPLOYER_PRIVATE_KEY.");
  const master = ethers.getAddress(W.master);
  // checks before any transaction
  const fail = (m) => { throw new Error("CHECK FAILED: " + m); };
  if (deployer.address.toLowerCase() !== W.deployer.toLowerCase()) fail(`signer ${deployer.address} is not the recorded deployer ${W.deployer}`);
  if (master.toLowerCase() === OLD_OWNER) fail("master is the old owner");
  if (master.toLowerCase() === deployer.address.toLowerCase()) fail("master must not be the deployer");
  if ((await ethers.provider.getCode(master)) !== "0x") fail("master has code; expected the founder's EOA");
  const old = await ethers.getContractAt("IERC20", OLD_CT);
  const oldSupply = await old.totalSupply();
  if (SUPPLY * RATIO_DEN < oldSupply * RATIO_NUM) fail(`old supply ${oldSupply} x 0.2 is above the new supply`);
  const bal = await ethers.provider.getBalance(deployer.address);
  if (bal < ethers.parseEther("0.3")) fail(`deployer has ${ethers.formatEther(bal)} KAIA; keep at least 0.3`);
  console.log(`${dry ? "DRY RUN on a mainnet fork" : "MAINNET"} | deployer ${deployer.address} (${ethers.formatEther(bal)} KAIA) | master ${master} | old CT supply ${ethers.formatUnits(oldSupply, 18)}`);

  // The token already exists on mainnet (deployments/kaia.json, deployed 2026-11-14 by OPS_TASK=deploy-token): reuse it
  // and deploy only the swap. Without a recorded token the script deploys both, as before.
  const KJ = path.join(__dirname, "..", "deployments", "kaia.json");
  const known = fs.existsSync(KJ) ? JSON.parse(fs.readFileSync(KJ, "utf8")) : {};
  let token, tRc = null, tokenAddr;
  if (known.newToken) {
    tokenAddr = ethers.getAddress(known.newToken);
    if ((await ethers.provider.getCode(tokenAddr)) === "0x") fail(`recorded new CT ${tokenAddr} has no code`);
    token = await ethers.getContractAt("CojamToken", tokenAddr, deployer);
    if ((await token.name()) !== "Cojam Token" || (await token.symbol()) !== "CT" || (await token.decimals()) !== 18n) fail("recorded token is not Cojam Token (CT), 18 decimals");
    console.log("CojamToken (existing)", tokenAddr);
  } else {
    token = await (await ethers.getContractFactory("CojamToken", deployer)).deploy(master);
    tRc = await token.deploymentTransaction().wait();
    tokenAddr = await token.getAddress();
    console.log("CojamToken", tokenAddr, "tx", tRc.hash, "block", tRc.blockNumber);
  }
  const mig = await (await ethers.getContractFactory("CojamMigration", deployer)).deploy(OLD_CT, tokenAddr, master);
  const mRc = await mig.deploymentTransaction().wait();
  const migAddr = await mig.getAddress();
  console.log("CojamMigration", migAddr, "tx", mRc.hash, "block", mRc.blockNumber);

  // post deploy checks
  if ((await token.totalSupply()) !== SUPPLY) fail("supply");
  // a fresh token must sit entirely with the master; an existing one may already have moved (pool, funding)
  if (tRc && (await token.balanceOf(master)) !== SUPPLY) fail("master does not hold the whole supply");
  if ((await token.balanceOf(deployer.address)) !== 0n) fail("deployer holds new CT");
  if ((await mig.MASTER()).toLowerCase() !== master.toLowerCase()) fail("swap MASTER");
  if ((await mig.OLD_TOKEN()).toLowerCase() !== OLD_CT) fail("swap OLD_TOKEN");
  if ((await mig.NEW_TOKEN()).toLowerCase() !== tokenAddr.toLowerCase()) fail("swap NEW_TOKEN");
  if ((await mig.availableReserve()) !== 0n) fail("reserve should be empty until the master funds it");
  if ((await mig.RATIO_NUM()) !== RATIO_NUM || (await mig.RATIO_DEN()) !== RATIO_DEN) fail("swap ratio is not 1/5");
  if ((await mig.LOCK_PERIOD()) !== 7n * 24n * 3600n) fail("swap lock is not 7 days");

  const out = {
    network: dry ? "kaia-fork-dry-run" : "kaia", chainId: 8217, deployedAt: new Date().toISOString(),
    deployer: deployer.address, master, oldToken: OLD_CT, newToken: tokenAddr, migration: migAddr,
    migrationDeployBlock: mRc.blockNumber, tokenTx: tRc ? tRc.hash : (known.token && known.token.tx) || null, migrationTx: mRc.hash,
    windowStart: (await mig.WINDOW_START()).toString(), windowEnd: (await mig.WINDOW_END()).toString(),
    gasUsed: { token: tRc ? tRc.gasUsed.toString() : null, migration: mRc.gasUsed.toString() },
  };
  if (known.token) out.token = known.token; // keep the recorded token details
  console.log(JSON.stringify(out, null, 2));
  if (!dry) {
    fs.writeFileSync(KJ, JSON.stringify(Object.assign({}, known, out), null, 2) + "\n");
    console.log("Saved deployments/kaia.json. Next: node scripts/verify-sourcify.js 8217", tokenAddr, "CojamToken", migAddr, "CojamMigration");
  }
}
main().catch((e) => { console.error(process.env.DEBUG_DEPLOY ? e : (e.message || e)); process.exitCode = 1; });
