const { ethers } = require("hardhat");

const E18 = 10n ** 18n;
const CT = (n) => BigInt(n) * E18;
const DAY = 86_400n;
const YEAR = 365n * DAY;
const BPS = 10_000n;
const LOCK_DAYS = [30n, 90n, 180n, 365n];
const RATES = [
  [800n, 900n, 1000n],
  [1200n, 1300n, 1400n],
  [1800n, 1900n, 2000n],
  [2500n, 2600n, 2700n],
];
const TIERS = [CT(1_000), CT(10_000)];
const SUPPLY = CT(2_000_000_000);
const REWARDS = CT(1_000_000);
const USER_CT = CT(10_000_000);

/** Interest for `principal` at `apr` bps over `secs` seconds, rounded down (the contract's formula). */
const interestOf = (principal, apr, secs) => (principal * apr * secs) / (BPS * YEAR);
/** Tier under the default thresholds. */
const tierOf = (amount, t = TIERS) => (amount < t[0] ? 0 : amount < t[1] ? 1 : 2);
/** Full lock interest under the default table. */
const maxInterestOf = (amount, lockIndex) =>
  interestOf(amount, RATES[lockIndex][tierOf(amount)], LOCK_DAYS[lockIndex] * DAY);

/**
 * Deploys a CT stand in (or `tokenKind`), CojamStaking (owner, treasury, pauser), funds
 * `rewards` reward CT by a plain transfer from the treasury, and gives each user CT with
 * an unlimited approve.
 */
async function deployStaking(opts = {}) {
  const [deployer, owner, treasury, pauser, alice, bob, carol, stranger, ...rest] = await ethers.getSigners();
  const tokenKind = opts.tokenKind || "StakingMockCT";
  const tokenArgs = opts.tokenArgs || [SUPPLY];
  const token = await (await ethers.getContractFactory(tokenKind)).deploy(...tokenArgs);
  const kind = opts.stakingKind || "CojamStaking";
  const extra = opts.stakingArgs || [];
  const staking = await (await ethers.getContractFactory(kind)).deploy(
    await token.getAddress(), owner.address, treasury.address, pauser.address, ...extra);
  const addr = await staking.getAddress();

  const users = [alice, bob, carol, ...rest.slice(0, opts.extraUsers || 0)];
  await token.connect(deployer).transfer(treasury.address, CT(100_000_000));
  for (const u of users) {
    await token.connect(deployer).transfer(u.address, USER_CT);
    await token.connect(u).approve(addr, ethers.MaxUint256);
  }
  const rewards = opts.rewards === undefined ? REWARDS : opts.rewards;
  if (rewards > 0n) await token.connect(treasury).transfer(addr, rewards);

  return { deployer, owner, treasury, pauser, alice, bob, carol, stranger, rest, users, token, staking, addr, rewards };
}

/** Timestamp of the block that mined `tx`. */
async function txTime(tx) {
  const r = await tx.wait();
  return BigInt((await ethers.provider.getBlock(r.blockNumber)).timestamp);
}

/** Checks the solvency invariant and returns the three figures. */
async function solvency(token, staking) {
  const bal = await token.balanceOf(await staking.getAddress());
  const p = await staking.totalPrincipal();
  const c = await staking.totalCommitted();
  return { bal, p, c, ok: bal >= p + c };
}

module.exports = {
  E18, CT, DAY, YEAR, BPS, LOCK_DAYS, RATES, TIERS, SUPPLY, REWARDS, USER_CT,
  interestOf, tierOf, maxInterestOf, deployStaking, txTime, solvency,
};
