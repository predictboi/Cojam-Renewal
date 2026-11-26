// Chain access for the app: the outbox dependencies for the play key, the Privy signed value actions (sponsored 0x31)
// and the user paid transactions (W4, and claims and withdrawals of an account on hold). In mock mode the same
// functions run against the mock chain, with the prototype's timings.
import { decodeFunctionResult, encodeFunctionData, parseUnits, type Address, type Hex } from 'viem';
import { CONFIG } from '../config';
import { api } from '../api';
import { ApiError } from '../api/errors';
import { mockChain, saveChain } from '../api/mock';
import type { AppConfig } from '../api/types';
import { sleep } from '../lib/fmt';
import { walletApi, useWalletStore } from '../wallet/wallet';
import { GAS, playKeyCall, predictAbi, walletCall } from './abi';
import { signFdCall } from './kaiaTx';
import { getNonce, getGasPrice, getReceipt, rpc } from './rpc';
import { createPlayKey, loadPlayKey, markAuthorised, playKeyValid, signWithPlayKey, deletePlayKey } from './playKey';
import type { OutboxDeps } from './outbox/outbox';
import { db } from './db';

let cfg: AppConfig | null = null;
export function setChainConfig(c: AppConfig) { cfg = c; }
const C = () => {
  if (!cfg) throw new Error('config not loaded');
  return cfg;
};
const rpcUrl = () => cfg?.rpcUrl || CONFIG.chain.rpc;

let gp: { v: bigint; at: number } | null = null;
async function gasPrice(): Promise<bigint> {
  if (gp && Date.now() - gp.at < 60_000) return gp.v;
  gp = { v: await getGasPrice(rpcUrl()), at: Date.now() };
  return gp.v;
}

function asSponsorError(e: unknown) {
  if (e instanceof ApiError) return { code: e.code, status: e.status, txHash: e.txHash };
  return { code: 'NETWORK', status: 0 };
}

/* ---------- the outbox, against the chain ---------- */
export function realOutboxDeps(onKeyProblem: (c: string) => void, onFrozen: () => void, onFailed: OutboxDeps['onFailed']): OutboxDeps {
  return {
    db: db(),
    now: () => Date.now(),
    key: async () => {
      const k = await loadPlayKey();
      const me = useWalletStore.getState().address?.toLowerCase();
      if (!k || !playKeyValid(k) || (me && k.player !== me)) return null;
      return { address: k.address };
    },
    pendingNonce: (a) => getNonce(rpcUrl(), a),
    sign: async (item, nonce, keyAddr) => {
      const k = await loadPlayKey();
      if (!k || k.address.toLowerCase() !== keyAddr.toLowerCase()) throw new Error('play key changed');
      const { raw } = await signFdCall(
        { chainId: C().chainId, from: keyAddr, to: C().contracts.predict, data: playKeyCall.predict(BigInt(item.marketId), item.choice), nonce, gasLimit: GAS.predict, gasPrice: await gasPrice() },
        (h) => signWithPlayKey(k, h as Hex),
      );
      return raw;
    },
    sponsor: async (raw) => {
      try { return await api.sponsor(raw, { auth: false }); } catch (e) { throw asSponsorError(e); }
    },
    resend: async (raw) => { await api.sponsor(raw, { auth: false }).catch(() => {}); },
    receipt: (h) => getReceipt(rpcUrl(), h),
    readChoice: async (item) => {
      const data = encodeFunctionData({ abi: predictAbi, functionName: 'dayOf', args: [item.player as Address, item.dayId] });
      const out = await rpc<Hex>(rpcUrl(), 'eth_call', [{ to: C().contracts.predict, data }, 'latest']);
      const r = decodeFunctionResult({ abi: predictAbi, functionName: 'dayOf', data: out }) as readonly [number, readonly number[], boolean, number, number];
      return (r[1][item.slot] || 0) as 0 | 1 | 2;
    },
    onKeyProblem, onFrozen, onFailed,
  };
}

/* ---------- the outbox, against the mock chain ---------- */
const minedAt = new Map<string, { at: number; marketId: string; choice: 1 | 2 }>();
export function mockOutboxDeps(onFailed: OutboxDeps['onFailed']): OutboxDeps {
  let nonce = 0;
  return {
    db: db(),
    now: () => Date.now(),
    key: async () => ({ address: '0x00000000000000000000000000000000000000c0' }),
    pendingNonce: async () => nonce,
    sign: async (item, n) => 'mock:' + JSON.stringify({ m: item.marketId, c: item.choice, n }),
    sponsor: async (raw) => {
      await sleep(250);
      const p = JSON.parse(raw.slice(5));
      nonce = Math.max(nonce, p.n + 1);
      const txHash = '0x' + (p.m + 'a' + p.n).padStart(64, '0');
      minedAt.set(txHash, { at: Date.now() + 650 + Math.random() * 500, marketId: p.m, choice: p.c });
      return { txHash };
    },
    receipt: async (h) => {
      const m = minedAt.get(h);
      if (m && Date.now() < m.at) return null;
      if (m) {
        const c = mockChain();
        c.picks[m.marketId] = m.choice;
        if (Object.keys(c.picks).length >= 5) c.paid = true;
        saveChain(c);
      }
      return { status: 1 };
    },
    readChoice: async (item) => (mockChain().picks[item.marketId] || 0) as 0 | 1 | 2,
    onFailed,
  };
}

/* ---------- value actions (one at a time, from the transaction sheet) ---------- */
export interface TxProgress { signed?(): void; sent?(hash: string): void; step?(i: number): void }

async function waitMined(hash: string, timeoutMs = 90_000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    const r = await getReceipt(rpcUrl(), hash).catch(() => null);
    if (r) { if (r.status !== 1) throw new ApiError('REVERTED', 'Kaia rejected this transaction', 0, hash); return; }
    if (Date.now() - t0 > timeoutMs) throw new ApiError('TIMEOUT', 'no receipt', 0, hash);
    await sleep(700);
  }
}

/** A Privy signed, Cojam sponsored 0x31 call: sign the SigHash with secp256k1_sign, sponsor, wait for the receipt. */
export async function sponsored(action: keyof typeof GAS, to: Address, data: Hex, p: TxProgress = {}): Promise<string> {
  const from = useWalletStore.getState().address;
  if (!from) throw new Error('No wallet');
  const nonce = await getNonce(rpcUrl(), from);
  const { raw } = await signFdCall({ chainId: C().chainId, from, to, data, nonce, gasLimit: GAS[action], gasPrice: await gasPrice() }, (h) => walletApi().signHash(h as Hex));
  p.signed?.();
  const { txHash } = await api.sponsor(raw);
  p.sent?.(txHash);
  await waitMined(txHash);
  return txHash;
}
/** A user paid transaction through Privy sendTransaction (the fee in KAIA from the player's own wallet). */
export async function userPaid(to: Address, data: Hex, p: TxProgress = {}): Promise<string> {
  p.signed?.();
  const hash = await walletApi().sendTransaction({ to, data, chainId: C().chainId });
  p.sent?.(hash);
  await waitMined(hash);
  return hash;
}

const MOCK_HASH = '0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1';
async function mockRun(p: TxProgress, steps = 0, fail = false): Promise<string> {
  await sleep(1100);
  for (let i = 0; i < steps; i++) { p.step?.(i); await sleep(i === 0 ? 1500 : 1400); }
  p.signed?.();
  p.sent?.(MOCK_HASH);
  await sleep(1700);
  if (fail) throw new ApiError('REVERTED', 'mock', 0, MOCK_HASH);
  return MOCK_HASH;
}

const ct18 = (v: string | number) => parseUnits(String(v).replace(/,/g, ''), 18);

export const actions = {
  /** convert points to CT (sponsored) */
  async convert(points: number, p: TxProgress) {
    if (CONFIG.mockApi) { const h = await mockRun(p); const c = mockChain(); c.convertedPts += points; c.ctDelta += points / 1000; saveChain(c); return h; }
    return sponsored('convert', C().contracts.predict, walletCall.convert(BigInt(points)), p);
  },
  /** approve then stake (two sponsored transactions, the sheet shows the two steps) */
  async stake(amount: string, lockDays: number, p: TxProgress) {
    const idx = C().params.lockDays.indexOf(lockDays);
    if (CONFIG.mockApi) {
      const h = await mockRun(p, 2);
      const c = mockChain(); const a = Number(amount.replace(/,/g, '')), tier = a >= 10000 ? 2 : a >= 1000 ? 1 : 0;
      c.stakes.push({ amount: a, days: lockDays, rate: C().params.ratesPct[String(lockDays)][tier], start: Date.now() }); saveChain(c);
      return h;
    }
    const value = ct18(amount);
    p.step?.(0);
    await sponsored('approve', C().contracts.ct, walletCall.approve(C().contracts.staking, value));
    p.step?.(1);
    return sponsored('stake', C().contracts.staking, walletCall.stake(value, idx), p);
  },
  async claim(id: string, held: boolean, p: TxProgress) {
    if (CONFIG.mockApi) return mockRun(p);
    const data = walletCall.claimInterest(BigInt(id));
    return held ? userPaid(C().contracts.staking, data, p) : sponsored('claimInterest', C().contracts.staking, data, p);
  },
  async withdrawStake(id: string, held: boolean, p: TxProgress) {
    if (CONFIG.mockApi) { const h = await mockRun(p); const c = mockChain(); c.closed.push(id); saveChain(c); return h; }
    const data = walletCall.withdraw(BigInt(id));
    return held ? userPaid(C().contracts.staking, data, p) : sponsored('withdraw', C().contracts.staking, data, p);
  },
  /** W4: user paid CT transfer, never sponsored */
  async transferCt(to: Address, amount: string, p: TxProgress) {
    if (CONFIG.mockApi) { const h = await mockRun(p); const c = mockChain(); c.ctDelta -= Number(amount.replace(/,/g, '')); saveChain(c); return h; }
    return userPaid(C().contracts.ct, walletCall.transfer(to, ct18(amount)), p);
  },
};

/* ---------- play key lifecycle (4.2) ---------- */
export async function ensurePlayKey(player: string, opts: { force?: boolean } = {}): Promise<void> {
  let k = await loadPlayKey();
  if (k && k.player !== player.toLowerCase()) { await deletePlayKey(); k = null; }
  if (!k) k = await createPlayKey(player);
  const ttl = (cfg?.params.playKeyTtlDays || 30) * 86400;
  if (!opts.force && playKeyValid(k) && k.expiresAt! - Date.now() / 1000 > 7 * 86400) return;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  if (CONFIG.mockApi) { await sleep(600); const c = mockChain(); c.playKey = { key: k.address, expiresAt }; saveChain(c); await markAuthorised(expiresAt, 'mock'); return; }
  const tx = await sponsored('setPlayKey', C().contracts.predict, walletCall.setPlayKey(k.address, BigInt(expiresAt)));
  await markAuthorised(expiresAt, tx);
}

/** On log out the key revokes itself (sponsored, no Privy signature), then it is deleted (4.2 Revoke). */
export async function revokePlayKey(): Promise<void> {
  const k = await loadPlayKey();
  if (!k) return;
  if (!CONFIG.mockApi && cfg) {
    try {
      const nonce = await getNonce(rpcUrl(), k.address);
      const { raw } = await signFdCall({ chainId: cfg.chainId, from: k.address, to: cfg.contracts.predict, data: playKeyCall.revoke(), nonce, gasLimit: GAS.revokePlayKey, gasPrice: await gasPrice() }, (h) => signWithPlayKey(k, h as Hex));
      await api.sponsor(raw, { auth: false });
    } catch (e) { console.warn('revokePlayKey', e); }
  }
  await deletePlayKey();
}
