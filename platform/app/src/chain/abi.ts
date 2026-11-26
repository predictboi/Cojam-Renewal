// The calls each signer may build, from a fixed table (DEV-PLAN 4.1).
import { encodeFunctionData, type Hex } from 'viem';
// Generated ABIs from platform/shared (synced from contracts/artifacts by the deploy agent).
import { cojamPredictAbi, cojamStakingAbi, erc20Abi } from '../../../shared/abi/index.ts';

export const predictAbi = cojamPredictAbi;
export const stakingAbi = cojamStakingAbi;
export const ctAbi = erc20Abi;

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
