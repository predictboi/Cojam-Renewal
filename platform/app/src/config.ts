// Build time configuration (Vite env). Every value here is public.
const env = import.meta.env;
const q = new URLSearchParams(location.search);
const PROD = env.PROD && env.MODE === 'production';

export type Network = 'kaia' | 'kairos' | 'local';
const NET = ((!PROD && q.get('net')) || env.VITE_NETWORK || 'kairos') as Network;

export const CONFIG = {
  network: NET,
  apiUrl: ((env.VITE_API_URL as string) || 'http://localhost:8790').replace(/\/$/, ''),
  privyAppId: (env.VITE_PRIVY_APP_ID as string) || 'cmwxqqrt0017p0gl5hi2gewh7',
  swapUrl: (env.VITE_SWAP_URL as string) || 'https://cojam.app/migrate/',
  release: (env.VITE_RELEASE as string) || 'dev',
  appVersion: '1.0.3',
  /** Every screen runs on the in app mock adapter fed from the design's mock data. */
  mockApi: env.VITE_API_MOCK === '1',
  /** Privy is replaced by a local throwaway wallet. */
  mockWallet: env.VITE_WALLET_MOCK === '1' || env.VITE_API_MOCK === '1',
  /** Non production builds honour ?standalone=1 (play in a browser tab) and ?state= presets. */
  dev: !PROD || env.VITE_API_MOCK === '1',
  supportEmail: 'help@cojam.app',
  appUrl: 'https://app.cojam.app/',
  /** Chain defaults until GET /v1/config answers (the server is the source of truth). */
  chain: NET === 'kaia'
    ? { id: 8217, rpc: 'https://public-en.node.kaia.io', explorer: 'https://kaiascan.io' }
    : NET === 'kairos'
      ? { id: 1001, rpc: 'https://public-en-kairos.node.kaia.io', explorer: 'https://kairos.kaiascan.io' }
      : { id: 31337, rpc: 'http://localhost:8545', explorer: 'https://kaiascan.io' },
};
