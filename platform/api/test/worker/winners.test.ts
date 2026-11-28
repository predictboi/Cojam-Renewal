import { describe, expect, it } from 'vitest';
import { assertContractOrder, buildWinners, computePool, CT_UNIT, rankWeek, ranksAbove, type WeekScoreRow } from '../../src/jobs/winners.ts';

const SPLIT = [3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300];
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const row = (n: number, points: number, last: number, extra: Partial<WeekScoreRow> = {}): WeekScoreRow => ({
  wallet: addr(n),
  points: BigInt(points),
  lastCompletionAt: last,
  registered: true,
  frozen: false,
  ...extra,
});

describe('tie break (PredictLogic._ranksAbove)', () => {
  it('orders by points first', () => {
    expect(ranksAbove(row(9, 700, 500), row(1, 650, 100))).toBe(true);
  });
  it('then by the earlier last completion', () => {
    expect(ranksAbove(row(9, 700, 100), row(1, 700, 200))).toBe(true);
    expect(ranksAbove(row(1, 700, 200), row(9, 700, 100))).toBe(false);
  });
  it('treats 0 (no completion that week) as the latest', () => {
    expect(ranksAbove(row(1, 700, 0), row(9, 700, 999_999_999))).toBe(false);
    expect(ranksAbove(row(9, 700, 999_999_999), row(1, 700, 0))).toBe(true);
  });
  it('then by the lower address, compared as numbers whatever the case', () => {
    const a = { ...row(0, 700, 100), wallet: '0x00000000000000000000000000000000000000AB' };
    const b = { ...row(0, 700, 100), wallet: '0x00000000000000000000000000000000000000ac' };
    expect(ranksAbove(a, b)).toBe(true);
    expect(ranksAbove(b, a)).toBe(false);
  });
  it('is a strict order (never both ways, never for the same row)', () => {
    const r = row(5, 100, 10);
    expect(ranksAbove(r, r)).toBe(false);
  });
});

describe('buildWinners', () => {
  it('pays 10 ranks with the split, rounded down per rank', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, 1000 - i * 10, 100 + i));
    const pool = 1131n * CT_UNIT;
    const { winners, total } = buildWinners(rows, pool, SPLIT);
    expect(winners).toHaveLength(10);
    expect(winners[0].amount).toBe((pool * 3000n) / 10000n);
    expect(total).toBe(winners.reduce((s, w) => s + w.amount, 0n));
    expect(total <= pool).toBe(true);
    assertContractOrder(winners);
  });

  it('skips accounts on hold and moves the ranks below up', () => {
    const rows = [row(1, 900, 100), row(2, 850, 100, { frozen: true }), row(3, 800, 100), row(4, 800, 50)];
    const { winners, skipped } = buildWinners(rows, 100n * CT_UNIT, SPLIT);
    expect(winners.map((w) => w.wallet)).toEqual([addr(1), addr(4), addr(3)]);
    expect(winners.map((w) => w.rank)).toEqual([1, 2, 3]);
    expect(skipped).toEqual([expect.objectContaining({ wallet: addr(2), reason: 'frozen', wouldBeRank: 2, place: 2 })]);
    // The contract compares adjacent submitted winners only, so the list without the frozen one verifies.
    assertContractOrder(winners);
  });

  it('leaves unpaid ranks in the reserve with fewer than 10 players', () => {
    const { winners, total } = buildWinners([row(1, 50, 1), row(2, 0, 1)], 1000n * CT_UNIT, SPLIT);
    expect(winners).toHaveLength(1); // zero points never rank
    expect(total).toBe(300n * CT_UNIT);
  });

  it('refuses duplicate wallets', () => {
    expect(() => rankWeek([row(1, 10, 1), { ...row(1, 20, 1), wallet: addr(1).toUpperCase().replace('0X', '0x') }])).toThrow(/duplicate/);
  });

  it('assertContractOrder catches the reverts of checkWinners', () => {
    expect(() => assertContractOrder([row(1, 10, 1), row(2, 20, 1)])).toThrow(/order/);
    expect(() => assertContractOrder([row(1, 10, 1, { frozen: true })])).toThrow(/Frozen/);
    expect(() => assertContractOrder([])).toThrow(/BadWinners/);
  });

  it('matches a brute force sort on random inputs', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 50; t++) {
      const rows = Array.from({ length: 30 }, (_, i) => row(Math.floor(rnd() * 1e9) * 64 + i, Math.floor(rnd() * 5) * 50, rnd() < 0.2 ? 0 : 1000 + Math.floor(rnd() * 5), { frozen: rnd() < 0.15 }));
      const ranked = rankWeek(rows);
      for (let i = 1; i < ranked.length; i++) expect(ranksAbove(ranked[i - 1], ranked[i])).toBe(true);
      const { winners } = buildWinners(rows, 500n * CT_UNIT, SPLIT);
      if (winners.length) assertContractOrder(winners);
    }
  });
});

describe('computePool', () => {
  const weekEnd = 2_000_000_000;
  const p = (o: Partial<{ registered: boolean; frozen: boolean; registeredAt: number; daysPlayed: number }>) => ({
    wallet: addr(1),
    registered: true,
    frozen: false,
    registeredAt: weekEnd - 30 * 86400,
    daysPlayed: 3,
    ...o,
  });
  it('counts qualified players only, 1 CT each', () => {
    const r = computePool([p({}), p({ daysPlayed: 2 }), p({ frozen: true }), p({ registeredAt: weekEnd - 6 * 86400 }), p({ registered: false }), p({ daysPlayed: 7 })], weekEnd);
    expect(r.qualified).toBe(2);
    expect(r.pool).toBe(2n * CT_UNIT);
    expect(r.capped).toBe(false);
  });
  it('caps at 10,000 CT and at the on chain maxWeeklyPool', () => {
    const many = Array.from({ length: 12_000 }, () => p({}));
    expect(computePool(many, weekEnd).pool).toBe(10_000n * CT_UNIT);
    const r = computePool(many, weekEnd, { perPlayerCt: CT_UNIT, serverCapCt: 10_000n * CT_UNIT, chainMaxWeeklyPoolWholeCt: 5_000n, minDaysPlayed: 3, minAccountAgeSec: 7 * 86400 });
    expect(r.pool).toBe(5_000n * CT_UNIT);
    expect(r.capped).toBe(true);
  });
});
