const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  H, DAY, E18, MAX_TTL, DEFAULTS, paramsObj, weekOf, dayOpen, hash, marketsFor, deployPredict, at, goTo, play,
} = require("./predictHelpers");

const fixture = () => deployPredict();
const Z = ethers.ZeroAddress;

describe("CojamPredict: deployment and token shape", function () {
  it("sets CT, roles, constants and the default parameters", async function () {
    const { predict, ct, master, operator, treasury } = await loadFixture(fixture);
    expect(await predict.CT()).to.equal(await ct.getAddress());
    expect(await predict.owner()).to.equal(master.address);
    expect(await predict.defaultAdmin()).to.equal(master.address);
    expect(await predict.defaultAdminDelay()).to.equal(3n * DAY);
    expect(await predict.hasRole(await predict.OPERATOR_ROLE(), operator.address)).to.equal(true);
    expect(await predict.hasRole(await predict.PAUSER_ROLE(), operator.address)).to.equal(true);
    expect(await predict.hasRole(await predict.PAUSER_ROLE(), master.address)).to.equal(true);
    expect(await predict.hasRole(await predict.OPERATOR_ROLE(), master.address)).to.equal(false);
    expect(await predict.MAX_PLAY_KEY_TTL()).to.equal(MAX_TTL);
    expect(await predict.RESOLVE_DEADLINE()).to.equal(48n * H);
    expect(await predict.PARAM_DELAY()).to.equal(48n * H);
    expect(await predict.MAX_BATCH()).to.equal(200n);
    expect(await predict.MAX_COMPENSATE_BATCH()).to.equal(500n);
    expect(await predict.EXPIRED_REASON()).to.equal(ethers.encodeBytes32String("expired"));
    expect(paramsObj(await predict.params())).to.deep.equal({ ...DEFAULTS, treasury: treasury.address });
    const [, applyAfter] = await predict.pendingParams();
    expect(applyAfter).to.equal(0n);
  });

  it("is an ERC-20 shaped soulbound ledger: metadata, zero allowance, transfers and approvals revert", async function () {
    const { predict, alice, bob } = await loadFixture(fixture);
    expect(await predict.name()).to.equal("Cojam Points");
    expect(await predict.symbol()).to.equal("CJP");
    expect(await predict.decimals()).to.equal(0n);
    expect(await predict.totalSupply()).to.equal(0n);
    expect(await predict.allowance(alice.address, bob.address)).to.equal(0n);
    await expect(predict.connect(alice).transfer(bob.address, 0)).to.be.revertedWithCustomError(predict, "PointsNonTransferable");
    await expect(predict.connect(alice).transferFrom(alice.address, bob.address, 0)).to.be.revertedWithCustomError(predict, "PointsNonTransferable");
    await expect(predict.connect(alice).approve(bob.address, 1)).to.be.revertedWithCustomError(predict, "PointsNonTransferable");
  });

  it("has no proxy, upgrade, mint or move surface", async function () {
    const { predict } = await loadFixture(fixture);
    const names = predict.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const banned of ["upgradeTo", "upgradeToAndCall", "initialize", "mint", "burn", "move", "setBalance", "sweep", "recoverERC20", "increaseAllowance"]) {
      expect(names, banned).to.not.include(banned);
    }
  });

  it("rejects zero addresses and a token without 18 decimals", async function () {
    const { Predict, ct, master, operator, treasury } = await loadFixture(fixture);
    const a = await ct.getAddress();
    await expect(Predict.deploy(Z, master.address, operator.address, treasury.address)).to.be.revertedWithCustomError(Predict, "ZeroAddress");
    await expect(Predict.deploy(a, master.address, Z, treasury.address)).to.be.revertedWithCustomError(Predict, "ZeroAddress");
    await expect(Predict.deploy(a, master.address, operator.address, Z)).to.be.revertedWithCustomError(Predict, "ZeroAddress");
    await expect(Predict.deploy(a, Z, operator.address, treasury.address)).to.be.revertedWithCustomError(Predict, "AccessControlInvalidDefaultAdmin");
    const ct9 = await (await ethers.getContractFactory("PredictMockCT")).deploy(9);
    await expect(Predict.deploy(await ct9.getAddress(), master.address, operator.address, treasury.address)).to.be.revertedWithCustomError(Predict, "DecimalsMismatch");
  });

  it("time views: currentDay, weekOf (Monday 00:00 UTC boundary) and weekEnd", async function () {
    const { predict, day0, week } = await loadFixture(fixture);
    expect(await predict.currentDay()).to.equal(day0 - 1n);
    expect(await predict.weekOf(day0)).to.equal(week); // day0 is a Monday
    expect(await predict.weekOf(day0 - 1n)).to.equal(week - 1n); // Sunday before
    expect(await predict.weekOf(day0 + 6n)).to.equal(week); // Sunday after
    expect(await predict.weekOf(day0 + 7n)).to.equal(week + 1n);
    expect(await predict.weekEnd(week)).to.equal(dayOpen(day0 + 7n));
    // 1970-01-05 (day 4) was a Monday: the first day of week 1.
    expect(await predict.weekOf(3)).to.equal(0n);
    expect(await predict.weekOf(4)).to.equal(1n);
    expect(new Date(Number(dayOpen(day0)) * 1000).getUTCDay()).to.equal(1);
    await goTo(dayOpen(day0) - 1n);
    expect(await predict.currentDay()).to.equal(day0 - 1n);
    await goTo(dayOpen(day0));
    expect(await predict.currentDay()).to.equal(day0);
  });
});

describe("CojamPredict: players, invites and freezes", function () {
  it("registers a player with and without an inviter", async function () {
    const { predict, op, eve, alice, rest } = await loadFixture(fixture);
    const tx = op.registerPlayer(eve.address, alice.address);
    await expect(tx).to.emit(predict, "PlayerRegistered").withArgs(eve.address)
      .and.to.emit(predict, "ReferrerSet").withArgs(eve.address, alice.address);
    const ts = BigInt(await time.latest());
    const p = await predict.players(eve.address);
    expect(p.referrer).to.equal(alice.address);
    expect(p.registeredAt).to.equal(ts);
    expect(p.registered).to.equal(true);
    expect(p.frozen).to.equal(false);
    expect(p.completedOnce).to.equal(false);
    expect(await predict.referrerOf(eve.address)).to.equal(alice.address);
    expect(await predict.referredCount(alice.address)).to.equal(2n); // dave and eve
    await expect(op.registerPlayer(rest[0].address, Z)).to.emit(predict, "PlayerRegistered").and.not.to.emit(predict, "ReferrerSet");
    expect(await predict.referrerOf(rest[0].address)).to.equal(Z);
  });

  it("registerPlayer refuses zero, repeats and bad inviters", async function () {
    const { predict, op, alice, bob, eve, rest } = await loadFixture(fixture);
    await expect(op.registerPlayer(Z, Z)).to.be.revertedWithCustomError(predict, "ZeroAddress");
    await expect(op.registerPlayer(alice.address, Z)).to.be.revertedWithCustomError(predict, "AlreadyRegistered");
    await expect(op.registerPlayer(eve.address, eve.address)).to.be.revertedWithCustomError(predict, "BadReferrer");
    await expect(op.registerPlayer(eve.address, rest[0].address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // unregistered
    await op.setFrozen(bob.address, true, ethers.ZeroHash);
    await expect(op.registerPlayer(eve.address, bob.address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // frozen
  });

  it("registration wins over a squatted play key: the binding is removed, the batch goes through", async function () {
    const { predict, op, alice, key1, key2, rest, day0 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    // alice binds the address of a wallet that is about to be registered
    await predict.connect(alice).setPlayKey(key1.address, now + DAY);
    await expect(op.registerPlayers([rest[0].address, key1.address], [Z, Z]))
      .to.emit(predict, "PlayKeyRevoked").withArgs(alice.address, key1.address)
      .and.to.emit(predict, "PlayerRegistered").withArgs(key1.address);
    expect((await predict.playKeyOf(alice.address)).key).to.equal(Z);
    expect(await predict.playerOfKey(key1.address)).to.equal(Z);
    expect((await predict.players(key1.address)).registered).to.equal(true);
    // the new player sets its own key and predicts; the squatter's old key path is gone
    await predict.connect(key1).setPlayKey(key2.address, now + DAY);
    await goTo(dayOpen(day0));
    await expect(predict.connect(key2).predict(day0 * 5n, 1)).to.emit(predict, "Predicted").withArgs(key1.address, day0 * 5n, day0, 1, 1);
    await predict.connect(key1).predict(day0 * 5n + 1n, 2);
    expect((await predict.dayOf(key1.address, day0)).answered).to.equal(2n);
    expect((await predict.dayOf(alice.address, day0)).answered).to.equal(0n);
    // registering an unbound wallet emits no revoke
    await expect(op.registerPlayer(rest[1].address, Z)).to.not.emit(predict, "PlayKeyRevoked");
  });

  it("registerPlayers: batch, length mismatch, 200 cap, all or nothing", async function () {
    const { predict, op, alice, rest } = await loadFixture(fixture);
    const w = rest.slice(0, 3).map((s) => s.address);
    await expect(op.registerPlayers(w, [Z, alice.address, Z])).to.emit(predict, "ReferrerSet").withArgs(w[1], alice.address);
    for (const a of w) expect((await predict.players(a)).registered).to.equal(true);
    await expect(op.registerPlayers([rest[3].address], [])).to.be.revertedWithCustomError(predict, "LengthMismatch");
    const many = Array.from({ length: 201 }, (_, i) => ethers.getAddress(ethers.toBeHex(1000 + i, 20)));
    await expect(op.registerPlayers(many, many.map(() => Z))).to.be.revertedWithCustomError(predict, "BatchTooLarge");
    await expect(op.registerPlayers([rest[3].address, w[0]], [Z, Z])).to.be.revertedWithCustomError(predict, "AlreadyRegistered");
    expect((await predict.players(rest[3].address)).registered).to.equal(false);
    const ok = many.slice(0, 200);
    await op.registerPlayers(ok, ok.map(() => Z));
    expect((await predict.players(ok[199])).registered).to.equal(true);
  });

  it("setReferrer links once, within 24 hours of registration, with every refusal", async function () {
    const { predict, op, alice, bob, carol, dave, eve, day0 } = await loadFixture(fixture);
    await expect(op.setReferrer(bob.address, carol.address)).to.emit(predict, "ReferrerSet").withArgs(bob.address, carol.address);
    expect(await predict.referredCount(carol.address)).to.equal(1n);
    await expect(op.setReferrer(bob.address, alice.address)).to.be.revertedWithCustomError(predict, "ReferrerAlreadySet");
    await expect(op.setReferrer(dave.address, bob.address)).to.be.revertedWithCustomError(predict, "ReferrerAlreadySet");
    await expect(op.setReferrer(eve.address, alice.address)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(op.setReferrer(carol.address, carol.address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // self
    await expect(op.setReferrer(carol.address, bob.address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // two way (bob -> carol)
    await expect(op.setReferrer(carol.address, eve.address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // unregistered
    await op.setFrozen(alice.address, true, ethers.ZeroHash);
    await expect(op.setReferrer(carol.address, alice.address)).to.be.revertedWithCustomError(predict, "BadReferrer"); // frozen
    await op.setFrozen(alice.address, false, ethers.ZeroHash);
    // the window: accepted at registeredAt + 24 h - 1, refused from registeredAt + 24 h
    expect(await predict.INVITE_WINDOW()).to.equal(24n * H);
    const reg = (await predict.players(carol.address)).registeredAt;
    await goTo(reg + 24n * H - 2n);
    await at(reg + 24n * H);
    await expect(op.setReferrer(carol.address, alice.address)).to.be.revertedWithCustomError(predict, "InviteWindowClosed");
    expect(day0).to.be.a("bigint");
  });

  it("the 24 hour window: open at its last second, even after a completed day; a late code pays the welcome at the link", async function () {
    const { predict, op, alice, carol, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await play(predict, carol, day0, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(carol.address)).to.equal(100n);
    const reg = (await predict.players(carol.address)).registeredAt;
    await goTo(reg + 24n * H - 2n);
    await at(reg + 24n * H - 1n);
    await expect(op.setReferrer(carol.address, alice.address)).to.emit(predict, "ReferrerSet")
      .and.to.emit(predict, "WelcomePaid").withArgs(carol.address, alice.address, await predict.currentDay(), 100)
      .and.not.to.emit(predict, "ReferralPaid");
    expect(await predict.balanceOf(carol.address)).to.equal(200n);
    await goTo(dayOpen(day0 + 1n));
    await play(predict, carol, day0 + 1n, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(carol.address)).to.equal(300n); // no second welcome
    expect(await predict.balanceOf(alice.address)).to.equal(10n); // the 10% stream starts at the link
  });

  it("setReferrer is still open after 4 answers and allowed for a frozen player", async function () {
    const { predict, op, alice, bob, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await play(predict, bob, day0, [1, 1, 1, 1, 0]);
    await op.setFrozen(bob.address, true, ethers.ZeroHash);
    await expect(op.setReferrer(bob.address, alice.address)).to.emit(predict, "ReferrerSet");
  });

  it("setReferrers: batch, mismatch and cap", async function () {
    const { predict, op, alice, bob, carol, rest } = await loadFixture(fixture);
    await expect(op.setReferrers([bob.address, carol.address], [alice.address, alice.address])).to.emit(predict, "ReferrerSet");
    expect(await predict.referredCount(alice.address)).to.equal(3n);
    await expect(op.setReferrers([bob.address], [])).to.be.revertedWithCustomError(predict, "LengthMismatch");
    const many = Array.from({ length: 201 }, () => rest[0].address);
    await expect(op.setReferrers(many, many)).to.be.revertedWithCustomError(predict, "BatchTooLarge");
  });

  it("setFrozen and setFrozenMany: freeze, unfreeze, events, refusals", async function () {
    const { predict, op, alice, bob, eve } = await loadFixture(fixture);
    const reason = ethers.encodeBytes32String("cluster_device");
    await expect(op.setFrozen(alice.address, true, reason)).to.emit(predict, "PlayerFrozen").withArgs(alice.address, true, reason);
    expect((await predict.players(alice.address)).frozen).to.equal(true);
    await expect(op.setFrozen(alice.address, false, reason)).to.emit(predict, "PlayerFrozen").withArgs(alice.address, false, reason);
    expect((await predict.players(alice.address)).frozen).to.equal(false);
    await expect(op.setFrozen(eve.address, true, reason)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await op.setFrozenMany([alice.address, bob.address], true, [reason, reason]);
    expect((await predict.players(bob.address)).frozen).to.equal(true);
    await expect(op.setFrozenMany([alice.address], true, [])).to.be.revertedWithCustomError(predict, "LengthMismatch");
    const many = Array.from({ length: 201 }, () => alice.address);
    await expect(op.setFrozenMany(many, true, many.map(() => reason))).to.be.revertedWithCustomError(predict, "BatchTooLarge");
  });
});

describe("CojamPredict: play keys", function () {
  it("binds, renews, replaces and reports a key", async function () {
    const { predict, alice, key1, key2 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    await expect(predict.connect(alice).setPlayKey(key1.address, now + 30n * DAY))
      .to.emit(predict, "PlayKeySet").withArgs(alice.address, key1.address, now + 30n * DAY)
      .and.not.to.emit(predict, "PlayKeyRevoked");
    expect(await predict.playerOfKey(key1.address)).to.equal(alice.address);
    let [player, exp, valid] = await predict.playerOf(key1.address);
    expect([player, exp, valid]).to.deep.equal([alice.address, now + 30n * DAY, true]);
    // renew the same key
    await expect(predict.connect(alice).setPlayKey(key1.address, now + 60n * DAY)).to.emit(predict, "PlayKeySet").and.not.to.emit(predict, "PlayKeyRevoked");
    expect((await predict.playKeyOf(alice.address)).expiresAt).to.equal(now + 60n * DAY);
    // replace with another key: the old one is unbound
    await expect(predict.connect(alice).setPlayKey(key2.address, now + 30n * DAY))
      .to.emit(predict, "PlayKeyRevoked").withArgs(alice.address, key1.address);
    expect(await predict.playerOfKey(key1.address)).to.equal(Z);
    expect(await predict.playerOfKey(key2.address)).to.equal(alice.address);
    expect((await predict.playKeyOf(alice.address)).key).to.equal(key2.address);
    [player, exp, valid] = await predict.playerOf(key1.address);
    expect([player, exp, valid]).to.deep.equal([Z, 0n, false]);
    // expiry makes the view invalid
    await time.increaseTo(now + 30n * DAY);
    [, , valid] = await predict.playerOf(key2.address);
    expect(valid).to.equal(false);
  });

  it("setPlayKey refusals: unregistered, frozen, bad key, taken key, expiry bounds", async function () {
    const { predict, op, alice, bob, eve, key1 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    await expect(predict.connect(eve).setPlayKey(key1.address, now + DAY)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(predict.connect(alice).setPlayKey(Z, now + DAY)).to.be.revertedWithCustomError(predict, "BadPlayKey");
    await expect(predict.connect(alice).setPlayKey(alice.address, now + DAY)).to.be.revertedWithCustomError(predict, "BadPlayKey");
    await expect(predict.connect(alice).setPlayKey(bob.address, now + DAY)).to.be.revertedWithCustomError(predict, "BadPlayKey");
    // expiry: must be in the future and at most 90 days ahead
    await at(now + 10n);
    await expect(predict.connect(alice).setPlayKey(key1.address, now + 10n)).to.be.revertedWithCustomError(predict, "BadExpiry");
    await at(now + 11n);
    await expect(predict.connect(alice).setPlayKey(key1.address, now + 11n + MAX_TTL + 1n)).to.be.revertedWithCustomError(predict, "BadExpiry");
    await at(now + 12n);
    await predict.connect(alice).setPlayKey(key1.address, now + 12n + MAX_TTL); // exactly 90 days
    await expect(predict.connect(bob).setPlayKey(key1.address, now + DAY)).to.be.revertedWithCustomError(predict, "PlayKeyTaken");
    await op.setFrozen(bob.address, true, ethers.ZeroHash);
    await expect(predict.connect(bob).setPlayKey(eve.address, now + DAY)).to.be.revertedWithCustomError(predict, "Frozen");
  });

  it("an expired key stays reserved to its player until replaced or revoked", async function () {
    const { predict, alice, bob, key1 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    await predict.connect(alice).setPlayKey(key1.address, now + DAY);
    await time.increase(2n * DAY);
    await expect(predict.connect(bob).setPlayKey(key1.address, now + 5n * DAY)).to.be.revertedWithCustomError(predict, "PlayKeyTaken");
    await predict.connect(alice).setPlayKey(key1.address, now + 10n * DAY); // re-authorise the same key
    expect((await predict.playerOf(key1.address)).valid).to.equal(true);
  });

  it("revokePlayKey by the player or by the key (even expired); NoPlayKey otherwise", async function () {
    const { predict, alice, bob, key1 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    await expect(predict.connect(alice).revokePlayKey()).to.be.revertedWithCustomError(predict, "NoPlayKey");
    await predict.connect(alice).setPlayKey(key1.address, now + DAY);
    await expect(predict.connect(alice).revokePlayKey()).to.emit(predict, "PlayKeyRevoked").withArgs(alice.address, key1.address);
    expect(await predict.playerOfKey(key1.address)).to.equal(Z);
    expect((await predict.playKeyOf(alice.address)).key).to.equal(Z);
    await predict.connect(alice).setPlayKey(key1.address, now + DAY);
    await time.increase(2n * DAY);
    await expect(predict.connect(key1).revokePlayKey()).to.emit(predict, "PlayKeyRevoked").withArgs(alice.address, key1.address);
    expect((await predict.playKeyOf(alice.address)).key).to.equal(Z);
    await expect(predict.connect(key1).revokePlayKey()).to.be.revertedWithCustomError(predict, "NoPlayKey");
    await expect(predict.connect(bob).revokePlayKey()).to.be.revertedWithCustomError(predict, "NoPlayKey");
  });

  it("a key predicts for its player; expired, revoked and replaced keys cannot", async function () {
    const { predict, alice, key1, key2, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    const now = BigInt(await time.latest());
    await predict.connect(alice).setPlayKey(key1.address, now + 2n * H);
    await expect(predict.connect(key1).predict(day0 * 5n, 1)).to.emit(predict, "Predicted").withArgs(alice.address, day0 * 5n, day0, 1, 1);
    expect((await predict.dayOf(alice.address, day0)).choices[0]).to.equal(1n);
    expect((await predict.dayOf(key1.address, day0)).answered).to.equal(0n);
    // expired
    await at(now + 2n * H);
    await expect(predict.connect(key1).predict(day0 * 5n + 1n, 1)).to.be.revertedWithCustomError(predict, "BadPlayKey");
    // replaced
    await predict.connect(alice).setPlayKey(key2.address, now + 30n * DAY);
    await expect(predict.connect(key1).predict(day0 * 5n + 1n, 1)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await predict.connect(key2).predict(day0 * 5n + 1n, 2);
    // revoked by the key itself
    await predict.connect(key2).revokePlayKey();
    await expect(predict.connect(key2).predict(day0 * 5n + 2n, 1)).to.be.revertedWithCustomError(predict, "NotRegistered");
    // the wallet still predicts directly
    await predict.connect(alice).predict(day0 * 5n + 2n, 1);
    expect((await predict.dayOf(alice.address, day0)).answered).to.equal(3n);
  });

  it("a key can do nothing but predict and revoke: convert, setPlayKey and operator calls fail", async function () {
    const { predict, alice, key1, key2 } = await loadFixture(fixture);
    const now = BigInt(await time.latest());
    await predict.connect(alice).setPlayKey(key1.address, now + DAY);
    await expect(predict.connect(key1).convert(1000)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(predict.connect(key1).setPlayKey(key2.address, now + DAY)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(predict.connect(key1).registerPlayer(key2.address, Z)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(predict.connect(key1).transfer(key2.address, 1)).to.be.revertedWithCustomError(predict, "PointsNonTransferable");
    await expect(predict.connect(key1).withdrawReserve(1, key1.address)).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
  });

  it("a frozen player's key stops working", async function () {
    const { predict, op, alice, key1, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await predict.connect(alice).setPlayKey(key1.address, BigInt(await time.latest()) + DAY);
    await op.setFrozen(alice.address, true, ethers.ZeroHash);
    await expect(predict.connect(key1).predict(day0 * 5n, 1)).to.be.revertedWithCustomError(predict, "Frozen");
  });
});

describe("CojamPredict: days", function () {
  it("createDay stores 5 markets that all close at the day's end; boundary resolve times are accepted", async function () {
    const { predict, op, day0 } = await loadFixture(fixture);
    const d = day0 + 10n;
    const open = dayOpen(d);
    const m = marketsFor(d, { gap: H });
    m[1].resolvesAt = open + DAY + 30n * DAY; // maxResolveAfterClose (30 days) after the close, the last second
    m[0].resolvesAt = m[0].closesAt + H; // exactly the gap
    await expect(op.createDay(d, m)).to.emit(predict, "DayCreated").withArgs(d, m.map((x) => x.contentHash));
    const mk = await predict.markets(d * 5n + 1n);
    expect(mk.closesAt).to.equal(open + DAY);
    expect(mk.resolvesAt).to.equal(open + 31n * DAY);
    expect(mk.resolvedAt).to.equal(0n);
    expect(mk.outcome).to.equal(0n);
    expect(mk.contentHash).to.equal(m[1].contentHash);
  });

  it("createDay refusals", async function () {
    const { predict, op, stranger, day0 } = await loadFixture(fixture);
    const d = day0 + 10n;
    const open = dayOpen(d);
    const good = () => marketsFor(d);
    await expect(predict.connect(stranger).createDay(d, good())).to.be.revertedWithCustomError(predict, "AccessControlUnauthorizedAccount");
    await expect(op.createDay(day0, marketsFor(day0))).to.be.revertedWithCustomError(predict, "DayExists");
    // every close must be exactly the day's end (DECISIONS "Question timing")
    let m = good(); m[2].closesAt = open + 20n * H; m[2].resolvesAt = open + 22n * H;
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "BadTimes");
    m = good(); m[2].closesAt = open + DAY - 1n;
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "BadTimes");
    m = good(); m[3].closesAt = open + DAY + 1n; m[3].resolvesAt = open + DAY + 2n * H;
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "BadTimes");
    m = good(); m[0].resolvesAt = m[0].closesAt + H - 1n;
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "BadTimes");
    m = good(); m[4].resolvesAt = open + DAY + 30n * DAY + 1n; // beyond maxResolveAfterClose
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "BadTimes");
    m = good(); m[1].contentHash = ethers.ZeroHash;
    await expect(op.createDay(d, m)).to.be.revertedWithCustomError(predict, "EmptyContentHash");
    // a past day can never be created
    await expect(op.createDay(day0 - 2n, marketsFor(day0 - 2n))).to.be.revertedWithCustomError(predict, "BadTimes");
  });

  it("a missed day can still be created after it opened, until 1 hour before its end; then players can complete it", async function () {
    const { predict, op, alice, day0 } = await loadFixture(fixture);
    // at the open
    const a = day0 + 10n;
    await goTo(dayOpen(a) - 1n);
    await at(dayOpen(a));
    await expect(op.createDay(a, marketsFor(a))).to.emit(predict, "DayCreated");
    await expect(op.createDay(a, marketsFor(a))).to.be.revertedWithCustomError(predict, "DayExists");
    // mid day, and the day is playable at once
    const b = day0 + 11n;
    await goTo(dayOpen(b) + 12n * H);
    await op.createDay(b, marketsFor(b));
    await play(predict, alice, b, [1, 1, 1, 1, 1]);
    expect((await predict.dayOf(alice.address, b)).completed).to.equal(true);
    // the last allowed second: dayEnd - 1 hour
    const c = day0 + 12n;
    await goTo(dayOpen(c + 1n) - H - 1n);
    await at(dayOpen(c + 1n) - H);
    await op.createDay(c, marketsFor(c));
    // one second too late
    const e = day0 + 13n;
    await goTo(dayOpen(e + 1n) - H);
    await at(dayOpen(e + 1n) - H + 1n);
    await expect(op.createDay(e, marketsFor(e))).to.be.revertedWithCustomError(predict, "BadTimes");
    // and the day after has passed: still refused
    await goTo(dayOpen(e + 2n));
    await expect(op.createDay(e, marketsFor(e))).to.be.revertedWithCustomError(predict, "BadTimes");
  });

  it("the resolve gap parameter is applied at creation", async function () {
    const { predict, op, master, treasury, day0 } = await loadFixture(fixture);
    await predict.connect(master).proposeParams({ ...DEFAULTS, treasury: treasury.address, minResolveGap: 0n });
    await time.increase(48n * H);
    await predict.connect(master).applyParams();
    const d = day0 + 12n;
    await op.createDay(d, marketsFor(d, { gap: 0n }));
    expect((await predict.markets(d * 5n)).resolvesAt).to.equal((await predict.markets(d * 5n)).closesAt);
  });
});

describe("CojamPredict: predict", function () {
  it("stores answers, emits Predicted and credits completion on the fifth (any order)", async function () {
    const { predict, alice, day0, week } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    const order = [3, 0, 4, 1, 2];
    for (let i = 0; i < 5; i++) {
      const id = day0 * 5n + BigInt(order[i]);
      const tx = predict.connect(alice).predict(id, (i % 2) + 1);
      await expect(tx).to.emit(predict, "Predicted").withArgs(alice.address, id, day0, (i % 2) + 1, i + 1);
      if (i < 4) await expect(tx).not.to.emit(predict, "PointsCredited");
      else {
        await expect(tx).to.emit(predict, "PointsCredited").withArgs(alice.address, week, day0, 1, 100)
          .and.to.emit(predict, "Transfer").withArgs(Z, alice.address, 100)
          .and.not.to.emit(predict, "ReferralPaid").and.not.to.emit(predict, "WelcomePaid");
      }
    }
    const d = await predict.dayOf(alice.address, day0);
    expect(d.answered).to.equal(5n);
    expect(d.completed).to.equal(true);
    expect(d.choices.map(Number)).to.deep.equal([2, 2, 1, 1, 1]);
    expect(await predict.balanceOf(alice.address)).to.equal(100n);
    expect(await predict.totalSupply()).to.equal(100n);
    const w = await predict.weekPoints(week, alice.address);
    expect(w.points).to.equal(100n);
    expect(w.lastCompletionAt).to.equal(BigInt(await time.latest()));
    expect((await predict.players(alice.address)).completedOnce).to.equal(true);
  });

  it("refusals: paused, unregistered, frozen, bad choice, unknown market, before open, at close, twice", async function () {
    const { predict, op, master, alice, bob, eve, day0 } = await loadFixture(fixture);
    const id = day0 * 5n;
    await expect(predict.connect(alice).predict(id, 1)).to.be.revertedWithCustomError(predict, "DayNotOpen"); // before open
    await goTo(dayOpen(day0));
    await expect(predict.connect(eve).predict(id, 1)).to.be.revertedWithCustomError(predict, "NotRegistered");
    await expect(predict.connect(alice).predict(id, 0)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(predict.connect(alice).predict(id, 3)).to.be.revertedWithCustomError(predict, "BadChoice");
    await expect(predict.connect(alice).predict((day0 + 20n) * 5n, 1)).to.be.revertedWithCustomError(predict, "DayNotOpen"); // no such day
    await predict.connect(alice).predict(id, 1);
    await expect(predict.connect(alice).predict(id, 2)).to.be.revertedWithCustomError(predict, "AlreadyPredicted").withArgs(id);
    await op.setFrozen(bob.address, true, ethers.ZeroHash);
    await expect(predict.connect(bob).predict(id, 1)).to.be.revertedWithCustomError(predict, "Frozen");
    await predict.connect(op.runner).pause();
    await expect(predict.connect(alice).predict(id + 1n, 1)).to.be.revertedWithCustomError(predict, "EnforcedPause");
    await predict.connect(master).unpause();
    // close: accepted one second before, refused at closesAt
    const closesAt = (await predict.markets(id + 1n)).closesAt;
    await goTo(closesAt - 2n);
    await at(closesAt - 1n);
    await predict.connect(alice).predict(id + 1n, 1);
    await at(closesAt);
    await expect(predict.connect(alice).predict(id + 1n, 1)).to.be.revertedWithCustomError(predict, "MarketClosed");
    await expect(predict.connect(bob).predict(id + 1n, 1)).to.be.revertedWithCustomError(predict, "Frozen");
  });

  it("a market can be answered from the day's open second; tomorrow's markets wait for tomorrow", async function () {
    const { predict, alice, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0) - 2n);
    await at(dayOpen(day0) - 1n);
    await expect(predict.connect(alice).predict(day0 * 5n, 1)).to.be.revertedWithCustomError(predict, "DayNotOpen");
    await at(dayOpen(day0));
    await predict.connect(alice).predict(day0 * 5n, 1);
    await expect(predict.connect(alice).predict((day0 + 1n) * 5n, 1)).to.be.revertedWithCustomError(predict, "DayNotOpen");
  });

  it("a voided market still accepts answers, so the day can be completed", async function () {
    const { predict, op, alice, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await op.voidMarket(day0 * 5n + 2n, ethers.encodeBytes32String("bad source"));
    await play(predict, alice, day0, [1, 2, 1, 2, 1]);
    expect(await predict.balanceOf(alice.address)).to.equal(100n);
  });

  it("completion credits each day once; a second day adds again", async function () {
    const { predict, alice, day0 } = await loadFixture(fixture);
    await goTo(dayOpen(day0));
    await play(predict, alice, day0, [1, 1, 1, 1, 1]);
    await goTo(dayOpen(day0 + 1n));
    await play(predict, alice, day0 + 1n, [2, 2, 2, 2, 2]);
    expect(await predict.balanceOf(alice.address)).to.equal(200n);
  });

  it("completion points of 0 credit nothing; the invite window closes 24 hours after registration", async function () {
    const { predict, op, master, treasury, bob, carol } = await loadFixture(fixture);
    await predict.connect(master).proposeParams({ ...DEFAULTS, treasury: treasury.address, completionPoints: 0n });
    await time.increase(48n * H);
    await predict.connect(master).applyParams();
    const d = (await predict.currentDay()) + 1n;
    await goTo(dayOpen(d));
    await play(predict, bob, d, [1, 1, 1, 1, 1]);
    expect(await predict.balanceOf(bob.address)).to.equal(0n);
    await expect(op.setReferrer(bob.address, carol.address)).to.be.revertedWithCustomError(predict, "InviteWindowClosed");
  });
});

