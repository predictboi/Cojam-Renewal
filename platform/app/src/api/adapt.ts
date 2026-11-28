// Maps the API's wire types (platform/shared/src/api.ts: unix seconds, base unit strings, numeric ids) to the view
// models the screens use (./types.ts: ms, token units, the design's names). Anything the wire types do not carry yet
// falls back to a safe default and is listed in the build report as a field the plan or the API still has to add.
import { formatUnits } from 'viem';
import type * as W from '../../../shared/src/api.ts';
import type { DataSplit } from '../../../shared/src/dataRoom.ts';
import { addressesFor } from '../../../shared/addresses/index.ts';
import { CONFIG } from '../config';
import { DESIGN } from './mock';
import type {
  Address, AppConfig, Dir, EmailCheck, InviteInfo, Market, Me, Outcome, Position, Positions, Ranking, RankRow, ResultDay, Results,
  SessionState, StakeQuote, Today, WalletInfo,
} from './types';

const ct = (wei: string | null | undefined) => (wei ? Number(formatUnits(BigInt(wei), 18)) : 0);
const ms = (s: number | null | undefined) => (s ? s * 1000 : 0);
const dir = (c: 1 | 2 | null | undefined): Dir | null => (c === 1 ? 'l' : c === 2 ? 'r' : null);

export function config(c: W.ConfigResponse): AppConfig {
  const fallback = (() => { try { return addressesFor(c.network === 'kaia' ? 'kaia' : 'kairos'); } catch { return null; } })();
  const zero = '0x0000000000000000000000000000000000000000' as Address;
  const rates: Record<string, number[]> = {};
  (c.staking?.lockDays || [30, 90, 180, 365]).forEach((d, i) => { rates[String(d)] = c.staking ? c.staking.rates[i].map((b) => b / 100) : (DESIGN.rates as unknown as Record<string, number[]>)[String(d)]; });
  return {
    network: c.network, chainId: c.chainId,
    rpcUrl: c.rpcUrl || CONFIG.chain.rpc,
    explorer: (c.explorerUrl || CONFIG.chain.explorer).replace(/\/$/, ''),
    gasLimits: c.gasLimits,
    contracts: { ct: (c.contracts.ct || fallback?.ct || zero) as Address, predict: (c.contracts.predict || fallback?.predict || zero) as Address, staking: (c.contracts.staking || fallback?.staking || zero) as Address },
    params: {
      completionPoints: c.params?.completionPoints ?? 100, hitPoints: c.params?.hitPoints ?? 50, pointsPerCT: c.params?.pointsPerCT ?? 1000,
      minConvertPoints: c.params?.minConvertPoints ?? 1000, maxConvertCtPerUserPerDay: c.params?.maxConvertCtPerUserPerDay ?? 50,
      referralBps: c.params?.referralBps ?? 1000, welcomePoints: c.params?.welcomePoints ?? 100, settleDelaySec: c.params?.settleDelaySeconds ?? 21600,
      minStake: c.staking ? ct(c.staking.minStakeWei) : 100, minClaim: c.staking ? ct(c.staking.minClaimWei) : 10, maxOpenPositions: c.stakingLimits?.maxOpenPositions ?? 20,
      maxUserPrincipal: c.stakingLimits ? ct(c.stakingLimits.maxUserPrincipalWei) : c.staking ? ct(c.staking.maxUserPrincipalWei) : 1_000_000,
      lockDays: c.staking?.lockDays || [30, 90, 180, 365], tierThresholds: c.staking ? c.staking.tierThresholdsWei.map(ct) : [1000, 10000],
      ratesPct: rates, playKeyTtlDays: c.playKeyTtlDays || 30,
    },
    minAppVersion: c.minAppVersion,
    flags: {
      maintenance: !!c.maintenance?.on,
      maintenanceMessage: c.maintenance?.message ? { en: c.maintenance.message.en || '', ko: c.maintenance.message.ko || c.maintenance.message.en || '', ja: c.maintenance.message.ja || c.maintenance.message.en || '' } : undefined,
      maintenanceUntil: c.maintenance?.backAt ? new Date(c.maintenance.backAt * 1000).toISOString() : undefined,
      stakingPaused: !c.features.staking || !!c.stakingLimits?.paused, convertPaused: !c.features.conversion,
    },
    krwPerCt: c.krwPerCt ?? DESIGN.krwPerCt,
    userTxFeeKaia: c.userTxFeeWei ? ct(c.userTxFeeWei) : DESIGN.fee,
    emailProviders: c.emailProviders?.length ? c.emailProviders.map((p) => p.domain) : DESIGN.emailProviders,
    providerNames: c.emailProviders?.length ? providerList(c.emailProviders.map((p) => p.name)) : DESIGN.providerNames,
  };
}

/** "Gmail, Naver, Kakao" as the caption shows it (the design's own order first, then the rest of the allow list). */
function providerList(names: string[]): string {
  const order = DESIGN.providerNames.split(/,\s*/);
  const known = order.filter((n) => names.includes(n));
  return [...known, ...names.filter((n) => !known.includes(n))].join(', ');
}

export function emailCheck(r: W.EmailCheckResponse): EmailCheck {
  return { allowed: r.allowed, reason: r.reason === 'EMAIL_DOMAIN_NOT_ALLOWED' ? 'provider' : r.reason === 'EMAIL_INVALID' ? 'bad' : undefined, supportedProviders: r.supportedProviders.map((p) => p.domain) };
}

export function session(r: W.SessionResponse): SessionState {
  const reason = r.reason === 'EMAIL_DUPLICATE' ? 'used' : r.reason === 'EMAIL_DOMAIN_NOT_ALLOWED' ? 'provider' : r.reason === 'SIGNUP_RATE_LIMITED' ? 'many' : r.reason ? 'other' : undefined;
  return { registration: r.registration, reason, frozen: r.frozen, playKey: r.playKey ? { key: r.playKey.key, expiresAt: r.playKey.expiresAt } : null, invite: { code: r.invite.code || '', linkedTo: r.invite.linkedTo?.name || null } };
}

export function me(r: W.MeResponse, email: string | null, extra: { invite?: W.InviteResponse | null; ranking?: W.RankingResponse | null } = {}): Me {
  return {
    wallet: (r.wallet || '0x') as Address, email: email || (r.emailDomain ? '…@' + r.emailDomain : ''), name: r.displayName, language: r.language, onboarded: r.onboarded,
    registration: r.registration, frozen: r.frozen, signedUpAt: new Date(ms(r.registeredAt || r.createdAt)).toISOString(),
    referrer: extra.invite?.linkedTo || null,
    stats: { weekRank: extra.ranking?.me?.rank ?? null, weekPoints: extra.ranking?.me?.points ?? 0, points: r.stats.pointsAllTime, newAnswers: r.newResults ?? 0 },
  };
}

export function today(r: W.TodayResponse): Today {
  const now = Date.now();
  const markets: Market[] = r.markets.map((m) => ({
    marketId: String(m.marketId), slot: m.slot, n: m.slot + 1, category: m.category as Market['category'], imageUrl: m.imageUrl, closesAt: ms(m.closesAt), resolvesAt: ms(m.resolvesAt) || undefined, text: m.text,
    choice: { chain: (m.myChoice || m.pendingChoice || 0) as 0 | 1 | 2 },
  }));
  return {
    dayId: r.dayId, opensAt: ms(r.opensAt), nextOpenAt: ms(r.nextOpensAt),
    state: !r.published ? 'empty' : now >= ms(r.endsAt) ? 'closed' : 'open',
    markets, completed: r.completed, welcomePaid: !!r.completion?.welcomePoints, inviterName: r.inviterName ?? null,
  };
}

function outcome(row: W.ResultRow): Outcome {
  if (row.result === 'unanswered') return 'none';
  if (row.result === 'void') return 'void';
  if (row.result === 'pending') return 'wait';
  if (row.result === 'miss') return 'miss';
  if (row.correctedOutcome) return 'corr';
  return row.hitState === 'pending' ? 'pend' : 'hit';
}
/** The split on a result row (platform/shared/src/dataRoom.ts), only on a row the player picked; anything malformed is dropped. */
function splitOf(x: W.ResultRow & { split?: DataSplit | null }): DataSplit | undefined {
  const s = x.split;
  if (!s || !x.myChoice || typeof s.players !== 'number') return undefined;
  const pct = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 100 ? Math.round(v) : null);
  return { players: s.players, rightShare: pct(s.rightShare), topRightShare: pct(s.topRightShare) };
}
export function results(r: W.ResultsResponse): Results {
  const days: ResultDay[] = r.days.map((d) => ({
    dayId: d.dayId, date: d.dayId * 86400000, answered: d.answered, completed: d.completed,
    points: d.completionPoints + d.hitPointsCredited + d.hitPointsPending, pendingPoints: d.hitPointsPending, welcomeBonus: d.welcomePoints || undefined,
    inviteBonus: d.inviteBonus ? { points: d.inviteBonus, friends: d.inviteFriends ?? 0 } : undefined,
    rows: d.rows.map((x) => ({
      marketId: String(x.marketId), category: x.category as Market['category'], text: x.text, choice: dir(x.myChoice), outcome: outcome(x),
      landsAt: ms(x.landsAt) || undefined, expectedAt: ms(x.resolvesAt) || undefined, answer: dir((x.correctedOutcome || x.outcome) as 1 | 2 | null) || undefined, setAt: ms(x.resolvedAt) || undefined, evidenceUrl: x.evidenceUrl || undefined,
      split: splitOf(x),
    })),
  }));
  const pendLands = r.days.flatMap((d) => d.rows).filter((x) => x.hitState === 'pending' && x.landsAt).map((x) => x.landsAt!).sort()[0];
  return {
    summary: { week: { points: r.summary.week.points, hits: r.summary.week.hits, answered: r.summary.week.answered }, all: { points: r.summary.allTime.points, hitRate: Math.round((r.summary.allTime.hitRate || 0) * 100) }, pending: { points: r.summary.pendingPoints, landsAt: pendLands ? ms(pendLands) : null } },
    days, nextCursor: r.nextCursor,
  };
}

export function ranking(r: W.RankingResponse): Ranking {
  const row = (x: W.RankingRow): RankRow => ({ rank: x.rank, name: x.name, points: x.points, prize: x.prizeWei ? ct(x.prizeWei) : undefined, me: x.me });
  return {
    weekId: r.weekId, state: r.status === 'open' ? 'live' : r.status === 'airdropped' ? 'sent' : 'final', endsAt: ms(r.endsAt),
    pool: { ct: ct(r.poolWei), players: r.qualifiedPlayers || 0, splitPct: r.splitBps.map((b) => b / 100) },
    top: r.top.map(row),
    me: { rank: r.me?.rank ?? null, points: r.me?.points ?? 0, gap: r.me?.gapToTenth ?? null, prize: r.top.find((x) => x.me)?.prizeWei ? ct(r.top.find((x) => x.me)!.prizeWei) : null, held: !!r.me?.noPrize },
    around: r.around.map(row),
    airdropTx: r.airdropTx || undefined,
    lastWeek: r.lastWeek ? { rank: r.lastWeek.rank, amount: ct(r.lastWeek.prizeWei) } : null,
  };
}

export function wallet(r: W.WalletResponse, extra: { open?: number; inviteWeek?: number; capPerDay?: number } = {}): WalletInfo {
  return {
    address: r.address, ct: ct(r.ctWei), kaia: ct(r.kaiaWei), points: r.points, staked: ct(r.stakedWei), openStakes: extra.open ?? 0,
    pendingHit: r.pendingHitPoints ? { points: r.pendingHitPoints, landsAt: ms(r.pendingHitLandsAt) } : null,
    convert: {
      pointsPerCT: r.conversion.pointsPerCT, min: r.conversion.minConvertPoints, capLeftCt: ct(r.conversion.userCapLeftWei), capPerDayCt: extra.capPerDay ?? 50,
      globalCapLeft: ct(r.conversion.globalCapLeftWei), firstConvertAt: r.conversion.allowedFrom ? ms(r.conversion.allowedFrom) : null, paused: !!r.conversion.paused,
    },
    inviteWeek: extra.inviteWeek ?? 0,
  };
}

export function quote(r: W.StakingQuoteResponse): StakeQuote {
  // capacityLeft: how much more CT fits (Infinity when this amount fits or the reason is not about room)
  const c = r.capacity;
  const left = c.fits ? Infinity
    : c.reason === 'STAKING_TOTAL_CAP' ? ct(c.totalRoomWei)
      : c.reason === 'STAKING_USER_CAP' ? ct(c.userRoomWei)
        : c.reason === 'STAKING_FULL' ? 0 : Infinity;
  return { tier: r.tier, aprPct: r.aprBps / 100, interest: ct(r.interestWei), krw: r.krw?.interest, capacityLeft: left };
}

export function positions(r: W.StakingPositionsResponse): Positions {
  const p = (x: W.StakingPosition): Position => ({ id: String(x.id), amount: ct(x.principalWei), lockDays: x.lockDays, aprPct: x.aprBps / 100, start: ms(x.startsAt), end: ms(x.endsAt), claimed: ct(x.claimedWei), closed: x.closed, paid: x.paidWei ? ct(x.paidWei) : undefined });
  return { positions: r.positions.filter((x) => !x.closed).map(p), closed: r.positions.filter((x) => x.closed).map(p) };
}

export function invite(r: W.InviteResponse): InviteInfo {
  const link = r.link || '';
  return {
    code: r.code || '', link, linkShort: link.replace(/^https?:\/\//, ''), referralBps: r.referralBps, welcomePoints: r.welcomePoints,
    stats: { joined: r.stats.friendsJoined, firstDay: r.stats.friendsFirstDayDone, bonusTotal: r.stats.bonusLifetime, bonusWeek: r.stats.bonusThisWeek },
    friends: r.recent.map((f) => ({ name: f.name, state: f.state === 'first_day_done' ? 'first' : 'joined', points: f.bonusPoints, joinedAt: ms(f.joinedAt) })),
  };
}
