// Typed client for the app API (DEV-PLAN 6.2). The same interface is served by the mock adapter (mock.ts)
// when VITE_API_MOCK=1, so every screen can be opened without a server.
import { CONFIG } from '../config';
import { ApiError } from './errors';
import { parseUnits } from 'viem';
import type * as W from '../../../shared/src/api.ts';
import * as A from './adapt';
import { setKrwPerCt } from '../lib/fmt';
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
  // error body (platform/shared/src/errors.ts): { error: { code, message, retryable, details? } }
  const err = (j as { error?: { code: string; message: string; retryable?: boolean; details?: Record<string, unknown>; txHash?: string } }).error;
  if (!res.ok || err) {
    const e = err || { code: 'HTTP_' + res.status, message: 'error' };
    const txHash = (e.txHash || e.details?.txHash) as string | undefined;
    throw new ApiError(e.code, e.message, res.status, txHash, { ...(e.details || {}), retryable: e.retryable });
  }
  return j as T;
}

// The wire types live in platform/shared (written by the API agent); adapt.ts maps them to the screens' view models.
let lastEmail: string | null = null;
export function setSessionEmail(e: string | null) { lastEmail = e; }
let cachedConfig: W.ConfigResponse | null = null;

export const httpApi: Api = {
  config: async () => { cachedConfig = await call<W.ConfigResponse>('GET', '/v1/config', undefined, false); return A.config(cachedConfig); },
  emailCheck: async (email) => A.emailCheck(await call<W.EmailCheckResponse>('POST', '/v1/auth/email-check', { email }, false)),
  createSession: async (inviteCode) => A.session(await call<W.SessionResponse>('POST', '/v1/session', inviteCode ? { inviteCode } : {})),
  session: async () => A.session(await call<W.SessionResponse>('GET', '/v1/session')),
  me: async () => {
    const [m, inv, rk] = await Promise.all([
      call<W.MeResponse>('GET', '/v1/me'),
      call<W.InviteResponse>('GET', '/v1/invite').catch(() => null),
      call<W.RankingResponse>('GET', '/v1/ranking/week/current').catch(() => null),
    ]);
    return A.me(m, lastEmail, { invite: inv, ranking: rk });
  },
  patchMe: async (p) => {
    const body: W.PatchMeRequest = { language: p.language, onboarded: p.onboarded, displayName: p.name === undefined ? undefined : p.name || null };
    const m = await call<W.MeResponse>('PATCH', '/v1/me', body);
    return A.me(m, lastEmail);
  },
  today: async () => A.today(await call<W.TodayResponse>('GET', '/v1/today')),
  invite: async () => A.invite(await call<W.InviteResponse>('GET', '/v1/invite')),
  inviteLookup: (code) => call('GET', '/v1/invite/lookup?code=' + encodeURIComponent(code), undefined, false),
  inviteRedeem: (code) => call('POST', '/v1/invite/redeem', { code }),
  results: async (cursor) => A.results(await call<W.ResultsResponse>('GET', '/v1/results' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''))),
  ranking: async (week) => {
    let id: string | number = week;
    if (week === 'last') { const cur = await call<W.RankingResponse>('GET', '/v1/ranking/week/current'); id = cur.weekId - 1; }
    return A.ranking(await call<W.RankingResponse>('GET', '/v1/ranking/week/' + id));
  },
  wallet: async () => {
    const [w, pos, inv] = await Promise.all([
      call<W.WalletResponse>('GET', '/v1/wallet'),
      call<W.StakingPositionsResponse>('GET', '/v1/staking/positions').catch(() => null),
      call<W.InviteResponse>('GET', '/v1/invite').catch(() => null),
    ]);
    if (w.krwPerCt) setKrwPerCt(w.krwPerCt);
    return A.wallet(w, { open: pos?.totals.open, inviteWeek: inv?.stats.bonusThisWeek, capPerDay: cachedConfig?.params?.maxConvertCtPerUserPerDay });
  },
  stakingQuote: async (amount, lock) => {
    return A.quote(await call<W.StakingQuoteResponse>('GET', '/v1/staking/quote?amount=' + parseUnits(String(amount), 18) + '&lock=' + lock));
  },
  positions: async () => A.positions(await call<W.StakingPositionsResponse>('GET', '/v1/staking/positions')),
  // A play key predict is sponsored without a token (6.2): the outbox passes auth: false
  sponsor: (rawTransaction, opts) => call('POST', '/v1/tx/sponsor', { rawTransaction }, opts?.auth !== false),
  tx: async (hash) => { const r = await call<W.TxStatusResponse>('GET', '/v1/tx/' + hash); return { hash: r.txHash, status: r.status }; },
};
