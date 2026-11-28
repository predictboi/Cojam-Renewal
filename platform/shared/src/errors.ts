// Error codes of the Cojam app API (cojam-app-api), shared by the API, the PWA and the admin.
// Every error response has the shape ApiErrorBody: { error: { code, message, retryable, details? } }.
// `message` is English developer text; the PWA shows its own copy per code (i18n key `error.<CODE>`).
// `retryable`: true when the same request may succeed later without any change (the PWA outbox retries it, DEV-PLAN 4.7).

export interface ErrorSpec {
  status: number;
  retryable: boolean;
  /** Short English description (developer facing, also used in API.md). */
  description: string;
}

export const ERRORS = {
  // ---- generic
  BAD_REQUEST: { status: 400, retryable: false, description: "The request body or query does not match the schema" },
  UNAUTHORIZED: { status: 401, retryable: false, description: "A valid Privy access token is required" },
  FORBIDDEN: { status: 403, retryable: false, description: "This caller may not do this" },
  NOT_FOUND: { status: 404, retryable: false, description: "No such resource" },
  CONFLICT: { status: 409, retryable: false, description: "The resource is not in a state that allows this change" },
  INTERNAL: { status: 500, retryable: true, description: "Unexpected server error" },
  RPC_UNAVAILABLE: { status: 503, retryable: true, description: "The Kaia RPC did not answer; try again shortly" },
  NOT_CONFIGURED: { status: 503, retryable: false, description: "A contract address or service key this endpoint needs is not configured" },

  // ---- sign up and session (DEV-PLAN 5.1, 5.2)
  EMAIL_INVALID: { status: 400, retryable: false, description: "Not a valid email address after normalisation" },
  EMAIL_DOMAIN_NOT_ALLOWED: { status: 403, retryable: false, description: "This email provider is not supported yet" },
  EMAIL_DUPLICATE: { status: 409, retryable: false, description: "The normalised address already belongs to another player" },
  EMAIL_MISSING: { status: 403, retryable: false, description: "The Privy account has no verified email address" },
  WALLET_MISSING: { status: 409, retryable: true, description: "Privy has not created the embedded wallet yet; call again shortly" },
  RATE_LIMITED_IP: { status: 429, retryable: true, description: "Too many requests from this network" },
  RATE_LIMITED_DEVICE: { status: 429, retryable: true, description: "Too many requests from this device" },
  RATE_LIMITED_EMAIL: { status: 429, retryable: true, description: "Too many code requests for this address" },
  RATE_LIMITED_USER: { status: 429, retryable: true, description: "Too many requests or sponsored transactions for this Privy user" },
  SIGNUP_RATE_LIMITED: { status: 429, retryable: false, description: "Too many sign ups from this network or device" },
  SIGNUP_BUSY: { status: 503, retryable: true, description: "Sign ups are queued because of unusual volume" },
  REGISTRATION_REFUSED: { status: 403, retryable: false, description: "This account cannot be registered as a player" },
  NOT_REGISTERED: { status: 403, retryable: false, description: "The wallet is not a registered player (yet)" },
  FROZEN: { status: 403, retryable: false, description: "The account is on hold: no sponsored transactions, no staking, no invites (help@cojam.app)" },

  // ---- invites (DEV-PLAN 6.2, DECISIONS "Invite code entry")
  INVITE_SHORT: { status: 400, retryable: false, description: "The code is shorter than 6 characters" },
  INVITE_UNKNOWN: { status: 404, retryable: false, description: "No usable code: unknown, disabled, or the inviter is on hold" },
  INVITE_OWN: { status: 400, retryable: false, description: "A player cannot use their own code" },
  INVITE_ALREADY_LINKED: { status: 409, retryable: false, description: "The player already has an inviter (details.inviterName)" },
  INVITE_TOO_LATE: { status: 409, retryable: false, description: "More than 24 hours since registration: the link is fixed for good" },
  INVITE_LIMIT: { status: 429, retryable: false, description: "The code cannot be used right now (inviter daily cap, or a two way link)" },

  // ---- fee payer: transaction shape (DEV-PLAN 6.3)
  DECODE_FAILED: { status: 400, retryable: false, description: "rawTransaction could not be decoded" },
  TX_TYPE_NOT_ALLOWED: { status: 400, retryable: false, description: "Only TxTypeFeeDelegatedSmartContractExecution (0x31) is sponsored" },
  SENDER_SIGNATURE_INVALID: { status: 400, retryable: false, description: "Exactly one sender signature recovering to `from` is required" },
  CHAIN_ID_MISMATCH: { status: 400, retryable: false, description: "Signed for another chain" },
  FEE_PAYER_MISMATCH: { status: 400, retryable: false, description: "Names another fee payer or already carries a fee payer signature" },
  VALUE_NOT_ZERO: { status: 400, retryable: false, description: "Sponsored transactions must not send KAIA" },
  TARGET_NOT_ALLOWED: { status: 400, retryable: false, description: "Only CojamPredict, CojamStaking and CT are sponsored" },
  SELECTOR_NOT_ALLOWED: { status: 400, retryable: false, description: "This function is never sponsored (CT transfer, owner and operator functions)" },
  CALLDATA_INVALID: { status: 400, retryable: false, description: "Arguments are not canonical or break a policy rule" },
  GAS_LIMIT_TOO_HIGH: { status: 400, retryable: false, description: "Gas limit above the cap for this action" },
  GAS_LIMIT_TOO_LOW: { status: 400, retryable: false, description: "Gas limit below the simulated estimate" },
  GAS_PRICE_TOO_HIGH: { status: 400, retryable: false, description: "Gas price above the cap (MAX_GAS_PRICE_GKEI)" },
  AUTH_REQUIRED: { status: 401, retryable: false, description: "This action needs a bearer token (only play key predict and revoke go without)" },
  SENDER_NOT_ALLOWED: { status: 403, retryable: false, description: "`from` is neither the bearer's embedded wallet nor that player's current play key" },
  SPENDER_NOT_ALLOWED: { status: 400, retryable: false, description: "CT approve is sponsored only for the CojamStaking contract" },

  // ---- fee payer: contract state (from the policy or the simulation)
  PLAY_KEY_INVALID: { status: 409, retryable: false, description: "The play key is expired, revoked or replaced: re-authorise (DEV-PLAN 4.2)" },
  ALREADY_DONE: { status: 409, retryable: false, description: "Already answered on chain (or the same action already succeeded)" },
  MARKET_CLOSED: { status: 409, retryable: false, description: "The market is closed" },
  MARKET_NOT_TODAY: { status: 409, retryable: false, description: "The market is not one of today's open markets" },
  DAY_NOT_OPEN: { status: 409, retryable: false, description: "The day is not open yet" },
  PAUSED: { status: 503, retryable: true, description: "The contract is paused" },
  BELOW_MINIMUM: { status: 400, retryable: false, description: "Below the minimum conversion" },
  NOT_MULTIPLE_OF_RATE: { status: 400, retryable: false, description: "Points must be a multiple of pointsPerCT" },
  INSUFFICIENT_POINTS: { status: 409, retryable: false, description: "Not enough points" },
  ACCOUNT_TOO_NEW: { status: 409, retryable: false, description: "The account is younger than minAccountAge (7 days)" },
  DAILY_CAP_REACHED: { status: 409, retryable: true, description: "The daily conversion cap is used up (details.left)" },
  INSUFFICIENT_RESERVE: { status: 503, retryable: true, description: "The contract reserve cannot pay this now" },
  BELOW_MIN_STAKE: { status: 400, retryable: false, description: "Below the minimum stake" },
  TOO_MANY_POSITIONS: { status: 409, retryable: false, description: "Open position limit reached" },
  STAKING_TOTAL_CAP: { status: 409, retryable: false, description: "Total staking cap reached (details.room)" },
  STAKING_USER_CAP: { status: 409, retryable: false, description: "Per address cap of 1,000,000 CT open principal reached (details.room)" },
  STAKING_FULL: { status: 409, retryable: true, description: "Interest for this stake cannot be reserved right now" },
  INSUFFICIENT_CT: { status: 409, retryable: false, description: "Not enough CT in the wallet" },
  ALLOWANCE_TOO_LOW: { status: 409, retryable: false, description: "Approve CT for staking first" },
  UNKNOWN_POSITION: { status: 404, retryable: false, description: "No such staking position for this wallet" },
  POSITION_CLOSED: { status: 409, retryable: false, description: "The position is already withdrawn" },
  LOCK_NOT_ENDED: { status: 409, retryable: false, description: "The lock has not ended" },
  NOTHING_TO_CLAIM: { status: 409, retryable: false, description: "Nothing to claim" },
  BELOW_MIN_CLAIM: { status: 409, retryable: false, description: "Below the minimum claim while locked" },
  NOT_READY_TO_SETTLE: { status: 409, retryable: true, description: "Nothing to settle yet" },
  SIMULATION_FAILED: { status: 400, retryable: false, description: "The transaction would revert on chain (details.revert)" },

  // ---- fee payer: limits and broadcast (DEV-PLAN 4.8)
  RATE_LIMITED_SENDER: { status: 429, retryable: true, description: "Daily sponsored transaction limit reached for this player" },
  RATE_LIMITED_BURST: { status: 429, retryable: true, description: "More than the per minute sponsor limit" },
  DAILY_BUDGET_EXHAUSTED: { status: 503, retryable: true, description: "Today's sponsorship budget is used up; retry later" },
  FEE_PAYER_BALANCE_LOW: { status: 503, retryable: true, description: "The fee payer is below its balance floor" },
  BROADCAST_REJECTED: { status: 400, retryable: false, description: "The node rejected the transaction (details.reason)" },
  BROADCAST_UNCERTAIN: { status: 502, retryable: true, description: "The RPC did not answer; the transaction may be on its way (details.txHash)" },
  TX_NOT_FOUND: { status: 404, retryable: false, description: "No sponsored transaction or receipt with this hash" },

  // ---- admin
  ADMIN_FORBIDDEN: { status: 403, retryable: false, description: "The admin role does not allow this action" },
  QUESTION_PUBLISHED: { status: 409, retryable: false, description: "The question is already on chain: it can no longer be cancelled or replaced" },
  CORRECTION_WINDOW_OVER: { status: 409, retryable: false, description: "The correction window is over: use the owner path (setCorrectedOutcome and compensation)" },
} as const satisfies Record<string, ErrorSpec>;

export type ErrorCode = keyof typeof ERRORS;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(ERRORS, x);
}

/** Contract custom error name -> API code (CojamPredict, CojamStaking, OpenZeppelin). */
export const REVERT_CODES: Record<string, ErrorCode> = {
  AlreadyPredicted: "ALREADY_DONE",
  BadPlayKey: "PLAY_KEY_INVALID",
  NotRegistered: "NOT_REGISTERED",
  Frozen: "FROZEN",
  MarketClosed: "MARKET_CLOSED",
  DayNotOpen: "DAY_NOT_OPEN",
  BadChoice: "CALLDATA_INVALID",
  BadExpiry: "CALLDATA_INVALID",
  PlayKeyTaken: "CALLDATA_INVALID",
  NoPlayKey: "ALREADY_DONE",
  EnforcedPause: "PAUSED",
  BelowMinimum: "BELOW_MINIMUM",
  NotMultipleOfRate: "NOT_MULTIPLE_OF_RATE",
  InsufficientPoints: "INSUFFICIENT_POINTS",
  AccountTooNew: "ACCOUNT_TOO_NEW",
  DailyCapReached: "DAILY_CAP_REACHED",
  InsufficientReserve: "INSUFFICIENT_RESERVE",
  NotReadyToSettle: "NOT_READY_TO_SETTLE",
  AlreadySettled: "ALREADY_DONE",
  BelowMinStake: "BELOW_MIN_STAKE",
  TooManyPositions: "TOO_MANY_POSITIONS",
  TotalCapReached: "STAKING_TOTAL_CAP",
  UserCapReached: "STAKING_USER_CAP",
  InsufficientRewards: "STAKING_FULL",
  UnknownPosition: "UNKNOWN_POSITION",
  PositionClosed: "POSITION_CLOSED",
  LockNotEnded: "LOCK_NOT_ENDED",
  NothingToClaim: "NOTHING_TO_CLAIM",
  BelowMinClaim: "BELOW_MIN_CLAIM",
  InvalidLock: "CALLDATA_INVALID",
  ERC20InsufficientBalance: "INSUFFICIENT_CT",
  ERC20InsufficientAllowance: "ALLOWANCE_TOO_LOW",
};
