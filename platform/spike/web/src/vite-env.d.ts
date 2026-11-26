/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_SPONSOR_API?: string;
  readonly VITE_SPIKE_CONTRACT?: string;
  readonly VITE_KAIROS_RPC_URL?: string;
  readonly VITE_RELEASE?: string;
}
