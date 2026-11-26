import { describe, expect, it } from 'vitest';
import { emailShapeHash } from '../../src/server/hash.ts';
import { emptyFacts, identicalAnswers, localPartShape, reasonToBytes32, scoreAccount, type AccountFacts } from '../../src/risk/rules.ts';

const W = '0x00000000000000000000000000000000000000aa';
const f = (o: Partial<AccountFacts>): AccountFacts => ({ ...emptyFacts(W), ...o });

describe('risk scoring', () => {
  it('an ordinary account scores 0', () => {
    const r = scoreAccount(f({}));
    expect(r.score).toBe(0);
    expect(r.action).toBe('none');
  });

  it('one weak signal never blocks (carrier NAT, a shared family phone)', () => {
    expect(scoreAccount(f({ sameNetworkSignups24h: 7 })).action).toBe('none');
    expect(scoreAccount(f({ sameDeviceAccounts: 1 })).action).toBe('none');
    expect(scoreAccount(f({ sameNetworkSignups1h: 10, sameNetworkSignups24h: 30 })).action).toBe('none');
  });

  it('cluster A of the admin design without a shared device goes to review', () => {
    const r = scoreAccount(f({ inviterBurstPeers: 10, sameNetworkSignups1h: 5, identicalAnswerDays: 1, identicalAnswerPeers: 3, invitedBy: '0xinv' }));
    expect(r.action).toBe('review');
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.score).toBeLessThan(80);
  });

  it('cluster A with a shared device is blocked', () => {
    const r = scoreAccount(f({ inviterBurstPeers: 10, sameNetworkSignups1h: 5, identicalAnswerDays: 1, identicalAnswerPeers: 3, sameDeviceAccounts: 2 }));
    expect(r.action).toBe('block');
    expect(r.counted.map((h) => h.rule).sort()).toEqual(['cluster_device', 'cluster_network', 'same_answers', 'signup_burst']);
  });

  it('identical answers over many days plus a shared device blocks', () => {
    expect(scoreAccount(f({ identicalAnswerDays: 5, identicalAnswerPeers: 7, sameDeviceAccounts: 3, sameNetworkSignups24h: 12 })).action).toBe('block');
  });

  it('look alike addresses plus convert only reaches review (cluster B)', () => {
    const r = scoreAccount(f({ lookalikeAccounts: 3, convertedWithinHoursOfEligibility: 1, convertedShare: 0.96, onlyMinimumPlay: true }));
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('risk:convert');
  });

  it('caps the score at 100', () => {
    const r = scoreAccount(f({ sameNetworkSignups1h: 9, sameDeviceAccounts: 4, inviterBurstPeers: 12, lookalikeAccounts: 9, identicalAnswerDays: 9, identicalAnswerPeers: 9, convertedWithinHoursOfEligibility: 0, convertedShare: 1, onlyMinimumPlay: true }));
    expect(r.score).toBe(100);
  });

  it('a rule cleared by an admin in the last 30 days cannot freeze again, a new rule still can', () => {
    const facts = f({ sameDeviceAccounts: 3, identicalAnswerDays: 5, identicalAnswerPeers: 4, sameNetworkSignups1h: 6 });
    expect(scoreAccount(facts).action).toBe('block');
    const cleared = new Set(['cluster_device', 'same_answers'] as const);
    expect(scoreAccount(facts, cleared).action).toBe('none');
    const withNew = { ...facts, lookalikeAccounts: 5, inviterBurstPeers: 9, convertedWithinHoursOfEligibility: 2, convertedShare: 1, onlyMinimumPlay: true };
    expect(scoreAccount(withNew, cleared).action).toBe('block');
  });

  it('thresholds are configurable and must be ordered', () => {
    expect(scoreAccount(f({ sameDeviceAccounts: 3 }), new Set(), { blockAt: 30, reviewAt: 20 }).action).toBe('block');
    expect(() => scoreAccount(f({}), new Set(), { blockAt: 50, reviewAt: 50 })).toThrow();
  });

  it('inviter side: friends stopping after the welcome bonus', () => {
    const r = scoreAccount(f({ friendsEligibleForWelcomeCheck: 10, friendsStoppedAfterWelcome: 8, friendsSharingNetworkOrDevice: 6, friendsWithIdenticalAnswers: 3 }));
    expect(r.counted.map((h) => h.rule).sort()).toEqual(['invite_cluster', 'welcome_farm']);
  });
});

describe('identical answers', () => {
  const picks = (choices: number[], at: number[]) => choices.map((c, i) => ({ slot: i, choice: c, at: at[i] }));
  it('matches accounts with the same 5 answers within 5 seconds', () => {
    const rows = [
      { wallet: '0xa', dayId: 1, picks: picks([1, 2, 1, 1, 2], [100, 110, 120, 130, 140]) },
      { wallet: '0xb', dayId: 1, picks: picks([1, 2, 1, 1, 2], [102, 113, 121, 134, 141]) },
      { wallet: '0xc', dayId: 1, picks: picks([1, 2, 1, 1, 2], [500, 510, 520, 530, 540]) }, // same answers, other time
      { wallet: '0xd', dayId: 1, picks: picks([2, 2, 1, 1, 2], [100, 110, 120, 130, 140]) }, // other answers
      { wallet: '0xa', dayId: 2, picks: picks([2, 2, 2, 2, 2], [10, 11, 12, 13, 14]) },
      { wallet: '0xb', dayId: 2, picks: picks([2, 2, 2, 2, 2], [12, 12, 12, 13, 18]) },
      { wallet: '0xe', dayId: 2, picks: picks([2, 2, 2], [12, 12, 12]) }, // incomplete day ignored
    ];
    const m = identicalAnswers(rows);
    expect(m.get('0xa')).toEqual({ days: 2, peers: 1 });
    expect(m.get('0xb')).toEqual({ days: 2, peers: 1 });
    expect(m.has('0xc')).toBe(false);
    expect(m.has('0xd')).toBe(false);
  });
});

describe('helpers', () => {
  it('local part shape folds digits and separators', () => {
    expect(localPartShape('hana123')).toBe(localPartShape('hana7'));
    expect(localPartShape('je.ju21')).toBe('jeju#');
  });
  it('the API writes the shape hash the look alike rule compares', () => {
    expect(emailShapeHash('k', 'hana12@gmail.com')).toBe(emailShapeHash('k', 'hana7@gmail.com'));
    expect(emailShapeHash('k', 'hana12@gmail.com')).not.toBe(emailShapeHash('k', 'hana12@naver.com'));
    expect(emailShapeHash('k', 'hana12@gmail.com')).not.toBe(emailShapeHash('k2', 'hana12@gmail.com'));
  });
  it('reason codes fit bytes32', () => {
    const b = reasonToBytes32('risk:device');
    expect(b).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Buffer.from(b.slice(2), 'hex').toString('utf8').replace(/\0+$/, '')).toBe('risk:device');
  });
});
