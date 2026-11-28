// The easy line of the data room (DECISIONS "Data room", "Data room: outside comparison"): "Cojam says 62% Yes", and where an
// outside market is linked "7 points above Polymarket". Pure functions: the translator is passed in, so the wording is tested
// against the real locale files (test/dataLine.test.ts). A share is a share of players, never called a probability.
import { DATA_MIN_PLAYERS, type DataOutside, type DataSplit } from '../../../shared/src/dataRoom.ts';

export type Tr = (key: string, vars?: Record<string, string | number>) => string;
/** l = choice A (left), r = choice B (right) */
export type SplitView =
  | { kind: 'counting' }
  | { kind: 'even' }
  | { kind: 'side'; side: 'l' | 'r'; share: number };
export interface Words { l: string; r: string }

const pct = (v: number | null | undefined) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);

/** The larger side of a split of players (right share in percent), 50:50 when even, counting below the minimum. */
export function viewOf(rightShare: number | null | undefined, players?: number, min = DATA_MIN_PLAYERS): SplitView {
  const r = pct(rightShare);
  if (r === null || (players !== undefined && players < min)) return { kind: 'counting' };
  if (r === 50) return { kind: 'even' };
  return r > 50 ? { kind: 'side', side: 'r', share: r } : { kind: 'side', side: 'l', share: 100 - r };
}
export const splitView = (s: DataSplit): SplitView => viewOf(s.rightShare, s.players);
/** The same among the top players; null when there are too few of them (no line at all). */
export const topView = (s: DataSplit): SplitView | null => (pct(s.topRightShare) === null ? null : viewOf(s.topRightShare));

/** How a share is written: "62%" (a screen may wrap it so the figure and its unit never part). */
export type Fmt = (n: number) => string;
const plain: Fmt = (n) => n + '%';
/** The share with the side's word: "62% Yes", "50% : 50%"; empty while counting. Words are inserted as given (escape for HTML). */
export function shareText(v: SplitView, w: Words, tr: Tr, fmt: Fmt = plain): string {
  if (v.kind === 'counting') return '';
  if (v.kind === 'even') return tr('dr.even');
  return tr('dr.share', { share: fmt(v.share), side: v.side === 'l' ? w.l : w.r });
}
/** The line on a Results row: "Cojam says 62% Yes", "Cojam says 50% : 50%", or "Counting". */
export function saysText(v: SplitView, w: Words, tr: Tr, fmt: Fmt = plain): string {
  if (v.kind === 'counting') return tr('dr.counting');
  if (v.kind === 'even') return tr('dr.says.even');
  return tr('dr.says', { share: fmt(v.share), side: v.side === 'l' ? w.l : w.r });
}

/** The outside price on the side the line shows (the right choice on a 50:50 split). */
export function outsideShare(v: SplitView, o: DataOutside): number {
  const p = pct(o.rightPrice) ?? 0;
  return v.kind === 'side' && v.side === 'l' ? 100 - p : p;
}
/** Points between our share and the outside price on the same side: positive above, negative below; null without a line. */
export function outsideGap(v: SplitView, o?: DataOutside | null): number | null {
  if (!o || v.kind === 'counting' || pct(o.rightPrice) === null) return null;
  return (v.kind === 'even' ? 50 : v.share) - outsideShare(v, o);
}
/** "7 points above Polymarket", "1 point below Polymarket", "Same as Polymarket"; empty without a linked market. */
export function gapText(gap: number | null, tr: Tr): string {
  if (gap === null) return '';
  if (gap === 0) return tr('dr.gap.same');
  const n = Math.abs(gap), dir = gap > 0 ? 'above' : 'below';
  return tr('dr.gap.' + dir + (n === 1 ? '1' : ''), { n });
}
/** The side of the answer as its word, for the detail. */
export const sideWord = (side: 1 | 2, w: Words) => (side === 1 ? w.l : w.r);
