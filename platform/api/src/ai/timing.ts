// Timing parameters of a day's set (DECISIONS "Longer questions mixed in"): at least `minShort` of the 5 are answered
// within 24 h of the close, at most `maxLong` are long ones answered up to `longMaxDays` after it. Admin parameters
// stored in app_state "draft.timing" (POST /admin/v1/draft-timing, owner); the shared constants are the defaults.
//
// Long questions need the contract with a per market answer deadline. Until it is deployed the worker runs with
// LONG_QUESTIONS_ON_CHAIN unset, and then no long question is drafted or accepted whatever the parameters say
// (the deployed contract refuses a resolve time more than 2 days after the open, so createDay would fail).
import type { Kysely } from 'kysely';
import type { Database } from '../db/index.ts';
import { LONG_MAX_DAYS_AFTER_CLOSE, MAX_LONG_PER_DAY, MIN_SHORT_PER_DAY } from '../../../shared/src/time.ts';

export const DRAFT_TIMING_KEY = 'draft.timing';

export interface DraftTiming {
  minShort: number;
  maxLong: number;
  longMaxDays: number;
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
    longMaxDays: int(v.longMaxDays, 1, 60, DEFAULT_TIMING.longMaxDays),
  };
}

/** What the drafter applies: the long allowance is min(maxLong, 5 - minShort), and 0 until the contract allows long questions. */
export function effectiveTiming(t: DraftTiming, longOnChain: boolean): { maxLong: number; longMaxDays: number } {
  const maxLong = longOnChain ? Math.max(0, Math.min(t.maxLong, 5 - t.minShort)) : 0;
  return { maxLong, longMaxDays: maxLong > 0 ? t.longMaxDays : 0 };
}
