import { test, expect } from "vitest";
import { Wallet as KWallet } from "@kaiachain/ethers-ext/v6";
import { Wallet } from "ethers";
import { decodeSenderTx, signSenderTx, coSignAsFeePayer } from "../../src/feeDelegation/decode.ts";
import { parseTransaction } from "@kaiachain/js-ext-core";
test("probe", async () => {
  const s = Wallet.createRandom();
  const to = "0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58";
  const w = new KWallet(s.privateKey);
  const raw1 = await w.signTransaction({ type: 0x31, chainId: 1001, nonce: 3, gasPrice: 27500000000n, gasLimit: 150000, to, value: 0, from: s.address, data: "0x12345678" });
  const raw2 = await signSenderTx(s.privateKey as any, { from: s.address as any, to, data: "0x12345678", nonce: 3, gasLimit: 150000, chainId: 1001 });
  expect(raw2.toLowerCase()).toBe(raw1.toLowerCase());
  const d = await decodeSenderTx(raw2);
  expect(d.signer).toBe(s.address);
  const fp = Wallet.createRandom();
  const mine = await coSignAsFeePayer(d, fp.address as any, fp.privateKey as any);
  const theirs = await new KWallet(fp.privateKey).signTransactionAsFeePayer(raw1);
  expect(mine.toLowerCase()).toBe(theirs.toLowerCase());
});
