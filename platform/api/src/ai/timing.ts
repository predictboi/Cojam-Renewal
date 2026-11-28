// Timing parameters of a day's set (DECISIONS "Longer questions mixed in"): at least `minShort` of the 5 are answered
// within 24 h of the close, at most `maxLong` are long ones answered up to `longMaxDays` after it. Admin parameters
// stored in app_state "draft.timing" (POST /admin/v1/draft-timing, owner); the shared constants are the defaults.
//
// The contract bounds every answer time by its parameter `maxResolveAfterClose` (default 30 days, bounds 1 to 90
// days): `longMaxDays` is capped by the value read from CojamPredict `params()`, so a stored wish above it never
// produces a question that createDay would refuse. Long questions also need LONG_QUESTIONS_ON_CHAIN (worker and
// API), the switch that says the deployed CojamPredict carries per market answer deadlines; while it is unset no
// long question is drafted or accepted whatever the parameters say.
import type { Kysely } from 'kysely';
import type { Database } from '../db/index.ts';
import { LONG_MAX_DAYS_AFTER_CLOSE, MAX_LONG_PER_DAY, MAX_RESOLVE_AFTER_CLOSE_MAX_SECONDS, MIN_SHORT_PER_DAY, SECONDS_PER_DAY } from '../../../shared/src/time.ts';

export const DRAFT_TIMING_KEY = 'draft.timing';

/** Highest `longMaxDays` the admin may store: the contract's upper bound for `maxResolveAfterClose` (90 days). */
export const LONG_MAX_DAYS_LIMIT = MAX_RESOLVE_AFTER_CLOSE_MAX_SECONDS / SECONDS_PER_DAY;

export interface DraftTiming {
  minShort: number;
  maxLong: number;
  longMaxDays: number;
}

export interface EffectiveTiming {
  maxLong: number;
  longMaxDays: number;
  /** Whole days of the on chain maxResolveAfterClose used as the cap (null when it was not known). */
  chainMaxDays: number | null;
}

export const DEFAULT_TIMING: DraftTiming = { minShort: MIN_SHORT_PER_DAY, maxLong: MAX_LONG_PER_DAY, longMaxDays: LONG_MAX_DAYS_AFTER_CLOSE };

const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : d);

/** The stored parameters merged with the defaults (no gate applied). */
export async function storedTiming(db: Kysely<Database>): Promise<DraftTiming> {
  const row = await db.selectFrom('app_state').select('value').where('key', '=', DRAFT_TIMING_KEY).executeTakeFirst().catch(() => undefined);
  const v = (row?.value ?? {}) as Partial<DraftTiming>;
  return {
    minShort: int(v.minShort, 0, 5, DEFAULT_TIMING.minShort),
    maxLong: int(v.maxLong, 0, 5, DEFAULT_TIMING.maxLong),
    longMaxDays: int(v.longMaxDays, 1, LONG_MAX_DAYS_LIMIT, DEFAULT_TIMING.longMaxDays),
  };
}

/**
 * What the drafter applies: the long allowance is min(maxLong, 5 - minShort), and 0 until the contract allows long
 * questions. `longMaxDays` is capped by the on chain `maxResolveAfterClose` (seconds, whole days counted) when given;
 * a value below one day leaves no room for a long question at all.
 */
export function effectiveTiming(t: DraftTiming, longOnChain: boolean, maxResolveAfterCloseSec?: number | null): EffectiveTiming {
  const chainMaxDays = typeof maxResolveAfterCloseSec === 'number' && Number.isFinite(maxResolveAfterCloseSec) ? Math.floor(maxResolveAfterCloseSec / SECONDS_PER_DAY) : null;
  const days = chainMaxDays === null ? t.longMaxDays : Math.min(t.longMaxDays, chainMaxDays);
  // A long question is answered more than 24 h after the close, so a cap of 1 day leaves no long question.
  const maxLong = longOnChain && days > 1 ? Math.max(0, Math.min(t.maxLong, 5 - t.minShort)) : 0;
  return { maxLong, longMaxDays: maxLong > 0 ? days : 0, chainMaxDays };
}
