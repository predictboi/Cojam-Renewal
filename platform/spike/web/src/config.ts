// Build time configuration (Vite env) with safe defaults for local testing.
// SpikePredict on Kairos, deployed 2026-11-26 (platform/spike/contract/deployment.kairos.json).
const SPIKE_PREDICT_KAIROS = '0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const q = new URLSearchParams(location.search);

export const CONFIG = {
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID || 'cmwxqqrt0017p0gl5hi2gewh7',
  chainId: 1001,
  rpcUrl: import.meta.env.VITE_KAIROS_RPC_URL || 'https://public-en-kairos.node.kaia.io',
  explorer: 'https://kairos.kaiascan.io',
  faucet: 'https://www.kaia.io/faucet',
  contract: (import.meta.env.VITE_SPIKE_CONTRACT as string) || SPIKE_PREDICT_KAIROS,
  // ?api= is honoured on localhost only, like the swap site's ?gasapi=.
  apiBase: ((LOCAL && q.get('api')) || import.meta.env.VITE_SPONSOR_API || (LOCAL ? 'http://localhost:8787' : '')).replace(/\/$/, ''),
  // ?devkey=1 replaces the Privy wallet with a throwaway local key, on localhost only.
  devKey: LOCAL && q.get('devkey') === '1',
  local: LOCAL,
  release: (import.meta.env.VITE_RELEASE as string) || 'dev',
};
