// Request and response types of every user endpoint of cojam-app-api (platform/api/API.md has examples).
// Conventions: timestamps are unix seconds (number); CT and KAIA amounts are base unit strings (18 decimals)
// in fields ending with `Wei`; points are plain numbers (0 decimals); addresses are lower case 0x strings.
// Errors use ApiErrorBody from ./errors.ts.

import type { DataSplit } from "./dataRoom.ts";

export type Lang = "en" | "ko" | "ja";
export type Address = `0x${string}`;

export interface MarketText {
  title: string;
  left: string;
  right: string;
  rule: string;
  /** Settle time phrase written for this language (for example "09:00 tomorrow"). */
  settle: string;
}
export type MarketTexts = Record<Lang, MarketText>;

// ---------------------------------------------------------------- public

export interface ConfigResponse {
  network: "local" | "kairos" | "kaia";
  chainId: number;
  contracts: { ct: Address | null; predict: Address | null; staking: Address | null };
  feePayer: Address | null;
  privyAppId: string | null;
  minAppVersion: string;
  supportEmail: string;
  playKeyTtlDays: number;
  maxGasPriceGkei: number;
  /** Gas limits per action the PWA puts in its 0x31 transactions (the fee payer caps, DEV-PLAN 6.3). */
  gasLimits: Record<SponsoredAction, number>;
  params: {
    completionPoints: number;
    hitPoints: number;
    referralBps: number;
    welcomePoints: number;
    pointsPerCT: number;
    minConvertPoints: number;
    maxConvertCtPerUserPerDay: number;
    maxConvertCtPerDay: number;
    minAccountAgeSeconds: number;
    settleDelaySeconds: number;
    maxWeeklyPoolCt: number;
    splitBps: number[];
  } | null;
  staking: {
    lockDays: number[];
    /** rates[lockIndex][tier] in basis points. */
    rates: number[][];
    tierThresholdsWei: string[];
    minStakeWei: string;
    minClaimWei: string;
    maxUserPrincipalWei: string;
  } | null;
  /** Public JSON-RPC endpoint the PWA reads from (nonces, receipts, eth_call). Never the API's own provider key. */
  rpcUrl: string;
  /** Block explorer base URL without a trailing slash (`<explorerUrl>/tx/<hash>`, `<explorerUrl>/address/<a>`). */
  explorerUrl: string;
  /** KRW per CT for the Korean reference figures (shown in Korean only), null when not configured. */
  krwPerCt: number | null;
  /** Estimate of the KAIA fee of one user paid transaction (CT transfer, or a claim or withdrawal while on hold), base units. */
  userTxFeeWei: string;
  /** Planned maintenance: the PWA shows the maintenance screen while `on`. Set in app_state (`app.maintenance`) or by env. */
  maintenance: { on: boolean; message: Partial<Record<Lang, string>> | null; backAt: number | null };
  /** The email allow list in list order (A1 caption and typo help). */
  emailProviders: { domain: string; name: string }[];
  /** Staking limits (the staking snapshot, a live read, or the launch defaults). */
  stakingLimits: { maxOpenPositions: number; maxUserPrincipalWei: string; maxTotalPrincipalWei: string | null; paused: boolean };
  time: { now: number; dayId: number; dayOpensAt: number; dayEndsAt: number; weekId: number };
  features: { invites: boolean; staking: boolean; conversion: boolean; krwDisplay: boolean };
}

export interface HealthResponse {
  ok: boolean;
  db: boolean;
  rpc: boolean;
  blockNumber: number | null;
  feePayer: { address: Address | null; balanceWei: string | null; low: boolean };
  indexer: { block: number | null; lagBlocks: number | null };
  version: string;
}

export interface EmailCheckRequest {
  email: string;
}
export interface EmailCheckResponse {
  allowed: boolean;
  /** Set when allowed is false. */
  reason: "EMAIL_INVALID" | "EMAIL_DOMAIN_NOT_ALLOWED" | null;
  /** Display names of the supported providers, in list order (A1 copy). */
  supportedProviders: { domain: string; name: string }[];
}

export interface InviteLookupResponse {
  valid: boolean;
  inviterName?: string;
}

// ---------------------------------------------------------------- session and profile

export type RegistrationState = "pending" | "registered" | "refused";

export interface PlayKeyState {
  key: Address;
  expiresAt: number;
  valid: boolean;
}

export interface InviteSummary {
  /** Own code; null while the account is on hold (the code and link are hidden) or not registered yet. */
  code: string | null;
  link: string | null;
  /** Who invited this player, when linked. */
  linkedTo: { name: string } | null;
  /** True while a code can still be entered (no inviter yet and within 24 h of registration, or registration pending). */
  canEnterCode: boolean;
  /** Unix seconds until which a code can be entered (registeredAt + 24 h), null before registration. */
  enterCodeUntil: number | null;
}

export interface SessionRequest {
  inviteCode?: string;
}
export interface SessionResponse {
  registration: RegistrationState;
  /** Refusal reason code when refused (EMAIL_DOMAIN_NOT_ALLOWED, EMAIL_DUPLICATE, SIGNUP_RATE_LIMITED, ...). */
  reason: string | null;
  wallet: Address | null;
  frozen: boolean;
  playKey: PlayKeyState | null;
  invite: InviteSummary;
  /** When the session call carried an invite code: what happened to it. */
  inviteResult?: { status: "linked" | "queued" | "rejected"; code?: string; error?: string; inviterName?: string };
}

export interface MeResponse {
  id: number;
  wallet: Address | null;
  emailDomain: string | null;
  displayName: string | null;
  language: Lang;
  onboarded: boolean;
  registration: RegistrationState;
  registeredAt: number | null;
  frozen: boolean;
  supportEmail: string;
  createdAt: number;
  /** Result rows decided (answer set) since the player last opened Results (`PATCH /v1/me { resultsSeen: true }`): the tab badge. */
  newResults: number;
  /** When the player last opened Results, null before the first time. */
  resultsSeenAt: number | null;
  stats: {
    daysPlayed: number;
    daysCompleted: number;
    predictions: number;
    hits: number;
    /** hits / settled predictions, 0..1, null with none settled. */
    hitRate: number | null;
    pointsAllTime: number;
  };
}
export interface PatchMeRequest {
  language?: Lang;
  displayName?: string | null;
  onboarded?: boolean;
  /** true: the player opened Results now (resets newResults). */
  resultsSeen?: true;
}

// ---------------------------------------------------------------- play

export type Choice = 1 | 2;

export interface TodayMarket {
  marketId: number;
  slot: number;
  category: string;
  text: MarketTexts;
  imageUrl: string | null;
  /** Thumbnail for the terminal view (52 px), null with the category fallback. */
  thumbUrl: string | null;
  closesAt: number;
  resolvesAt: number;
  /** Choice on chain (indexed or read live), null when not answered. */
  myChoice: Choice | null;
  /** A sponsored predict accepted by the node but not mined/indexed yet. */
  pendingChoice: Choice | null;
}
export interface TodayResponse {
  dayId: number;
  opensAt: number;
  endsAt: number;
  nextOpensAt: number;
  weekId: number;
  /** False while the day's markets are not published (the PWA shows the countdown). */
  published: boolean;
  markets: TodayMarket[];
  answered: number;
  completed: boolean;
  completion: { points: number; welcomePoints: number; creditedTx: string | null } | null;
  /** Public name of the player's inviter (welcome note on day done), null without one. */
  inviterName: string | null;
}

export type ResultOutcome = "pending" | "hit" | "miss" | "void" | "unanswered";
export interface ResultRow {
  marketId: number;
  slot: number;
  category: string;
  text: MarketTexts;
  thumbUrl: string | null;
  myChoice: Choice | null;
  /** Final or current outcome: 1 / 2, 3 void, null unresolved. */
  outcome: 1 | 2 | 3 | null;
  correctedOutcome: 1 | 2 | null;
  result: ResultOutcome;
  /** Hit points: credited (settled), pending (resolved, waiting for the settle time) or 0. */
  hitPoints: number;
  hitState: "credited" | "pending" | "none";
  /** When the hit points land (settle time), unix seconds. */
  landsAt: number | null;
  /** When the answer is expected (the market's resolve time), unix seconds. */
  resolvesAt: number;
  resolvedAt: number | null;
  /** Evidence of the deciding resolution run, else the primary source. */
  evidenceUrl: string | null;
  /**
   * How the players picked (data room). Only on a row whose pick is recorded (indexed): the live figure while the day
   * is open, the final one after the close. Never present before the player's own pick.
   */
  split?: DataSplit;
}
export interface ResultDay {
  dayId: number;
  weekId: number;
  answered: number;
  completed: boolean;
  completionPoints: number;
  hits: number;
  hitPointsCredited: number;
  hitPointsPending: number;
  welcomePoints: number;
  /** Invite bonus credited to this player for points friends earned on this day (own line, not ranked). */
  inviteBonus: number;
  /** Number of friends whose points earned this day's invite bonus. */
  inviteFriends: number;
  rows: ResultRow[];
}
export interface ResultsResponse {
  summary: {
    week: { weekId: number; points: number; hits: number; answered: number; daysPlayed: number };
    allTime: { points: number; hits: number; settled: number; hitRate: number | null };
    pendingPoints: number;
  };
  days: ResultDay[];
  nextCursor: string | null;
}

export interface MarketDetailResponse {
  marketId: number;
  dayId: number;
  slot: number;
  category: string;
  status: string;
  text: MarketTexts;
  imageUrl: string | null;
  closesAt: number;
  resolvesAt: number;
  sources: { name: string; url: string; role?: string }[];
  outcome: 1 | 2 | 3 | null;
  correctedOutcome: 1 | 2 | null;
  resolvedAt: number | null;
  settlesAt: number | null;
  myChoice: Choice | null;
  evidence: { url: string; quote: string | null; observedAt: number | null }[];
  resolutionSummary: string | null;
}

export interface RankingRow {
  rank: number;
  name: string;
  points: number;
  /** Planned prize in CT base units (pool x split), null outside the top 10. */
  prizeWei: string | null;
  me?: boolean;
}
export interface RankingResponse {
  weekId: number;
  startsAt: number;
  endsAt: number;
  status: "open" | "closed" | "airdropped";
  poolWei: string;
  qualifiedPlayers: number | null;
  splitBps: number[];
  top: RankingRow[];
  /** The caller: rank among eligible players, or noPrize when on hold (still sees own points). */
  me: { rank: number | null; points: number; gapToTenth: number | null; noPrize: boolean } | null;
  /** Rows around the caller (2 above, 2 below) when outside the top 10. */
  around: RankingRow[];
  tieBreak: "earlier_last_completion";
  /** The week's airdrop transaction (the caller's own row when they won, else the first sent row), null before it is sent. */
  airdropTx: string | null;
  /** The caller's prize in the week before this one, null when they won nothing. */
  lastWeek: { weekId: number; rank: number; prizeWei: string; txHash: string | null } | null;
}

// ---------------------------------------------------------------- wallet

export interface WalletResponse {
  address: Address;
  ctWei: string;
  kaiaWei: string;
  points: number;
  pendingHitPoints: number;
  /** When the earliest pending hit points land (settle time), null with none pending. */
  pendingHitLandsAt: number | null;
  stakedWei: string;
  conversion: {
    pointsPerCT: number;
    minConvertPoints: number;
    /** Largest convertible amount now (multiple of the rate, inside caps and balance). */
    maxPointsNow: number;
    ctPreviewWei: string;
    userCapLeftWei: string;
    globalCapLeftWei: string;
    /** First time conversion is allowed (registeredAt + minAccountAge), null before registration. */
    allowedFrom: number | null;
    blockedReason: "NOT_REGISTERED" | "FROZEN" | "ACCOUNT_TOO_NEW" | "BELOW_MINIMUM" | "DAILY_CAP_REACHED" | null;
    /** CojamPredict is paused: conversion is off for everyone until it is unpaused. */
    paused: boolean;
  };
  krwPerCt: number | null;
}

export type HistoryKind = "deposit" | "withdrawal" | "conversion" | "airdrop" | "stake" | "interest" | "unstake";
export interface WalletHistoryItem {
  kind: HistoryKind;
  txHash: string;
  at: number | null;
  amountWei: string;
  points?: number;
  counterparty?: Address;
  weekId?: number;
  rank?: number;
}
export interface WalletHistoryResponse {
  items: WalletHistoryItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------- staking

export interface StakingQuoteResponse {
  amountWei: string;
  lockIndex: number;
  lockDays: number;
  tier: number;
  aprBps: number;
  interestWei: string;
  endsAt: number;
  /** Only filled for Korean display (KRW shown in Korean only). */
  krw: { principal: number; interest: number } | null;
  capacity: {
    userRoomWei: string;
    totalRoomWei: string | null;
    availableRewardsWei: string;
    fits: boolean;
    reason: "BELOW_MIN_STAKE" | "STAKING_USER_CAP" | "STAKING_TOTAL_CAP" | "STAKING_FULL" | "TOO_MANY_POSITIONS" | "FROZEN" | null;
  };
}
export interface StakingPosition {
  id: number;
  principalWei: string;
  lockIndex: number;
  lockDays: number;
  aprBps: number;
  startsAt: number;
  endsAt: number;
  maxInterestWei: string;
  claimedWei: string;
  claimableWei: string;
  closed: boolean;
  /** Closed positions: principal plus all interest paid over the position's life; null while open. */
  paidWei: string | null;
  /** Claimable now: while locked at least minClaim, after the lock any amount. */
  canClaim: boolean;
  canWithdraw: boolean;
}
export interface StakingPositionsResponse {
  positions: StakingPosition[];
  totals: { principalWei: string; claimableWei: string; open: number };
  minClaimWei: string;
}

// ---------------------------------------------------------------- invites

export interface InviteFriend {
  name: string;
  joinedAt: number;
  state: "joined" | "first_day_done";
  bonusPoints: number;
}
export interface InviteResponse {
  code: string | null;
  link: string | null;
  /** False while on hold: code and link are hidden (DECISIONS "On hold: staking and invites"). */
  available: boolean;
  referralBps: number;
  welcomePoints: number;
  stats: { friendsJoined: number; friendsFirstDayDone: number; bonusLifetime: number; bonusThisWeek: number };
  recent: InviteFriend[];
  linkedTo: { name: string } | null;
  canEnterCode: boolean;
  enterCodeUntil: number | null;
}
export interface InviteRedeemRequest {
  code: string;
}
export interface InviteRedeemResponse {
  status: "linked";
  inviterName: string;
  /** "queued": the operator transaction is on its way (setReferrer or registerPlayer with the inviter). */
  chain: "queued";
}

// ---------------------------------------------------------------- transactions

export type SponsoredAction =
  | "predict"
  | "setPlayKey"
  | "revokePlayKey"
  | "settle"
  | "convert"
  | "approve"
  | "stake"
  | "claimInterest"
  | "withdraw";

export interface SponsorRequest {
  /** Sender signed senderTxHashRLP of a 0x31 transaction. */
  rawTransaction: string;
}
export interface SponsorResponse {
  txHash: string;
  action: SponsoredAction;
  from: Address;
  /** Resolved player (the play key's player, or the wallet). */
  player: Address;
  nonce: number;
  /** True when this exact signed transaction was already accepted (idempotent replay). */
  duplicate: boolean;
}

export interface TxStatusResponse {
  txHash: string;
  status: "pending" | "mined" | "reverted" | "unknown";
  action: SponsoredAction | null;
  blockNumber: number | null;
  gasUsed: string | null;
  /** Decoded result for known actions (for example { marketId, choice } or { pointsCredited }). */
  result: Record<string, unknown> | null;
}
