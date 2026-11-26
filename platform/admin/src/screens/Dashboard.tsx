// AD1 Dashboard, ported from platform/design/admin/index.html. States (mock): calm | loading | error.
import { CONFIG } from '../config';
import { X, begin, is, n, pct, tag, fig, ic, esc, cd, link, table, meter, note, log, thumb, href, T } from '../lib/x';
import { api } from '../api/client';
import { usePageData } from '../api/hooks';
import { usePageCtx, useActs, ctWei, nowS } from '../page';
import { Shell } from '../Shell';
import { auditRows, reserveRows, qid, CAT, STATUS } from '../live';

const M = () => CONFIG.mock;
const nn = (v: number | null | undefined, dp?: number) => (v == null ? '<span class="dim">Not known</span>' : n(v, dp));

function render(D: any): string {
  begin();
  const calm = is('calm');
  const R = D.rules || { completion: 100, hit: 50, ref: 10, welcome: 100, ageDays: 7, reviewAt: 50, blockAt: 80 };

  function alerts() {
    if (calm || (!M() && !D.alerts.length)) return '<div class="alerts"><p class="alerts-ok">' + ic('ok', 18) + 'Nothing needs you right now. Reserves, jobs, the question schedule and the review list are all inside their limits.</p></div>';
    let list: string[][];
    if (M()) {
      const f = D.reserves[2], s = D.reserves[1];
      list = [
        ['down', 'Act now', 'Fee payer is below its floor: ' + n(f.bal, 1) + ' KAIA, floor ' + n(f.floor) + ' KAIA.', 'Covers about ' + f.runway + ' days of sponsored transactions at ' + n(f.perDay, 1) + ' KAIA a day.', '/system', 'Open System'],
        ['warn', 'Soon', 'Staking rewards fund covers ' + s.runway + ' days of new stakes.', n(s.bal) + ' CT free, ' + n(s.perDay) + ' CT a day reserved by new stakes.', '/system', 'Open System'],
        ['warn', 'Soon', '1 answer is late: Q-1124-1, Nikkei 225.', 'Cancelled automatically at the 48 hour deadline, in ' + cd(18 * 3600 + 28 * 60) + '.', href('/answers', 'late'), 'Open Answers'],
        ['warn', 'Check', '1 answer was set with low confidence (0.71) and has been paid: Q-1124-4, V-League.', '803 players were paid for No.', href('/answers', 'after'), 'Open Answers'],
        ['warn', 'Soon', 'Saturday 28 Nov has 4 of 5 questions.', 'Sunday 29 Nov has 1 question without an image.', href('/questions', 'short'), 'Open Questions'],
        ['warn', 'Review', D.abuse.review + ' accounts are waiting for review.', 'Invite cluster flagged under luckyday88: 11 friends, 3 blocked in the last hour.', '/players', 'Open Players'],
        ['', 'Notice', 'Owner change announced: Completion points 100 to 120, Points per hit 50 to 40.', 'Can be applied in ' + cd(D.pending.in) + '.', '/rewards', 'Open Reward settings'],
      ];
    } else list = D.alerts;
    return '<ul class="alerts" aria-label="Alerts">' + list.map((a) => '<li>' + tag(a[1], a[0]) + '<p>' + a[2] + ' <span>' + a[3] + '</span></p>' + link(a[5], a[4]) + '</li>').join('') + '</ul>';
  }

  function todaySet() {
    const rows = D.today;
    const t = table<any>({
      caption: "Today's five questions", cls: 'tight', rows, loading: is('loading'), error: is('error'), what: "Today's set",
      empty: '',
      cols: [
        { h: 'Slot', w: '44px', cell: (r) => '<span class="nb">' + r.slot + '</span>' },
        { h: 'Question', cell: (r) => '<div class="qcell">' + thumb(r.img) + '<div><a class="t1" href="' + href('/questions') + '" style="color:inherit;text-decoration:none">' + esc(r.en.title) + '</a><span class="t2">' + r.cat + ' · ' + r.id + '</span></div></div>' },
        { h: 'State', cell: (r) => tag(r.state) },
        { h: 'Answer due', cell: (r) => '<span class="nowrap">' + r.due + '</span>' },
        { h: 'Picks', num: 1, val: (r) => r.picks[0] + r.picks[1], cell: (r) => n(r.picks[0] + r.picks[1]) },
        { h: 'Split of picks', w: '210px', cell: (r) => { const a = r.picks[0], b = r.picks[1], p = a + b ? (a / (a + b)) * 100 : 50; return '<div class="splitcell"><span><span class="pk" data-d="l">' + esc(r.en.left) + ' ' + p.toFixed(0) + '%</span><span class="pk" data-d="r">' + (100 - p).toFixed(0) + '% ' + esc(r.en.right) + '</span></span><div class="splitbar" role="img" aria-label="' + n(a) + ' picked ' + esc(r.en.left) + ', ' + n(b) + ' picked ' + esc(r.en.right) + '"><i style="width:' + p + '%"></i><u></u></div></div>'; } },
      ],
      sort: [0, 'asc'],
    });
    const p = D.play;
    const side = is('loading') ? '<div class="figs rows">' + [0, 1, 2].map(() => '<div class="fig"><span class="skel" style="width:90px"></span><span class="skel fig-v"></span></div>').join('') + '</div>' :
      '<div class="figs rows">' +
      fig('Players today', n(p.players), '<b>' + n(p.completed) + '</b> finished all 5 (' + pct(p.players ? p.completed / p.players : 0) + ')', 'l') +
      '<div class="figs">' + fig('Picks', n(p.picks), 'of ' + n(p.players * 5) + ' possible', 's') +
      (p.undone == null ? fig('Undo rate', '<span class="dim">n/a</span>', 'Undo happens on the phone before a pick is sent', 's') : fig('Undo rate', pct(p.undone / (p.picks + p.undone)), n(p.undone) + ' picks taken back', 's')) +
      fig('Hits paid', n(p.hitsPaid), (p.settled ?? 2) + ' questions settled today', 's') + '</div></div>';
    const head = M() ? 'Thursday 26 Nov. All five close together in ' + cd(D.now.dayEndsIn) + ' (Fri 09:00 KST).' : D.now.dayLong + '. All five close together in ' + cd(D.now.dayEndsIn) + ' (' + D.now.dayEndLabel + ' KST).';
    return '<section class="sec"><div class="sec-head"><h2>Today\'s set</h2>' + tag('Live', 'ink') + '<span class="sec-note">' + head + '</span><span class="sec-end">' + link('Questions', href('/questions')) + '</span></div>' +
      '<div class="cols cols-8-4 split"><div>' + (rows.length || is('loading', 'error') ? t : '<div class="empty"><h3>No questions are live today</h3><p>The day was not published. Open Questions to see why.</p></div>') + '</div><div>' + (is('error') ? '' : side) + '</div></div></section>';
  }

  function players() {
    const u = D.users, days: number[][] = D.daily, max = M() ? 2100 : Math.max(1, ...days.map((d) => d[0])) * 1.03;
    const last = days.length - 1;
    const bars = days.map((d, i) => '<i class="' + (i === last ? 'now' : '') + '" style="height:' + (d[0] / max) * 100 + '%" title="' + (i === last ? 'Today so far' : last - i + ' days ago') + ': ' + n(d[0]) + ' players, ' + n(d[1]) + ' finished"><u style="height:' + (d[0] ? (d[1] / d[0]) * 100 : 0) + '%"></u></i>').join('');
    const peakI = days.reduce((b, d, i) => (d[0] > days[b][0] ? i : b), 0);
    const x = M() ? ['28 Oct: 212', 'Peak Mon 23 Nov: 2,038', 'Today so far: ' + n(D.play.players)] : [D.dailyLabels[0] + ': ' + n(days[0]?.[0] ?? 0), 'Peak ' + D.dailyLabels[peakI] + ': ' + n(days[peakI]?.[0] ?? 0), 'Today so far: ' + n(D.play.players)];
    const aria = M() ? 'Daily players rose from 212 thirty days ago to a peak of 2,038 on Monday. Today so far 1,926.' : 'Daily players over the last ' + days.length + ' days: from ' + n(days[0]?.[0] ?? 0) + ' to a peak of ' + n(days[peakI]?.[0] ?? 0) + '. Today so far ' + n(D.play.players) + '.';
    return '<section class="sec"><div class="sec-head"><h2>Players</h2><span class="sec-end">' + link('Players', href('/players')) + '</span></div>' +
      '<div class="cols cols-2 split"><div class="figs">' +
      fig('Registered', n(u.registered), '<b>+' + u.newWeek + '</b> this week') +
      fig('Daily active', n(D.play.players), 'Yesterday ' + n(days[last - 1]?.[0] ?? 0) + ' at day end') +
      fig('New today', n(u.newToday), '<b>' + u.invitedToday + '</b> came by invite (' + pct(u.newToday ? u.invitedToday / u.newToday : 0) + ')') +
      fig('Active this week', n(u.activeWeek), u.qualified == null ? 'Qualified players are counted by the worker' : '<b>' + n(u.qualified) + '</b> qualified for the pool') + '</div>' +
      '<figure><div class="sec-head" style="min-height:0;margin-bottom:8px"><span class="fig-l">Players a day, last 30 days</span><span class="sec-end legend"><span>Played</span><span class="k2">Finished all 5</span></span></div><div class="bars" role="img" aria-label="' + aria + '">' + bars + '</div><div class="bars-x"><span>' + x[0] + '</span><span>' + x[1] + '</span><span>' + x[2] + '</span></div></figure></div></section>';
  }

  function points() {
    const P = D.points, c = D.convert;
    const row = (l: string, k: string, nt: string) => '<tr><td>' + l + (nt ? ' <span class="t2">' + nt + '</span>' : '') + '</td><td class="num">' + n(P[k][0]) + ' P</td><td class="num">' + n(P[k][1]) + ' P</td></tr>';
    const tbl = '<table class="tbl tight"><caption class="sr">Points issued today and this week, by kind</caption><thead><tr><th scope="col">Points issued</th><th scope="col" class="num">Today</th><th scope="col" class="num">This week</th></tr></thead><tbody>' +
      row('Completion', 'completion', n(D.play.completed) + ' finished days at ' + R.completion + ' P') + row('Hits', 'hits', n(D.play.hitsPaid) + ' hits at ' + R.hit + ' P') + row('Invite bonus', 'invite', R.ref + '% on top of what invited friends earn') + row('Welcome', 'welcome', D.invites.welcomeToday + ' first finished days at ' + R.welcome + ' P') +
      (P.compensation && (P.compensation[0] || P.compensation[1]) ? row('Compensation', 'compensation', 'Corrected answers paid after the window') : '') +
      '</tbody><tfoot><tr><td>Total</td><td class="num">' + n(P.total[0]) + ' P</td><td class="num">' + n(P.total[1]) + ' P</td></tr></tfoot></table>';
    const ratio = c.weekCt * c.rate ? (P.total[1] / (c.weekCt * c.rate)).toFixed(1) + ' times the points converted' : 'not converted yet';
    const conv = '<div class="stack" style="gap:20px"><div class="figs">' + fig('Converted today', n(c.todayCt) + '<small>CT</small>', n(c.todayCt * c.rate) + ' P in ' + c.todayN + ' conversions') + fig('Converted this week', n(c.weekCt) + '<small>CT</small>', n(c.weekCt * c.rate) + ' P in ' + c.weekN + ' conversions') + '</div>' +
      meter(c.todayCt, c.capDay, { left: '<b>Daily cap, everyone:</b> ' + n(c.todayCt) + ' of ' + n(c.capDay) + ' CT', right: pct(c.capDay ? c.todayCt / c.capDay : 0) + ' used', aria: pct(c.capDay ? c.todayCt / c.capDay : 0) + ' of the daily conversion cap used' }) +
      meter(c.topUser, c.capUser, { left: '<b>Largest player today:</b> ' + n(c.topUser, c.topUser % 1 ? 2 : 0) + ' of ' + c.capUser + ' CT', right: c.atUserCap + ' players at the cap' }) +
      '<p class="hint">' + n(c.waiting) + ' players are still inside the ' + R.ageDays + ' day wait before their first conversion. Points issued this week are ' + ratio + '.</p></div>';
    return '<section class="sec"><div class="sec-head"><h2>Points and conversion</h2><span class="sec-note">' + n(c.rate) + ' P = 1 CT</span><span class="sec-end">' + link('Reward settings', href('/rewards')) + '</span></div>' +
      '<div class="cols cols-2 split"><div>' + tbl + '</div>' + conv + '</div></section>';
  }

  function reserves() {
    const rows = D.reserves.map((r: any) => (calm ? Object.assign({}, r, r.id === 'fee' ? { bal: 1240, runway: 30, k: 'ok' } : r.id === 'stake' ? { bal: 96400, runway: 58, k: 'ok' } : {}) : r));
    const t = table<any>({
      caption: 'Reserve and wallet balances with runway', rows,
      cols: [
        { h: 'Reserve', cell: (r) => '<span class="t1">' + r.name + '</span><span class="t2">' + r.what + '</span>' },
        { h: 'Balance', num: 1, val: (r) => r.bal ?? -1, cell: (r) => r.bal == null ? nn(null) : '<span class="num-d" style="font-size:16px">' + n(r.bal, r.unit === 'KAIA' ? 1 : 0) + '</span> ' + r.unit },
        { h: 'Floor', num: 1, cell: (r) => (r.floor == null ? '<span class="dim">None</span>' : n(r.floor) + ' ' + r.unit) },
        { h: 'Outflow a day', num: 1, cell: (r) => (r.perDay == null ? nn(null) : n(r.perDay, r.unit === 'KAIA' ? 1 : 0) + ' ' + r.unit) },
        { h: 'Runway', num: 1, val: (r) => r.runway ?? 1e9, cell: (r) => (r.runway == null ? nn(null) : '<span class="num-d" style="font-size:16px">' + r.runway + '</span> days') },
        { h: 'State', cell: (r) => (r.k === 'down' ? tag('Below floor', 'down') : r.k === 'warn' ? tag('Under 30 days', 'warn') : tag('Healthy', 'up')) },
        { h: 'What drives it', cell: (r) => '<span class="dim">' + r.note + '</span>' },
      ],
      sort: [4, 'asc'],
    });
    return '<section class="sec"><div class="sec-head"><h2>Reserves and runway</h2><span class="sec-note">Runway is the balance divided by the average outflow of the last 7 days.</span><span class="sec-end">' + link('System', href('/system')) + '</span></div>' + t +
      '<p class="hint" style="margin-top:10px">Staked in total: ' + n(D.staking.total) + ' CT in ' + D.staking.stakes + ' stakes. Interest reserved for them: ' + n(D.staking.owed) + ' CT, held by the staking contract and not part of the free balance above.</p></section>';
  }

  function invitesAbuse() {
    const i = D.invites, a = D.abuse;
    return '<section class="sec"><div class="cols cols-2 split"><div><div class="sec-head"><h2>Invites</h2><span class="sec-end">' + link('Top inviters', href('/players', 'invites')) + '</span></div><div class="figs">' +
      fig('Linked today', i.today, 'of ' + D.users.newToday + ' new players (' + pct(i.shareToday) + ')') + fig('Linked this week', i.week, 'of ' + D.users.newWeek + ' new players (' + pct(i.shareWeek) + ')') + fig('Welcome bonuses', i.welcomeToday, i.welcomeWeek + ' this week') + '</div></div>' +
      '<div><div class="sec-head"><h2>Blocked and review</h2><span class="sec-end">' + link('Review list', href('/players')) + '</span></div><div class="figs">' +
      fig('Waiting for review', calm ? 0 : a.review, calm || !a.review ? 'Nothing waiting' : 'Score ' + R.reviewAt + ' to ' + (R.blockAt - 1) + (a.clusters ? ', in ' + a.clusters + ' flagged clusters' : '')) + fig('Blocked this week', a.blockedWeek, '<b>' + (calm ? 0 : a.blockedHour) + '</b> in the last hour') + fig('Blocked in total', a.blocked, pct(D.users.registered ? a.blocked / D.users.registered : 0) + ' of registered players') + '</div></div></div></section>';
  }

  if (is('loading')) return '<div class="alerts"><p class="alerts-ok"><span class="spin"></span>Loading today\'s figures</p></div>' + todaySet();
  if (is('error')) return note('down', '<b>The dashboard could not load new figures.</b> ' + (M() ? 'The admin API did not answer in 10 seconds. What you see below is from 14:21:40 KST.' : esc(D.errorText || 'The admin API did not answer.')) + ' Nothing was changed.', '<button type="button" class="link" data-reload>Try again</button>') + '<div style="height:24px"></div>' + todaySet();
  return alerts() + todaySet() + players() + points() + reserves() + invitesAbuse() +
    '<section class="sec"><div class="sec-head"><h2>Recent activity</h2><span class="sec-note">The last ' + D.log.length + ' system events</span><span class="sec-end">' + link('Full log', href('/system') + '#log') + '</span></div>' + log(calm ? D.log.filter((l: any) => l.lv === 'info') : D.log) + '</section>';
}

/* ---------- live: the admin API to the view model ---------- */
const ALERT_LINK: Record<string, [string, string, string]> = {
  FEE_PAYER_LOW: ['down', '/system', 'Open System'], FEE_PAYER_RUNWAY: ['warn', '/system', 'Open System'], RESERVE_RUNWAY: ['warn', '/system', 'Open System'], DAY_INCOMPLETE: ['warn', '/questions', 'Open Questions'],
  ANSWER_LATE: ['down', '/answers', 'Open Answers'], REVIEW_LIST: ['warn', '/players', 'Open Players'], REGISTRATION_FAILED: ['warn', '/system', 'Open System'], INDEXER_LAG: ['warn', '/system', 'Open System'],
};
export async function liveDash() {
  const [dash, det, ov, qs, aud, sys, stk] = await Promise.all([
    api('/admin/v1/dashboard'), api('/admin/v1/dashboard/detail'), api('/admin/v1/overview'), api('/admin/v1/questions?status=live'), api('/admin/v1/audit?limit=13'), api('/admin/v1/system'), api('/admin/v1/staking').catch(() => null),
  ]);
  const now = det.at || nowS();
  const today = (ov.today || []).map((m: any) => {
    const full = (qs.questions || []).find((q: any) => q.marketId === m.marketId);
    return { slot: m.slot + 1, img: full?.image?.thumbUrl || full?.image?.imageUrl || null, en: { title: m.title, left: m.left, right: m.right }, cat: CAT(m.category), id: qid(det.dayId, m.slot), state: STATUS[m.status] || m.status, due: m.resolvesAt ? T.rel(m.resolvesAt, now) : '', picks: [m.picks.left, m.picks.right] };
  });
  const k = det.points || {};
  const pt = (x: string) => [k[x]?.today ?? 0, k[x]?.week ?? 0];
  const points: any = { completion: pt('completion'), hits: pt('hits'), invite: pt('referral'), welcome: pt('welcome'), compensation: pt('compensation') };
  points.total = [0, 1].map((i) => points.completion[i] + points.hits[i] + points.invite[i] + points.welcome[i] + points.compensation[i]);
  const pr = det.params;
  const daily: number[][] = [];
  const labels: string[] = [];
  for (let d = det.dayId - 29; d <= det.dayId; d++) { const r = (det.daily || []).find((x: any) => x.day_id === d); daily.push([r?.players ?? 0, r?.completed ?? 0]); labels.push(T.dd(d * 86400) + ' ' + T.long(d * 86400).split(' ')[2]); }
  const alerts = (dash.alerts || []).map((a: any) => { const l = ALERT_LINK[a.code] || [a.level === 'critical' ? 'down' : 'warn', '/system', 'Open System']; return [a.level === 'critical' ? 'down' : l[0], a.level === 'critical' ? 'Act now' : 'Soon', esc(a.message) + '.', '', l[1], l[2]]; });
  const invitedToday = det.invites.linkedToday;
  return {
    now: { dayEndsIn: Math.max(0, det.dayEndsAt - now), dayLong: T.dayLong(det.dayOpensAt), dayEndLabel: T.wd(det.dayEndsAt) + ' ' + T.hm(det.dayEndsAt), week: det.weekId },
    alerts,
    today,
    play: { players: dash.players.activeToday, completed: dash.players.completedToday, picks: det.picksToday, undone: null, hitsPaid: pr.hitPoints ? Math.round((k.hits?.today ?? 0) / pr.hitPoints) : 0, settled: det.settledToday },
    users: { registered: det.users.registered, newToday: det.users.new_today, newWeek: det.users.new_week, invitedToday, activeWeek: det.users.activeWeek, qualified: det.users.qualified },
    daily, dailyLabels: labels,
    points,
    rules: { completion: pr.completionPoints, hit: pr.hitPoints, ref: pr.referralBps / 100, welcome: pr.welcomePoints, ageDays: Math.round(pr.minAccountAge / 86400), reviewAt: 50, blockAt: 80 },
    convert: { rate: pr.pointsPerCT, todayCt: ctWei(det.conversions.todayCtWei) || 0, todayN: det.conversions.todayN, weekCt: ctWei(det.conversions.weekCtWei) || 0, weekN: det.conversions.weekN, capDay: pr.maxConvertCtPerDay, capUser: pr.maxConvertCtPerUserPerDay, topUser: ctWei(det.conversions.topUserTodayWei) || 0, atUserCap: det.conversions.atUserCap, waiting: det.conversions.waiting },
    reserves: reserveRows(dash.reserves, dash.gas, sys.budgets, stk),
    staking: { total: Math.round(ctWei(stk?.totalPrincipalWei) || 0), owed: Math.round(ctWei(stk?.owedInterestWei) || 0), stakes: stk?.openStakes ?? 0 },
    invites: { today: det.invites.linkedToday, week: det.invites.linkedWeek, shareToday: det.users.new_today ? det.invites.linkedToday / det.users.new_today : 0, shareWeek: det.users.new_week ? det.invites.linkedWeek / det.users.new_week : 0, welcomeToday: det.invites.welcomeToday, welcomeWeek: det.invites.welcomeWeek },
    abuse: { ...det.abuse, clusters: 0 },
    log: auditRows(aud.entries, now),
  };
}

export default function Dashboard() {
  usePageCtx('index');
  const { D, loading, error, updatedAt, q } = usePageData(['dash'], liveDash, { refetchInterval: 60_000 });
  useActs({});
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : '';
  const VM = D || EMPTY;
  if (error && !D) (VM as any).errorText = error.message;
  const sub = CONFIG.mock ? VM.now.day + ' · day 4 of week ' + VM.now.week : T.long(nowS()) + ' · week ' + (VM.now?.week ?? '');
  return <Shell page="index" title="Dashboard" sub={sub} states={['calm', 'loading', 'error']} html={render(VM)} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}
const EMPTY: any = { now: { dayEndsIn: 0, dayLong: '', dayEndLabel: '', week: '' }, alerts: [], today: [], play: { players: 0, completed: 0, picks: 0, undone: null, hitsPaid: 0 }, users: {}, daily: [], dailyLabels: [], points: {}, rules: {}, convert: {}, reserves: [], staking: {}, invites: {}, abuse: {}, log: [] };
