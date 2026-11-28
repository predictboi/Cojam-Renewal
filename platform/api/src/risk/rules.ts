// Risk scoring rules (DEV-PLAN 5.3 and 5.4, DECISIONS "Abuse blocking"), as pure functions.
//
// The worker gathers one `AccountFacts` per account from Postgres (src/risk/facts.ts) and scores it
// here. Each rule returns a weight and the evidence that made it fire; the score is the sum of the
// weights, capped at 100. At or above the block threshold (80) the account is frozen on chain
// automatically; from the review threshold (50) it goes to the AD7 review list.
//
// Weights are chosen so that one weak signal alone never blocks (a carrier NAT, two accounts on a
// family phone, an inviter with a popular link), two medium signals reach review, and three
// independent strong signals (for example burst plus shared network plus identical answers plus a
// shared device) reach the block threshold. They are tuned on the admin design's examples
// (platform/design/admin/data.js): cluster A scores 62 to 78 without a shared device and 84 to 91
// with one.

export type RuleId =
  | 'cluster_network'
  | 'cluster_device'
  | 'signup_burst'
  | 'lookalike_email'
  | 'same_answers'
  | 'convert_only'
  | 'invite_cluster'
  | 'welcome_farm';

export const ALL_RULES: RuleId[] = [
  'cluster_network',
  'cluster_device',
  'signup_burst',
  'lookalike_email',
  'same_answers',
  'convert_only',
  'invite_cluster',
  'welcome_farm',
];

/** Short reason code written on chain with `setFrozen` (bytes32). */
export const REASON_CODE: Record<RuleId, string> = {
  cluster_network: 'risk:network',
  cluster_device: 'risk:device',
  signup_burst: 'risk:burst',
  lookalike_email: 'risk:lookalike',
  same_answers: 'risk:answers',
  convert_only: 'risk:convert',
  invite_cluster: 'risk:invites',
  welcome_farm: 'risk:welcome',
};

/** Plain English label used in the admin and in alerts. */
export const RULE_LABEL: Record<RuleId, string> = {
  cluster_network: 'Shared network',
  cluster_device: 'Shared device',
  signup_burst: 'Sign up burst',
  lookalike_email: 'Look alike addresses',
  same_answers: 'Identical answers',
  convert_only: 'Convert only',
  invite_cluster: 'Invite cluster',
  welcome_farm: 'Welcome farming',
};

export interface AccountFacts {
  wallet: string;
  createdAt: number; // unix seconds
  /** Accounts that signed up from the same salted IP hash within 1 hour / 24 hours of this one (others, not counting itself). */
  sameNetworkSignups1h: number;
  sameNetworkSignups24h: number;
  /** Distinct other active players seen on this account's networks in the last 14 days (sponsored txs). */
  sameNetworkActivePlayers: number;
  /** Other accounts whose first device id equals this one's, or that sent requests with it. */
  sameDeviceAccounts: number;
  /** The account was created inside a global or per domain sign up burst (above 5x the 7 day hourly average). */
  inGlobalBurst: boolean;
  /** Friends of the same inviter who joined within 10 minutes of this account (others). */
  inviterBurstPeers: number;
  /** Other accounts on the same domain whose local part has the same shape (letters plus a different number). */
  lookalikeAccounts: number;
  /** Days (in the last 14) on which another account gave the same 5 answers within 5 seconds of each pick. */
  identicalAnswerDays: number;
  /** Largest number of other accounts matched on one such day. */
  identicalAnswerPeers: number;
  /** Conversion behaviour. */
  convertedWithinHoursOfEligibility: number | null; // null = never converted
  convertedShare: number; // converted points / earned points, 0..1
  daysPlayed14: number;
  onlyMinimumPlay: boolean; // exactly 5 picks a day, every day, with low timing variance
  /** Invite facts: for an invitee, about its inviter's friends; for an inviter, about its own friends. */
  invitedBy: string | null;
  friends: number; // players this account invited
  friendsSharingNetworkOrDevice: number; // its friends (or fellow friends) that share a network or device with another friend
  friendsWithIdenticalAnswers: number;
  friendsStoppedAfterWelcome: number; // friends who played their first full day, got the welcome bonus and stopped for 3+ days
  friendsEligibleForWelcomeCheck: number; // friends whose first full day is at least 3 days old
  /** This account is an invitee that stopped after its welcome bonus. */
  stoppedAfterWelcome: boolean;
}

export interface RuleHit {
  rule: RuleId;
  weight: number;
  details: Record<string, unknown>;
  text: string; // one line for the admin
}

type Rule = (f: AccountFacts) => RuleHit | null;

const hit = (rule: RuleId, weight: number, text: string, details: Record<string, unknown>): RuleHit => ({
  rule,
  weight,
  text,
  details,
});

export const rules: Record<RuleId, Rule> = {
  cluster_network(f) {
    // A carrier NAT can put a few honest sign ups behind one address, so it takes more than 5 a day
    // (DEV-PLAN 5.2) or a dense hour to count.
    const h = f.sameNetworkSignups1h + 1;
    const d = f.sameNetworkSignups24h + 1;
    let w = 0;
    if (h >= 6 || d > 20) w = 25;
    else if (h >= 4 || d > 10) w = 18;
    else if (d > 5) w = 10;
    if (w === 0 && f.sameNetworkActivePlayers >= 15) w = 10;
    if (w === 0) return null;
    return hit('cluster_network', w, `${Math.max(h, d)} sign ups from one network (${h} in 1 hour, ${d} in 24 hours)`, {
      signups1h: h,
      signups24h: d,
      activePlayers: f.sameNetworkActivePlayers,
    });
  },
  cluster_device(f) {
    const n = f.sameDeviceAccounts;
    if (n <= 0) return null;
    const w = n >= 3 ? 30 : n === 2 ? 22 : 12;
    return hit('cluster_device', w, `Same device as ${n} other account${n === 1 ? '' : 's'}`, { otherAccounts: n });
  },
  signup_burst(f) {
    const peers = f.inviterBurstPeers;
    if (!f.inGlobalBurst && peers < 4) return null;
    const w = peers >= 8 ? 22 : peers >= 4 ? 16 : 10;
    const text = peers >= 4 ? `${peers + 1} friends of one inviter joined within 10 minutes` : 'Joined inside a sign up burst';
    return hit('signup_burst', w, text, { inviterBurstPeers: peers, globalBurst: f.inGlobalBurst });
  },
  lookalike_email(f) {
    const n = f.lookalikeAccounts;
    if (n < 2) return null;
    const w = n >= 5 ? 28 : n >= 3 ? 22 : 14;
    return hit('lookalike_email', w, `${n + 1} emails that differ by a number only`, { otherAccounts: n });
  },
  same_answers(f) {
    const days = f.identicalAnswerDays;
    if (days <= 0) return null;
    const w = days >= 5 ? 40 : days >= 3 ? 30 : days >= 2 ? 22 : 14;
    return hit('same_answers', w, `Same 5 answers within 5 s of ${f.identicalAnswerPeers} other account${f.identicalAnswerPeers === 1 ? '' : 's'} on ${days} day${days === 1 ? '' : 's'}`, {
      days,
      peers: f.identicalAnswerPeers,
    });
  },
  convert_only(f) {
    if (f.convertedWithinHoursOfEligibility === null) return null;
    const fast = f.convertedWithinHoursOfEligibility <= 24;
    const most = f.convertedShare >= 0.9;
    if (!(fast && most)) return null;
    const w = f.onlyMinimumPlay ? 30 : 18;
    return hit('convert_only', w, `Converted ${Math.round(f.convertedShare * 100)}% of points within ${Math.round(f.convertedWithinHoursOfEligibility)} h of the wait ending${f.onlyMinimumPlay ? ', minimum play only' : ''}`, {
      hoursAfterEligible: f.convertedWithinHoursOfEligibility,
      share: f.convertedShare,
      minimumPlay: f.onlyMinimumPlay,
    });
  },
  invite_cluster(f) {
    const sharing = f.friendsSharingNetworkOrDevice;
    const same = f.friendsWithIdenticalAnswers;
    const n = sharing + same;
    if (n < 3) return null;
    const w = n >= 8 ? 25 : n >= 5 ? 18 : 12;
    return hit('invite_cluster', w, `${sharing} friends share a network or device, ${same} answer alike`, {
      sharing,
      identicalAnswers: same,
      inviter: f.invitedBy,
    });
  },
  welcome_farm(f) {
    if (f.stoppedAfterWelcome && f.invitedBy) {
      return hit('welcome_farm', 12, 'Stopped playing after the welcome bonus', { inviter: f.invitedBy });
    }
    const n = f.friendsStoppedAfterWelcome;
    const base = f.friendsEligibleForWelcomeCheck;
    if (base >= 5 && n / base >= 0.5) {
      const w = n >= 10 ? 25 : 18;
      return hit('welcome_farm', w, `${n} of ${base} friends stopped after the welcome bonus`, { stopped: n, eligible: base });
    }
    return null;
  },
};

export interface Thresholds {
  blockAt: number; // 80
  reviewAt: number; // 50
}

export const DEFAULT_THRESHOLDS: Thresholds = { blockAt: 80, reviewAt: 50 };

export interface ScoreResult {
  wallet: string;
  score: number;
  hits: RuleHit[];
  /** Hits that counted (rules cleared by an admin in the last 30 days do not). */
  counted: RuleHit[];
  action: 'block' | 'review' | 'none';
  reasonCode: string; // for setFrozen
}

/**
 * Scores an account. `clearedRules` are the rules an admin cleared or unblocked within the 30 day
 * mark (`users.risk_clear_until`): they cannot freeze the account again in that time, a new rule
 * still can (DEV-PLAN 5.3).
 */
export function scoreAccount(f: AccountFacts, clearedRules: ReadonlySet<RuleId> = new Set(), t: Thresholds = DEFAULT_THRESHOLDS): ScoreResult {
  if (!(t.reviewAt < t.blockAt)) throw new Error('review threshold must be below the block threshold');
  const hits: RuleHit[] = [];
  for (const id of ALL_RULES) {
    const h = rules[id](f);
    if (h) hits.push(h);
  }
  const counted = hits.filter((h) => !clearedRules.has(h.rule));
  const score = Math.min(100, counted.reduce((s, h) => s + h.weight, 0));
  const action = score >= t.blockAt ? 'block' : score >= t.reviewAt ? 'review' : 'none';
  const top = [...counted].sort((a, b) => b.weight - a.weight)[0];
  return { wallet: f.wallet, score, hits, counted, action, reasonCode: top ? REASON_CODE[top.rule] : 'risk' };
}

/** Empty facts for an account: every counter at zero. Handy for tests and for accounts with no data yet. */
export function emptyFacts(wallet: string, createdAt = 0): AccountFacts {
  return {
    wallet,
    createdAt,
    sameNetworkSignups1h: 0,
    sameNetworkSignups24h: 0,
    sameNetworkActivePlayers: 0,
    sameDeviceAccounts: 0,
    inGlobalBurst: false,
    inviterBurstPeers: 0,
    lookalikeAccounts: 0,
    identicalAnswerDays: 0,
    identicalAnswerPeers: 0,
    convertedWithinHoursOfEligibility: null,
    convertedShare: 0,
    daysPlayed14: 0,
    onlyMinimumPlay: false,
    invitedBy: null,
    friends: 0,
    friendsSharingNetworkOrDevice: 0,
    friendsWithIdenticalAnswers: 0,
    friendsStoppedAfterWelcome: 0,
    friendsEligibleForWelcomeCheck: 0,
    stoppedAfterWelcome: false,
  };
}

/**
 * The local part shape used by `lookalike_email`: letters with digits removed. The worker never sees
 * plain addresses (users store a keyed hash); the API stores this keyed shape hash at sign up, so the
 * rule compares hashes of shapes. This helper is the shared definition for both sides.
 */
export function localPartShape(normalizedLocal: string): string {
  return normalizedLocal.toLowerCase().replace(/[0-9]+/g, '#').replace(/[._-]/g, '');
}

/** Bytes32 hex of a short ASCII reason code (right padded), as `setFrozen` takes it. */
export function reasonToBytes32(code: string): `0x${string}` {
  const bytes = Buffer.from(code.slice(0, 32), 'utf8');
  const out = Buffer.alloc(32);
  bytes.copy(out);
  return `0x${out.toString('hex')}`;
}

/**
 * Identical answer detection over predictions. Input: per wallet per day the 5 picks with their
 * block timestamps. Two accounts match on a day when all 5 choices are equal and each pair of picks
 * landed within `windowSec` seconds. Returns per wallet the number of matched days and the largest
 * peer group on one day.
 */
export interface DayPicks {
  wallet: string;
  dayId: number;
  picks: { slot: number; choice: number; at: number }[];
}

export function identicalAnswers(rows: DayPicks[], windowSec = 5): Map<string, { days: number; peers: number }> {
  const out = new Map<string, { days: number; peers: number }>();
  const byDay = new Map<number, DayPicks[]>();
  for (const r of rows) {
    if (r.picks.length !== 5) continue;
    const list = byDay.get(r.dayId) ?? [];
    list.push(r);
    byDay.set(r.dayId, list);
  }
  for (const [, list] of byDay) {
    // Bucket by the answer pattern first: only accounts with the same 5 choices can match.
    const byPattern = new Map<string, DayPicks[]>();
    for (const r of list) {
      const sorted = [...r.picks].sort((a, b) => a.slot - b.slot);
      const key = sorted.map((p) => p.choice).join('');
      const l = byPattern.get(key) ?? [];
      l.push({ ...r, picks: sorted });
      byPattern.set(key, l);
    }
    for (const [, group] of byPattern) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        let peers = 0;
        for (let j = 0; j < group.length; j++) {
          if (i === j) continue;
          const close = group[i].picks.every((p, k) => Math.abs(p.at - group[j].picks[k].at) <= windowSec);
          if (close) peers++;
        }
        if (peers > 0) {
          const k = group[i].wallet.toLowerCase();
          const cur = out.get(k) ?? { days: 0, peers: 0 };
          cur.days += 1;
          cur.peers = Math.max(cur.peers, peers);
          out.set(k, cur);
        }
      }
    }
  }
  return out;
}
