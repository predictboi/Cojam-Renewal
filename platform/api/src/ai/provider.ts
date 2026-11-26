// The AI provider seam. The pipeline (draft, validate, resolve, image prompt and check) talks to an
// `AiProvider`; production uses `AnthropicProvider` (src/ai/anthropic.ts), tests and dry runs use
// `FakeProvider` (src/ai/fake.ts). Every call goes through `runLogged`, which writes one `ai_runs`
// row with the job, model, prompt version, token usage, cost and stop reason.

import type { Db } from '../db/index.ts';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ImageInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  base64: string;
}

export interface AiRequest {
  job: string; // draft, validate, resolve_1, resolve_2, resolve_3, image_prompt, image_check
  promptVersion: string;
  system: string;
  user: string;
  images?: ImageInput[];
  /** JSON schema of the structured output. */
  schema: Record<string, unknown>;
  effort: Effort;
  maxTokens?: number;
  webSearch?: { allowedDomains?: string[]; maxUses?: number };
  webFetch?: { allowedDomains?: string[]; maxUses?: number };
  /** Free form tags for the fake provider and the logs (e.g. market id). */
  meta?: Record<string, unknown>;
}

export interface FetchedDoc {
  url: string;
  text: string;
  retrievedAt: string | null;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  webFetches: number;
}

export interface AiResponse {
  /** Parsed JSON of the structured output, or null when the model refused or produced nothing usable. */
  json: unknown | null;
  text: string;
  model: string; // the model that served the turn (a fallback model when one ran)
  stopReason: string | null;
  usage: AiUsage;
  costUsd: number;
  /** Pages fetched by web_fetch during the call, used to verify evidence quotes. */
  fetched: FetchedDoc[];
  refusal?: { category: string | null; explanation: string | null };
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(req: AiRequest): Promise<AiResponse>;
}

export class AiOutputError extends Error {
  constructor(
    message: string,
    readonly runId: number | null,
    readonly response?: AiResponse,
  ) {
    super(message);
  }
}

/**
 * USD per million tokens and per server tool use. Opus 5.5: $4 input, $20 output, $0.20 cache
 * reads; cache writes at 1.25x input; web search $10 per 1,000 searches; web fetch has no charge
 * beyond the tokens it adds. Update when prices change.
 */
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number; perSearch: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, perSearch: 0.01 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, perSearch: 0.01 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, perSearch: 0.01 },
};

export function costOf(model: string, u: AiUsage): number {
  const p = PRICING[model] ?? PRICING['claude-opus-5-5'];
  return (
    (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1e6 +
    u.webSearches * p.perSearch
  );
}

export interface LoggedResult<T> {
  runId: number;
  output: T;
  response: AiResponse;
}

/**
 * Calls the provider, logs the run, and validates the output with `parse` (a zod `parse`). A
 * refusal, an unparsable answer or a schema mismatch is logged with its error and thrown as
 * `AiOutputError`; the caller decides what that means (skip a draft, retry a resolution later).
 */
export async function runLogged<T>(db: Db, provider: AiProvider, req: AiRequest, parse: (x: unknown) => T): Promise<LoggedResult<T>> {
  let res: AiResponse | undefined;
  let error: string | null = null;
  try {
    res = await provider.complete(req);
  } catch (e) {
    error = `provider error: ${(e as Error).message}`.slice(0, 500);
  }
  let output: T | undefined;
  if (res && !error) {
    if (res.stopReason === 'refusal') error = `refusal${res.refusal?.category ? ` (${res.refusal.category})` : ''}`;
    else if (res.json === null) error = `no structured output (stop reason ${res.stopReason})`;
    else {
      try {
        output = parse(res.json);
      } catch (e) {
        error = `schema mismatch: ${(e as Error).message}`.slice(0, 500);
      }
    }
  }
  const row = await db
    .insertInto('ai_runs')
    .values({
      job: req.job,
      model: res?.model ?? provider.model,
      prompt_version: req.promptVersion,
      input_tokens: res ? res.usage.inputTokens + res.usage.cacheReadTokens + res.usage.cacheWriteTokens : null,
      output_tokens: res?.usage.outputTokens ?? null,
      cost_usd: res ? res.costUsd.toFixed(6) : null,
      stop_reason: res?.stopReason ?? null,
      error,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (error || output === undefined || !res) throw new AiOutputError(error ?? 'no output', row.id, res);
  return { runId: row.id, output, response: res };
}
