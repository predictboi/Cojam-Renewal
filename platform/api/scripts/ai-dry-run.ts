// AI pipeline dry run: drafts one day's candidates with the real Claude API, runs the code checks and
// the fresh context validation on them, and shows which 5 would be selected, with token usage and
// cost. Writes nothing (no database, no chain). Without ANTHROPIC_API_KEY it runs the deterministic
// fake provider instead, so the script itself can be checked offline.
//
//   ANTHROPIC_API_KEY=... npx tsx scripts/ai-dry-run.ts [--day 2026-12-03] [--count 12] [--validate 12]
//   npx tsx scripts/ai-dry-run.ts --resolve market.json     # one resolution run pair on a stored question
//
// The day defaults to the day after tomorrow (KST calendar date of the set's open).

import { readFileSync } from 'node:fs';
import { dayIdFromKstDate, dayIdOf, dayLabelKst } from '../../shared/src/time.ts';
import { AnthropicProvider } from '../src/ai/anthropic.ts';
import { FakeProvider } from '../src/ai/fake.ts';
import { DRAFT_SYSTEM, PROMPT_VERSIONS, RESOLVE_SYSTEM, VALIDATE_SYSTEM, draftUser, resolveUser, validateUser, type ResolvePromptMarket } from '../src/ai/prompts.ts';
import type { AiProvider, AiRequest, AiResponse } from '../src/ai/provider.ts';
import { decide, verifyQuotes, type RunSummary } from '../src/ai/resolve.ts';
import { draftSetJson, draftSetZ, resolutionJson, resolutionZ, validationJson, validationZ, type Draft } from '../src/ai/schemas.ts';
import { selectFive } from '../src/ai/select.ts';
import { categoryMix, checkDraft, hostOf, parseIsoWithOffset } from '../src/ai/validate.ts';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const provider: AiProvider = process.env.ANTHROPIC_API_KEY ? new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.AI_MODEL ?? 'claude-opus-5-5' }) : new FakeProvider();
let totalCost = 0;

async function call(req: AiRequest): Promise<AiResponse> {
  const t = Date.now();
  const res = await provider.complete(req);
  totalCost += res.costUsd;
  console.log(`  [${req.job}] ${res.model} stop=${res.stopReason} in=${res.usage.inputTokens} out=${res.usage.outputTokens} searches=${res.usage.webSearches} fetches=${res.usage.webFetches} cost=$${res.costUsd.toFixed(4)} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  if (res.stopReason === 'refusal') console.log(`  refusal: ${JSON.stringify(res.refusal)}`);
  return res;
}

async function dryDraft() {
  const dayId = opt('day') ? dayIdFromKstDate(opt('day')!) : dayIdOf(Date.now() / 1000) + 2;
  const count = Number(opt('count') ?? 12);
  const validateN = Number(opt('validate') ?? count);
  console.log(`Provider: ${provider.name} (${provider.model}). Day ${dayId} (${dayLabelKst(dayId)} KST set).`);
  const mix = categoryMix(dayId);
  const res = await call({ job: 'draft', promptVersion: PROMPT_VERSIONS.draft, system: DRAFT_SYSTEM, user: draftUser(dayId, count, mix, []), schema: draftSetJson, effort: 'medium', maxTokens: 64_000, webSearch: { maxUses: 12 }, meta: { dayId, count } });
  const parsed = draftSetZ.safeParse(res.json);
  if (!parsed.success) {
    console.log('Draft output did not match the schema:', parsed.error.message.slice(0, 800));
    process.exitCode = 1;
    return;
  }
  const accepted: { id: number; d: Draft; quality: number }[] = [];
  for (const [i, d] of parsed.data.candidates.entries()) {
    const code = checkDraft(d, { dayId, minResolveGapSec: 3600 });
    console.log(`\n#${i + 1} [${d.category}/${d.kind}] ${d.en.title}\n   KO ${d.ko.title} | ${d.ko.left} / ${d.ko.right}\n   JA ${d.ja.title} | ${d.ja.left} / ${d.ja.right}\n   observes ${d.observesAt}, resolves ${d.resolvesAt}, p=${d.probabilityRight}\n   sources ${d.primarySource.url} + ${d.secondarySource.url}`);
    if (!code.ok) {
      console.log(`   CODE REJECT: ${code.errors.join('; ')}`);
      continue;
    }
    if (i >= validateN) continue;
    const v = await call({ job: 'validate', promptVersion: PROMPT_VERSIONS.validate, system: VALIDATE_SYSTEM, user: validateUser(dayId, d), schema: validationJson, effort: 'medium', maxTokens: 16_000, webSearch: { maxUses: 3 }, meta: { dayId, title: d.en.title } });
    const vp = validationZ.safeParse(v.json);
    if (!vp.success) {
      console.log('   validation output did not match the schema');
      continue;
    }
    const failed = vp.data.checks.filter((c) => !c.pass);
    console.log(`   VALIDATOR ${vp.data.verdict} q=${vp.data.qualityScore}${failed.length ? ` failed: ${failed.map((c) => `${c.id} (${c.note})`).join(', ')}` : ''}`);
    if (vp.data.verdict === 'accept' && failed.length === 0) accepted.push({ id: i + 1, d, quality: vp.data.qualityScore });
  }
  const chosen = selectFive(
    accepted.map((a) => ({ id: a.id, category: a.d.category, titleEn: a.d.en.title, resolvesAt: parseIsoWithOffset(a.d.resolvesAt)!, quality: a.quality })),
    mix,
    dayId,
  );
  console.log(`\nAccepted ${accepted.length} of ${parsed.data.candidates.length}. Selected: ${chosen.map((c) => `#${c.id} ${c.category}`).join(', ') || 'none'}${chosen.length < 5 ? ' (fewer than 5: the day would stay incomplete)' : ''}`);
}

async function dryResolve(file: string) {
  const m = JSON.parse(readFileSync(file, 'utf8')) as ResolvePromptMarket;
  const domains = [hostOf(m.primary.url), hostOf(m.secondary.url)].filter(Boolean) as string[];
  const runs: RunSummary[] = [];
  for (const run of [1, 2] as const) {
    const res = await call({ job: `resolve_${run}`, promptVersion: PROMPT_VERSIONS.resolve, system: RESOLVE_SYSTEM, user: resolveUser(m, run, Math.floor(Date.now() / 1000)), schema: resolutionJson, effort: 'high', maxTokens: 32_000, webFetch: { allowedDomains: domains, maxUses: 6 }, webSearch: { allowedDomains: domains, maxUses: 4 }, meta: { marketId: m.marketId } });
    const r = resolutionZ.safeParse(res.json);
    if (!r.success) {
      runs.push({ outcome: 'undeterminable', confidence: 0, verifiedQuotes: 0, eventCancelled: false });
      continue;
    }
    const docs = verifyQuotes(r.data.evidence, res.fetched);
    console.log(`  run ${run}: ${r.data.outcome} conf=${r.data.confidence} quotes verified ${docs.filter(Boolean).length}/${r.data.evidence.length}: ${r.data.reasoningSummary}`);
    runs.push({ outcome: r.data.outcome, confidence: r.data.confidence, verifiedQuotes: docs.filter(Boolean).length, eventCancelled: r.data.eventCancelled });
  }
  console.log('Decision:', decide(runs, undefined, Math.floor(Date.now() / 1000), m.dayId));
}

const resolveFile = opt('resolve');
await (resolveFile ? dryResolve(resolveFile) : dryDraft());
console.log(`\nTotal cost: $${totalCost.toFixed(4)}`);
