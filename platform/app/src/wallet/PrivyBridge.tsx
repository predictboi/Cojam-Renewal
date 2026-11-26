// Privy, as proven by the spike (platform/spike/web): email login with our own form (useLoginWithEmail),
// createWallet() after login (the headless flow does not create one), raw hash signing through the embedded
// provider's `secp256k1_sign` (no confirmation UI path), user paid transfers through sendTransaction with
// showWalletUIs off. Publishes the wallet into useWalletStore.
import { useEffect, useRef, type ReactNode } from 'react';
import {
  PrivyProvider, usePrivy, useWallets, useLoginWithEmail, useCreateWallet, useSendTransaction, type ConnectedWallet,
} from '@privy-io/react-auth';
import { defineChain, toHex, type Address, type Hex } from 'viem';
import { CONFIG } from '../config';
import { useWalletStore } from './wallet';

const chain = defineChain({
  id: CONFIG.chain.id,
  name: CONFIG.network === 'kaia' ? 'Kaia' : 'Kaia Kairos',
  nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 },
  rpcUrls: { default: { http: [CONFIG.chain.rpc] } },
  blockExplorers: { default: { name: 'Kaiascan', url: CONFIG.chain.explorer } },
});

function Bridge() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const email = useLoginWithEmail();
  const embedded: ConnectedWallet | undefined = wallets.find((w) => w.walletClientType === 'privy');
  const warmed = useRef<string | null>(null);

  useEffect(() => {
    useWalletStore.setState({
      kind: 'privy',
      ready: ready && (!authenticated || walletsReady),
      authenticated,
      address: (embedded?.address as Address) || null,
      email: user?.email?.address || null,
      sendCode: async (e) => { await email.sendCode({ email: e }); },
      loginWithCode: async (c) => { await email.loginWithCode({ code: c }); },
      logout: async () => { await logout(); },
      createWallet: async () => {
        const have = wallets.find((w) => w.walletClientType === 'privy');
        if (have) return have.address as Address;
        const w = await createWallet();
        return w.address as Address;
      },
      getAccessToken: () => getAccessToken(),
      signHash: async (hash: Hex) => {
        if (!embedded) throw new Error('No embedded wallet yet');
        const provider = await embedded.getEthereumProvider();
        return (await provider.request({ method: 'secp256k1_sign', params: [hash] })) as Hex;
      },
      sendTransaction: async (tx) => {
        if (!embedded) throw new Error('No embedded wallet yet');
        const out = await sendTransaction(
          { to: tx.to, data: tx.data, value: tx.value !== undefined ? toHex(tx.value) : undefined, chainId: tx.chainId },
          { uiOptions: { showWalletUIs: false }, address: embedded.address },
        );
        return out.hash as Hex;
      },
      warmUp: async () => {
        if (!embedded) return;
        const p = await embedded.getEthereumProvider();
        await p.request({ method: 'eth_chainId' }).catch(() => {});
      },
    });
  }, [ready, authenticated, walletsReady, embedded, user, email, logout, createWallet, sendTransaction, getAccessToken, wallets]);

  // Warm the wallet iframe up in the background after launch: the first signature after a cold start took 1.3 s
  // on the phone (spike RESULTS run 2). Loading the provider and one cheap read costs no Privy signature.
  useEffect(() => {
    if (!embedded || warmed.current === embedded.address) return;
    warmed.current = embedded.address;
    const t = setTimeout(() => { void useWalletStore.getState().warmUp?.().catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [embedded]);
  return null;
}

export function PrivyRoot({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={CONFIG.privyAppId}
      config={{
        loginMethods: ['email'],
        defaultChain: chain,
        supportedChains: [chain],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' }, showWalletUIs: false },
        appearance: { theme: 'light', accentColor: '#124CC4', showWalletLoginFirst: false },
      }}
    >
      <Bridge />
      {children}
    </PrivyProvider>
  );
}
