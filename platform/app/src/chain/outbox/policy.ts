// Pure rules of the outbox (DEV-PLAN 4.3, 4.4, 4.7): no I/O here, so they are unit tested directly.

export const UNDO_MS = 3000;            // the Undo window (DECISIONS "Undo")
export const CLOSE_GUARD_MS = 15_000;   // a pick on a market closing within 15 s is queued at once, no Undo
export const UNDO_HIDE_EARLY_MS = 100;  // the Undo button goes away 100 ms before sendAfter
export const RESEND_AFTER_MS = 30_000;  // sent but not mined: resend the identical raw once
export const RESIGN_AFTER_MS = 90_000;  // still missing: re-sign the same payload with the same nonce
export const UNCERTAIN_WAIT_MS = 60_000;
export const SPONSOR_DOWN_RETRY_MS = 60_000;
export const SURFACE_AFTER_ATTEMPTS = 3;
export const SURFACE_AFTER_MS = 60_000;

/** 4.3 step 2: nonce = max(pending count, lastNonceUsed + 1); a fresh key starts at its pending count (0). */
export function nextNonce(pending: number, lastUsed: number | undefined): number {
  return lastUsed === undefined ? pending : Math.max(pending, lastUsed + 1);
}

/** 4.7: 1, 2, 4, 8, 16, 30 s with jitter, then every 30 s. attempt is 1 for the first retry. */
export function backoffMs(attempt: number, rand: () => number = Math.random): number {
  const base = [1, 2, 4, 8, 16, 30][Math.min(Math.max(attempt, 1), 6) - 1] * 1000;
  const jitter = 0.8 + rand() * 0.4; // +-20 %
  return Math.round(base * jitter);
}

export type Verdict =
  | 'retry'          // transient (network, rate limit, 5xx): nonce not used, back off and try again until the close
  | 'sponsor_down'   // fee payer balance low or budget exhausted: wait 60 s, never ask the player to pay
  | 'done_elsewhere' // ALREADY_DONE: the same choice is already on chain
  | 'pause_key'      // PLAY_KEY_INVALID: run the play key lifecycle, the item waits
  | 'uncertain'      // BROADCAST_UNCERTAIN: maybe broadcast, poll before anything else
  | 'fail'           // non retryable: the card returns while the market is open
  | 'frozen';        // FROZEN: stop, drop held and queued picks, open Account on hold

const RETRY = new Set(['NETWORK', 'BAD_RESPONSE', 'RATE_LIMITED_SENDER', 'RATE_LIMITED_USER', 'RATE_LIMITED_IP', 'RATE_LIMITED_BURST', 'TIMEOUT']);

export function classify(code: string, status = 0): Verdict {
  if (code === 'ALREADY_DONE') return 'done_elsewhere';
  if (code === 'PLAY_KEY_INVALID') return 'pause_key';
  if (code === 'BROADCAST_UNCERTAIN') return 'uncertain';
  if (code === 'FROZEN') return 'frozen';
  if (code === 'FEE_PAYER_BALANCE_LOW' || code === 'DAILY_BUDGET_EXHAUSTED') return 'sponsor_down';
  if (code === 'MARKET_CLOSED' || code === 'NOT_REGISTERED' || code === 'CHAIN_ID_MISMATCH') return 'fail';
  if (RETRY.has(code) || status >= 500 || status === 429 || /^HTTP_5/.test(code)) return 'retry';
  return 'fail'; // an unexpected revert or an unknown code (4.7)
}

/** 4.7: the "still being saved" banner shows after 3 failed attempts or 60 s, without stopping the retries. */
export function shouldSurface(attempts: number, firstFailAt: number | undefined, now: number): boolean {
  return attempts >= SURFACE_AFTER_ATTEMPTS || (!!firstFailAt && now - firstFailAt >= SURFACE_AFTER_MS);
}

/** 4.3.1: hold for the Undo window unless the market closes within 15 s. */
export function sendAfterFor(createdAt: number, closesAt: number): { sendAfter: number; held: boolean } {
  if (closesAt - createdAt <= CLOSE_GUARD_MS) return { sendAfter: createdAt, held: false };
  return { sendAfter: createdAt + UNDO_MS, held: true };
}
