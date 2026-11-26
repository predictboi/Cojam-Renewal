// The spike steps c, d and e as plain async functions, shared by the PWA (src/App.tsx) and the Node
// end to end check against Kairos (test/e2e-kairos.ts). No DOM and no React here.

import type { BaseWallet } from 'ethers';
import { signFdCall, spikeAbi, type SignatureInfo } from './kaiaTx.ts';
import { ethCall, getGasPrice, getNonce, sponsor, waitReceipt, type Receipt } from './rpc.ts';

export interface Ctx {
  rpcUrl: string;
  apiBase: string;
  chainId: number;
  contract: string;
}

/** Anything that can sign a 32 byte hash: the Privy wallet, the play key, or the dev key. */
export interface HashSigner {
  address: string;
  label: string;
  signHash: (hash: string) => Promise<string>;
}

// Fixed gas limits per action (DEV-PLAN 4.3: a table, not an estimate per swipe). Measured use on
// Kairos: setPlayKey about 80k, predict about 75k to 95k (first write of the player). Capped by the API at 250k.
export const GAS = { setPlayKey: 160000n, predict: 150000n } as const;
const MAX_GAS_PRICE = 50_000_000_000n;

let gasPriceCache: { at: number; wei: bigint } | null = null;
export async function gasPrice(ctx: Ctx): Promise<bigint> {
  if (gasPriceCache && Date.now() - gasPriceCache.at < 60000) return gasPriceCache.wei;
  let wei = await getGasPrice(ctx.rpcUrl);
  if (wei > MAX_GAS_PRICE) wei = MAX_GAS_PRICE;
  gasPriceCache = { at: Date.now(), wei };
  return wei;
}

/** A local key as a HashSigner (ethers SigningKey; returns r || s || v with v 27/28). */
export function localSigner(w: BaseWallet, label: string): HashSigner {
  return {
    address: w.address,
    label,
    signHash: async (hash) => w.signingKey.sign(hash).serialized,
  };
}

export interface SentTx {
  action: string;
  from: string;
  nonce: number;
  txHash: string;
  sigHash: string;
  signature: SignatureInfo;
  rawBytes: number;
  signMs: number;
  postMs: number;
  serverMs?: number;
  url: string;
}

export interface MinedTx extends SentTx {
  receipt: Receipt;
  mineMs: number;
  totalMs: number;
}

export const txUrl = (hash: string) => `https://kairos.kaiascan.io/tx/${hash}`;

/** Sign one 0x31 call with `signer` and post it to the fee payer. Does not wait for mining. */
export async function signAndSponsor(
  ctx: Ctx,
  signer: HashSigner,
  action: 'setPlayKey' | 'predict',
  data: string,
  nonce?: number
): Promise<SentTx> {
  const n = nonce ?? (await getNonce(ctx.rpcUrl, signer.address));
  const gp = await gasPrice(ctx);
  const { raw, sigHash, sig, signMs } = await signFdCall(
    { chainId: ctx.chainId, from: signer.address, to: ctx.contract, data, nonce: n, gasLimit: GAS[action], gasPrice: gp },
    signer.signHash
  );
  const t1 = performance.now();
  const out = await sponsor(ctx.apiBase, raw);
  const postMs = Math.round(performance.now() - t1);
  return {
    action,
    from: signer.address,
    nonce: n,
    txHash: out.txHash,
    sigHash,
    signature: sig,
    rawBytes: (raw.length - 2) / 2,
    signMs,
    postMs,
    serverMs: out.serverMs,
    url: txUrl(out.txHash),
  };
}

/** Sign, sponsor and wait for the receipt. Throws when the transaction reverted. */
export async function signSponsorMine(
  ctx: Ctx,
  signer: HashSigner,
  action: 'setPlayKey' | 'predict',
  data: string
): Promise<MinedTx> {
  const t0 = performance.now();
  const sent = await signAndSponsor(ctx, signer, action, data);
  const t2 = performance.now();
  const receipt = await waitReceipt(ctx.rpcUrl, sent.txHash);
  const mined = { ...sent, receipt, mineMs: Math.round(performance.now() - t2), totalMs: Math.round(performance.now() - t0) };
  if (receipt.status !== 1) throw Object.assign(new Error(`Transaction reverted on chain: ${sent.txHash}`), { mined });
  return mined;
}

export const setPlayKeyData = (key: string, expiresAt: number) => spikeAbi.encodeFunctionData('setPlayKey', [key, expiresAt]);
export const predictData = (marketId: bigint, choice: 1 | 2) => spikeAbi.encodeFunctionData('predict', [marketId, choice]);

/** A fresh market id per run, so every run can predict again (one choice per player and market). */
export function newMarketBase(): bigint {
  return BigInt(Date.now()) * 1000n;
}

export interface BurstResult {
  sent: SentTx[];
  mined: { txHash: string; nonce: number; blockNumber: number; transactionIndex: number; status: number }[];
  minedOrder: number[];
  inNonceOrder: boolean;
  signMsEach: number[];
  postMsEach: number[];
  sendAllMs: number;
  totalMs: number;
}

/**
 * Step d: `count` predicts signed by the play key, nonces n..n+count-1, each posted as soon as the
 * previous one was accepted by the node (never waiting for a receipt), then all receipts collected.
 */
export async function playKeyBurst(ctx: Ctx, key: HashSigner, marketBase: bigint, count = 5): Promise<BurstResult> {
  const t0 = performance.now();
  const start = await getNonce(ctx.rpcUrl, key.address);
  const sent: SentTx[] = [];
  for (let i = 0; i < count; i++) {
    sent.push(await signAndSponsor(ctx, key, 'predict', predictData(marketBase + BigInt(i), (i % 2 ? 2 : 1) as 1 | 2), start + i));
  }
  const sendAllMs = Math.round(performance.now() - t0);
  const receipts = await Promise.all(sent.map((s) => waitReceipt(ctx.rpcUrl, s.txHash)));
  const mined = sent.map((s, i) => ({
    txHash: s.txHash,
    nonce: s.nonce,
    blockNumber: receipts[i].blockNumber,
    transactionIndex: receipts[i].transactionIndex,
    status: receipts[i].status,
  }));
  const order = [...mined].sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex).map((m) => m.nonce);
  return {
    sent,
    mined,
    minedOrder: order,
    inNonceOrder: order.every((n, i) => i === 0 || n > order[i - 1]),
    signMsEach: sent.map((s) => s.signMs),
    postMsEach: sent.map((s) => s.postMs),
    sendAllMs,
    totalMs: Math.round(performance.now() - t0),
  };
}

/** Chain reads used to check that predictions were credited to the player, not to the key. */
export async function readPlayer(ctx: Ctx, player: string, key?: string) {
  const call = async (fn: string, args: unknown[]) => spikeAbi.decodeFunctionResult(fn, await ethCall(ctx.rpcUrl, ctx.contract, spikeAbi.encodeFunctionData(fn, args)));
  const [bal] = await call('balanceOf', [player]);
  const [count] = await call('predictionCount', [player]);
  const [pk] = await call('playKeyOf', [player]);
  const out: Record<string, string | number> = { player, points: Number(bal), predictionCount: Number(count), playKeyOf: pk };
  if (key) {
    const [kb] = await call('balanceOf', [key]);
    const binding = await call('keyBinding', [key]);
    out.keyPoints = Number(kb);
    out.keyBoundTo = binding[0];
    out.keyExpiresAt = Number(binding[1]);
  }
  return out;
}
