// The play key in IndexedDB (DEV-PLAN 4.2): the raw secp256k1 key is stored encrypted with a
// non extractable AES-GCM CryptoKey that lives in the same database. This stops a plain storage dump
// from revealing the key; it does not stop a script running in this origin (the app's code integrity
// is the boundary, DEV-PLAN 4.1).

const DB = 'cojam-spike';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export interface StoredKey {
  address: string;
  createdAt: string;
  iv: Uint8Array;
  cipher: ArrayBuffer;
  wrap: CryptoKey;
  authorisedTx?: string;
  expiresAt?: number;
}

export async function saveKey(address: string, privateKeyHex: string): Promise<void> {
  const wrap = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, new TextEncoder().encode(privateKeyHex));
  const rec: StoredKey = { address, createdAt: new Date().toISOString(), iv, cipher, wrap };
  await idb('readwrite', (s) => s.put(rec, 'playKey'));
}

export async function loadKeyRecord(): Promise<StoredKey | undefined> {
  return idb<StoredKey | undefined>('readonly', (s) => s.get('playKey'));
}

export async function decryptKey(rec: StoredKey): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, rec.wrap, rec.cipher);
  return new TextDecoder().decode(plain);
}

export async function markAuthorised(txHash: string, expiresAt: number): Promise<void> {
  const rec = await loadKeyRecord();
  if (!rec) return;
  await idb('readwrite', (s) => s.put({ ...rec, authorisedTx: txHash, expiresAt }, 'playKey'));
}

export async function deleteKey(): Promise<void> {
  await idb('readwrite', (s) => s.delete('playKey'));
}
