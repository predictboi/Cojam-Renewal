// Fee payer policy and pipeline (DEV-PLAN 6.3, 4.4, 4.8), ported from platform/spike/api/test/feePayer.test.js
// and extended to the platform allow list. Sender transactions are built with our own encoder, which the
// kaia-encoding test proves byte identical to @kaiachain/ethers-ext.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { encodeAbiParameters, encodeFunctionData, keccak256, recoverAddress, toFunctionSelector, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { KlaytnTxFactory, parseTransaction } from "@kaiachain/js-ext-core";
import { cojamPredictAbi, cojamStakingAbi, erc20Abi } from "../../src/chain/abi.ts";
import { RpcError } from "../../src/chain/index.ts";
import { signSenderTx, splitV } from "../../src/feeDelegation/decode.ts";
import { currentDayId } from "../../../shared/src/time.ts";
import { CHAIN_ID, CTA, FEE_PAYER_KEY, PREDICT, STAKING, auth, buildTestApp, registeredUser, type TestKit, type TestUser } from "./helpers.ts";

let k: TestKit;
beforeAll(async () => {
  k = await buildTestApp();
});
afterAll(async () => k.close());
beforeEach(() => {
  k.rpc.estimate = 60_000n;
  k.rpc.sendError = null;
  k.chain.fail = false;
  k.chain.feePayerBalance = 100n * 10n ** 18n;
});

const predictData = (marketId: number, choice: number) => encodeFunctionData({ abi: cojamPredictAbi, functionName: "predict", args: [BigInt(marketId), choice] });
const today = () => currentDayId(k.clock.now);
const mid = (slot: number) => today() * 5 + slot;
let nonce = 0;
async function signed(key: Hex, data: Hex, over: Partial<{ to: Address; gasLimit: number; gasPrice: bigint; chainId: number; value: bigint; nonce: number }> = {}) {
  const from = privateKeyToAccount(key).address;
  return signSenderTx(key, { from, to: over.to ?? PREDICT, data, gasLimit: over.gasLimit ?? 100_000, gasPrice: over.gasPrice ?? 27_500_000_000n, chainId: over.chainId ?? CHAIN_ID, value: over.value, nonce: over.nonce ?? nonce++ });
}
const sponsor = (raw: string, headers: Record<string, string> = {}, ip = "10.0.0.1") =>
  k.app.inject({ method: "POST", url: "/v1/tx/sponsor", payload: { rawTransaction: raw }, headers, remoteAddress: ip });
const code = (r: { json: () => any }) => r.json().error?.code;

/** A registered player with a bound play key. */
async function playerWithKey(name: string): Promise<{ u: TestUser; key: Hex; keyAddr: Address }> {
  const u = await registeredUser(k, name);
  const key = generatePrivateKey();
  const keyAddr = privateKeyToAccount(key).address;
  k.chain.bindKey(keyAddr, u.wallet);
  return { u, key, keyAddr };
}

describe("predict by play key", () => {
  test("is co-signed by the fee payer and broadcast without a token", async () => {
    const { u, key, keyAddr } = await playerWithKey("p1");
    const r = await sponsor(await signed(key, predictData(mid(0), 2)));
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b).toMatchObject({ action: "predict", from: keyAddr.toLowerCase(), player: u.wallet, duplicate: false });
    expect(b.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    // The broadcast transaction carries a fee payer signature that recovers to our fee payer.
    const raw = k.rpc.sent.at(-1)!;
    const p: any = parseTransaction(raw);
    expect(p.feePayer.toLowerCase()).toBe(privateKeyToAccount(FEE_PAYER_KEY).address.toLowerCase());
    const [v, rr, s] = p.feePayerSignatures[0];
    const { yParity } = splitV(v);
    const kt = KlaytnTxFactory.fromObject({ ...p, chainId: CHAIN_ID, feePayerSignatures: undefined } as any);
    const who = await recoverAddress({ hash: keccak256(kt.sigFeePayerRLP() as Hex), signature: { r: rr, s, yParity: yParity! } });
    expect(who.toLowerCase()).toBe(p.feePayer.toLowerCase());
    // The row in sponsored_txs names the resolved player and the choice.
    const row = await k.db.selectFrom("sponsored_txs").selectAll().where("tx_hash", "=", b.txHash).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ wallet: u.wallet, action: "predict", market_id: mid(0), choice: 2, status: "broadcast", privy_user_id: null });
  });

  test("the same signed transaction posted twice is broadcast once", async () => {
    const { key } = await playerWithKey("p2");
    const raw = await signed(key, predictData(mid(1), 1));
    const sent = k.rpc.sent.length;
    const [a, b] = await Promise.all([sponsor(raw), sponsor(raw)]);
    const c = await sponsor(raw);
    expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([200, 200, 200]);
    expect(new Set([a.json().txHash, b.json().txHash, c.json().txHash]).size).toBe(1);
    expect(c.json().duplicate).toBe(true);
    expect(k.rpc.sent.length - sent).toBe(1);
  });

  test("an expired key answers PLAY_KEY_INVALID", async () => {
    const { u } = await playerWithKey("p3");
    const key = generatePrivateKey();
    k.chain.keys.set(privateKeyToAccount(key).address.toLowerCase(), { player: u.wallet, expiresAt: 1, valid: false });
    const r = await sponsor(await signed(key, predictData(mid(0), 1)));
    expect(r.statusCode).toBe(409);
    expect(code(r)).toBe("PLAY_KEY_INVALID");
  });

  test("an unbound key without a token answers PLAY_KEY_INVALID", async () => {
    const r = await sponsor(await signed(generatePrivateKey(), predictData(mid(0), 1)));
    expect(code(r)).toBe("PLAY_KEY_INVALID");
  });

  test("a replaced key (simulation reverts NotRegistered) answers PLAY_KEY_INVALID", async () => {
    const { key } = await playerWithKey("p4");
    k.rpc.estimate = new RpcError("execution reverted", { isNodeReply: true, nodeMessage: "execution reverted", nodeData: toFunctionSelector("NotRegistered()") });
    const r = await sponsor(await signed(key, predictData(mid(2), 1)));
    expect(code(r)).toBe("PLAY_KEY_INVALID");
  });

  test("an answered market (simulation reverts AlreadyPredicted) answers ALREADY_DONE", async () => {
    const { key } = await playerWithKey("p5");
    const data = (toFunctionSelector("AlreadyPredicted(uint256)") + encodeAbiParameters([{ type: "uint256" }], [BigInt(mid(3))]).slice(2)) as Hex;
    k.rpc.estimate = new RpcError("execution reverted", { isNodeReply: true, nodeMessage: "execution reverted", nodeData: data });
    const r = await sponsor(await signed(key, predictData(mid(3), 1)));
    expect(code(r)).toBe("ALREADY_DONE");
  });

  test("an answered market in the index answers ALREADY_DONE before simulation", async () => {
    const { u, key } = await playerWithKey("p6");
    await k.db.insertInto("predictions").values({ wallet: u.wallet, market_id: mid(4), day_id: today(), choice: 1, tx_hash: "0x1", block: 1 }).execute();
    const before = k.rpc.calls.length;
    const r = await sponsor(await signed(key, predictData(mid(4), 2)));
    expect(code(r)).toBe("ALREADY_DONE");
    expect(k.rpc.calls.slice(before).some((c) => c.method === "eth_estimateGas")).toBe(false);
  });

  test("yesterday's market is closed, tomorrow's is not open", async () => {
    const { key } = await playerWithKey("p7");
    expect(code(await sponsor(await signed(key, predictData((today() - 1) * 5, 1))))).toBe("MARKET_CLOSED");
    expect(code(await sponsor(await signed(key, predictData((today() + 1) * 5, 1))))).toBe("DAY_NOT_OPEN");
  });

  test("choice must be 1 or 2", async () => {
    const { key } = await playerWithKey("p8");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 3))))).toBe("CALLDATA_INVALID");
  });

  test("a frozen player gets no sponsored gas at all", async () => {
    const { u, key } = await playerWithKey("p9");
    await k.db.updateTable("users").set({ frozen: true }).where("wallet", "=", u.wallet).execute();
    const r = await sponsor(await signed(key, predictData(mid(0), 1)));
    expect(r.statusCode).toBe(403);
    expect(code(r)).toBe("FROZEN");
    // Revoking the key is refused as well (no exception for a frozen account).
    const rev = await sponsor(await signed(key, encodeFunctionData({ abi: cojamPredictAbi, functionName: "revokePlayKey", args: [] }), { gasLimit: 70_000 }));
    expect(code(rev)).toBe("FROZEN");
  });

  test("frozen on chain only (index lagging) is refused too", async () => {
    const { u, key } = await playerWithKey("p10");
    k.chain.register(u.wallet, { frozen: true });
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1))))).toBe("FROZEN");
  });

  test("a token of another user with someone's key is refused", async () => {
    const { key } = await playerWithKey("p11");
    const other = await registeredUser(k, "p11b");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1)), auth(other)))).toBe("SENDER_NOT_ALLOWED");
  });
});

describe("value actions need the bearer's wallet", () => {
  const setKeyData = (key: Address, exp: number) => encodeFunctionData({ abi: cojamPredictAbi, functionName: "setPlayKey", args: [key, BigInt(exp)] });
  const nowS = () => Math.floor(k.clock.now / 1000);

  test("setPlayKey from the bearer's wallet within 31 days is accepted", async () => {
    const u = await registeredUser(k, "w1");
    const key = privateKeyToAccount(generatePrivateKey()).address;
    const r = await sponsor(await signed(u.key, setKeyData(key, nowS() + 30 * 86400)), auth(u));
    expect(r.statusCode).toBe(200);
    expect(r.json().action).toBe("setPlayKey");
  });

  test("setPlayKey: no token, wrong sender, too long, zero key", async () => {
    const u = await registeredUser(k, "w2");
    const other = await registeredUser(k, "w2b");
    const key = privateKeyToAccount(generatePrivateKey()).address;
    expect(code(await sponsor(await signed(u.key, setKeyData(key, nowS() + 86400))))).toBe("AUTH_REQUIRED");
    expect(code(await sponsor(await signed(u.key, setKeyData(key, nowS() + 86400)), auth(other)))).toBe("SENDER_NOT_ALLOWED");
    expect(code(await sponsor(await signed(u.key, setKeyData(key, nowS() + 40 * 86400)), auth(u)))).toBe("CALLDATA_INVALID");
    expect(code(await sponsor(await signed(u.key, setKeyData("0x0000000000000000000000000000000000000000", nowS() + 86400)), auth(u)))).toBe("CALLDATA_INVALID");
  });

  test("setPlayKey at most 3 a day", async () => {
    const u = await registeredUser(k, "w3");
    const codes = [];
    for (let i = 0; i < 4; i++) {
      const key = privateKeyToAccount(generatePrivateKey()).address;
      const r = await sponsor(await signed(u.key, setKeyData(key, nowS() + 86400)), auth(u));
      codes.push(r.statusCode === 200 ? 200 : code(r));
    }
    expect(codes).toEqual([200, 200, 200, "RATE_LIMITED_SENDER"]);
  });

  test("an unregistered wallet is refused", async () => {
    const u = k.addUser("w4");
    await k.app.inject({ method: "POST", url: "/v1/session", headers: auth(u), payload: {} });
    const key = privateKeyToAccount(generatePrivateKey()).address;
    expect(code(await sponsor(await signed(u.key, setKeyData(key, nowS() + 86400)), auth(u)))).toBe("NOT_REGISTERED");
  });

  test("CT approve only for the staking contract; transfer never", async () => {
    const u = await registeredUser(k, "w5");
    const ok = await sponsor(await signed(u.key, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [STAKING, 10n ** 21n] }), { to: CTA, gasLimit: 90_000 }), auth(u));
    expect(ok.statusCode).toBe(200);
    expect(ok.json().action).toBe("approve");
    const bad = await sponsor(await signed(u.key, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [u.wallet, 1n] }), { to: CTA, gasLimit: 90_000 }), auth(u));
    expect(code(bad)).toBe("SPENDER_NOT_ALLOWED");
    const tr = await sponsor(await signed(u.key, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [u.wallet, 1n] }), { to: CTA, gasLimit: 90_000 }), auth(u));
    expect(code(tr)).toBe("SELECTOR_NOT_ALLOWED");
  });

  test("stake below the minimum is refused; a valid stake passes", async () => {
    const u = await registeredUser(k, "w6");
    const low = await sponsor(await signed(u.key, encodeFunctionData({ abi: cojamStakingAbi, functionName: "stake", args: [10n ** 18n, 1] }), { to: STAKING, gasLimit: 250_000 }), auth(u));
    expect(code(low)).toBe("BELOW_MIN_STAKE");
    const ok = await sponsor(await signed(u.key, encodeFunctionData({ abi: cojamStakingAbi, functionName: "stake", args: [1000n * 10n ** 18n, 1] }), { to: STAKING, gasLimit: 250_000 }), auth(u));
    expect(ok.statusCode).toBe(200);
  });

  test("a frozen player cannot claim staking interest with sponsored gas", async () => {
    const u = await registeredUser(k, "w7", { frozen: true });
    const r = await sponsor(await signed(u.key, encodeFunctionData({ abi: cojamStakingAbi, functionName: "claimInterest", args: [0n] }), { to: STAKING }), auth(u));
    expect(code(r)).toBe("FROZEN");
  });

  test("convert must be a multiple of the rate and above the minimum", async () => {
    const u = await registeredUser(k, "w8");
    const conv = (p: bigint) => signed(u.key, encodeFunctionData({ abi: cojamPredictAbi, functionName: "convert", args: [p] }), { gasLimit: 180_000 });
    expect(code(await sponsor(await conv(1500n), auth(u)))).toBe("NOT_MULTIPLE_OF_RATE");
    k.chain.params_ = { ...k.chain.params_, minConvertPoints: 2000 };
    // The params cache holds the earlier minimum for 60 s: move the clock.
    k.clock.now += 61_000;
    expect(code(await sponsor(await conv(1000n), auth(u)))).toBe("BELOW_MINIMUM");
    k.chain.params_ = { ...k.chain.params_, minConvertPoints: 1000 };
    k.clock.now += 61_000;
    const tooNew = (toFunctionSelector("AccountTooNew()")) as Hex;
    k.rpc.estimate = new RpcError("execution reverted", { isNodeReply: true, nodeMessage: "reverted", nodeData: tooNew });
    expect(code(await sponsor(await conv(1000n), auth(u)))).toBe("ACCOUNT_TOO_NEW");
  });

  test("settle is sponsored only for the sender's own day", async () => {
    const u = await registeredUser(k, "w9");
    const other = await registeredUser(k, "w9b");
    const own = await sponsor(await signed(u.key, encodeFunctionData({ abi: cojamPredictAbi, functionName: "settle", args: [u.wallet, today() - 1] })), auth(u));
    expect(own.statusCode).toBe(200);
    const theirs = await sponsor(await signed(u.key, encodeFunctionData({ abi: cojamPredictAbi, functionName: "settle", args: [other.wallet, today() - 1] })), auth(u));
    expect(code(theirs)).toBe("CALLDATA_INVALID");
  });
});

describe("transaction shape", () => {
  test("wrong chain, value, target, owner functions, caps", async () => {
    const { key } = await playerWithKey("s1");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { chainId: 8217 })))).toBe("CHAIN_ID_MISMATCH");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { value: 1n })))).toBe("VALUE_NOT_ZERO");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { to: "0x000000000000000000000000000000000000dEaD" })))).toBe("TARGET_NOT_ALLOWED");
    const owner = encodeFunctionData({ abi: cojamPredictAbi, functionName: "setFrozen", args: [privateKeyToAccount(key).address, false, "0x" + "00".repeat(32) as Hex] });
    expect(code(await sponsor(await signed(key, owner)))).toBe("SELECTOR_NOT_ALLOWED");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { gasLimit: 170_001 })))).toBe("GAS_LIMIT_TOO_HIGH");
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { gasPrice: 51_000_000_000n })))).toBe("GAS_PRICE_TOO_HIGH");
  });

  test("non canonical calldata, garbage and other tx types", async () => {
    const { key } = await playerWithKey("s2");
    const padded = (predictData(mid(0), 1) + "00") as Hex;
    expect(code(await sponsor(await signed(key, padded)))).toBe("CALLDATA_INVALID");
    expect(code(await sponsor("0xzz"))).toBe("DECODE_FAILED");
    expect(code(await sponsor("0x02f8"))).toBe("TX_TYPE_NOT_ALLOWED");
    expect(code(await sponsor("0x31f8"))).toBe("DECODE_FAILED");
  });

  test("simulation estimate above the gas limit is GAS_LIMIT_TOO_LOW", async () => {
    const { key } = await playerWithKey("s3");
    k.rpc.estimate = 160_000n;
    expect(code(await sponsor(await signed(key, predictData(mid(0), 1), { gasLimit: 150_000 })))).toBe("GAS_LIMIT_TOO_LOW");
  });
});

describe("limits, budget and broadcast", () => {
  test("predict: 10 sponsored attempts per player per day", async () => {
    const { key } = await playerWithKey("l1");
    const codes = [];
    for (let i = 0; i < 11; i++) {
      const r = await sponsor(await signed(key, predictData(mid(i % 5), 1)), {}, `10.8.0.${i}`);
      codes.push(r.statusCode === 200 ? 200 : code(r));
    }
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe("RATE_LIMITED_SENDER");
  });

  test("fee payer under its floor answers FEE_PAYER_BALANCE_LOW", async () => {
    const { key } = await playerWithKey("l2");
    k.chain.feePayerBalance = 10n ** 18n;
    k.clock.now += 11_000; // past the 10 s balance cache
    const r = await sponsor(await signed(key, predictData(mid(0), 1)));
    expect(r.statusCode).toBe(503);
    expect(code(r)).toBe("FEE_PAYER_BALANCE_LOW");
    expect(r.json().error.retryable).toBe(true);
    k.chain.feePayerBalance = 100n * 10n ** 18n;
    k.clock.now += 11_000;
  });

  test("a node rejection releases the reservation", async () => {
    const { u, key } = await playerWithKey("l3");
    k.rpc.sendError = new RpcError("nonce too low", { isNodeReply: true, nodeMessage: "nonce too low" });
    const raw = await signed(key, predictData(mid(0), 1));
    const r = await sponsor(raw);
    expect(code(r)).toBe("BROADCAST_REJECTED");
    const day = new Date(k.clock.now).toISOString().slice(0, 10);
    const c = await k.db.selectFrom("usage_daily").select("count").where("day", "=", day).where("key", "=", `predict:${u.wallet}`).executeTakeFirst();
    expect(c?.count ?? 0).toBe(0);
    // The same raw can be retried later.
    k.rpc.sendError = null;
    expect((await sponsor(raw)).statusCode).toBe(200);
  });

  test("a transport failure answers BROADCAST_UNCERTAIN with the hash; a retry returns it", async () => {
    const { key } = await playerWithKey("l4");
    k.rpc.sendError = new Error("socket hang up");
    const raw = await signed(key, predictData(mid(1), 1));
    const r = await sponsor(raw);
    expect(r.statusCode).toBe(502);
    expect(code(r)).toBe("BROADCAST_UNCERTAIN");
    const hash = r.json().error.details.txHash;
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    k.rpc.sendError = null;
    const again = await sponsor(raw);
    expect(again.json()).toMatchObject({ txHash: hash, duplicate: true });
  });

  test("the daily budget stops sponsorship", async () => {
    const small = await buildTestApp({ limits: { dailyBudgetWei: 150_000n * 27_500_000_000n * 2n } });
    try {
      const u = await registeredUser(small, "b1");
      const key = generatePrivateKey();
      small.chain.bindKey(privateKeyToAccount(key).address, u.wallet);
      const from = privateKeyToAccount(key).address;
      const d = currentDayId(small.clock.now);
      const codes = [];
      for (let i = 0; i < 3; i++) {
        const raw = await signSenderTx(key, { from, to: PREDICT, data: predictData(d * 5 + i, 1), gasLimit: 150_000, chainId: CHAIN_ID, nonce: i });
        const r = await small.app.inject({ method: "POST", url: "/v1/tx/sponsor", payload: { rawTransaction: raw } });
        codes.push(r.statusCode === 200 ? 200 : r.json().error.code);
      }
      expect(codes).toEqual([200, 200, "DAILY_BUDGET_EXHAUSTED"]);
    } finally {
      await small.close();
    }
  });
});

describe("GET /v1/tx/:hash", () => {
  test("pending, then mined with the decoded result, and the real fee is settled", async () => {
    const { u, key } = await playerWithKey("t1");
    const r = await sponsor(await signed(key, predictData(mid(2), 2)));
    const hash = r.json().txHash;
    const pending = await k.app.inject({ method: "GET", url: `/v1/tx/${hash}`, headers: auth(u) });
    expect(pending.json()).toMatchObject({ status: "pending", action: "predict" });
    const ev = cojamPredictAbi.find((x: any) => x.type === "event" && x.name === "Predicted") as any;
    expect(ev).toBeTruthy();
    const { encodeEventTopics } = await import("viem");
    const topics = encodeEventTopics({ abi: cojamPredictAbi, eventName: "Predicted", args: { user: u.wallet, marketId: BigInt(mid(2)), dayId: today() } as any });
    const data = encodeAbiParameters([{ type: "uint8" }, { type: "uint8" }], [2, 3]);
    k.rpc.receipts.set(hash, { status: "0x1", gasUsed: "0xea60", effectiveGasPrice: "0x" + (27_500_000_000n).toString(16), blockNumber: "0x10", logs: [{ address: PREDICT, topics, data }] });
    const mined = await k.app.inject({ method: "GET", url: `/v1/tx/${hash}`, headers: auth(u) });
    expect(mined.json()).toMatchObject({ status: "mined", action: "predict", blockNumber: 16, result: { marketId: mid(2), choice: 2, answered: 3 } });
    const row = await k.db.selectFrom("sponsored_txs").select(["status", "actual_wei"]).where("tx_hash", "=", hash).executeTakeFirstOrThrow();
    expect(row.status).toBe("mined");
    expect(row.actual_wei).toBe((60000n * 27_500_000_000n).toString());
  });
  test("unknown hash is TX_NOT_FOUND", async () => {
    const u = await registeredUser(k, "t2");
    const r = await k.app.inject({ method: "GET", url: `/v1/tx/0x${"cd".repeat(32)}`, headers: auth(u) });
    expect(r.statusCode).toBe(404);
    expect(code(r)).toBe("TX_NOT_FOUND");
  });
});
