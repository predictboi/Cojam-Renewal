// The adapter maps the API's wire types (platform/shared/src/api.ts) to the screens' view models: the fields added
// for the PWA (config extras, Results badge, inviter name, resolve times, invite friends, last week's prize, pending
// hit landing, conversion pause, paid out on closed stakes) must reach the screens.
import { beforeAll, describe, expect, it } from 'vitest';
import type * as W from '../../shared/src/api.ts';

let A: typeof import('../src/api/adapt');
beforeAll(async () => {
  // config.ts and the mock module read location at import time (browser only)
  (globalThis as unknown as { location: URL }).location = new URL('http://localhost/');
  A = await import('../src/api/adapt');
});
const CT = (n: number) => (BigInt(n) * 10n ** 18n).toString();
const T = { title: 't', left: 'l', right: 'r', rule: 'x', settle: 's' };

describe('config', () => {
  const base: W.ConfigResponse = {
    network: 'kairos', chainId: 1001, contracts: { ct: null, predict: null, staking: null }, feePayer: null, privyAppId: null, minAppVersion: '0.0.0', supportEmail: 'help@cojam.app',
    playKeyTtlDays: 30, maxGasPriceGkei: 50, gasLimits: { predict: 170000, setPlayKey: 120000, revokePlayKey: 80000, settle: 150000, convert: 200000, approve: 100000, stake: 300000, claimInterest: 150000, withdraw: 150000 },
    params: null, staking: null, time: { now: 0, dayId: 0, dayOpensAt: 0, dayEndsAt: 0, weekId: 0 }, features: { invites: true, staking: true, conversion: true, krwDisplay: true },
    rpcUrl: 'http://localhost:8080/dev/rpc', explorerUrl: 'https://kairos.kaiascan.io/', krwPerCt: 210, userTxFeeWei: '4000000000000000',
    maintenance: { on: true, message: { en: 'Upgrading', ko: '점검 중' }, backAt: 1795800000 },
    emailProviders: [{ domain: 'naver.com', name: 'Naver' }, { domain: 'gmail.com', name: 'Gmail' }, { domain: 'proton.me', name: 'Proton' }],
    stakingLimits: { maxOpenPositions: 12, maxUserPrincipalWei: CT(1_000_000), maxTotalPrincipalWei: null, paused: true },
  };
  it('maps the extras', () => {
    const c = A.config(base);
    expect(c.rpcUrl).toBe('http://localhost:8080/dev/rpc');
    expect(c.explorer).toBe('https://kairos.kaiascan.io');
    expect(c.krwPerCt).toBe(210);
    expect(c.userTxFeeKaia).toBe(0.004);
    expect(c.flags).toMatchObject({ maintenance: true, maintenanceUntil: new Date(1795800000 * 1000).toISOString(), stakingPaused: true });
    expect(c.flags.maintenanceMessage).toEqual({ en: 'Upgrading', ko: '점검 중', ja: 'Upgrading' });
    expect(c.emailProviders).toEqual(['naver.com', 'gmail.com', 'proton.me']);
    expect(c.providerNames).toBe('Gmail, Naver, Proton'); // the design's order first
    expect(c.params.maxOpenPositions).toBe(12);
    expect(c.params.maxUserPrincipal).toBe(1_000_000);
    expect(c.gasLimits?.approve).toBe(100000);
  });
});

describe('play and money reads', () => {
  it('me: the Results badge', () => {
    const m = A.me({ id: 1, wallet: '0x1', emailDomain: 'gmail.com', displayName: null, language: 'ko', onboarded: true, registration: 'registered', registeredAt: 1, frozen: false, supportEmail: '', createdAt: 1, newResults: 4, resultsSeenAt: null, stats: { daysPlayed: 0, daysCompleted: 0, predictions: 0, hits: 0, hitRate: null, pointsAllTime: 0 } }, null);
    expect(m.stats.newAnswers).toBe(4);
  });
  it('today: inviter name and resolve time', () => {
    const d = A.today({ dayId: 1, opensAt: 1, endsAt: 2, nextOpensAt: 2, weekId: 0, published: true, answered: 0, completed: false, completion: null, inviterName: 'da****a',
      markets: [{ marketId: 5, slot: 0, category: 'crypto', text: { en: T, ko: T, ja: T }, imageUrl: null, thumbUrl: null, closesAt: 100, resolvesAt: 200, myChoice: null, pendingChoice: null }] });
    expect(d.inviterName).toBe('da****a');
    expect(d.markets[0].resolvesAt).toBe(200_000);
  });
  it('results: expected time per row and the friends behind the invite bonus', () => {
    const r = A.results({ summary: { week: { weekId: 0, points: 0, hits: 0, answered: 0, daysPlayed: 0 }, allTime: { points: 0, hits: 0, settled: 0, hitRate: null }, pendingPoints: 0 }, nextCursor: null,
      days: [{ dayId: 1, weekId: 0, answered: 1, completed: false, completionPoints: 0, hits: 0, hitPointsCredited: 0, hitPointsPending: 0, welcomePoints: 0, inviteBonus: 30, inviteFriends: 3,
        rows: [{ marketId: 5, slot: 0, category: 'crypto', text: { en: T, ko: T, ja: T }, thumbUrl: null, myChoice: 1, outcome: null, correctedOutcome: null, result: 'pending', hitPoints: 0, hitState: 'none', landsAt: null, resolvesAt: 300, resolvedAt: null, evidenceUrl: null }] }] });
    expect(r.days[0].inviteBonus).toEqual({ points: 30, friends: 3 });
    expect(r.days[0].rows[0]).toMatchObject({ outcome: 'wait', expectedAt: 300_000 });
  });
  it('ranking: last week and the airdrop transaction', () => {
    const k = A.ranking({ weekId: 9, startsAt: 0, endsAt: 1, status: 'airdropped', poolWei: CT(100), qualifiedPlayers: 3, splitBps: [10000], top: [], me: null, around: [], tieBreak: 'earlier_last_completion', airdropTx: '0xabc', lastWeek: { weekId: 8, rank: 4, prizeWei: '119600000000000000000', txHash: '0xdef' } });
    expect(k.airdropTx).toBe('0xabc');
    expect(k.lastWeek).toEqual({ rank: 4, amount: 119.6 });
  });
  it('wallet: when pending hits land, and the conversion pause', () => {
    const w = A.wallet({ address: '0x1', ctWei: '0', kaiaWei: '0', points: 0, pendingHitPoints: 50, pendingHitLandsAt: 1795700000, stakedWei: '0', krwPerCt: null,
      conversion: { pointsPerCT: 1000, minConvertPoints: 1000, maxPointsNow: 0, ctPreviewWei: '0', userCapLeftWei: '0', globalCapLeftWei: '0', allowedFrom: null, blockedReason: null, paused: true } });
    expect(w.pendingHit).toEqual({ points: 50, landsAt: 1795700000 * 1000 });
    expect(w.convert.paused).toBe(true);
  });
  it('positions: paid out on closed stakes; quote: room left from the capacity', () => {
    const p = A.positions({ minClaimWei: '0', totals: { principalWei: '0', claimableWei: '0', open: 0 },
      positions: [{ id: 0, principalWei: CT(100), lockIndex: 0, lockDays: 30, aprBps: 800, startsAt: 0, endsAt: 1, maxInterestWei: '0', claimedWei: CT(3), claimableWei: '0', closed: true, paidWei: CT(103), canClaim: false, canWithdraw: false }] });
    expect(p.closed[0].paid).toBe(103);
    const q = A.quote({ amountWei: CT(500), lockIndex: 1, lockDays: 90, tier: 0, aprBps: 1200, interestWei: '0', endsAt: 0, krw: null,
      capacity: { userRoomWei: CT(300), totalRoomWei: null, availableRewardsWei: '0', fits: false, reason: 'STAKING_USER_CAP' } });
    expect(q.capacityLeft).toBe(300);
  });
});
