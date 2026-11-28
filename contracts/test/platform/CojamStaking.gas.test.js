const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { CT, DAY, deployStaking } = require("./stakingHelpers");

// Measures the gas of the three sponsored holder calls. The ceilings are the fee payer's
// caps in DEV-PLAN 6.3 (stake 300,000; claimInterest and withdraw 200,000), so a change that
// would break sponsorship fails here. Set STAKING_GAS_LOG=1 to print the figures.
const fixture = () => deployStaking();

describe("CojamStaking: gas", function () {
  it("stake, claimInterest and withdraw stay inside the fee payer caps", async function () {
    const { staking, alice, bob } = await loadFixture(fixture);
    const gas = async (tx) => (await (await tx).wait()).gasUsed;
    const g = {};
    g["stake (first position of a user, first in contract)"] = await gas(staking.connect(alice).stake(CT(10_000), 1));
    g["stake (first position of a user)"] = await gas(staking.connect(bob).stake(CT(1_000), 1));
    g["stake (a later position)"] = await gas(staking.connect(alice).stake(CT(1_000), 1));
    for (let i = 0; i < 17; i++) await staking.connect(alice).stake(CT(100), 0);
    g["stake (a later position, near the per user cap)"] = await gas(staking.connect(bob).stake(CT(990_000) - CT(1_000), 1));
    g["stake (20th open position)"] = await gas(staking.connect(alice).stake(CT(100), 0));
    await time.increase(60n * DAY);
    g["claimInterest (first claim, locked)"] = await gas(staking.connect(alice).claimInterest(0));
    await time.increase(10n * DAY);
    g["claimInterest (later claim, locked)"] = await gas(staking.connect(alice).claimInterest(0));
    await time.increase(30n * DAY);
    g["claimInterest (after the lock)"] = await gas(staking.connect(alice).claimInterest(1));
    g["withdraw (after claims)"] = await gas(staking.connect(alice).withdraw(0));
    g["withdraw (never claimed)"] = await gas(staking.connect(alice).withdraw(2));
    g["withdraw (never claimed, another user)"] = await gas(staking.connect(bob).withdraw(0));

    if (process.env.STAKING_GAS_LOG) {
      for (const [k, v] of Object.entries(g)) console.log(`      ${k}: ${v}`);
    }
    for (const [k, v] of Object.entries(g)) {
      const cap = k.startsWith("stake") ? 300_000n : 200_000n;
      expect(v < cap, k).to.equal(true);
    }
  });
});
