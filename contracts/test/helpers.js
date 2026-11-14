const { ethers } = require("hardhat");

// Old CT totalSupply() on Kaia mainnet (read 2026-11-12): 4,083,262,533.9560001 CT.
const SUPPLY = 4_083_262_533_956_000_100_000_000_000n;
const DAY = 24n * 60n * 60n;
const WINDOW = 365n * DAY;
const LOCK = 7n * DAY;
const E18 = 10n ** 18n;

/**
 * Deploys an old token mock (exact old supply), the new token (whole supply to the
 * master wallet) and the migration contract (owner = master unless `ownerOf` says
 * otherwise). The master then funds the swap with `fund` new CT (default: the whole
 * supply, so the reserve never runs short unless a test wants it to). Hands old CT
 * balances to holders.
 * @param {string} oldKind contract name of the old token mock
 * @param {any[]} extraArgs constructor args after the supply
 * @param {{fund?: bigint, ownerOf?: (ctx) => string}} opts
 */
async function deploySystem(oldKind = "MockOldCojam", extraArgs = [], opts = {}) {
  const [deployer, alice, bob, carol, master, stranger, ...rest] = await ethers.getSigners();
  const Old = await ethers.getContractFactory(oldKind);
  const oldToken = await Old.deploy(SUPPLY, ...extraArgs);

  const newToken = await (await ethers.getContractFactory("CojamToken")).deploy(master.address);
  const owner = opts.ownerOf ? await opts.ownerOf({ oldToken, master }) : master.address;

  const Migration = await ethers.getContractFactory("CojamMigration");
  const migration = await Migration.deploy(await oldToken.getAddress(), await newToken.getAddress(), owner);
  const start = await migration.WINDOW_START(); // the window opens at deploy

  const fund = opts.fund === undefined ? SUPPLY : opts.fund;
  if (fund > 0n) await newToken.connect(master).transfer(await migration.getAddress(), fund);

  // Give each holder 1,000,000 CT (after deploy, so a fee mock cannot break the supply check).
  // The deployer keeps the rest and stands in for "every other holder".
  for (const s of [alice, bob, carol]) {
    await oldToken.connect(deployer).transfer(s.address, 1_000_000n * E18);
  }

  return { deployer, alice, bob, carol, master, stranger, rest, oldToken, migration, newToken, start, fund };
}

/** Expected split of a credit: 10% now (rounded down), the rest locked. */
const split = (x) => [(x * 10n) / 100n, x - (x * 10n) / 100n];

async function approveAndMigrate(oldToken, migration, signer, amount) {
  await oldToken.connect(signer).approve(await migration.getAddress(), amount);
  return migration.connect(signer).migrate(amount);
}

module.exports = { SUPPLY, DAY, WINDOW, LOCK, E18, split, deploySystem, approveAndMigrate };
