import { describe, expect, it } from 'vitest';
import { backoffMs, classify, nextNonce, sendAfterFor, shouldSurface, UNDO_MS } from '../src/chain/outbox/policy';

describe('nonce rules (DEV-PLAN 4.3 step 2, 4.4)', () => {
  it('a fresh key starts at its pending count', () => { expect(nextNonce(0, undefined)).toBe(0); expect(nextNonce(3, undefined)).toBe(3); });
  it('takes the higher of the pending count and the last used nonce + 1', () => {
    expect(nextNonce(2, 4)).toBe(5);  // node has not seen the last sends yet
    expect(nextNonce(7, 4)).toBe(7);  // another device or a resend moved the account
  });
  it('reuses a nonce the server refused before broadcast (lastUsed only moves on 200)', () => {
    // n was refused: lastUsed stays n - 1, pending stays n
    expect(nextNonce(5, 4)).toBe(5);
  });
});

describe('retry policy (4.7)', () => {
  it('backs off 1, 2, 4, 8, 16, 30 s then every 30 s, with +-20 % jitter', () => {
    const mid = () => 0.5;
    expect([1, 2, 3, 4, 5, 6, 7, 12].map((a) => backoffMs(a, mid))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(backoffMs(1, () => 0)).toBe(800);
    expect(backoffMs(1, () => 1)).toBe(1200);
  });
  it('classifies the server codes', () => {
    expect(classify('ALREADY_DONE')).toBe('done_elsewhere');
    expect(classify('PLAY_KEY_INVALID')).toBe('pause_key');
    expect(classify('BROADCAST_UNCERTAIN')).toBe('uncertain');
    expect(classify('FROZEN')).toBe('frozen');
    expect(classify('FEE_PAYER_BALANCE_LOW')).toBe('sponsor_down');
    expect(classify('DAILY_BUDGET_EXHAUSTED')).toBe('sponsor_down');
    for (const c of ['MARKET_CLOSED', 'NOT_REGISTERED', 'CHAIN_ID_MISMATCH']) expect(classify(c)).toBe('fail');
    for (const c of ['NETWORK', 'RATE_LIMITED_BURST', 'RATE_LIMITED_IP']) expect(classify(c)).toBe('retry');
    expect(classify('HTTP_502', 502)).toBe('retry');
    expect(classify('SOMETHING_NEW', 400)).toBe('fail');
  });
  it('surfaces after 3 attempts or 60 s', () => {
    expect(shouldSurface(2, 1000, 30_000)).toBe(false);
    expect(shouldSurface(3, 1000, 2000)).toBe(true);
    expect(shouldSurface(1, 1000, 61_000)).toBe(true);
  });
  it('holds for the Undo window unless the market closes within 15 s', () => {
    expect(sendAfterFor(1000, 1000 + 60_000)).toEqual({ sendAfter: 1000 + UNDO_MS, held: true });
    expect(sendAfterFor(1000, 1000 + 10_000)).toEqual({ sendAfter: 1000, held: false });
  });
});
