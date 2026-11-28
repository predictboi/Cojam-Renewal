// Drafting, validation and selection of a day's questions (DEV-PLAN 6.4):
//   1. one drafting call (web search) writes about 12 candidates natively in EN, KO and JA;
//   2. each candidate passes the code checks (src/ai/validate.ts), then an independent validation
//      call in a fresh context with the rules as a checklist;
//   3. the best 5 by category mix are written to `markets` as `scheduled`, with their content hash;
//      the others stay in `market_drafts` as the day's reserve (a cancelled question is replaced
//      from them without a new drafting call).

import { sql } from 'kysely';
import { dayEnd } from '../../../shared/src/time.ts';
import type { WDb } from '../worker/db.ts';
import type { Logger } from '../worker/log.ts';
import { contentHash } from './contentHash.ts';
import { DRAFT_SYSTEM, PROMPT_VERSIONS, VALIDATE_SYSTEM, draftOutsideUser, draftUser, validateUser, type OutsidePromptMarket } from './prompts.ts';
import { AiOutputError, runLogged, type AiProvider } from './provider.ts';
import { CHECKLIST, draftSetJson, draftSetZ, draftZ, normCategory, outsideDraftSetJson, validationJson, validationZ, type Category, type Draft } from './schemas.ts';
import { fitsWith, selectFive, type Candidate } from './select.ts';
import { categoryMix, checkDraft, checkOutsideLink, parseIsoWithOffset, type RecentQuestion } from './validate.ts';
import { effectiveTiming, storedTiming } from './timing.ts';
import { outsideCandidates, promptMarket } from './outside.ts';
import type { OutsideMarket, OutsideMarkets } from '../dataRoom/polymarket.ts';
import { audit } from '../db/index.ts';

export interface AiDeps {
  db: WDb;
  provider: AiProvider;
  log: Logger;
  now: () => number; // unix seconds
  minResolveGapSec: number;
  candidates?: number; // per drafting call, default 12
  /** The deployed contract accepts long questions (worker setting LONG_QUESTIONS_ON_CHAIN). */
  longOnChain?: boolean;
  /** CojamPredict `params().maxResolveAfterClose` (seconds): caps longMaxDays and every answer time. */
  maxResolveAfterCloseSec?: number;
  /** Outside markets for the Polymarket source step (matchOutsideDay). */
  outside?: OutsideMarkets;
}

async function timingOf(deps: AiDeps) {
  return effectiveTiming(await storedTiming(deps.db as never), Boolean(deps.longOnChain), deps.maxResolveAfterCloseSec);
}

export interface DraftOutcome {
  dayId: number;
  drafted: number;
  accepted: number;
  scheduled: number[]; // market ids written
  missingSlots: number[];
}

const ACTIVE = ['draft', 'scheduled', 'published', 'closed', 'resolved', 'voided', 'corrected'] as const;

async function takenSlots(db: WDb, dayId: number) {
  return db.selectFrom('markets').select(['slot', 'category', 'market_id', 'status']).where('day_id', '=', dayId).where('status', 'in', [...ACTIVE]).execute();
}

async function recentQuestions(db: WDb, dayId: number): Promise<RecentQuestion[]> {
  const rows = await db
    .selectFrom('markets')
    .select(['content', 'sources', 'observes_at', 'resolves_at'])
    .where('day_id', '>=', dayId - 30)
    .where('day_id', '<=', dayId + 7)
    .where('status', '!=', 'cancelled')
    .execute();
  return rows.map((r) => ({
    titleEn: r.content.en.title,
    primaryUrl: (r.sources as { url: string }[])[0]?.url ?? '',
    observesAt: Math.floor(((r.observes_at ?? r.resolves_at) as Date).getTime() / 1000),
  }));
}

/** Validates one draft in a fresh context. Returns quality (0..1) when accepted, or the reason. */
async function aiValidate(deps: AiDeps, dayId: number, d: Draft, outside?: OutsidePromptMarket | null): Promise<{ ok: true; quality: number; result: unknown } | { ok: false; reason: string; result: unknown }> {
  try {
    const { output, runId } = await runLogged(
      deps.db,
      deps.provider,
      {
        job: 'validate',
        promptVersion: PROMPT_VERSIONS.validate,
        system: VALIDATE_SYSTEM,
        user: validateUser(dayId, d, outside),
        schema: validationJson,
        effort: 'medium',
        maxTokens: 16_000,
        webSearch: { maxUses: 3 },
        meta: { dayId, title: d.en.title },
      },
      (x) => validationZ.parse(x),
    );
    const failed = CHECKLIST.filter((id) => !output.checks.some((c) => c.id === id && c.pass));
    const result = { ...output, aiRunId: runId };
    if (output.verdict !== 'accept' || failed.length) return { ok: false, reason: `validator: ${failed.join(', ') || output.summary}`, result };
    return { ok: true, quality: Math.max(0, Math.min(1, output.qualityScore)), result };
  } catch (e) {
    return { ok: false, reason: `validator error: ${(e as Error).message}`, result: null };
  }
}

/**
 * Writes the chosen drafts into the free slots of the day. A cancelled market that still holds the
 * planned id is moved aside (negative id, `replaced_by` set) so the history is kept.
 */
async function schedule(db: WDb, dayId: number, chosen: { draftId: number; d: Draft }[], freeSlots: number[]): Promise<number[]> {
  const written: number[] = [];
  await db.transaction().execute(async (tx) => {
    for (let i = 0; i < chosen.length && i < freeSlots.length; i++) {
      const { draftId, d } = chosen[i];
      const slot = freeSlots[i];
      const marketId = dayId * 5 + slot;
      const old = await tx.selectFrom('markets').select(['market_id', 'status']).where('market_id', '=', marketId).executeTakeFirst();
      if (old) {
        if (old.status !== 'cancelled') continue;
        const aside = -(marketId * 100 + Math.floor(Math.random() * 90 + 10));
        await tx.updateTable('markets').set({ market_id: aside, replaced_by: marketId, updated_at: new Date() }).where('market_id', '=', marketId).execute();
      }
      const closesAt = dayEnd(dayId);
      const resolvesAt = parseIsoWithOffset(d.resolvesAt)!;
      const observesAt = parseIsoWithOffset(d.observesAt)!;
      const sources = [
        { name: d.primarySource.name, url: d.primarySource.url, role: 'primary' as const },
        { name: d.secondarySource.name, url: d.secondarySource.url, role: 'secondary' as const },
      ];
      const hash = contentHash({ en: d.en, ko: d.ko, ja: d.ja, closesAt, resolvesAt, sources: sources.map(({ name, url }) => ({ name, url })) });
      await tx
        .insertInto('markets')
        .values({
          market_id: marketId,
          day_id: dayId,
          slot,
          category: d.category,
          content: JSON.stringify({ en: d.en, ko: d.ko, ja: d.ja }),
          closes_at: new Date(closesAt * 1000),
          resolves_at: new Date(resolvesAt * 1000),
          observes_at: new Date(observesAt * 1000),
          kind: d.kind,
          sources: JSON.stringify(sources),
          criteria: d.criteria,
          rationale: d.rationale,
          content_hash: hash,
          image_state: 'pending',
          status: 'scheduled',
          draft_id: draftId,
        })
        .execute();
      if (d.outsideSlug && d.outsideUrl && d.outsideRightOutcome) {
        // The drafter mirrored an outside market: link it for the data room comparison (price read at our close).
        await tx
          .insertInto('market_outside')
          .values({ market_id: marketId, source: 'polymarket', url: d.outsideUrl, market_slug: d.outsideSlug, right_outcome: d.outsideRightOutcome, linked_by: 'drafter' })
          .onConflict((oc) => oc.column('market_id').doUpdateSet({ url: d.outsideUrl!, market_slug: d.outsideSlug!, right_outcome: d.outsideRightOutcome!, linked_by: 'drafter', right_price: null, taken_at: null, attempted_at: null, error: null, updated_at: new Date() }))
          .execute();
      }
      await tx.updateTable('market_drafts').set({ selected: true }).where('id', '=', draftId).execute();
      written.push(marketId);
    }
  });
  return written;
}

function freeSlotsOf(taken: { slot: number }[]): number[] {
  const t = new Set(taken.map((x) => x.slot));
  return [0, 1, 2, 3, 4].filter((s) => !t.has(s));
}

function remainingMix(dayId: number, taken: { category: string }[]): Record<Category, number> {
  const mix = categoryMix(dayId);
  for (const t of taken) {
    const c = normCategory(t.category);
    if (c && mix[c] > 0) mix[c]--;
  }
  return mix;
}

/** Fills free slots from accepted, unselected drafts of the day (no AI call). */
export async function fillFromReserve(deps: AiDeps, dayId: number): Promise<number[]> {
  const taken = await takenSlots(deps.db, dayId);
  const free = freeSlotsOf(taken);
  if (free.length === 0) return [];
  const rows = await deps.db
    .selectFrom('market_drafts')
    .select(['id', 'payload', 'validator_result'])
    .where('target_day', '=', dayId)
    .where('selected', '=', false)
    .where('rejected_reason', 'is', null)
    .execute();
  const recent = await recentQuestions(deps.db, dayId);
  const timing = await timingOf(deps);
  const linkedSlugs = await linkedSlugsOf(deps.db, dayId);
  const cands: (Candidate & { d: Draft })[] = [];
  for (const r of rows) {
    const parsed = draftZ.safeParse(r.payload);
    if (!parsed.success) continue;
    const d = parsed.data;
    // Re-run the code checks: the duplicate list and the clock have moved since drafting.
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent, longMaxDays: timing.longMaxDays, maxResolveAfterCloseSec: deps.maxResolveAfterCloseSec });
    if (!code.ok) continue;
    if (d.outsideSlug && linkedSlugs.has(d.outsideSlug)) continue; // one question per outside market
    const q = (r.validator_result as { ai?: { qualityScore?: number } } | null)?.ai?.qualityScore ?? 0.5;
    cands.push({ id: r.id, category: d.category, titleEn: d.en.title, resolvesAt: code.times!.resolvesAt, quality: q, linked: Boolean(d.outsideSlug), d });
  }
  // The bands rule counts the questions already on the day.
  const existing = await deps.db.selectFrom('markets').select(['resolves_at', 'content']).where('day_id', '=', dayId).where('status', 'in', [...ACTIVE]).execute();
  const pinned: Candidate[] = existing.map((e, i) => ({ id: -1 - i, category: 'Crypto', titleEn: e.content.en.title, resolvesAt: Math.floor((e.resolves_at as Date).getTime() / 1000), quality: 2 }));
  const picked = selectFive([...pinned, ...cands], remainingMix(dayId, taken), dayId, { maxLong: timing.maxLong })
    .filter((c) => c.id >= 0)
    .slice(0, free.length);
  // Two drafts of the same outside market: keep the first only.
  const slugs = new Set<string>();
  const chosen = picked
    .map((c) => ({ draftId: c.id, d: cands.find((x) => x.id === c.id)!.d }))
    .filter((c) => !c.d.outsideSlug || (!slugs.has(c.d.outsideSlug) && slugs.add(c.d.outsideSlug)));
  return schedule(deps.db, dayId, chosen, free);
}

/** Drafts candidates for `dayId` when it has free slots, validates them and schedules the best. */
export async function draftDay(deps: AiDeps, dayId: number): Promise<DraftOutcome> {
  const out: DraftOutcome = { dayId, drafted: 0, accepted: 0, scheduled: [], missingSlots: [] };
  out.scheduled.push(...(await fillFromReserve(deps, dayId)));
  let taken = await takenSlots(deps.db, dayId);
  if (freeSlotsOf(taken).length === 0) return out;

  const recent = await recentQuestions(deps.db, dayId);
  const count = deps.candidates ?? 12;
  const timing = await timingOf(deps);
  let drafts: Draft[] = [];
  let draftRunId: number | null = null;
  try {
    const r = await runLogged(
      deps.db,
      deps.provider,
      {
        job: 'draft',
        promptVersion: PROMPT_VERSIONS.draft,
        system: DRAFT_SYSTEM,
        user: draftUser(dayId, count, remainingMix(dayId, taken), recent.slice(-60).map((x) => x.titleEn), timing),
        schema: draftSetJson,
        effort: 'medium',
        maxTokens: 64_000,
        webSearch: { maxUses: 12 },
        meta: { dayId, count },
      },
      (x) => draftSetZ.parse(x),
    );
    drafts = r.output.candidates;
    draftRunId = r.runId;
  } catch (e) {
    deps.log.error('draft: drafting call failed', { dayId, error: (e as Error).message, runId: e instanceof AiOutputError ? e.runId : null });
    out.missingSlots = freeSlotsOf(taken);
    return out;
  }
  out.drafted = drafts.length;

  for (const d0 of drafts) {
    // Our own questions carry no outside link (only the source step may set one, from a listed market).
    const { outsideSlug: _s, outsideRightOutcome: _r, outsideUrl: _u, ...d } = d0;
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent, longMaxDays: timing.longMaxDays, maxResolveAfterCloseSec: deps.maxResolveAfterCloseSec });
    let rejected: string | null = code.ok ? null : `code: ${code.errors.join('; ')}`;
    let ai: unknown = null;
    if (!rejected) {
      const v = await aiValidate(deps, dayId, d);
      ai = v.result;
      if (!v.ok) rejected = v.reason;
    }
    await deps.db
      .insertInto('market_drafts')
      .values({
        target_day: dayId,
        payload: JSON.stringify(d),
        validator_result: JSON.stringify({ code: { ok: code.ok, errors: code.errors }, ai }),
        rejected_reason: rejected ? rejected.slice(0, 1000) : null,
        ai_run_id: draftRunId,
      })
      .execute();
    if (!rejected) out.accepted++;
  }

  out.scheduled.push(...(await fillFromReserve(deps, dayId)));
  taken = await takenSlots(deps.db, dayId);
  out.missingSlots = freeSlotsOf(taken);
  deps.log.info('draft: day drafted', { ...out });
  return out;
}

/** Days that need questions: from tomorrow (D+1) to D+horizon, any with fewer than 5 active markets. */
export async function daysNeedingQuestions(db: WDb, today: number, horizon: number): Promise<number[]> {
  const rows = await db
    .selectFrom('markets')
    .select(['day_id', sql<number>`count(*)::int`.as('n')])
    .where('day_id', '>', today)
    .where('day_id', '<=', today + horizon)
    .where('status', 'in', [...ACTIVE])
    .groupBy('day_id')
    .execute();
  const have = new Map(rows.map((r) => [Number(r.day_id), r.n]));
  const out: number[] = [];
  for (let d = today + 1; d <= today + horizon; d++) if ((have.get(d) ?? 0) < 5) out.push(d);
  return out;
}

// ---------------------------------------------------------------- questions from Polymarket

/** Outside slugs already linked to a question of the day. */
async function linkedSlugsOf(db: WDb, dayId: number): Promise<Set<string>> {
  const rows = await db
    .selectFrom('market_outside as o')
    .innerJoin('markets as m', 'm.market_id', 'o.market_id')
    .select('o.market_slug')
    .where('m.day_id', '=', dayId)
    .where('m.status', 'in', [...ACTIVE])
    .execute();
  return new Set(rows.map((r) => r.market_slug));
}

export interface MatchOutcome {
  dayId: number;
  /** Why nothing was tried (the set is on chain, no source, the list could not be read). */
  skipped: string | null;
  candidates: number;
  drafted: number;
  accepted: number;
  /** Free slots filled (market ids). */
  filled: number[];
  /** Own questions replaced by a mirrored one: { from: old market id moved aside, to: market id }. */
  replaced: number[];
}

/**
 * The Polymarket source step for one day (run at the 18:00 KST drafting run for the next day's set, before it goes on
 * chain from 12:00 UTC): list the outside markets that fit our timing rule, let the drafter write native questions that
 * mirror them, check each against the market read again (open, binary, the outcome named, end time agreeing with our
 * answer time), validate in a fresh context, then prefer them slot by slot: free slots first, then an own scheduled
 * question of the same category is replaced when the mirrored one fits the set. A slot with no fitting market keeps
 * our own question. Our answer is still set by our AI from the answer source, never read from the outside market.
 */
export async function matchOutsideDay(deps: AiDeps, dayId: number): Promise<MatchOutcome> {
  const out: MatchOutcome = { dayId, skipped: null, candidates: 0, drafted: 0, accepted: 0, filled: [], replaced: [] };
  if (!deps.outside) return { ...out, skipped: 'no outside source' };
  const day = await deps.db.selectFrom('markets').select(['market_id', 'slot', 'category', 'status', 'create_tx', 'resolves_at', 'content', 'draft_id']).where('day_id', '=', dayId).where('status', 'in', [...ACTIVE]).execute();
  if (day.some((m) => m.create_tx || (m.status !== 'scheduled' && m.status !== 'draft'))) return { ...out, skipped: 'the set is already on chain' };
  const timing = await timingOf(deps);
  let list: OutsideMarket[];
  try {
    list = await outsideCandidates(deps.outside, dayId, timing.longMaxDays);
  } catch (e) {
    deps.log.warn('match: outside markets could not be listed', { dayId, error: (e as Error).message });
    return { ...out, skipped: 'outside list failed' };
  }
  out.candidates = list.length;
  if (!list.length) return out; // every slot keeps our own question

  const recent = await recentQuestions(deps.db, dayId);
  const linked = await linkedSlugsOf(deps.db, dayId);
  const count = Math.min(deps.candidates ?? 12, Math.max(5, list.length));
  let drafts: Draft[] = [];
  let runId: number | null = null;
  try {
    const r = await runLogged(
      deps.db,
      deps.provider,
      {
        job: 'draft_outside',
        promptVersion: PROMPT_VERSIONS.draftOutside,
        system: DRAFT_SYSTEM,
        user: draftOutsideUser(dayId, count, categoryMix(dayId), recent.slice(-60).map((x) => x.titleEn), timing, list.map(promptMarket)),
        schema: outsideDraftSetJson,
        effort: 'medium',
        maxTokens: 64_000,
        webSearch: { maxUses: 8 },
        meta: { dayId, count, outside: list.map((m) => m.slug) },
      },
      (x) => draftSetZ.parse(x),
    );
    drafts = r.output.candidates;
    runId = r.runId;
  } catch (e) {
    deps.log.error('match: drafting call failed', { dayId, error: (e as Error).message, runId: e instanceof AiOutputError ? e.runId : null });
    return { ...out, skipped: 'drafting call failed' };
  }
  out.drafted = drafts.length;

  for (const d0 of drafts) {
    const slug = d0.outsideSlug?.trim() || '';
    const listed = list.find((m) => m.slug === slug);
    let d: Draft = { ...d0, outsideSlug: slug || undefined, outsideUrl: listed?.url };
    let errors: string[] = [];
    let fresh: OutsideMarket | null = null;
    if (!listed) {
      // Not mirrored after all: keep it as an own question, without a link.
      const { outsideSlug: _s, outsideRightOutcome: _r, outsideUrl: _u, ...own } = d;
      d = own;
    } else if (linked.has(slug)) errors.push('that outside market is already linked to a question of the day');
    else {
      fresh = await deps.outside.market(slug).catch(() => null);
      if (!fresh) errors.push('the outside market cannot be read again');
      else errors.push(...checkOutsideLink(d, fresh, dayId, timing.longMaxDays));
    }
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent, longMaxDays: timing.longMaxDays, maxResolveAfterCloseSec: deps.maxResolveAfterCloseSec });
    errors = [...code.errors, ...errors];
    let rejected: string | null = errors.length ? `code: ${errors.join('; ')}` : null;
    let ai: unknown = null;
    if (!rejected) {
      const v = await aiValidate(deps, dayId, d, fresh ? promptMarket(fresh) : null);
      ai = v.result;
      if (!v.ok) rejected = v.reason;
    }
    await deps.db
      .insertInto('market_drafts')
      .values({
        target_day: dayId,
        payload: JSON.stringify(d),
        validator_result: JSON.stringify({ code: { ok: !errors.length, errors }, ai, outside: fresh ? { slug, endsAt: fresh.endsAt } : null }),
        rejected_reason: rejected ? rejected.slice(0, 1000) : null,
        ai_run_id: runId,
      })
      .execute();
    if (!rejected) out.accepted++;
  }

  // Free slots: the reserve selection ranks a linked draft above any own draft of its category.
  out.filled = await fillFromReserve(deps, dayId);

  // Occupied slots: replace an own scheduled question by an accepted mirrored one of the same category.
  const rows = await deps.db
    .selectFrom('market_drafts')
    .select(['id', 'payload', 'validator_result'])
    .where('target_day', '=', dayId)
    .where('selected', '=', false)
    .where('rejected_reason', 'is', null)
    .execute();
  const usedSlugs = await linkedSlugsOf(deps.db, dayId);
  const mirrored = rows
    .map((r) => ({ id: r.id, d: draftZ.safeParse(r.payload), q: (r.validator_result as { ai?: { qualityScore?: number } } | null)?.ai?.qualityScore ?? 0.5 }))
    .filter((x): x is { id: number; d: { success: true; data: Draft }; q: number } => x.d.success && Boolean(x.d.data.outsideSlug && x.d.data.outsideUrl))
    .sort((a, b) => b.q - a.q || a.id - b.id);
  for (const cand of mirrored) {
    const d = cand.d.data;
    if (usedSlugs.has(d.outsideSlug!)) continue;
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent, longMaxDays: timing.longMaxDays, maxResolveAfterCloseSec: deps.maxResolveAfterCloseSec });
    if (!code.ok) continue;
    const current = await deps.db.selectFrom('markets').select(['market_id', 'slot', 'category', 'status', 'create_tx', 'resolves_at', 'content', 'draft_id']).where('day_id', '=', dayId).where('status', 'in', [...ACTIVE]).execute();
    if (current.some((m) => m.create_tx)) break;
    const linkedIds = new Set(
      (await deps.db.selectFrom('market_outside').select('market_id').where('market_id', 'in', current.length ? current.map((m) => m.market_id) : [-1]).execute()).map((r) => r.market_id),
    );
    const asCand = (m: (typeof current)[number]): Candidate => ({ id: -1 - m.slot, category: normCategory(m.category) ?? 'Culture', titleEn: m.content.en.title, resolvesAt: Math.floor((m.resolves_at as Date).getTime() / 1000), quality: 0 });
    const next: Candidate = { id: cand.id, category: d.category, titleEn: d.en.title, resolvesAt: code.times!.resolvesAt, quality: cand.q, linked: true };
    const target = current.find((m) => m.status === 'scheduled' && !linkedIds.has(m.market_id) && normCategory(m.category) === d.category && fitsWith(current.filter((x) => x.market_id !== m.market_id).map(asCand), next, dayId, timing.maxLong));
    if (!target) continue;
    await deps.db.transaction().execute(async (tx) => {
      await tx.updateTable('markets').set({ status: 'cancelled', updated_at: new Date() }).where('market_id', '=', target.market_id).execute();
      if (target.draft_id) await tx.updateTable('market_drafts').set({ selected: false }).where('id', '=', target.draft_id).execute();
      await audit(tx as never, { actor: 'drafter', action: 'question.replaced_by_outside', target: String(target.market_id), payload: { outsideSlug: d.outsideSlug, previous: target.content.en.title, next: d.en.title } });
    });
    const written = await schedule(deps.db, dayId, [{ draftId: cand.id, d }], [target.slot]);
    if (written.length) {
      out.replaced.push(...written);
      usedSlugs.add(d.outsideSlug!);
    }
  }
  deps.log.info('match: outside markets', { ...out });
  return out;
}
