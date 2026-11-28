// Code checks of a drafted question (DEV-PLAN 6.4, DECISIONS "Question timing" and "Question content
// languages"). The fresh context AI validation covers meaning and voice; these checks are the hard
// rules a model must never be trusted with: times against the contract, the text limits of every
// language, the weekend rule, sources, banned topics, matching numbers across languages, the house
// punctuation rule, absolute dates (no relative day words) and duplicates.

import { dayEnd, dayOpensAt, kstDate, kstDateLabels, kstParts, MAX_RESOLVE_AFTER_OPEN_SECONDS, SECONDS_PER_DAY, SHORT_ANSWER_WINDOW_SECONDS } from '../../../shared/src/time.ts';
import { LANGS, type Category, type Draft, type Lang } from './schemas.ts';
import type { OutsideMarket } from '../dataRoom/polymarket.ts';

export interface TextLimits {
  title: number;
  choice: number;
  rule: number;
  settle: number;
}

/**
 * DEV-PLAN 6.4 and SCREEN-SPEC AD3: EN title 70, choice 12, rule 60; KO and JA 40, 8, 40. Titles and settle phrases
 * name an absolute date with its weekday ("11월 29일(일) 오후 9시" instead of "내일 오후 9시"), so the KO and JA
 * title limit was raised from 40 to 44 and their settle limit from 16 to 22.
 */
export const TEXT_LIMITS: Record<Lang, TextLimits> = {
  en: { title: 70, choice: 12, rule: 60, settle: 28 },
  ko: { title: 44, choice: 8, rule: 40, settle: 22 },
  ja: { title: 44, choice: 8, rule: 40, settle: 22 },
};

export const MIN_PROBABILITY = 0.25;
export const MAX_PROBABILITY = 0.75;
/** Discrete events: the event starts at least this long after the day's close. */
export const DISCRETE_MIN_GAP_SEC = 10 * 60;
/** Continuous values: observed at least 12 h after the close, or answered at least 12 h after it. */
export const CONTINUOUS_MIN_GAP_SEC = 12 * 3600;

export interface CheckContext {
  dayId: number; // the day the question is drafted for
  minResolveGapSec: number; // params.minResolveGap (1 h default)
  recent?: RecentQuestion[]; // published or scheduled questions of the last 30 days
  /**
   * Long questions (DECISIONS "Longer questions mixed in"): answered up to this many days after the close.
   * 0 or absent: only short questions (answered within 24 h of the close) pass.
   */
  longMaxDays?: number;
  /**
   * CojamPredict `maxResolveAfterClose` in seconds: the contract refuses any resolvesAt later than close plus this,
   * so it bounds every question whatever longMaxDays says. Absent: not checked here (the caller capped longMaxDays).
   */
  maxResolveAfterCloseSec?: number;
}

export interface RecentQuestion {
  titleEn: string;
  primaryUrl: string;
  observesAt: number; // unix seconds
}

export interface CodeCheckResult {
  ok: boolean;
  errors: string[];
  /** Parsed times, present when they parse. */
  times?: { closesAt: number; observesAt: number; resolvesAt: number };
}

/** Length as a reader counts it: code points (Korean syllables and kana count as one each). */
export function textLength(s: string): number {
  return Array.from(s.normalize('NFC')).length;
}

/** House rule: no dash as a sentence break (" - ", " – ", " — ") and no em dash at all. */
export function hasDashBreak(s: string): boolean {
  return /\s[-–—]\s/.test(s) || /—/.test(s);
}

/**
 * Relative day words a title or settle phrase must never use: a question is shown again on the Results screen days
 * later, where "tomorrow" would be wrong. English is matched on word boundaries.
 */
const RELATIVE_DAY_WORDS: RegExp[] = [
  /\b(tomorrow|tonight|today|yesterday|this evening|next week)\b/i,
  /(내일|모레|오늘|어제)/,
  /(明後日|明日|今日|今夜|昨日|あした|あさって)/,
];

/** The first relative day word in a text ("tomorrow", "내일", "明日", ...), or null. */
export function relativeDayWord(s: string): string | null {
  const t = s.normalize('NFKC');
  for (const re of RELATIVE_DAY_WORDS) {
    const m = re.exec(t);
    if (m) return m[1];
  }
  return null;
}

export interface StatedDate {
  month: number; // 1..12
  day: number; // 1..31
  /** 0 Sunday .. 6 Saturday, when the text gives the weekday. */
  weekday: number | null;
  text: string;
}

const EN_MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const EN_WEEKDAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\\.?';
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const EN_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const KO_WEEKDAYS = '일월화수목금토';
const JA_WEEKDAYS = '日月火水木金土';

/** English "Sun, Nov 29" (weekday optional). */
export const EN_DATE_RE = new RegExp(`\\b(?:${EN_WEEKDAY_RE},?\\s+)?${EN_MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi');

/** Dates a text states: EN "Sun, Nov 29", KO "11월 29일(일)", JA "11月29日(日)" (weekdays optional). */
export function statedDates(lang: Lang, s: string): StatedDate[] {
  const t = s.normalize('NFKC');
  const out: StatedDate[] = [];
  if (lang === 'en') {
    for (const m of t.matchAll(EN_DATE_RE)) {
      out.push({ month: EN_MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, day: Number(m[3]), weekday: m[1] ? EN_WEEKDAYS.indexOf(m[1].slice(0, 3).toLowerCase()) : null, text: m[0] });
    }
  } else {
    const re = lang === 'ko' ? /(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\(\s*([일월화수목금토])\s*\))?/g : /(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*\(\s*([日月火水木金土])\s*\))?/g;
    const wds = lang === 'ko' ? KO_WEEKDAYS : JA_WEEKDAYS;
    for (const m of t.matchAll(re)) out.push({ month: Number(m[1]), day: Number(m[2]), weekday: m[3] ? wds.indexOf(m[3]) : null, text: m[0] });
  }
  return out;
}

/**
 * KST dates a question of `dayId` may name: the set's settle date (the day after the set opens, when its outcomes
 * fall) and, when the answer is read only on the following date (a European match that ends after midnight KST),
 * that date too.
 */
export function allowedDates(dayId: number, resolvesAt: number | null, observesAt: number | null = null): { month: number; day: number; weekday: number }[] {
  const close = dayEnd(dayId);
  const out = [close];
  if (resolvesAt !== null && resolvesAt > close && kstDate(resolvesAt) !== kstDate(close)) {
    // A long question (answered days later) names its real date: the date it is observed and the date it is answered.
    if (resolvesAt > close + SHORT_ANSWER_WINDOW_SECONDS) {
      out.push(resolvesAt);
      if (observesAt !== null && observesAt > close) out.push(observesAt);
    } else out.push(close + SECONDS_PER_DAY);
  }
  return out.map((u) => {
    const p = kstParts(u);
    return { month: p.month, day: p.day, weekday: p.weekday };
  });
}

/** Parses an ISO 8601 timestamp that carries an offset or Z. Returns unix seconds or null. */
export function parseIsoWithOffset(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s.trim())) return null;
  const ms = Date.parse(s.trim());
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** Monday 1 .. Sunday 7 of the KST calendar date of a unix time. */
export function kstIsoWeekday(unix: number): number {
  const w = kstParts(unix).weekday; // 0 Sunday
  return w === 0 ? 7 : w;
}

/**
 * Weekend rule: a day's set opens 09:00 KST and closes 09:00 KST the next day, so its answers fall on
 * the next calendar day. Friday sets resolve on Saturday and Saturday sets on Sunday, when exchanges,
 * FX markets and central banks are shut, so those sets cannot use the Markets category.
 */
export function marketsAllowedOnDay(dayId: number): boolean {
  const wd = kstIsoWeekday(dayOpensAt(dayId));
  return wd !== 5 && wd !== 6;
}

const BANNED: { re: RegExp; topic: string }[] = [
  { re: /\b(elections?|electoral|votes?|voting|ballots?|referendums?|presidents?|prime minister|parliament|congress|senate|politic\w*|parties|party leader)\b/i, topic: 'elections and politics' },
  { re: /\b(wars?|military|missiles?|troops|invasion|attacks?|terror\w*|bomb\w*|ceasefire|sanctions?)\b/i, topic: 'war and violence' },
  { re: /\b(earthquakes?|tsunamis?|typhoons?|hurricanes?|floods?|wildfires?|disasters?|evacuat\w*)\b/i, topic: 'disasters' },
  { re: /\b(died|death|dies|hospital\w*|illness|injur\w*|surgery|health of)\b/i, topic: 'health of named people' },
  { re: /\b(arrest\w*|indict\w*|crimes?|criminal|murder\w*|trial|lawsuits?|convicted|sentenced|police)\b/i, topic: 'crime' },
  { re: /\b(cojam|cojam token)\b|\bCT\b|\bCJP\b/i, topic: 'Cojam or CT' },
  { re: /\b(odds|betting|bets?|casino|bookmaker|gambling)\b/i, topic: 'gambling odds' },
  { re: /\b(porn\w*|adult content|nsfw|sex\w*)\b/i, topic: 'adult content' },
];

/** Banned topics named in a free text (used to filter outside markets before drafting). */
export function bannedInText(text: string): string[] {
  return [...new Set(BANNED.filter((b) => b.re.test(text)).map((b) => b.topic))];
}

export function bannedTopics(d: Draft): string[] {
  const hay = [d.en.title, d.en.rule, d.criteria, ...d.entities].join(' \n ');
  return [...new Set(BANNED.filter((b) => b.re.test(hay)).map((b) => b.topic))];
}

const TWO_LEVEL_SUFFIXES = new Set(['co.kr', 'or.kr', 'go.kr', 'ne.kr', 're.kr', 'co.jp', 'or.jp', 'ne.jp', 'go.jp', 'ac.jp', 'co.uk', 'org.uk', 'com.au', 'com.sg']);

/** Registrable domain (approximate eTLD+1) of a URL, or null when it is not an https URL. */
export function registrableDomain(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const labels = u.hostname.toLowerCase().replace(/^www\./, '').split('.');
  if (labels.length < 2) return null;
  const last2 = labels.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(last2) && labels.length >= 3) return labels.slice(-3).join('.');
  return last2;
}

/** Hostname without "www." (used for `allowed_domains` of the resolution runs). */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Numbers of 100 or more mentioned in a text, with Korean and Japanese large units read
 * (10만 = 100,000, 10万 = 100,000, 10만 2천 = 102,000, 1억 = 100,000,000). Smaller numbers (times,
 * goals, degrees) are written too differently across languages to compare by code; the fresh
 * context validation checks those.
 */
export function largeNumbers(text: string): number[] {
  const t = text.normalize('NFKC').replace(/(\d),(?=\d{3}\b)/g, '$1');
  const units: Record<string, number> = { 천: 1e3, 千: 1e3, 만: 1e4, 万: 1e4, 억: 1e8, 億: 1e8 };
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*([천千만万억億]?)/g;
  let m: RegExpExecArray | null;
  let carry: { value: number; unit: number } | null = null;
  let lastEnd = -1;
  while ((m = re.exec(t))) {
    const v = Number(m[1]) * (m[2] ? units[m[2]] : 1);
    const unit = m[2] ? units[m[2]] : 1;
    // "10만 2천" and "10万2千": a smaller unit right after a larger one adds to it.
    if (carry && unit > 1 && unit < carry.unit && m.index - lastEnd <= 2) {
      carry.value += v;
      carry.unit = unit;
      out[out.length - 1] = carry.value;
    } else {
      out.push(v);
      carry = unit > 1 ? { value: v, unit } : null;
    }
    lastEnd = m.index + m[0].length;
  }
  return out.filter((n) => n >= 100).map((n) => Math.round(n * 1e6) / 1e6);
}

function numbersOf(l: { title: string; rule: string; left: string; right: string }): Set<number> {
  return new Set([l.title, l.rule, l.left, l.right].flatMap(largeNumbers));
}

/**
 * Number mismatch between English and another language: the other text may not carry a number the
 * English does not, and every English number of 1,000 or more (prices, levels, rates) must appear in
 * it. Smaller English numbers can be part of a name ("Nikkei 225" is "日経平均" in Japanese).
 */
export function numberMismatch(en: Set<number>, other: Set<number>): string | null {
  const extra = [...other].filter((n) => !en.has(n));
  const missing = [...en].filter((n) => n >= 1000 && !other.has(n));
  if (!extra.length && !missing.length) return null;
  return [missing.length ? `missing ${missing.join(', ')}` : '', extra.length ? `extra ${extra.join(', ')}` : ''].filter(Boolean).join('; ');
}

const STOP = new Set(['will', 'the', 'a', 'an', 'be', 'at', 'on', 'in', 'of', 'to', 'than', 'or', 'and', 'by', 'is', 'it', 'its', 'tomorrow', 'today', 'tonight', 'more', 'higher', 'above', 'below', 'end', 'close']);

export function titleTokens(s: string): Set<string> {
  return new Set(
    s
      .normalize('NFKC')
      .replace(EN_DATE_RE, ' ')
      .replace(/\bKST\b/gi, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9$%. ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Duplicate of the last 30 days (DEV-PLAN 6.4, embedding free): the same source domain, a title that
 * says nearly the same thing, and an observation time within 36 hours of the other one. A recurring
 * template on another date (a new price level, a new match) is not a duplicate.
 */
export function isDuplicate(d: { titleEn: string; primaryUrl: string; observesAt: number }, recent: RecentQuestion[]): RecentQuestion | null {
  const dom = registrableDomain(d.primaryUrl);
  const tok = titleTokens(d.titleEn);
  for (const r of recent) {
    if (registrableDomain(r.primaryUrl) !== dom) continue;
    if (Math.abs(r.observesAt - d.observesAt) > 36 * 3600) continue;
    if (jaccard(tok, titleTokens(r.titleEn)) >= 0.75) return r;
  }
  return null;
}

/** Runs every code check on one draft for `ctx.dayId`. */
export function checkDraft(d: Draft, ctx: CheckContext): CodeCheckResult {
  const errors: string[] = [];

  // Texts in every language.
  for (const lang of LANGS) {
    const t = d[lang];
    const lim = TEXT_LIMITS[lang];
    const fields: [keyof typeof t, number][] = [
      ['title', lim.title],
      ['left', lim.choice],
      ['right', lim.choice],
      ['rule', lim.rule],
      ['settle', lim.settle],
    ];
    for (const [f, max] of fields) {
      const v = t[f].trim();
      if (!v) errors.push(`${lang}.${f} is empty`);
      else if (textLength(v) > max) errors.push(`${lang}.${f} has ${textLength(v)} characters, the limit is ${max}`);
      if (hasDashBreak(v)) errors.push(`${lang}.${f} uses a dash as a sentence break`);
    }
    if (t.left.trim() === t.right.trim()) errors.push(`${lang}: both choices are the same`);
  }
  if (hasDashBreak(d.criteria)) errors.push('criteria uses a dash as a sentence break');

  // Absolute dates: no relative day words, and the date named is the set's settle date (with the right weekday).
  const allowed = allowedDates(ctx.dayId, parseIsoWithOffset(d.resolvesAt), parseIsoWithOffset(d.observesAt));
  const settleLabel = kstDateLabels(dayEnd(ctx.dayId));
  for (const lang of LANGS) {
    for (const f of ['title', 'settle'] as const) {
      const v = d[lang][f];
      const rel = relativeDayWord(v);
      if (rel) errors.push(`${lang}.${f} uses the relative day word "${rel}"; name the date (${settleLabel[lang]})`);
      const dates = statedDates(lang, v);
      if (!dates.length) {
        errors.push(`${lang}.${f} must name the date in KST (${settleLabel[lang]})`);
        continue;
      }
      for (const sd of dates) {
        const hit = allowed.find((a) => a.month === sd.month && a.day === sd.day);
        if (!hit) errors.push(`${lang}.${f} names "${sd.text}", which is not the set's settle date ${settleLabel[lang]}`);
        else if (sd.weekday !== null && sd.weekday !== hit.weekday) errors.push(`${lang}.${f} gives the wrong weekday in "${sd.text}"`);
      }
    }
  }

  // Same large numbers in all three languages.
  const en = numbersOf(d.en);
  for (const lang of ['ko', 'ja'] as const) {
    const diff = numberMismatch(en, numbersOf(d[lang]));
    if (diff) errors.push(`${lang} numbers differ from en: ${diff}`);
  }

  // Criteria: one sentence with an exact time and time zone.
  if (!/\b\d{1,2}:\d{2}\b/.test(d.criteria) || !/\b(UTC|KST|JST|GMT|BST|CET|CEST|ET|EST|EDT|PT|PST|PDT|SGT|HKT)\b/.test(d.criteria)) {
    errors.push('criteria must state an exact time and a time zone');
  }

  // Category and the weekend rule.
  if (d.category === 'Markets' && !marketsAllowedOnDay(ctx.dayId)) {
    errors.push('Markets questions are not allowed on Friday and Saturday sets (answers fall on the weekend)');
  }

  // Probability.
  if (!(d.probabilityRight >= MIN_PROBABILITY && d.probabilityRight <= MAX_PROBABILITY)) {
    errors.push(`expected probability ${d.probabilityRight} is outside 0.25 to 0.75`);
  }

  // Sources: two https URLs on independent domains.
  const p = registrableDomain(d.primarySource.url);
  const s = registrableDomain(d.secondarySource.url);
  if (!p) errors.push('primary source must be an https URL');
  if (!s) errors.push('secondary source must be an https URL');
  if (p && s && p === s) errors.push('the two sources must be on independent domains');
  if (!d.primarySource.name.trim() || !d.secondarySource.name.trim()) errors.push('sources must be named');

  // Banned topics.
  for (const topic of bannedTopics(d)) errors.push(`topic not allowed: ${topic}`);

  // Times against the contract and the decided timing rule.
  const closesAt = dayEnd(ctx.dayId);
  const observesAt = parseIsoWithOffset(d.observesAt);
  const resolvesAt = parseIsoWithOffset(d.resolvesAt);
  let times: CodeCheckResult['times'];
  if (observesAt === null) errors.push('observesAt is not an ISO time with an offset');
  if (resolvesAt === null) errors.push('resolvesAt is not an ISO time with an offset');
  if (observesAt !== null && resolvesAt !== null) {
    times = { closesAt, observesAt, resolvesAt };
    if (d.kind === 'discrete' && observesAt < closesAt + DISCRETE_MIN_GAP_SEC) {
      errors.push('the event must start at least 10 minutes after the day closes (09:00 KST next day)');
    }
    if (d.kind === 'continuous') {
      if (observesAt < closesAt) errors.push('the observed value must come after the day closes (09:00 KST next day)');
      else if (observesAt - closesAt < CONTINUOUS_MIN_GAP_SEC && resolvesAt - closesAt < CONTINUOUS_MIN_GAP_SEC) {
        errors.push('a continuous value must be observed, or answered, at least 12 hours after the close');
      }
    }
    if (resolvesAt < observesAt) errors.push('resolvesAt is before the observed moment');
    if (resolvesAt < closesAt + ctx.minResolveGapSec) errors.push('resolvesAt is closer to the close than minResolveGap');
    const chainMax = ctx.maxResolveAfterCloseSec;
    const chainDays = chainMax === undefined ? Infinity : Math.floor(chainMax / SECONDS_PER_DAY);
    const longDays = Math.min(ctx.longMaxDays ?? 0, chainDays);
    // MAX_RESOLVE_AFTER_OPEN_SECONDS is the drafter's short question (within 24 h of the close); a long one may be
    // answered up to longDays after the close, and never later than the contract's maxResolveAfterClose.
    if (resolvesAt > dayOpensAt(ctx.dayId) + MAX_RESOLVE_AFTER_OPEN_SECONDS) {
      if (longDays <= 0) errors.push('resolvesAt is more than 24 hours after the close');
      else if (resolvesAt > closesAt + longDays * SECONDS_PER_DAY) errors.push(`resolvesAt is more than ${longDays} days after the close`);
    }
    if (chainMax !== undefined && resolvesAt > closesAt + chainMax) errors.push(`resolvesAt is past the contract limit (maxResolveAfterClose, ${Number((chainMax / SECONDS_PER_DAY).toFixed(2))} days after the close)`);
    if (d.category === 'Markets') {
      const wd = kstIsoWeekday(observesAt);
      if (wd >= 6) errors.push('Markets questions must be observed on a weekday');
    }
  }

  // Duplicates.
  if (ctx.recent && observesAt !== null) {
    const dup = isDuplicate({ titleEn: d.en.title, primaryUrl: d.primarySource.url, observesAt }, ctx.recent);
    if (dup) errors.push(`duplicate of a recent question: "${dup.titleEn}"`);
  }

  return { ok: errors.length === 0, errors, times };
}

/** Default category mix of a day (decided): Crypto 2, Sports 1, Markets 1, Culture 1. */
export function categoryMix(dayId: number): Record<Category, number> {
  if (marketsAllowedOnDay(dayId)) return { Crypto: 2, Sports: 1, Markets: 1, Culture: 1, Weather: 0 };
  // Friday and Saturday sets: the Markets slot becomes a Weather question (as in the admin design).
  return { Crypto: 2, Sports: 1, Markets: 0, Culture: 1, Weather: 1 };
}

// ---------------------------------------------------------------- questions mirrored from an outside market

/** A linked question's answer time may follow the outside market's end by at most this much. */
export const OUTSIDE_RESOLVE_AFTER_END_SEC = 6 * 3600;
/** The outside market must end within this window after our close (DECISIONS "Questions from Polymarket"). */
export const OUTSIDE_MIN_END_AFTER_CLOSE_SEC = DISCRETE_MIN_GAP_SEC;
export const OUTSIDE_MAX_END_AFTER_CLOSE_SEC = 24 * 3600;

/**
 * Code checks of a question mirrored from an outside market (`m` is the market as read again just now): the market
 * is still open and binary, the outcome named as our right choice is one of its two outcomes, it ends inside our
 * timing window, and our answer time agrees with its end (not before it, at most 6 hours after it).
 */
export function checkOutsideLink(d: Pick<Draft, 'resolvesAt'> & { outsideRightOutcome?: string }, m: OutsideMarket, dayId: number, longMaxDays?: number): string[] {
  const errors: string[] = [];
  const close = dayEnd(dayId);
  if (m.closed || !m.active) errors.push('the outside market is closed');
  else if (!m.acceptingOrders) errors.push('the outside market no longer accepts orders');
  if (m.outcomes.length !== 2) errors.push('the outside market is not binary');
  const right = (d.outsideRightOutcome ?? '').trim().toLowerCase();
  if (!right || !m.outcomes.some((o) => o.trim().toLowerCase() === right)) errors.push(`outsideRightOutcome "${d.outsideRightOutcome ?? ''}" is not one of ${JSON.stringify(m.outcomes)}`);
  if (m.endsAt === null) errors.push('the outside market has no end time');
  else {
    if (m.endsAt < close + OUTSIDE_MIN_END_AFTER_CLOSE_SEC) errors.push('the outside market ends before our day closes (its outcome could be known before the close)');
    const maxEnd = Math.max(OUTSIDE_MAX_END_AFTER_CLOSE_SEC, (longMaxDays ?? 0) * SECONDS_PER_DAY);
    if (m.endsAt > close + maxEnd) errors.push(`the outside market ends more than ${maxEnd / 3600} hours after our close`);
    const resolvesAt = parseIsoWithOffset(d.resolvesAt);
    if (resolvesAt !== null && (resolvesAt < m.endsAt || resolvesAt > m.endsAt + OUTSIDE_RESOLVE_AFTER_END_SEC)) {
      errors.push('resolvesAt does not agree with the outside market end time (it must be at or up to 6 hours after it)');
    }
  }
  return errors;
}
