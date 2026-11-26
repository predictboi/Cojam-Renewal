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
import { DRAFT_SYSTEM, PROMPT_VERSIONS, VALIDATE_SYSTEM, draftUser, validateUser } from './prompts.ts';
import { AiOutputError, runLogged, type AiProvider } from './provider.ts';
import { CHECKLIST, draftSetJson, draftSetZ, draftZ, normCategory, validationJson, validationZ, type Category, type Draft } from './schemas.ts';
import { selectFive, type Candidate } from './select.ts';
import { categoryMix, checkDraft, parseIsoWithOffset, type RecentQuestion } from './validate.ts';

export interface AiDeps {
  db: WDb;
  provider: AiProvider;
  log: Logger;
  now: () => number; // unix seconds
  minResolveGapSec: number;
  candidates?: number; // per drafting call, default 12
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
async function aiValidate(deps: AiDeps, dayId: number, d: Draft): Promise<{ ok: true; quality: number; result: unknown } | { ok: false; reason: string; result: unknown }> {
  try {
    const { output, runId } = await runLogged(
      deps.db,
      deps.provider,
      {
        job: 'validate',
        promptVersion: PROMPT_VERSIONS.validate,
        system: VALIDATE_SYSTEM,
        user: validateUser(dayId, d),
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
  const cands: (Candidate & { d: Draft })[] = [];
  for (const r of rows) {
    const parsed = draftZ.safeParse(r.payload);
    if (!parsed.success) continue;
    const d = parsed.data;
    // Re-run the code checks: the duplicate list and the clock have moved since drafting.
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent });
    if (!code.ok) continue;
    const q = (r.validator_result as { ai?: { qualityScore?: number } } | null)?.ai?.qualityScore ?? 0.5;
    cands.push({ id: r.id, category: d.category, titleEn: d.en.title, resolvesAt: code.times!.resolvesAt, quality: q, d });
  }
  // The bands rule counts the questions already on the day.
  const existing = await deps.db.selectFrom('markets').select(['resolves_at', 'content']).where('day_id', '=', dayId).where('status', 'in', [...ACTIVE]).execute();
  const pinned: Candidate[] = existing.map((e, i) => ({ id: -1 - i, category: 'Crypto', titleEn: e.content.en.title, resolvesAt: Math.floor((e.resolves_at as Date).getTime() / 1000), quality: 2 }));
  const picked = selectFive([...pinned, ...cands], remainingMix(dayId, taken), dayId)
    .filter((c) => c.id >= 0)
    .slice(0, free.length);
  const chosen = picked.map((c) => ({ draftId: c.id, d: cands.find((x) => x.id === c.id)!.d }));
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
        user: draftUser(dayId, count, remainingMix(dayId, taken), recent.slice(-60).map((x) => x.titleEn)),
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

  for (const d of drafts) {
    const code = checkDraft(d, { dayId, minResolveGapSec: deps.minResolveGapSec, recent });
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
