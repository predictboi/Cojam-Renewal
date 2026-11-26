// Typed client for the app API (DEV-PLAN 6.2). The same interface is served by the mock adapter (mock.ts)
// when VITE_API_MOCK=1, so every screen can be opened without a server.
import { CONFIG } from '../config';
import { ApiError } from './errors';
import type {
  AppConfig, EmailCheck, InviteInfo, InviteLookup, Lang, Me, Positions, Ranking, Results, SessionState,
  SponsorOk, StakeQuote, Today, TxStatus, WalletInfo,
} from './types';

export interface Api {
  config(): Promise<AppConfig>;
  emailCheck(email: string): Promise<EmailCheck>;
  createSession(inviteCode?: string): Promise<SessionState>;
  session(): Promise<SessionState>;
  me(): Promise<Me>;
  patchMe(p: Partial<{ language: Lang; name: string; onboarded: boolean }>): Promise<Me>;
  today(): Promise<Today>;
  invite(): Promise<InviteInfo>;
  inviteLookup(code: string): Promise<InviteLookup>;
  inviteRedeem(code: string): Promise<{ status: 'linked'; inviterName: string }>;
  results(cursor?: string): Promise<Results>;
  ranking(week: 'current' | 'last' | number): Promise<Ranking>;
  wallet(): Promise<WalletInfo>;
  stakingQuote(amount: number, lock: number): Promise<StakeQuote>;
  positions(): Promise<Positions>;
  sponsor(rawTransaction: string, opts?: { auth?: boolean }): Promise<SponsorOk>;
  tx(hash: string): Promise<TxStatus>;
}

type TokenFn = () => Promise<string | null>;
let tokenFn: TokenFn = async () => null;
export function setTokenSource(fn: TokenFn) { tokenFn = fn; }

async function call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) { const tok = await tokenFn().catch(() => null); if (tok) headers.authorization = 'Bearer ' + tok; }
  let res: Response;
  try {
    res = await fetch(CONFIG.apiUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError('NETWORK', (e as Error).message, 0);
  }
  let j: unknown;
  try { j = await res.json(); } catch { throw new ApiError('BAD_RESPONSE', 'HTTP ' + res.status + ' without JSON', res.status); }
  const err = (j as { error?: { code: string; message: string; txHash?: string } }).error;
  if (!res.ok || err) {
    const { code, message, txHash, ...extra } = (err || { code: 'HTTP_' + res.status, message: 'error' }) as { code: string; message: string; txHash?: string };
    throw new ApiError(code, message, res.status, txHash, extra);
  }
  return j as T;
}

export const httpApi: Api = {
  config: () => call('GET', '/v1/config', undefined, false),
  emailCheck: (email) => call('POST', '/v1/auth/email-check', { email }, false),
  createSession: (inviteCode) => call('POST', '/v1/session', inviteCode ? { inviteCode } : {}),
  session: () => call('GET', '/v1/session'),
  me: () => call('GET', '/v1/me'),
  patchMe: (p) => call('PATCH', '/v1/me', p),
  today: () => call('GET', '/v1/today'),
  invite: () => call('GET', '/v1/invite'),
  inviteLookup: (code) => call('GET', '/v1/invite/lookup?code=' + encodeURIComponent(code), undefined, false),
  inviteRedeem: (code) => call('POST', '/v1/invite/redeem', { code }),
  results: (cursor) => call('GET', '/v1/results' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
  ranking: (week) => call('GET', '/v1/ranking/week/' + week),
  wallet: () => call('GET', '/v1/wallet'),
  stakingQuote: (amount, lock) => call('GET', '/v1/staking/quote?amount=' + amount + '&lock=' + lock),
  positions: () => call('GET', '/v1/staking/positions'),
  // A play key predict is sponsored without a token (6.2): the outbox passes auth: false
  sponsor: (rawTransaction, opts) => call('POST', '/v1/tx/sponsor', { rawTransaction }, opts?.auth !== false),
  tx: (hash) => call('GET', '/v1/tx/' + hash),
};
