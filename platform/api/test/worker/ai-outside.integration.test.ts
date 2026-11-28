// Questions from Polymarket and longer questions, against Postgres with the fake AI and the fake outside markets
// (never the real Polymarket API): candidates filtered by timing, a matched slot carries the link, fallback when none
// fit, the validator rejects a mismatched time, a set on chain is left alone, and the long question rules.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { answerDeadline, dayEnd, dayIdFromKstDate, kstDateLabels, settleDateLabels } from '../../../shared/src/time.ts';
import { draftDay, matchOutsideDay, type AiDeps } from '../../src/ai/draft.ts';
import { fakeDraft, FakeProvider } from '../../src/ai/fake.ts';
import { outsideCandidates, outsideReject } from '../../src/ai/outside.ts';
import { decide } from '../../src/ai/resolve.ts';
import type { Draft } from '../../src/ai/schemas.ts';
import { selectFive, type Candidate } from '../../src/ai/select.ts';
import { categoryMix, checkDraft, checkOutsideLink } from '../../src/ai/validate.ts';
import { FakeOutsideMarkets } from '../../src/dataRoom/polymarket.ts';
import { silentLogger } from '../../src/worker/log.ts';
import { createWorkerDb, postgresAvailable, type TestDb } from './helpers/env.ts';

const pgProblem = await postgresAvailable();
const run = pgProblem ? describe.skip : describe;

const THU = dayIdFromKstDate('2026-12-03');
const CLOSE = dayEnd(THU);

/** A crypto draft mirrored from `slug` (its observed moment is CLOSE + 12 h, answered 5 minutes later). */
function mirror(slug: string, n = 500, rightOutcome = 'Yes'): Draft {
  return { ...fakeDraft(THU, 'Crypto', n), outsideSlug: slug, outsideRightOutcome: rightOutcome };
}
function btcMarket(fake: FakeOutsideMarkets, slug: string, endsAt = CLOSE + 12 * 3600) {
  return fake.add({ slug, question: 'Will the price of Bitcoin be above $150,000 on December 4?', endsAt, prices: [0.55, 0.45], volume: 50_000, url: `https://polymarket.com/event/bitcoin-above-on-december-4/${slug}` });
}

describe('outside candidates (no database)', () => {
  it('keeps only open binary markets that end inside the timing window, with an allowed topic, balanced and traded', async () => {
    const fake = new FakeOutsideMarkets();
    const ok = btcMarket(fake, 'ok');
    fake.add({ slug: 'before-close', question: 'Will ETH be above $3,000?', endsAt: CLOSE - 3600, volume: 9_000 });
    fake.add({ slug: 'three-way', question: 'Who wins the match?', endsAt: CLOSE + 7200, outcomes: ['A', 'B', 'Draw'], prices: [0.3, 0.3, 0.4], volume: 9_000 });
    fake.add({ slug: 'election', question: 'Will PP win the Spanish general election?', endsAt: CLOSE + 7200, volume: 90_000 });
    fake.add({ slug: 'period', question: 'Will Bitcoin reach $160,000 December 1-7?', endsAt: CLOSE + 7200, volume: 90_000 });
    fake.add({ slug: 'certain', question: 'Will the sun rise in Seoul on December 4?', endsAt: CLOSE + 7200, prices: [0.97, 0.03], volume: 90_000 });
    fake.add({ slug: 'thin', question: 'Will Ethereum be above $4,000 on December 4?', endsAt: CLOSE + 7200, volume: 10 });
    fake.add({ slug: 'closed', question: 'Will Ethereum be above $4,100 on December 4?', endsAt: CLOSE + 7200, volume: 9_000, closed: true });
    const long = fake.add({ slug: 'long', question: 'Will Bitcoin be above $150,000 on December 20?', endsAt: CLOSE + 16 * 86400, volume: 9_000 });
    expect((await outsideCandidates(fake, THU, 0)).map((m) => m.slug)).toEqual(['ok']);
    // Long questions allowed: the 16 day market fits too, after the short ones.
    expect((await outsideCandidates(fake, THU, 30)).map((m) => m.slug)).toEqual(['ok', 'long']);
    expect(outsideReject(ok, THU, 0)).toBeNull();
    expect(outsideReject(long, THU, 0)).toBe('ends too late');
    expect(outsideReject(fake.markets.get('before-close')!, THU, 0)).toBe('ends before our close');
    expect(outsideReject(fake.markets.get('election')!, THU, 0)).toBe('topic not allowed');
    expect(outsideReject(fake.markets.get('period')!, THU, 0)).toBe('decided during a period');
  });

  it('the link check: open, binary, the named outcome, and our answer time agrees with the market end', () => {
    const fake = new FakeOutsideMarkets();
    const m = btcMarket(fake, 'x');
    expect(checkOutsideLink(mirror('x'), m, THU)).toEqual([]);
    expect(checkOutsideLink(mirror('x', 500, 'Maybe'), m, THU).join()).toContain('not one of');
    expect(checkOutsideLink(mirror('x'), { ...m, endsAt: CLOSE + 2 * 3600 }, THU).join()).toContain('end time');
    expect(checkOutsideLink(mirror('x'), { ...m, closed: true }, THU).join()).toContain('closed');
  });
});

describe('long questions (no database)', () => {
  /** A crypto draft observed 10 days after the close, naming that real date. */
  function longDraft(days = 10): Draft {
    const base = fakeDraft(THU, 'Crypto', 2);
    const t = CLOSE + days * 86400;
    const sd = settleDateLabels(THU);
    const L = kstDateLabels(t);
    const json = JSON.stringify(base).split(sd.en).join(L.en).split(sd.ko).join(L.ko).split(sd.ja).join(L.ja);
    return { ...JSON.parse(json), observesAt: new Date((t + 12 * 3600) * 1000).toISOString(), resolvesAt: new Date((t + 12 * 3600 + 300) * 1000).toISOString() };
  }
  it('is refused without the long allowance and accepted with it, naming its real date', () => {
    const d = longDraft();
    expect(checkDraft(d, { dayId: THU, minResolveGapSec: 3600 }).errors.join()).toContain('more than 24 hours after the close');
    expect(checkDraft(d, { dayId: THU, minResolveGapSec: 3600, longMaxDays: 30 }).errors).toEqual([]);
    expect(checkDraft(longDraft(40), { dayId: THU, minResolveGapSec: 3600, longMaxDays: 30 }).errors.join()).toContain('more than 30 days');
    // The settle date of the set is still not the date of a long question's title when it names another one.
    const wrong = { ...d, en: { ...d.en, title: d.en.title.replace(kstDateLabels(CLOSE + 10 * 86400).en, 'Mon, Dec 28') } };
    expect(checkDraft(wrong, { dayId: THU, minResolveGapSec: 3600, longMaxDays: 30 }).errors.join()).toContain('Dec 28');
  });
  it('selection takes at most maxLong long questions', () => {
    const long = (id: number, cat: Candidate['category']): Candidate => ({ id, category: cat, titleEn: `long ${id} alpha${id}`, resolvesAt: CLOSE + (5 + id) * 86400, quality: 0.9 });
    const short = (id: number, cat: Candidate['category']): Candidate => ({ id, category: cat, titleEn: `short ${id} beta${id}`, resolvesAt: CLOSE + 12 * 3600, quality: 0.5 });
    const cands = [long(1, 'Crypto'), long(2, 'Crypto'), long(3, 'Sports'), long(4, 'Culture'), short(5, 'Crypto'), short(6, 'Crypto'), short(7, 'Sports'), short(8, 'Markets'), short(9, 'Culture')];
    const isLong = (c: Candidate) => c.resolvesAt > CLOSE + 86400;
    expect(selectFive(cands, categoryMix(THU), THU, { maxLong: 2 }).filter(isLong)).toHaveLength(2);
    expect(selectFive(cands, categoryMix(THU), THU, { maxLong: 0 }).filter(isLong)).toHaveLength(0);
  });
  it('a long question is voided only near its own deadline', () => {
    const now = CLOSE + 41 * 3600;
    expect(decide([], undefined, now, THU).action).toBe('void');
    expect(decide([], undefined, now, THU, CLOSE + 10 * 86400).action).toBe('wait');
    expect(answerDeadline(THU, CLOSE + 3600)).toBe(CLOSE + 48 * 3600);
    expect(answerDeadline(THU, CLOSE + 10 * 86400)).toBe(CLOSE + 10 * 86400 + 48 * 3600);
  });
});

run('questions from Polymarket on Postgres', () => {
  let t: TestDb;
  let ai: FakeProvider;
  let outside: FakeOutsideMarkets;
  let deps: AiDeps;
  beforeAll(async () => {
    t = await createWorkerDb();
  }, 60_000);
  afterAll(async () => t?.drop());
  beforeEach(async () => {
    await sql`TRUNCATE markets, market_drafts, ai_runs, market_outside, audit_log RESTART IDENTITY CASCADE`.execute(t.db);
    ai = new FakeProvider();
    outside = new FakeOutsideMarkets();
    deps = { db: t.db, provider: ai, log: silentLogger, now: () => CLOSE - 2 * 86400, minResolveGapSec: 3600, outside };
    await draftDay(deps, THU); // the set holds our own 5 questions, as days ahead do
  });

  const day = () => t.db.selectFrom('markets').selectAll().where('day_id', '=', THU).where('status', '!=', 'cancelled').orderBy('slot').execute();

  it('a matched slot replaces an own question of the same category and carries the link', async () => {
    btcMarket(outside, 'bitcoin-above-150k-on-december-4');
    ai.on('draft_outside', () => ({ candidates: [mirror('bitcoin-above-150k-on-december-4')] }));
    const before = await day();
    const r = await matchOutsideDay(deps, THU);
    expect(r).toMatchObject({ skipped: null, candidates: 1, drafted: 1, accepted: 1 });
    expect(r.replaced).toHaveLength(1);
    const after = await day();
    expect(after).toHaveLength(5);
    expect(after.map((m) => m.category).sort()).toEqual(before.map((m) => m.category).sort()); // the category mix stays
    const link = await t.db.selectFrom('market_outside').selectAll().executeTakeFirstOrThrow();
    expect(link).toMatchObject({ market_id: r.replaced[0], market_slug: 'bitcoin-above-150k-on-december-4', right_outcome: 'Yes', linked_by: 'drafter', url: 'https://polymarket.com/event/bitcoin-above-on-december-4/bitcoin-above-150k-on-december-4' });
    const replaced = after.find((m) => m.market_id === r.replaced[0])!;
    expect(replaced.category).toBe('Crypto');
    expect(replaced.image_state).toBe('pending');
    // The own question it replaced is kept aside as cancelled, with an audit row.
    const aside = await t.db.selectFrom('markets').select(['market_id', 'status', 'replaced_by']).where('replaced_by', '=', r.replaced[0]).executeTakeFirstOrThrow();
    expect(aside.status).toBe('cancelled');
    expect(await t.db.selectFrom('audit_log').select('action').where('action', '=', 'question.replaced_by_outside').executeTakeFirst()).toBeTruthy();
    const call = ai.calls.find((c) => c.job === 'draft_outside')!;
    expect(call.promptVersion).toBe('draft-outside-v1');
    expect(call.user).toContain('bitcoin-above-150k-on-december-4');
  });

  it('no fitting market: no drafting call, the set keeps our own questions', async () => {
    outside.add({ slug: 'too-early', question: 'Will ETH be above $3,000 on December 3?', endsAt: CLOSE - 3600, volume: 9_000 });
    const before = await day();
    const r = await matchOutsideDay(deps, THU);
    expect(r).toMatchObject({ skipped: null, candidates: 0, replaced: [], filled: [] });
    expect(ai.calls.some((c) => c.job === 'draft_outside')).toBe(false);
    expect((await day()).map((m) => m.market_id)).toEqual(before.map((m) => m.market_id));
  });

  it('the validator rejects a mirrored question whose answer time does not agree with the market end', async () => {
    btcMarket(outside, 'early-end', CLOSE + 2 * 3600);
    ai.on('draft_outside', () => ({ candidates: [mirror('early-end')] }));
    const r = await matchOutsideDay(deps, THU);
    expect(r).toMatchObject({ drafted: 1, accepted: 0, replaced: [] });
    const d = await t.db.selectFrom('market_drafts').select('rejected_reason').where('rejected_reason', 'like', '%end time%').executeTakeFirst();
    expect(d).toBeTruthy();
    expect(await t.db.selectFrom('market_outside').selectAll().execute()).toHaveLength(0);
  });

  it('a mirrored question fills a free slot first, and a set already on chain is left alone', async () => {
    btcMarket(outside, 'free-slot');
    const crypto = (await day()).find((m) => m.category === 'Crypto')!;
    await t.db.updateTable('markets').set({ status: 'cancelled' }).where('market_id', '=', crypto.market_id).execute();
    ai.on('draft_outside', () => ({ candidates: [mirror('free-slot')] }));
    const r = await matchOutsideDay(deps, THU);
    expect(r.filled).toEqual([crypto.market_id]);
    expect(r.replaced).toEqual([]);
    expect((await t.db.selectFrom('market_outside').select('market_id').executeTakeFirstOrThrow()).market_id).toBe(crypto.market_id);

    await t.db.updateTable('markets').set({ create_tx: '0xabc', status: 'published' }).where('day_id', '=', THU).execute();
    expect((await matchOutsideDay(deps, THU)).skipped).toBe('the set is already on chain');
  });
});
