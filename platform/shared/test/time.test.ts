import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dayIdOf, dayOpensAt, dayEnd, weekOf, weekEnd, weekStart, weekFirstDay, marketId, marketIdsOfDay, dayOfMarket,
  slotOfMarket, isDayOpen, canCreateDay, isLateCreation, resolveDeadline, answerDeadline, isLongQuestion, latestResolvesAt, RESOLVE_DEADLINE_SECONDS, MAX_RESOLVE_AFTER_OPEN_SECONDS, airdropOpensAt, kstDate, kstDateTime, dayLabelKst,
  dayIdFromKstDate, kstParts,
} from "../src/time.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/contract-time.json", import.meta.url), "utf8")) as {
  weekOf: { dayId: number; weekId: number }[];
  weekEnd: { weekId: number; end: number }[];
};

test("weekOf matches CojamPredict.weekOf", () => {
  assert.ok(fixture.weekOf.length > 40);
  for (const { dayId, weekId } of fixture.weekOf) assert.equal(weekOf(dayId), weekId, `day ${dayId}`);
});

test("weekEnd matches CojamPredict.weekEnd", () => {
  for (const { weekId, end } of fixture.weekEnd) assert.equal(weekEnd(weekId), end, `week ${weekId}`);
});

test("dayId and day boundaries are 00:00 UTC = 09:00 KST", () => {
  const t = Date.UTC(2026, 10, 26, 0, 0, 0) / 1000; // 2026-11-26 09:00 KST
  const d = dayIdOf(t);
  assert.equal(dayOpensAt(d), t);
  assert.equal(dayIdOf(t - 1), d - 1);
  assert.equal(dayEnd(d), t + 86400);
  assert.equal(kstDateTime(dayOpensAt(d)), "2026-11-26 09:00");
  assert.equal(dayLabelKst(d), "2026-11-26");
  assert.equal(dayIdFromKstDate("2026-11-26"), d);
  assert.equal(dayIdOf(10n ** 9n), Math.floor(1e9 / 86400));
});

test("weeks start on Monday 09:00 KST and every day lies inside its week", () => {
  for (let d = 20000; d < 20100; d++) {
    const w = weekOf(d);
    assert.ok(weekStart(w) <= dayOpensAt(d) && dayEnd(d) <= weekEnd(w), `day ${d}`);
    assert.equal(weekEnd(w), weekStart(w + 1));
    assert.equal(kstParts(weekStart(w)).weekday, 1); // Monday
    assert.equal(kstParts(weekStart(w)).hour, 9);
    assert.equal(weekOf(weekFirstDay(w)), w);
    assert.equal(weekOf(weekFirstDay(w) - 1), w - 1);
  }
  assert.equal(weekStart(0), 0);
});

test("market ids", () => {
  assert.equal(marketId(20783, 0), 103915);
  assert.equal(marketId(20783, 4), 103919);
  assert.deepEqual(marketIdsOfDay(2), [10, 11, 12, 13, 14]);
  assert.equal(dayOfMarket(103919), 20783);
  assert.equal(slotOfMarket(103919), 4);
  assert.throws(() => marketId(1, 5), RangeError);
});

test("open and create rules", () => {
  const d = 20783;
  assert.equal(isDayOpen(d, dayOpensAt(d)), true);
  assert.equal(isDayOpen(d, dayEnd(d) - 1), true);
  assert.equal(isDayOpen(d, dayEnd(d)), false);
  assert.equal(canCreateDay(d, dayOpensAt(d) - 1), true);
  // Late creation: still accepted after the open while at least 1 hour of the day remains.
  assert.equal(canCreateDay(d, dayOpensAt(d)), true);
  assert.equal(isLateCreation(d, dayOpensAt(d)), true);
  assert.equal(isLateCreation(d, dayOpensAt(d) - 1), false);
  assert.equal(canCreateDay(d, dayEnd(d) - 3600), true);
  assert.equal(canCreateDay(d, dayEnd(d) - 3599), false);
  assert.equal(isLateCreation(d, dayEnd(d) - 3599), false);
  assert.equal(canCreateDay(d, dayEnd(d) + 86400), false);
  assert.equal(airdropOpensAt(1), weekEnd(1) + 60 * 3600);
});

test("KST formatting", () => {
  assert.equal(kstDate(0), "1970-01-01");
  assert.equal(kstDateTime(15 * 3600), "1970-01-02 00:00");
  assert.throws(() => dayIdOf(-1), RangeError);
  assert.throws(() => dayIdFromKstDate("2026/11/26"), RangeError);
});

test("each market has its own answer deadline: resolvesAt + 48 h, short or long", () => {
  const d = dayIdOf(Date.UTC(2026, 10, 26, 0, 0, 0) / 1000);
  const close = dayEnd(d);
  assert.equal(RESOLVE_DEADLINE_SECONDS, 48 * 3600);
  // A short question answered 1 h after the close: 1 h + 48 h (no longer the day's close + 48 h).
  assert.equal(resolveDeadline(close + 3600), close + 3600 + 48 * 3600);
  assert.equal(answerDeadline(d, close + 3600), close + 49 * 3600);
  assert.equal(isLongQuestion(d, close + 3600), false);
  // The last short moment (24 h after the close, open + 2 days) is still short.
  assert.equal(isLongQuestion(d, dayOpensAt(d) + MAX_RESOLVE_AFTER_OPEN_SECONDS), false);
  assert.equal(isLongQuestion(d, dayOpensAt(d) + MAX_RESOLVE_AFTER_OPEN_SECONDS + 1), true);
  // A long question 20 days out: its own deadline, weeks after the short ones of the same day.
  assert.equal(answerDeadline(d, close + 20 * 86400), close + 20 * 86400 + 48 * 3600);
  assert.equal(resolveDeadline(10n ** 9n), 1e9 + 48 * 3600);
  // The on chain limit: closesAt + maxResolveAfterClose (default 30 days).
  assert.equal(latestResolvesAt(d), close + 30 * 86400);
  assert.equal(latestResolvesAt(d, 7 * 86400), close + 7 * 86400);
});
