// Admin API client (/admin/v1/*). Auth: the admin Privy access token, or in local dev the X-Dev-Admin header.
import { CONFIG } from '../config';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0, public details?: unknown) { super(message); }
}

let tokenSource: (() => Promise<string | null>) | null = null;
let onUnauthorized: (() => void) | null = null;
export function setTokenSource(f: (() => Promise<string | null>) | null) { tokenSource = f; }
export function setOnUnauthorized(f: () => void) { onUnauthorized = f; }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (CONFIG.devAdmin) headers['x-dev-admin'] = CONFIG.devAdmin;
  else if (tokenSource) { const t = await tokenSource(); if (t) headers.authorization = 'Bearer ' + t; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 10_000);
  let res: Response;
  try {
    res = await fetch(CONFIG.apiUrl + path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal || ctl.signal });
  } catch (e) {
    throw new ApiError('NETWORK', (e as Error).name === 'AbortError' ? 'The admin API did not answer in 10 seconds.' : 'The admin API could not be reached.');
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const e = json?.error;
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(e?.code || 'HTTP_' + res.status, e?.message || res.statusText || 'Request failed', res.status, e?.details);
  }
  return json as T;
}
