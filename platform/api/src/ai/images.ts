// Question images (DEV-PLAN 6.4.1, DECISIONS "Prediction card"). The image model is not chosen yet,
// so generation sits behind `ImageGenerator`. The only implemented generator today is
// `CategoryIllustrationGenerator`, which never calls an API: it assigns the category illustration
// drawn for the project (platform/design/assets/img, 4:5 SVG in the Cojam palette). When a real model
// is added, the pipeline already does the rest: Claude writes the prompt from the fixed template, the
// generated picture goes through the vision check (up to 2 regenerations), and a rejected picture
// falls back to the category illustration. The card never waits for an image.

import { createHash } from 'node:crypto';
import type { WDb } from '../worker/db.ts';
import type { Logger } from '../worker/log.ts';
import { IMAGE_CHECK_SYSTEM, IMAGE_PROMPT_SYSTEM, PROMPT_VERSIONS, imagePromptUser } from './prompts.ts';
import { runLogged, type AiProvider, type ImageInput } from './provider.ts';
import { imageCheckJson, imageCheckZ, imagePromptJson, imagePromptZ, normCategory, type Category } from './schemas.ts';

export interface GeneratedImage {
  bytes: Buffer;
  mediaType: ImageInput['mediaType'];
  model: string;
  costUsd: number;
}

export interface ImageGenerator {
  readonly name: string;
  /** False for the fallback generator: no prompt is written and no check runs. */
  readonly generates: boolean;
  generate(prompt: string, negative: string): Promise<GeneratedImage>;
}

/**
 * Stores accepted images (R2 in production, `img.cojam.app`). `put` writes the picture under `key` (WebP,
 * 4:5, about 800 x 1000, under 120 KB) and its 52 px thumbnail under `thumbKey(key)`, and returns the key
 * and public URL. Not implemented yet (no image model chosen).
 */
export interface ImageStore {
  put(key: string, bytes: Buffer, mediaType: string): Promise<{ key: string; url: string }>;
}

/**
 * The category illustration set, served by the PWA itself (platform/app/public/assets/img, copied from
 * platform/design/assets/img). A fallback sets `markets.image_url` to that same origin path and leaves
 * `image_key` null, so the API serves no thumbnail and the terminal view draws the category icon.
 * Culture has no drawing: the card draws the category icon on the blue grid (`.qimg--fallback`).
 */
export const CATEGORY_ILLUSTRATIONS: Record<Category, string[]> = {
  Crypto: ['/assets/img/q1-bitcoin.svg', '/assets/img/q5-kaia.svg'],
  Markets: ['/assets/img/q2-dollar-won.svg'],
  Weather: ['/assets/img/q3-seoul-weather.svg'],
  Sports: ['/assets/img/q4-football.svg'],
  Culture: [],
};

export function fallbackUrl(category: string, marketId: number): string | null {
  const cat = normCategory(category);
  const list = cat ? CATEGORY_ILLUSTRATIONS[cat] : [];
  if (list.length === 0) return null;
  return list[Math.abs(marketId) % list.length];
}

/** Thumbnail key next to an image key: `<key without extension>.thumb.webp` (the API derives the same URL). */
export function thumbKey(key: string): string {
  return `${key.replace(/\.[a-z0-9]+$/i, '')}.thumb.webp`;
}

export class CategoryIllustrationGenerator implements ImageGenerator {
  readonly name = 'category-illustration';
  readonly generates = false;
  async generate(): Promise<GeneratedImage> {
    throw new Error('the category illustration set does not generate images');
  }
}

export interface ImageDeps {
  db: WDb;
  provider: AiProvider;
  generator: ImageGenerator;
  store: ImageStore | null;
  log: Logger;
  maxRegenerations?: number; // 2
}

async function useFallback(deps: ImageDeps, m: { market_id: number; category: string }, why: string) {
  await deps.db
    .updateTable('markets')
    .set({ image_state: 'fallback', image_key: null, image_url: fallbackUrl(m.category, m.market_id), image_sha256: null, image_model: deps.generator.name, updated_at: new Date() })
    .where('market_id', '=', m.market_id)
    .execute();
  deps.log.info('images: category illustration used', { marketId: m.market_id, why });
}

/** Prepares the image of one market: generate, check, store; or the category illustration. */
export async function prepareImage(deps: ImageDeps, marketId: number): Promise<'generated' | 'fallback'> {
  const m = await deps.db.selectFrom('markets').select(['market_id', 'category', 'draft_id']).where('market_id', '=', marketId).executeTakeFirstOrThrow();
  if (!deps.generator.generates || !deps.store) {
    await useFallback(deps, m, 'no image model configured');
    return 'fallback';
  }
  const draft = m.draft_id ? await deps.db.selectFrom('market_drafts').select('payload').where('id', '=', m.draft_id).executeTakeFirst() : undefined;
  const subject = (draft?.payload as { imageSubject?: string } | undefined)?.imageSubject ?? `${m.category} symbol`;
  let prompt: { prompt: string; negative: string };
  try {
    const r = await runLogged(
      deps.db,
      deps.provider,
      { job: 'image_prompt', promptVersion: PROMPT_VERSIONS.imagePrompt, system: IMAGE_PROMPT_SYSTEM, user: imagePromptUser(m.category, subject), schema: imagePromptJson, effort: 'medium', maxTokens: 4_000, meta: { marketId } },
      (x) => imagePromptZ.parse(x),
    );
    prompt = r.output;
  } catch (e) {
    await useFallback(deps, m, `prompt failed: ${(e as Error).message}`);
    return 'fallback';
  }
  const tries = 1 + (deps.maxRegenerations ?? 2);
  for (let i = 0; i < tries; i++) {
    let img: GeneratedImage;
    try {
      img = await deps.generator.generate(prompt.prompt, prompt.negative);
    } catch (e) {
      await deps.db.insertInto('image_runs').values({ market_id: marketId, model: deps.generator.name, prompt: prompt.prompt, result: 'error', reject_reasons: JSON.stringify([(e as Error).message]) }).execute();
      continue;
    }
    let accept = false;
    let reasons: string[] = [];
    try {
      const r = await runLogged(
        deps.db,
        deps.provider,
        {
          job: 'image_check',
          promptVersion: PROMPT_VERSIONS.imageCheck,
          system: IMAGE_CHECK_SYSTEM,
          user: 'Check this illustration.',
          images: [{ mediaType: img.mediaType, base64: img.bytes.toString('base64') }],
          schema: imageCheckJson,
          effort: 'medium',
          maxTokens: 4_000,
          meta: { marketId },
        },
        (x) => imageCheckZ.parse(x),
      );
      accept = r.output.accept && r.output.reasons.length === 0;
      reasons = r.output.reasons;
    } catch (e) {
      reasons = [`check failed: ${(e as Error).message}`];
    }
    await deps.db
      .insertInto('image_runs')
      .values({ market_id: marketId, model: img.model, prompt: prompt.prompt, result: accept ? 'accepted' : 'rejected', reject_reasons: JSON.stringify(reasons), cost_usd: img.costUsd.toFixed(6) })
      .execute();
    if (!accept) continue;
    const sha = createHash('sha256').update(img.bytes).digest('hex');
    const ext = img.mediaType.split('/')[1];
    const stored = await deps.store.put(`q/${sha.slice(0, 32)}.${ext === 'webp' ? 'webp' : ext}`, img.bytes, img.mediaType);
    await deps.db
      .updateTable('markets')
      .set({ image_state: 'generated', image_key: stored.key, image_url: stored.url, image_sha256: sha, image_prompt: prompt.prompt, image_model: img.model, updated_at: new Date() })
      .where('market_id', '=', marketId)
      .execute();
    return 'generated';
  }
  await useFallback(deps, m, 'every generated image was rejected');
  return 'fallback';
}

/** Images for every scheduled market still pending, and admin regenerate / fallback requests. */
export async function prepareImages(deps: ImageDeps): Promise<{ generated: number; fallback: number }> {
  const rows = await deps.db.selectFrom('markets').select('market_id').where('image_state', '=', 'pending').where('status', 'in', ['scheduled', 'published']).execute();
  const out = { generated: 0, fallback: 0 };
  for (const r of rows) out[await prepareImage(deps, r.market_id)]++;
  return out;
}

/** Width, height and media type from the header of a PNG, JPEG or WebP file (null when unknown). */
export function imageInfo(b: Buffer): { width: number; height: number; mediaType: ImageInput['mediaType'] } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), mediaType: 'image/png' };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), mediaType: 'image/webp' };
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, mediaType: 'image/webp' };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, mediaType: 'image/webp' };
    }
    return null;
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7), mediaType: 'image/jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

export interface UploadCheck {
  accepted: boolean;
  reasons: string[];
  width?: number;
  height?: number;
  sha256?: string;
}

/**
 * Checks an image an admin uploaded for a question (AD3 "Upload image"): 4:5 portrait, at least 800 x
 * 1000, at most 2 MB, PNG, JPEG or WebP, then the same vision check as generated images. On success the
 * market switches to it (`image_state` replaced). The uploader stores the thumbnail next to the key.
 */
export async function checkUploadedImage(
  deps: Pick<ImageDeps, 'db' | 'provider' | 'log'> & { aiEnabled: boolean; fetchImpl?: typeof fetch },
  marketId: number,
  src: { imageKey?: string | null; imageUrl?: string | null; baseUrl: string },
): Promise<UploadCheck> {
  const url = src.imageUrl ?? `${src.baseUrl.replace(/\/$/, '')}/${src.imageKey}`;
  const res = await (deps.fetchImpl ?? fetch)(url);
  if (!res.ok) return { accepted: false, reasons: [`fetch failed: ${res.status}`] };
  const bytes = Buffer.from(await res.arrayBuffer());
  const info = imageInfo(bytes);
  const reasons: string[] = [];
  if (!info) reasons.push('not a PNG, JPEG or WebP file');
  else {
    if (Math.abs(info.width / info.height - 0.8) > 0.02) reasons.push(`not 4:5 (${info.width} x ${info.height})`);
    if (info.width < 800 || info.height < 1000) reasons.push(`smaller than 800 x 1000 (${info.width} x ${info.height})`);
  }
  if (bytes.length > 2 * 1024 * 1024) reasons.push('larger than 2 MB');
  if (reasons.length === 0 && deps.aiEnabled && info) {
    try {
      const r = await runLogged(
        deps.db,
        deps.provider,
        { job: 'image_check', promptVersion: PROMPT_VERSIONS.imageCheck, system: IMAGE_CHECK_SYSTEM, user: 'Check this uploaded illustration.', images: [{ mediaType: info.mediaType, base64: bytes.toString('base64') }], schema: imageCheckJson, effort: 'medium', maxTokens: 4_000, meta: { marketId } },
        (x) => imageCheckZ.parse(x),
      );
      if (!r.output.accept) reasons.push(...(r.output.reasons.length ? r.output.reasons : ['rejected by the check']));
    } catch (e) {
      reasons.push(`check failed: ${(e as Error).message}`);
    }
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await deps.db
    .insertInto('image_runs')
    .values({ market_id: marketId, model: 'upload', prompt: url, result: reasons.length ? 'rejected' : 'accepted', reject_reasons: JSON.stringify(reasons) })
    .execute();
  if (reasons.length === 0) {
    await deps.db
      .updateTable('markets')
      .set({ image_state: 'replaced', image_key: src.imageKey ?? null, image_url: src.imageKey ? null : (src.imageUrl ?? null), image_sha256: sha256, image_model: 'upload', updated_at: new Date() })
      .where('market_id', '=', marketId)
      .execute();
  }
  return { accepted: reasons.length === 0, reasons, width: info?.width, height: info?.height, sha256 };
}
