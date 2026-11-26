// Answer setting (DEV-PLAN 6.4 "Resolution", DECISIONS "Answer setting": fully automatic, two
// independent runs must agree; wrong answers are compensated, never clawed back).
//
//   * Data adapters first where the source is structured; the AI runs are the cross check. No
//     adapter ships yet (interface only): with none, the two AI runs decide.
//   * Run 1 reads the primary source first; run 2 is independent, ordered differently and may read
//     the secondary source first. Tools are limited to the question's source domains.
//   * Every evidence quote must appear in text fetched during that run (code checks it); a run
//     without a verified quote counts as undeterminable.
//   * Both runs (and the adapter when present) agree with confidence >= 0.9: setOutcome.
//     Both say the event was cancelled or postponed: void.
//     Otherwise: retry every hour; 40 hours after the day's end the market is voided (8 hours of
//     margin before the contract's 48 hour deadline).
//   * Inside the settle window a third run checks the answer again. A disagreement triggers one more
//     independent run; `correctOutcome` only when the two re-check runs (plus the adapter) agree on
//     the other answer. Otherwise an alert, and the answer stands.

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dayEnd } from '../../../shared/src/time.ts';
import type { WDb } from '../worker/db.ts';
import type { Logger } from '../worker/log.ts';
import { PROMPT_VERSIONS, RESOLVE_SYSTEM, resolveUser, type ResolvePromptMarket } from './prompts.ts';
import { runLogged, type AiProvider, type FetchedDoc } from './provider.ts';
import { resolutionJson, resolutionZ, type Resolution } from './schemas.ts';
import { hostOf } from './validate.ts';

export const MIN_CONFIDENCE = 0.9;
export const VOID_AFTER_DAY_END_SEC = 40 * 3600;
export const RETRY_EVERY_SEC = 3600;

export type AB = 'A' | 'B';

export interface RunSummary {
  outcome: Resolution['outcome'];
  confidence: number;
  verifiedQuotes: number;
  eventCancelled: boolean;
}

export interface DataAdapter {
  readonly name: string;
  canResolve(m: ResolvePromptMarket): boolean;
  /** 'A' or 'B', or null when the data is not available yet. */
  resolve(m: ResolvePromptMarket): Promise<AB | null>;
}

export function isDecisive(r: RunSummary): r is RunSummary & { outcome: AB } {
  return (r.outcome === 'A' || r.outcome === 'B') && r.confidence >= MIN_CONFIDENCE && r.verifiedQuotes > 0;
}

export type Decision = { action: 'set'; outcome: 1 | 2 } | { action: 'void'; reason: string } | { action: 'wait'; reason: string };

/** The rule for a first answer: two decisive runs on the same answer, and the adapter if any. */
export function decide(runs: RunSummary[], adapter: AB | null | undefined, nowUnix: number, dayId: number): Decision {
  const [r1, r2] = runs;
  if (r1 && r2 && isDecisive(r1) && isDecisive(r2) && r1.outcome === r2.outcome && (adapter === undefined || adapter === r1.outcome)) {
    return { action: 'set', outcome: r1.outcome === 'A' ? 1 : 2 };
  }
  if (r1 && r2 && r1.outcome === 'void' && r2.outcome === 'void' && r1.eventCancelled && r2.eventCancelled && r1.verifiedQuotes > 0 && r2.verifiedQuotes > 0) {
    return { action: 'void', reason: 'cancelled' };
  }
  if (nowUnix >= dayEnd(dayId) + VOID_AFTER_DAY_END_SEC) return { action: 'void', reason: 'unresolved' };
  const why = !r1 || !r2 ? 'missing run' : adapter === null ? 'adapter has no data' : `runs: ${r1.outcome}/${r1.confidence} and ${r2.outcome}/${r2.confidence}`;
  return { action: 'wait', reason: why };
}

export type CorrectionDecision = { action: 'confirm' } | { action: 'more' } | { action: 'correct'; outcome: 1 | 2 } | { action: 'alert'; reason: string };

/**
 * Re-check rule inside the settle window. `rechecks` are the runs made after the answer was set,
 * oldest first. One recheck agreeing with the answer confirms it; a disagreeing one asks for one more;
 * two decisive rechecks on the other answer (plus the adapter) correct it; anything else alerts.
 */
export function decideCorrection(current: 1 | 2, rechecks: RunSummary[], adapter: AB | null | undefined): CorrectionDecision {
  const cur: AB = current === 1 ? 'A' : 'B';
  if (rechecks.length === 0) return { action: 'more' };
  const first = rechecks[0];
  if (isDecisive(first) && first.outcome === cur) return { action: 'confirm' };
  if (rechecks.length === 1) return { action: 'more' };
  const second = rechecks[1];
  if (isDecisive(first) && isDecisive(second) && first.outcome === second.outcome && first.outcome !== cur && (adapter === undefined || adapter === first.outcome)) {
    return { action: 'correct', outcome: first.outcome === 'A' ? 1 : 2 };
  }
  if (isDecisive(second) && second.outcome === cur) return { action: 'confirm' };
  return { action: 'alert', reason: `re-checks disagree with the answer ${cur}: ${rechecks.map((r) => `${r.outcome}/${r.confidence}`).join(', ')}` };
}

function norm(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** For each evidence item, the fetched page that contains its quote verbatim (whitespace and case folded), or null. */
export function verifyQuotes(evidence: Resolution['evidence'], fetched: FetchedDoc[]): (FetchedDoc | null)[] {
  return evidence.map((ev) => {
    const q = norm(ev.quote);
    if (q.length < 3) return null;
    const host = hostOf(ev.url);
    const candidates = fetched.filter((d) => d.url === ev.url || (host && hostOf(d.url) === host));
    return candidates.find((d) => norm(d.text).includes(q)) ?? null;
  });
}

export interface ResolveDeps {
  db: WDb;
  provider: AiProvider;
  log: Logger;
  now: () => number;
  adapters?: DataAdapter[];
}

export async function loadPromptMarket(db: WDb, marketId: number): Promise<ResolvePromptMarket> {
  const m = await db.selectFrom('markets').selectAll().where('market_id', '=', marketId).executeTakeFirstOrThrow();
  const sources = m.sources as { name: string; url: string; role?: string }[];
  const primary = sources.find((s) => s.role === 'primary') ?? sources[0];
  const secondary = sources.find((s) => s.role === 'secondary') ?? sources[1] ?? primary;
  return {
    marketId,
    dayId: m.day_id,
    category: m.category,
    en: m.content.en,
    criteria: m.criteria ?? m.content.en.rule,
    primary,
    secondary,
    resolvesAt: Math.floor((m.resolves_at as Date).getTime() / 1000),
  };
}

/** One AI resolution run, stored in `resolutions` and `evidence` (with the fetched text, gzip). */
export async function runResolution(deps: ResolveDeps, pm: ResolvePromptMarket, run: 1 | 2 | 3): Promise<RunSummary> {
  const domains = [...new Set([hostOf(pm.primary.url), hostOf(pm.secondary.url)].filter(Boolean) as string[])];
  let summary: RunSummary = { outcome: 'undeterminable', confidence: 0, verifiedQuotes: 0, eventCancelled: false };
  let resolution: Resolution | null = null;
  let fetched: FetchedDoc[] = [];
  let runId: number | null = null;
  try {
    const r = await runLogged(
      deps.db,
      deps.provider,
      {
        job: `resolve_${run}`,
        promptVersion: PROMPT_VERSIONS.resolve,
        system: RESOLVE_SYSTEM,
        user: resolveUser(pm, run, deps.now()),
        schema: resolutionJson,
        effort: 'high',
        maxTokens: 32_000,
        webFetch: { allowedDomains: domains, maxUses: 6 },
        webSearch: { allowedDomains: domains, maxUses: 4 },
        meta: { marketId: pm.marketId, run },
      },
      (x) => resolutionZ.parse(x),
    );
    resolution = r.output;
    fetched = r.response.fetched;
    runId = r.runId;
  } catch (e) {
    deps.log.warn('resolve: run failed', { marketId: pm.marketId, run, error: (e as Error).message });
  }
  const docs = resolution ? verifyQuotes(resolution.evidence, fetched) : [];
  if (resolution) {
    const verified = docs.filter(Boolean).length;
    summary = {
      outcome: verified > 0 ? resolution.outcome : resolution.outcome === 'void' ? 'void' : 'undeterminable',
      confidence: Math.max(0, Math.min(1, resolution.confidence)),
      verifiedQuotes: verified,
      eventCancelled: resolution.eventCancelled,
    };
  }
  const row = await deps.db
    .insertInto('resolutions')
    .values({
      market_id: pm.marketId,
      run: String(run) as '1' | '2' | '3',
      outcome: summary.outcome,
      confidence: summary.confidence.toFixed(4),
      reasoning: resolution ? `${resolution.reasoningSummary}${summary.verifiedQuotes === 0 && resolution.evidence.length ? ' [quotes not found in fetched text]' : ''}`.slice(0, 4000) : 'run failed',
      ai_run_id: runId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (resolution) {
    for (let i = 0; i < resolution.evidence.length; i++) {
      const ev = resolution.evidence[i];
      const doc = docs[i];
      const observed = Date.parse(ev.observedAt);
      await deps.db
        .insertInto('evidence')
        .values({
          resolution_id: row.id,
          url: ev.url.slice(0, 2000),
          quote: ev.quote.slice(0, 2000),
          observed_at: Number.isFinite(observed) ? new Date(observed) : null,
          fetched_text_sha256: doc ? createHash('sha256').update(doc.text).digest('hex') : null,
          fetched_text: doc ? gzipSync(Buffer.from(doc.text, 'utf8')) : null,
        })
        .execute();
    }
  }
  return summary;
}

async function adapterAnswer(deps: ResolveDeps, pm: ResolvePromptMarket): Promise<AB | null | undefined> {
  const a = (deps.adapters ?? []).find((x) => x.canResolve(pm));
  if (!a) return undefined;
  try {
    const r = await a.resolve(pm);
    await deps.db.insertInto('resolutions').values({ market_id: pm.marketId, run: 'adapter', outcome: r ?? 'undeterminable', confidence: r ? '1.0000' : '0.0000', reasoning: `adapter ${a.name}` }).execute();
    return r;
  } catch (e) {
    deps.log.warn('resolve: adapter failed', { marketId: pm.marketId, adapter: a.name, error: (e as Error).message });
    return null;
  }
}

/** Runs the first answer of a market (adapter, run 1, run 2) and returns the decision. Sends nothing. */
export async function resolveMarket(deps: ResolveDeps, marketId: number): Promise<Decision> {
  const pm = await loadPromptMarket(deps.db, marketId);
  const adapter = await adapterAnswer(deps, pm);
  const r1 = await runResolution(deps, pm, 1);
  const r2 = await runResolution(deps, pm, 2);
  return decide([r1, r2], adapter, deps.now(), pm.dayId);
}

/** The re-check inside the settle window. Runs at most two re-check runs. Sends nothing. */
export async function recheckMarket(deps: ResolveDeps, marketId: number, current: 1 | 2): Promise<CorrectionDecision> {
  const pm = await loadPromptMarket(deps.db, marketId);
  const adapter = await adapterAnswer(deps, pm);
  const runs: RunSummary[] = [await runResolution(deps, pm, 3)];
  let d = decideCorrection(current, runs, adapter);
  if (d.action === 'more') {
    runs.push(await runResolution(deps, pm, 3));
    d = decideCorrection(current, runs, adapter);
  }
  return d;
}
