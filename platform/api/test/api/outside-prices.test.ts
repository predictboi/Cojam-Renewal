// The outside price read at day close, against the fake Polymarket client (never the real API).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDb, seedDay } from "./helpers.ts";
import type { Db } from "../../src/db/index.ts";
import { FakeOutsideMarkets, parseGammaMarket, slugFromUrl } from "../../src/dataRoom/polymarket.ts";
import { OUTSIDE_READ_WINDOW_SEC, outsidePriceSweep } from "../../src/jobs/outside.ts";

let db: Db;
let drop: () => Promise<void>;
const DAY = 20_000;
const CLOSE = (DAY + 1) * 86400;
const log = { info() {}, warn() {} };

beforeAll(async () => {
  ({ db, drop } = await createTestDb());
  await seedDay(db, DAY);
  await seedDay(db, DAY - 1);
});
afterAll(async () => drop());

async function link(marketId: number, slug: string, rightOutcome = "Yes") {
  await db.insertInto("market_outside").values({ market_id: marketId, source: "polymarket", url: `https://polymarket.com/market/${slug}`, market_slug: slug, right_outcome: rightOutcome, linked_by: "test" }).execute();
}
const row = (id: number) => db.selectFrom("market_outside").selectAll().where("market_id", "=", id).executeTakeFirstOrThrow();

describe("outside price job", () => {
  test("reads once after the close: the matching outcome, a failure leaves it empty, a closed market is refused", async () => {
    const fake = new FakeOutsideMarkets();
    fake.add({ slug: "btc-above", outcomes: ["Yes", "No"], prices: [0.624, 0.376] });
    fake.add({ slug: "btc-below", outcomes: ["Yes", "No"], prices: [0.3, 0.7] });
    fake.add({ slug: "done", closed: true });
    await link(DAY * 5, "btc-above");
    await link(DAY * 5 + 1, "btc-below", "No"); // asked the other way round: their No is our right choice
    await link(DAY * 5 + 2, "missing");
    await link(DAY * 5 + 3, "done");
    await link(DAY * 5 + 4, "btc-above", "Maybe");

    // Before the close nothing is read.
    expect(await outsidePriceSweep({ db, source: fake, now: () => CLOSE - 10, log })).toEqual({ read: 0, failed: 0, missed: 0 });
    expect(fake.calls).toEqual([]);

    const r = await outsidePriceSweep({ db, source: fake, now: () => CLOSE + 60, log });
    expect(r).toEqual({ read: 2, failed: 3, missed: 0 });
    expect(await row(DAY * 5)).toMatchObject({ right_price: 62, error: null });
    expect((await row(DAY * 5)).taken_at?.getTime()).toBe((CLOSE + 60) * 1000);
    expect(await row(DAY * 5 + 1)).toMatchObject({ right_price: 70 });
    expect(await row(DAY * 5 + 2)).toMatchObject({ right_price: null, taken_at: null, error: expect.stringContaining("404") });
    expect(await row(DAY * 5 + 3)).toMatchObject({ right_price: null, error: expect.stringContaining("closed") });
    expect(await row(DAY * 5 + 4)).toMatchObject({ right_price: null, error: expect.stringContaining("Maybe") });

    // Once only: a second run reads nothing, even for the failures.
    const calls = fake.calls.length;
    expect(await outsidePriceSweep({ db, source: fake, now: () => CLOSE + 400, log })).toEqual({ read: 0, failed: 0, missed: 0 });
    expect(fake.calls.length).toBe(calls);
  });

  test("a network failure leaves the price empty and does not throw; a late run skips the read", async () => {
    const fake = new FakeOutsideMarkets();
    fake.fail = new Error("fetch failed");
    await link((DAY - 1) * 5, "a");
    await link((DAY - 1) * 5 + 1, "b");
    const prevClose = DAY * 86400;
    await db.updateTable("market_outside").set({ attempted_at: null }).where("market_id", "=", (DAY - 1) * 5 + 1).execute();
    // Slot 0 at a time inside the window fails; slot 1 is then missed because the window passed.
    const r1 = await outsidePriceSweep({ db, source: fake, now: () => prevClose + 30, log });
    expect(r1.failed).toBe(2);
    expect(await row((DAY - 1) * 5)).toMatchObject({ right_price: null, taken_at: null, error: "fetch failed" });
    await db.updateTable("market_outside").set({ attempted_at: null, error: null }).where("market_id", "=", (DAY - 1) * 5 + 1).execute();
    const r2 = await outsidePriceSweep({ db, source: fake, now: () => prevClose + OUTSIDE_READ_WINDOW_SEC + 1, log });
    expect(r2).toMatchObject({ missed: 1, read: 0 });
    expect(await row((DAY - 1) * 5 + 1)).toMatchObject({ right_price: null, error: expect.stringContaining("window") });
  });
});

describe("Polymarket Gamma parsing", () => {
  test("JSON encoded outcomes and prices, the market link, slugs from links", () => {
    const m = parseGammaMarket({
      id: "123",
      slug: "bitcoin-above-100k-on-december-1",
      question: "Will the price of Bitcoin be above $100,000 on December 1?",
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.62", "0.38"]',
      endDate: "2026-12-01T17:00:00Z",
      closed: false,
      groupItemTitle: "100,000",
      events: [{ slug: "bitcoin-above-on-december-1", title: "Bitcoin above ___ on December 1?" }],
      volumeNum: 1234.5,
    })!;
    expect(m).toMatchObject({ outcomes: ["Yes", "No"], prices: [0.62, 0.38], endsAt: Date.parse("2026-12-01T17:00:00Z") / 1000, closed: false, volume: 1234.5, groupItemTitle: "100,000" });
    expect(m.url).toBe("https://polymarket.com/event/bitcoin-above-on-december-1/bitcoin-above-100k-on-december-1");
    expect(parseGammaMarket({ slug: "x", outcomes: '["Yes"]', outcomePrices: "[]" })).toBeNull();
    expect(slugFromUrl("https://polymarket.com/event/e-slug/m-slug?tid=1")).toBe("m-slug");
    expect(slugFromUrl("https://polymarket.com/event/e-slug")).toBe("e-slug");
    expect(slugFromUrl("https://polymarket.com/market/m-slug")).toBe("m-slug");
    expect(slugFromUrl("https://evil.example/market/m-slug")).toBeNull();
  });
});
