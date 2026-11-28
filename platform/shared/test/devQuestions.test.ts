import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_EARLIER, DEV_TODAY, DEV_WEEKEND_SWAP, DEV_YESTERDAY, devQuestionsForDay, devSet, outcomeDayIsWeekend } from "../src/devQuestions.ts";
import { dayIdFromKstDate } from "../src/time.ts";

const RELATIVE = /\b(tomorrow|tonight|today|yesterday|this evening|next week)\b|내일|모레|오늘|어제|明日|明後日|今日|今夜|昨日/i;

test("dev questions: five per set, three languages, every outcome after the day's end (DECISIONS Question timing)", () => {
  for (const set of [DEV_TODAY, DEV_YESTERDAY, DEV_EARLIER]) {
    assert.equal(set.length, 5);
    for (const q of [...set, ...DEV_WEEKEND_SWAP]) {
      assert.ok(q.resolveAfterMin > 0, q.key);
      for (const l of ["en", "ko", "ja"] as const) {
        for (const f of ["title", "left", "right", "rule", "settle"] as const) {
          assert.ok(q.text[l][f].length > 0, `${q.key} ${l} ${f}`);
          assert.doesNotMatch(q.text[l][f], RELATIVE, `${q.key} ${l} ${f}`);
        }
      }
    }
  }
});

test("dev questions: titles and settle phrases name the set's settle date (or the date after it) in each language", () => {
  // 2026-11-28 (Sat) opens a set whose outcomes fall on Sun, Nov 29.
  const sets = devQuestionsForDay(dayIdFromKstDate("2026-11-28"));
  assert.equal(sets.today[0].text.en.title, "Will Bitcoin be above $100,000 at 21:00 KST on Sun, Nov 29?");
  assert.equal(sets.today[0].text.ko.title, "11월 29일(일) 오후 9시, 비트코인은 10만 달러 위에 있을까요?");
  assert.equal(sets.today[0].text.ja.title, "11月29日(日)21時、ビットコインは10万ドルを超えている？");
  assert.equal(sets.today[0].text.en.settle, "21:00 KST on Sun, Nov 29");
  const dates = { en: /(Sun, Nov 29|Mon, Nov 30)/, ko: /11월 (29일\(일\)|30일\(월\))/, ja: /11月(29日\(日\)|30日\(月\))/ };
  for (const q of [...sets.today, ...sets.yesterday, ...sets.earlier, ...sets.weekendSwap]) {
    for (const l of ["en", "ko", "ja"] as const) {
      assert.match(q.text[l].title, dates[l], `${q.key} ${l} title`);
      assert.match(q.text[l].settle, dates[l], `${q.key} ${l} settle`);
    }
  }
});

test("dev questions: a set whose outcomes fall on a weekend has no market question", () => {
  // 2026-11-27 (Fri) opens day 20784: its outcomes fall on Saturday
  assert.equal(outcomeDayIsWeekend(20784), true);
  assert.equal(outcomeDayIsWeekend(20783), false);
  assert.ok(!devSet("today", 20784).some((q) => q.category === "markets"));
  assert.ok(devSet("today", 20783).some((q) => q.category === "markets"));
});
