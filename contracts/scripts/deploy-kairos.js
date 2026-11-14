// Deploys the Cojam migration to the Kairos testnet (chain id 1001).
//   npx hardhat run scripts/deploy-kairos.js --network kairos
// Reads PRIVATE_KEY, KAIROS_RPC_URL, MASTER_ADDRESS, OLD_TOKEN_ADDRESS and FUND_AMOUNT
// from the environment (see .env.example).
//
// Order: (mock old CT if OLD_TOKEN_ADDRESS is empty), CojamToken(master), then
// CojamMigration(old, new, master). The whole new supply is minted to MASTER_ADDRESS.
// The swap starts empty: the master funds it with plain transfers of new CT. If the
// deployer is the master and FUND_AMOUNT is set, this script does that transfer.
// The migration window opens in the swap's deploy block and lasts 365 days; from
// WINDOW_END + 30 days anyone can sweep the unowed remainder back to the master.
// Neither contract has an owner or any admin function.
// Mainnet is refused on purpose: a mainnet deploy is a separate, reviewed step.
const { ethers, network } = require("hardhat");

const OLD_CT_MAINNET = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const OLD_OWNER = "0xeb1622d0377da1f9815bfc6eff61afe3257a0518";
const SUPPLY = 4_083_262_533_956_000_100_000_000_000n;

function readAddress(name, value) {
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non zero address (got "${value}").`);
  }
  if (value.toLowerCase() === OLD_OWNER) {
    throw new Error(`${name} must not be the old Cojam owner ${OLD_OWNER}; it is unrelated to the relaunch.`);
  }
  return ethers.getAddress(value.toLowerCase());
}

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 1001n && network.name !== "hardhat") {
    throw new Error(`This script deploys to Kairos (1001) only; connected to chain ${chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer: set PRIVATE_KEY in .env (a test key only).");

  // On the in-process Hardhat network (deploy:local) the master defaults to the deployer.
  const masterRaw = process.env.MASTER_ADDRESS || (network.name === "hardhat" ? deployer.address : "");
  if (!masterRaw) throw new Error("Set MASTER_ADDRESS: the wallet that receives the whole new CT supply.");
  const master = readAddress("MASTER_ADDRESS", masterRaw);
  const deployerIsMaster = master === deployer.address;

  const fundRaw = (process.env.FUND_AMOUNT || "").trim();
  let fund = 0n;
  if (fundRaw !== "" && fundRaw !== "0") {
    try {
      fund = ethers.parseUnits(fundRaw, 18); // whole CT, for example "1000000"
    } catch {
      throw new Error(`FUND_AMOUNT must be an amount of CT such as "1000000" (got "${fundRaw}").`);
    }
    if (fund > SUPPLY) throw new Error("FUND_AMOUNT is larger than the whole supply.");
    if (!deployerIsMaster) {
      throw new Error("FUND_AMOUNT needs the deployer to be the master. Otherwise the master funds the swap itself.");
    }
  }

  let oldAddress = process.env.OLD_TOKEN_ADDRESS || "";
  if (oldAddress.toLowerCase() === OLD_CT_MAINNET) throw new Error("OLD_TOKEN_ADDRESS is the mainnet token.");
  if (!oldAddress) {
    const mock = await (await ethers.getContractFactory("MockOldCojam")).deploy(SUPPLY);
    await mock.waitForDeployment();
    oldAddress = await mock.getAddress();
    console.log(`MockOldCojam (test old CT) deployed: ${oldAddress}`);
  }

  const token = await (await ethers.getContractFactory("CojamToken")).deploy(master);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const migration = await (await ethers.getContractFactory("CojamMigration")).deploy(oldAddress, tokenAddress, master);
  await migration.waitForDeployment();
  const migrationAddress = await migration.getAddress();
  const deployReceipt = await migration.deploymentTransaction().wait();

  let fundTx = null;
  if (fund > 0n) {
    const tx = await token.connect(deployer).transfer(migrationAddress, fund);
    fundTx = (await tx.wait()).hash;
  }

  // Post deploy checks.
  const supply = await token.totalSupply();
  const masterBalance = await token.balanceOf(master);
  const reserve = await token.balanceOf(migrationAddress);
  const deployerBalance = await token.balanceOf(deployer.address);
  if (supply !== SUPPLY) throw new Error("Total supply is not the expected fixed supply");
  if (masterBalance !== supply - fund) throw new Error("Master does not hold the full supply minus the funded amount");
  if (reserve !== fund) throw new Error("Swap balance differs from the funded amount");
  if (!deployerIsMaster && deployerBalance !== 0n) throw new Error("Deployer holds new CT");
  if ((await migration.NEW_TOKEN()) !== tokenAddress) throw new Error("Swap points at another new token");
  if ((await migration.OLD_TOKEN()).toLowerCase() !== oldAddress.toLowerCase()) throw new Error("Swap points at another old token");
  if ((await migration.MASTER()) !== master) throw new Error("Swap MASTER is not MASTER_ADDRESS");
  if ((await migration.availableReserve()) !== fund) throw new Error("availableReserve differs from the funded amount");

  if ((await ethers.provider.getCode(master)) === "0x") {
    console.warn(`NOTE: MASTER_ADDRESS ${master} has no code (an EOA). On mainnet a Safe multisig is recommended.`);
  }

  console.log(JSON.stringify({
    network: network.name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    oldToken: oldAddress,
    newToken: tokenAddress,
    migration: migrationAddress,
    migrationDeployBlock: deployReceipt.blockNumber,
    master,
    windowStart: (await migration.WINDOW_START()).toString(),
    windowEnd: (await migration.WINDOW_END()).toString(),
    sweepOpensAt: (await migration.SWEEP_OPENS_AT()).toString(),
    totalSupply: supply.toString(),
    funded: fund.toString(),
    fundTx,
    masterBalance: masterBalance.toString(),
    availableReserve: (await migration.availableReserve()).toString(),
  }, null, 2));
  console.log("Verify both contracts on Kaiascan (Kairos). CojamToken constructor arg = master;");
  console.log("CojamMigration constructor args = old token, new token, master.");
  if (fund === 0n) console.log("The swap holds no new CT yet: migrate reverts InsufficientReserve until the master funds it.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
