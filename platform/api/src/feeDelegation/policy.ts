// Static sponsorship policy (DEV-PLAN 6.3) for CojamPredict, CojamStaking and CT. Checks only what the decoded
// transaction itself shows; the sender rule, the player state, the limits and the simulation live in service.ts.
import { decodeErrorResult, decodeFunctionData, encodeFunctionData, toFunctionSelector, getAddress, type Abi, type Address, type Hex } from "viem";
import { cojamPredictAbi, cojamStakingAbi, erc20Abi } from "../chain/abi.ts";
import { ApiError } from "../server/errors.ts";
import { REVERT_CODES, type ErrorCode } from "../../../shared/src/errors.ts";
import { dayOfMarket, dayEnd as dayEndOf, dayIdOf } from "../../../shared/src/time.ts";
import type { SenderTx } from "./decode.ts";
import type { SponsoredAction } from "../../../shared/src/api.ts";

/**
 * Gas caps per action, re-derived from the measured gas in contracts/docs (Hardhat EVM) plus the Kaia fee
 * delegation surcharge (about 10,000), Kaia's calldata pricing (up to 100 gas per byte, about +6,000 for 68 bytes)
 * and about 20 to 25% headroom:
 *   predict        heaviest 123,094 (invited, first completed day)  -> about 139,000 on Kaia -> 170,000
 *   setPlayKey     first 74,002                                       -> about 90,000          -> 120,000
 *   revokePlayKey  not measured (two deletes, refunds)                -> about 45,000          -> 80,000
 *   settle         single user, 5 hits 72,610 (+ invite bonus)        -> about 105,000         -> 150,000
 *   convert        first of the day 124,768                           -> about 141,000         -> 200,000
 *   approve        about 46,000                                        -> about 62,000          -> 100,000
 *   stake          contract's first position 223,968                  -> about 240,000         -> 300,000
 *   claimInterest  first claim 82,553                                  -> about 99,000          -> 150,000
 *   withdraw       78,065                                              -> about 95,000          -> 150,000
 */
export const GAS_CAPS: Record<SponsoredAction, number> = {
  predict: 170_000,
  setPlayKey: 120_000,
  revokePlayKey: 80_000,
  settle: 150_000,
  convert: 200_000,
  approve: 100_000,
  stake: 300_000,
  claimInterest: 150_000,
  withdraw: 150_000,
};

/** Longest play key binding the fee payer sponsors (the PWA asks for 30 days; the contract allows 90). */
export const MAX_PLAY_KEY_SPONSOR_SECONDS = 31 * 86_400;

const sel = (sig: string) => toFunctionSelector(sig).toLowerCase();
export const SELECTORS = {
  predict: sel("predict(uint256,uint8)"),
  setPlayKey: sel("setPlayKey(address,uint64)"),
  revokePlayKey: sel("revokePlayKey()"),
  settle: sel("settle(address,uint32)"),
  convert: sel("convert(uint256)"),
  approve: sel("approve(address,uint256)"),
  stake: sel("stake(uint256,uint8)"),
  claimInterest: sel("claimInterest(uint256)"),
  withdraw: sel("withdraw(uint256)"),
} as const;

const PREDICT_ACTIONS: Record<string, SponsoredAction> = {
  [SELECTORS.predict]: "predict",
  [SELECTORS.setPlayKey]: "setPlayKey",
  [SELECTORS.revokePlayKey]: "revokePlayKey",
  [SELECTORS.settle]: "settle",
  [SELECTORS.convert]: "convert",
};
const STAKING_ACTIONS: Record<string, SponsoredAction> = {
  [SELECTORS.stake]: "stake",
  [SELECTORS.claimInterest]: "claimInterest",
  [SELECTORS.withdraw]: "withdraw",
};
const CT_ACTIONS: Record<string, SponsoredAction> = {
  [SELECTORS.approve]: "approve",
};

export interface PolicyConfig {
  chainId: number;
  feePayer: Address;
  predict: Address;
  staking: Address;
  ct: Address;
  maxGasPriceWei: bigint;
}

export type ActionArgs =
  | { action: "predict"; marketId: number; choice: 1 | 2 }
  | { action: "setPlayKey"; key: Address; expiresAt: number }
  | { action: "revokePlayKey" }
  | { action: "settle"; user: Address; dayId: number }
  | { action: "convert"; points: bigint }
  | { action: "approve"; spender: Address; amount: bigint }
  | { action: "stake"; amount: bigint; lockIndex: number }
  | { action: "claimInterest"; id: number }
  | { action: "withdraw"; id: number };

export interface StaticResult {
  action: SponsoredAction;
  args: ActionArgs;
  maxCostWei: bigint;
}

function decodeCanonical(abi: Abi, data: Hex, name: string): readonly unknown[] {
  let decoded: { functionName: string; args?: readonly unknown[] };
  try {
    decoded = decodeFunctionData({ abi, data }) as any;
  } catch {
    throw new ApiError("CALLDATA_INVALID", `Calldata for ${name} could not be decoded`);
  }
  const args = decoded.args ?? [];
  const again = encodeFunctionData({ abi, functionName: decoded.functionName as never, args: args as never }).toLowerCase();
  if (again !== data) throw new ApiError("CALLDATA_INVALID", `Calldata for ${name} is not canonical`);
  return args;
}

/** Static checks. Returns the action and its decoded arguments, or throws ApiError. */
export function checkStatic(tx: SenderTx, cfg: PolicyConfig, nowSec: number): StaticResult {
  if (tx.chainId !== cfg.chainId) throw new ApiError("CHAIN_ID_MISMATCH", `Signed for chain ${tx.chainId}, this service sponsors chain ${cfg.chainId}`);
  if (tx.signer.toLowerCase() !== tx.from.toLowerCase()) {
    throw new ApiError("SENDER_SIGNATURE_INVALID", `The sender signature recovers to ${tx.signer}, not to the from address ${tx.from}`);
  }
  if (tx.feePayer && tx.feePayer.toLowerCase() !== cfg.feePayer.toLowerCase()) throw new ApiError("FEE_PAYER_MISMATCH", "The transaction names a different fee payer");
  if (tx.feePayerSignatureCount > 0) throw new ApiError("FEE_PAYER_MISMATCH", "The transaction already carries a fee payer signature");
  if (tx.value !== 0n) throw new ApiError("VALUE_NOT_ZERO");
  if (!tx.to) throw new ApiError("TARGET_NOT_ALLOWED", "Contract deployment is not sponsored");

  const to = tx.to.toLowerCase();
  const data = tx.data;
  if (data.length < 10) throw new ApiError("SELECTOR_NOT_ALLOWED", "Missing function selector");
  const selector = data.slice(0, 10);

  let table: Record<string, SponsoredAction>;
  let abi: Abi;
  if (to === cfg.predict.toLowerCase()) {
    table = PREDICT_ACTIONS;
    abi = cojamPredictAbi as Abi;
  } else if (to === cfg.staking.toLowerCase()) {
    table = STAKING_ACTIONS;
    abi = cojamStakingAbi as Abi;
  } else if (to === cfg.ct.toLowerCase()) {
    table = CT_ACTIONS;
    abi = erc20Abi as Abi;
  } else {
    throw new ApiError("TARGET_NOT_ALLOWED");
  }
  const action = table[selector];
  if (!action) throw new ApiError("SELECTOR_NOT_ALLOWED", `Selector ${selector} is not sponsored on ${tx.to}`);
  const a = decodeCanonical(abi, data, action);

  let args: ActionArgs;
  switch (action) {
    case "predict": {
      const marketId = Number(a[0] as bigint);
      const choice = Number(a[1]);
      if (choice !== 1 && choice !== 2) throw new ApiError("CALLDATA_INVALID", "predict choice must be 1 or 2");
      const today = dayIdOf(nowSec);
      const day = dayOfMarket(marketId);
      if (day > today) throw new ApiError("DAY_NOT_OPEN", `Market ${marketId} belongs to day ${day}, today is ${today}`);
      if (day < today || nowSec >= dayEndOf(day)) throw new ApiError("MARKET_CLOSED", `Market ${marketId} closed at the end of day ${day}`);
      args = { action, marketId, choice };
      break;
    }
    case "setPlayKey": {
      const key = getAddress(a[0] as string);
      const expiresAt = Number(a[1] as bigint);
      if (/^0x0{40}$/i.test(key) || key.toLowerCase() === tx.from.toLowerCase()) {
        throw new ApiError("CALLDATA_INVALID", "setPlayKey key must be a new address, not zero and not the sender");
      }
      if (expiresAt <= nowSec || expiresAt > nowSec + MAX_PLAY_KEY_SPONSOR_SECONDS) {
        throw new ApiError("CALLDATA_INVALID", "setPlayKey expiresAt must be in the future and at most 31 days ahead");
      }
      args = { action, key, expiresAt };
      break;
    }
    case "revokePlayKey":
      args = { action };
      break;
    case "settle": {
      const user = getAddress(a[0] as string);
      if (user.toLowerCase() !== tx.from.toLowerCase()) throw new ApiError("CALLDATA_INVALID", "settle is sponsored only for the sender's own day");
      args = { action, user, dayId: Number(a[1]) };
      break;
    }
    case "convert": {
      const points = a[0] as bigint;
      if (points <= 0n) throw new ApiError("CALLDATA_INVALID", "convert needs a positive amount");
      args = { action, points };
      break;
    }
    case "approve": {
      const spender = getAddress(a[0] as string);
      if (spender.toLowerCase() !== cfg.staking.toLowerCase()) throw new ApiError("SPENDER_NOT_ALLOWED");
      args = { action, spender, amount: a[1] as bigint };
      break;
    }
    case "stake": {
      const lockIndex = Number(a[1]);
      if (lockIndex > 3) throw new ApiError("CALLDATA_INVALID", "lockIndex must be 0..3");
      const amount = a[0] as bigint;
      if (amount <= 0n) throw new ApiError("CALLDATA_INVALID", "stake needs a positive amount");
      args = { action, amount, lockIndex };
      break;
    }
    case "claimInterest":
    case "withdraw":
      args = { action, id: Number(a[0] as bigint) };
      break;
  }

  if (tx.gasPrice === 0n || tx.gasLimit === 0n) throw new ApiError("CALLDATA_INVALID", "Gas price and gas limit must be set");
  if (tx.gasLimit > BigInt(GAS_CAPS[action])) {
    throw new ApiError("GAS_LIMIT_TOO_HIGH", `Gas limit ${tx.gasLimit} is above the ${action} cap ${GAS_CAPS[action]}`);
  }
  if (tx.gasPrice > cfg.maxGasPriceWei) throw new ApiError("GAS_PRICE_TOO_HIGH", `Gas price ${tx.gasPrice} is above the cap ${cfg.maxGasPriceWei}`);
  return { action, args, maxCostWei: tx.gasLimit * tx.gasPrice };
}

const ALL_ERRORS_ABI = [...cojamPredictAbi, ...cojamStakingAbi, ...erc20Abi].filter((x: any) => x.type === "error") as Abi;
const OZ_ERRORS: Abi = [
  { type: "error", name: "EnforcedPause", inputs: [] },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
];
const ERRORS_ABI: Abi = [...ALL_ERRORS_ABI, ...OZ_ERRORS.filter((e: any) => !ALL_ERRORS_ABI.some((x: any) => x.name === e.name))];

/** Name and arguments of a contract revert from the node's error data, or null. */
export function decodeRevert(data: Hex | null | undefined): { name: string; args: readonly unknown[] } | null {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return null;
  try {
    const r = decodeErrorResult({ abi: ERRORS_ABI, data }) as { errorName: string; args?: readonly unknown[] };
    return { name: r.errorName, args: r.args ?? [] };
  } catch {
    return null;
  }
}

/** API error for a simulated revert. */
export function revertToError(revert: { name: string; args: readonly unknown[] } | null, nodeMessage: string): ApiError {
  if (!revert) return new ApiError("SIMULATION_FAILED", `The transaction would fail on chain: ${nodeMessage || "reverted"}`, { revert: null });
  const code: ErrorCode = REVERT_CODES[revert.name] ?? "SIMULATION_FAILED";
  const details: Record<string, unknown> = { revert: revert.name };
  if (revert.name === "DailyCapReached") details.leftWei = String(revert.args[0]);
  if (revert.name === "TotalCapReached" || revert.name === "UserCapReached") details.roomWei = String(revert.args[0]);
  if (revert.name === "InsufficientRewards") details.availableWei = String(revert.args[0]);
  return new ApiError(code, `The transaction would fail on chain: ${revert.name}`, details);
}
