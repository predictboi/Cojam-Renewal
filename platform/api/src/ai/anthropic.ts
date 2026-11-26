// Production AI provider: the Claude API through the Anthropic TypeScript SDK (DEV-PLAN 6.4).
// claude-opus-5-5 with adaptive thinking (effort per job), structured outputs (output_config.format
// json_schema), web_search_20260209 and web_fetch_20260209 with per question domain allow lists,
// and server side refusal fallbacks (`fallbacks: "default"`). Streaming is used so long turns with
// server tools never hit the HTTP timeout; a `pause_turn` is resumed up to 5 times.

import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { costOf, type AiProvider, type AiRequest, type AiResponse, type AiUsage, type FetchedDoc } from './provider.ts';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_CONTINUATIONS = 5;

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;

  constructor(opts: AnthropicProviderOptions = {}) {
    this.model = opts.model ?? 'claude-opus-5-5';
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    const tools: BetaToolUnion[] = [];
    if (req.webSearch) {
      tools.push({
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: req.webSearch.maxUses ?? 8,
        ...(req.webSearch.allowedDomains?.length ? { allowed_domains: req.webSearch.allowedDomains } : {}),
      });
    }
    if (req.webFetch) {
      tools.push({
        type: 'web_fetch_20260209',
        name: 'web_fetch',
        max_uses: req.webFetch.maxUses ?? 6,
        max_content_tokens: 60_000,
        ...(req.webFetch.allowedDomains?.length ? { allowed_domains: req.webFetch.allowedDomains } : {}),
      });
    }

    const userContent: BetaContentBlockParam[] = [
      ...(req.images ?? []).map(
        (img): BetaContentBlockParam => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } }),
      ),
      { type: 'text', text: req.user },
    ];
    const messages: BetaMessageParam[] = [{ role: 'user', content: userContent }];

    const usage: AiUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0 };
    const fetched: FetchedDoc[] = [];
    let last: BetaMessage | null = null;

    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens ?? 32_000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        system: req.system,
        messages,
        ...(tools.length ? { tools } : {}),
        output_config: { effort: req.effort, format: { type: 'json_schema', schema: req.schema } },
      });
      const msg = await stream.finalMessage();
      last = msg;
      usage.inputTokens += msg.usage.input_tokens;
      usage.outputTokens += msg.usage.output_tokens;
      usage.cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += msg.usage.cache_creation_input_tokens ?? 0;
      usage.webSearches += msg.usage.server_tool_use?.web_search_requests ?? 0;
      usage.webFetches += msg.usage.server_tool_use?.web_fetch_requests ?? 0;
      collectFetched(msg.content, fetched);
      if (msg.stop_reason !== 'pause_turn') break;
      // Resume: send the assistant turn back unchanged; the server continues where it stopped.
      messages.push({ role: 'assistant', content: msg.content as unknown as BetaContentBlockParam[] });
    }

    const msg = last!;
    const text = msg.content
      .filter((b): b is Extract<BetaContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let json: unknown | null = null;
    if (msg.stop_reason !== 'refusal' && text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    const details = (msg as unknown as { stop_details?: { category?: string | null; explanation?: string | null } | null }).stop_details;
    return {
      json,
      text,
      model: msg.model,
      stopReason: msg.stop_reason,
      usage,
      costUsd: costOf(msg.model, usage),
      fetched,
      ...(msg.stop_reason === 'refusal' ? { refusal: { category: details?.category ?? null, explanation: details?.explanation ?? null } } : {}),
    };
  }
}

/** Plain text of every page web_fetch returned (PDFs are kept out: quotes must match plain text). */
export function collectFetched(content: BetaContentBlock[], into: FetchedDoc[]): void {
  for (const b of content) {
    if (b.type !== 'web_fetch_tool_result') continue;
    const c = b.content;
    if (c.type !== 'web_fetch_result') continue;
    const src = c.content.source;
    if (src.type === 'text') into.push({ url: c.url, text: src.data, retrievedAt: c.retrieved_at });
  }
}
