import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { kairos } from 'viem/chains';
import { App } from './App.tsx';
import { installConsoleCapture } from './lib/consoleCapture.ts';
import { CONFIG } from './config.ts';
import './styles.css';

installConsoleCapture();

// Kairos as a custom EVM chain for the embedded wallet (viem ships it; the RPC is pinned here).
const kairosChain = { ...kairos, rpcUrls: { default: { http: [CONFIG.rpcUrl] } } };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('service worker registration failed', e));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={CONFIG.privyAppId}
      config={{
        loginMethods: ['email'],
        defaultChain: kairosChain,
        supportedChains: [kairosChain],
        embeddedWallets: {
          // Applies to the Privy modal login. The headless email flow (useLoginWithEmail) does not
          // create wallets automatically, so the app calls createWallet() itself after login.
          ethereum: { createOnLogin: 'users-without-wallets' },
          // No confirmation modals for signMessage / signTransaction / signTypedData / sendTransaction.
          showWalletUIs: false,
        },
        appearance: { theme: 'light', accentColor: '#124CC4', showWalletLoginFirst: false },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>
);
