// AI pipeline against a real Postgres with the fake provider (no chain): rejection paths of drafting,
// the reserve, ai_runs logging of refusals, quote verification inside a resolution run, the image
// check with regenerations and the category illustration fallback.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { dayEnd, dayIdFromKstDate } from '../../../shared/src/time.ts';
import { draftDay, fillFromReserve, type AiDeps } from '../../src/ai/draft.ts';
import { fakeDraft, fakeDrafts, FakeProvider } from '../../src/ai/fake.ts';
import { CategoryIllustrationGenerator, checkUploadedImage, imageInfo, prepareImage, type ImageGenerator, type ImageStore } from '../../src/ai/images.ts';
import { resolveMarket } from '../../src/ai/resolve.ts';
import { silentLogger } from '../../src/worker/log.ts';
import { createWorkerDb, postgresAvailable, type TestDb } from './helpers/env.ts';

const pgProblem = await postgresAvailable();
const run = pgProblem ? describe.skip : describe;

const THU = dayIdFromKstDate('2026-12-03');

run('AI pipeline on Postgres', () => {
  let t: TestDb;
  let fake: FakeProvider;
  let deps: AiDeps;
  beforeAll(async () => {
    t = await createWorkerDb();
  }, 60_000);
  afterAll(async () => t?.drop());
  beforeEach(async () => {
    await sql`TRUNCATE markets, market_drafts, ai_runs, resolutions, evidence, image_runs RESTART IDENTITY CASCADE`.execute(t.db);
    fake = new FakeProvider();
    deps = { db: t.db, provider: fake, log: silentLogger, now: () => dayEnd(THU) - 2 * 86400, minResolveGapSec: 3600 };
  });

  it('keeps code rejected and validator rejected candidates out, with their reasons', async () => {
    const good = fakeDrafts(THU, 6);
    const tooLong = { ...fakeDraft(THU, 'Crypto', 90), ko: { ...fakeDraft(THU, 'Crypto', 90).ko, title: '가'.repeat(45) } };
    const knowable = { ...fakeDraft(THU, 'Sports', 91), observesAt: new Date((dayEnd(THU) - 3600) * 1000).toISOString() };
    fake.on('draft', () => ({ candidates: [...good, tooLong, knowable] }));
    fake.on('validate', (req) => {
      const title = String(req.meta?.title);
      const reject = title.includes('Ethereum');
      return {
        checks: ['binary_objective', 'sources_named', 'criteria_exact', 'known_after_close', 'open_when_resolving', 'balanced', 'allowed_topic', 'same_meaning', 'native_voice', 'house_rules'].map((id) => ({ id, pass: !(reject && id === 'native_voice'), note: '' })),
        verdict: reject ? 'reject' : 'accept',
        qualityScore: 0.8,
        summary: reject ? 'Korean reads as a translation' : 'ok',
      };
    });
    const out = await draftDay(deps, THU);
    expect(out.drafted).toBe(8);
    const drafts = await t.db.selectFrom('market_drafts').select(['rejected_reason', 'payload']).execute();
    const reasons = drafts.map((d) => d.rejected_reason).filter(Boolean) as string[];
    expect(reasons.some((r) => r.startsWith('code:') && r.includes('ko.title has 45 characters'))).toBe(true);
    expect(reasons.some((r) => r.includes('10 minutes after the day closes'))).toBe(true);
    expect(reasons.some((r) => r.startsWith('validator: native_voice'))).toBe(true);
    // Only accepted drafts are scheduled; the code rejected ones were never sent to the validator.
    const validated = fake.calls.filter((c) => c.job === 'validate').length;
    expect(validated).toBe(6);
    const ms = await t.db.selectFrom('markets').select(['content']).where('day_id', '=', THU).execute();
    expect(ms.every((m) => !m.content.en.title.includes('Ethereum'))).toBe(true);
  });

  it('fills a cancelled slot from the reserve without a new drafting call', async () => {
    await draftDay(deps, THU);
    const calls = fake.calls.length;
    await t.db.updateTable('markets').set({ status: 'cancelled' }).where('market_id', '=', THU * 5 + 2).execute();
    const filled = await fillFromReserve(deps, THU);
    expect(filled).toEqual([THU * 5 + 2]);
    expect(fake.calls.length).toBe(calls);
    const moved = await t.db.selectFrom('markets').select(['market_id', 'replaced_by', 'status']).where('status', '=', 'cancelled').executeTakeFirstOrThrow();
    expect(moved.market_id).toBeLessThan(0);
    expect(moved.replaced_by).toBe(THU * 5 + 2);
  });

  it('logs refusals and schema mismatches in ai_runs, and a failed drafting call schedules nothing', async () => {
    fake.on('draft', () => ({ json: null, text: '', model: 'claude-opus-5-5', stopReason: 'refusal', usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0 }, costUsd: 0.001, fetched: [], refusal: { category: 'cyber', explanation: null } }));
    const out = await draftDay(deps, THU);
    expect(out.scheduled).toEqual([]);
    expect(out.missingSlots).toEqual([0, 1, 2, 3, 4]);
    const runs = await t.db.selectFrom('ai_runs').selectAll().execute();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ job: 'draft', stop_reason: 'refusal', prompt_version: 'draft-v2' });
    expect(runs[0].error).toMatch(/refusal \(cyber\)/);
    fake.on('draft', () => ({ candidates: [{ title: 'missing fields' }] }));
    await draftDay(deps, THU);
    expect((await t.db.selectFrom('ai_runs').select('error').orderBy('id', 'desc').executeTakeFirstOrThrow()).error).toMatch(/schema mismatch/);
  });

  it('a run whose quote is not in the fetched text counts as undeterminable', async () => {
    await draftDay(deps, THU);
    const id = THU * 5;
    fake.on('resolve_*', (req) => ({
      outcome: 'B',
      confidence: 0.99,
      evidence: [{ url: 'https://www.binance.com/x', quote: 'Close 101,000', observedAt: '2026-12-04T12:00:00Z' }],
      reasoningSummary: 'made up',
      eventCancelled: false,
      __fetched: [{ url: 'https://www.binance.com/x', text: 'Close 99,500', retrievedAt: null }],
      ...(req.meta ? {} : {}),
    }));
    deps.now = () => dayEnd(THU) + 13 * 3600;
    const d = await resolveMarket(deps, id);
    expect(d.action).toBe('wait');
    const rows = await t.db.selectFrom('resolutions').select(['run', 'outcome', 'reasoning']).where('market_id', '=', id).execute();
    expect(rows.map((r) => r.outcome)).toEqual(['undeterminable', 'undeterminable']);
    expect(rows[0].reasoning).toMatch(/quotes not found/);
    // A prompt injection in a fetched page cannot change the outcome code decides from: same result.
  });

  it('images: the category illustration set never calls an API; a real generator is checked and falls back after 3 rejections', async () => {
    await draftDay(deps, THU);
    const id = THU * 5;
    expect(await prepareImage({ db: t.db, provider: fake, generator: new CategoryIllustrationGenerator(), store: null, log: silentLogger }, id)).toBe('fallback');
    const m = await t.db.selectFrom('markets').select(['image_state', 'image_key', 'category']).where('market_id', '=', id).executeTakeFirstOrThrow();
    expect(m.image_state).toBe('fallback');
    expect(fake.calls.filter((c) => c.job.startsWith('image')).length).toBe(0);

    let generated = 0;
    const gen: ImageGenerator = { name: 'test-gen', generates: true, generate: async () => ({ bytes: Buffer.from(`img${generated++}`), mediaType: 'image/png', model: 'test-model', costUsd: 0.1 }) };
    const stored: string[] = [];
    const store: ImageStore = { put: async (key) => (stored.push(key), { key, url: `https://img.cojam.app/${key}` }) };
    fake.on('image_check', () => ({ accept: false, reasons: ['text_or_numbers'], note: 'letters on a sign' }));
    expect(await prepareImage({ db: t.db, provider: fake, generator: gen, store, log: silentLogger }, id)).toBe('fallback');
    expect(generated).toBe(3);
    const runs = await t.db.selectFrom('image_runs').select(['result']).where('market_id', '=', id).execute();
    expect(runs.map((r) => r.result)).toEqual(['rejected', 'rejected', 'rejected']);

    let n = 0;
    fake.on('image_check', () => ({ accept: n++ > 0, reasons: n > 1 ? [] : ['logo_or_trademark'], note: '' }));
    expect(await prepareImage({ db: t.db, provider: fake, generator: gen, store, log: silentLogger }, id + 1)).toBe('generated');
    const g = await t.db.selectFrom('markets').select(['image_state', 'image_url', 'image_sha256', 'image_model']).where('market_id', '=', id + 1).executeTakeFirstOrThrow();
    expect(g).toMatchObject({ image_state: 'generated', image_model: 'test-model' });
    expect(g.image_url).toMatch(/^https:\/\/img\.cojam\.app\/q\//);
    // The image check got the picture as a vision input.
    expect(fake.calls.filter((c) => c.job === 'image_check').every((c) => c.images?.length === 1)).toBe(true);
  });
  it('checks an uploaded image (format, 4:5, size, vision) before switching the question to it', async () => {
    await draftDay(deps, THU);
    const id = THU * 5 + 3;
    const png = (w: number, h: number) => {
      const b = Buffer.alloc(64);
      b.writeUInt32BE(0x89504e47, 0);
      b.writeUInt32BE(w, 16);
      b.writeUInt32BE(h, 20);
      return b;
    };
    expect(imageInfo(png(800, 1000))).toEqual({ width: 800, height: 1000, mediaType: 'image/png' });
    const serve = (buf: Buffer) => (async () => new Response(buf)) as unknown as typeof fetch;
    const bad = await checkUploadedImage({ db: t.db, provider: fake, log: silentLogger, aiEnabled: true, fetchImpl: serve(png(1000, 1000)) }, id, { imageKey: 'q/up.png', baseUrl: 'https://img.cojam.app' });
    expect(bad.accepted).toBe(false);
    expect(bad.reasons.join()).toMatch(/not 4:5/);
    const good = await checkUploadedImage({ db: t.db, provider: fake, log: silentLogger, aiEnabled: true, fetchImpl: serve(png(1600, 2000)) }, id, { imageKey: 'q/up.png', baseUrl: 'https://img.cojam.app' });
    expect(good.accepted).toBe(true);
    const m = await t.db.selectFrom('markets').select(['image_state', 'image_key']).where('market_id', '=', id).executeTakeFirstOrThrow();
    expect(m).toEqual({ image_state: 'replaced', image_key: 'q/up.png' });
  });
});
