// Selection of the day's 5 questions from accepted candidates (DEV-PLAN 6.4), a pure function.
// Rules: the category mix of the day (Crypto 2, Sports 1, Markets 1, Culture 1; Friday and Saturday
// swap Markets for Weather), the best quality first, no two questions that say nearly the same thing,
// and the 5 resolve times inside at most 2 time bands so per market settle needs about 2 keeper
// calls per player day. When a category has no accepted candidate, the slot is filled from the
// remaining candidates (never with a Markets question on a weekend set).

import { dayEnd, MAX_LONG_PER_DAY, SHORT_ANSWER_WINDOW_SECONDS } from '../../../shared/src/time.ts';
import type { Category } from './schemas.ts';
import { jaccard, marketsAllowedOnDay, titleTokens } from './validate.ts';

export interface Candidate {
  id: number; // market_drafts.id
  category: Category;
  titleEn: string;
  resolvesAt: number;
  quality: number; // validator qualityScore 0..1
  /** Mirrors an outside market (Polymarket): preferred over our own question of the same category. */
  linked?: boolean;
}

export interface SelectOptions {
  /** At most this many long questions (answered more than 24 h after the close); default MAX_LONG_PER_DAY. */
  maxLong?: number;
}

/** True when the candidate is a long question of `dayId`. */
export function isLong(c: Pick<Candidate, 'resolvesAt'>, dayId: number): boolean {
  return c.resolvesAt > dayEnd(dayId) + SHORT_ANSWER_WINDOW_SECONDS;
}

/** Resolve times closer than this belong to one band. */
export const BAND_WIDTH_SEC = 4 * 3600;
export const MAX_BANDS = 2;

export function bandsOf(times: number[]): number {
  const s = [...times].sort((a, b) => a - b);
  let bands = 0;
  let start = -Infinity;
  for (const t of s) {
    if (t - start > BAND_WIDTH_SEC) {
      bands++;
      start = t;
    }
  }
  return bands;
}

function fits(chosen: Candidate[], c: Candidate, dayId: number, maxLong: number): boolean {
  if (isLong(c, dayId)) {
    // Long questions settle on their own dates: they count against maxLong, not against the bands of the next day.
    if (chosen.filter((x) => isLong(x, dayId)).length >= maxLong) return false;
  } else if (bandsOf([...chosen.filter((x) => !isLong(x, dayId)).map((x) => x.resolvesAt), c.resolvesAt]) > MAX_BANDS) return false;
  const tok = titleTokens(c.titleEn);
  return chosen.every((x) => jaccard(tok, titleTokens(x.titleEn)) < 0.6);
}

/** True when `c` can join `chosen` (bands of the short questions, the long allowance, no near duplicate title). */
export function fitsWith(chosen: Candidate[], c: Candidate, dayId: number, maxLong = MAX_LONG_PER_DAY): boolean {
  return fits(chosen, c, dayId, maxLong);
}

export function selectFive(cands: Candidate[], mix: Record<Category, number>, dayId: number, opts: SelectOptions = {}): Candidate[] {
  const maxLong = Math.max(0, opts.maxLong ?? MAX_LONG_PER_DAY);
  // A linked (Polymarket mirrored) candidate ranks above any own candidate of the same category.
  const score = (c: Candidate) => c.quality + (c.linked ? 1 : 0);
  const pool = [...cands]
    .filter((c) => c.category !== 'Markets' || marketsAllowedOnDay(dayId))
    .sort((a, b) => score(b) - score(a) || a.id - b.id);
  const chosen: Candidate[] = [];
  const used = new Set<number>();
  // Pass 1: the category mix.
  for (const [cat, n] of Object.entries(mix) as [Category, number][]) {
    let got = 0;
    for (const c of pool) {
      if (got >= n) break;
      if (c.category !== cat || used.has(c.id) || !fits(chosen, c, dayId, maxLong)) continue;
      chosen.push(c);
      used.add(c.id);
      got++;
    }
  }
  // Pass 2: fill what is missing from anything that still fits.
  for (const c of pool) {
    if (chosen.length >= 5) break;
    if (used.has(c.id) || !fits(chosen, c, dayId, maxLong)) continue;
    chosen.push(c);
    used.add(c.id);
  }
  return chosen.slice(0, 5);
}
