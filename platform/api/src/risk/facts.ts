// Gathers `AccountFacts` (src/risk/rules.ts) from Postgres in a few bulk queries. Sized for the
// launch scale (thousands of daily players): the hourly run loads 14 days of users, referrals,
// complete prediction days and conversions into memory and computes every signal in one pass.

import { sql } from 'kysely';
import type { WDb } from '../worker/db.ts';
import { emptyFacts, identicalAnswers, type AccountFacts, type DayPicks } from './rules.ts';

const H = 3600;
const DAY = 86400;

interface UserRow {
  wallet: string;
  created: number;
  registeredAt: number | null;
  ip: string | null;
  device: string | null;
  shape: string | null;
  emailHash: string | null;
}

const sec = (d: Date | null | undefined) => (d ? Math.floor(new Date(d).getTime() / 1000) : null);

/** Wallets the hourly run scores: registered players active in the last 14 days or created in them. */
export async function activeWallets(db: WDb, now: number): Promise<string[]> {
  const since = new Date((now - 14 * DAY) * 1000);
  const rows = await db
    .selectFrom('users')
    .select('wallet')
    .where('wallet', 'is not', null)
    .where('registration', '=', 'registered')
    .where((eb) => eb.or([eb('created_at', '>=', since), eb.exists(eb.selectFrom('predictions').select('wallet').whereRef('predictions.wallet', '=', 'users.wallet').where('block_time', '>=', since))]))
    .execute();
  return rows.map((r) => r.wallet!.toLowerCase());
}

/** The new account plus its cluster: same network, same device, same inviter (DEV-PLAN 5.3). */
export async function clusterOf(db: WDb, wallets: string[]): Promise<string[]> {
  if (wallets.length === 0) return [];
  const me = await db.selectFrom('users').select(['wallet', 'ip_hash_first', 'device_id_first']).where('wallet', 'in', wallets).execute();
  const ips = me.map((r) => r.ip_hash_first).filter(Boolean) as string[];
  const devices = me.map((r) => r.device_id_first).filter(Boolean) as string[];
  const inviters = (await db.selectFrom('referrals').select('inviter').where('invitee', 'in', wallets).execute()).map((r) => r.inviter);
  const out = new Set(wallets.map((w) => w.toLowerCase()));
  if (ips.length || devices.length) {
    const rows = await db
      .selectFrom('users')
      .select('wallet')
      .where('wallet', 'is not', null)
      .where((eb) => eb.or([...(ips.length ? [eb('ip_hash_first', 'in', ips)] : []), ...(devices.length ? [eb('device_id_first', 'in', devices)] : [])]))
      .execute();
    rows.forEach((r) => out.add(r.wallet!.toLowerCase()));
  }
  if (inviters.length) {
    const friends = await db.selectFrom('referrals').select('invitee').where('inviter', 'in', inviters).execute();
    friends.forEach((r) => out.add(r.invitee.toLowerCase()));
    inviters.forEach((i) => out.add(i.toLowerCase()));
  }
  return [...out];
}

export async function gatherFacts(db: WDb, wallets: string[], now: number): Promise<AccountFacts[]> {
  if (wallets.length === 0) return [];
  const since14 = new Date((now - 14 * DAY) * 1000);
  const since35 = new Date((now - 35 * DAY) * 1000);

  // Users of the last 35 days (network, device and burst comparisons) plus the scored wallets.
  const userRows = await db
    .selectFrom('users')
    .select(['wallet', 'created_at', 'registered_at', 'ip_hash_first', 'device_id_first', 'email_shape_hash', 'email_hash'])
    .where('wallet', 'is not', null)
    .where((eb) => eb.or([eb('created_at', '>=', since35), eb('wallet', 'in', wallets)]))
    .execute();
  const users = new Map<string, UserRow>();
  for (const u of userRows) {
    users.set(u.wallet!.toLowerCase(), { wallet: u.wallet!.toLowerCase(), created: sec(u.created_at)!, registeredAt: sec(u.registered_at), ip: u.ip_hash_first, device: u.device_id_first, shape: u.email_shape_hash, emailHash: u.email_hash });
  }
  const byIp = new Map<string, UserRow[]>();
  const byDevice = new Map<string, Set<string>>();
  const byShape = new Map<string, Set<string>>();
  for (const u of users.values()) {
    if (u.ip) byIp.set(u.ip, [...(byIp.get(u.ip) ?? []), u]);
    if (u.device) byDevice.set(u.device, new Set([...(byDevice.get(u.device) ?? []), u.wallet]));
    if (u.shape) byShape.set(u.shape, new Set([...(byShape.get(u.shape) ?? []), u.wallet]));
  }
  // Devices seen in sign up checks for an account's email (an account that later used another device id).
  const checks = await db.selectFrom('auth_checks').select(['email_hash', 'device_id']).where('created_at', '>=', since35).where('email_hash', 'is not', null).where('device_id', 'is not', null).execute();
  const walletByEmail = new Map<string, string>();
  for (const u of users.values()) if (u.emailHash) walletByEmail.set(u.emailHash, u.wallet);
  for (const c of checks) {
    const w = walletByEmail.get(c.email_hash!);
    if (w) byDevice.set(c.device_id!, new Set([...(byDevice.get(c.device_id!) ?? []), w]));
  }

  // Active players behind each network (sponsored transactions of the last 14 days).
  const spons = await db.selectFrom('sponsored_txs').select(['wallet', 'ip_hash']).where('created_at', '>=', since14).where('ip_hash', 'is not', null).where('wallet', 'is not', null).execute();
  const playersByIp = new Map<string, Set<string>>();
  const ipsByWallet = new Map<string, Set<string>>();
  for (const s of spons) {
    const w = s.wallet!.toLowerCase();
    playersByIp.set(s.ip_hash!, new Set([...(playersByIp.get(s.ip_hash!) ?? []), w]));
    ipsByWallet.set(w, new Set([...(ipsByWallet.get(w) ?? []), s.ip_hash!]));
  }

  // Global burst: sign ups per hour against the 7 day hourly average.
  const hourly = new Map<number, number>();
  for (const u of users.values()) hourly.set(Math.floor(u.created / H), (hourly.get(Math.floor(u.created / H)) ?? 0) + 1);
  const burstHour = (t: number) => {
    const h = Math.floor(t / H);
    let sum = 0;
    for (let k = h - 168; k < h; k++) sum += hourly.get(k) ?? 0;
    const avg = sum / 168;
    const n = hourly.get(h) ?? 0;
    return n >= 20 && n > 5 * Math.max(avg, 1);
  };

  // Referrals.
  const refs = await db.selectFrom('referrals').select(['invitee', 'inviter', 'requested_at', 'first_day_at', 'welcome_tx']).execute();
  const inviterOf = new Map<string, string>();
  const friendsOf = new Map<string, { invitee: string; at: number; firstDay: number | null; welcome: boolean }[]>();
  for (const r of refs) {
    const inv = r.inviter.toLowerCase();
    const me = r.invitee.toLowerCase();
    inviterOf.set(me, inv);
    friendsOf.set(inv, [...(friendsOf.get(inv) ?? []), { invitee: me, at: sec(r.requested_at)!, firstDay: sec(r.first_day_at), welcome: Boolean(r.welcome_tx) }]);
  }

  // Complete prediction days of the last 14 days (identical answers, timing).
  const preds = await db
    .selectFrom('predictions')
    .select(['wallet', 'day_id', 'market_id', 'choice', 'block_time'])
    .where('block_time', '>=', since14)
    .execute();
  const dayMap = new Map<string, DayPicks>();
  const lastPick = new Map<string, number>();
  for (const p of preds) {
    const w = p.wallet.toLowerCase();
    const k = `${w}:${p.day_id}`;
    const d = dayMap.get(k) ?? { wallet: w, dayId: p.day_id, picks: [] };
    const at = sec(p.block_time) ?? 0;
    d.picks.push({ slot: p.market_id % 5, choice: p.choice, at });
    dayMap.set(k, d);
    lastPick.set(w, Math.max(lastPick.get(w) ?? 0, at));
  }
  const ident = identicalAnswers([...dayMap.values()]);
  const daysByWallet = new Map<string, DayPicks[]>();
  for (const d of dayMap.values()) daysByWallet.set(d.wallet, [...(daysByWallet.get(d.wallet) ?? []), d]);

  // Conversions and earnings.
  const conv = await db.selectFrom('conversions').select(['wallet', 'points', 'block_time']).where('wallet', 'in', wallets).execute();
  const earned = await db
    .selectFrom('points_ledger')
    .select(['wallet', sql<number>`sum(amount)::bigint`.as('earned')])
    .where('wallet', 'in', wallets)
    .where('amount', '>', 0)
    .groupBy('wallet')
    .execute();
  const earnedBy = new Map(earned.map((e) => [e.wallet.toLowerCase(), Number(e.earned)]));

  const out: AccountFacts[] = [];
  for (const w0 of wallets) {
    const w = w0.toLowerCase();
    const u = users.get(w);
    const f = emptyFacts(w, u?.created ?? now);
    if (u?.ip) {
      const peers = (byIp.get(u.ip) ?? []).filter((x) => x.wallet !== w);
      f.sameNetworkSignups1h = peers.filter((x) => Math.abs(x.created - u.created) <= H).length;
      f.sameNetworkSignups24h = peers.filter((x) => Math.abs(x.created - u.created) <= DAY).length;
    }
    const others = new Set<string>();
    for (const ip of ipsByWallet.get(w) ?? []) for (const x of playersByIp.get(ip) ?? []) if (x !== w) others.add(x);
    f.sameNetworkActivePlayers = others.size;
    const dev = new Set<string>();
    for (const [, set] of byDevice) if (set.has(w)) set.forEach((x) => x !== w && dev.add(x));
    f.sameDeviceAccounts = dev.size;
    f.inGlobalBurst = u ? burstHour(u.created) : false;
    if (u?.shape) f.lookalikeAccounts = (byShape.get(u.shape)?.size ?? 1) - 1;
    const id = ident.get(w);
    if (id) {
      f.identicalAnswerDays = id.days;
      f.identicalAnswerPeers = id.peers;
    }
    // Conversion behaviour.
    const mine = conv.filter((c) => c.wallet.toLowerCase() === w);
    if (mine.length && u?.registeredAt) {
      const first = Math.min(...mine.map((c) => sec(c.block_time) ?? now));
      f.convertedWithinHoursOfEligibility = Math.max(0, (first - (u.registeredAt + 7 * DAY)) / H);
      const e = earnedBy.get(w) ?? 0;
      f.convertedShare = e > 0 ? mine.reduce((s, c) => s + Number(c.points), 0) / e : 0;
    }
    const days = (daysByWallet.get(w) ?? []).filter((d) => d.picks.length === 5);
    f.daysPlayed14 = days.length;
    if (days.length >= 5) {
      const firsts = days.map((d) => Math.min(...d.picks.map((p) => p.at)) % DAY);
      const mean = firsts.reduce((s, x) => s + x, 0) / firsts.length;
      const sd = Math.sqrt(firsts.reduce((s, x) => s + (x - mean) ** 2, 0) / firsts.length);
      f.onlyMinimumPlay = sd < 600;
    }
    // Invites.
    const inviter = inviterOf.get(w) ?? null;
    f.invitedBy = inviter;
    const friendStats = (inv: string) => {
      const friends = friendsOf.get(inv) ?? [];
      let sharing = 0;
      let same = 0;
      const sharingSet = new Set<string>();
      for (const fr of friends) {
        const fu = users.get(fr.invitee);
        const shares = friends.some((o) => {
          if (o.invitee === fr.invitee) return false;
          const ou = users.get(o.invitee);
          return Boolean(fu && ou && ((fu.ip && fu.ip === ou.ip) || (fu.device && fu.device === ou.device)));
        });
        if (shares) {
          sharing++;
          sharingSet.add(fr.invitee);
        }
        if (ident.has(fr.invitee)) {
          same++;
          sharingSet.add(fr.invitee);
        }
      }
      const eligible = friends.filter((fr) => fr.welcome && fr.firstDay !== null && fr.firstDay <= now - 3 * DAY);
      const stopped = eligible.filter((fr) => (lastPick.get(fr.invitee) ?? 0) < fr.firstDay! + DAY);
      return { friends: friends.length, sharing, same, sharingSet, eligible: eligible.length, stopped: stopped.length };
    };
    const own = friendStats(w);
    f.friends = own.friends;
    f.friendsSharingNetworkOrDevice = own.sharing;
    f.friendsWithIdenticalAnswers = own.same;
    f.friendsEligibleForWelcomeCheck = own.eligible;
    f.friendsStoppedAfterWelcome = own.stopped;
    if (inviter) {
      const theirs = friendStats(inviter);
      if (theirs.sharingSet.has(w)) {
        // An invitee in a flagged cluster carries its inviter's cluster counts.
        f.friendsSharingNetworkOrDevice = Math.max(f.friendsSharingNetworkOrDevice, theirs.sharing);
        f.friendsWithIdenticalAnswers = Math.max(f.friendsWithIdenticalAnswers, theirs.same);
      }
      const meRef = (friendsOf.get(inviter) ?? []).find((x) => x.invitee === w);
      if (meRef && meRef.welcome && meRef.firstDay !== null && meRef.firstDay <= now - 3 * DAY) f.stoppedAfterWelcome = (lastPick.get(w) ?? 0) < meRef.firstDay + DAY;
      // Friends of the same inviter who joined within 10 minutes of this account.
      if (meRef) f.inviterBurstPeers = (friendsOf.get(inviter) ?? []).filter((x) => x.invitee !== w && Math.abs(x.at - meRef.at) <= 600).length;
    }
    out.push(f);
  }
  return out;
}
