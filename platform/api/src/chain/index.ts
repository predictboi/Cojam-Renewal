// Chain access shared by the API and the worker.
//   createChainClients(config) -> { publicClient, rpc, addresses, chain }
//   createChainReader(clients)  -> typed reads the API uses (stubbed in tests through the ChainReader interface)
// The worker builds its operator wallet with operatorWalletClient(clients, privateKey).
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../config/index.ts";
import { cojamPredictAbi, cojamStakingAbi, erc20Abi } from "./abi.ts";

export { cojamPredictAbi, cojamStakingAbi, erc20Abi };

export function kaiaChain(chainId: number, rpcUrl: string): Chain {
  return defineChain({
    id: chainId,
    name: chainId === 8217 ? "Kaia" : chainId === 1001 ? "Kaia Kairos" : `Kaia ${chainId}`,
    nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockTime: 1000,
  });
}

/** Error from a JSON-RPC call. isNodeReply: the node answered (for example a revert); otherwise transport failure. */
export class RpcError extends Error {
  isNodeReply: boolean;
  nodeMessage: string;
  nodeData: Hex | null;
  constructor(message: string, opts: { isNodeReply: boolean; nodeMessage?: string; nodeData?: Hex | null }) {
    super(message);
    this.name = "RpcError";
    this.isNodeReply = opts.isNodeReply;
    this.nodeMessage = opts.nodeMessage ?? "";
    this.nodeData = opts.nodeData ?? null;
  }
}

export type RawRpc = (method: string, params: unknown[]) => Promise<unknown>;

/** Plain JSON-RPC over fetch with fallback URLs (for kaia_* methods viem does not know). */
export function createRawRpc(urls: string[], timeoutMs = 15_000): RawRpc {
  let id = 0;
  return async (method, params) => {
    let lastTransport: Error | null = null;
    for (const url of urls) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        lastTransport = e as Error;
        continue;
      }
      if (!res.ok) {
        lastTransport = new Error(`HTTP ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { result?: unknown; error?: { code: number; message?: string; data?: unknown } };
      if (body.error) {
        const data = typeof body.error.data === "string" && body.error.data.startsWith("0x") ? (body.error.data as Hex) : null;
        throw new RpcError(`${method}: ${body.error.message ?? "error"}`, {
          isNodeReply: true,
          nodeMessage: body.error.message ?? "",
          nodeData: data,
        });
      }
      return body.result;
    }
    throw new RpcError(`${method}: RPC unavailable (${lastTransport?.message ?? "no url"})`, { isNodeReply: false });
  };
}

export interface ChainClients {
  chain: Chain;
  publicClient: PublicClient;
  rpc: RawRpc;
  addresses: { ct?: Address; predict?: Address; staking?: Address };
  rpcUrls: string[];
}

export function createChainClients(config: Pick<Config, "chainId" | "rpcUrls" | "addresses">): ChainClients {
  const chain = kaiaChain(config.chainId, config.rpcUrls[0]);
  const transport = config.rpcUrls.length > 1 ? fallback(config.rpcUrls.map((u) => http(u, { timeout: 15_000 }))) : http(config.rpcUrls[0], { timeout: 15_000 });
  const publicClient = createPublicClient({ chain, transport, batch: { multicall: false } }) as PublicClient;
  return { chain, publicClient, rpc: createRawRpc(config.rpcUrls), addresses: config.addresses, rpcUrls: config.rpcUrls };
}

/** A viem wallet client for the operator key (worker only). Legacy gas pricing works on Kaia. */
export function operatorWalletClient(clients: ChainClients, privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: clients.chain, transport: http(clients.rpcUrls[0]) });
}

// ---------------------------------------------------------------- reads

export interface PlayerState {
  referrer: Address;
  registeredAt: number;
  registered: boolean;
  frozen: boolean;
  completedOnce: boolean;
}
export interface PlayKeyBinding {
  player: Address;
  expiresAt: number;
  valid: boolean;
}
export interface DayState {
  answered: number;
  choices: number[];
  completed: boolean;
  settledMask: number;
  hits: number;
}
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
  maxWeeklyPool: number;
  airdropDelay: number;
  treasury: Address;
  splitBps: number[];
}
export interface StakingQuote {
  tier: number;
  aprBps: number;
  interest: bigint;
  end: number;
}
export interface StakingPositionView {
  id: number;
  principal: bigint;
  maxInterest: bigint;
  claimed: bigint;
  claimable: bigint;
  start: number;
  end: number;
  aprBps: number;
  lockIndex: number;
  closed: boolean;
}
export interface StakingState {
  minStake: bigint;
  minClaim: bigint;
  maxOpenPositions: number;
  maxTotalPrincipal: bigint;
  maxUserPrincipal: bigint;
  totalPrincipal: bigint;
  availableRewards: bigint;
  paused: boolean;
}
export interface MarketState {
  closesAt: number;
  resolvesAt: number;
  resolvedAt: number;
  settlesAt: number;
  outcome: number;
  correctedOutcome: number;
  contentHash: Hex;
}

/** Every chain read the API makes. Tests replace it with a stub. */
export interface ChainReader {
  blockNumber(): Promise<number>;
  kaiaBalance(address: Address): Promise<bigint>;
  ctBalance(address: Address): Promise<bigint>;
  ctAllowance(owner: Address, spender: Address): Promise<bigint>;
  pointsBalance(address: Address): Promise<bigint>;
  player(wallet: Address): Promise<PlayerState>;
  playerOf(key: Address): Promise<PlayKeyBinding>;
  playKeyOf(wallet: Address): Promise<{ key: Address; expiresAt: number }>;
  dayOf(wallet: Address, dayId: number): Promise<DayState>;
  pendingHits(wallet: Address, dayId: number): Promise<{ points: bigint; landsAt: number }>;
  params(): Promise<PredictParams>;
  /** Proposed params waiting for applyParams (applyAfter 0 = none). */
  pendingParams(): Promise<{ params: PredictParams; applyAfter: number }>;
  market(marketId: number): Promise<MarketState>;
  reserve(): Promise<bigint>;
  convertedCtOnDay(wallet: Address, dayId: number): Promise<bigint>;
  convertedCtTotalOnDay(dayId: number): Promise<bigint>;
  predictPaused(): Promise<boolean>;
  stakingQuote(amount: bigint, lockIndex: number): Promise<StakingQuote>;
  stakingState(): Promise<StakingState>;
  stakingPrincipalOf(wallet: Address): Promise<bigint>;
  stakingOpenPositions(wallet: Address): Promise<number>;
  stakingPositions(wallet: Address): Promise<StakingPositionView[]>;
  stakingPosition(wallet: Address, id: number): Promise<StakingPositionView | null>;
}

function need(addr: Address | undefined, name: string): Address {
  if (!addr) throw new RpcError(`${name} address is not configured`, { isNodeReply: false });
  return addr;
}

/** viem Params struct -> PredictParams. */
export function toParams(p: any): PredictParams {
  return {
    completionPoints: Number(p.completionPoints),
    hitPoints: Number(p.hitPoints),
    referralBps: Number(p.referralBps),
    welcomePoints: Number(p.welcomePoints),
    settleDelay: Number(p.settleDelay),
    pointsPerCT: Number(p.pointsPerCT),
    minConvertPoints: Number(p.minConvertPoints),
    maxConvertCtPerUserPerDay: Number(p.maxConvertCtPerUserPerDay),
    maxConvertCtPerDay: Number(p.maxConvertCtPerDay),
    minAccountAge: Number(p.minAccountAge),
    minResolveGap: Number(p.minResolveGap),
    maxWeeklyPool: Number(p.maxWeeklyPool),
    airdropDelay: Number(p.airdropDelay),
    treasury: p.treasury,
    splitBps: [...p.splitBps].map(Number),
  };
}

export function createChainReader(clients: ChainClients): ChainReader {
  const pc = clients.publicClient;
  const predict = () => need(clients.addresses.predict, "PREDICT_ADDRESS");
  const staking = () => need(clients.addresses.staking, "STAKING_ADDRESS");
  const ct = () => need(clients.addresses.ct, "CT_ADDRESS");
  const readP = (functionName: string, args: unknown[] = []) =>
    pc.readContract({ address: predict(), abi: cojamPredictAbi, functionName: functionName as never, args: args as never }) as Promise<any>;
  const readS = (functionName: string, args: unknown[] = []) =>
    pc.readContract({ address: staking(), abi: cojamStakingAbi, functionName: functionName as never, args: args as never }) as Promise<any>;

  const toPos = (p: any): StakingPositionView => ({
    id: Number(p.id),
    principal: BigInt(p.principal),
    maxInterest: BigInt(p.maxInterest),
    claimed: BigInt(p.claimed),
    claimable: BigInt(p.claimable),
    start: Number(p.start),
    end: Number(p.end),
    aprBps: Number(p.aprBps),
    lockIndex: Number(p.lockIndex),
    closed: Boolean(p.closed),
  });

  return {
    async blockNumber() {
      return Number(await pc.getBlockNumber());
    },
    kaiaBalance: (a) => pc.getBalance({ address: a }),
    ctBalance: (a) => pc.readContract({ address: ct(), abi: erc20Abi, functionName: "balanceOf", args: [a] }) as Promise<bigint>,
    ctAllowance: (o, s) => pc.readContract({ address: ct(), abi: erc20Abi, functionName: "allowance", args: [o, s] }) as Promise<bigint>,
    pointsBalance: (a) => readP("balanceOf", [a]),
    async player(wallet) {
      const r = await readP("players", [wallet]);
      return { referrer: r[0], registeredAt: Number(r[1]), registered: r[2], frozen: r[3], completedOnce: r[4] };
    },
    async playerOf(key) {
      const r = await readP("playerOf", [key]);
      return { player: r[0], expiresAt: Number(r[1]), valid: r[2] };
    },
    async playKeyOf(wallet) {
      const r = await readP("playKeyOf", [wallet]);
      return { key: r[0], expiresAt: Number(r[1]) };
    },
    async dayOf(wallet, dayId) {
      const r = await readP("dayOf", [wallet, dayId]);
      return { answered: Number(r[0]), choices: [...r[1]].map(Number), completed: r[2], settledMask: Number(r[3]), hits: Number(r[4]) };
    },
    async pendingHits(wallet, dayId) {
      const r = await readP("pendingHits", [wallet, dayId]);
      return { points: BigInt(r[0]), landsAt: Number(r[1]) };
    },
    async pendingParams() {
      const r = await readP("pendingParams");
      return { params: toParams(r[0]), applyAfter: Number(r[1]) };
    },
    async params() {
      return toParams(await readP("params"));
    },
    async market(marketId) {
      const r = await readP("markets", [BigInt(marketId)]);
      return {
        closesAt: Number(r[0]),
        resolvesAt: Number(r[1]),
        resolvedAt: Number(r[2]),
        settlesAt: Number(r[3]),
        outcome: Number(r[4]),
        correctedOutcome: Number(r[5]),
        contentHash: r[6],
      };
    },
    reserve: () => readP("reserve"),
    convertedCtOnDay: (w, d) => readP("convertedCtOnDay", [w, d]),
    convertedCtTotalOnDay: (d) => readP("convertedCtTotalOnDay", [d]),
    predictPaused: () => readP("paused"),
    async stakingQuote(amount, lockIndex) {
      const r = await readS("quote", [amount, lockIndex]);
      return { tier: Number(r[0]), aprBps: Number(r[1]), interest: BigInt(r[2]), end: Number(r[3]) };
    },
    async stakingState() {
      const [minStake, minClaim, maxOpenPositions, maxTotalPrincipal, maxUserPrincipal, totalPrincipal, availableRewards, paused] =
        await Promise.all([
          readS("minStake"),
          readS("minClaim"),
          readS("maxOpenPositions"),
          readS("maxTotalPrincipal"),
          readS("maxUserPrincipal"),
          readS("totalPrincipal"),
          readS("availableRewards"),
          readS("paused"),
        ]);
      return {
        minStake: BigInt(minStake),
        minClaim: BigInt(minClaim),
        maxOpenPositions: Number(maxOpenPositions),
        maxTotalPrincipal: BigInt(maxTotalPrincipal),
        maxUserPrincipal: BigInt(maxUserPrincipal),
        totalPrincipal: BigInt(totalPrincipal),
        availableRewards: BigInt(availableRewards),
        paused: Boolean(paused),
      };
    },
    stakingPrincipalOf: (w) => readS("principalOf", [w]).then(BigInt),
    stakingOpenPositions: (w) => readS("openPositions", [w]).then(Number),
    async stakingPositions(wallet) {
      const out: StakingPositionView[] = [];
      for (let offset = 0; ; offset += 50) {
        const r = await readS("positionsOf", [wallet, BigInt(offset), 50n]);
        const list = r[0] as any[];
        out.push(...list.map(toPos));
        if (offset + 50 >= Number(r[1]) || list.length === 0) break;
      }
      return out;
    },
    async stakingPosition(wallet, id) {
      try {
        return toPos(await readS("positionOf", [wallet, BigInt(id)]));
      } catch {
        return null;
      }
    },
  };
}
