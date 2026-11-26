// The calls each signer may build, from a fixed table (DEV-PLAN 4.1). Local until platform/shared exports the
// generated ABIs; the signatures follow DEV-PLAN 3.4 and 3.5.
import { encodeFunctionData, parseAbi, type Hex } from 'viem';

export const predictAbi = parseAbi([
  'function predict(uint256 marketId, uint8 choice)',
  'function setPlayKey(address key, uint64 expiresAt)',
  'function revokePlayKey()',
  'function convert(uint256 points)',
  'function settle(address user, uint32 dayId)',
  'function playKeyOf(address player) view returns (address key, uint64 expiresAt)',
  'function playerOf(address key) view returns (address player, uint64 expiresAt, bool valid)',
  'function dayOf(address user, uint32 dayId) view returns (uint8 answered, uint8[5] choices, bool completed, uint8 settledMask, uint8 hits)',
  'function balanceOf(address user) view returns (uint256)',
]);
export const stakingAbi = parseAbi([
  'function stake(uint256 amount, uint8 lockIndex) returns (uint256 id)',
  'function claimInterest(uint256 id) returns (uint256)',
  'function withdraw(uint256 id) returns (uint256 principal, uint256 interest)',
]);
export const ctAbi = parseAbi([
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

/** Gas limits per action (DEV-PLAN 4.3 step 3: a fixed table plus 30%; caps from the fee payer policy 6.3). */
export const GAS: Record<string, bigint> = {
  predict: 150_000n, setPlayKey: 120_000n, revokePlayKey: 80_000n, convert: 200_000n,
  approve: 120_000n, stake: 300_000n, claimInterest: 200_000n, withdraw: 200_000n, transfer: 90_000n,
};

/** Play key table: predict and revokePlayKey only. */
export const playKeyCall = {
  predict: (marketId: bigint, choice: 1 | 2): Hex => encodeFunctionData({ abi: predictAbi, functionName: 'predict', args: [marketId, choice] }),
  revoke: (): Hex => encodeFunctionData({ abi: predictAbi, functionName: 'revokePlayKey' }),
};
/** Privy wallet table: the value actions. */
export const walletCall = {
  setPlayKey: (key: Hex, expiresAt: bigint): Hex => encodeFunctionData({ abi: predictAbi, functionName: 'setPlayKey', args: [key, expiresAt] }),
  convert: (points: bigint): Hex => encodeFunctionData({ abi: predictAbi, functionName: 'convert', args: [points] }),
  approve: (spender: Hex, value: bigint): Hex => encodeFunctionData({ abi: ctAbi, functionName: 'approve', args: [spender, value] }),
  stake: (amount: bigint, lockIndex: number): Hex => encodeFunctionData({ abi: stakingAbi, functionName: 'stake', args: [amount, lockIndex] }),
  claimInterest: (id: bigint): Hex => encodeFunctionData({ abi: stakingAbi, functionName: 'claimInterest', args: [id] }),
  withdraw: (id: bigint): Hex => encodeFunctionData({ abi: stakingAbi, functionName: 'withdraw', args: [id] }),
  transfer: (to: Hex, value: bigint): Hex => encodeFunctionData({ abi: ctAbi, functionName: 'transfer', args: [to, value] }),
};
