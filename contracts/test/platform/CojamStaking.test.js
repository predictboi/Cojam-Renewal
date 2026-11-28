const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  CT, DAY, LOCK_DAYS, RATES, TIERS, REWARDS, interestOf, maxInterestOf, deployStaking, txTime, solvency,
} = require("./stakingHelpers");

const fixture = () => deployStaking();
const unfunded = () => deployStaking({ rewards: 0n });
const feeFixture = () => deployStaking({ tokenKind: "StakingFeeToken", tokenArgs: [CT(2_000_000_000), 100n] }); // 1% fee
const shortLockFixture = () => deployStaking({ stakingKind: "StakingShortLock", stakingArgs: [60n] });
const evilFixture = () => deployStaking({ tokenKind: "StakingEvilToken", tokenArgs: [CT(2_000_000_000)] });

const ADMIN = ethers.ZeroHash;
const PAUSER = ethers.id("PAUSER_ROLE");

/** Stakes and returns { id, start, end, maxInterest, apr }. */
async function open(staking, signer, amount, lockIndex) {
  const id = await staking.positionCount(signer.address);
  const tx = await staking.connect(signer).stake(amount, lockIndex);
  const start = await txTime(tx);
  const p = await staking.positionOf(signer.address, id);
  return { id, tx, start, end: p.end, maxInterest: p.maxInterest, apr: p.aprBps };
}

describe("CojamStaking: deployment", function () {
  it("sets the token, roles, treasury and every plan default", async function () {
    const { staking, token, owner, treasury, pauser } = await loadFixture(fixture);
    expect(await staking.CT()).to.equal(await token.getAddress());
    expect(await staking.owner()).to.equal(owner.address);
    expect(await staking.defaultAdmin()).to.equal(owner.address);
    expect(await staking.defaultAdminDelay()).to.equal(3n * DAY);
    expect(await staking.hasRole(ADMIN, owner.address)).to.equal(true);
    expect(await staking.hasRole(PAUSER, owner.address)).to.equal(true);
    expect(await staking.hasRole(PAUSER, pauser.address)).to.equal(true);
    expect(await staking.hasRole(ADMIN, pauser.address)).to.equal(false);
    expect(await staking.treasury()).to.equal(treasury.address);
    expect(await staking.pendingTreasury()).to.equal(ethers.ZeroAddress);
    expect(await staking.minStake()).to.equal(CT(100));
    expect(await staking.minClaim()).to.equal(CT(10));
    expect(await staking.maxOpenPositions()).to.equal(20n);
    expect(await staking.maxTotalPrincipal()).to.equal(0n);
    expect(await staking.maxUserPrincipal()).to.equal(CT(1_000_000));
    expect(await staking.tierThresholds(0)).to.equal(TIERS[0]);
    expect(await staking.tierThresholds(1)).to.equal(TIERS[1]);
    const table = await staking.rates();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      expect(table[i][j]).to.equal(RATES[i][j]);
      expect(await staking.rateBps(i, j)).to.equal(RATES[i][j]);
    }
    for (let i = 0; i < 4; i++) {
      expect(await staking.lockDays(i)).to.equal(LOCK_DAYS[i]);
      expect(await staking.lockDuration(i)).to.equal(LOCK_DAYS[i] * DAY);
    }
    expect(await staking.YEAR()).to.equal(365n * DAY);
    expect(await staking.TREASURY_DELAY()).to.equal(2n * DAY);
    expect(await staking.paused()).to.equal(false);
    expect(await staking.totalPrincipal()).to.equal(0n);
    expect(await staking.totalCommitted()).to.equal(0n);
    expect(await staking.availableRewards()).to.equal(REWARDS);
  });

  it("emits the starting parameters at deploy", async function () {
    const { staking, treasury } = await loadFixture(fixture);
    const tx = staking.deploymentTransaction();
    await expect(tx).to.emit(staking, "MinimumsSet").withArgs(CT(100), CT(10));
    await expect(tx).to.emit(staking, "CapsSet").withArgs(20n, 0n, CT(1_000_000));
    await expect(tx).to.emit(staking, "TreasurySet").withArgs(ethers.ZeroAddress, treasury.address);
    await expect(tx).to.emit(staking, "TiersSet");
    await expect(tx).to.emit(staking, "RatesSet");
  });

  it("works without an extra pauser", async function () {
    const { token, owner, treasury } = await loadFixture(fixture);
    const s = await (await ethers.getContractFactory("CojamStaking")).deploy(
      await token.getAddress(), owner.address, treasury.address, ethers.ZeroAddress);
    expect(await s.hasRole(PAUSER, owner.address)).to.equal(true);
    expect(await s.hasRole(PAUSER, ethers.ZeroAddress)).to.equal(false);
  });

  it("rejects a zero token, owner or treasury and a token without 18 decimals", async function () {
    const { token, owner, treasury } = await loadFixture(fixture);
    const F = await ethers.getContractFactory("CojamStaking");
    const t = await token.getAddress();
    await expect(F.deploy(ethers.ZeroAddress, owner.address, treasury.address, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(F, "ZeroAddress");
    await expect(F.deploy(t, owner.address, ethers.ZeroAddress, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(F, "ZeroAddress");
    await expect(F.deploy(t, ethers.ZeroAddress, treasury.address, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(F, "AccessControlInvalidDefaultAdmin").withArgs(ethers.ZeroAddress);
    const six = await (await ethers.getContractFactory("MockDecimals")).deploy(CT(1), 6);
    await expect(F.deploy(await six.getAddress(), owner.address, treasury.address, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(F, "DecimalsMismatch");
  });

  it("has no upgrade, rescue, early exit or freeze surface", async function () {
    const { staking } = await loadFixture(fixture);
    const names = staking.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const banned of ["upgradeTo", "upgradeToAndCall", "recoverERC20", "sweep", "rescue", "emergencyWithdraw",
      "withdrawEarly", "unstake", "freeze", "unfreeze", "setLockDays", "claimFor", "withdrawFor", "stakeFor", "initialize"]) {
      expect(names, banned).to.not.include(banned);
    }
  });
});

describe("CojamStaking: stake", function () {
  it("opens a position, reserves its full interest and emits Staked", async function () {
    const { staking, token, alice, addr } = await loadFixture(fixture);
    const amount = CT(1_000);
    expect(await staking.connect(alice).stake.staticCall(amount, 1)).to.equal(0n);
    const before = await token.balanceOf(alice.address);
    const tx = await staking.connect(alice).stake(amount, 1);
    const start = await txTime(tx);
    const max = maxInterestOf(amount, 1);
    expect(max).to.equal(32_054_794_520_547_945_205n);
    await expect(tx).to.emit(staking, "Staked").withArgs(alice.address, 0n, amount, 90n, 1300n, start + 90n * DAY, max);
    expect(await token.balanceOf(alice.address)).to.equal(before - amount);
    expect(await token.balanceOf(addr)).to.equal(REWARDS + amount);
    expect(await staking.totalPrincipal()).to.equal(amount);
    expect(await staking.totalCommitted()).to.equal(max);
    expect(await staking.availableRewards()).to.equal(REWARDS - max);
    expect(await staking.openPositions(alice.address)).to.equal(1n);
    expect(await staking.principalOf(alice.address)).to.equal(amount);
    expect(await staking.positionCount(alice.address)).to.equal(1n);
    const p = await staking.positionOf(alice.address, 0);
    expect(p.id).to.equal(0n);
    expect(p.principal).to.equal(amount);
    expect(p.maxInterest).to.equal(max);
    expect(p.claimed).to.equal(0n);
    expect(p.claimable).to.equal(0n);
    expect(p.start).to.equal(start);
    expect(p.end).to.equal(start + 90n * DAY);
    expect(p.aprBps).to.equal(1300n);
    expect(p.lockIndex).to.equal(1n);
    expect(p.closed).to.equal(false);
  });

  it("numbers ids per user from 0", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    await staking.connect(alice).stake(CT(100), 0);
    await staking.connect(bob).stake(CT(100), 0);
    await staking.connect(alice).stake(CT(100), 3);
    expect(await staking.positionCount(alice.address)).to.equal(2n);
    expect(await staking.positionCount(bob.address)).to.equal(1n);
    expect((await staking.positionOf(alice.address, 1)).lockIndex).to.equal(3n);
  });

  it("reverts on a lock index of 4 or more", async function () {
    const { staking, alice } = await loadFixture(fixture);
    await expect(staking.connect(alice).stake(CT(100), 4)).to.be.revertedWithCustomError(staking, "InvalidLock").withArgs(4n);
    await expect(staking.connect(alice).stake(CT(100), 255)).to.be.revertedWithCustomError(staking, "InvalidLock").withArgs(255n);
  });

  it("enforces the 100 CT minimum (exactly 100 CT works)", async function () {
    const { staking, alice } = await loadFixture(fixture);
    await expect(staking.connect(alice).stake(CT(100) - 1n, 0))
      .to.be.revertedWithCustomError(staking, "BelowMinStake").withArgs(CT(100) - 1n, CT(100));
    await expect(staking.connect(alice).stake(0, 0))
      .to.be.revertedWithCustomError(staking, "BelowMinStake").withArgs(0n, CT(100));
    await expect(staking.connect(alice).stake(CT(100), 0)).to.emit(staking, "Staked");
  });

  it("caps open positions at 20 per user; a withdrawn one frees a slot", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    for (let i = 0; i < 20; i++) await staking.connect(alice).stake(CT(100), 0);
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "TooManyPositions").withArgs(20n, 20n);
    await staking.connect(bob).stake(CT(100), 0); // per user
    await time.increase(30n * DAY);
    await staking.connect(alice).withdraw(3);
    expect(await staking.openPositions(alice.address)).to.equal(19n);
    await staking.connect(alice).stake(CT(100), 0);
    expect(await staking.positionCount(alice.address)).to.equal(21n);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "TooManyPositions");
  });

  it("respects the optional total principal cap and reports the room left", async function () {
    const { staking, owner, alice, bob } = await loadFixture(fixture);
    await staking.connect(owner).setCaps(20, CT(1_500), CT(1_000_000));
    await staking.connect(alice).stake(CT(1_000), 0);
    await expect(staking.connect(bob).stake(CT(501), 0))
      .to.be.revertedWithCustomError(staking, "TotalCapReached").withArgs(CT(500), CT(501));
    await staking.connect(bob).stake(CT(500), 0); // exactly to the cap
    expect(await staking.totalPrincipal()).to.equal(CT(1_500));
    await expect(staking.connect(bob).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "TotalCapReached").withArgs(0n, CT(100));
    // A cap below the current total stops new stakes only, with zero room.
    await staking.connect(owner).setCaps(20, CT(1_000), CT(1_000_000));
    await expect(staking.connect(bob).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "TotalCapReached").withArgs(0n, CT(100));
    await staking.connect(owner).setCaps(20, 0, CT(1_000_000)); // 0 removes the cap
    await staking.connect(bob).stake(CT(100_000), 0);
  });

  it("reverts with the needed amount when rewards are short; existing positions are unaffected", async function () {
    const { staking, token, treasury, alice, bob } = await loadFixture(unfunded);
    // No rewards at all: even the smallest stake needs interest.
    const need = maxInterestOf(CT(100), 0);
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(0n, need);

    // Fund exactly one position's interest: it fits exactly, the next one does not.
    const max = maxInterestOf(CT(5_000), 2);
    await token.connect(treasury).transfer(await staking.getAddress(), max);
    const a = await open(staking, alice, CT(5_000), 2);
    expect(await staking.availableRewards()).to.equal(0n);
    await expect(staking.connect(bob).stake(CT(5_000), 2))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(0n, max);
    // Partial funding: the error reports what is available.
    await token.connect(treasury).transfer(await staking.getAddress(), CT(1));
    await expect(staking.connect(bob).stake(CT(5_000), 2))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(CT(1), max);
    expect(await staking.totalPrincipal()).to.equal(CT(5_000));
    expect(await staking.openPositions(bob.address)).to.equal(0n);

    // Alice's position still pays in full.
    await time.increaseTo(a.end);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(0);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(5_000) + max);
    expect(await staking.availableRewards()).to.equal(CT(1));
  });

  it("never counts the incoming principal as rewards", async function () {
    const { staking, token, treasury, alice } = await loadFixture(unfunded);
    // A large stake must not fund its own interest from its own principal.
    await expect(staking.connect(alice).stake(CT(1_000_000), 3))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(0n, CT(270_000));
    await token.connect(treasury).transfer(await staking.getAddress(), CT(270_000));
    await staking.connect(alice).stake(CT(1_000_000), 3);
    expect(await staking.availableRewards()).to.equal(0n);
  });

  it("allows a zero rate position with no rewards funded", async function () {
    const { staking, owner, alice } = await loadFixture(unfunded);
    await staking.connect(owner).setRates([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    const a = await open(staking, alice, CT(100), 0);
    expect(a.maxInterest).to.equal(0n);
    await time.increaseTo(a.end);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "NothingToClaim");
    await expect(staking.connect(alice).withdraw(0)).to.emit(staking, "Withdrawn").withArgs(alice.address, 0n, CT(100), 0n);
  });

  it("needs an approve (CT has no permit)", async function () {
    const { staking, token, stranger, deployer } = await loadFixture(fixture);
    await token.connect(deployer).transfer(stranger.address, CT(1_000));
    await expect(staking.connect(stranger).stake(CT(100), 0))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });

  it("is blocked while paused and works again after unpause", async function () {
    const { staking, pauser, owner, alice } = await loadFixture(fixture);
    await expect(staking.connect(pauser).pause()).to.emit(staking, "Paused").withArgs(pauser.address);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "EnforcedPause");
    await expect(staking.connect(owner).unpause()).to.emit(staking, "Unpaused").withArgs(owner.address);
    await staking.connect(alice).stake(CT(100), 0);
  });
});

describe("CojamStaking: measured pull (fee on transfer and misbehaving tokens)", function () {
  it("credits what arrived and sizes tier, interest and totals from it", async function () {
    const { staking, token, alice, addr } = await loadFixture(feeFixture);
    // 1,000 CT sent with a 1% fee: 990 CT arrive, so tier 0 (under 1,000 CT) and 12%.
    const balBefore = await token.balanceOf(addr);
    const tx = await staking.connect(alice).stake(CT(1_000), 1);
    const start = await txTime(tx);
    const received = CT(990);
    const max = interestOf(received, 1200n, 90n * DAY);
    await expect(tx).to.emit(staking, "Staked").withArgs(alice.address, 0n, received, 90n, 1200n, start + 90n * DAY, max);
    expect(await token.balanceOf(addr)).to.equal(balBefore + received);
    expect(await staking.totalPrincipal()).to.equal(received);
    expect((await solvency(token, staking)).ok).to.equal(true);
  });

  it("checks the minimum on what arrived", async function () {
    const { staking, alice } = await loadFixture(feeFixture);
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "BelowMinStake").withArgs(CT(99), CT(100));
  });

  it("stays solvent when payouts are charged a fee (the holder bears it)", async function () {
    const { staking, token, alice } = await loadFixture(feeFixture);
    const a = await open(staking, alice, CT(2_000), 0);
    await time.increaseTo(a.end);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(0);
    const paid = CT(1_980) + a.maxInterest;
    expect(await token.balanceOf(alice.address)).to.equal(before + paid - (paid * 100n) / 10_000n);
    const s = await solvency(token, staking);
    expect(s.ok).to.equal(true);
    expect(s.p).to.equal(0n);
    expect(s.c).to.equal(0n);
  });

  it("rejects a token that credits more than was sent", async function () {
    const { staking, token, alice, treasury } = await loadFixture(evilFixture);
    await token.configure(5, false, false, await staking.getAddress(), treasury.address);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "ReceivedMoreThanSent");
  });

  it("rejects a token that moves nothing but returns true", async function () {
    const { staking, token, alice, treasury } = await loadFixture(evilFixture);
    await token.configure(6, false, false, await staking.getAddress(), treasury.address);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "NothingReceived");
  });
});

describe("CojamStaking: claimInterest", function () {
  it("pays the earned interest while locked when it reaches 10 CT", async function () {
    const { staking, token, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 3); // 27%: 10 CT after about 1.35 days
    const t = a.start + 2n * DAY;
    await time.setNextBlockTimestamp(t);
    const expected = interestOf(CT(10_000), 2700n, 2n * DAY);
    const before = await token.balanceOf(alice.address);
    await expect(staking.connect(alice).claimInterest(0))
      .to.emit(staking, "InterestClaimed").withArgs(alice.address, 0n, expected);
    expect(await token.balanceOf(alice.address)).to.equal(before + expected);
    expect(await staking.totalCommitted()).to.equal(a.maxInterest - expected);
    expect(await staking.totalInterestPaid()).to.equal(expected);
    expect((await staking.positionOf(alice.address, 0)).claimed).to.equal(expected);
  });

  it("returns the amount paid", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 3);
    await time.increaseTo(a.start + 10n * DAY);
    const v = await staking.connect(alice).claimInterest.staticCall(0);
    expect(v).to.equal(interestOf(CT(10_000), 2700n, 10n * DAY));
  });

  it("refuses a locked claim below 10 CT with the amount and the minimum", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 3);
    const t = a.start + DAY;
    await time.setNextBlockTimestamp(t);
    await expect(staking.connect(alice).claimInterest(0))
      .to.be.revertedWithCustomError(staking, "BelowMinClaim").withArgs(interestOf(CT(10_000), 2700n, DAY), CT(10));
  });

  it("pays any amount once the lock has ended, even below 10 CT", async function () {
    const { staking, token, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(100), 0); // about 0.66 CT for the whole lock
    expect(a.maxInterest < CT(10)).to.equal(true);
    await time.setNextBlockTimestamp(a.end - 1n);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "BelowMinClaim");
    await time.setNextBlockTimestamp(a.end);
    const before = await token.balanceOf(alice.address);
    await expect(staking.connect(alice).claimInterest(0)).to.emit(staking, "InterestClaimed").withArgs(alice.address, 0n, a.maxInterest);
    expect(await token.balanceOf(alice.address)).to.equal(before + a.maxInterest);
    // Fully claimed: nothing left, now or later.
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "NothingToClaim");
    await time.increase(1000n * DAY);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "NothingToClaim");
    // Withdraw then pays the principal and no more interest.
    await expect(staking.connect(alice).withdraw(0)).to.emit(staking, "Withdrawn").withArgs(alice.address, 0n, CT(100), 0n);
  });

  it("with minClaim 0 pays any amount above zero while locked", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setMinimums(CT(100), 0);
    const a = await open(staking, alice, CT(100), 0);
    await time.setNextBlockTimestamp(a.start + 1n);
    await expect(staking.connect(alice).claimInterest(0))
      .to.emit(staking, "InterestClaimed").withArgs(alice.address, 0n, interestOf(CT(100), 800n, 1n));
  });

  it("reverts NothingToClaim when nothing accrued", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setMinimums(CT(100), 0);
    await staking.connect(owner).setRates([[0, 0, 0], [1200, 1300, 1400], [1800, 1900, 2000], [2500, 2600, 2700]]);
    await open(staking, alice, CT(100), 0);
    await time.increase(DAY);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "NothingToClaim");
  });

  it("reverts on an unknown id, on another user's id and on a closed position", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 0);
    await expect(staking.connect(alice).claimInterest(1)).to.be.revertedWithCustomError(staking, "UnknownPosition").withArgs(1n);
    await expect(staking.connect(bob).claimInterest(0)).to.be.revertedWithCustomError(staking, "UnknownPosition").withArgs(0n);
    await time.increaseTo(a.end);
    await staking.connect(alice).withdraw(0);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "PositionClosed").withArgs(0n);
  });

  it("is never paused", async function () {
    const { staking, pauser, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 3);
    await staking.connect(pauser).pause();
    await time.increaseTo(a.start + 10n * DAY);
    await expect(staking.connect(alice).claimInterest(0)).to.emit(staking, "InterestClaimed");
  });
});

describe("CojamStaking: withdraw", function () {
  it("reverts before the end with the end time, works exactly at the end", async function () {
    const { staking, token, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(5_000), 1);
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "LockNotEnded").withArgs(a.end);
    await time.setNextBlockTimestamp(a.end - 1n);
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "LockNotEnded").withArgs(a.end);
    await time.setNextBlockTimestamp(a.end);
    const before = await token.balanceOf(alice.address);
    expect(await staking.claimable(alice.address, 0)).to.equal(interestOf(CT(5_000), 1300n, 90n * DAY - 1n));
    await expect(staking.connect(alice).withdraw(0)).to.emit(staking, "Withdrawn").withArgs(alice.address, 0n, CT(5_000), a.maxInterest);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(5_000) + a.maxInterest);
    expect(await staking.totalPrincipal()).to.equal(0n);
    expect(await staking.totalCommitted()).to.equal(0n);
    expect(await staking.openPositions(alice.address)).to.equal(0n);
    expect(await staking.principalOf(alice.address)).to.equal(0n);
    const p = await staking.positionOf(alice.address, 0);
    expect(p.closed).to.equal(true);
    expect(p.claimed).to.equal(a.maxInterest);
    expect(p.claimable).to.equal(0n);
    expect(await staking.claimable(alice.address, 0)).to.equal(0n);
  });

  it("returns principal and interest", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(5_000), 0);
    await time.increaseTo(a.end + 5n);
    const [p, i] = await staking.connect(alice).withdraw.staticCall(0);
    expect(p).to.equal(CT(5_000));
    expect(i).to.equal(a.maxInterest);
  });

  it("twice reverts PositionClosed", async function () {
    const { staking, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(5_000), 0);
    await time.increaseTo(a.end);
    await staking.connect(alice).withdraw(0);
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "PositionClosed").withArgs(0n);
  });

  it("after partial claims pays exactly the rest: total interest equals maxInterest", async function () {
    const { staking, token, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(50_000), 2);
    const before = await token.balanceOf(alice.address);
    await time.setNextBlockTimestamp(a.start + 17n * DAY + 123n);
    await staking.connect(alice).claimInterest(0);
    await time.setNextBlockTimestamp(a.start + 101n * DAY + 7n);
    await staking.connect(alice).claimInterest(0);
    await time.increaseTo(a.end + 400n * DAY); // long after: no interest past the end
    await staking.connect(alice).withdraw(0);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(50_000) + a.maxInterest);
    expect(await staking.totalInterestPaid()).to.equal(a.maxInterest);
  });

  it("reverts on an unknown id and is never paused", async function () {
    const { staking, pauser, alice } = await loadFixture(fixture);
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "UnknownPosition").withArgs(0n);
    const a = await open(staking, alice, CT(100), 0);
    await staking.connect(pauser).pause();
    await time.increaseTo(a.end);
    await expect(staking.connect(alice).withdraw(0)).to.emit(staking, "Withdrawn");
  });

  it("pays principal only to its owner (another user cannot reach it by id)", async function () {
    const { staking, token, alice, bob } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(1_000), 0);
    await open(staking, bob, CT(100), 0);
    await time.increaseTo(a.end);
    const aliceBefore = await token.balanceOf(alice.address);
    await staking.connect(bob).withdraw(0); // Bob's own position 0
    expect(await token.balanceOf(alice.address)).to.equal(aliceBefore);
    expect((await staking.positionOf(alice.address, 0)).closed).to.equal(false);
  });
});

describe("CojamStaking: per user principal cap", function () {
  const CAP = CT(1_000_000);

  it("allows exactly 1,000,000 CT of open principal per address and refuses one wei more", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    await staking.connect(alice).stake(CT(600_000), 0);
    await expect(staking.connect(alice).stake(CT(400_000) + 1n, 0))
      .to.be.revertedWithCustomError(staking, "UserCapReached").withArgs(CT(400_000), CT(400_000) + 1n);
    await staking.connect(alice).stake(CT(400_000), 0); // exactly at the cap
    expect(await staking.principalOf(alice.address)).to.equal(CAP);
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "UserCapReached").withArgs(0n, CT(100));
    await staking.connect(bob).stake(CT(100), 0); // per address
    expect(await staking.principalOf(bob.address)).to.equal(CT(100));
    expect(await staking.totalPrincipal()).to.equal(CAP + CT(100));
  });

  it("a withdrawal frees room under the cap", async function () {
    const { staking, alice } = await loadFixture(fixture);
    await staking.connect(alice).stake(CT(300_000), 0);
    await staking.connect(alice).stake(CT(700_000), 1);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "UserCapReached");
    await time.increase(30n * DAY);
    await staking.connect(alice).withdraw(0);
    expect(await staking.principalOf(alice.address)).to.equal(CT(700_000));
    await expect(staking.connect(alice).stake(CT(300_000) + 1n, 0))
      .to.be.revertedWithCustomError(staking, "UserCapReached").withArgs(CT(300_000), CT(300_000) + 1n);
    await staking.connect(alice).stake(CT(300_000), 0);
    expect(await staking.principalOf(alice.address)).to.equal(CAP);
  });

  it("a cap of 0 means no cap", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setCaps(20, 0, 0);
    await staking.connect(alice).stake(CT(1_500_000), 0);
    await staking.connect(alice).stake(CT(500_000), 0);
    expect(await staking.principalOf(alice.address)).to.equal(CT(2_000_000));
  });

  it("lowering the cap below a user's figure only stops that user's new stakes", async function () {
    const { staking, token, owner, alice, bob } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(50_000), 0);
    await expect(staking.connect(owner).setCaps(20, 0, CT(10_000)))
      .to.emit(staking, "CapsSet").withArgs(20n, 0n, CT(10_000));
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "UserCapReached").withArgs(0n, CT(100));
    await staking.connect(bob).stake(CT(10_000), 0);
    // Alice's position is untouched and pays in full.
    await time.increaseTo(a.end);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(0);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(50_000) + a.maxInterest);
    expect(await staking.principalOf(alice.address)).to.equal(0n);
    await staking.connect(alice).stake(CT(10_000), 0);
  });

  it("is checked on what arrived (fee on transfer token)", async function () {
    const { staking, owner, alice } = await loadFixture(feeFixture);
    await staking.connect(owner).setCaps(20, 0, CT(990));
    // 1,000 CT sent, 990 CT arrive: exactly at the cap.
    await staking.connect(alice).stake(CT(1_000), 0);
    expect(await staking.principalOf(alice.address)).to.equal(CT(990));
    await staking.connect(owner).setCaps(20, 0, CT(1_188));
    // 201 CT sent, 198.99 CT arrive: the room of 198 CT is checked against what arrived.
    await expect(staking.connect(alice).stake(CT(201), 0))
      .to.be.revertedWithCustomError(staking, "UserCapReached").withArgs(CT(198), CT(201) - CT(201) / 100n);
    await staking.connect(owner).setCaps(20, 0, CT(990) + CT(201) - CT(201) / 100n);
    await staking.connect(alice).stake(CT(201), 0); // exactly at the cap after the fee
  });

  it("the total cap is checked before the user cap", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await staking.connect(owner).setCaps(20, CT(500), CT(400));
    await expect(staking.connect(alice).stake(CT(600), 0)).to.be.revertedWithCustomError(staking, "TotalCapReached");
    await expect(staking.connect(alice).stake(CT(450), 0)).to.be.revertedWithCustomError(staking, "UserCapReached");
  });
});

describe("CojamStaking: owner setters", function () {
  const NEW_RATES = [[100, 200, 300], [400, 500, 600], [700, 800, 900], [5000, 4000, 3000]];

  it("setRates replaces the table for new positions only", async function () {
    const { staking, owner, alice, bob } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(5_000), 3);
    await expect(staking.connect(owner).setRates(NEW_RATES)).to.emit(staking, "RatesSet");
    expect(await staking.rateBps(3, 0)).to.equal(5000n);
    const pa = await staking.positionOf(alice.address, 0);
    expect(pa.aprBps).to.equal(2600n);
    expect(pa.maxInterest).to.equal(a.maxInterest);
    const b = await open(staking, bob, CT(5_000), 3);
    expect(b.apr).to.equal(4000n);
    await time.increaseTo(a.start + 100n * DAY);
    expect(await staking.claimable(alice.address, 0)).to.equal(interestOf(CT(5_000), 2600n, 100n * DAY));
  });

  it("setRates bounds each cell to 5,000 bps", async function () {
    const { staking, owner } = await loadFixture(fixture);
    const bad = NEW_RATES.map((r) => [...r]);
    bad[2][1] = 5001;
    await expect(staking.connect(owner).setRates(bad))
      .to.be.revertedWithCustomError(staking, "RateOutOfBounds").withArgs(2n, 1n, 5001n);
    const max = [[5000, 5000, 5000], [5000, 5000, 5000], [5000, 5000, 5000], [5000, 5000, 5000]];
    await staking.connect(owner).setRates(max);
    expect(await staking.rateBps(0, 0)).to.equal(5000n);
  });

  it("setTiers moves the boundaries for new positions only, within bounds", async function () {
    const { staking, owner, alice, bob } = await loadFixture(fixture);
    await open(staking, alice, CT(500), 1); // tier 0
    await expect(staking.connect(owner).setTiers([CT(200), CT(400)]))
      .to.emit(staking, "TiersSet").withArgs([CT(200), CT(400)]);
    expect((await staking.positionOf(alice.address, 0)).aprBps).to.equal(1200n);
    const b = await open(staking, bob, CT(500), 1); // now tier 2
    expect(b.apr).to.equal(1400n);
    await expect(staking.connect(owner).setTiers([0, CT(400)])).to.be.revertedWithCustomError(staking, "TiersOutOfBounds").withArgs(0n, CT(400));
    await expect(staking.connect(owner).setTiers([CT(400), CT(400)])).to.be.revertedWithCustomError(staking, "TiersOutOfBounds");
    await expect(staking.connect(owner).setTiers([CT(500), CT(400)])).to.be.revertedWithCustomError(staking, "TiersOutOfBounds");
    await expect(staking.connect(owner).setTiers([CT(1), CT(100_000_000) + 1n])).to.be.revertedWithCustomError(staking, "TiersOutOfBounds");
    await staking.connect(owner).setTiers([1n, CT(100_000_000)]);
    expect(await staking.tierOf(1n)).to.equal(1n);
    expect(await staking.tierOf(0n)).to.equal(0n);
  });

  it("setMinimums within 1 to 100,000 CT (stake) and 0 to 1,000 CT (claim)", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await expect(staking.connect(owner).setMinimums(CT(1), 0)).to.emit(staking, "MinimumsSet").withArgs(CT(1), 0n);
    await staking.connect(owner).setMinimums(CT(100_000), CT(1_000));
    expect(await staking.minStake()).to.equal(CT(100_000));
    expect(await staking.minClaim()).to.equal(CT(1_000));
    await expect(staking.connect(owner).setMinimums(CT(1) - 1n, 0)).to.be.revertedWithCustomError(staking, "MinStakeOutOfBounds").withArgs(CT(1) - 1n);
    await expect(staking.connect(owner).setMinimums(CT(100_000) + 1n, 0)).to.be.revertedWithCustomError(staking, "MinStakeOutOfBounds");
    await expect(staking.connect(owner).setMinimums(CT(100), CT(1_000) + 1n)).to.be.revertedWithCustomError(staking, "MinClaimOutOfBounds").withArgs(CT(1_000) + 1n);
    await expect(staking.connect(alice).stake(CT(99_999), 0)).to.be.revertedWithCustomError(staking, "BelowMinStake");
  });

  it("a minClaim change never cuts what an open position earns", async function () {
    const { staking, token, owner, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(1_000), 3);
    await staking.connect(owner).setMinimums(CT(100), CT(1_000));
    await time.increaseTo(a.start + 200n * DAY);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "BelowMinClaim");
    await time.increaseTo(a.end);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(0);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(1_000) + a.maxInterest);
  });

  it("setCaps bounds the open position cap to 1 to 20", async function () {
    const { staking, owner, alice } = await loadFixture(fixture);
    await expect(staking.connect(owner).setCaps(1, CT(5), CT(7))).to.emit(staking, "CapsSet").withArgs(1n, CT(5), CT(7));
    await expect(staking.connect(owner).setCaps(0, 0, CT(1_000_000))).to.be.revertedWithCustomError(staking, "MaxOpenPositionsOutOfBounds").withArgs(0n);
    await expect(staking.connect(owner).setCaps(21, 0, CT(1_000_000))).to.be.revertedWithCustomError(staking, "MaxOpenPositionsOutOfBounds").withArgs(21n);
    await staking.connect(owner).setCaps(1, 0, CT(1_000_000));
    await staking.connect(alice).stake(CT(100), 0);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "TooManyPositions").withArgs(1n, 1n);
  });
});

describe("CojamStaking: rewards and treasury", function () {
  it("withdrawRewards sends unowed reward CT to the treasury only", async function () {
    const { staking, token, owner, treasury, alice } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(10_000), 3);
    const avail = REWARDS - a.maxInterest;
    expect(await staking.availableRewards()).to.equal(avail);
    await expect(staking.connect(owner).withdrawRewards(CT(1), owner.address))
      .to.be.revertedWithCustomError(staking, "NotTreasury").withArgs(owner.address);
    await expect(staking.connect(owner).withdrawRewards(0, treasury.address)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    await expect(staking.connect(owner).withdrawRewards(avail + 1n, treasury.address))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(avail, avail + 1n);
    const before = await token.balanceOf(treasury.address);
    await expect(staking.connect(owner).withdrawRewards(avail, treasury.address))
      .to.emit(staking, "RewardsWithdrawn").withArgs(treasury.address, avail);
    expect(await token.balanceOf(treasury.address)).to.equal(before + avail);
    expect(await staking.totalRewardsWithdrawn()).to.equal(avail);
    expect(await staking.availableRewards()).to.equal(0n);
    await expect(staking.connect(owner).withdrawRewards(1, treasury.address))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(0n, 1n);
    // Alice is still paid in full.
    await time.increaseTo(a.end);
    await staking.connect(alice).withdraw(0);
    const s = await solvency(token, staking);
    expect(s.bal).to.equal(0n);
  });

  it("CT sent directly becomes reward CT", async function () {
    const { staking, token, alice } = await loadFixture(fixture);
    await token.connect(alice).transfer(await staking.getAddress(), CT(7));
    expect(await staking.availableRewards()).to.equal(REWARDS + CT(7));
  });

  it("the owner cannot reach principal or committed interest by any path", async function () {
    const { staking, token, owner, treasury, alice, bob } = await loadFixture(fixture);
    const a = await open(staking, alice, CT(100_000), 3);
    await open(staking, bob, CT(3_000), 1);
    await staking.connect(owner).withdrawRewards(await staking.availableRewards(), treasury.address);
    const locked = (await staking.totalPrincipal()) + (await staking.totalCommitted());
    expect(await token.balanceOf(await staking.getAddress())).to.equal(locked);
    // Every owner lever, then try to pull one unit.
    await staking.connect(owner).setRates([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    await staking.connect(owner).setTiers([1n, 2n]);
    await staking.connect(owner).setMinimums(CT(100_000), CT(1_000));
    await staking.connect(owner).setCaps(1, 1n, 1n);
    await staking.connect(owner).pause();
    await staking.connect(owner).proposeTreasury(owner.address);
    await time.increase(2n * DAY);
    await staking.connect(owner).applyTreasury();
    await expect(staking.connect(owner).withdrawRewards(1, owner.address))
      .to.be.revertedWithCustomError(staking, "InsufficientRewards").withArgs(0n, 1n);
    await expect(staking.connect(owner).withdraw(0)).to.be.revertedWithCustomError(staking, "UnknownPosition");
    await expect(staking.connect(owner).claimInterest(0)).to.be.revertedWithCustomError(staking, "UnknownPosition");
    // Positions still pay in full.
    await time.increaseTo(a.end);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(0);
    expect(await token.balanceOf(alice.address)).to.equal(before + CT(100_000) + a.maxInterest);
    await staking.connect(bob).withdraw(0);
    expect(await token.balanceOf(await staking.getAddress())).to.equal(0n);
  });

  it("changes the treasury only after 48 hours", async function () {
    const { staking, token, owner, treasury, stranger } = await loadFixture(fixture);
    await expect(staking.connect(owner).proposeTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(staking, "ZeroAddress");
    await expect(staking.connect(owner).applyTreasury()).to.be.revertedWithCustomError(staking, "NoTreasuryProposal");
    await expect(staking.connect(owner).cancelTreasury()).to.be.revertedWithCustomError(staking, "NoTreasuryProposal");
    const tx = await staking.connect(owner).proposeTreasury(stranger.address);
    const eta = (await txTime(tx)) + 2n * DAY;
    await expect(tx).to.emit(staking, "TreasuryProposed").withArgs(stranger.address, eta);
    expect(await staking.pendingTreasury()).to.equal(stranger.address);
    expect(await staking.pendingTreasuryEta()).to.equal(eta);
    // Still the old treasury meanwhile.
    await expect(staking.connect(owner).withdrawRewards(1, stranger.address)).to.be.revertedWithCustomError(staking, "NotTreasury");
    await time.increaseTo(eta - 2n);
    await expect(staking.connect(owner).applyTreasury()).to.be.revertedWithCustomError(staking, "TreasuryDelayNotPassed").withArgs(eta);
    await time.setNextBlockTimestamp(eta);
    await expect(staking.connect(owner).applyTreasury()).to.emit(staking, "TreasurySet").withArgs(treasury.address, stranger.address);
    expect(await staking.treasury()).to.equal(stranger.address);
    expect(await staking.pendingTreasury()).to.equal(ethers.ZeroAddress);
    expect(await staking.pendingTreasuryEta()).to.equal(0n);
    await staking.connect(owner).withdrawRewards(CT(1), stranger.address);
    expect(await token.balanceOf(stranger.address)).to.equal(CT(1));
    await expect(staking.connect(owner).withdrawRewards(1, treasury.address)).to.be.revertedWithCustomError(staking, "NotTreasury");
  });

  it("cancels or replaces a pending treasury (a new proposal restarts the delay)", async function () {
    const { staking, owner, stranger, bob } = await loadFixture(fixture);
    await staking.connect(owner).proposeTreasury(stranger.address);
    await expect(staking.connect(owner).cancelTreasury()).to.emit(staking, "TreasuryProposalCancelled").withArgs(stranger.address);
    await expect(staking.connect(owner).applyTreasury()).to.be.revertedWithCustomError(staking, "NoTreasuryProposal");
    await staking.connect(owner).proposeTreasury(stranger.address);
    await time.increase(DAY);
    await staking.connect(owner).proposeTreasury(bob.address);
    await time.increase(DAY + 10n);
    await expect(staking.connect(owner).applyTreasury()).to.be.revertedWithCustomError(staking, "TreasuryDelayNotPassed");
    await time.increase(DAY);
    await staking.connect(owner).applyTreasury();
    expect(await staking.treasury()).to.equal(bob.address);
  });
});

describe("CojamStaking: pause and access control", function () {
  it("the pauser and the owner can pause; only the owner can unpause", async function () {
    const { staking, owner, pauser, stranger } = await loadFixture(fixture);
    await expect(staking.connect(stranger).pause())
      .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount").withArgs(stranger.address, PAUSER);
    await staking.connect(owner).pause();
    await expect(staking.connect(pauser).pause()).to.be.revertedWithCustomError(staking, "EnforcedPause");
    await expect(staking.connect(pauser).unpause())
      .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount").withArgs(pauser.address, ADMIN);
    await staking.connect(owner).unpause();
    await expect(staking.connect(owner).unpause()).to.be.revertedWithCustomError(staking, "ExpectedPause");
    await staking.connect(pauser).pause();
    expect(await staking.paused()).to.equal(true);
  });

  it("every owner function refuses the pauser and a stranger", async function () {
    const { staking, pauser, stranger, treasury } = await loadFixture(fixture);
    const calls = [
      (s) => s.setRates([[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]),
      (s) => s.setTiers([CT(1), CT(2)]),
      (s) => s.setMinimums(CT(100), CT(10)),
      (s) => s.setCaps(20, 0, CT(1_000_000)),
      (s) => s.withdrawRewards(1, treasury.address),
      (s) => s.proposeTreasury(stranger.address),
      (s) => s.cancelTreasury(),
      (s) => s.applyTreasury(),
      (s) => s.unpause(),
    ];
    for (const who of [pauser, stranger]) {
      for (const call of calls) {
        await expect(call(staking.connect(who)))
          .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount").withArgs(who.address, ADMIN);
      }
    }
  });

  it("the owner role moves only through the 3 day two step transfer and can grant and revoke the pauser", async function () {
    const { staking, owner, pauser, stranger } = await loadFixture(fixture);
    await expect(staking.connect(owner).grantRole(ADMIN, stranger.address))
      .to.be.revertedWithCustomError(staking, "AccessControlEnforcedDefaultAdminRules");
    await staking.connect(owner).revokeRole(PAUSER, pauser.address);
    await expect(staking.connect(pauser).pause()).to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount");
    await staking.connect(owner).grantRole(PAUSER, stranger.address);
    await staking.connect(stranger).pause();
    await staking.connect(owner).beginDefaultAdminTransfer(stranger.address);
    await expect(staking.connect(stranger).acceptDefaultAdminTransfer())
      .to.be.revertedWithCustomError(staking, "AccessControlEnforcedDefaultAdminDelay");
    await time.increase(3n * DAY + 1n);
    await staking.connect(stranger).acceptDefaultAdminTransfer();
    expect(await staking.owner()).to.equal(stranger.address);
    await staking.connect(stranger).unpause();
    await expect(staking.connect(owner).setCaps(20, 0, CT(1_000_000))).to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount");
  });
});

describe("CojamStaking: views", function () {
  it("quote gives tier, rate, interest and end for every lock without checks", async function () {
    const { staking } = await loadFixture(unfunded);
    for (let i = 0; i < 4; i++) {
      const [tier, apr, interest, end] = await staking.quote(CT(1_000), i);
      const now = BigInt(await time.latest());
      expect(tier).to.equal(1n);
      expect(apr).to.equal(RATES[i][1]);
      expect(interest).to.equal(maxInterestOf(CT(1_000), i));
      expect(end).to.equal(now + LOCK_DAYS[i] * DAY);
    }
    const [t0, , i0] = await staking.quote(CT(1), 0); // below the minimum: still quoted
    expect(t0).to.equal(0n);
    expect(i0).to.equal(interestOf(CT(1), 800n, 30n * DAY));
    await expect(staking.quote(CT(1), 4)).to.be.revertedWithCustomError(staking, "InvalidLock").withArgs(4n);
    await expect(staking.lockDays(4)).to.be.revertedWithCustomError(staking, "InvalidLock").withArgs(4n);
    await expect(staking.lockDuration(4)).to.be.revertedWithCustomError(staking, "InvalidLock").withArgs(4n);
  });

  it("positionsOf pages through a user's positions", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    for (let i = 0; i < 5; i++) await staking.connect(alice).stake(CT(100 + i), i % 4);
    let [page, total] = await staking.positionsOf(alice.address, 0, 100);
    expect(total).to.equal(5n);
    expect(page.length).to.equal(5);
    expect(page.map((p) => p.id)).to.deep.equal([0n, 1n, 2n, 3n, 4n]);
    expect(page[2].principal).to.equal(CT(102));
    [page, total] = await staking.positionsOf(alice.address, 1, 2);
    expect(page.map((p) => p.id)).to.deep.equal([1n, 2n]);
    expect(total).to.equal(5n);
    [page] = await staking.positionsOf(alice.address, 3, 10);
    expect(page.map((p) => p.id)).to.deep.equal([3n, 4n]);
    [page, total] = await staking.positionsOf(alice.address, 5, 10);
    expect(page.length).to.equal(0);
    expect(total).to.equal(5n);
    [page] = await staking.positionsOf(alice.address, 0, 0);
    expect(page.length).to.equal(0);
    [page, total] = await staking.positionsOf(bob.address, 0, 10);
    expect(page.length).to.equal(0);
    expect(total).to.equal(0n);
    await time.increase(40n * DAY);
    await staking.connect(alice).withdraw(0);
    [page] = await staking.positionsOf(alice.address, 0, 2);
    expect(page[0].closed).to.equal(true);
    expect(page[0].claimable).to.equal(0n);
    expect(page[1].claimable).to.equal(interestOf(CT(101), 1200n, BigInt(await time.latest()) - page[1].start));
  });

  it("claimable and positionOf revert on an unknown id", async function () {
    const { staking, alice } = await loadFixture(fixture);
    await expect(staking.claimable(alice.address, 0)).to.be.revertedWithCustomError(staking, "UnknownPosition").withArgs(0n);
    await expect(staking.positionOf(alice.address, 0)).to.be.revertedWithCustomError(staking, "UnknownPosition").withArgs(0n);
  });

  it("supports the AccessControl interface ids", async function () {
    const { staking } = await loadFixture(fixture);
    expect(await staking.supportsInterface("0x7965db0b")).to.equal(true); // IAccessControl
    expect(await staking.supportsInterface("0xffffffff")).to.equal(false);
  });
});

describe("CojamStaking: reentrancy", function () {
  async function evil() {
    const ctx = await loadFixture(evilFixture);
    await ctx.token.configure(0, false, false, ctx.addr, ctx.treasury.address);
    return ctx;
  }

  it("re-entering stake from the pull is refused", async function () {
    const { staking, token, alice, addr, treasury } = await evil();
    await token.configure(1, false, false, addr, treasury.address);
    await expect(staking.connect(alice).stake(CT(100), 0)).to.be.revertedWithCustomError(staking, "ReentrancyGuardReentrantCall");
  });

  it("re-entering claimInterest or withdraw from a payout is refused", async function () {
    const { staking, token, alice, addr, treasury } = await evil();
    const a = await open(staking, alice, CT(10_000), 3);
    await time.increaseTo(a.start + 30n * DAY);
    await token.configure(2, true, false, addr, treasury.address);
    await expect(staking.connect(alice).claimInterest(0)).to.be.revertedWithCustomError(staking, "ReentrancyGuardReentrantCall");
    await time.increaseTo(a.end);
    await token.configure(3, true, false, addr, treasury.address);
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "ReentrancyGuardReentrantCall");
  });

  it("re-entering stake from a reward withdrawal is refused; withdrawRewards itself needs the owner", async function () {
    const { staking, token, owner, alice, addr, treasury } = await evil();
    await token.configure(1, true, false, addr, treasury.address);
    await expect(staking.connect(owner).withdrawRewards(CT(1), treasury.address))
      .to.be.revertedWithCustomError(staking, "ReentrancyGuardReentrantCall");
    await token.configure(4, false, false, addr, treasury.address);
    await expect(staking.connect(alice).stake(CT(100), 0))
      .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount");
  });

  it("a swallowed re-entry cannot succeed and the outer call stays correct", async function () {
    const { staking, token, alice, addr, treasury } = await evil();
    const a = await open(staking, alice, CT(10_000), 3);
    await time.increaseTo(a.end);
    await token.configure(3, true, true, addr, treasury.address);
    await staking.connect(alice).withdraw(0);
    expect(await token.reentryAttempted()).to.equal(true);
    expect(await token.reentrySucceeded()).to.equal(false);
    expect((await solvency(token, staking)).ok).to.equal(true);
    expect(await staking.totalPrincipal()).to.equal(0n);
  });
});

describe("CojamStaking: short lock test build", function () {
  it("StakingShortLock scales the lock days and keeps the same maths", async function () {
    const { staking, alice } = await loadFixture(shortLockFixture);
    expect(await staking.lockDuration(0)).to.equal(30n * 60n);
    const a = await open(staking, alice, CT(10_000), 0);
    expect(a.end - a.start).to.equal(1800n);
    expect(a.maxInterest).to.equal(interestOf(CT(10_000), 1000n, 1800n));
    await time.increaseTo(a.end);
    await expect(staking.connect(alice).withdraw(0)).to.emit(staking, "Withdrawn").withArgs(alice.address, 0n, CT(10_000), a.maxInterest);
  });
});
