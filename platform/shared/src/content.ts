// Question content rules shared by the worker (which hashes and publishes), the API (which serves the
// text) and the PWA (which may verify it). Pure functions only: the keccak256 itself is done by the
// caller with viem (`keccak256(toBytes(canonicalJson(contentHashPayload(x))))`), because this package
// has no dependencies.

/** Choice codes on chain: the left answer (no, down, under) is 1, the right answer (yes, up, over) is 2, void is 3. */
export const OUTCOME_LEFT = 1;
export const OUTCOME_RIGHT = 2;
export const OUTCOME_VOID = 3;

export interface ContentLangText {
  title: string;
  left: string;
  right: string;
  rule: string;
  settle?: string;
}

export interface ContentHashInput {
  en: ContentLangText;
  ko: ContentLangText;
  ja: ContentLangText;
  closesAt: number; // unix seconds
  resolvesAt: number; // unix seconds
  sources: { name: string; url: string }[]; // primary first
}

/** Canonical JSON: keys sorted at every level, no whitespace, strings NFC, integers only. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error("canonical JSON allows integers only");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  throw new Error(`cannot encode ${typeof value}`);
}

const lang = (t: ContentLangText) => ({ title: t.title.trim(), left: t.left.trim(), right: t.right.trim(), rule: t.rule.trim() });

/**
 * The object whose canonical JSON is hashed into `markets(id).contentHash` (DEV-PLAN 3.3): the three
 * languages (title, left, right, rule), the close and resolve times and the sources. The settle phrase
 * and the image are not part of it, so they may change after publish.
 */
export function contentHashPayload(h: ContentHashInput) {
  return {
    en: lang(h.en),
    ko: lang(h.ko),
    ja: lang(h.ja),
    closesAt: h.closesAt,
    resolvesAt: h.resolvesAt,
    sources: h.sources.map((s) => ({ name: s.name.trim(), url: s.url.trim() })),
  };
}
