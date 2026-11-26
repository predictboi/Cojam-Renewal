// Error codes the app reacts to (DEV-PLAN 4.4, 4.7, 4.8, 6.2). Local until platform/shared/src/errors.ts exists.
export const ERR = {
  // sponsor and fee payer
  ALREADY_DONE: 'ALREADY_DONE',
  PLAY_KEY_INVALID: 'PLAY_KEY_INVALID',
  BROADCAST_UNCERTAIN: 'BROADCAST_UNCERTAIN',
  MARKET_CLOSED: 'MARKET_CLOSED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  CHAIN_ID_MISMATCH: 'CHAIN_ID_MISMATCH',
  FROZEN: 'FROZEN',
  FEE_PAYER_BALANCE_LOW: 'FEE_PAYER_BALANCE_LOW',
  DAILY_BUDGET_EXHAUSTED: 'DAILY_BUDGET_EXHAUSTED',
  RATE_LIMITED_SENDER: 'RATE_LIMITED_SENDER',
  RATE_LIMITED_USER: 'RATE_LIMITED_USER',
  RATE_LIMITED_IP: 'RATE_LIMITED_IP',
  RATE_LIMITED_BURST: 'RATE_LIMITED_BURST',
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  POLICY_REJECTED: 'POLICY_REJECTED',
  // invites
  INVITE_SHORT: 'INVITE_SHORT',
  INVITE_UNKNOWN: 'INVITE_UNKNOWN',
  INVITE_OWN: 'INVITE_OWN',
  INVITE_ALREADY_LINKED: 'INVITE_ALREADY_LINKED',
  INVITE_TOO_LATE: 'INVITE_TOO_LATE',
  INVITE_LIMIT: 'INVITE_LIMIT',
  // client side
  NETWORK: 'NETWORK',
  BAD_RESPONSE: 'BAD_RESPONSE',
} as const;
export type ErrCode = (typeof ERR)[keyof typeof ERR] | string;

export class ApiError extends Error {
  code: ErrCode;
  status: number;
  txHash?: string;
  extra?: Record<string, unknown>;
  constructor(code: ErrCode, message: string, status = 0, txHash?: string, extra?: Record<string, unknown>) {
    super(code + ': ' + message);
    this.name = 'ApiError';
    this.code = code; this.status = status; this.txHash = txHash; this.extra = extra;
  }
}
