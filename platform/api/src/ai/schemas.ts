// Output schemas of the AI pipeline (DEV-PLAN 6.4). Each schema exists twice on purpose: as a plain
// JSON schema sent to the API as a structured output format (kept inside the subset structured
// outputs accept: objects with `additionalProperties: false` and every property required, enums,
// arrays, strings, numbers), and as a zod schema that the worker validates every response against,
// because code, not the model, decides what reaches the chain.

import { z } from 'zod';

export const CATEGORIES = ['Crypto', 'Markets', 'Weather', 'Sports', 'Culture'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Category in the worker's spelling whatever the case stored (the API serves it lower case). */
export function normCategory(c: string): Category | null {
  const hit = CATEGORIES.find((x) => x.toLowerCase() === c.trim().toLowerCase());
  return hit ?? null;
}

export const LANGS = ['en', 'ko', 'ja'] as const;
export type Lang = (typeof LANGS)[number];

// ---------- one question ----------

export const langTextZ = z.object({
  title: z.string(),
  left: z.string(), // choice A, outcome 1 (no, down, under)
  right: z.string(), // choice B, outcome 2 (yes, up, over)
  rule: z.string(), // the answer rule shown on the card
  settle: z.string(), // when the answer is known, e.g. "21:00 tomorrow"
});
export type LangText = z.infer<typeof langTextZ>;

export const sourceZ = z.object({ name: z.string(), url: z.string() });

export const draftZ = z.object({
  category: z.enum(CATEGORIES),
  kind: z.enum(['discrete', 'continuous']),
  en: langTextZ,
  ko: langTextZ,
  ja: langTextZ,
  criteria: z.string(), // one English sentence with the exact time and time zone, how A and B are decided
  primarySource: sourceZ,
  secondarySource: sourceZ,
  /** Discrete events: when the event starts. Continuous values: the first instant that is observed. ISO 8601 with offset. */
  observesAt: z.string(),
  /** When the answer can be read from the sources. ISO 8601 with offset. */
  resolvesAt: z.string(),
  probabilityRight: z.number(), // expected probability of the right choice, 0..1
  entities: z.array(z.string()),
  imageSubject: z.string(), // one concrete subject for the picture, no people, logos or text
  rationale: z.string(),
  /** Mirrored from an outside market (Polymarket): its slug, and which of its outcomes is our right choice (choice B). */
  outsideSlug: z.string().optional(),
  outsideRightOutcome: z.string().optional(),
  /** Set by code from the outside market, never by the model. */
  outsideUrl: z.string().optional(),
});
export type Draft = z.infer<typeof draftZ>;

export const draftSetZ = z.object({ candidates: z.array(draftZ) });

const langTextJson = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'left', 'right', 'rule', 'settle'],
  properties: {
    title: { type: 'string' },
    left: { type: 'string' },
    right: { type: 'string' },
    rule: { type: 'string' },
    settle: { type: 'string' },
  },
} as const;

const sourceJson = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'url'],
  properties: { name: { type: 'string' }, url: { type: 'string' } },
} as const;

export const draftJson = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'kind',
    'en',
    'ko',
    'ja',
    'criteria',
    'primarySource',
    'secondarySource',
    'observesAt',
    'resolvesAt',
    'probabilityRight',
    'entities',
    'imageSubject',
    'rationale',
  ],
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    kind: { type: 'string', enum: ['discrete', 'continuous'] },
    en: langTextJson,
    ko: langTextJson,
    ja: langTextJson,
    criteria: { type: 'string' },
    primarySource: sourceJson,
    secondarySource: sourceJson,
    observesAt: { type: 'string', description: 'ISO 8601 with offset' },
    resolvesAt: { type: 'string', description: 'ISO 8601 with offset' },
    probabilityRight: { type: 'number' },
    entities: { type: 'array', items: { type: 'string' } },
    imageSubject: { type: 'string' },
    rationale: { type: 'string' },
  },
} as const;

/** A drafted question mirrored from a listed outside market: the draft plus the link (empty strings when none). */
export const outsideDraftJson = {
  ...draftJson,
  required: [...draftJson.required, 'outsideSlug', 'outsideRightOutcome'],
  properties: {
    ...draftJson.properties,
    outsideSlug: { type: 'string', description: 'slug of the listed outside market this question mirrors' },
    outsideRightOutcome: { type: 'string', description: 'the outcome label of that market that equals our right choice (choice B)' },
  },
} as const;

export const outsideDraftSetJson = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: { candidates: { type: 'array', items: outsideDraftJson } },
} as const;

export const draftSetJson = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: { candidates: { type: 'array', items: draftJson } },
} as const;

// ---------- validation (fresh context checklist) ----------

export const CHECKLIST = [
  'binary_objective', // two exhaustive, mutually exclusive answers decided by a fact
  'sources_named', // a named public primary source and an independent secondary source
  'criteria_exact', // one sentence with the exact time and time zone
  'known_after_close', // nothing that decides the answer is knowable before the day closes (09:00 KST next day)
  'open_when_resolving', // the source publishes on that date (no market holiday, no weekend closure, no off season)
  'balanced', // roughly 25% to 75% likely, not near certain
  'allowed_topic', // no politics, war, disasters, health of named people, private individuals, crime, CT or Cojam, thin tokens, adult content, gambling odds
  'same_meaning', // EN, KO and JA say the same thing with the same numbers, dates, units and source
  'native_voice', // each language reads as written by a native writer, no word for word translation
  'house_rules', // no dash as a sentence break, the fixed terms of each language
] as const;
export type CheckId = (typeof CHECKLIST)[number];

export const validationZ = z.object({
  checks: z.array(z.object({ id: z.enum(CHECKLIST), pass: z.boolean(), note: z.string() })),
  verdict: z.enum(['accept', 'reject']),
  qualityScore: z.number(), // 0..1, used to rank accepted candidates
  summary: z.string(),
});
export type Validation = z.infer<typeof validationZ>;

export const validationJson = {
  type: 'object',
  additionalProperties: false,
  required: ['checks', 'verdict', 'qualityScore', 'summary'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'pass', 'note'],
        properties: {
          id: { type: 'string', enum: [...CHECKLIST] },
          pass: { type: 'boolean' },
          note: { type: 'string' },
        },
      },
    },
    verdict: { type: 'string', enum: ['accept', 'reject'] },
    qualityScore: { type: 'number' },
    summary: { type: 'string' },
  },
} as const;

// ---------- resolution ----------

export const resolutionZ = z.object({
  outcome: z.enum(['A', 'B', 'undeterminable', 'void']),
  confidence: z.number(),
  evidence: z.array(z.object({ url: z.string(), quote: z.string(), observedAt: z.string() })),
  reasoningSummary: z.string(),
  /** True when the event was postponed or cancelled: the market is voided. */
  eventCancelled: z.boolean(),
});
export type Resolution = z.infer<typeof resolutionZ>;

export const resolutionJson = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'confidence', 'evidence', 'reasoningSummary', 'eventCancelled'],
  properties: {
    outcome: { type: 'string', enum: ['A', 'B', 'undeterminable', 'void'] },
    confidence: { type: 'number' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'quote', 'observedAt'],
        properties: {
          url: { type: 'string' },
          quote: { type: 'string', description: 'copied verbatim from the fetched page' },
          observedAt: { type: 'string' },
        },
      },
    },
    reasoningSummary: { type: 'string' },
    eventCancelled: { type: 'boolean' },
  },
} as const;

// ---------- images ----------

export const imagePromptZ = z.object({ prompt: z.string(), negative: z.string() });
export const imagePromptJson = {
  type: 'object',
  additionalProperties: false,
  required: ['prompt', 'negative'],
  properties: { prompt: { type: 'string' }, negative: { type: 'string' } },
} as const;

export const IMAGE_REJECT_REASONS = [
  'text_or_numbers',
  'real_person',
  'logo_or_trademark',
  'subject_outside_top',
  'unsafe_content',
  'off_palette',
] as const;

export const imageCheckZ = z.object({
  accept: z.boolean(),
  reasons: z.array(z.enum(IMAGE_REJECT_REASONS)),
  note: z.string(),
});
export type ImageCheck = z.infer<typeof imageCheckZ>;
export const imageCheckJson = {
  type: 'object',
  additionalProperties: false,
  required: ['accept', 'reasons', 'note'],
  properties: {
    accept: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string', enum: [...IMAGE_REJECT_REASONS] } },
    note: { type: 'string' },
  },
} as const;
