// Owner wallet in the browser. The admin API only builds owner transactions unsigned; the founder's own wallet
// (an injected EIP-1193 wallet such as Kaia Wallet or MetaMask, found through EIP-6963) signs and sends them here.
// No private key is ever handled by the admin. Before sending we check that the connected account is the contract
// owner and that the wallet is on the right chain.
import { createPublicClient, createWalletClient, custom, defineChain, type Address, type EIP1193Provider, type Hex } from 'viem';
import { CHAINS } from '../config';

export interface UnsignedTx { chainId: number; from: Address; to: Address; data: Hex; value: string; description: string }
export interface WalletChoice { id: string; name: string; icon?: string; provider: EIP1193Provider }

const found = new Map<string, WalletChoice>();
let listening = false;
/** EIP-6963 discovery, plus the legacy injected providers when no wallet announced itself. */
export function discoverWallets(): Promise<WalletChoice[]> {
  if (!listening) {
    listening = true;
    window.addEventListener('eip6963:announceProvider', (e: Event) => {
      const d = (e as CustomEvent).detail as { info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider };
      if (d?.info && d.provider) found.set(d.info.rdns || d.info.uuid, { id: d.info.rdns || d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider });
    });
  }
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return new Promise((resolve) => setTimeout(() => {
    const list = [...found.values()];
    const w = window as unknown as { ethereum?: EIP1193Provider & { isMetaMask?: boolean; isKaiaWallet?: boolean }; klaytn?: EIP1193Provider };
    if (!list.length && w.ethereum) list.push({ id: 'injected', name: w.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: w.ethereum });
    resolve(list);
  }, 350));
}

export class WalletError extends Error { constructor(public code: 'NO_WALLET' | 'REJECTED' | 'WRONG_ACCOUNT' | 'WRONG_CHAIN' | 'FAILED' | 'REVERTED', message: string, public detail?: string) { super(message); } }

function chainOf(id: number) {
  const c = CHAINS[id] || CHAINS[8217];
  return defineChain({ id, name: c.name, nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 }, rpcUrls: { default: { http: [c.rpc] } }, blockExplorers: { default: { name: 'Kaiascan', url: c.explorer } } });
}
const rejected = (e: unknown) => { const x = e as { code?: number; message?: string; cause?: { code?: number } }; return x?.code === 4001 || x?.cause?.code === 4001 || /reject|denied|cancel/i.test(x?.message || ''); };

/** Connects and returns the account; refuses an account that is not the owner. */
export async function connectOwner(w: WalletChoice, owner: Address): Promise<Address> {
  let accounts: string[];
  try { accounts = (await w.provider.request({ method: 'eth_requestAccounts' })) as string[]; }
  catch (e) { throw new WalletError(rejected(e) ? 'REJECTED' : 'FAILED', rejected(e) ? 'The wallet did not connect.' : 'The wallet could not connect.', (e as Error).message); }
  const a = (accounts?.[0] || '') as Address;
  if (!a || a.toLowerCase() !== owner.toLowerCase()) throw new WalletError('WRONG_ACCOUNT', a, a);
  return a;
}

/** Switches to the transaction's chain when the wallet is elsewhere (asks the wallet; refuses if it cannot). */
export async function ensureChain(w: WalletChoice, chainId: number) {
  const cur = Number(await w.provider.request({ method: 'eth_chainId' }));
  if (cur === chainId) return;
  try { await w.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] }); }
  catch (e) { throw new WalletError('WRONG_CHAIN', 'The wallet is on chain ' + cur + ', not ' + chainId + '. Switch the network in the wallet, then try again.', (e as Error).message); }
  const after = Number(await w.provider.request({ method: 'eth_chainId' }));
  if (after !== chainId) throw new WalletError('WRONG_CHAIN', 'The wallet is on chain ' + after + ', not ' + chainId + '.');
}

/** Sends the unsigned transaction from the owner account; resolves with the hash once the wallet accepted it. */
export async function sendOwnerTx(w: WalletChoice, account: Address, tx: UnsignedTx): Promise<Hex> {
  if (tx.from && tx.from.toLowerCase() !== account.toLowerCase()) throw new WalletError('WRONG_ACCOUNT', account, account);
  await ensureChain(w, tx.chainId);
  const client = createWalletClient({ account, chain: chainOf(tx.chainId), transport: custom(w.provider) });
  try { return await client.sendTransaction({ account, to: tx.to, data: tx.data, value: BigInt(tx.value || '0'), chain: chainOf(tx.chainId) }); }
  catch (e) { throw new WalletError(rejected(e) ? 'REJECTED' : 'FAILED', rejected(e) ? 'The wallet rejected the request.' : 'The wallet could not send the transaction.', (e as Error).message); }
}

export async function waitReceipt(w: WalletChoice, chainId: number, hash: Hex) {
  const pc = createPublicClient({ chain: chainOf(chainId), transport: custom(w.provider) });
  const r = await pc.waitForTransactionReceipt({ hash, timeout: 180_000, pollingInterval: 2_000 });
  if (r.status !== 'success') throw new WalletError('REVERTED', 'The transaction was mined but reverted. Nothing changed.');
  return r;
}
