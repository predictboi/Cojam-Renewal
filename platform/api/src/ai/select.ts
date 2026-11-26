// Selection of the day's 5 questions from accepted candidates (DEV-PLAN 6.4), a pure function.
// Rules: the category mix of the day (Crypto 2, Sports 1, Markets 1, Culture 1; Friday and Saturday
// swap Markets for Weather), the best quality first, no two questions that say nearly the same thing,
// and the 5 resolve times inside at most 2 time bands so per market settle needs about 2 keeper
// calls per player day. When a category has no accepted candidate, the slot is filled from the
// remaining candidates (never with a Markets question on a weekend set).

import type { Category } from './schemas.ts';
import { jaccard, marketsAllowedOnDay, titleTokens } from './validate.ts';

export interface Candidate {
  id: number; // market_drafts.id
  category: Category;
  titleEn: string;
  resolvesAt: number;
  quality: number; // validator qualityScore 0..1
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

function fits(chosen: Candidate[], c: Candidate): boolean {
  if (bandsOf([...chosen.map((x) => x.resolvesAt), c.resolvesAt]) > MAX_BANDS) return false;
  const tok = titleTokens(c.titleEn);
  return chosen.every((x) => jaccard(tok, titleTokens(x.titleEn)) < 0.6);
}

export function selectFive(cands: Candidate[], mix: Record<Category, number>, dayId: number): Candidate[] {
  const pool = [...cands]
    .filter((c) => c.category !== 'Markets' || marketsAllowedOnDay(dayId))
    .sort((a, b) => b.quality - a.quality || a.id - b.id);
  const chosen: Candidate[] = [];
  const used = new Set<number>();
  // Pass 1: the category mix.
  for (const [cat, n] of Object.entries(mix) as [Category, number][]) {
    let got = 0;
    for (const c of pool) {
      if (got >= n) break;
      if (c.category !== cat || used.has(c.id) || !fits(chosen, c)) continue;
      chosen.push(c);
      used.add(c.id);
      got++;
    }
  }
  // Pass 2: fill what is missing from anything that still fits.
  for (const c of pool) {
    if (chosen.length >= 5) break;
    if (used.has(c.id) || !fits(chosen, c)) continue;
    chosen.push(c);
    used.add(c.id);
  }
  return chosen.slice(0, 5);
}
