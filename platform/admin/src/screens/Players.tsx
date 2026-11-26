// AD7 Players, ported from platform/design/admin/pages/players.js. States (mock): detail | block | blockerror | clear |
// blocked | unblock | unblockfail | invites | search | noresult | empty | loading | error. Live: ?state=blocked,
// ?state=invites and ?state=search&q= pick the list. Data: /admin/v1/players (review, blocked, search),
// /admin/v1/players/:wallet (drawer), /admin/v1/invites, /admin/v1/dashboard/detail. Writes: block, unblock, clear
// (each with the note, written to the audit log; the worker sends setFrozen with the operator key).
import { useEffect, useMemo } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, tag, ic, esc, addr, btn, kv, note, table, link, empty, fig, pct, short, href, T } from '../lib/x';
import { confirm, sheet, toast } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate, mockD } from '../api/hooks';
import { usePageCtx, useActs, nowS } from '../page';
import { Shell } from '../Shell';

const RULES: Record<string, string> = {
  invite_cluster: 'Sign up burst', signup_burst: 'Sign up burst', cluster_device: 'Shared device', shared_device: 'Shared device', cluster_ip: 'Shared network', shared_ip: 'Shared network', shared_network: 'Shared network',
  identical_answers: 'Identical answers', lookalike: 'Look alike addresses', lookalike_email: 'Look alike addresses', convert_only: 'Convert only', welcome_farm: 'Welcome farming',
};
const ruleName = (r: string) => RULES[r] || r.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
function ruleText(d: any): string {
  if (!d || typeof d !== 'object') return '';
  const parts = Object.entries(d).filter(([k]) => k !== 'seed').slice(0, 4).map(([k, v]) => k.replace(/_/g, ' ') + ': ' + (typeof v === 'object' ? JSON.stringify(v) : String(v)));
  return parts.join(', ');
}

function render(D: any, qs: URLSearchParams): string {
  begin();
  const M = CONFIG.mock;
  const tab = is('blocked', 'unblock', 'unblockfail') ? 'blocked' : is('invites') ? 'invites' : is('search', 'noresult') ? 'search' : 'review';
  const focus = D.review[M ? 3 : 0];
  const score = (s: number) => '<span class="score"' + (s >= D.blockAt ? ' data-k="down"' : '') + ' title="Review from ' + D.reviewAt + ', blocked at ' + D.blockAt + '">' + s + '<i style="--p:' + s + '%"></i></span>';
  const who = (p: any) => (p.name ? '<span class="t1">' + esc(p.name) + '</span>' : '') + addr(p.addr) + (p.email ? '<span class="t2">' + esc(p.email) + (p.cluster ? ' ' + tag('Cluster ' + p.cluster, 'warn') : '') + '</span>' : '');
  const rules = (p: any) => '<ul class="rules">' + p.rules.map((r: any) => '<li><b>' + esc(r.k) + '</b><span class="dim">' + esc(r.t) + '</span></li>').join('') + '</ul>';
  const qv = qs.get('q') || '';

  function tabs() {
    const a = (id: string, label: string, cnt: number | null, st?: string) => '<a href="?' + (st ? 'state=' + st : '') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + label + (cnt != null ? ' <span class="nb">' + cnt + '</span>' : '') + '</a>';
    return '<nav class="tabs" aria-label="Player lists">' + a('review', 'Review list', is('empty') ? 0 : D.abuse.review) + a('blocked', 'Blocked', D.abuse.blocked, 'blocked') + a('invites', 'Invites', null, 'invites') +
      '<form class="end" role="search" action="" method="get" data-psearch><input type="hidden" name="state" value="search"><label class="search"><span class="sr">Search players</span>' + ic('search') + '<input class="inp" type="search" name="q" placeholder="Address, masked email match or invite code" value="' + esc(M ? (is('search') ? 'LUCKY88D' : is('noresult') ? '0x9999' : '') : qv) + '"></label></form></nav>';
  }

  function review() {
    const rows = is('empty') ? [] : D.review;
    const clusterNote = M ? note('warn', '<b>13 of these 14 accounts belong to 2 flagged clusters.</b> Cluster A: luckyday88 and 11 friends who joined within 9 minutes today, 3 already blocked. Cluster B: 4 look alike addresses that only convert.', link('Flagged clusters', '?state=invites')) + '<div style="height:12px"></div>' : '';
    return '<section><div class="sec-head"><h2>Waiting for review</h2><span class="sec-note">Risk score ' + D.reviewAt + ' to ' + (D.blockAt - 1) + '. At ' + D.blockAt + ' the risk check blocks by itself. Clear marks an account as looked at: the same rule does not flag it again for 30 days.</span></div>' +
      (rows.length ? clusterNote : '') +
      table<any>({ caption: 'Accounts waiting for review', rows, loading: is('loading'), error: is('error'), what: 'The review list', cls: 'vtop', sort: [2, 'desc'],
        selected: (p) => is('detail', 'block', 'blockerror', 'clear') && p === focus,
        empty: empty('Nothing to review', 'No account has a risk score between ' + D.reviewAt + ' and ' + (D.blockAt - 1) + '. The risk check runs every hour and at every sign up' + (M ? '; the next run is at 15:00 KST.' : '.'), link('See blocked accounts', '?state=blocked')),
        cols: [
          { h: 'Account', val: (p) => p.addr, cell: (p) => who(p) },
          { h: 'Joined', cell: (p) => '<span class="nowrap">' + p.joined + '</span>' },
          { h: 'Score', val: (p) => p.score, cell: (p) => score(p.score) },
          { h: 'Rules that fired', w: '44%', cell: (p) => rules(p) },
          { h: 'Inviter', cell: (p) => (p.inviter ? esc(p.inviter) : '<span class="dim">None</span>') },
          { h: 'Play', num: 1, val: (p) => p.points, cell: (p) => p.days + (p.days === 1 ? ' day' : ' days') + '<span class="t2 nowrap">' + n(p.points) + ' P' + (p.friends ? ', ' + p.friends + ' friends' : '') + '</span>' },
          { h: '', cell: (p, i) => '<div class="row-acts">' + btn('Open', { link: 1, act: 'detail', arg: M ? i : p.addr }) + btn('Clear', { small: 1, act: 'clear', arg: M ? i : p.addr, write: 1 }) + btn('Block', { small: 1, act: 'block', arg: M ? i : p.addr, write: 1 }) + '</div>' },
        ],
        after: rows.length ? '<div class="tbl-foot"><span>' + rows.length + ' of ' + (M ? 14 : D.abuse.review) + ' accounts</span><span>Block and Clear are sent with the operator key. Every action needs a note and is written to the audit log.</span></div>' : '' }) + '</section>';
  }

  function blocked() {
    const fail = is('unblockfail') && D.blocked[4];
    return '<section><div class="sec-head"><h2>Blocked accounts</h2><span class="sec-note">Frozen on chain: no predicting, no conversion, no airdrop, no sponsored gas. Points are never debited. Staking interest and principal can still be withdrawn at the player\'s own fee.</span></div>' +
      (fail ? note('down', '<b>Unblock failed: the operator wallet could not pay the network fee.</b> Nothing changed. ' + short(D.blocked[4].addr) + ' is still blocked.', btn('Try again', { link: 1, act: 'unblock', arg: 4 })) + '<div style="height:12px"></div>' : '') +
      table<any>({ caption: 'Blocked accounts', rows: D.blocked, cls: 'vtop', sort: [1, 'desc'], loading: is('loading'), error: is('error'), what: 'The blocked list',
        empty: empty('Nobody is blocked', 'Accounts the risk check or an operator blocks show here.'),
        cols: [
          { h: 'Account', val: (p) => p.addr, cell: (p) => addr(p.addr, { full: 1 }) },
          { h: 'Blocked', val: (p) => p.sortAt ?? D.blocked.length - D.blocked.indexOf(p), cell: (p) => '<span class="nowrap">' + p.at + '</span><span class="t2">by ' + esc(p.by) + '</span>' },
          { h: 'Reason', cell: (p) => esc(p.why) },
          { h: 'Score', val: (p) => p.score, cell: (p) => score(p.score) },
          { h: 'Points', num: 1, val: (p) => p.points, cell: (p) => n(p.points) + ' P' },
          { h: 'CT', num: 1, val: (p) => p.ct ?? 0, cell: (p) => (p.ct == null ? '<span class="dim">n/a</span>' : n(p.ct, p.ct % 1 ? 1 : 0) + ' CT') },
          { h: 'Inviter, friends', cell: (p) => (p.inviter ? esc(p.inviter) : '<span class="dim">No inviter</span>') + '<span class="t2">' + p.friends + ' friends</span>' },
          { h: '', cell: (p) => '<div class="row-acts">' + btn('Open', { link: 1, act: M ? 'toast' : 'detail', arg: M ? 'The player detail opens here.' : p.addr }) + btn('Unblock', { small: 1, act: 'unblock', arg: M ? D.blocked.indexOf(p) : p.addr, write: 1, disabled: !!p.pending, title: p.pending ? 'The unblock is with the worker' : '' }) + '</div>' },
        ],
        after: D.blocked.length ? '<div class="tbl-foot"><span>1 to ' + D.blocked.length + ' of ' + D.abuse.blocked + ' · ' + D.abuse.blockedWeek + ' blocked this week, ' + D.abuse.blockedHour + ' in the last hour</span><span class="acts"><button type="button" class="link" disabled>Previous</button><button type="button" class="link" data-act="toast" data-arg="Rows 11 to 20 load here."' + (M ? '' : ' disabled') + '>Next 10</button></span></div>' : '' }) + '</section>';
  }

  function invites() {
    const i = D.invites;
    return '<section><div class="figs" style="margin-bottom:24px">' + fig('Links today', i.today, 'of ' + D.users.newToday + ' new players') + fig('Links this week', i.week, 'of ' + D.users.newWeek + ' new players') + fig('New players invited', pct(i.shareWeek), 'this week') + fig('Invite bonus today', n(i.bonusToday) + '<small>P</small>', n(i.bonusWeek) + ' P this week') + fig('Welcome bonuses', i.welcomeToday, i.welcomeWeek + ' this week, ' + (D.welcomeP ?? 100) + ' P each') + '</div></section>' +
      '<section class="sec"><div class="sec-head"><h2>Flagged clusters</h2><span class="nb">' + D.clusters.length + '</span><span class="sec-note">Groups of accounts that share a network, a device, a sign up burst or an answer pattern</span></div>' +
      table<any>({ caption: 'Flagged clusters', rows: D.clusters, cls: 'vtop', empty: empty('No flagged clusters', 'The risk check flags groups of accounts that share a network, a device, a sign up burst or an answer pattern.'),
        cols: [{ h: 'Cluster', cell: (c) => tag('Cluster ' + c.id, 'warn') }, { h: 'Inviter', cell: (c) => (c.addr ? '<span class="t1">' + esc(c.inviter) + '</span>' + addr(c.addr) : '<span class="dim">' + esc(c.inviter) + '</span>') }, { h: 'Accounts', num: 1, cell: (c) => c.size }, { h: 'Blocked', num: 1, cell: (c) => c.blocked }, { h: 'In review', num: 1, cell: (c) => c.review }, { h: 'Shared signals', cell: (c) => esc(c.signals) }, { h: 'First seen', cell: (c) => c.first },
          { h: '', cell: () => '<div class="row-acts">' + link('Open in review list', '?') + '</div>' }] }) + '</section>' +
      '<section class="sec"><div class="sec-head"><h2>Top inviters</h2><span class="sec-note">The inviter earns ' + (D.refPct ?? 10) + '% on top of every point a friend earns. A blocked friend pays no bonus.</span></div>' +
      table<any>({ caption: 'Top inviters', rows: D.inviters, sort: [1, 'desc'], cls: 'tight', empty: empty('No invites yet', 'Inviters show here once a friend has joined with their code.'),
        cols: [
          { h: 'Inviter', val: (p) => p.name.toLowerCase(), cell: (p) => '<span class="t1">' + esc(p.name) + '</span>' + addr(p.addr) },
          { h: 'Friends joined', num: 1, val: (p) => p.joined, cell: (p) => p.joined },
          { h: 'First day done', num: 1, val: (p) => p.first, cell: (p) => p.first + ' <span class="dim">' + (p.joined ? Math.round((p.first / p.joined) * 100) : 0) + '%</span>' },
          { h: 'Active after 7 days', num: 1, val: (p) => (p.active7 == null ? -1 : p.active7), cell: (p) => (p.active7 == null ? '<span class="dim">' + (M ? 'Too new' : 'n/a') + '</span>' : p.active7 + '%') },
          { h: 'Bonus, lifetime', num: 1, val: (p) => p.life, cell: (p) => n(p.life) + ' P' },
          { h: 'Bonus, this week', num: 1, val: (p) => p.week, cell: (p) => n(p.week) + ' P' },
          { h: 'Risk score', val: (p) => p.score, cell: (p) => score(p.score) },
          { h: 'Flags', cell: (p) => (p.flag ? tag(p.flag, 'warn') : '') },
        ] }) + '</section>';
  }

  function search() {
    if (is('noresult') || (!M && !D.search.length)) { const term = M ? '0x9999' : qv; return '<section><div class="sec-head"><h2>Search</h2></div>' + empty('No player matches “' + esc(term) + '”', 'Search takes a full or partial address, a full email address (it is hashed and matched, never shown) or an invite code. Check for a typo, or paste the whole address.', '<a class="link" href="?">Back to the review list</a>') + '</section>'; }
    const list = M ? [D.review[0]] : D.search;
    const title = M ? '1 player matches the invite code LUCKY88D' : list.length + (list.length === 1 ? ' player matches “' : ' players match “') + esc(qv) + '”';
    return '<section><div class="sec-head"><h2>' + title + '</h2></div>' + table<any>({ caption: 'Search results', rows: list, cls: 'vtop',
      cols: [{ h: 'Account', cell: who }, { h: 'Joined', cell: (p) => p.joined }, { h: 'State', cell: (p) => tag(p.state || 'Review', p.state === 'Blocked' ? 'down' : p.state === 'Active' ? 'up' : 'warn') }, { h: 'Score', cell: (p) => score(p.score) }, { h: 'Friends', num: 1, cell: (p) => p.friends }, { h: 'Points', num: 1, cell: (p) => n(p.points) + ' P' },
        { h: '', cell: (p) => '<div class="row-acts">' + btn('Open', { link: 1, act: 'detail', arg: M ? 0 : p.addr }) + '</div>' }] }) + '</section>';
  }

  return tabs() + (tab === 'blocked' ? blocked() : tab === 'invites' ? invites() : tab === 'search' ? search() : review());
}

/* ---------- the drawer ---------- */
function drawerMock(p: any) {
  const D = mockD(), cl = D.clusterAfull;
  const on = (c: any, k: string) => (c.st === 'Blocked' || (c.rules || []).some((r: any) => r.k === k) ? '<span class="on"><span class="sr">yes</span></span>' : '<span class="no"><span class="sr">no</span></span>');
  const rules = (q: any) => '<ul class="rules">' + q.rules.map((r: any) => '<li><b>' + r.k + '</b><span class="dim">' + r.t + '</span></li>').join('') + '</ul>';
  const mx = '<table class="tbl tight mx"><caption class="sr">Accounts linked to this one, by signal</caption><thead><tr><th scope="col">Account</th><th scope="col">Score</th><th scope="col">Burst</th><th scope="col">Network</th><th scope="col">Device</th><th scope="col">Answers</th><th scope="col">State</th></tr></thead><tbody>' +
    cl.map((c: any) => '<tr' + (c.addr === p.addr ? ' aria-selected="true"' : '') + '><td>' + addr(c.addr) + (c.addr === p.addr ? ' <b>this account</b>' : '') + '</td><td>' + c.score + '</td><td>' + on(c, 'Sign up burst') + '</td><td>' + on(c, 'Shared network') + '</td><td>' + on(c, 'Shared device') + '</td><td>' + on(c, 'Identical answers') + '</td><td>' + tag(c.st) + '</td></tr>').join('') + '</tbody></table>';
  return '<div class="drawer-head"><div><h2 id="sheet-h">Player ' + short(p.addr) + '</h2><p class="dim">' + p.email + ' · joined ' + p.joined + ' KST</p></div><span class="acts" style="margin-left:auto">' + tag('Review', 'warn') + btn('Clear', { small: 1, act: 'clear', arg: 3, write: 1 }) + btn('Block', { small: 1, act: 'block', arg: 3, write: 1 }) + '<button type="button" class="x" data-close aria-label="Close player detail" autofocus>' + ic('x') + '</button></span></div>' +
    '<section><h3>Profile</h3>' + kv([['Wallet', addr(p.addr, { full: 1 })], ['Email', p.email + ' <span class="dim">masked. Gmail, dots and +tags removed</span>'], ['Signed up', p.joined + ' KST, registered on chain 13:54'], ['Play key', 'Set today 13:54, this device only'], ['Days played', p.days + ' (today, all 5 answered)'], ['Invited by', 'luckyday88 ' + addr(p.inviterAddr) + ' with code LUCKY88D'], ['Friends', 'None']]) + '</section>' +
    '<section><h3>Risk</h3><div class="cols cols-2" style="gap:20px"><div class="fig"><span class="fig-l">Score now</span><span class="fig-v">' + p.score + '</span><span class="fig-s">Review from 50, blocked at 80</span></div><ol class="stack" style="gap:6px;font-size:13px"><li><b>14:00</b> hourly check: 74. Shared network, identical answers and shared device added.</li><li><b>13:53</b> at sign up: 41. Sign up burst under one inviter.</li></ol></div><div style="height:12px"></div>' + rules(p) + '</section>' +
    '<section><h3>Cluster A: 11 accounts linked by signals</h3>' + mx + '<p class="hint" style="margin-top:8px">Burst: joined within 9 minutes under one inviter. Network: same network at sign up. Device: same device fingerprint. Answers: the same 5 answers within 4 seconds.</p></section>' +
    '<section><h3>Points</h3>' + kv([['Completion', '100 P', 1], ['Hits', '0 P', 1], ['Compensation', '0 P', 1], ['Invite bonus', '0 P', 1], ['Welcome', '100 P', 1], ['<b style="color:var(--ink)">Balance</b>', '<b>200 P</b>', 1]]) + '</section>' +
    '<section><h3>Conversions and gas</h3>' + kv([['Conversions', 'None. First conversion opens Thu 3 Dec (7 day wait)'], ['CT balance', '0 CT'], ['Staked', '0 CT'], ['Sponsored transactions', '6 today: 1 play key setup, 5 predictions'], ['Freeze history', 'Never blocked']]) + '</section>';
}
function drawerLive(d: any, reviewAt: number, blockAt: number) {
  const u = d.user, now = nowS();
  const P = d.pointsByKind || {}, bal = Object.values(P).reduce((a: number, v: any) => a + Number(v), 0) as number;
  const flags = (d.riskFlags || []) as any[];
  const st = u.frozen ? 'Blocked' : flags.some((f) => f.status === 'open') ? 'Review' : 'Cleared';
  const score = u.risk_score ?? flags.reduce((m, f) => Math.max(m, f.score || 0), 0);
  const fz = (d.freezes || []) as any[];
  const at = (x: any) => (typeof x === 'number' ? x : Math.floor(new Date(x).getTime() / 1000));
  return '<div class="drawer-head"><div><h2 id="sheet-h">Player ' + short(u.wallet) + '</h2><p class="dim">' + (u.display_name ? esc(u.display_name) + ' · ' : '') + '…@' + esc(u.email_domain) + ' · joined ' + T.rel(u.created_at, now) + ' KST</p></div><span class="acts" style="margin-left:auto">' + tag(st, st === 'Blocked' ? 'down' : st === 'Review' ? 'warn' : 'up') +
    (u.frozen ? btn('Unblock', { small: 1, act: 'unblock', arg: u.wallet, write: 1 }) : btn('Clear', { small: 1, act: 'clear', arg: u.wallet, write: 1 }) + btn('Block', { small: 1, act: 'block', arg: u.wallet, write: 1 })) + '<button type="button" class="x" data-close aria-label="Close player detail" autofocus>' + ic('x') + '</button></span></div>' +
    '<section><h3>Profile</h3>' + kv([['Wallet', addr(u.wallet, { full: 1 })], ['Email', '…@' + esc(u.email_domain) + ' <span class="dim">only the domain is shown; the address is stored as a keyed hash</span>'], ['Signed up', T.rel(u.created_at, now) + ' KST' + (u.registered_at ? ', registered on chain ' + T.rel(u.registered_at, now) : ', ' + esc(u.registration))],
      ['Invited by', d.inviter ? addr(d.inviter.inviter) + ' with code ' + esc(d.inviter.code) : 'Nobody'], ['Friends', String((d.friends || []).length)], ['Invite code', d.inviteCode ? esc(d.inviteCode.code) : 'None']]) + '</section>' +
    '<section><h3>Risk</h3><div class="cols cols-2" style="gap:20px"><div class="fig"><span class="fig-l">Score now</span><span class="fig-v">' + score + '</span><span class="fig-s">Review from ' + reviewAt + ', blocked at ' + blockAt + '</span></div><ol class="stack" style="gap:6px;font-size:13px">' + (flags.length ? flags.slice(0, 6).map((f) => '<li><b>' + T.rel(at(f.created_at), now) + '</b> ' + esc(ruleName(f.rule)) + ', score ' + f.score + ' (' + esc(f.status) + ')</li>').join('') : '<li class="dim">No rule has fired.</li>') + '</ol></div></section>' +
    '<section><h3>Points</h3>' + kv([['Completion', n(P.completion || 0) + ' P', 1], ['Hits', n(P.hits || 0) + ' P', 1], ['Compensation', n(P.compensation || 0) + ' P', 1], ['Invite bonus', n(P.referral || 0) + ' P', 1], ['Welcome', n(P.welcome || 0) + ' P', 1], ['Converted', n(P.convert || 0) + ' P', 1], ['<b style="color:var(--ink)">Balance</b>', '<b>' + n(bal) + ' P</b>', 1]]) + '</section>' +
    '<section><h3>Freeze history</h3>' + (fz.length ? kv(fz.slice(0, 8).map((f) => [T.rel(at(f.created_at), now), esc(f.action) + ' by ' + esc(f.actor) + (f.reason ? ': ' + esc(f.reason) : '') + ' <span class="dim">' + esc(f.status) + '</span>' + (f.tx_hash ? ' ' + addr(f.tx_hash) : '')])) : '<p class="dim">Never blocked.</p>') + '</section>';
}

/* ---------- live ---------- */
async function livePlayers(q: string) {
  const now = nowS();
  const [rv, bl, inv, det, app, pr, sr] = await Promise.all([
    api('/admin/v1/players?list=review'), api('/admin/v1/players?list=blocked&limit=50'), api('/admin/v1/invites'), api('/admin/v1/dashboard/detail'), api('/admin/v1/app').catch(() => null), api('/admin/v1/params').catch(() => null),
    q ? api('/admin/v1/players?list=all&q=' + encodeURIComponent(q)) : Promise.resolve({ players: [] }),
  ]);
  const reviewAt = app?.server?.riskReviewScore ?? 50, blockAt = app?.server?.riskBlockScore ?? 80;
  const row = (u: any) => {
    const flags = u.openFlags || [];
    const score = flags.reduce((m: number, f: any) => Math.max(m, f.score || 0), u.risk_score || 0);
    return { addr: u.wallet, name: u.display_name || '', email: '…@' + u.email_domain, joined: T.rel(u.created_at, now), score, rules: flags.map((f: any) => ({ k: ruleName(f.rule), t: ruleText(f.details) })), inviter: u.play?.inviterName || (u.play?.inviter ? short(u.play.inviter) : ''), friends: u.play?.friends ?? 0, days: u.play?.days ?? 0, points: u.play?.points ?? 0, state: u.frozen ? 'Blocked' : flags.length ? 'Review' : 'Active' };
  };
  const blocked = (bl.players || []).map((u: any) => {
    const f = u.lastFreeze;
    return { addr: u.wallet, at: f ? T.rel(f.at, now) : '', sortAt: f?.at ?? 0, by: f?.actor === 'risk' || !f ? 'Risk check' : f.actor, why: u.frozen_reason || f?.reason || '', score: u.risk_score ?? 0, points: u.play?.points ?? 0, ct: null, inviter: u.play?.inviterName || (u.play?.inviter ? short(u.play.inviter) : ''), friends: u.play?.friends ?? 0, pending: f?.action === 'unfreeze' && f?.status !== 'done' };
  });
  const flagged = (inv.flaggedClusters || []) as any[];
  const groups = new Map<string, any[]>();
  for (const f of flagged) { const k = String(f.details?.inviter || f.details?.cluster || f.rule); groups.set(k, [...(groups.get(k) || []), f]); }
  const clusters = [...groups.entries()].map(([k, fs], i) => ({ id: String.fromCharCode(65 + i), inviter: /^0x/.test(k) ? short(k) : ruleName(k), addr: /^0x[0-9a-f]{40}$/.test(k) ? k : null, size: new Set(fs.map((f) => f.wallet)).size, blocked: 0, review: fs.filter((f) => f.status === 'open').length, signals: [...new Set(fs.map((f) => ruleName(f.rule)))].join(', '), first: T.rel(Math.min(...fs.map((f) => Math.floor(new Date(f.created_at).getTime() / 1000))), now) }));
  const p = pr?.current;
  return {
    reviewAt, blockAt, refPct: (p?.referralBps ?? 1000) / 100, welcomeP: p?.welcomePoints ?? 100,
    review: (rv.players || []).map(row), blocked, search: (sr.players || []).map(row),
    abuse: { review: det.abuse.review, blocked: det.abuse.blocked, blockedWeek: det.abuse.blockedWeek, blockedHour: det.abuse.blockedHour },
    users: { newToday: det.users.new_today, newWeek: det.users.new_week },
    invites: { today: det.invites.linkedToday, week: det.invites.linkedWeek, shareWeek: inv.invitedShare7d ?? 0, bonusToday: det.points?.referral?.today ?? 0, bonusWeek: det.points?.referral?.week ?? 0, welcomeToday: det.invites.welcomeToday, welcomeWeek: det.invites.welcomeWeek },
    clusters,
    inviters: (inv.topInviters || []).map((t: any) => ({ name: t.name || short(t.inviter), addr: t.inviter, joined: t.friends, first: t.first_done, active7: null, life: t.bonus, week: t.week_bonus, score: t.risk_score ?? 0, flag: t.frozen ? 'Blocked' : '' })),
  };
}

export default function Players() {
  const { state, qs } = usePageCtx('players', ['blocked', 'invites', 'search']);
  const inval = useInvalidate();
  const qv = qs.get('q') || '';
  const page = usePageData(['players', qv], () => livePlayers(qv));
  const { loading, error, updatedAt, q } = page;
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : state;
  const D0 = page.D || EMPTY;
  const D = CONFIG.mock ? { ...D0, reviewAt: 50, blockAt: 80 } : D0;
  const html = useMemo(() => render(D, qs), [D0, state, qs.toString(), X.role, X.env]);

  const pOf = (arg?: string, list: 'review' | 'blocked' = 'review') => (CONFIG.mock ? D[list][arg == null ? (list === 'review' ? 3 : 4) : +arg] : D[list].find((x: any) => x.addr === arg) || D.search.find((x: any) => x.addr === arg) || D.review.concat(D.blocked).find((x: any) => x.addr === arg));
  function blockSheet(arg?: string) {
    const p = pOf(arg) || { addr: arg, points: 0, score: 0, rules: [], inviter: '' };
    const pre = p.rules.map((r: any) => r.k + ': ' + r.t).join('. ') + (p.rules.length ? '.' : '');
    confirm({ title: 'Block ' + short(p.addr) + '?', wide: 1, body: '<p>The account is frozen on chain. It can no longer predict, convert, receive an airdrop or get sponsored gas. Its ' + n(p.points) + ' P stay as they are, and it can still withdraw staked CT at its own fee. The player sees the Account on hold screen with help@cojam.app.</p>' + kv([['Account', addr(p.addr, { full: 1, link: false })], ['Score', p.score + ' (below the automatic block at ' + D.blockAt + ')'], ['Inviter', p.inviter ? esc(p.inviter) + '. No invite bonus is paid on this friend while blocked' : 'None']]),
      reasonLabel: 'Note', prefill: is('blockerror') ? '' : pre, placeholder: 'Which evidence did you check?', signer: 'Sent with the operator key through the worker. No owner signature.', danger: 1, action: 'Block account', cancel: 'Cancel', done: short(p.addr) + ' blocked.',
      run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/players/' + p.addr + '/block', { body: { reason: why } }); void inval(); return short(p.addr) + ' blocked. Sponsored gas stopped at once; the worker freezes it on chain.'; } });
    if (CONFIG.mock && is('blockerror')) (document.querySelector('[data-confirm]') as HTMLElement).click();
  }
  function clearSheet(arg?: string) {
    const p = pOf(arg) || { addr: arg, rules: [] };
    confirm({ title: 'Clear ' + short(p.addr) + '?', body: '<p>The account leaves the review list and keeps playing. The rules that fired (' + p.rules.map((r: any) => r.k.toLowerCase()).join(', ') + ') do not flag it again for 30 days. A new rule or a score of ' + D.blockAt + ' still acts.</p>', reasonLabel: 'Note', placeholder: 'Why is this account fine?', action: 'Clear account', done: short(p.addr) + ' cleared for 30 days.',
      run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/players/' + p.addr + '/clear', { body: { reason: why } }); void inval(); } });
  }
  function unblockSheet(arg?: string) {
    const p = pOf(arg, 'blocked') || { addr: arg, at: '', by: '', why: '', points: 0, ct: null };
    confirm({ title: 'Unblock ' + short(p.addr) + '?', wide: 1, body: '<p>The account can predict, convert and receive prizes again. Points earned before stay as they are.</p>' + kv([['Account', addr(p.addr, { full: 1, link: false })], ['Blocked', p.at + ' KST by ' + esc(p.by)], ['Reason then', esc(p.why)], ['Balance', n(p.points) + ' P' + (p.ct == null ? '' : ', ' + p.ct + ' CT')]]), reasonLabel: 'Note', placeholder: 'What changed, or what was the check wrong about?', signer: 'Sent with the operator key through the worker. No owner signature.', action: 'Unblock account', cancel: 'Keep blocked', done: short(p.addr) + ' unblocked.',
      run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/players/' + p.addr + '/unblock', { body: { reason: why } }); void inval(); return short(p.addr) + ' unblock is queued: the worker unfreezes it on chain.'; } });
  }
  async function detail(arg?: string) {
    if (CONFIG.mock) { sheet({ drawer: true, body: drawerMock(D.review[3]) }); return; }
    sheet({ drawer: true, body: '<div class="drawer-head"><div><h2 id="sheet-h">Player ' + short(arg || '') + '</h2><p class="dim"><span class="spin"></span> Loading</p></div><span class="acts" style="margin-left:auto"><button type="button" class="x" data-close aria-label="Close player detail" autofocus>' + ic('x') + '</button></span></div>' });
    try { const d = await api('/admin/v1/players/' + arg); if (document.getElementById('sheet')) sheet({ drawer: true, body: drawerLive(d, D.reviewAt, D.blockAt) }); }
    catch (e) { toast('The player did not load: ' + (e as Error).message); }
  }
  useActs({ block: blockSheet, clear: clearSheet, unblock: unblockSheet, detail: (a) => void detail(a), toast: (m) => toast(m || '') });
  useEffect(() => {
    const on = (e: Event) => {
      const f = e.target as HTMLFormElement; if (!f.matches('[data-psearch]')) return; e.preventDefault();
      const v = (f.querySelector('input[name="q"]') as HTMLInputElement).value.trim();
      const u = new URLSearchParams(); if (v) { u.set('state', CONFIG.mock ? (/LUCKY/i.test(v) ? 'search' : 'noresult') : 'search'); u.set('q', v); }
      import('../lib/ui').then(({ nav }) => nav('/players' + (u.toString() ? '?' + u : '')));
    };
    document.addEventListener('submit', on); return () => document.removeEventListener('submit', on);
  }, []);
  useEffect(() => { if (!CONFIG.mock || document.getElementById('sheet')) return; if (is('detail')) void detail(); if (is('block', 'blockerror')) blockSheet(); if (is('clear')) clearSheet(); if (is('unblock')) unblockSheet(); }, [state]);

  return <Shell page="players" title="Players" sub="Abuse review, blocked accounts and invites" states={['detail', 'block', 'blockerror', 'clear', 'blocked', 'unblock', 'unblockfail', 'invites', 'search', 'noresult', 'empty', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}
const EMPTY: any = { reviewAt: 50, blockAt: 80, review: [], blocked: [], search: [], abuse: { review: 0, blocked: 0, blockedWeek: 0, blockedHour: 0 }, users: {}, invites: {}, clusters: [], inviters: [] };
void href;
