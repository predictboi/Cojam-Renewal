// Deploys the Cojam migration to the Kairos testnet (chain id 1001).
//   npx hardhat run scripts/deploy-kairos.js --network kairos
// Reads PRIVATE_KEY, KAIROS_RPC_URL, TREASURY_ADDRESS, OLD_TOKEN_ADDRESS and
// GRACE_PERIOD_DAYS from the environment (see .env.example).
// The migration window opens in the deploy block and lasts 365 days.
// Mainnet is refused on purpose: a mainnet deploy is a separate, reviewed step.
const { ethers, network } = require("hardhat");

const OLD_CT_MAINNET = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const OLD_OWNER = "0xeb1622d0377da1f9815bfc6eff61afe3257a0518";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 1001n && network.name !== "hardhat") {
    throw new Error(`This script deploys to Kairos (1001) only; connected to chain ${chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer: set PRIVATE_KEY in .env (a test key only).");

  const treasury = process.env.TREASURY_ADDRESS || "";
  if (!ethers.isAddress(treasury) || treasury === ethers.ZeroAddress) {
    throw new Error("Set TREASURY_ADDRESS to the new relaunch multisig (Kaia Safe).");
  }
  const t = treasury.toLowerCase();
  if (t === deployer.address.toLowerCase()) throw new Error("TREASURY_ADDRESS must not be the deployer EOA.");
  if (t === OLD_OWNER) throw new Error("TREASURY_ADDRESS must not be the old Cojam owner; use the new multisig.");
  if ((await ethers.provider.getCode(treasury)) === "0x") {
    console.warn("WARNING: TREASURY_ADDRESS has no code. On mainnet it must be the new Safe multisig.");
  }

  let oldAddress = process.env.OLD_TOKEN_ADDRESS || "";
  if (oldAddress.toLowerCase() === OLD_CT_MAINNET) throw new Error("OLD_TOKEN_ADDRESS is the mainnet token.");
  if (!oldAddress) {
    const supply = 4_083_262_533_956_000_100_000_000_000n;
    const mock = await (await ethers.getContractFactory("MockOldCojam")).deploy(supply);
    await mock.waitForDeployment();
    oldAddress = await mock.getAddress();
    console.log(`MockOldCojam (test old CT) deployed: ${oldAddress}`);
  }

  const graceDays = BigInt(process.env.GRACE_PERIOD_DAYS || "30");
  const grace = graceDays * 86400n;

  const Migration = await ethers.getContractFactory("CojamMigration");
  const migration = await Migration.deploy(oldAddress, treasury, grace);
  await migration.waitForDeployment();
  const migrationAddress = await migration.getAddress();
  const tokenAddress = await migration.NEW_TOKEN();
  const token = await ethers.getContractAt("CojamToken", tokenAddress);

  // Post deploy checks: the reserve holds the whole supply and the deployer holds no new CT.
  const supply = await token.totalSupply();
  const reserve = await token.balanceOf(migrationAddress);
  const deployerBalance = await token.balanceOf(deployer.address);
  if (reserve !== supply) throw new Error("Reserve does not hold the whole supply");
  if (deployerBalance !== 0n) throw new Error("Deployer holds new CT");

  console.log(JSON.stringify({
    network: network.name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    oldToken: oldAddress,
    newToken: tokenAddress,
    migration: migrationAddress,
    treasury,
    windowStart: (await migration.WINDOW_START()).toString(),
    windowEnd: (await migration.WINDOW_END()).toString(),
    sweepOpensAt: (await migration.SWEEP_OPENS_AT()).toString(),
    totalSupply: supply.toString(),
    reserve: reserve.toString(),
  }, null, 2));
  console.log("Verify both contracts on Kaiascan (Kairos). CojamToken constructor arg = migration address.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
