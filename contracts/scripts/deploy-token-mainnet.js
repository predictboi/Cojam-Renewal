// Kaia mainnet deploy of CojamToken ONLY (2,000,000,000 CT, 18 decimals, all to the master). The swap contract is a
// separate, later deploy: the 1 year swap window starts only when the swap is deployed, never with the token.
//   Render cojam-ops: OPS_TASK=deploy-token, CONFIRM_MAINNET=yes, Trigger Run
//   or: DEPLOYER_PRIVATE_KEY=0x.. CONFIRM_MAINNET=yes npx hardhat run scripts/deploy-token-mainnet.js --network kaia
//   dry run on a local mainnet fork, nothing broadcast: FORK_DRY_RUN=1 npx hardhat run scripts/deploy-token-mainnet.js
const { ethers, network } = require("hardhat");
const fs = require("fs"), path = require("path");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const OLD_OWNER = "0xeb1622d0377da1f9815bfc6eff61afe3257a0518";
const SUPPLY = 2_000_000_000n * 10n ** 18n;
const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "wallets.mainnet.json"), "utf8"));
const RPC = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";

async function main() {
  const dry = process.env.FORK_DRY_RUN === "1";
  let deployer;
  if (dry) {
    if (network.name !== "hardhat") throw new Error("FORK_DRY_RUN runs on the in-process hardhat network only");
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
  const master = ethers.getAddress(W.master);
  if (deployer.address.toLowerCase() !== W.deployer.toLowerCase()) fail(`signer ${deployer.address} is not the recorded deployer ${W.deployer}`);
  if (master.toLowerCase() === OLD_OWNER) fail("master is the old owner");
  if (master.toLowerCase() === deployer.address.toLowerCase()) fail("master must not be the deployer");
  if ((await ethers.provider.getCode(master)) !== "0x") fail("master has code; expected the founder's EOA");
  const bal = await ethers.provider.getBalance(deployer.address);
  if (bal < ethers.parseEther("0.1")) fail(`deployer has ${ethers.formatEther(bal)} KAIA; keep at least 0.1`);
  const nonce = await ethers.provider.getTransactionCount(deployer.address);
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce });
  console.log(`${dry ? "DRY RUN on a mainnet fork" : "MAINNET"} | deployer ${deployer.address} (${ethers.formatEther(bal)} KAIA, nonce ${nonce}) | master ${master} | token will be at ${predicted}`);

  const token = await (await ethers.getContractFactory("CojamToken", deployer)).deploy(master);
  const rc = await token.deploymentTransaction().wait();
  const addr = await token.getAddress();
  if (addr.toLowerCase() !== predicted.toLowerCase()) fail("address differs from the prediction");
  const [name, symbol, dec, supply, mbal, dbal] = await Promise.all([token.name(), token.symbol(), token.decimals(), token.totalSupply(), token.balanceOf(master), token.balanceOf(deployer.address)]);
  if (name !== "Cojam Token" || symbol !== "CT") fail("name or symbol");
  if (dec !== 18n) fail("decimals");
  if (supply !== SUPPLY || mbal !== SUPPLY) fail("the master does not hold the whole 2,000,000,000 CT");
  if (dbal !== 0n) fail("deployer holds CT");
  const out = { network: dry ? "kaia-fork-dry-run" : "kaia", chainId: 8217, deployedAt: new Date().toISOString(), deployer: deployer.address, master,
    newToken: addr, tokenTx: rc.hash, tokenBlock: rc.blockNumber, name, symbol, decimals: 18, totalSupply: "2000000000", gasUsed: rc.gasUsed.toString() };
  console.log(JSON.stringify(out, null, 2));
  console.log(`PASS: ${name} (${symbol}) ${addr}, 2,000,000,000 CT with 18 decimals held by the master ${master}`);
  if (!dry) console.log(`Explorer: https://kaiascan.io/token/${addr}`);
}
main().catch((e) => { console.error("FAILED:", e.message || e); process.exitCode = 1; });
