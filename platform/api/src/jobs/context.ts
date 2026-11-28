// Everything a job needs, built once by the worker entry (src/worker/main.ts) or by a test.
import type { PublicClient } from 'viem';
import type { AiProvider } from '../ai/provider.ts';
import type { ImageGenerator, ImageStore } from '../ai/images.ts';
import type { DataAdapter } from '../ai/resolve.ts';
import type { Alerts } from '../worker/alerts.ts';
import type { OutsideMarkets } from '../dataRoom/polymarket.ts';
import type { Address } from '../worker/chain.ts';
import type { WDb } from '../worker/db.ts';
import type { Logger } from '../worker/log.ts';
import type { OperatorSender } from '../worker/sender.ts';

export interface WorkerSettings {
  /** Days ahead the drafter fills (D+1 .. D+horizon). */
  draftHorizonDays: number;
  draftCandidates: number;
  /** Batch sizes (contract caps: 200, compensate 500). */
  registerBatch: number;
  settleBatch: number;
  compensateBatch: number;
  freezeBatch: number;
  /** Weekly pool per qualified player and server cap, CT base units. */
  poolPerPlayerWei: bigint;
  poolCapWei: bigint;
  /** Qualified player rule (founder default 2026-11-26): completed days (all 5 answered) in the week, account age at the week's end. */
  poolMinDaysPlayed: number;
  poolMinAccountAgeSec: number;
  riskBlockAt: number;
  riskReviewAt: number;
  /** Hours: alert when a day is not on chain by this UTC hour of the day before; reserve fill at the second. */
  publishAlertHourUtc: number;
  publishReserveHourUtc: number;
  aiEnabled: boolean;
  /** Floors for the balance monitors (wei). */
  minOperatorBalanceWei: bigint;
  minFeePayerBalanceWei: bigint;
  feePayerAddress: Address | null;
  aiMonthlyBudgetUsd: number;
  /** Public base URL of the image store (uploaded images are fetched from it for the check). */
  imageBaseUrl: string;
}

export const DEFAULT_SETTINGS: WorkerSettings = {
  draftHorizonDays: 7,
  draftCandidates: 12,
  registerBatch: 100,
  settleBatch: 100,
  compensateBatch: 300,
  freezeBatch: 100,
  poolPerPlayerWei: 10n ** 18n,
  poolCapWei: 10_000n * 10n ** 18n,
  poolMinDaysPlayed: 3,
  poolMinAccountAgeSec: 7 * 86400,
  riskBlockAt: 80,
  riskReviewAt: 50,
  publishAlertHourUtc: 18,
  publishReserveHourUtc: 22,
  aiEnabled: true,
  minOperatorBalanceWei: 5n * 10n ** 18n,
  minFeePayerBalanceWei: 10n * 10n ** 18n,
  feePayerAddress: null,
  aiMonthlyBudgetUsd: 300,
  imageBaseUrl: 'https://img.cojam.app',
};

export interface JobContext {
  db: WDb;
  client: PublicClient;
  sender: OperatorSender;
  contracts: { predict: Address; staking: Address | null; ct: Address };
  log: Logger;
  alerts: Alerts;
  ai: AiProvider;
  images: { generator: ImageGenerator; store: ImageStore | null };
  adapters: DataAdapter[];
  settings: WorkerSettings;
  /** Outside markets (Polymarket): the data room price read at day close and the drafting source step. Absent: both are skipped. */
  outside?: OutsideMarkets;
  /** Unix seconds. Production: the wall clock (Kaia block time follows it); tests: the chain clock. */
  now: () => number;
}
