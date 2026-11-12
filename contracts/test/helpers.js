const { ethers } = require("hardhat");

// Old CT totalSupply() on Kaia mainnet (read 2026-11-12): 4,083,262,533.9560001 CT.
const SUPPLY = 4_083_262_533_956_000_100_000_000_000n;
const DAY = 24n * 60n * 60n;
const WINDOW = 365n * DAY;
const LOCK = 7n * DAY;
const GRACE = 30n * DAY;
const E18 = 10n ** 18n;

/**
 * Deploys an old token mock (exact old supply), hands balances to holders,
 * and deploys the migration contract (which deploys the new token).
 * @param {string} oldKind contract name of the old token mock
 * @param {any[]} extraArgs constructor args after the supply
 */
async function deploySystem(oldKind = "MockOldCojam", extraArgs = []) {
  const [deployer, alice, bob, carol, treasury, stranger, ...rest] = await ethers.getSigners();
  const Old = await ethers.getContractFactory(oldKind);
  const oldToken = await Old.deploy(SUPPLY, ...extraArgs);

  const Migration = await ethers.getContractFactory("CojamMigration");
  const migration = await Migration.deploy(await oldToken.getAddress(), treasury.address, GRACE);
  const newToken = await ethers.getContractAt("CojamToken", await migration.NEW_TOKEN());
  const start = await migration.WINDOW_START(); // the window opens at deploy

  // Give each holder 1,000,000 CT (after deploy, so a fee mock cannot break the supply check).
  // The deployer keeps the rest and stands in for "every other holder".
  for (const s of [alice, bob, carol]) {
    await oldToken.connect(deployer).transfer(s.address, 1_000_000n * E18);
  }

  return { deployer, alice, bob, carol, treasury, stranger, rest, oldToken, migration, newToken, start };
}

/** Expected split of a credit: 10% now (rounded down), the rest locked. */
const split = (x) => [(x * 10n) / 100n, x - (x * 10n) / 100n];

async function approveAndMigrate(oldToken, migration, signer, amount) {
  await oldToken.connect(signer).approve(await migration.getAddress(), amount);
  return migration.connect(signer).migrate(amount);
}

module.exports = { SUPPLY, DAY, WINDOW, LOCK, GRACE, E18, split, deploySystem, approveAndMigrate };
