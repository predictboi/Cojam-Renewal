// Kaia mainnet TEST swap: CojamMigrationShortLock (the real swap code with a 1 minute lock) against the real old CT and
// the live new CT, MASTER = the founder's master wallet (so it can withdraw what it funds). For a small end to end test
// on mainnet before launch. Not the launch swap. Real old CT swapped into it stays in it forever: use a few CT only.
//   Render cojam-ops: OPS_TASK=deploy-test-swap, CONFIRM_MAINNET=yes, Trigger Run
//   dry run on a mainnet fork, nothing broadcast: FORK_DRY_RUN=1 npx hardhat run scripts/deploy-test-swap-mainnet.js
const { ethers, network } = require("hardhat");
const fs = require("fs"), path = require("path");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const OLD_CT = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "wallets.mainnet.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "kaia.json"), "utf8"));
const RPC = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";

async function main() {
  const dry = process.env.FORK_DRY_RUN === "1";
  let deployer;
  if (dry) {
    const head = await new ethers.JsonRpcProvider(RPC, 8217, { staticNetwork: true }).getBlockNumber();
    await helpers.reset(RPC, head - 5);
    await network.provider.send("hardhat_mine", ["0x1"]);
    await helpers.impersonateAccount(W.deployer);
    deployer = await ethers.getSigner(W.deployer);
  } else {
    const { chainId } = await ethers.provider.getNetwork();
    if (chainId !== 8217n) throw new Error(`Kaia mainnet (8217) only; connected to ${chainId}.`);
    if (process.env.CONFIRM_MAINNET !== "yes") throw new Error("Set CONFIRM_MAINNET=yes to broadcast on mainnet.");
    if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("Set DEPLOYER_PRIVATE_KEY.");
    deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  }
  const fail = (m) => { throw new Error("CHECK FAILED: " + m); };
  if (deployer.address.toLowerCase() !== W.deployer.toLowerCase()) fail("signer is not the recorded deployer");
  if (!K.newToken) fail("no live new CT recorded in deployments/kaia.json");
  const nonce = await ethers.provider.getTransactionCount(deployer.address);
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce });
  console.log(`${dry ? "DRY RUN on a mainnet fork" : "MAINNET"} | test swap (1 minute lock) will be at ${predicted} | new CT ${K.newToken} | master ${W.master}`);
  const swap = await (await ethers.getContractFactory("CojamMigrationShortLock", deployer)).deploy(OLD_CT, K.newToken, W.master);
  const rc = await swap.deploymentTransaction().wait();
  const addr = await swap.getAddress();
  if ((await swap.LOCK_PERIOD()) !== 60n) fail("lock is not 1 minute");
  if ((await swap.MASTER()).toLowerCase() !== W.master.toLowerCase()) fail("MASTER");
  if ((await swap.NEW_TOKEN()).toLowerCase() !== K.newToken.toLowerCase()) fail("NEW_TOKEN");
  const [credit, instant, locked] = await swap.previewSwap(ethers.parseUnits("10", 18));
  console.log(JSON.stringify({ testSwap: addr, block: rc.blockNumber, tx: rc.hash, lockSeconds: 60, master: W.master, newToken: K.newToken,
    example: `10 old CT -> ${ethers.formatUnits(credit, 18)} new CT: ${ethers.formatUnits(instant, 18)} now, ${ethers.formatUnits(locked, 18)} after 1 minute` }, null, 2));
  console.log(`PASS: test swap ${addr}. Next: the master sends 4 new CT to it, then swap 10 old CT on the test page.`);
}
main().catch((e) => { console.error("FAILED:", e.message || e); process.exitCode = 1; });
