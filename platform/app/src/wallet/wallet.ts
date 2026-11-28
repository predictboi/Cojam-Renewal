// The player's wallet as the app sees it: Privy (email code login, embedded wallet, secp256k1_sign, sendTransaction)
// or, in tests and mock mode, a local throwaway key with the same surface. The Privy bridge (PrivyBridge.tsx) and the
// mock (mockWallet.ts) publish into this store; nothing else in the app imports Privy.
import { create } from 'zustand';
import type { Address, Hex } from 'viem';

export interface UserTx { to: Address; data?: Hex; value?: bigint; chainId: number }
export interface WalletApi {
  sendCode(email: string): Promise<void>;
  loginWithCode(code: string): Promise<void>;
  logout(): Promise<void>;
  createWallet(): Promise<Address>;
  getAccessToken(): Promise<string | null>;
  /** raw secp256k1 signature over a 32 byte hash, no prompt (spike: Privy embedded provider `secp256k1_sign`) */
  signHash(hash: Hex): Promise<Hex>;
  /** user paid transaction (W4, and claims and withdrawals while on hold) */
  sendTransaction(tx: UserTx): Promise<Hex>;
  /** load the wallet iframe in the background, so the first signature after a cold start is not slow */
  warmUp(): Promise<void>;
}
export interface WalletState extends Partial<WalletApi> {
  ready: boolean;
  authenticated: boolean;
  address: Address | null;
  email: string | null;
  kind: 'privy' | 'mock' | 'none';
}
export const useWalletStore = create<WalletState>(() => ({ ready: false, authenticated: false, address: null, email: null, kind: 'none' }));

export function walletApi(): WalletApi {
  const s = useWalletStore.getState();
  const need = <K extends keyof WalletApi>(k: K): WalletApi[K] => {
    const f = s[k];
    if (!f) throw new Error('Wallet is not ready (' + k + ')');
    return f as WalletApi[K];
  };
  return {
    sendCode: (e) => need('sendCode')(e),
    loginWithCode: (c) => need('loginWithCode')(c),
    logout: () => need('logout')(),
    createWallet: () => need('createWallet')(),
    getAccessToken: () => (s.getAccessToken ? s.getAccessToken() : Promise.resolve(null)),
    signHash: (h) => need('signHash')(h),
    sendTransaction: (tx) => need('sendTransaction')(tx),
    warmUp: () => (s.warmUp ? s.warmUp() : Promise.resolve()),
  };
}
