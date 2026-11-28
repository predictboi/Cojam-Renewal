import { describe, expect, it } from 'vitest';
import { dayEnd, dayIdFromKstDate, kstDateLabels, settleDateLabels } from '../../../shared/src/time.ts';
import { canonicalJson, contentHash } from '../../src/ai/contentHash.ts';
import { fakeDraft, fakeDrafts } from '../../src/ai/fake.ts';
import { decide, decideCorrection, verifyQuotes, type RunSummary } from '../../src/ai/resolve.ts';
import { draftZ, type Draft } from '../../src/ai/schemas.ts';
import { bandsOf, selectFive, type Candidate } from '../../src/ai/select.ts';
import { devQuestionsForDay } from '../../../shared/src/devQuestions.ts';
import {
  allowedDates,
  categoryMix,
  checkDraft,
  hasDashBreak,
  isDuplicate,
  largeNumbers,
  marketsAllowedOnDay,
  parseIsoWithOffset,
  registrableDomain,
  relativeDayWord,
  statedDates,
  TEXT_LIMITS,
  textLength,
} from '../../src/ai/validate.ts';

// Thursday 26 Nov 2026 (the admin design's fixed moment) and the days around it.
const THU = dayIdFromKstDate('2026-11-26');
const FRI = THU + 1;
const SAT = THU + 2;
const SUN = THU + 3;
const ctx = (dayId: number) => ({ dayId, minResolveGapSec: 3600 });
const iso = (unix: number) => new Date(unix * 1000).toISOString();
const clone = (d: Draft): Draft => JSON.parse(JSON.stringify(d));
/** Rewrites the texts of a draft from one date's labels to another's (EN, KO and JA forms). */
const redate = (d: Draft, from: ReturnType<typeof kstDateLabels>, to: ReturnType<typeof kstDateLabels>): Draft => {
  for (const l of ['en', 'ko', 'ja'] as const) for (const f of ['title', 'settle'] as const) d[l][f] = d[l][f].split(from[l]).join(to[l]);
  return d;
};

describe('fake drafts are valid (the baseline the other tests mutate)', () => {
  it.each([THU, FRI, SAT, SUN])('day %i', (day) => {
    for (const d of fakeDrafts(day, 12)) {
      draftZ.parse(d);
      const r = checkDraft(d, ctx(day));
      expect(r.errors, d.en.title).toEqual([]);
    }
  });
});

describe('time rules: everything closes at the day end and is known only after it', () => {
  it('rejects a discrete event that starts before the close or less than 10 minutes after', () => {
    const d = clone(fakeDraft(THU, 'Sports', 1));
    d.observesAt = iso(dayEnd(THU) - 3600);
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/at least 10 minutes after the day closes/);
    d.observesAt = iso(dayEnd(THU) + 5 * 60);
    expect(checkDraft(d, ctx(THU)).ok).toBe(false);
    d.observesAt = iso(dayEnd(THU) + 10 * 60);
    d.resolvesAt = iso(dayEnd(THU) + 3 * 3600);
    // The answer is now read on the settle date itself, so the texts must name that date, not the one after it.
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/not the set's settle date/);
    redate(d, kstDateLabels(dayEnd(THU) + 86400), settleDateLabels(THU));
    expect(checkDraft(d, ctx(THU)).errors).toEqual([]);
  });

  it('rejects a continuous value observed before the close (a daily high starting 00:00 KST)', () => {
    const d = clone(fakeDraft(THU, 'Weather', 1));
    d.observesAt = iso(dayEnd(THU) - 9 * 3600); // 00:00 KST of the close date
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/after the day closes/);
  });

  it('a continuous value needs 12 hours after the close, observed or answered', () => {
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.observesAt = iso(dayEnd(THU) + 3 * 3600);
    d.resolvesAt = iso(dayEnd(THU) + 4 * 3600);
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/12 hours/);
    d.resolvesAt = iso(dayEnd(THU) + 12 * 3600);
    expect(checkDraft(d, ctx(THU)).ok).toBe(true);
  });

  it('resolvesAt within [close + minResolveGap, close + 24 h]', () => {
    const d = clone(fakeDraft(THU, 'Culture', 3));
    d.resolvesAt = iso(dayEnd(THU) + 86400 + 60);
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/more than 24 hours/);
    d.observesAt = iso(dayEnd(THU) + 15 * 60);
    d.resolvesAt = iso(dayEnd(THU) + 30 * 60);
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/minResolveGap/);
  });

  it('requires offsets on times', () => {
    expect(parseIsoWithOffset('2026-11-27T12:00:00')).toBeNull();
    expect(parseIsoWithOffset('2026-11-27T21:00:00+09:00')).toBe(parseIsoWithOffset('2026-11-27T12:00:00Z'));
  });
});

describe('weekend rule', () => {
  it('Friday and Saturday sets cannot use Markets', () => {
    expect(marketsAllowedOnDay(THU)).toBe(true);
    expect(marketsAllowedOnDay(FRI)).toBe(false);
    expect(marketsAllowedOnDay(SAT)).toBe(false);
    expect(marketsAllowedOnDay(SUN)).toBe(true);
    const d = fakeDraft(FRI, 'Markets', 1);
    expect(checkDraft(d, ctx(FRI)).errors.join()).toMatch(/Friday and Saturday/);
    expect(categoryMix(FRI)).toMatchObject({ Markets: 0, Weather: 1, Crypto: 2 });
    expect(categoryMix(THU)).toMatchObject({ Markets: 1, Weather: 0, Crypto: 2, Sports: 1, Culture: 1 });
  });
});

describe('texts in three languages', () => {
  it('enforces the limits per language (code points)', () => {
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.ko.title = '가'.repeat(45);
    d.ja.left = 'あ'.repeat(9);
    d.en.rule = 'x'.repeat(61);
    d.ko.settle = '11월 27일(금) 오전 10시 30분 결과';
    const errs = checkDraft(d, ctx(THU)).errors.join('\n');
    expect(errs).toMatch(/ko.title has 45 characters, the limit is 44/);
    expect(errs).toMatch(/ko.settle has 24 characters, the limit is 22/);
    expect(errs).toMatch(/ja.left has 9 characters, the limit is 8/);
    expect(errs).toMatch(/en.rule has 61 characters, the limit is 60/);
    expect(textLength('비트코인')).toBe(4);
  });

  it('rejects a dash used as a sentence break, accepts hyphens in words and scores', () => {
    expect(hasDashBreak('Bitcoin - will it rise?')).toBe(true);
    expect(hasDashBreak('Bitcoin — will it rise?')).toBe(true);
    expect(hasDashBreak('Bitcoin—rise')).toBe(true);
    expect(hasDashBreak('A 2-1 win for the home side')).toBe(false);
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.ja.title = 'ビットコイン — 上がる？';
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/ja.title uses a dash/);
  });

  it('compares large numbers across languages, reading Korean and Japanese units', () => {
    expect(largeNumbers('$100,000')).toEqual([100000]);
    expect(largeNumbers('10만 달러')).toEqual([100000]);
    expect(largeNumbers('10万ドル')).toEqual([100000]);
    expect(largeNumbers('10만 2천 달러')).toEqual([102000]);
    expect(largeNumbers('10万2千ドル')).toEqual([102000]);
    expect(largeNumbers('1,400원 at 21:00, 3 goals')).toEqual([1400]);
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.en.title = 'Will Bitcoin be above $102,000 at 21:00 KST on Fri, Nov 27?';
    d.ko.title = '11월 27일(금) 오후 9시, 비트코인은 10만 2천 달러 위에 있을까요?';
    d.ja.title = '11月27日(金)21時、ビットコインは10万2千ドルを超えている？';
    expect(checkDraft(d, ctx(THU)).errors).toEqual([]);
    d.ja.title = '11月27日(金)21時、ビットコインは10万ドルを超えている？';
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/ja numbers/);
  });

  it('both choices must differ', () => {
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.ko.right = d.ko.left;
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/both choices are the same/);
  });
});

describe('absolute dates: no relative day words, and the date named is the settle date', () => {
  it('gives the drafter the settle date in each language form, with the weekday', () => {
    expect(settleDateLabels(THU)).toEqual({ en: 'Fri, Nov 27', ko: '11월 27일(금)', ja: '11月27日(金)' });
    expect(settleDateLabels(SAT)).toEqual({ en: 'Sun, Nov 29', ko: '11월 29일(일)', ja: '11月29日(日)' });
    const d = fakeDraft(SAT, 'Crypto', 2);
    expect(d.en.title).toBe('Will Bitcoin be above $100,200 at 21:00 KST on Sun, Nov 29?');
    expect(d.ko.title).toBe('11월 29일(일) 오후 9시, 비트코인은 100,200달러 위에 있을까요?');
    expect(d.ja.settle).toBe('11月29日(日)21時');
  });

  it('finds relative day words, English on word boundaries', () => {
    for (const w of ['tomorrow', 'Tonight', 'today', 'yesterday', 'this evening', 'next week']) expect(relativeDayWord(`Will it rain ${w}?`)).toBe(w);
    for (const w of ['내일', '모레', '오늘', '오늘 밤', '어제']) expect(relativeDayWord(`${w} 비가 올까요?`)).not.toBeNull();
    for (const w of ['明日', '明後日', '今日', '今夜', '昨日']) expect(relativeDayWord(`${w}、雨は降る？`)).not.toBeNull();
    expect(relativeDayWord('Will Todayville FC win on Sun, Nov 29?')).toBeNull();
    expect(relativeDayWord('Will the tomorrowland stream reach 1,000,000?')).toBeNull();
    expect(relativeDayWord('21:00 KST on Sun, Nov 29')).toBeNull();
  });

  it('rejects a title or settle phrase with a relative day word in any language', () => {
    const cases: [lang: 'en' | 'ko' | 'ja', field: 'title' | 'settle', text: string, word: string][] = [
      ['en', 'title', 'Will Bitcoin be above $100,200 at 21:00 KST tomorrow, Fri, Nov 27?', 'tomorrow'],
      ['en', 'settle', '21:00 tonight, Fri, Nov 27', 'tonight'],
      ['ko', 'title', '11월 27일(금) 내일 밤, 비트코인은 100,200달러 위일까요?', '내일'],
      ['ko', 'settle', '11월 27일(금) 오늘 밤', '오늘'],
      ['ja', 'title', '11月27日(金)明日21時、ビットコインは100,200ドルを超えている？', '明日'],
      ['ja', 'settle', '11月27日(金)今夜', '今夜'],
    ];
    for (const [lang, field, text, word] of cases) {
      const d = clone(fakeDraft(THU, 'Crypto', 2));
      d[lang][field] = text;
      const errs = checkDraft(d, ctx(THU)).errors;
      expect(errs, `${lang}.${field}`).toEqual([`${lang}.${field} uses the relative day word "${word}"; name the date (${settleDateLabels(THU)[lang]})`]);
    }
  });

  it('reads the stated date in each language form', () => {
    expect(statedDates('en', 'Will Bitcoin be above $100,000 at 21:00 KST on Sun, Nov 29?')).toMatchObject([{ month: 11, day: 29, weekday: 0 }]);
    expect(statedDates('en', 'on Sunday, November 29th')).toMatchObject([{ month: 11, day: 29, weekday: 0 }]);
    expect(statedDates('en', 'on Nov 29')).toMatchObject([{ month: 11, day: 29, weekday: null }]);
    expect(statedDates('en', 'maybe 5 goals?')).toEqual([]);
    expect(statedDates('ko', '11월 29일(일) 오후 9시, 비트코인은 10만 달러 위에 있을까요?')).toMatchObject([{ month: 11, day: 29, weekday: 0 }]);
    expect(statedDates('ja', '11月29日（日）21時、ビットコインは10万ドルを超えている？')).toMatchObject([{ month: 11, day: 29, weekday: 0 }]);
  });

  it('rejects a date other than the set\'s settle date, a wrong weekday, and a text with no date', () => {
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.en.title = 'Will Bitcoin be above $100,200 at 21:00 KST on Thu, Nov 26?';
    d.ko.settle = '11월 28일(토) 오후 9시';
    d.ja.title = '11月27日(土)21時、ビットコインは100,200ドルを超えている？';
    d.en.settle = '21:00 KST';
    const errs = checkDraft(d, ctx(THU)).errors;
    expect(errs).toContain(`en.title names "Thu, Nov 26", which is not the set's settle date Fri, Nov 27`);
    expect(errs).toContain(`ko.settle names "11월 28일(토)", which is not the set's settle date 11월 27일(금)`);
    expect(errs).toContain(`ja.title gives the wrong weekday in "11月27日(土)"`);
    expect(errs).toContain('en.settle must name the date in KST (Fri, Nov 27)');
    expect(errs).toHaveLength(4);
  });

  it('allows the date after the settle date only when the answer is read on it', () => {
    const d = clone(fakeDraft(THU, 'Sports', 1)); // a match at 05:00 KST on Sat, Nov 28, answered 07:00 KST
    expect(d.en.title).toMatch(/on Sat, Nov 28:/);
    expect(checkDraft(d, ctx(THU)).errors).toEqual([]);
    const c = clone(fakeDraft(THU, 'Crypto', 2)); // answered 21:05 KST on Fri, Nov 27
    redate(c, settleDateLabels(THU), kstDateLabels(dayEnd(THU) + 86400));
    expect(checkDraft(c, ctx(THU)).errors.join()).toMatch(/not the set's settle date/);
  });
});

describe('dev question samples (platform/shared) follow the same text rules', () => {
  it.each([THU, FRI, SAT, SUN])('day %i', (day) => {
    const sets = devQuestionsForDay(day);
    for (const q of [...sets.today, ...sets.yesterday, ...sets.earlier, ...sets.weekendSwap]) {
      const resolvesAt = dayEnd(day) + q.resolveAfterMin * 60;
      const allowed = allowedDates(day, resolvesAt);
      for (const l of ['en', 'ko', 'ja'] as const) {
        const lim = TEXT_LIMITS[l];
        expect(textLength(q.text[l].title), `${q.key} ${l} title`).toBeLessThanOrEqual(lim.title);
        expect(textLength(q.text[l].settle), `${q.key} ${l} settle`).toBeLessThanOrEqual(lim.settle);
        for (const f of ['title', 'settle'] as const) {
          expect(relativeDayWord(q.text[l][f]), `${q.key} ${l} ${f}`).toBeNull();
          const dates = statedDates(l, q.text[l][f]);
          expect(dates.length, `${q.key} ${l} ${f}`).toBeGreaterThan(0);
          for (const sd of dates) expect(allowed.some((a) => a.month === sd.month && a.day === sd.day && sd.weekday === a.weekday), `${q.key} ${l} ${f}`).toBe(true);
        }
      }
    }
  });
});

describe('content rules', () => {
  it('rejects banned topics', () => {
    const d = clone(fakeDraft(THU, 'Culture', 1));
    d.en.title = 'Will the president win the election?';
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/elections and politics/);
    const c = clone(fakeDraft(THU, 'Crypto', 2));
    c.en.title = 'Will CT be above $1 at 21:00 KST on Fri, Nov 27?';
    expect(checkDraft(c, ctx(THU)).errors.join()).toMatch(/Cojam or CT/);
  });

  it('needs two https sources on independent domains', () => {
    expect(registrableDomain('https://www.weather.go.kr/w/x')).toBe('weather.go.kr');
    expect(registrableDomain('https://data.jma.go.jp/x')).toBe('jma.go.jp');
    expect(registrableDomain('http://example.com')).toBeNull();
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.secondarySource.url = 'https://api.binance.com/x';
    expect(checkDraft(d, ctx(THU)).errors.join()).toMatch(/independent domains/);
  });

  it('balanced probability and an exact time in the criteria', () => {
    const d = clone(fakeDraft(THU, 'Crypto', 2));
    d.probabilityRight = 0.9;
    d.criteria = 'Binance price tomorrow evening.';
    const e = checkDraft(d, ctx(THU)).errors.join();
    expect(e).toMatch(/outside 0.25 to 0.75/);
    expect(e).toMatch(/exact time and a time zone/);
  });

  it('finds duplicates by source, title and observation time, not recurring templates on other dates', () => {
    const d = fakeDraft(THU, 'Crypto', 2);
    const obs = parseIsoWithOffset(d.observesAt)!;
    const recent = [{ titleEn: d.en.title, primaryUrl: d.primarySource.url, observesAt: obs + 3600 }];
    expect(isDuplicate({ titleEn: d.en.title, primaryUrl: d.primarySource.url, observesAt: obs }, recent)).not.toBeNull();
    expect(isDuplicate({ titleEn: d.en.title, primaryUrl: d.primarySource.url, observesAt: obs + 3 * 86400 }, recent)).toBeNull();
    expect(checkDraft(d, { ...ctx(THU), recent }).errors.join()).toMatch(/duplicate/);
  });
});

describe('selection of 5', () => {
  const c = (id: number, category: Candidate['category'], resolvesAt: number, quality: number, title = `t${id} unique words ${id}`): Candidate => ({ id, category, resolvesAt, quality, titleEn: title });
  const T = dayEnd(THU);
  it('follows the category mix and quality', () => {
    const cands = [c(1, 'Crypto', T + 43200, 0.9), c(2, 'Crypto', T + 43200, 0.8), c(3, 'Crypto', T + 43200, 0.95), c(4, 'Sports', T + 43200, 0.7), c(5, 'Markets', T + 43200, 0.7), c(6, 'Culture', T + 43200, 0.6), c(7, 'Weather', T + 43200, 0.99)];
    const s = selectFive(cands, categoryMix(THU), THU);
    expect(s.map((x) => x.id).sort()).toEqual([1, 3, 4, 5, 6]);
  });
  it('keeps resolve times in at most 2 bands', () => {
    expect(bandsOf([0, 3600, 7200, 50000, 50000 + 3600])).toBe(2);
    const cands = [c(1, 'Crypto', T + 3600, 0.9), c(2, 'Crypto', T + 40000, 0.9), c(3, 'Sports', T + 80000, 0.99), c(4, 'Sports', T + 41000, 0.5), c(5, 'Markets', T + 3600, 0.9), c(6, 'Culture', T + 42000, 0.9)];
    const s = selectFive(cands, categoryMix(THU), THU);
    expect(bandsOf(s.map((x) => x.resolvesAt))).toBeLessThanOrEqual(2);
    expect(s.map((x) => x.id)).not.toContain(3);
  });
  it('never fills a weekend set with Markets and fills missing categories from the rest', () => {
    const cands = [c(1, 'Crypto', T, 0.9), c(2, 'Crypto', T, 0.9), c(3, 'Markets', T, 0.99), c(4, 'Weather', T, 0.5), c(5, 'Weather', T, 0.6), c(6, 'Culture', T, 0.4)];
    const s = selectFive(cands, categoryMix(FRI), FRI);
    expect(s.map((x) => x.category)).not.toContain('Markets');
    expect(s).toHaveLength(5);
  });
  it('skips near identical titles', () => {
    const cands = [c(1, 'Crypto', T, 0.9, 'Will Bitcoin be above $100,000 at 21:00 KST on Fri, Nov 27?'), c(2, 'Crypto', T, 0.8, 'Will Bitcoin be above $100,000 at 21:00 KST on Fri, Nov 27 night?'), c(3, 'Crypto', T, 0.7, 'Will Ethereum be above $3,500 at 21:00 KST on Fri, Nov 27?')];
    const s = selectFive(cands, categoryMix(THU), THU);
    expect(s.map((x) => x.id)).toEqual([1, 3]);
  });
});

describe('content hash', () => {
  it('canonical JSON sorts keys and normalises strings', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(canonicalJson('é')).toBe(JSON.stringify('é'));
    expect(() => canonicalJson(1.5)).toThrow();
  });
  it('covers all three languages, times and sources, but not the settle phrase', () => {
    const d = fakeDraft(THU, 'Crypto', 2);
    const base = { en: d.en, ko: d.ko, ja: d.ja, closesAt: dayEnd(THU), resolvesAt: dayEnd(THU) + 43500, sources: [d.primarySource, d.secondarySource] };
    const h = contentHash(base);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(contentHash({ ...base, ja: { ...d.ja, settle: 'other' } })).toBe(h);
    expect(contentHash({ ...base, ja: { ...d.ja, title: d.ja.title + '!' } })).not.toBe(h);
    expect(contentHash({ ...base, resolvesAt: base.resolvesAt + 1 })).not.toBe(h);
  });
});

describe('resolution decisions', () => {
  const run = (outcome: RunSummary['outcome'], confidence = 0.95, verifiedQuotes = 1, eventCancelled = false): RunSummary => ({ outcome, confidence, verifiedQuotes, eventCancelled });
  const now = dayEnd(THU) + 12 * 3600;
  it('sets the answer only when both runs agree with confidence 0.9 and verified quotes', () => {
    expect(decide([run('A'), run('A')], undefined, now, THU)).toEqual({ action: 'set', outcome: 1 });
    expect(decide([run('B'), run('B')], undefined, now, THU)).toEqual({ action: 'set', outcome: 2 });
    expect(decide([run('A'), run('B')], undefined, now, THU).action).toBe('wait');
    expect(decide([run('A', 0.85), run('A')], undefined, now, THU).action).toBe('wait');
    expect(decide([run('A', 0.99, 0), run('A')], undefined, now, THU).action).toBe('wait');
  });
  it('the adapter must agree when present', () => {
    expect(decide([run('A'), run('A')], 'B', now, THU).action).toBe('wait');
    expect(decide([run('A'), run('A')], null, now, THU).action).toBe('wait');
    expect(decide([run('A'), run('A')], 'A', now, THU)).toEqual({ action: 'set', outcome: 1 });
  });
  it('voids a cancelled event, and anything unresolved 40 hours after the day end', () => {
    expect(decide([run('void', 0.9, 1, true), run('void', 0.95, 1, true)], undefined, now, THU)).toEqual({ action: 'void', reason: 'cancelled' });
    expect(decide([run('undeterminable', 0), run('A')], undefined, dayEnd(THU) + 40 * 3600, THU)).toEqual({ action: 'void', reason: 'unresolved' });
    expect(decide([run('undeterminable', 0), run('A')], undefined, dayEnd(THU) + 40 * 3600 - 1, THU).action).toBe('wait');
  });
  it('corrects inside the window only when two re-checks agree on the other answer', () => {
    expect(decideCorrection(1, [run('A')], undefined)).toEqual({ action: 'confirm' });
    expect(decideCorrection(1, [run('B')], undefined)).toEqual({ action: 'more' });
    expect(decideCorrection(1, [run('B'), run('B')], undefined)).toEqual({ action: 'correct', outcome: 2 });
    expect(decideCorrection(1, [run('B'), run('B')], 'A').action).toBe('alert');
    expect(decideCorrection(1, [run('B'), run('A')], undefined)).toEqual({ action: 'confirm' });
    expect(decideCorrection(2, [run('undeterminable', 0), run('undeterminable', 0)], undefined).action).toBe('alert');
  });
  it('verifies quotes against fetched text of the same host only', () => {
    const fetched = [{ url: 'https://www.binance.com/en/trade/BTC_USDT', text: 'Last price:   101,234.50  USDT', retrievedAt: null }];
    const ok = verifyQuotes([{ url: 'https://binance.com/x', quote: 'last price: 101,234.50 USDT', observedAt: '' }], fetched);
    expect(ok[0]).not.toBeNull();
    const wrongHost = verifyQuotes([{ url: 'https://evil.example/x', quote: 'Last price: 101,234.50', observedAt: '' }], fetched);
    expect(wrongHost[0]).toBeNull();
    const made = verifyQuotes([{ url: 'https://www.binance.com/en/trade/BTC_USDT', quote: 'Last price: 99,000', observedAt: '' }], fetched);
    expect(made[0]).toBeNull();
  });
});
