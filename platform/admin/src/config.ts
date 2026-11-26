// Build time configuration (Vite env). Every value here is public.
const env = import.meta.env;

export const CONFIG = {
  apiUrl: ((env.VITE_API_URL as string) || 'http://localhost:8080').replace(/\/$/, ''),
  privyAppId: (env.VITE_PRIVY_ADMIN_APP_ID as string) || '',
  /** Every screen runs on the design's mock data; ?state=, ?env= and ?role= presets work as in the prototype. */
  mock: env.VITE_API_MOCK === '1',
  /** Dev sign in with the X-Dev-Admin header. `import.meta.env.DEV` is false in every `vite build`, so a production
   *  bundle never contains this path (the API also refuses the header when NODE_ENV=production). */
  devAdmin: env.DEV ? ((env.VITE_DEV_ADMIN as string) || '') : '',
  supportEmail: 'help@cojam.app',
  idleMinutes: 30,
};

export const CHAINS: Record<number, { name: string; rpc: string; explorer: string }> = {
  8217: { name: 'Kaia', rpc: 'https://public-en.node.kaia.io', explorer: 'https://kaiascan.io' },
  1001: { name: 'Kaia Kairos', rpc: 'https://public-en-kairos.node.kaia.io', explorer: 'https://kairos.kaiascan.io' },
  31337: { name: 'Local', rpc: 'http://localhost:8545', explorer: 'https://kaiascan.io' },
};
