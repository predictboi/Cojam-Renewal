// Writes platform/shared/test/fixtures/contract-time.json with weekOf / weekEnd values read from a real
// CojamPredict on the in process Hardhat network, so the TypeScript time rules are tested against the contract.
//   npx hardhat run scripts/platform/time-fixture.js
const fs = require("fs"), path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  if (network.name !== "hardhat") throw new Error("run on the in process hardhat network only");
  const [me] = await ethers.getSigners();
  const ct = await (await ethers.getContractFactory("PredictMockCT")).deploy(18);
  const lib = await (await ethers.getContractFactory("PredictLogic")).deploy();
  const predict = await (await ethers.getContractFactory("CojamPredict", { libraries: { PredictLogic: await lib.getAddress() } }))
    .deploy(await ct.getAddress(), me.address, me.address, me.address);

  // Week edges around Monday boundaries, epoch, today, and far future days.
  const days = new Set([0, 1, 2, 3, 4, 5, 10, 11, 12, 20000, 20781, 20782, 20783, 20784, 20785, 20786, 20787, 20788, 20789, 20790, 25000, 50000, 4294967295]);
  for (let i = 0; i < 40; i++) days.add(20770 + i);
  const weekOf = [];
  for (const d of [...days].sort((a, b) => a - b)) weekOf.push({ dayId: d, weekId: Number(await predict.weekOf(d)) });
  const weekEnd = [];
  for (const w of [0, 1, 2, 2968, 2969, 2970, 2971, 3000, 613566756]) weekEnd.push({ weekId: w, end: Number(await predict.weekEnd(w)) });
  const out = { source: "CojamPredict.weekOf / weekEnd on Hardhat", generatedAt: new Date().toISOString(), weekOf, weekEnd };
  const file = path.join(__dirname, "..", "..", "..", "platform", "shared", "test", "fixtures", "contract-time.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote", file, weekOf.length, "weekOf values,", weekEnd.length, "weekEnd values");
}
main().catch((e) => { console.error(e); process.exit(1); });
