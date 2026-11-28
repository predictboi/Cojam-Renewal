// Contract addresses per network. kairos.json is written by contracts/scripts/platform/deploy-kairos.js;
// kaia.json is filled after the mainnet deploy (contracts/scripts/platform/deploy-mainnet.js).
import kairos from "./kairos.json" with { type: "json" };
import kaia from "./kaia.json" with { type: "json" };

export type NetworkName = "kairos" | "kaia";

export interface PlatformAddresses {
  network: NetworkName;
  chainId: number;
  /** Cojam Token (18 decimals). On Kairos a test CT controlled by the test key. */
  ct: `0x${string}`;
  predictLogic: `0x${string}` | null;
  predict: `0x${string}` | null;
  predictDeployBlock: number | null;
  staking: `0x${string}` | null;
  stakingDeployBlock: number | null;
  /** Kairos only: StakingShortLock test instance (days of a few seconds). Never the main staking contract. */
  stakingShortLock: `0x${string}` | null;
  stakingShortLockDeployBlock: number | null;
  stakingShortLockSecondsPerDay?: number | null;
  owner: `0x${string}` | null;
  treasury: `0x${string}` | null;
  operator: `0x${string}` | null;
  pauser: `0x${string}` | null;
}

export const addresses: Record<NetworkName, PlatformAddresses> = {
  kairos: kairos as PlatformAddresses,
  kaia: kaia as PlatformAddresses,
};

export const CHAIN_IDS: Record<NetworkName, number> = { kairos: 1001, kaia: 8217 };

export function addressesFor(network: NetworkName): PlatformAddresses {
  const a = addresses[network];
  if (!a) throw new Error(`unknown network ${network}`);
  return a;
}
