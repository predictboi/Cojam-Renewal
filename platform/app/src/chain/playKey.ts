// The play key (DEV-PLAN 4.2): generated with viem, stored in IndexedDB encrypted with a non extractable AES-GCM key.
// The wrap stops a plain storage dump from revealing the key, not a script running in our origin (4.1).
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { db, type StoredPlayKey } from './db';

export interface PlayKey { address: Hex; player: string; expiresAt?: number; account: PrivateKeyAccount }

let cache: PlayKey | null = null;

export async function loadPlayKey(): Promise<PlayKey | null> {
  if (cache) return cache;
  const rec = await db().keys.get('playKey');
  if (!rec) return null;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, rec.wrap, rec.cipher);
  const pk = new TextDecoder().decode(plain) as Hex;
  cache = { address: rec.address as Hex, player: rec.player, expiresAt: rec.expiresAt, account: privateKeyToAccount(pk) };
  return cache;
}

export async function createPlayKey(player: string): Promise<PlayKey> {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const wrap = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, new TextEncoder().encode(pk));
  const rec: StoredPlayKey = { id: 'playKey', address: account.address, player: player.toLowerCase(), createdAt: Date.now(), iv, cipher, wrap };
  await db().keys.put(rec);
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
  cache = { address: account.address, player: rec.player, account };
  return cache;
}

export async function markAuthorised(expiresAt: number, tx: string) {
  await db().keys.update('playKey', { expiresAt, authorisedTx: tx });
  if (cache) cache.expiresAt = expiresAt;
}

export async function deletePlayKey() { cache = null; await db().keys.delete('playKey'); }

/** Sign a 32 byte hash with the play key (a few milliseconds, no network). */
export async function signWithPlayKey(k: PlayKey, hash: Hex): Promise<Hex> { return k.account.sign({ hash }); }

export const playKeyValid = (k: PlayKey | null, nowSec = Date.now() / 1000) => !!k && !!k.expiresAt && k.expiresAt > nowSec;
export const playKeyNeedsRenew = (k: PlayKey | null, nowSec = Date.now() / 1000) => !!k?.expiresAt && k.expiresAt - nowSec < 7 * 86400;
