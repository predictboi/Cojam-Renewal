// Time rules shared by the PWA, the admin, the API and the worker.
// They mirror CojamPredict exactly (contracts/contracts/platform/CojamPredict.sol and PredictLogic.sol):
//   dayId    = floor(unix / 86400)          day d opens at d * 86400 = 00:00 UTC = 09:00 KST / JST
//   dayEnd   = (dayId + 1) * 86400          every market of the day closes here (DECISIONS "Question timing")
//   weekOf   = floor((dayId + 3) / 7)       weeks run Monday 00:00 UTC (Monday 09:00 KST) to the next Monday
//   weekEnd  = (weekId * 7 + 4) * 86400     the next Monday 00:00 UTC
//   marketId = dayId * 5 + slot             slot 0..4
// All timestamps are unix seconds (number). Inputs also accept bigint so viem results can be passed in directly.

export const SECONDS_PER_DAY = 86_400;
export const SLOTS = 5;
/** KST and JST are UTC+9 all year (no daylight saving). */
export const KST_OFFSET_SECONDS = 9 * 3_600;
/** `setOutcome` must happen before dayEnd + 48 h, after that anyone may `voidExpired`. */
export const RESOLVE_DEADLINE_SECONDS = 48 * 3_600;
/** `resolvesAt` must be at most open + 2 days (24 h after the common close). */
export const MAX_RESOLVE_AFTER_OPEN_SECONDS = 2 * SECONDS_PER_DAY;
/** A play key binding may last at most 90 days. */
export const MAX_PLAY_KEY_TTL_SECONDS = 90 * SECONDS_PER_DAY;
/** `setReferrer` works only within 24 h of registration. */
export const INVITE_WINDOW_SECONDS = 24 * 3_600;

type Int = number | bigint;

function toInt(x: Int, what: string): number {
  const n = typeof x === "bigint" ? Number(x) : x;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new RangeError(`${what} must be a non negative integer, got ${String(x)}`);
  return n;
}

/** Current unix time in seconds. */
export function nowSeconds(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000);
}

/** Day number of a unix timestamp (contract `currentDay()` at that time). */
export function dayIdOf(unix: Int): number {
  return Math.floor(toInt(unix, "unix") / SECONDS_PER_DAY);
}

/** Day number of now. */
export function currentDayId(nowMs: number = Date.now()): number {
  return dayIdOf(nowSeconds(nowMs));
}

/** When day `dayId` opens (00:00 UTC = 09:00 KST). */
export function dayOpensAt(dayId: Int): number {
  return toInt(dayId, "dayId") * SECONDS_PER_DAY;
}

/** When day `dayId` ends: every market of the day closes here (the next day's open). */
export function dayEnd(dayId: Int): number {
  return (toInt(dayId, "dayId") + 1) * SECONDS_PER_DAY;
}

/** Last moment `setOutcome` is accepted is strictly before this; from here `voidExpired` works. */
export function resolveDeadline(dayId: Int): number {
  return dayEnd(dayId) + RESOLVE_DEADLINE_SECONDS;
}

/** Week of a day (contract `weekOf`). */
export function weekOf(dayId: Int): number {
  return Math.floor((toInt(dayId, "dayId") + 3) / 7);
}

/** First day of a week (a Monday). */
export function weekFirstDay(weekId: Int): number {
  const w = toInt(weekId, "weekId");
  if (w === 0) return 0; // week 0 is the partial week Thursday 1970-01-01 to Sunday 1970-01-04
  return w * 7 - 3;
}

/** Timestamp at which the week starts (Monday 00:00 UTC; 0 for week 0). */
export function weekStart(weekId: Int): number {
  return weekFirstDay(weekId) * SECONDS_PER_DAY;
}

/** Timestamp at which the week ends (contract `weekEnd`): the next Monday 00:00 UTC. */
export function weekEnd(weekId: Int): number {
  return (toInt(weekId, "weekId") * 7 + 4) * SECONDS_PER_DAY;
}

/** Earliest time the operator may send the week's airdrop (`weekEnd + airdropDelay`, default 60 h). */
export function airdropOpensAt(weekId: Int, airdropDelaySeconds: Int = 60 * 3_600): number {
  return weekEnd(weekId) + toInt(airdropDelaySeconds, "airdropDelay");
}

/** Market id of a slot (0..4) on a day. */
export function marketId(dayId: Int, slot: Int): number {
  const s = toInt(slot, "slot");
  if (s >= SLOTS) throw new RangeError(`slot must be 0..4, got ${s}`);
  return toInt(dayId, "dayId") * SLOTS + s;
}

/** The five market ids of a day. */
export function marketIdsOfDay(dayId: Int): number[] {
  return Array.from({ length: SLOTS }, (_, s) => marketId(dayId, s));
}

/** Day of a market id. */
export function dayOfMarket(id: Int): number {
  return Math.floor(toInt(id, "marketId") / SLOTS);
}

/** Slot (0..4) of a market id. */
export function slotOfMarket(id: Int): number {
  return toInt(id, "marketId") % SLOTS;
}

/** True while the day is open for answers at `unix`. */
export function isDayOpen(dayId: Int, unix: Int = nowSeconds()): boolean {
  const t = toInt(unix, "unix");
  return t >= dayOpensAt(dayId) && t < dayEnd(dayId);
}

/** Seconds left until the day closes (0 once closed). */
export function secondsUntilDayEnd(dayId: Int, unix: Int = nowSeconds()): number {
  return Math.max(0, dayEnd(dayId) - toInt(unix, "unix"));
}

/** `createDay` must be mined strictly before the day opens. */
/** `createDay` refuses a day with less than this left before its end (late creation rule). */
export const LATE_CREATE_MARGIN_SECONDS = 3_600;

/**
 * `createDay` is accepted before the day opens, or late after it opened while at least 1 hour remains before
 * its end (`unix + 1 h <= dayEnd`, PredictLogic.createDay); never for a past day.
 */
export function canCreateDay(dayId: Int, unix: Int = nowSeconds()): boolean {
  return toInt(unix, "unix") + LATE_CREATE_MARGIN_SECONDS <= dayEnd(dayId);
}

/** True when a `createDay` at `unix` would be a late creation (the day is already open). */
export function isLateCreation(dayId: Int, unix: Int = nowSeconds()): boolean {
  return toInt(unix, "unix") >= dayOpensAt(dayId) && canCreateDay(dayId, unix);
}

// ---------- KST display helpers ----------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Calendar parts of a unix time in KST. */
export function kstParts(unix: Int): { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number } {
  const d = new Date((toInt(unix, "unix") + KST_OFFSET_SECONDS) * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(), // 0 Sunday .. 6 Saturday
  };
}

/** "YYYY-MM-DD" of a unix time in KST. */
export function kstDate(unix: Int): string {
  const p = kstParts(unix);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM-DD HH:mm" of a unix time in KST (no suffix; callers add "KST" in copy). */
export function kstDateTime(unix: Int): string {
  const p = kstParts(unix);
  return `${kstDate(unix)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The KST calendar date a game day is named after: day d runs 09:00 KST on that date to 09:00 KST the next date.
 * Since 00:00 UTC is 09:00 KST on the same date, this is also the UTC date of the open.
 */
export function dayLabelKst(dayId: Int): string {
  return kstDate(dayOpensAt(dayId));
}

/** Inverse of dayLabelKst: the dayId whose open is 09:00 KST on "YYYY-MM-DD". */
export function dayIdFromKstDate(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`expected YYYY-MM-DD, got ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(ms / 1000 / SECONDS_PER_DAY);
}

// ---------- Absolute date phrases of question texts ----------
// Question texts never say "tomorrow" (a past question shown days later on the Results screen would read wrong):
// they name the KST date with its weekday in each language's natural form.

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const JA_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export interface KstDateLabels {
  /** "Sun, Nov 29" */
  en: string;
  /** "11월 29일(일)" */
  ko: string;
  /** "11月29日(日)" */
  ja: string;
}

/** The KST calendar date of a unix time written as question texts write it, in EN, KO and JA. */
export function kstDateLabels(unix: Int): KstDateLabels {
  const p = kstParts(unix);
  return {
    en: `${EN_WEEKDAYS[p.weekday]}, ${EN_MONTHS[p.month - 1]} ${p.day}`,
    ko: `${p.month}월 ${p.day}일(${KO_WEEKDAYS[p.weekday]})`,
    ja: `${p.month}月${p.day}日(${JA_WEEKDAYS[p.weekday]})`,
  };
}

/**
 * The settle date of a set: the KST date of the day after the set opens, when every outcome of the set falls
 * (the set closes at 09:00 KST on that date).
 */
export function settleDateLabels(dayId: Int): KstDateLabels {
  return kstDateLabels(dayEnd(dayId));
}
