const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CojamToken (basic, 18 decimals)", function () {
  it("mints exactly 2,000,000,000 CT with 18 decimals to the master and nothing else", async function () {
    const [deployer, master, other] = await ethers.getSigners();
    const t = await (await ethers.getContractFactory("CojamToken")).deploy(master.address);
    expect(await t.name()).to.equal("Cojam Token");
    expect(await t.symbol()).to.equal("CT");
    expect(await t.decimals()).to.equal(18n);
    expect(await t.totalSupply()).to.equal(2_000_000_000n * 10n ** 18n);
    expect(await t.balanceOf(master.address)).to.equal(2_000_000_000n * 10n ** 18n);
    expect(await t.balanceOf(deployer.address)).to.equal(0n);
    await t.connect(master).transfer(other.address, 5n);
    expect(await t.balanceOf(other.address)).to.equal(5n);
  });
  it("has only the ERC-20 standard functions: no mint, burn, pause, owner, permit or recall", async function () {
    const t = await ethers.getContractFactory("CojamToken");
    const fns = t.interface.fragments.filter((f) => f.type === "function").map((f) => f.name).sort();
    expect(fns).to.deep.equal(["TOTAL_SUPPLY", "allowance", "approve", "balanceOf", "decimals", "name", "symbol", "totalSupply", "transfer", "transferFrom"]);
  });
  it("rejects the zero address as master", async function () {
    const f = await ethers.getContractFactory("CojamToken");
    await expect(f.deploy(ethers.ZeroAddress)).to.be.reverted;
  });
});
