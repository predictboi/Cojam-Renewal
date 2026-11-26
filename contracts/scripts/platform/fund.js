// Funds the platform contracts with plain CT transfers (no approve, no special function: CT sent to CojamPredict
// becomes conversion and airdrop reserve, CT sent to CojamStaking becomes reward CT for interest).
//   npx hardhat run scripts/platform/fund.js --network kairos
//   FUND_PREDICT=100000 FUND_STAKING=100000 FUND_SHORTLOCK=100000 npx hardhat run scripts/platform/fund.js --network kairos
// Amounts are whole CT; 0 skips a contract. Kairos only: on mainnet the master wallet funds the contracts itself from
// its wallet app (its key never sits on a server), so with --network kaia this script only prints the transfers to make.
const { ethers, network } = require("hardhat");
const path = require("path");
const { DEPLOYMENTS, readJson, writeJson, send } = require("./lib");

async function main() {
  const net = network.name === "kaia" ? "kaia" : "kairos";
  const file = path.join(DEPLOYMENTS, `platform.${net}.json`);
  const d = readJson(file);
  if (!d) throw new Error(`no ${file}: deploy first`);
  const c = d.contracts;
  const plan = [
    ["predict", c.predict, process.env.FUND_PREDICT ?? "100000"],
    ["staking", c.staking, process.env.FUND_STAKING ?? "100000"],
    ["stakingShortLock", c.stakingShortLock, process.env.FUND_SHORTLOCK ?? "100000"],
  ].filter(([, rec, amt]) => rec && Number(amt) > 0);

  if (net === "kaia") {
    console.log("Mainnet: the master wallet sends these plain CT transfers from its wallet app:");
    for (const [key, rec, amt] of plan) console.log(`  ${amt} CT -> ${key} ${rec.address}`);
    return;
  }
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 1001n) throw new Error(`Kairos only; connected to ${chainId}`);
  const [me] = await ethers.getSigners();
  const ct = await ethers.getContractAt("CojamToken", c.ct.address);
  d.funding = d.funding || [];
  for (const [key, rec, amt] of plan) {
    const value = ethers.parseUnits(String(amt), 18);
    const { gas } = await send(`transfer ${amt} CT -> ${key}`, () => ct.transfer(rec.address, value));
    d.funding.push({ to: key, address: rec.address, amountCt: String(amt), tx: gas.tx, block: gas.block, gasUsed: gas.gasUsed, at: new Date().toISOString() });
  }
  const p = await ethers.getContractAt("CojamPredict", c.predict.address);
  console.log("predict reserve", ethers.formatUnits(await p.reserve(), 18), "CT");
  for (const key of ["staking", "stakingShortLock"]) {
    if (!c[key]) continue;
    const s = await ethers.getContractAt("CojamStaking", c[key].address);
    console.log(key, "availableRewards", ethers.formatUnits(await s.availableRewards(), 18), "CT");
  }
  console.log("signer CT left", ethers.formatUnits(await ct.balanceOf(me.address), 18));
  writeJson(file, d);
}
main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
