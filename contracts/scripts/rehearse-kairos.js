// Kairos rehearsal of the holder flow against deployed contracts (chain 1001 only).
//   OLD_TOKEN_ADDRESS=0x.. NEW_TOKEN_ADDRESS=0x.. MIGRATION_ADDRESS=0x.. SWAP_AMOUNT=10000 \
//   npx hardhat run scripts/rehearse-kairos.js --network kairos
// The signer (PRIVATE_KEY) acts as a holder: it needs test old CT (the mock old CT mints to the deployer) and KAIA.
// Steps: read state, approve the exact amount, migrate, then check the 10% arrived and a 90% lot was recorded.
// Optional: CLAIM=1 releases matured lots (only after 7 days), WITHDRAW_AMOUNT=n withdraws reserve as the master.
const { ethers, network } = require("hardhat");

const fmt = (v) => ethers.formatUnits(v, 18);

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 1001n) throw new Error(`Kairos (1001) only; connected to ${chainId}.`);
  const [me] = await ethers.getSigners();
  const need = (k) => { const v = process.env[k]; if (!v || !ethers.isAddress(v)) throw new Error(`Set ${k}`); return v; };
  const oldT = await ethers.getContractAt("MockOldCojam", need("OLD_TOKEN_ADDRESS"));
  const newT = await ethers.getContractAt("CojamToken", need("NEW_TOKEN_ADDRESS"));
  const mig = await ethers.getContractAt("CojamMigration", need("MIGRATION_ADDRESS"));

  const state = async (label) => {
    const [o, n, res, owed, lots, pend] = await Promise.all([
      oldT.balanceOf(me.address), newT.balanceOf(me.address), mig.availableReserve(), mig.totalOwed(),
      mig.lotCount(me.address), mig.pendingOf(me.address),
    ]);
    console.log(`${label}: old ${fmt(o)} | new ${fmt(n)} | reserve ${fmt(res)} | owed ${fmt(owed)} | lots ${lots} | pending ${fmt(pend)}`);
    return { o, n };
  };

  const before = await state("before");
  const amt = ethers.parseUnits(process.env.SWAP_AMOUNT || "0", 18);
  if (amt > 0n) {
    let tx = await oldT.approve(await mig.getAddress(), amt); await tx.wait();
    console.log("approve", tx.hash);
    tx = await mig.migrate(amt); const rc = await tx.wait();
    console.log("migrate", tx.hash, "gas", rc.gasUsed.toString());
    const after = await state("after");
    const [instant, locked] = await mig.previewSplit(amt);
    if (after.n - before.n !== instant) throw new Error("10% did not arrive");
    if (before.o - after.o !== amt) throw new Error("old CT not taken exactly");
    const n = await mig.lotCount(me.address);
    const lot = await mig.lotOf(me.address, n - 1n);
    console.log(`lot ${n - 1n}: ${fmt(lot[0])} new CT unlocks ${new Date(Number(lot[1]) * 1000).toISOString()} (expected ${fmt(locked)})`);
  }
  if (process.env.CLAIM === "1") {
    const tx = await mig.claim(25); await tx.wait(); console.log("claim", tx.hash); await state("after claim");
  }
  if (process.env.WITHDRAW_AMOUNT) {
    const tx = await mig.withdraw(ethers.parseUnits(process.env.WITHDRAW_AMOUNT, 18)); await tx.wait();
    console.log("withdraw", tx.hash); await state("after withdraw");
  }
  console.log(`explorer: https://kairos.kaiascan.io/address/${await mig.getAddress()}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
