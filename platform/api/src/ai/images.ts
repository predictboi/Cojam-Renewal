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
import { imageCheckJson, imageCheckZ, imagePromptJson, imagePromptZ, type Category } from './schemas.ts';

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

/** Stores accepted images (R2 in production, `img.cojam.app`). Returns the object key and public URL. */
export interface ImageStore {
  put(key: string, bytes: Buffer, mediaType: string): Promise<{ key: string; url: string }>;
}

/**
 * The category illustration set. Keys are paths the PWA serves from its own bundle (copied from
 * platform/design/assets/img). Culture has no drawing: the card draws the category icon on the blue
 * grid (`.qimg--fallback`), so its key is null.
 */
export const CATEGORY_ILLUSTRATIONS: Record<Category, string[]> = {
  Crypto: ['fallback/q1-bitcoin.svg', 'fallback/q5-kaia.svg'],
  Markets: ['fallback/q2-dollar-won.svg'],
  Weather: ['fallback/q3-seoul-weather.svg'],
  Sports: ['fallback/q4-football.svg'],
  Culture: [],
};

export function fallbackKey(category: string, marketId: number): string | null {
  const list = CATEGORY_ILLUSTRATIONS[category as Category] ?? [];
  if (list.length === 0) return null;
  return list[Math.abs(marketId) % list.length];
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
  const key = fallbackKey(m.category, m.market_id);
  await deps.db
    .updateTable('markets')
    .set({ image_state: 'fallback', image_key: key, image_url: null, image_sha256: null, image_model: deps.generator.name, updated_at: new Date() })
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
    const stored = await deps.store.put(`q/${sha.slice(0, 32)}.${ext}`, img.bytes, img.mediaType);
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
