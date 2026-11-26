// Mock wallet mode: the app runs without Privy (tests, VITE_WALLET_MOCK=1). A random local key stands in for the
// embedded wallet; the email code is any 6 digits except 000000 (wrong) and 111111 (expired).
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { useWalletStore } from './wallet';
import { DESIGN } from '../api/mock';
import { sleep } from '../lib/fmt';

const K = 'cjm.wallet';
function load(): { pk: Hex; email: string | null; auth: boolean } {
  try { const v = JSON.parse(localStorage.getItem(K) || 'null'); if (v?.pk) return v; } catch { /* */ }
  return { pk: generatePrivateKey(), email: null, auth: true };
}
function save(v: ReturnType<typeof load>) { try { localStorage.setItem(K, JSON.stringify(v)); } catch { /* */ } }

export function installMockWallet() {
  const st = load();
  // the design shows its own player address everywhere; signatures come from the local key
  const shown = DESIGN.user.address as Address;
  const acct = privateKeyToAccount(st.pk);
  let pendingEmail: string | null = null;
  const set = (auth: boolean) => {
    st.auth = auth; save(st);
    useWalletStore.setState({ ready: true, authenticated: auth, address: auth ? shown : null, email: auth ? st.email || DESIGN.user.email : null });
  };
  useWalletStore.setState({
    kind: 'mock',
    sendCode: async (email) => { await sleep(400); pendingEmail = email; },
    loginWithCode: async (code) => {
      await sleep(500);
      if (code === '000000') throw Object.assign(new Error('Invalid code'), { code: 'invalid_code' });
      if (code === '111111') throw Object.assign(new Error('Code expired'), { code: 'expired' });
      st.email = pendingEmail; set(true);
    },
    logout: async () => { set(false); },
    createWallet: async () => { await sleep(300); return shown; },
    getAccessToken: async () => 'mock-token',
    signHash: async (hash) => { await sleep(120); return acct.sign({ hash }); },
    sendTransaction: async () => { await sleep(900); return ('0x' + '8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1') as Hex; },
    warmUp: async () => {},
  });
  set(st.auth);
}
