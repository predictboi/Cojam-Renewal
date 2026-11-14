// One entry point for jobs that need a mainnet key, run on Render as the cojam-ops cron job (manual "Trigger Run").
// Keys come only from environment variables set in the Render dashboard: DEPLOYER_PRIVATE_KEY, MAINNET_TEST_PRIVATE_KEY.
//   npx hardhat run scripts/ops.js --network kaia
// OPS_TASK picks the job:
//   check             (default) addresses, KAIA and old CT balances, nonces. Sends nothing.
//   rehearse-mainnet  small real rehearsal with the test wallet: deploys "Cojam Rehearsal" (CTR) and a 1 minute lock
//                     copy of the swap, funds it, swaps REHEARSAL_AMOUNT old CT (default 100), checks the 10%,
//                     waits for the unlock, releases the 90% with claimFor from the deployer (as the keeper would),
//                     checks the full amount, then withdraws the rest of the reserve. The swapped old CT stays in the
//                     rehearsal contract forever. Needs CONFIRM_MAINNET=yes.
//   deploy-mainnet    the real launch deploy (scripts/deploy-mainnet.js). Needs CONFIRM_MAINNET=yes. Launch day only.
// Local dry run on a fork of mainnet, nothing broadcast (impersonates the test address, or a fresh one):
//   OPS_TASK=rehearse-mainnet OPS_TEST_ADDRESS=0x.. npx hardhat run scripts/ops.js
const { ethers, network } = require("hardhat");
const fs = require("fs"), path = require("path");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const OLD_CT = "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b";
const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "wallets.mainnet.json"), "utf8"));
const RPC = process.env.KAIA_RPC_URL || "https://public-en.node.kaia.io";
const fmt = (v) => ethers.formatUnits(v, 18);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function wallets(fork) {
  if (fork) {
    const head = await new ethers.JsonRpcProvider(RPC, 8217, { staticNetwork: true }).getBlockNumber();
    await helpers.reset(RPC, head - 5);
    await network.provider.send("hardhat_mine", ["0x1"]);
    const testAddr = process.env.OPS_TEST_ADDRESS || ethers.Wallet.createRandom().address;
    for (const a of [W.deployer, testAddr]) { await helpers.impersonateAccount(a); await helpers.setBalance(a, ethers.parseEther("2")); }
    // give the test address old CT by writing the balances mapping (slot 1, as in the fork tests) when it has too little
    const old = await ethers.getContractAt("IERC20", OLD_CT);
    const want = ethers.parseUnits(process.env.REHEARSAL_AMOUNT || "100", 18);
    if ((await old.balanceOf(testAddr)) < want) {
      const key = ethers.solidityPackedKeccak256(["uint256", "uint256"], [testAddr, 1]);
      await network.provider.send("hardhat_setStorageAt", [OLD_CT, key, ethers.toBeHex(want, 32)]);
    }
    return { deployer: await ethers.getSigner(W.deployer), tester: await ethers.getSigner(testAddr) };
  }
  const p = ethers.provider;
  return {
    deployer: process.env.DEPLOYER_PRIVATE_KEY ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, p) : null,
    tester: process.env.MAINNET_TEST_PRIVATE_KEY ? new ethers.Wallet(process.env.MAINNET_TEST_PRIVATE_KEY, p) : null,
  };
}

async function check({ deployer, tester }) {
  const old = await ethers.getContractAt("IERC20", OLD_CT);
  for (const [name, w] of [["deployer", deployer], ["test wallet", tester]]) {
    if (!w) { log(`${name}: no key set`); continue; }
    const [k, o, n] = await Promise.all([ethers.provider.getBalance(w.address), old.balanceOf(w.address), ethers.provider.getTransactionCount(w.address)]);
    log(`${name}: ${w.address} | ${ethers.formatEther(k)} KAIA | ${fmt(o)} old CT | nonce ${n}`);
  }
  if (deployer && deployer.address.toLowerCase() !== W.deployer.toLowerCase()) log(`WARNING: DEPLOYER_PRIVATE_KEY is ${deployer.address}, not the recorded deployer ${W.deployer}`);
}

async function rehearse({ deployer, tester }, fork) {
  if (!tester) throw new Error("Set MAINNET_TEST_PRIVATE_KEY (the test wallet).");
  const amt = ethers.parseUnits(process.env.REHEARSAL_AMOUNT || "100", 18);
  if (amt > ethers.parseUnits("10000", 18)) throw new Error("REHEARSAL_AMOUNT above 10,000 refused: this old CT is locked in the rehearsal contract forever.");
  const old = await ethers.getContractAt("IERC20", OLD_CT);
  const have = await old.balanceOf(tester.address);
  if (have < amt) throw new Error(`test wallet has ${fmt(have)} old CT, needs ${fmt(amt)}`);
  if ((await ethers.provider.getBalance(tester.address)) < ethers.parseEther("0.5")) throw new Error("test wallet needs at least 0.5 KAIA");
  log(`rehearsal on ${fork ? "a mainnet fork (dry run)" : "Kaia MAINNET"} | test wallet ${tester.address} | ${fmt(amt)} old CT`);
  const out = { mode: fork ? "fork-dry-run" : "mainnet", testWallet: tester.address, amount: fmt(amt), tx: {} };
  const wait = async (label, p) => { const tx = await p; const rc = await tx.wait(); out.tx[label] = tx.hash; log(label, tx.hash, "gas", rc.gasUsed.toString()); return rc; };

  const tok = await (await ethers.getContractFactory("CojamRehearsalToken", tester)).deploy(tester.address);
  await tok.waitForDeployment(); out.rehearsalToken = await tok.getAddress(); log("Cojam Rehearsal (CTR)", out.rehearsalToken);
  const swap = await (await ethers.getContractFactory("CojamMigrationShortLock", tester)).deploy(OLD_CT, out.rehearsalToken, tester.address);
  await swap.waitForDeployment(); out.rehearsalSwap = await swap.getAddress(); log("rehearsal swap (1 minute lock)", out.rehearsalSwap);

  await wait("fund", tok.transfer(out.rehearsalSwap, amt * 2n));
  const before = await tok.balanceOf(tester.address);
  await wait("approve", old.connect(tester).approve(out.rehearsalSwap, amt));
  await wait("migrate", swap.migrate(amt));
  const [instant, locked] = await swap.previewSplit(amt);
  const got = (await tok.balanceOf(tester.address)) - before;
  if (got !== instant) throw new Error(`10% check failed: got ${fmt(got)}, expected ${fmt(instant)}`);
  log(`10% arrived: ${fmt(got)} CTR | locked ${fmt(await swap.pendingOf(tester.address))}`);
  try { await swap.claimFor.staticCall(tester.address, 10); throw new Error("release before unlock did not revert"); }
  catch (e) { if (/did not revert/.test(e.message)) throw e; log("release before unlock reverts, as it must"); }

  const lot = await swap.lotOf(tester.address, 0);
  if (fork) await helpers.time.increaseTo(Number(lot[1]) + 1);
  else { const ms = Number(lot[1]) * 1000 - Date.now() + 15000; log(`waiting ${Math.round(ms / 1000)} s for the unlock`); await sleep(Math.max(0, ms)); }
  const releaser = deployer || tester;
  await wait("release (claimFor)", swap.connect(releaser).claimFor(tester.address, 10));
  const total = (await tok.balanceOf(tester.address)) - before;
  if (total !== amt) throw new Error(`full amount check failed: ${fmt(total)} of ${fmt(amt)}`);
  log(`90% released by ${releaser === deployer ? "the deployer (keeper stand in)" : "the test wallet"}: total ${fmt(total)} CTR`);
  await wait("withdraw rest", swap.withdraw(await swap.availableReserve()));
  out.oldCtLockedForever = fmt(await old.balanceOf(out.rehearsalSwap));
  out.result = "PASS";
  console.log(JSON.stringify(out, null, 2));
}

async function main() {
  const task = process.env.OPS_TASK || "check";
  const fork = network.name === "hardhat";
  if (!fork) {
    const { chainId } = await ethers.provider.getNetwork();
    if (chainId !== 8217n) throw new Error(`ops runs on Kaia mainnet (8217); connected to ${chainId}`);
  }
  if (task === "deploy-mainnet") return require("./deploy-mainnet.js");
  const w = await wallets(fork);
  if (task === "check") return check(w);
  if (task === "rehearse-mainnet") {
    if (!fork && process.env.CONFIRM_MAINNET !== "yes") throw new Error("Set CONFIRM_MAINNET=yes to send real transactions.");
    await check(w);
    return rehearse(w, fork);
  }
  throw new Error(`unknown OPS_TASK ${task}`);
}
main().catch((e) => { console.error("FAILED:", e.message || e); process.exitCode = 1; });
