// Live release test on Kairos with a 1 minute lock (CojamMigrationShortLock, test only).
//   OLD_TOKEN_ADDRESS=0x.. NEW_TOKEN_ADDRESS=0x.. npx hardhat run scripts/shortlock-kairos.js --network kairos
// The signer is the master of the existing Kairos new CT and holds test old CT. Steps:
//   1. deploy the short lock swap and fund it with 1,000,000 new CT from the master
//   2. holder A (the signer) swaps 10,000 old CT: its lot is left for the keeper to release
//   3. holder B (a fresh random wallet, given 2 KAIA and 5,000 old CT) swaps, waits for the unlock and claims itself
// Prints the swap address, deploy block and B's address for the keeper run.
const { ethers } = require("hardhat");
const fmt = (v) => ethers.formatUnits(v, 18);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 1001n) throw new Error("Kairos only");
  const [A] = await ethers.getSigners();
  const oldT = await ethers.getContractAt("MockOldCojam", process.env.OLD_TOKEN_ADDRESS);
  const newT = await ethers.getContractAt("CojamToken", process.env.NEW_TOKEN_ADDRESS);

  const mig = await (await ethers.getContractFactory("CojamMigrationShortLock")).deploy(oldT, newT, A.address);
  const rc = await mig.deploymentTransaction().wait();
  const addr = await mig.getAddress();
  console.log("short lock swap", addr, "block", rc.blockNumber, "lock", (await mig.LOCK_PERIOD()).toString(), "s");
  await (await newT.transfer(addr, ethers.parseUnits("1000000", 18))).wait();

  // holder A: swap, keeper releases later
  const a = ethers.parseUnits("10000", 18);
  await (await oldT.approve(addr, a)).wait();
  await (await mig.migrate(a)).wait();
  console.log("A swapped 10,000: new", fmt(await newT.balanceOf(A.address)), "pending", fmt(await mig.pendingOf(A.address)));

  // holder B: fresh wallet, claims itself
  const B = ethers.Wallet.createRandom().connect(ethers.provider);
  await (await A.sendTransaction({ to: B.address, value: ethers.parseEther("2") })).wait();
  await (await oldT.transfer(B.address, ethers.parseUnits("5000", 18))).wait();
  const b = ethers.parseUnits("5000", 18);
  await (await oldT.connect(B).approve(addr, b)).wait();
  const tx = await mig.connect(B).migrate(b); const r2 = await tx.wait();
  const lot = await mig.lotOf(B.address, 0);
  console.log("B", B.address, "swapped 5,000: new", fmt(await newT.balanceOf(B.address)), "lot", fmt(lot[0]), "unlocks", new Date(Number(lot[1]) * 1000).toISOString());
  try { await mig.connect(B).claim.staticCall(10); console.log("UNEXPECTED: claim before unlock succeeded"); }
  catch (e) { console.log("claim before unlock reverts as expected:", e.shortMessage || e.message.split("\n")[0]); }
  const wait = Number(lot[1]) * 1000 - Date.now() + 8000;
  console.log("waiting", Math.round(wait / 1000), "s for the unlock");
  await sleep(Math.max(0, wait));
  await (await mig.connect(B).claim(10)).wait();
  console.log("B claimed: new", fmt(await newT.balanceOf(B.address)), "pending", fmt(await mig.pendingOf(B.address)));
  console.log(JSON.stringify({ swap: addr, deployBlock: rc.blockNumber, holderA: A.address, holderB: B.address }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
