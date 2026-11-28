// Gas measurements of CojamPredict (Hardhat EVM, paris, optimizer 200). Totals include the 21,000
// intrinsic gas and Ethereum calldata pricing; Kaia fee delegated transactions add about 10,000 more and
// price calldata differently (DEV-PLAN 4.9), so treat these as execution references for Kairos.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { H, DAY, E18, DEFAULTS, dayOpen, weekEnd, marketsFor, deployPredict, goTo, resolveDay, passSettle } = require("./predictHelpers");

const Z = ethers.ZeroAddress;
const rows = [];
const gasOf = async (txPromise) => (await (await txPromise).wait()).gasUsed;
const note = (name, gas, plan) => rows.push({ call: name, gas: Number(gas), plan: plan || "" });

async function wallets(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    await setBalance(w.address, 10n ** 20n);
    out.push(w);
  }
  return out;
}

describe("CojamPredict: gas report", function () {
  this.timeout(0);
  after(function () {
    console.log("\n    CojamPredict gas (total per transaction)");
    for (const r of rows) console.log(`      ${r.call.padEnd(62)} ${String(r.gas).padStart(9)}   ${r.plan}`);
  });

  it("measures predict, play keys, settle, compensate, convert, airdrop and operator calls", async function () {
    const ctx = await deployPredict();
    const { predict, op, master, alice, bob, dave, key1, day0, week } = ctx;

    // operator calls
    const d9 = day0 + 9n;
    note("createDay (5 markets)", await gasOf(op.createDay(d9, marketsFor(d9))));
    const [w1, w2] = await wallets(2);
    note("registerPlayer, no inviter", await gasOf(op.registerPlayer(w1.address, Z)));
    note("registerPlayer, with inviter", await gasOf(op.registerPlayer(w2.address, alice.address)));
    note("setFrozen", await gasOf(op.setFrozen(w1.address, true, ethers.ZeroHash)));

    // play key
    const now = BigInt(await time.latest());
    note("setPlayKey (first key)", await gasOf(predict.connect(alice).setPlayKey(key1.address, now + 30n * DAY)), "plan about 85,000");
    note("setPlayKey (renew same key)", await gasOf(predict.connect(alice).setPlayKey(key1.address, now + 31n * DAY)));

    await goTo(dayOpen(day0));
    const id = (s) => day0 * 5n + BigInt(s);
    // alice through her play key, no inviter
    const g = [];
    for (let s = 0; s < 5; s++) g.push(await gasOf(predict.connect(key1).predict(id(s), 1)));
    note("predict by play key, first of the day", g[0], "plan about 74,000");
    note("predict by play key, second to fourth", g[2], "plan about 55,000");
    note("predict by play key, fifth, very first credit of the contract", g[4], "totalSupply slot 0 to non zero, once ever");
    // bob by wallet
    const gb = [];
    for (let s = 0; s < 5; s++) gb.push(await gasOf(predict.connect(bob).predict(id(s), 2)));
    note("predict by wallet, first of the day", gb[0]);
    note("predict by wallet, fifth (completion, first day, no inviter)", gb[4], "first credit of the player and of its week");
    // dave invited by alice: first completed day pays bonus and welcome
    const gd = [];
    for (let s = 0; s < 5; s++) gd.push(await gasOf(predict.connect(dave).predict(id(s), (s % 2) + 1)));
    note("predict, fifth, invited, first completed day (bonus + welcome)", gd[4], "plan 101,000 to 116,000");
    expect(gd[4]).to.be.lessThan(150000n); // the fee payer cap for predict
    // a later day: completion without the completedOnce write
    await goTo(dayOpen(day0 + 1n));
    const g2 = [], gd2 = [];
    for (let s = 0; s < 5; s++) g2.push(await gasOf(predict.connect(key1).predict((day0 + 1n) * 5n + BigInt(s), 1)));
    for (let s = 0; s < 5; s++) gd2.push(await gasOf(predict.connect(dave).predict((day0 + 1n) * 5n + BigInt(s), 1)));
    note("predict by play key, fifth, later day, no inviter", g2[4], "plan 80,000 to 95,000");
    note("predict, fifth, later day, invited (bonus)", gd2[4], "plan 95,000 to 110,000");

    // settleMany with 100 users per call
    const players = await wallets(100);
    const half = players.slice(0, 50);
    await op.registerPlayers(players.map((p) => p.address), players.map((p, i) => (i % 2 ? alice.address : Z)));
    const d = day0 + 2n;
    await goTo(dayOpen(d));
    for (let s = 0; s < 5; s++) await op.setOutcome(day0 * 5n + BigInt(s), 1);
    for (const [i, p] of players.entries()) {
      for (let s = 0; s < 5; s++) await predict.connect(p).predict(d * 5n + BigInt(s), i < 50 ? 2 : 1); // first 50 miss everything
    }
    await resolveDay(ctx, d, [1, 1, 1, 1, 1]);
    await passSettle(ctx, d);
    const gNo = await gasOf(predict.settleMany(half.map((p) => p.address), d));
    note("settleMany, per user, no hits (batch of 50)", gNo / 50n, "plan about 30,000");
    const rest = players.slice(50);
    const gHit = await gasOf(predict.settleMany(rest.map((p) => p.address), d));
    note("settleMany, per user, 5 hits, half invited (batch of 50)", gHit / 50n, "plan 30,000 to 45,000");
    note("settle (single user, 5 hits, no inviter)", await gasOf(predict.settle(alice.address, day0)));

    // compensation of 50 users
    await passSettle(ctx, d);
    await predict.connect(master).setCorrectedOutcome(d * 5n, 2);
    const gComp = await gasOf(op.compensate(d * 5n, half.map((p) => p.address)));
    note("compensate, per user (batch of 50, half invited)", gComp / 50n);
    note("setOutcome", await gasOf((async () => { await resolveDay(ctx, day0 + 3n, [0, 0, 0, 0, 0]); return op.setOutcome((day0 + 3n) * 5n, 1); })()));

    // convert (account age reached)
    await goTo(dayOpen(day0 + 9n));
    expect(await predict.balanceOf(alice.address)).to.be.greaterThanOrEqual(1000n);
    note("convert (first of the day for the user and globally)", await gasOf(predict.connect(alice).convert(1000)), "plan about 95,000");

    // airdrop with 10 winners
    await goTo(weekEnd(week) + DEFAULTS.airdropDelay);
    const lt = (v) => (v === 0n ? 2n ** 64n : v);
    const scored = [];
    for (const p of [...players, alice, bob, dave]) scored.push({ a: p.address, s: await predict.weekPoints(week, p.address) });
    scored.sort((x, y) => (x.s.points !== y.s.points ? (x.s.points > y.s.points ? -1 : 1)
      : lt(x.s.lastCompletionAt) !== lt(y.s.lastCompletionAt) ? (lt(x.s.lastCompletionAt) < lt(y.s.lastCompletionAt) ? -1 : 1) : (BigInt(x.a) < BigInt(y.a) ? -1 : 1)));
    const winners = scored.slice(0, 10).map((x) => x.a);
    note("airdrop, 10 winners", await gasOf(op.airdrop(week, winners, 1000n * E18)));
    note("withdrawReserve", await gasOf(predict.connect(master).withdrawReserve(E18, ctx.treasury.address)));
    note("proposeParams", await gasOf(predict.connect(master).proposeParams({ ...DEFAULTS, treasury: ctx.treasury.address })));
    await time.increase(48n * H);
    note("applyParams", await gasOf(predict.connect(master).applyParams()));
  });
});
