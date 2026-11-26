// Weekly airdrop: the winners list and the pool, as pure functions.
//
// The order is the one `PredictLogic.checkWinners` enforces on chain (contracts/docs/CojamPredict.md
// section 4 and section 10 item 19): ranked week points (higher first), then the earlier
// `lastCompletionAt` of the week (0, no completion that week, counts as the latest), then the lower
// address. Accounts on hold (frozen) are left out and the ranks below move up (DECISIONS
// "On hold: ranking"); the contract compares adjacent submitted winners only, so a list that skips a
// frozen account still verifies.

export const MAX_WINNERS = 10;
export const BPS = 10_000n;
export const CT_UNIT = 10n ** 18n;

export interface WeekScoreRow {
  wallet: string; // 0x address, any case
  points: bigint; // ranked points of the week (weekPoints[week][wallet].points)
  lastCompletionAt: number; // unix seconds, 0 = no completion that week
  registered: boolean;
  frozen: boolean;
}

export interface RankedRow extends WeekScoreRow {
  /** Place in the full ranking, counting accounts on hold (1 based). */
  place: number;
}

export interface WinnerRow extends RankedRow {
  /** Prize rank after accounts on hold were removed (1 based). */
  rank: number;
  amount: bigint; // CT base units
}

export interface SkippedRow extends RankedRow {
  reason: 'frozen' | 'not_registered';
  /** The prize rank the account would have had without the hold. */
  wouldBeRank: number;
}

const MAX_U = Number.MAX_SAFE_INTEGER;

/** True when `a` ranks strictly above `b`, exactly as `PredictLogic._ranksAbove`. */
export function ranksAbove(a: WeekScoreRow, b: WeekScoreRow): boolean {
  if (a.points !== b.points) return a.points > b.points;
  const at = a.lastCompletionAt === 0 ? MAX_U : a.lastCompletionAt;
  const bt = b.lastCompletionAt === 0 ? MAX_U : b.lastCompletionAt;
  if (at !== bt) return at < bt;
  return addressValue(a.wallet) < addressValue(b.wallet);
}

export function addressValue(addr: string): bigint {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error(`bad address ${addr}`);
  return BigInt(addr);
}

/** Comparator for Array.sort: negative when `a` ranks above `b`. */
export function compareRank(a: WeekScoreRow, b: WeekScoreRow): number {
  if (ranksAbove(a, b)) return -1;
  if (ranksAbove(b, a)) return 1;
  return 0; // only for the same address
}

/** Full ranking of everyone with ranked points, accounts on hold included (K1 and AD5 show it). */
export function rankWeek(rows: WeekScoreRow[]): RankedRow[] {
  const seen = new Set<string>();
  const list: WeekScoreRow[] = [];
  for (const r of rows) {
    const k = r.wallet.toLowerCase();
    if (seen.has(k)) throw new Error(`duplicate wallet in week scores: ${r.wallet}`);
    seen.add(k);
    if (r.points > 0n) list.push(r);
  }
  list.sort(compareRank);
  return list.map((r, i) => ({ ...r, place: i + 1 }));
}

/**
 * Splits the pool by `splitBps` (rounded down per rank, as on chain) over at most 10 eligible
 * players. Unpaid ranks stay in the reserve.
 */
export function buildWinners(
  rows: WeekScoreRow[],
  pool: bigint,
  splitBps: readonly number[],
): { winners: WinnerRow[]; skipped: SkippedRow[]; total: bigint } {
  if (splitBps.length !== MAX_WINNERS) throw new Error('splitBps must have 10 entries');
  const ranked = rankWeek(rows);
  const winners: WinnerRow[] = [];
  const skipped: SkippedRow[] = [];
  let total = 0n;
  for (const r of ranked) {
    if (winners.length >= MAX_WINNERS) break;
    if (!r.registered || r.frozen) {
      skipped.push({ ...r, reason: r.registered ? 'frozen' : 'not_registered', wouldBeRank: winners.length + 1 });
      continue;
    }
    const rank = winners.length + 1;
    const amount = (pool * BigInt(splitBps[rank - 1])) / BPS;
    total += amount;
    winners.push({ ...r, rank, amount });
  }
  return { winners, skipped, total };
}

/** Throws unless `winners` would pass `PredictLogic.checkWinners` (order, eligibility, points). */
export function assertContractOrder(winners: WeekScoreRow[]): void {
  if (winners.length === 0 || winners.length > MAX_WINNERS) throw new Error('BadWinners: 1 to 10 winners');
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    if (!w.registered) throw new Error(`NotRegistered: ${w.wallet}`);
    if (w.frozen) throw new Error(`Frozen: ${w.wallet}`);
    if (w.points === 0n) throw new Error(`BadWinners: no points ${w.wallet}`);
    if (i > 0 && !ranksAbove(winners[i - 1], w)) throw new Error(`BadWinners: order at ${i}`);
  }
}

export interface QualifyInput {
  wallet: string;
  registered: boolean;
  frozen: boolean;
  registeredAt: number; // unix seconds
  daysPlayed: number; // days of the week with at least one prediction
}

export interface PoolRules {
  perPlayerCt: bigint; // CT base units per qualified player (server setting, 1 CT)
  serverCapCt: bigint; // CT base units (server cap, 10,000 CT)
  chainMaxWeeklyPoolWholeCt: bigint; // params.maxWeeklyPool, whole CT
  minDaysPlayed: number; // 3
  minAccountAgeSec: number; // 7 days
}

export const DEFAULT_POOL_RULES: PoolRules = {
  perPlayerCt: CT_UNIT,
  serverCapCt: 10_000n * CT_UNIT,
  chainMaxWeeklyPoolWholeCt: 10_000n,
  minDaysPlayed: 3,
  minAccountAgeSec: 7 * 86400,
};

/**
 * Qualified players (REVIEW B7): registered, not frozen, played 3 or more days of the week, account
 * older than 7 days at the week's end. Pool = qualified x 1 CT, capped by the server cap and the on
 * chain `maxWeeklyPool`.
 */
export function computePool(players: QualifyInput[], weekEndTs: number, rules: PoolRules = DEFAULT_POOL_RULES) {
  let qualified = 0;
  for (const p of players) {
    if (!p.registered || p.frozen) continue;
    if (p.daysPlayed < rules.minDaysPlayed) continue;
    if (weekEndTs - p.registeredAt < rules.minAccountAgeSec) continue;
    qualified++;
  }
  const raw = BigInt(qualified) * rules.perPlayerCt;
  const chainCap = rules.chainMaxWeeklyPoolWholeCt * CT_UNIT;
  let pool = raw;
  if (pool > rules.serverCapCt) pool = rules.serverCapCt;
  if (pool > chainCap) pool = chainCap;
  return { qualified, pool, capped: pool < raw };
}
