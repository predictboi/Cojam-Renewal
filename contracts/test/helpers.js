const { ethers } = require("hardhat");

// Old CT totalSupply() on Kaia mainnet (read 2026-11-12): 4,083,262,533.9560001 CT.
const OLD_SUPPLY = 4_083_262_533_956_000_100_000_000_000n;
// New CT fixed supply: 2,000,000,000 CT.
const NEW_SUPPLY = 2_000_000_000n * 10n ** 18n;
// Swap ratio: 2 new per 5 old (0.4), set against the pre burn old supply of 5,000,000,000 CT.
const RATIO_NUM = 2n, RATIO_DEN = 5n;
const DAY = 24n * 60n * 60n;
const WINDOW = 365n * DAY;
const LOCK = 7n * DAY;
const E18 = 10n ** 18n;

/**
 * Deploys an old token mock (exact old supply), the new token (whole supply to the
 * master wallet) and the migration contract (MASTER = master). The master then funds
 * the swap with `fund` new CT by a plain transfer (default: the whole supply, so the
 * reserve never runs short unless a test wants it to). Hands old CT to holders.
 * @param {string} oldKind contract name of the old token mock
 * @param {any[]} extraArgs constructor args after the supply
 * @param {{fund?: bigint, masterOf?: (ctx) => Promise<string>}} opts  masterOf overrides the
 *   swap's MASTER address (the master signer still holds the supply and funds the swap)
 */
async function deploySystem(oldKind = "MockOldCojam", extraArgs = [], opts = {}) {
  const [deployer, alice, bob, carol, master, stranger, ...rest] = await ethers.getSigners();
  const Old = await ethers.getContractFactory(oldKind);
  const oldToken = await Old.deploy(OLD_SUPPLY, ...extraArgs);

  const newToken = await (await ethers.getContractFactory("CojamToken")).deploy(master.address);
  const masterAddr = opts.masterOf ? await opts.masterOf({ oldToken, master }) : master.address;
  const Migration = await ethers.getContractFactory("CojamMigration");
  const migration = await Migration.deploy(await oldToken.getAddress(), await newToken.getAddress(), masterAddr);
  const start = await migration.WINDOW_START(); // the window opens at deploy

  const fund = opts.fund === undefined ? NEW_SUPPLY : opts.fund;
  if (fund > 0n) await newToken.connect(master).transfer(await migration.getAddress(), fund);

  // Give each holder 1,000,000 CT (after deploy, so a fee mock cannot break the supply check).
  // The deployer keeps the rest and stands in for "every other holder".
  for (const s of [alice, bob, carol]) {
    await oldToken.connect(deployer).transfer(s.address, 1_000_000n * E18);
  }

  return { deployer, alice, bob, carol, master, stranger, rest, oldToken, migration, newToken, start, fund };
}

/** New CT credited for `old` old CT received: 2/5, rounded down. */
const credit = (old) => (old * RATIO_NUM) / RATIO_DEN;
/** Expected split of a credit: 10% now (rounded down), the rest locked. */
const split = (c) => [(c * 10n) / 100n, c - (c * 10n) / 100n];
/** Full expected result for `old` old CT received: [credit, instant, locked]. */
const swapOf = (old) => { const c = credit(old); return [c, ...split(c)]; };

async function approveAndMigrate(oldToken, migration, signer, amount) {
  await oldToken.connect(signer).approve(await migration.getAddress(), amount);
  return migration.connect(signer).migrate(amount);
}

module.exports = { OLD_SUPPLY, NEW_SUPPLY, RATIO_NUM, RATIO_DEN, DAY, WINDOW, LOCK, E18, credit, split, swapOf, deploySystem, approveAndMigrate };
