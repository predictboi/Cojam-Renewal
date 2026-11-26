// Response types of the app API (DEV-PLAN 6.2), shaped by the plan and the design's mock data.
// Local until platform/shared/src/api.ts exists; fields marked NEW are needed by the screens but not defined in the plan.
// Amounts: points are integers; CT and KAIA are decimal numbers in token units (display only: on chain amounts are
// always built from the player's typed string with parseUnits, never from these floats).

export type Lang = 'en' | 'ko' | 'ja';
export type Address = `0x${string}`;
export type Dir = 'l' | 'r';
export interface QText { title: string; left: string; right: string; rule?: string; settle?: string }
export type Localized<T> = Record<Lang, T>;

export interface AppConfig {
  network: 'kaia' | 'kairos' | 'local';
  chainId: number;
  rpcUrl: string;                       // the RPC the PWA reads from (GET /v1/config rpcUrl)
  explorer: string;                     // kaiascan base URL (explorerUrl)
  /** Gas limit per action for 0x31 transactions: the fee payer's caps (GET /v1/config gasLimits). */
  gasLimits?: Record<string, number>;
  contracts: { ct: Address; predict: Address; staking: Address };
  params: {
    completionPoints: number; hitPoints: number; pointsPerCT: number; minConvertPoints: number;
    maxConvertCtPerUserPerDay: number; referralBps: number; welcomePoints: number; settleDelaySec: number;
    minStake: number; minClaim: number; maxOpenPositions: number;
    lockDays: number[];                 // [30, 90, 180, 365]
    tierThresholds: number[];           // [1000, 10000] CT
    ratesPct: Record<string, number[]>; // NEW shape: { "30": [8, 9, 10], ... } percent per tier
    playKeyTtlDays: number;             // NEW: 30
    maxUserPrincipal?: number;          // CT, open principal per address (stakingLimits)
  };
  minAppVersion: string;
  flags: {
    maintenance: boolean;
    maintenanceMessage?: Localized<string>; // NEW
    maintenanceUntil?: string;              // NEW, ISO
    stakingPaused: boolean; convertPaused: boolean; // NEW
  };
  krwPerCt: number;                     // NEW: KRW reference shown in Korean only
  userTxFeeKaia: number;                // NEW: estimate of a user paid transaction fee (W4, on hold)
  emailProviders: string[];             // NEW: allow list domains, for the caption and typo help on A1
  providerNames: string;                // NEW: "Gmail, Naver, ..." as shown
}

export interface EmailCheck { allowed: boolean; reason?: 'bad' | 'provider' | 'toomany'; supportedProviders: string[] }

export type Registration = 'pending' | 'registered' | 'refused';
export interface SessionState {
  registration: Registration;
  reason?: 'used' | 'provider' | 'many' | 'other';   // NEW: refusal reasons as shown on A1 (refused-used, -provider, -many)
  frozen: boolean;
  playKey: { key: Address; expiresAt: number } | null;   // expiresAt: unix seconds
  invite: { code: string; linkedTo: string | null };
  isNew?: boolean;                      // NEW: first session of this user (A2 shows once)
}

export interface Me {
  wallet: Address;
  email: string;
  name: string | null;
  language: Lang;
  onboarded: boolean;
  registration: Registration;
  frozen: boolean;
  signedUpAt: string;                   // NEW: ISO; the invite code window is 24 hours from here
  referrer: { name: string } | null;    // NEW: the inviter, once linked
  stats: { weekRank: number | null; weekPoints: number; points: number; newAnswers: number }; // NEW: newAnswers (Results badge)
}

export interface Market {
  marketId: string;                     // decimal string: dayId * 5 + slot
  slot: number;                         // 0..4
  n: number;                            // 1..5 as shown
  category: 'crypto' | 'markets' | 'weather' | 'sports' | 'culture';
  imageUrl: string | null;
  closesAt: number;                     // unix ms
  resolvesAt?: number;                  // unix ms: when the answer is expected
  text: Localized<QText>;
  choice: { chain: 0 | 1 | 2 };         // 1 = left (choice A), 2 = right (choice B)
}
export interface Today {
  dayId: number;
  opensAt: number; nextOpenAt: number;  // unix ms
  state: 'open' | 'empty' | 'closed';   // NEW: empty = no set published yet; closed = the set closed while open
  markets: Market[];
  completed: boolean;                   // chain: completion credited
  welcomePaid: boolean;                 // NEW: WelcomePaid in the fifth predict
  inviterName: string | null;           // NEW: for the welcome note on H3
}

export type Outcome = 'hit' | 'pend' | 'corr' | 'miss' | 'wait' | 'none' | 'void';
export interface ResultRow {
  marketId: string; category: Market['category']; text: Localized<QText>;
  choice: Dir | null; outcome: Outcome;
  expectedAt?: number;                  // wait: when the answer is expected (ms)
  landsAt?: number;                     // pend: when the +50P lands (ms)
  answer?: Dir; setAt?: number; evidenceUrl?: string; correctedAt?: number;
}
export interface ResultDay {
  dayId: number; date: number; answered: number; completed: boolean;
  points: number; pendingPoints: number;
  welcomeBonus?: number; inviteBonus?: { points: number; friends: number };
  rows: ResultRow[];
}
export interface Results {
  summary: { week: { points: number; hits: number; answered: number }; all: { points: number; hitRate: number }; pending: { points: number; landsAt: number | null } };
  days: ResultDay[];
  nextCursor: string | null;
}

export interface RankRow { rank: number; name: string; points: number; prize?: number; me?: boolean }
export interface Ranking {
  weekId: number;
  state: 'live' | 'final' | 'sent';
  endsAt: number;                       // ms
  pool: { ct: number; players: number; splitPct: number[] };
  top: RankRow[];
  me: { rank: number | null; points: number; gap: number | null; prize: number | null; held: boolean };
  around: RankRow[];
  airdropTx?: string;
  lastWeek?: { rank: number; amount: number } | null; // NEW: "You won ... last week" note
}

export interface WalletInfo {
  address: Address;
  ct: number; kaia: number; points: number; staked: number; openStakes: number;
  pendingHit: { points: number; landsAt: number } | null;
  convert: { pointsPerCT: number; min: number; capLeftCt: number; capPerDayCt: number; globalCapLeft: number; firstConvertAt: number | null; paused: boolean };
  inviteWeek: number;                   // NEW: invite bonus this week (W1 row)
}

export interface Position {
  id: string; amount: number; lockDays: number; aprPct: number;
  start: number; end: number;           // ms
  claimed: number; closed: boolean; paid?: number;
}
export interface Positions { positions: Position[]; closed: Position[] }
export interface StakeQuote { tier: number; aprPct: number; interest: number; krw?: number; capacityLeft: number }

export interface InviteInfo {
  code: string; link: string; linkShort: string;
  referralBps: number; welcomePoints: number;
  stats: { joined: number; firstDay: number; bonusTotal: number; bonusWeek: number };
  friends: { name: string; state: 'joined' | 'first'; points: number; joinedAt?: number }[];
}
export interface InviteLookup { valid: boolean; inviterName?: string }

export interface SponsorOk { txHash: string; action: string }
export interface TxStatus { hash: string; status: 'pending' | 'mined' | 'reverted' | 'unknown'; error?: string }

export interface ApiErrorBody { error: { code: string; message: string; txHash?: string; inviterName?: string } }
