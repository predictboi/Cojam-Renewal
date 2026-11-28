// Outside markets (Polymarket) behind a small interface, so the price read at day close and the drafting source step
// can run against a fake in tests. The real client reads Polymarket's public Gamma API (no key needed):
//   GET https://gamma-api.polymarket.com/markets/slug/{slug}       one market (docs.polymarket.com, "Get market by slug")
//   GET https://gamma-api.polymarket.com/markets?closed=false&...  open markets (docs.polymarket.com, "List markets")
// `outcomes` and `outcomePrices` arrive as JSON encoded strings (for example "[\"Yes\", \"No\"]" and "[\"0.62\", \"0.38\"]").

export interface OutsideMarket {
  /** Polymarket market id (a numeric string). */
  id: string;
  slug: string;
  question: string;
  description: string;
  /** Outcome labels in order, for example ["Yes", "No"]. */
  outcomes: string[];
  /** Price of each outcome, 0 to 1, in the order of `outcomes`. */
  prices: number[];
  /** When the market is scheduled to end, unix seconds; null when unknown. */
  endsAt: number | null;
  closed: boolean;
  active: boolean;
  acceptingOrders: boolean;
  resolutionSource: string | null;
  /** The group label inside a multi outcome event (for example "↑ 100,000" on a price ladder), else null. */
  groupItemTitle: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  volume: number;
  /** Public page of the market. */
  url: string;
}

export interface ListOpenOptions {
  /** End time window, unix seconds. */
  endFrom: number;
  endTo: number;
  limit?: number;
  /** Only markets with at least this traded volume (USD). */
  minVolume?: number;
}

export interface OutsideMarkets {
  readonly name: string;
  /** One market by its slug (throws when it cannot be read). */
  market(slug: string): Promise<OutsideMarket>;
  /** Open markets ending inside the window, most traded first. */
  listOpen(opts: ListOpenOptions): Promise<OutsideMarket[]>;
}

export const POLYMARKET_GAMMA = "https://gamma-api.polymarket.com";

function jsonList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const x = JSON.parse(v);
      return Array.isArray(x) ? x : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Maps one Gamma API market object; null when it is not usable (no slug, no outcomes). */
export function parseGammaMarket(raw: any): OutsideMarket | null {
  if (!raw || typeof raw !== "object" || typeof raw.slug !== "string") return null;
  const outcomes = jsonList(raw.outcomes).map(String);
  const prices = jsonList(raw.outcomePrices).map((p) => Number(p));
  if (!outcomes.length || outcomes.length !== prices.length || prices.some((p) => !Number.isFinite(p))) return null;
  const end = typeof raw.endDate === "string" ? Date.parse(raw.endDate) : NaN;
  const ev = Array.isArray(raw.events) ? raw.events[0] : null;
  const eventSlug = typeof ev?.slug === "string" ? ev.slug : null;
  return {
    id: String(raw.id ?? ""),
    slug: raw.slug,
    question: String(raw.question ?? ""),
    description: String(raw.description ?? ""),
    outcomes,
    prices,
    endsAt: Number.isNaN(end) ? null : Math.floor(end / 1000),
    closed: raw.closed === true,
    active: raw.active !== false,
    acceptingOrders: raw.acceptingOrders !== false,
    resolutionSource: typeof raw.resolutionSource === "string" && raw.resolutionSource ? raw.resolutionSource : null,
    groupItemTitle: typeof raw.groupItemTitle === "string" && raw.groupItemTitle ? raw.groupItemTitle : null,
    eventSlug,
    eventTitle: typeof ev?.title === "string" ? ev.title : null,
    volume: Number(raw.volumeNum ?? raw.volume ?? 0) || 0,
    url: eventSlug ? `https://polymarket.com/event/${eventSlug}/${raw.slug}` : `https://polymarket.com/market/${raw.slug}`,
  };
}

/** The market slug from a polymarket.com link: /market/{slug}, /event/{event}/{slug}, else /event/{slug}. Null when it is not one. */
export function slugFromUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)polymarket\.com$/.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const ok = (s: string | undefined) => (s && /^[a-z0-9-]{3,200}$/i.test(s) ? s : null);
  if (parts[0] === "market") return ok(parts[1]);
  if (parts[0] === "event") return ok(parts[2]) ?? ok(parts[1]);
  return null;
}

/** Price (0 to 1) of the outcome labelled `label` (case insensitive); throws when the label is not one of them. */
export function priceOf(m: OutsideMarket, label: string): number {
  const i = m.outcomes.findIndex((o) => o.trim().toLowerCase() === label.trim().toLowerCase());
  if (i < 0) throw new Error(`outcome "${label}" is not one of ${JSON.stringify(m.outcomes)}`);
  const p = m.prices[i];
  if (!(p >= 0 && p <= 1)) throw new Error(`price out of range: ${p}`);
  return p;
}

type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The real client: Polymarket Gamma API over HTTPS, 10 second timeout per call. */
export class PolymarketGamma implements OutsideMarkets {
  readonly name = "polymarket";
  constructor(
    private readonly base = POLYMARKET_GAMMA,
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly timeoutMs = 10_000,
  ) {}

  private async get(path: string): Promise<unknown> {
    const r = await this.fetchFn(`${this.base}${path}`, { signal: AbortSignal.timeout(this.timeoutMs), headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`polymarket ${path.split("?")[0]}: HTTP ${r.status}`);
    return r.json();
  }

  async market(slug: string): Promise<OutsideMarket> {
    const m = parseGammaMarket(await this.get(`/markets/slug/${encodeURIComponent(slug)}`));
    if (!m) throw new Error(`polymarket market ${slug}: unreadable response`);
    return m;
  }

  async listOpen(o: ListOpenOptions): Promise<OutsideMarket[]> {
    const q = new URLSearchParams({
      closed: "false",
      end_date_min: new Date(o.endFrom * 1000).toISOString(),
      end_date_max: new Date(o.endTo * 1000).toISOString(),
      order: "volumeNum",
      ascending: "false",
      limit: String(o.limit ?? 200),
    });
    if (o.minVolume) q.set("volume_num_min", String(o.minVolume));
    const raw = await this.get(`/markets?${q}`);
    return (Array.isArray(raw) ? raw : []).map(parseGammaMarket).filter((m): m is OutsideMarket => m !== null);
  }
}

/** Test and dev stand in: markets held in memory; `fail` makes every call throw. */
export class FakeOutsideMarkets implements OutsideMarkets {
  readonly name = "fake";
  markets = new Map<string, OutsideMarket>();
  fail: Error | null = null;
  calls: string[] = [];

  add(m: Partial<OutsideMarket> & { slug: string }): OutsideMarket {
    const full: OutsideMarket = {
      id: String(this.markets.size + 1),
      question: m.slug,
      description: "",
      outcomes: ["Yes", "No"],
      prices: [0.5, 0.5],
      endsAt: null,
      closed: false,
      active: true,
      acceptingOrders: true,
      resolutionSource: null,
      groupItemTitle: null,
      eventSlug: null,
      eventTitle: null,
      volume: 0,
      url: `https://polymarket.com/market/${m.slug}`,
      ...m,
    };
    this.markets.set(m.slug, full);
    return full;
  }

  async market(slug: string): Promise<OutsideMarket> {
    this.calls.push(`market:${slug}`);
    if (this.fail) throw this.fail;
    const m = this.markets.get(slug);
    if (!m) throw new Error(`polymarket market ${slug}: HTTP 404`);
    return m;
  }

  async listOpen(o: ListOpenOptions): Promise<OutsideMarket[]> {
    this.calls.push("list");
    if (this.fail) throw this.fail;
    return [...this.markets.values()]
      .filter((m) => !m.closed && m.endsAt !== null && m.endsAt >= o.endFrom && m.endsAt <= o.endTo && m.volume >= (o.minVolume ?? 0))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, o.limit ?? 200);
  }
}
