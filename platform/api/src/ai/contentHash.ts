// The market content hash written on chain by `createDay` (DEV-PLAN 3.3):
//   contentHash = keccak256(utf8(canonical JSON of {
//     en: {title, left, right, rule}, ko: {...}, ja: {...},
//     closesAt, resolvesAt,            // unix seconds (numbers)
//     sources: [{name, url}, ...]      // primary first
//   }))
// Canonical JSON: object keys sorted by code point at every level, no whitespace, strings NFC
// normalised and trimmed, numbers as integers. All three languages are in the hash because each is
// written natively; the image and the settle phrase are not, so they can change after publish.
// Anyone can recompute it from GET /v1/markets/:id and compare with `markets(id).contentHash`.

import { keccak256, toBytes } from 'viem';
import type { LangText } from './schemas.ts';

export interface HashInput {
  en: LangText;
  ko: LangText;
  ja: LangText;
  closesAt: number;
  resolvesAt: number;
  sources: { name: string; url: string }[];
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error('canonical JSON allows integers only');
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new Error(`cannot encode ${typeof value}`);
}

function lang(t: LangText) {
  return { title: t.title.trim(), left: t.left.trim(), right: t.right.trim(), rule: t.rule.trim() };
}

export function hashPayload(h: HashInput) {
  return {
    en: lang(h.en),
    ko: lang(h.ko),
    ja: lang(h.ja),
    closesAt: h.closesAt,
    resolvesAt: h.resolvesAt,
    sources: h.sources.map((s) => ({ name: s.name.trim(), url: s.url.trim() })),
  };
}

export function contentHash(h: HashInput): `0x${string}` {
  return keccak256(toBytes(canonicalJson(hashPayload(h))));
}
