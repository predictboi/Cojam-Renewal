// The mock adapter's questions: the design's example texts broke the timing rule (an outcome known before the day
// ends, e.g. "close above $100,000 today"), so the mock uses the compliant dev sets from platform/shared (the same ones
// `npm run dev:seed` puts in the local API). Keys follow design-mock.json: q1..q5 today's set, p1..p7 past rows.
import { DEV_EARLIER, DEV_TODAY, DEV_YESTERDAY, type DevQuestion } from '../../../../shared/src/devQuestions.ts';
import type { Lang, QText } from '../types';

export type MockQuestion = { n?: number; img?: string; cat: string } & Record<Lang, QText>;
const asMock = (q: DevQuestion, n?: number): MockQuestion => ({
  ...(n ? { n } : {}),
  ...(q.img ? { img: '/assets/img/' + q.img } : {}),
  cat: q.category, en: q.text.en, ko: q.text.ko, ja: q.text.ja,
});

export const MOCK_QUESTIONS: Record<string, MockQuestion> = {
  ...Object.fromEntries(DEV_TODAY.map((q, i) => ['q' + (i + 1), asMock(q, i + 1)])),
  ...Object.fromEntries(DEV_YESTERDAY.map((q, i) => ['p' + (i + 1), asMock(q)])),
  p6: asMock(DEV_EARLIER[1]),
  p7: asMock(DEV_EARLIER[2]),
};

/** Today's set has no outcome before the day ends: every row of day 0 waits (times follow each question's rule). */
export const MOCK_RESULTS_DAY0 = [
  { q: 'q2', c: 'r', out: 'wait', exp: '16:00' },
  { q: 'q1', c: 'r', out: 'wait', exp: '21:00' },
  { q: 'q3', c: 'l', out: 'wait', exp: '18:00' },
  { q: 'q4', c: 'r', out: 'wait', exp: '07:00' },
  { q: 'q5', c: 'r', out: 'wait', exp: '21:00' },
] as const;
