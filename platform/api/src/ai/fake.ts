// Deterministic fake AI provider for tests and the compressed day run. It never calls a network.
// Default behaviour per job:
//   draft        -> `fakeDrafts(dayId, count)`: valid candidates for the day (every code check passes)
//   validate     -> accept, quality derived from the title
//   resolve_*    -> the answer set with `setAnswer(marketId, 'A' | 'B' | 'void' | 'undeterminable')`,
//                   with a quote that appears in a "fetched" page of the primary source
//   image_*      -> a prompt / an accepting check
// Any job can be overridden with `on(job, handler)` (a handler may return an AiResponse or throw).

import { dayEnd, dayOpensAt } from '../../../shared/src/time.ts';
import type { AiProvider, AiRequest, AiResponse } from './provider.ts';
import type { Category, Draft, Resolution } from './schemas.ts';
import { marketsAllowedOnDay } from './validate.ts';

type Handler = (req: AiRequest) => unknown | AiResponse | Promise<unknown | AiResponse>;

const ZERO = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0 };

function iso(unix: number): string {
  return new Date(unix * 1000).toISOString().replace('.000Z', 'Z');
}

/** A valid draft of `category` for `dayId`; `n` varies the threshold so titles differ. */
export function fakeDraft(dayId: number, category: Category, n: number): Draft {
  const close = dayEnd(dayId);
  const base: Omit<Draft, 'category' | 'kind' | 'en' | 'ko' | 'ja' | 'criteria' | 'primarySource' | 'secondarySource' | 'observesAt' | 'resolvesAt'> = {
    probabilityRight: 0.5,
    entities: [],
    imageSubject: 'a coin and a rising price line',
    rationale: 'fake draft for tests',
  };
  const settle = { en: '21:00 tomorrow', ko: '내일 오후 9시', ja: '明日の21時' };
  switch (category) {
    case 'Crypto': {
      const coin = n % 2 === 0 ? 'Bitcoin' : 'Ethereum';
      const ko = n % 2 === 0 ? '비트코인' : '이더리움';
      const ja = n % 2 === 0 ? 'ビットコイン' : 'イーサリアム';
      const level = (n % 2 === 0 ? 100_000 : 3_500) + n * 100;
      const lv = level.toLocaleString('en-US');
      return {
        ...base,
        category,
        kind: 'continuous',
        en: { title: `Will ${coin} be above $${lv} at 21:00 tomorrow?`, left: 'No', right: 'Yes', rule: `Binance price at 21:00 KST`, settle: settle.en },
        ko: { title: `내일 밤 9시, ${ko}는 ${lv}달러 위에 있을까요?`, left: '아니요', right: '예', rule: '바이낸스 오후 9시 가격', settle: settle.ko },
        ja: { title: `明日の21時、${ja}は${lv}ドルを超えている？`, left: '超えない', right: '超える', rule: 'Binanceの21時の価格', settle: settle.ja },
        criteria: `Binance ${coin} USDT last price at 21:00 KST on the day after the set; above ${lv} is Yes, equal or below is No.`,
        primarySource: { name: 'Binance', url: 'https://www.binance.com/en/trade/BTC_USDT' },
        secondarySource: { name: 'CoinGecko', url: 'https://www.coingecko.com/en/coins/bitcoin' },
        observesAt: iso(close + 12 * 3600),
        resolvesAt: iso(close + 12 * 3600 + 300),
      };
    }
    case 'Sports': {
      const goals = 3 + (n % 2);
      return {
        ...base,
        category,
        kind: 'discrete',
        imageSubject: 'a ball flying into a net',
        en: { title: `Match ${n}: ${goals} goals or more tomorrow night?`, left: `${goals - 1} or fewer`, right: `${goals} or more`, rule: 'Total goals at full time', settle: '07:00 in two days' },
        ko: { title: `내일 밤 ${n}번 경기, ${goals}골 이상 나올까요?`, left: `${goals - 1}골 이하`, right: `${goals}골 이상`, rule: '정규 시간 기준 합계 득점', settle: '모레 오전 7시' },
        ja: { title: `明日の夜の第${n}試合、合計${goals}点以上入る？`, left: `${goals - 1}点以下`, right: `${goals}点以上`, rule: '90分終了時の合計得点', settle: 'あさっての午前7時' },
        criteria: `Total goals at full time of the match that starts 20:00 UTC on the day after the set; ${goals} or more is the right choice.`,
        primarySource: { name: 'Premier League', url: 'https://www.premierleague.com/matches' },
        secondarySource: { name: 'BBC Sport', url: 'https://www.bbc.com/sport/football/scores-fixtures' },
        observesAt: iso(close + 20 * 3600),
        resolvesAt: iso(close + 22 * 3600),
      };
    }
    case 'Markets': {
      const level = 40_000 + n * 100;
      const lv = level.toLocaleString('en-US');
      return {
        ...base,
        category,
        kind: 'continuous',
        imageSubject: 'two coins over a bar chart',
        en: { title: `Will the Nikkei 225 close above ${lv} tomorrow?`, left: 'No', right: 'Yes', rule: 'Nikkei 225 official close', settle: '15:40 tomorrow' },
        ko: { title: `내일 닛케이 225, ${lv} 위에서 마감할까요?`, left: '아니요', right: '예', rule: '닛케이 225 공식 종가', settle: '내일 오후 3시 40분' },
        ja: { title: `明日の日経平均、終値は${lv}円を超える？`, left: '超えない', right: '超える', rule: '日経平均株価の終値', settle: '明日の15時40分' },
        criteria: `Nikkei 225 official closing value at 15:30 JST on the day after the set; above ${lv} is Yes.`,
        primarySource: { name: 'Nikkei Indexes', url: 'https://indexes.nikkei.co.jp/en/nkave' },
        secondarySource: { name: 'JPX', url: 'https://www.jpx.co.jp/english/markets/indices/' },
        observesAt: iso(close + 6 * 3600 + 30 * 60),
        resolvesAt: iso(close + 6 * 3600 + 40 * 60 + 6 * 3600),
      };
    }
    case 'Weather': {
      const t = 10 + (n % 5);
      return {
        ...base,
        category,
        kind: 'continuous',
        imageSubject: 'a city skyline under a cloud',
        en: { title: `Will Tokyo reach ${t}°C between 09:00 and 21:00 tomorrow?`, left: 'No', right: 'Yes', rule: 'JMA Tokyo station, high', settle: '22:00 tomorrow' },
        ko: { title: `내일 도쿄 낮 기온, ${t}도까지 오를까요?`, left: '아니요', right: '예', rule: '일본 기상청 도쿄 관측소 최고기온', settle: '내일 오후 10시' },
        ja: { title: `明日の東京、最高気温は${t}℃に届く？`, left: '届かない', right: '届く', rule: '気象庁・東京の最高気温', settle: '明日の22時' },
        criteria: `Highest temperature at JMA Tokyo station between 09:00 and 21:00 JST on the day after the set; ${t}.0 or more is Yes.`,
        primarySource: { name: 'JMA', url: 'https://www.data.jma.go.jp/obd/stats/data/mdrr/tem_rct/alltable/mxtemsadext00.html' },
        secondarySource: { name: 'tenki.jp', url: 'https://tenki.jp/forecast/3/16/4410/13101/' },
        observesAt: iso(close),
        resolvesAt: iso(close + 13 * 3600),
      };
    }
    case 'Culture': {
      return {
        ...base,
        category,
        kind: 'discrete',
        imageSubject: 'a film reel and a star',
        en: { title: `Chart ${n}: will this week's No. 1 song change?`, left: 'No', right: 'Yes', rule: 'Weekly chart, published tomorrow', settle: '18:00 tomorrow' },
        ko: { title: `${n}번 차트, 이번 주 1위 곡이 바뀔까요?`, left: '아니요', right: '예', rule: '내일 발표되는 주간 차트', settle: '내일 오후 6시' },
        ja: { title: `第${n}チャート、今週の1位は入れ替わる？`, left: '変わらない', right: '変わる', rule: '明日発表の週間チャート', settle: '明日の18時' },
        criteria: `The weekly chart published at 08:00 UTC on the day after the set; a different No. 1 song than last week is Yes.`,
        primarySource: { name: 'Melon', url: 'https://www.melon.com/chart/week/index.htm' },
        secondarySource: { name: 'Circle Chart', url: 'https://circlechart.kr/page_chart/global.circle' },
        observesAt: iso(close + 8 * 3600),
        resolvesAt: iso(close + 9 * 3600),
      };
    }
  }
}

/** `count` valid candidates covering the day's category mix. */
export function fakeDrafts(dayId: number, count = 12): Draft[] {
  const cats: Category[] = marketsAllowedOnDay(dayId) ? ['Crypto', 'Crypto', 'Sports', 'Markets', 'Culture', 'Weather'] : ['Crypto', 'Crypto', 'Sports', 'Weather', 'Culture', 'Weather'];
  const out: Draft[] = [];
  for (let i = 0; i < count; i++) out.push(fakeDraft(dayId, cats[i % cats.length], i + 1 + (dayId % 7) * 20));
  return out;
}

export class FakeProvider implements AiProvider {
  readonly name = 'fake';
  readonly model = 'fake-model';
  readonly calls: AiRequest[] = [];
  private handlers = new Map<string, Handler>();
  private answers = new Map<number, Resolution['outcome']>();

  on(job: string, h: Handler): this {
    this.handlers.set(job, h);
    return this;
  }

  setAnswer(marketId: number, outcome: Resolution['outcome']): this {
    this.answers.set(marketId, outcome);
    return this;
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    this.calls.push(req);
    const h = this.handlers.get(req.job) ?? this.handlers.get(req.job.replace(/_\d$/, '_*'));
    const out = h ? await h(req) : this.defaultFor(req);
    if (out && typeof out === 'object' && 'usage' in (out as object) && 'stopReason' in (out as object)) return out as AiResponse;
    if (out && typeof out === 'object' && '__fetched' in (out as object)) {
      const { __fetched, ...json } = out as { __fetched: AiResponse['fetched'] };
      return { json, text: JSON.stringify(json), model: this.model, stopReason: 'end_turn', usage: ZERO, costUsd: 0, fetched: __fetched };
    }
    return { json: out, text: JSON.stringify(out), model: this.model, stopReason: 'end_turn', usage: ZERO, costUsd: 0, fetched: [] };
  }

  private defaultFor(req: AiRequest): unknown {
    const meta = req.meta ?? {};
    if (req.job === 'draft') return { candidates: fakeDrafts(Number(meta.dayId), Number(meta.count ?? 12)) };
    if (req.job === 'validate') {
      const title = String(meta.title ?? '');
      const quality = 0.5 + ((title.length * 7) % 40) / 100;
      return {
        checks: ['binary_objective', 'sources_named', 'criteria_exact', 'known_after_close', 'open_when_resolving', 'balanced', 'allowed_topic', 'same_meaning', 'native_voice', 'house_rules'].map((id) => ({ id, pass: true, note: 'ok' })),
        verdict: 'accept',
        qualityScore: quality,
        summary: 'fake validation',
      };
    }
    if (req.job.startsWith('resolve_')) {
      const id = Number(meta.marketId);
      const outcome = this.answers.get(id) ?? 'undeterminable';
      const url = 'https://www.binance.com/en/trade/BTC_USDT';
      const quote = `Final result for market ${id}: ${outcome}`;
      return {
        outcome,
        confidence: outcome === 'undeterminable' ? 0.2 : 0.97,
        evidence: outcome === 'undeterminable' ? [] : [{ url, quote, observedAt: new Date().toISOString() }],
        reasoningSummary: `fake resolution ${outcome}`,
        eventCancelled: outcome === 'void',
        __fetched: [{ url, text: `<html> ... ${quote} ... </html>`, retrievedAt: null }],
      };
    }
    if (req.job === 'image_prompt') return { prompt: 'flat illustration of a coin, blue palette, no text', negative: 'text, letters, people, logos' };
    if (req.job === 'image_check') return { accept: true, reasons: [], note: 'ok' };
    throw new Error(`fake provider: no handler for ${req.job}`);
  }
}

/** Unix second of the day's open, re-exported for tests. */
export { dayOpensAt };
