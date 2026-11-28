// Source step of the drafter (DECISIONS "Questions from Polymarket", "Longer questions mixed in"): the open outside
// markets that could become one of the day's questions. Code filters what a model must never be trusted with:
// the timing window, binary markets only, no banned topic, roughly balanced, enough trading to be a real market,
// and no "during a period" event whose answer could already be known before our close.
import { dayEnd } from '../../../shared/src/time.ts';
import type { OutsideMarket, OutsideMarkets } from '../dataRoom/polymarket.ts';
import type { OutsidePromptMarket } from './prompts.ts';
import { bannedInText, OUTSIDE_MAX_END_AFTER_CLOSE_SEC, OUTSIDE_MIN_END_AFTER_CLOSE_SEC } from './validate.ts';

export const OUTSIDE_MIN_VOLUME = 1_000;
/** Neither outcome may be priced outside this range (a near certain market makes a poor question). */
export const OUTSIDE_MIN_PRICE = 0.15;
export const OUTSIDE_MAX_PRICE = 0.85;
export const OUTSIDE_PAGES = 5;
export const OUTSIDE_MAX_CANDIDATES = 40;
export const OUTSIDE_MAX_LONG_CANDIDATES = 12;

/**
 * Questions about something that may happen at any time inside a period ("reach $X November 23-29", "week of",
 * "by December 31", "dip to"): their answer could be decided before our close, so they are left out.
 */
const PERIOD_EVENT = /\b(week of|this week|dip to|reach(es)?|hits?|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|before (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|in (january|february|march|april|may|june|july|august|september|october|november|december))\b|\b\d{1,2}\s*[-–]\s*\d{1,2}(,|\?|\s|$)/i;

export function isPeriodEvent(m: Pick<OutsideMarket, 'question' | 'eventTitle'>): boolean {
  return PERIOD_EVENT.test(m.question) || PERIOD_EVENT.test(m.eventTitle ?? '');
}

/** Why a listed market cannot be a candidate for `dayId`, or null when it fits. */
export function outsideReject(m: OutsideMarket, dayId: number, longMaxDays: number): string | null {
  const close = dayEnd(dayId);
  if (m.closed || !m.active || !m.acceptingOrders) return 'not open';
  if (m.outcomes.length !== 2) return 'not binary';
  if (m.endsAt === null) return 'no end time';
  if (m.endsAt < close + OUTSIDE_MIN_END_AFTER_CLOSE_SEC) return 'ends before our close';
  if (m.endsAt > close + Math.max(OUTSIDE_MAX_END_AFTER_CLOSE_SEC, longMaxDays * 86400)) return 'ends too late';
  if (m.prices.some((p) => p < OUTSIDE_MIN_PRICE || p > OUTSIDE_MAX_PRICE)) return 'near certain';
  if (m.volume < OUTSIDE_MIN_VOLUME) return 'thin';
  if (bannedInText([m.question, m.eventTitle ?? '', m.description.slice(0, 400)].join(' \n ')).length) return 'topic not allowed';
  if (isPeriodEvent(m)) return 'decided during a period';
  return null;
}

/** Open outside markets that fit the timing rule of `dayId`: short ones first, then the most traded. */
export async function outsideCandidates(source: OutsideMarkets, dayId: number, longMaxDays: number): Promise<OutsideMarket[]> {
  const close = dayEnd(dayId);
  const endFrom = close + OUTSIDE_MIN_END_AFTER_CLOSE_SEC;
  const endTo = close + Math.max(OUTSIDE_MAX_END_AFTER_CLOSE_SEC, longMaxDays * 86400);
  const seen = new Map<string, OutsideMarket>();
  for (let page = 0; page < OUTSIDE_PAGES; page++) {
    const rows = await source.listOpen({ endFrom, endTo, limit: 100, offset: page * 100, minVolume: OUTSIDE_MIN_VOLUME });
    for (const m of rows) if (!seen.has(m.slug)) seen.set(m.slug, m);
    if (rows.length < 100) break;
  }
  const fit = [...seen.values()].filter((m) => outsideReject(m, dayId, longMaxDays) === null);
  const short = fit.filter((m) => m.endsAt! <= close + OUTSIDE_MAX_END_AFTER_CLOSE_SEC).sort((a, b) => b.volume - a.volume);
  const long = fit.filter((m) => m.endsAt! > close + OUTSIDE_MAX_END_AFTER_CLOSE_SEC).sort((a, b) => b.volume - a.volume).slice(0, OUTSIDE_MAX_LONG_CANDIDATES);
  return [...short, ...long].slice(0, OUTSIDE_MAX_CANDIDATES);
}

/** What the model sees of a market (data only; the description is cut). */
export function promptMarket(m: OutsideMarket): OutsidePromptMarket {
  return {
    slug: m.slug,
    question: m.question,
    outcomes: m.outcomes,
    prices: m.prices.map((p) => Math.round(p * 100) / 100),
    endsAt: m.endsAt ? new Date(m.endsAt * 1000).toISOString() : '',
    resolutionSource: m.resolutionSource,
    rules: m.description.slice(0, 700),
  };
}
