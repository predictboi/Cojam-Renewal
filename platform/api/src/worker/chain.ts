// viem clients for the worker: a public client over the configured RPC endpoints (fallback order)
// and contract handles. The operator key is only read here and in the sender.
import { createPublicClient, defineChain, fallback, http, type Chain, type PublicClient } from 'viem';
import { cojamPredictAbi, cojamStakingAbi, erc20Abi } from '../chain/abi.ts';

export { cojamPredictAbi, cojamStakingAbi, erc20Abi };

export type Address = `0x${string}`;

export function chainFor(chainId: number, rpcUrls: string[]): Chain {
  return defineChain({
    id: chainId,
    name: chainId === 8217 ? 'Kaia' : chainId === 1001 ? 'Kairos' : `local-${chainId}`,
    nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 },
    rpcUrls: { default: { http: rpcUrls } },
  });
}

export function createChainClient(chainId: number, rpcUrls: string[]): PublicClient {
  if (rpcUrls.length === 0) throw new Error('no RPC URL configured');
  const transports = rpcUrls.map((u) => http(u, { timeout: 15_000, retryCount: 2 }));
  return createPublicClient({
    chain: chainFor(chainId, rpcUrls),
    transport: transports.length === 1 ? transports[0] : fallback(transports, { rank: false }),
    pollingInterval: 1_000,
    cacheTime: 0,
  }) as PublicClient;
}

export interface Contracts {
  predict: Address;
  staking: Address | null;
  ct: Address;
}

/** CojamPredict params() in the same shape as the API's `PredictParams` (src/chain/index.ts), so the
 * worker's `app_state` snapshot can be read by the API as is. */
export interface PredictParams {
  completionPoints: number;
  hitPoints: number;
  referralBps: number;
  welcomePoints: number;
  settleDelay: number;
  pointsPerCT: number;
  minConvertPoints: number;
  maxConvertCtPerUserPerDay: number;
  maxConvertCtPerDay: number;
  minAccountAge: number;
  minResolveGap: number;
  maxWeeklyPool: number; // whole CT
  airdropDelay: number;
  treasury: Address;
  splitBps: number[];
  /** Longest time from the close to resolvesAt, seconds (CojamPredict with long questions; absent on the earlier contract). */
  maxResolveAfterClose?: number;
}

export async function readPredictParams(client: PublicClient, predict: Address): Promise<PredictParams> {
  const p = (await client.readContract({ address: predict, abi: cojamPredictAbi, functionName: 'params' })) as unknown as Record<string, unknown>;
  const n = (k: string) => Number(p[k] as number | bigint);
  return {
    completionPoints: n('completionPoints'),
    hitPoints: n('hitPoints'),
    referralBps: n('referralBps'),
    welcomePoints: n('welcomePoints'),
    settleDelay: n('settleDelay'),
    pointsPerCT: n('pointsPerCT'),
    minConvertPoints: n('minConvertPoints'),
    maxConvertCtPerUserPerDay: n('maxConvertCtPerUserPerDay'),
    maxConvertCtPerDay: n('maxConvertCtPerDay'),
    minAccountAge: n('minAccountAge'),
    minResolveGap: n('minResolveGap'),
    maxWeeklyPool: n('maxWeeklyPool'),
    airdropDelay: n('airdropDelay'),
    treasury: String(p.treasury).toLowerCase() as Address,
    splitBps: (p.splitBps as readonly (number | bigint)[]).map(Number),
    ...(p.maxResolveAfterClose !== undefined ? { maxResolveAfterClose: n('maxResolveAfterClose') } : {}),
  };
}

export async function chainNow(client: PublicClient): Promise<number> {
  const b = await client.getBlock({ blockTag: 'latest' });
  return Number(b.timestamp);
}
