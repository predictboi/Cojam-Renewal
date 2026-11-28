// In app mock adapter: serves the Api interface from the design's mock data (design-mock.json, copied from
// platform/design/assets/mock.js by scripts/gen-mock.mjs), shaped by the same ?state= presets the prototype uses.
// A small "chain" lives in sessionStorage (picks made today, the completion reward, stakes, conversions), so a walk
// through the app behaves like the prototype: picks made on Home show on Done, a stake shows on My stakes.
import { presetOf } from '../../lib/preset';
import { ApiError } from '../errors';
import type { Api } from '../client';
import type {
  AppConfig, Dir, InviteInfo, Lang, Market, Me, Position, Positions, QText, Ranking, RankRow, ResultDay, ResultRow, Results,
  SessionState, Today, WalletInfo, Address, Localized,
} from '../types';
import RAW from './design-mock.json';
import { MOCK_QUESTIONS, MOCK_RESULTS_DAY0 } from './questions';

// The design's data with compliant questions (questions.ts); today's set shows no outcome yet, the pending hit moves to
// yesterday's set (p2, answer set at 15:40, the +50P lands 6 hours later).
const M = {
  ...RAW,
  questions: MOCK_QUESTIONS as unknown as typeof RAW.questions,
  results: RAW.results.map((d, i) => i === 0 ? { ...d, pending: 0, rows: MOCK_RESULTS_DAY0.map((r) => ({ ...r })) }
    : i === 1 ? { ...d, pending: 50, rows: d.rows.map((r) => (r.q === 'p2' ? { ...r, c: 'r', out: 'pend', at: '21:40' } : r)) } : d) as unknown as typeof RAW.results,
};

const DAY = 86400000;
const now = () => Date.now();
const ago = (d: number) => now() - d * DAY;
const ahead = (d: number) => now() + d * DAY;
const dayStart = (t = now()) => Math.floor(t / DAY) * DAY;
const dayId = () => Math.floor(now() / DAY);
const nextOpen = () => dayStart() + DAY;
function nextMonday() { const n = new Date(); const dow = n.getUTCDay(); const add = (8 - dow) % 7 || 7; return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + add, 0, 0, 0); }

type QM = { n?: number; img?: string; cat: string } & Record<Lang, QText>;
const QS = M.questions as unknown as Record<string, QM>;
const text = (id: string): Localized<QText> => ({ en: QS[id].en, ko: QS[id].ko, ja: QS[id].ja });

/* ---------- the mock chain (sessionStorage, one daily set) ---------- */
export interface MockChain {
  day: number; picks: Record<string, 1 | 2>; paid: boolean; stakes: { amount: number; days: number; rate: number; start: number }[];
  closed: string[]; convertedPts: number; ctDelta: number; name: string | null; inviter: string | null; registered: boolean; playKey: { key: Address; expiresAt: number } | null;
}
const KEY = 'cjm.chain';
export function mockChain(): MockChain {
  let d: MockChain | null = null;
  try { d = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* */ }
  if (!d || d.day !== dayId()) d = { day: dayId(), picks: {}, paid: false, stakes: d?.stakes || [], closed: d?.closed || [], convertedPts: d?.convertedPts || 0, ctDelta: d?.ctDelta || 0, name: d?.name ?? M.user.name, inviter: d?.inviter ?? null, registered: d?.registered ?? true, playKey: d?.playKey ?? null };
  return d;
}
export function saveChain(d: MockChain) { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* */ } }
export function resetDay() { const d = mockChain(); d.picks = {}; d.paid = false; saveChain(d); }

const where = () => ({ path: location.pathname, st: presetOf(location.search) });
const wait = <T>(v: T, ms = 160) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const never = <T>() => new Promise<T>(() => {});
function guard(path: RegExp) { const w = where(); if (!path.test(w.path)) return ''; return w.st; }

/* ---------- builders ---------- */
const marketId = (slot: number) => String(dayId() * 5 + slot);

function cfg(): AppConfig {
  const st = where().st;
  return {
    network: 'kairos', chainId: 1001, rpcUrl: 'https://public-en-kairos.node.kaia.io', explorer: 'https://kaiascan.io',
    contracts: { ct: M.token as Address, predict: '0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58', staking: '0x7879f0a137eae8e45eb670e9ac7bb08c5dfadb84' },
    params: {
      completionPoints: 100, hitPoints: 50, pointsPerCT: 1000, minConvertPoints: 1000, maxConvertCtPerUserPerDay: 50, referralBps: M.invite.rate * 100,
      welcomePoints: M.invite.welcome, settleDelaySec: 21600, minStake: M.minStake, minClaim: M.minClaim, maxOpenPositions: 20,
      lockDays: [30, 90, 180, 365], tierThresholds: [1000, 10000], ratesPct: M.rates as unknown as Record<string, number[]>, playKeyTtlDays: 30,
    },
    minAppVersion: st === 'update' && /^\/system/.test(location.pathname) ? '9.0.0' : '1.0.0',
    flags: { maintenance: false, stakingPaused: false, convertPaused: false },
    krwPerCt: M.krwPerCt, userTxFeeKaia: M.fee, emailProviders: M.emailProviders, providerNames: M.providerNames,
  };
}

function frozen() { return /^hold/.test(where().st); }

function me(): Me {
  const c = mockChain(), st = where().st;
  const code = /^code-/.test(st) && st !== 'code-linked';
  return {
    wallet: M.user.address as Address, email: M.user.email, name: c.name, language: 'en', onboarded: true, registration: 'registered',
    frozen: frozen(), signedUpAt: new Date(code ? now() - 3.2 * 3600000 : ago(20)).toISOString(),
    referrer: st === 'code-linked' ? { name: 'dalgona' } : c.inviter ? { name: c.inviter } : code ? null : null,
    stats: { weekRank: st === 'unranked' || st === 'hold' ? null : M.around[2].rank, weekPoints: M.around[2].pts, points: points(), newAnswers: 2 },
  };
}
function points() {
  const c = mockChain(), st = where().st;
  if (st === 'zero' && /wallet/.test(location.pathname)) return 0;
  if (st === 'new' && /wallet/.test(location.pathname)) return 450;
  if (st === 'short' && /convert/.test(location.pathname)) return 450;
  if (st === 'cap' && /convert/.test(location.pathname)) return 62250;
  return M.user.points + (c.paid ? 100 : 0) - c.convertedPts;
}

function today(): Today {
  const st = guard(/^\/(list)?$|^\/done/), c = mockChain();
  const presetAnswered: Record<string, number[]> = { partial: [1, 2], syncing: [1], slow: [1], failed: [1, 3], offline: [1, 2], reconnect: [1], reconnectfail: [1] };
  const isList = /^\/list/.test(location.pathname);
  const listPreset = isList && st !== 'fresh' && st !== 'partial0' && st !== 'hold' && st !== '' ? [1] : [];
  const fixed = st ? (isList ? listPreset : presetAnswered[st] || []) : null;
  const markets: Market[] = M.set.map((id, slot) => {
    const q = QS[id];
    const mid = marketId(slot);
    const chain = fixed ? (fixed.includes(slot + 1) ? 2 : 0) : c.picks[mid] || 0;
    return { marketId: mid, slot, n: slot + 1, category: q.cat as Market['category'], imageUrl: st === 'noimage' && slot === 0 ? null : q.img || null, closesAt: nextOpen(), text: text(id), choice: { chain: chain as 0 | 1 | 2 } };
  });
  return {
    dayId: dayId(), opensAt: dayStart(), nextOpenAt: nextOpen(),
    state: st === 'empty' ? 'empty' : st === 'closed' ? 'closed' : 'open',
    markets: st === 'empty' ? [] : markets, completed: c.paid, welcomePaid: st === 'welcome', inviterName: st === 'welcome' ? M.invite.by : null,
  };
}

function wallet(): WalletInfo {
  const c = mockChain(), st = where().st, path = location.pathname;
  const zero = st === 'zero' && /wallet|staking/.test(path);
  let ct = M.user.ct + c.ctDelta - c.stakes.reduce((a, s) => a + s.amount, 0);
  if (zero) ct = 0;
  if ((st === 'big' || st === 'review') && /staking/.test(path)) ct = 25000;
  const kaia = st === 'zero' && /wallet/.test(path) ? 0 : (st === 'nokaia' || st === 'hold-nokaia') ? 0.0004 : M.user.kaia;
  return {
    address: M.user.address as Address, ct: Math.round(ct * 1e4) / 1e4, kaia, points: points(),
    staked: zero ? 0 : M.user.staked + c.stakes.reduce((a, s) => a + s.amount, 0), openStakes: st === 'max20' ? 20 : M.stakes.length + c.stakes.length,
    pendingHit: { points: M.user.pendingHit, landsAt: todayAt(21, 40) },
    convert: { pointsPerCT: 1000, min: 1000, capLeftCt: st === 'cap' ? 0 : 50, capPerDayCt: 50, globalCapLeft: st === 'capglobal' ? 0 : 20000, firstConvertAt: st === 'wait' || (st === 'short' && /convert/.test(path)) ? ahead(3.4) : null, paused: st === 'paused' && /convert/.test(path) },
    inviteWeek: zero || st === 'new' ? 0 : M.invite.week,
  };
}
/** today's date in Korea at h:m Korean time (the product's clock), whatever the device's time zone */
function todayAt(h: number, m: number) { const k = new Date(Date.now() + 9 * 3600000); return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), h - 9, m); }

function positions(): Positions {
  const st = guard(/^\/stakes/), c = mockChain();
  const S = (id: string, amount: number, days: number, rate: number, start: number): Position => ({ id, amount, lockDays: days, aprPct: rate, start, end: start + days * DAY, claimed: 0, closed: false });
  let list: Position[] = [S('a', 1000, 90, 13, ago(21)), S('b', 500, 30, 8, ago(31))];
  if (st === 'claimable' || st === 'claim' || /^hold/.test(st)) list.unshift(S('d', 12000, 180, 20, ago(40)));
  if (st === 'unlocking') list[0] = S('u', 1000, 90, 13, now() - 90 * DAY + 6000);
  if (!st) list = c.stakes.map((s, i) => S('n' + i, s.amount, s.days, s.rate, s.start)).reverse().concat(list).filter((p) => !c.closed.includes(p.id));
  if (st === 'empty') list = [];
  return { positions: list, closed: [{ ...S('c', 300, 30, 8, ago(64)), closed: true, paid: 301.97 }] };
}

function ranking(week: 'current' | 'last' | number): Ranking {
  const st = guard(/^\/ranking/), last = week === 'last';
  let rows: RankRow[] = M.ranking.map((r) => ({ rank: r.rank, name: r.name, points: r.pts, prize: r.prize }));
  if (last) rows = rows.map((r, i) => ({ ...r, points: r.points + 900 - i * 10, prize: +((1196 * M.pool.split[i]) / 100).toFixed(2) }));
  else {
    if (st === 'top10') rows[6] = { rank: 7, name: M.user.name, points: 1150, prize: 51.36, me: true };
    if (st === 'short') rows = rows.slice(0, 6);
  }
  let around: RankRow[] = M.around.slice(1, 4).map((r) => ({ rank: r.rank, name: r.name, points: r.pts, me: !!(r as { me?: boolean }).me }));
  if (last) around = around.map((r, i) => ({ ...r, rank: 30 + i, points: 1250 - i * 50 }));
  const held = st === 'hold';
  const meRank = last ? 31 : st === 'top10' ? 7 : st === 'unranked' || held ? null : M.me.rank;
  return {
    weekId: Math.floor((dayId() + 3) / 7) - (last ? 1 : 0), state: last ? (st === 'sent' ? 'sent' : 'final') : 'live', endsAt: nextMonday(),
    pool: { ct: last ? 1196 : M.pool.ct, players: M.pool.players, splitPct: M.pool.split },
    top: rows,
    me: { rank: meRank, points: last ? 1200 : st === 'top10' ? 1150 : M.me.pts, gap: st === 'top10' ? null : M.me.gap, prize: st === 'top10' ? 51.36 : null, held },
    around: st === 'unranked' || held || (!last && st === 'top10') ? [] : around,
    airdropTx: st === 'sent' ? '0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1' : undefined,
    lastWeek: st === 'winner' ? { rank: 4, amount: 119.6 } : null,
  };
}

function results(): Results {
  const st = guard(/^\/results/);
  type MR = { q: string; c: Dir | null; out: string; at?: string; exp?: string };
  type MD = { day: number; done: boolean; total: number; pending?: number; answered?: number; rows: MR[] };
  let days = M.results as unknown as MD[];
  if (st === 'nowaiting') days = days.slice(1);
  if (st === 'noset') days = [{ day: 0, done: true, total: 100, rows: days[0].rows.map((r) => ({ ...r, out: 'wait', exp: r.exp || '16:00' })) }];
  const hm = (s?: string) => { if (!s) return undefined; const [h, m] = s.split(':').map(Number); return todayAt(h, m); };
  // A day's answers fall on the next date (the one its titles name); one read before 09:00 KST falls a date later still.
  const exp = (s: string | undefined, day: number) => { const t = hm(s); return t === undefined ? undefined : t + (1 - day + (Number(s!.split(':')[0]) < 9 ? 1 : 0)) * DAY; };
  const inv = M.invite.days as unknown as Record<string, { pts: number; n: number }>;
  const out: ResultDay[] = (st === 'empty' ? [] : days).map((g) => ({
    dayId: dayId() - g.day, date: ago(g.day), answered: g.answered ?? 5, completed: g.done, points: g.total, pendingPoints: g.pending || 0,
    inviteBonus: st === 'noset' || !inv[g.day] ? undefined : { points: inv[g.day].pts, friends: inv[g.day].n },
    rows: g.rows.map((r): ResultRow => {
      const q = QS[r.q], rules = (M.pastRules as unknown as Record<string, string[]>)[r.q];
      const tx = text(r.q);
      if (rules) (['en', 'ko', 'ja'] as Lang[]).forEach((l, i) => { tx[l] = { ...tx[l], rule: tx[l].rule || rules[i] }; });
      return { marketId: r.q, category: q.cat as Market['category'], text: tx, choice: r.c, outcome: r.out as ResultRow['outcome'], expectedAt: exp(r.exp, g.day), landsAt: hm(r.at), setAt: ago(g.day), answer: r.out === 'miss' ? (r.c === 'r' ? 'l' : 'r') : r.c || undefined };
    }),
  }));
  return { summary: { week: { points: M.week.pts, hits: M.week.hits, answered: M.week.answered }, all: { points: M.all.pts, hitRate: M.all.rate }, pending: { points: M.user.pendingHit, landsAt: todayAt(21, 40) } }, days: out, nextCursor: st === 'empty' ? null : 'more' };
}
const moreDay: ResultDay = (() => {
  const rows: [string, Dir, string][] = [['p5', 'r', 'hit'], ['p2', 'r', 'hit'], ['p6', 'l', 'miss'], ['p7', 'r', 'miss'], ['p3', 'l', 'miss']];
  return { dayId: 0, date: 0, answered: 5, completed: true, points: 200, pendingPoints: 0, rows: rows.map(([q, c, out]) => ({ marketId: q, category: QS[q].cat as Market['category'], text: text(q), choice: c, outcome: out as ResultRow['outcome'] })) };
})();

function invite(): InviteInfo {
  const st = guard(/^\/invite/), V = M.invite;
  return {
    code: V.code, link: V.link, linkShort: V.linkShort, referralBps: V.rate * 100, welcomePoints: V.welcome,
    stats: { joined: st === 'empty' ? 0 : V.joined, firstDay: 3, bonusTotal: st === 'empty' ? 0 : V.total, bonusWeek: st === 'empty' ? 0 : V.week },
    friends: st === 'empty' ? [] : V.friends.map((f) => ({ name: f.name, state: f.st as 'joined' | 'first', points: f.pts })),
  };
}

/* which query is the screen's main read, for the loading and error presets */
const MAIN: Record<string, RegExp> = { today: /^\/(list)?$/, results: /^\/results/, ranking: /^\/ranking/, positions: /^\/stakes/, invite: /^\/invite/, wallet: /^\/(staking|convert|withdraw|deposit)$/ };
function gate<T>(name: string, v: () => T, ms?: number): Promise<T> {
  const w = where();
  if (w.st === 'loading' && (MAIN[name]?.test(w.path) || name === 'wallet' && w.path !== '/profile')) return never();
  if (w.st === 'error' && MAIN[name]?.test(w.path)) return new Promise((_, rej) => setTimeout(() => rej(new ApiError('NETWORK', 'mock error')), 120));
  return wait(v(), ms);
}

export const mockApi: Api & { moreResults(): ResultDay; inviteKnown: Record<string, string>; selfCode: string } = {
  config: () => wait(cfg(), 20),
  emailCheck: async (email) => {
    const dom = (email.split('@')[1] || '').toLowerCase();
    return wait({ allowed: M.emailProviders.includes(dom), reason: M.emailProviders.includes(dom) ? undefined : 'provider', supportedProviders: M.emailProviders }, 300);
  },
  createSession: async (code) => {
    const c = mockChain();
    if (code && M.invite.known[code as keyof typeof M.invite.known]) c.inviter = M.invite.known[code as keyof typeof M.invite.known];
    saveChain(c);
    return wait(sessionState(), 400);
  },
  session: () => wait(sessionState(), 200),
  me: () => gate('me', me),
  patchMe: async (p) => { const c = mockChain(); if (p.name !== undefined) c.name = p.name; saveChain(c); return wait(me(), 200); },
  today: () => gate('today', today, 180),
  invite: () => gate('invite', invite),
  inviteLookup: async (code) => {
    const known = M.invite.known as Record<string, string>;
    return wait(known[code] ? { valid: true, inviterName: known[code] } : { valid: false }, 500);
  },
  inviteRedeem: async (code) => {
    const known = M.invite.known as Record<string, string>;
    await wait(null, 500);
    if (code.length < 6) throw new ApiError('INVITE_SHORT', 'short');
    if (code === M.invite.self || code === M.invite.code && /^\/profile/.test(location.pathname)) throw new ApiError('INVITE_OWN', 'own');
    if (!known[code]) throw new ApiError('INVITE_UNKNOWN', 'unknown');
    const c = mockChain(); c.inviter = known[code]; saveChain(c);
    return { status: 'linked', inviterName: known[code] };
  },
  results: (cursor) => cursor ? wait({ summary: results().summary, days: [{ ...moreDay, dayId: dayId() - 3, date: ago(3) }], nextCursor: null }, 300) : gate('results', results),
  ranking: (week) => gate('ranking', () => ranking(week)),
  wallet: () => gate('wallet', wallet),
  stakingQuote: async (amount, lock) => {
    const tier = amount >= 10000 ? 2 : amount >= 1000 ? 1 : 0, r = (M.rates as unknown as Record<string, number[]>)[lock][tier];
    const st = where().st;
    return { tier, aprPct: r, interest: (amount * r / 100) * lock / 365, capacityLeft: st === 'full' ? 300 : st === 'fullnone' ? 0 : 1e9 };
  },
  positions: () => gate('positions', positions),
  sponsor: async () => wait({ txHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64), action: 'mock' }, 350),
  tx: async (hash) => ({ hash, status: 'mined' }),
  moreResults: () => moreDay,
  inviteKnown: M.invite.known as Record<string, string>,
  selfCode: M.invite.self,
};
function sessionState(): SessionState {
  const c = mockChain();
  return { registration: 'registered', frozen: frozen(), playKey: c.playKey, invite: { code: M.invite.code, linkedTo: c.inviter }, isNew: true };
}

export const DESIGN = M;
