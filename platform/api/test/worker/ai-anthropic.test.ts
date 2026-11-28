// The production provider's request shape and response handling, with a stubbed SDK client (no key,
// no network): model, adaptive thinking, effort, structured output, server side fallbacks, tools with
// domain allow lists, pause_turn resumption, fetched pages collected for quote checks, refusals.
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider } from '../../src/ai/anthropic.ts';
import { costOf } from '../../src/ai/provider.ts';

function stubClient(messages: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (req: Record<string, unknown>) => {
          requests.push(JSON.parse(JSON.stringify(req)));
          const m = messages.shift();
          return { finalMessage: async () => m };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const usage = (i: number, o: number, s = 0, f = 0) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: s, web_fetch_requests: f } });

describe('AnthropicProvider', () => {
  it('sends the decided request shape and parses the structured output', async () => {
    const { client, requests } = stubClient([
      {
        model: 'claude-opus-5-5',
        stop_reason: 'pause_turn',
        content: [
          { type: 'server_tool_use', id: 'x', name: 'web_fetch', input: { url: 'https://www.binance.com/a' } },
          { type: 'web_fetch_tool_result', tool_use_id: 'x', content: { type: 'web_fetch_result', url: 'https://www.binance.com/a', retrieved_at: '2026-12-04T12:01:00Z', content: { type: 'document', title: null, citations: null, source: { type: 'text', media_type: 'text/plain', data: 'Last price 101,234.5' } } } },
        ],
        usage: usage(1000, 100, 1, 1),
      },
      { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"outcome":"B",' }, { type: 'text', text: '"confidence":0.97}' }], usage: usage(500, 50) },
    ]);
    const p = new AnthropicProvider({ client });
    const res = await p.complete({
      job: 'resolve_1',
      promptVersion: 'resolve-v1',
      system: 'sys',
      user: 'question',
      schema: { type: 'object' },
      effort: 'high',
      webFetch: { allowedDomains: ['binance.com'], maxUses: 6 },
      webSearch: { allowedDomains: ['binance.com'], maxUses: 4 },
    });
    expect(requests).toHaveLength(2); // pause_turn resumed once
    const r = requests[0];
    expect(r).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      system: 'sys',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
    expect(r.tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search', max_uses: 4, allowed_domains: ['binance.com'] },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6, max_content_tokens: 60000, allowed_domains: ['binance.com'] },
    ]);
    // The resumed request sends the paused assistant turn back unchanged, with no extra user message.
    const msgs = requests[1].messages as { role: string }[];
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(res.json).toEqual({ outcome: 'B', confidence: 0.97 });
    expect(res.fetched).toEqual([{ url: 'https://www.binance.com/a', text: 'Last price 101,234.5', retrievedAt: '2026-12-04T12:01:00Z' }]);
    expect(res.usage).toMatchObject({ inputTokens: 1500, outputTokens: 150, webSearches: 1, webFetches: 1 });
    expect(res.costUsd).toBeCloseTo(costOf('claude-opus-5-5', res.usage), 10);
    expect(res.costUsd).toBeCloseTo((1500 * 4 + 150 * 20) / 1e6 + 0.01, 10);
  });

  it('passes images for the vision check and reports refusals without JSON', async () => {
    const { client, requests } = stubClient([{ model: 'claude-opus-5-5', stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: 'no' }, content: [], usage: usage(10, 0) }]);
    const res = await new AnthropicProvider({ client }).complete({ job: 'image_check', promptVersion: 'v', system: 's', user: 'u', images: [{ mediaType: 'image/png', base64: 'AAAA' }], schema: {}, effort: 'medium' });
    const content = (requests[0].messages as { content: { type: string }[] }[])[0].content;
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } });
    expect(requests[0].tools).toBeUndefined();
    expect(res.json).toBeNull();
    expect(res.refusal).toEqual({ category: 'cyber', explanation: 'no' });
  });
});
