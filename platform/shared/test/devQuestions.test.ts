import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_EARLIER, DEV_TODAY, DEV_WEEKEND_SWAP, DEV_YESTERDAY, devSet, outcomeDayIsWeekend } from "../src/devQuestions.ts";

test("dev questions: five per set, three languages, every outcome after the day's end (DECISIONS Question timing)", () => {
  for (const set of [DEV_TODAY, DEV_YESTERDAY, DEV_EARLIER]) {
    assert.equal(set.length, 5);
    for (const q of [...set, ...DEV_WEEKEND_SWAP]) {
      assert.ok(q.resolveAfterMin > 0, q.key);
      for (const l of ["en", "ko", "ja"] as const) {
        for (const f of ["title", "left", "right", "rule", "settle"] as const) assert.ok(q.text[l][f].length > 0, `${q.key} ${l} ${f}`);
      }
      assert.match(q.text.en.title, /tomorrow/i, q.key);
      assert.doesNotMatch(q.text.en.title, /\btonight\b|close above .* today/i, q.key);
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
