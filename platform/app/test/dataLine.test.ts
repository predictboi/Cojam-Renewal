// The easy line of the data room (DECISIONS "Data room"), checked against the real English and Korean strings:
// "Cojam says 62% Yes", "7 points above Polymarket", "Same as Polymarket", Counting below the minimum, and a 50:50 split
// that picks neither side ("50% : 50%"). A share is never called a probability.
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ko from '../src/i18n/ko.json';
import { gapText, outsideGap, saysText, shareText, splitView, topView, viewOf, type Tr } from '../src/lib/dataLine';
import type { DataOutside } from '../../shared/src/dataRoom.ts';

const tr = (dict: Record<string, string>): Tr => (k, v) => (dict[k] ?? '[' + k + ']').replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? '{' + n + '}'));
const EN = tr(en as Record<string, string>), KO = tr(ko as Record<string, string>);
const yesNo = { l: 'No', r: 'Yes' }, yeAni = { l: '아니요', r: '예' };
const pm = (rightPrice: number): DataOutside => ({ source: 'polymarket', url: 'https://polymarket.com/event/x', rightPrice, takenAt: 0 });

describe('the split line', () => {
  it('names the larger side with its own word', () => {
    const v = splitView({ players: 1284, rightShare: 62, topRightShare: 71 });
    expect(v).toEqual({ kind: 'side', side: 'r', share: 62 });
    expect(saysText(v, yesNo, EN)).toBe('Cojam says 62% Yes');
    expect(shareText(v, yesNo, EN)).toBe('62% Yes');
    expect(saysText(v, yeAni, KO)).toBe('Cojam 플레이어 62%가 예 쪽이에요');
    const l = splitView({ players: 900, rightShare: 42, topRightShare: null });
    expect(saysText(l, yesNo, EN)).toBe('Cojam says 58% No');
    expect(shareText(l, { l: '2 goals or fewer', r: '3 or more' }, EN)).toBe('58% 2 goals or fewer');
  });
  it('shows Counting below the minimum of players, or without a share', () => {
    expect(splitView({ players: 29, rightShare: 70, topRightShare: null })).toEqual({ kind: 'counting' });
    expect(splitView({ players: 22, rightShare: null, topRightShare: null })).toEqual({ kind: 'counting' });
    const v = splitView({ players: 22, rightShare: null, topRightShare: null });
    expect(saysText(v, yesNo, EN)).toBe('Counting');
    expect(saysText(v, yeAni, KO)).toBe('집계 중');
    expect(shareText(v, yesNo, EN)).toBe('');
    expect(splitView({ players: 30, rightShare: 70, topRightShare: null }).kind).toBe('side');
  });
  it('a 50:50 split picks neither side', () => {
    const v = splitView({ players: 903, rightShare: 50, topRightShare: 58 });
    expect(v).toEqual({ kind: 'even' });
    expect(shareText(v, yesNo, EN)).toBe('50% : 50%');
    expect(saysText(v, yesNo, EN)).toBe('Cojam says 50% : 50%');
    expect(saysText(v, yeAni, KO)).not.toMatch(/예 쪽|아니요 쪽/);
    expect(saysText(v, yeAni, KO)).toContain('50% : 50%');
  });
  it('the top players line follows the same rule, and is absent without enough of them', () => {
    expect(topView({ players: 1284, rightShare: 62, topRightShare: 71 })).toEqual({ kind: 'side', side: 'r', share: 71 });
    expect(topView({ players: 1284, rightShare: 62, topRightShare: null })).toBeNull();
  });
  it('a share can be wrapped so the figure keeps its unit', () => {
    expect(saysText(viewOf(62), yesNo, EN, (n) => '<b>' + n + '%</b>')).toBe('Cojam says <b>62%</b> Yes');
  });
});

describe('the Polymarket line', () => {
  const v = (r: number) => viewOf(r);
  it('above, below and the same, on the side the line shows', () => {
    expect(outsideGap(v(62), pm(55))).toBe(7);
    expect(gapText(outsideGap(v(62), pm(55)), EN)).toBe('7 points above Polymarket');
    expect(gapText(outsideGap(v(62), pm(55)), KO)).toBe('폴리마켓보다 7%p 높아요');
    // 58% No against Polymarket's 30% Yes (70% No): 12 below
    expect(outsideGap(v(42), pm(30))).toBe(-12);
    expect(gapText(-12, EN)).toBe('12 points below Polymarket');
    expect(gapText(-12, KO)).toBe('폴리마켓보다 12%p 낮아요');
    expect(gapText(outsideGap(v(58), pm(58)), EN)).toBe('Same as Polymarket');
    expect(gapText(0, KO)).toBe('폴리마켓과 같아요');
    expect(gapText(1, EN)).toBe('1 point above Polymarket');
    expect(gapText(-1, EN)).toBe('1 point below Polymarket');
  });
  it('no line without a linked market or while counting', () => {
    expect(outsideGap(v(62), undefined)).toBeNull();
    expect(gapText(null, EN)).toBe('');
    expect(outsideGap({ kind: 'counting' }, pm(55))).toBeNull();
  });
  it('a 50:50 split is compared on the right choice', () => {
    expect(outsideGap({ kind: 'even' }, pm(55))).toBe(-5);
  });
});

describe('copy rules', () => {
  it('no data room string says probability, and none breaks a sentence with a dash', () => {
    for (const d of [en, ko] as Record<string, string>[]) {
      for (const [k, s] of Object.entries(d)) {
        if (!k.startsWith('dr.')) continue;
        expect(s).not.toMatch(/probab|확률/i);
        expect(s).not.toMatch(/ - | — |—/);
      }
    }
  });
});
