// Everything a route needs, built once in main.ts (or by the tests with stubs).
import type { Config } from "../config/index.ts";
import type { Db } from "../db/index.ts";
import type { ChainReader, RawRpc } from "../chain/index.ts";
import type { AuthVerifier } from "../auth/privy.ts";
import type { FeePayerService } from "../feeDelegation/service.ts";

export interface Deps {
  config: Config;
  db: Db;
  chain: ChainReader;
  rpc: RawRpc;
  /** Privy verifier of the player app (null when PRIVY_APP_ID is unset: only the dev bypass works). */
  userAuth: AuthVerifier | null;
  /** Privy verifier of the separate admin app. */
  adminAuth: AuthVerifier | null;
  /** Set only when AUTH_DEV_BYPASS=1 (never in production). */
  devAuth: AuthVerifier | null;
  feePayer: FeePayerService | null;
  now: () => number;
  version: string;
}
