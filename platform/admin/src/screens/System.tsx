// AD6 System, ported from platform/design/admin/pages/system.js. States (mock): failing | maintenance | maint |
// adddomain | domainerror | disabledomain | addadmin | loading | error. Live: ?state=adddomain and ?state=addadmin open
// their forms. Data: /admin/v1/system, /email-domains, /admins, /app, /dashboard, /staking. Writes: run a job now,
// email domain add and switch, maintenance switch, admin add and remove (owner).
import { useMemo } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, tag, ic, esc, addr, btn, kv, note, table, link, fig, log, href, T } from '../lib/x';
import { confirm, toast, go, busy, unbusy, errText } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate } from '../api/hooks';
import { usePageCtx, useActs, ctWei, nowS } from '../page';
import { Shell } from '../Shell';
import { auditRows, reserveRows } from '../live';

const RULE: Record<string, string> = { gmail: 'Dots and +tags removed', plus: '+tags removed', none: 'None' };

function render(D: any): string {
  begin();
  const M = CONFIG.mock;
  const failing = is('failing'), maintOn = M ? is('maintenance') : D.app.maintenance, owner = X.role === 'owner';

  function wallets() {
    const R: Record<string, any> = {}; D.reserves.forEach((r: any) => { R[r.id] = r; });
    const rows = [
      { r: R.fee, addr: D.wallets.fee, key: 'Hot key, held by the relayer service only', fix: 'Send KAIA from the treasury to this address.', floorEnv: 'MIN_FEE_PAYER_BALANCE_KAIA' },
      { r: R.op, addr: D.wallets.op, key: 'Hot key, held by the worker only', fix: 'Send KAIA from the treasury to this address.', floorEnv: 'MIN_OPERATOR_BALANCE_KAIA' },
      { r: R.pred, addr: D.wallets.pred, key: 'Contract. Funded by plain transfers from the owner', fix: M ? 'Next airdrop Wed 2 Dec: about 1,284 CT.' : 'Pays conversions now and the next weekly airdrop.', floorEnv: '' },
      { r: R.stake, addr: D.wallets.stake, key: M ? 'Contract. Also holds 962,400 CT principal and 21,460 CT reserved interest' : 'Contract. Also holds ' + n(D.staking.total) + ' CT principal and ' + n(D.staking.owed) + ' CT reserved interest', fix: 'New stakes show Full for now when it reaches 0.', floorEnv: '' },
    ];
    const nn = (v: number | null, dp?: number) => (v == null ? '<span class="dim">Not known</span>' : n(v, dp));
    return '<section class="sec"><div class="sec-head"><h2>Wallets and reserves</h2><span class="sec-note">Runway is the balance divided by the average outflow of the last 7 days. An alert opens on the dashboard below the floor.</span></div>' +
      table<any>({ caption: 'Wallets and reserves', rows, loading: is('loading'), error: is('error'), what: 'Wallet balances', sort: [4, 'asc'],
        cols: [
          { h: 'Wallet', cell: (w) => '<span class="t1">' + w.r.name + '</span><span class="t2">' + w.key + '</span>' },
          { h: 'Address', cell: (w) => addr(w.addr, { full: 1 }) },
          { h: 'Balance', num: 1, val: (w) => w.r.bal ?? -1, cell: (w) => (w.r.bal == null ? nn(null) : '<span class="num-d" style="font-size:16px">' + n(w.r.bal, w.r.unit === 'KAIA' ? 1 : 0) + '</span> ' + w.r.unit) },
          { h: 'Outflow a day', num: 1, cell: (w) => (w.r.perDay == null ? nn(null) : n(w.r.perDay, w.r.unit === 'KAIA' ? 1 : 0) + ' ' + w.r.unit) },
          { h: 'Runway', num: 1, val: (w) => w.r.runway ?? 1e9, cell: (w) => (w.r.runway == null ? nn(null) : '<span class="num-d" style="font-size:16px">' + w.r.runway + '</span> days') },
          { h: 'Floor', num: 1, cell: (w) => '<label class="sr" for="fl-' + w.r.id + '">Alert floor for ' + w.r.name + '</label><input class="inp num" id="fl-' + w.r.id + '" style="width:92px" inputmode="decimal" value="' + (w.r.floor == null ? '' : n(w.r.floor)) + '"' + (M && X.canWrite ? '' : ' disabled') + (M ? '' : ' title="' + (w.floorEnv ? 'Set in the server environment (' + w.floorEnv + ')' : 'No floor for this reserve: the dashboard alerts on its runway') + '"') + '> <span class="dim">' + w.r.unit + '</span>' },
          { h: 'State', cell: (w) => (w.r.k === 'down' ? tag('Below floor', 'down') : w.r.k === 'warn' ? tag('Under 30 days', 'warn') : tag('Healthy', 'up')) + '<span class="t2" style="margin-top:3px">' + w.fix + '</span>' },
        ] }) +
      (is('loading', 'error') ? '' : '<div style="height:12px"></div>' + kv([['Owner and treasury', addr(D.owner, { full: 1 }) + ' <span class="dim">The master wallet. It owns both contracts, funds the reserves and can withdraw what is not owed. Its key is never on a server.</span>']])) + '</section>';
  }

  function jobs() {
    const rows = D.jobs.map((j: any) => (failing && j.name === 'Answer setter' ? Object.assign({}, j, { s: 'Failing', result: '6 runs failed: the AI provider answers 529 (overloaded)', took: '30s timeout', last: 'Today 14:30' }) : j));
    const nFail = rows.filter((j: any) => j.s === 'Failing').length, nSlow = rows.filter((j: any) => j.s === 'Slow').length;
    const firstFail = rows.find((j: any) => j.s === 'Failing');
    return '<section class="sec"><div class="sec-head"><h2>Jobs</h2>' + (nFail ? tag(nFail + ' failing', 'down') : nSlow ? tag(nSlow + ' slow', 'warn') : M ? tag('1 slow', 'warn') : tag('All healthy', 'up')) + '<span class="sec-note">Everything the platform does by itself. Run now starts one extra run; it never skips the next scheduled one.</span></div>' +
      (failing ? note('down', '<b>Answer setter has failed for 30 minutes.</b> 2 answers are past their due time. Hit points wait; nothing is paid on a missing answer. Questions still without an answer 48 hours after their set closed are cancelled.', link('Open Answers', href('/answers', 'late'))) + '<div style="height:12px"></div>' :
        !M && firstFail ? note('down', '<b>' + esc(firstFail.name) + ' is failing.</b> ' + esc(firstFail.result) + '. The next scheduled run retries it.', firstFail.job === 'resolution' ? link('Open Answers', href('/answers')) : '') + '<div style="height:12px"></div>' : '') +
      table<any>({ caption: 'Jobs', rows, cls: 'tight', loading: is('loading'),
        empty: '<div class="empty"><h3>No job status yet</h3><p>The worker writes its job status after the first run. Is the worker running?</p></div>',
        cols: [
          { h: 'Job', val: (j) => j.name, cell: (j) => '<span class="t1">' + j.name + '</span><span class="t2">' + j.what + '</span>' },
          { h: 'Schedule', cell: (j) => j.every },
          { h: 'Last run', cell: (j) => j.last + (j.took ? '<span class="t2">took ' + j.took + '</span>' : '') },
          { h: 'Result', cell: (j) => (j.s === 'Healthy' || j.s === 'Off' ? esc(j.result) : '<b style="color:var(--' + (j.s === 'Failing' ? 'down' : 'warn') + ')">' + esc(j.result) + '</b>') },
          { h: 'Next run', cell: (j) => j.next },
          { h: 'State', val: (j) => ({ Failing: 0, Slow: 1, Healthy: 2, Off: 3 } as any)[j.s], cell: (j) => tag(j.s) },
          { h: '', cell: (j) => '<div class="row-acts">' + (j.next === 'Running' ? '<span class="dim">Always on</span>' : btn('Run now', { small: 1, act: 'run', arg: j.job || j.name, write: 1 })) + '</div>' },
        ] }) + '</section>';
  }

  function relayer() {
    const s = D.sponsor, total = s.actions.reduce((a: number, x: any) => a + x[1], 0);
    return '<section class="sec"><div class="sec-head"><h2>Relayer and chain</h2><span class="sec-note">Sponsored transactions in the last ' + (M ? 'hour' : '24 hours') + '</span></div><div class="cols cols-3 split"><div>' +
      '<div class="figs" style="margin-bottom:16px">' + fig('Sponsored', n(total), M ? 'last hour' : 'last 24 hours', 's') + fig('Median confirm', s.median, 'send to receipt', 's') + fig(M ? 'Play keys set' : 'Gas today', M ? s.keysToday : s.gasToday, M ? 'today' : 'KAIA paid by the fee payer', 's') + '</div>' +
      '<table class="tbl tight"><caption class="sr">Sponsored by ' + (M ? 'action' : 'status') + '</caption><thead><tr><th scope="col">' + (M ? 'Action' : 'Status') + '</th><th scope="col" class="num">' + (M ? 'Last hour' : '24 hours') + '</th></tr></thead><tbody>' + (s.actions.length ? s.actions.map((a: any) => '<tr><td>' + esc(a[0]) + '</td><td class="num">' + n(a[1]) + '</td></tr>').join('') : '<tr><td colspan="2" class="dim">None</td></tr>') + '</tbody></table></div>' +
      '<div><h3 class="sub">Refusals by code</h3><table class="tbl tight"><caption class="sr">Refusals</caption><thead><tr><th scope="col">Code</th><th scope="col" class="num">' + (M ? 'Last hour' : '24 hours') + '</th></tr></thead><tbody>' + (s.refusals.length ? s.refusals.map((a: any) => '<tr><td><span class="mono">' + esc(a[0]) + '</span><span class="t2">' + esc(a[2]) + '</span></td><td class="num">' + a[1] + '</td></tr>').join('') : '<tr><td colspan="2" class="dim">None</td></tr>') + '</tbody></table><p class="hint" style="margin-top:8px">Last error: ' + esc(s.lastErr) + '.</p></div>' +
      '<div><h3 class="sub">Chain</h3>' + kv(D.chain.rpc.map((r: any) => [r[0], tag(r[1]) + ' ' + r[2], 1]).concat([['Block height', D.chain.height, 1], ['Lag behind the network', D.chain.lag, 1]])) +
      '<h3 class="sub">Images, last 7 days</h3>' + kv([['Generated', D.images.generated, 1], ['Rejected by the check', D.images.rejected, 1], ['Fallbacks in use', D.images.fallback, 1], ['Cost', D.images.cost + ' <span class="dim">' + D.images.per + '</span>', 1], ['Model', '<span class="dim">' + D.images.model + '</span>', 1]]) + '</div></div></section>';
  }

  function domains() {
    const form = is('adddomain', 'domainerror'), bad = is('domainerror');
    const add = form ? '<form class="cols" style="grid-template-columns:1fr 1fr 1.2fr auto;gap:12px;align-items:start;margin-top:16px;padding-top:16px;border-top:var(--hair)" onsubmit="return false"><div class="fl"><label for="dm">Domain</label><input class="inp" id="dm" value="' + (M ? (bad ? 'naver.com' : 'proton.me') : '') + '" placeholder="example.com"' + (bad ? ' aria-invalid="true" aria-describedby="dm-e"' : '') + '>' + (bad ? '<p class="err" id="dm-e">' + ic('warn') + 'This domain is already listed.</p>' : '<p class="hint" id="dm-h">Like example.com.' + (M ? ' 22 sign ups were refused from it this week.' : '') + '</p>') + '</div><div class="fl"><label for="dn">Name shown at login</label><input class="inp" id="dn" value="' + (M ? (bad ? 'Naver' : 'Proton Mail') : '') + '"></div><div class="fl"><label for="dr">Normalisation</label><select class="inp" id="dr"><option value="plus">+tags removed</option><option value="gmail">Gmail: dots and +tags removed</option><option value="none">None</option></select><p class="hint">One normalised address is one player.</p></div><div class="acts" style="padding-top:22px">' + btn('Add provider', { act: 'adddomain', write: 1, disabled: bad }) + '<a class="link" href="?">Cancel</a></div></form>' : '';
    const top = D.refusedDomains.top, other = D.refusedDomains.total - top.reduce((a: number, t: any) => a + t[1], 0);
    return '<section class="sec"><div class="sec-head"><h2>Email domain allow list</h2><span class="nb">' + D.domains.length + '</span><span class="sec-note">Sign up is limited to these providers. Switching one off stops new sign ups only: its players keep playing.</span><span class="sec-end">' + (form ? '' : X.canWrite ? '<a class="btn" href="?state=adddomain">Add provider</a>' : btn('Add provider', { write: 1 })) + '</span></div>' +
      '<div class="cols cols-8-4 split"><div>' + table<any>({ caption: 'Email providers', rows: D.domains, cls: 'tight', sort: [3, 'desc'],
        cols: [
          { h: 'Domain', val: (d) => d.d, cell: (d) => '<b>' + esc(d.d) + '</b>' },
          { h: 'Name at login', cell: (d) => esc(d.name) },
          { h: 'Normalisation', cell: (d) => d.rule },
          { h: 'Sign ups, 7 days', num: 1, val: (d) => d.up, cell: (d) => n(d.up) },
          { h: 'Refused, 7 days', num: 1, val: (d) => d.no, cell: (d) => d.no },
          { h: 'Sign up', cell: (d) => '<button type="button" class="sw" role="switch" aria-checked="' + (d.on !== false) + '" aria-label="New sign ups from ' + esc(d.d) + '" data-act="domain" data-arg="' + esc(d.d) + '"' + (X.canWrite ? '' : ' disabled') + '><i></i>' + (d.on !== false ? 'On' : 'Off') + '</button>' },
        ],
        foot: '<tfoot><tr><td colspan="3">All providers</td><td class="num">' + n(D.domains.reduce((a: number, d: any) => a + d.up, 0)) + '</td><td class="num">' + D.domains.reduce((a: number, d: any) => a + d.no, 0) + '</td><td></td></tr></tfoot>' }) + '</div>' +
      '<div><h3 class="sub">Refused for the provider, 7 days</h3>' + kv(top.map((t: any) => [esc(t[0]), t[1], 1]).concat([['Other domains', other, 1], ['<b style="color:var(--ink)">Total</b>', D.refusedDomains.total, 1]])) + '<p class="hint" style="margin-top:8px">The Refused column on the left counts addresses that were already linked after normalisation (same mailbox, different spelling).</p></div></div>' + add + '</section>';
  }

  function admins() {
    const form = is('addadmin');
    return '<div><div class="sec-head"><h2>Admin allow list</h2><span class="nb">' + D.admins.length + '</span><span class="sec-end">' + btn('Add admin', { act: 'addadmin', disabled: !owner, title: owner ? '' : 'Only the Owner role can change this list' }) + '</span></div>' +
      table<any>({ caption: 'Admins', rows: D.admins, cls: 'tight',
        cols: [{ h: 'Email', cell: (a) => '<b>' + esc(a.email) + '</b>' + (a.email === D.me.email && (!owner || !M) ? ' <span class="dim">you</span>' : '') }, { h: 'Role', cell: (a) => tag(a.role) }, { h: M ? 'Last sign in' : 'Added', cell: (a) => a.last },
          { h: '', cell: (a) => '<div class="row-acts">' + btn('Remove', { link: 1, danger: 1, act: 'rmadmin', arg: a.email, disabled: !owner || a.role === 'Owner' || (!M && a.email === D.me.email) }) + '</div>' }] }) +
      (form ? '<form class="cols" style="grid-template-columns:1fr 150px auto;gap:12px;align-items:end;margin-top:12px" onsubmit="return false"><div class="fl"><label for="am">Email</label><input class="inp" id="am" type="email" value="' + (M ? 'mina@cojam.app' : '') + '" placeholder="name@cojam.app"></div><div class="fl"><label for="ar">Role</label><select class="inp" id="ar"><option value="viewer">Viewer</option><option value="operator" selected>Operator</option><option value="owner">Owner</option></select></div>' + btn('Add', { act: 'addadmin2', disabled: !M && !owner }) + '</form>' : '') +
      '<p class="hint" style="margin-top:8px">Viewer reads. Operator can also block, unblock, correct inside the window, void, edit questions and the allow lists. Owner can also change this list. ' + (owner ? '' : 'You are ' + (X.role === 'viewer' ? 'a Viewer' : 'an Operator') + ': this list is read only for you.') + '</p></div>';
  }
  function app() {
    return '<div><div class="sec-head"><h2>App</h2>' + (maintOn ? tag('Maintenance on', 'warn') : '') + '</div>' +
      (maintOn ? note('warn', '<b>Maintenance mode is on since ' + (M ? '14:20' : D.app.since) + ' KST.</b> Every app screen shows the maintenance page. The install page and this admin still work. Picks already held on phones are sent when it ends.' + (M ? '' : ' The player API reads this switch from the admin setting.')) + '<div style="height:12px"></div>' : '') +
      kv([['Running version', D.app.version + ' <span class="dim">' + (M ? 'service worker deployed Tue 24 Nov' : 'the minimum the API accepts') + '</span>'],
        ['Minimum version', '<label class="sr" for="minv">Minimum version</label><input class="inp" id="minv" style="width:110px" value="' + esc(D.app.min) + '"' + (M && X.canWrite ? '' : ' disabled') + (M ? '' : ' title="Set in the server environment (MIN_APP_VERSION)"') + '> <span class="hint">Older apps see Update required.</span>'],
        ['Maintenance mode', '<button type="button" class="sw" role="switch" aria-checked="' + maintOn + '" data-act="maint"' + (X.canWrite ? '' : ' disabled') + '><i></i>' + (maintOn ? 'On' : 'Off') + '</button>'],
        ['Message to players', '<label class="sr" for="mmsg">Maintenance message</label><textarea class="inp" id="mmsg" rows="2"' + (X.canWrite ? '' : ' disabled') + '>' + esc(D.app.msg) + '</textarea>'],
        ['Expected end', '<label class="sr" for="mend">Expected end</label><input class="inp" id="mend" style="width:180px" value="' + esc(D.app.end) + '"' + (X.canWrite ? '' : ' disabled') + '>']]) + '</div>';
  }

  if (is('loading', 'error')) return wallets() + (is('loading') ? jobs() : '');
  return wallets() + jobs() + relayer() + domains() + '<section class="sec"><div class="cols cols-2 split">' + admins() + app() + '</div></section>' +
    '<section class="sec" id="log"><div class="sec-head"><h2>Log</h2><span class="sec-note">All events. Every change that writes on chain shows its signer and transaction.</span></div>' + log(failing ? [{ t: '14:30:31', lv: 'error', who: 'Answer setter', msg: 'Run failed: AI provider returned 529 (overloaded) after 30 s. 6th failure in a row.', json: '{ "job": "answer-setter", "attempt": 6, "status": 529, "due": ["Q-1124-1", "Q-1126-2"] }' } as any].concat(D.log) : D.log) + '</section>';
}

/* ---------- live ---------- */
const JOBS: [string, string, string, string][] = [
  ['draft', 'Question drafter', 'Writes questions and keeps 7 days ahead filled', 'Daily 18:00'], ['draft-catchup', 'Drafter catch up', 'Second drafting pass for days still short', 'Daily 00:00'], ['images', 'Image generator', 'One picture per question, then the content check', 'Daily 12:30'],
  ['publish', 'Question publisher', "Writes tomorrow's 5 questions on chain", 'Every 15 min, 21:00 to 08:45'], ['publish-late', 'Late publisher', 'Safety net: today on chain if it is missing', 'Every 15 min'], ['resolution', 'Answer setter', 'Reads the source and sets each answer on chain', 'Every 5 min'],
  ['correction', 'Answer re-check', 'Checks answers again inside the correction window', 'Every 15 min'], ['settle', 'Settle sweep', 'Pays hit points when a correction window ends', 'Every 10 min'], ['compensation', 'Compensation', 'Pays players after an owner correction', 'Every 10 min'],
  ['expiry', 'Expiry', 'Voids anything past the 48 hour deadline', 'Every 10 min'], ['risk', 'Risk scoring', 'Scores accounts hourly and at every sign up', 'Hourly'], ['week-pool', 'Ranking aggregator', "Rebuilds the week's pool and qualified players", 'Every 5 min'],
  ['week-close', 'Week close', 'Closes the week that just ended', 'Mon 09:05'], ['airdrop', 'Airdrop sender', 'Sends the weekly prizes to the top 10', 'Wed 21:00'], ['monitors', 'Monitors', 'Snapshots for this admin and the alerts', 'Every minute'],
];
const EXPECT: Record<string, number> = { resolution: 600, settle: 1200, correction: 1800, compensation: 1200, expiry: 1200, 'week-pool': 600, monitors: 180, risk: 7200, 'publish-late': 1800 };
async function liveSystem() {
  const [sys, dom, adm, app, stk, me] = await Promise.all([api('/admin/v1/system'), api('/admin/v1/email-domains'), api('/admin/v1/admins'), api('/admin/v1/app'), api('/admin/v1/staking').catch(() => null), api('/admin/v1/me')]);
  const now = nowS();
  const st = sys.jobs || {};
  const jobs = JOBS.map(([job, name, what, every]) => {
    const s = st[job] || {}, last = s.lastRunAt ? Math.floor(Date.parse(s.lastRunAt) / 1000) : null;
    const stale = last != null && EXPECT[job] && now - last > EXPECT[job] * 3;
    return { job, name, what, every, last: last ? T.rel(last, now) : 'Not run yet', took: s.tookMs != null ? (s.tookMs < 1000 ? s.tookMs + ' ms' : (s.tookMs / 1000).toFixed(1) + ' s') : '', result: s.lastError ? s.lastError : last ? 'OK' : 'No run recorded yet', next: every, s: s.lastError ? 'Failing' : stale ? 'Slow' : last ? 'Healthy' : 'Off' };
  });
  const sponsored = Object.entries(sys.sponsored24h || {}).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v as number]);
  const refusals = Object.entries(sys.sponsorErrors24h || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => [k, v, '']);
  const R = reserveRows(sys.reserves, sys.gas, sys.budgets, stk);
  const opFloor = app.server?.minOperatorBalanceKaia;
  R.forEach((r) => { if (r.id === 'op' && opFloor != null) { r.floor = opFloor; if (r.bal != null && r.bal < opFloor) r.k = 'down'; } });
  const ai = sys.ai || {};
  const lag = sys.indexer?.lag;
  const m = app.maintenance;
  return {
    me, owner: sys.owner, reserves: R,
    staking: { total: Math.round(ctWei(stk?.totalPrincipalWei) || 0), owed: Math.round(ctWei(stk?.owedInterestWei) || 0) },
    wallets: { fee: sys.feePayer || '', op: '', pred: sys.contracts?.predict || '', stake: sys.contracts?.staking || '' },
    jobs,
    sponsor: { actions: sponsored, refusals, median: 'n/a', gasToday: (Number(BigInt(sys.gas?.todayWei || '0') / 10n ** 15n) / 1000).toFixed(3), lastErr: refusals.length ? refusals[0][0] + ', ' + refusals[0][1] + ' times in 24 hours' : 'none in 24 hours' },
    chain: { rpc: [[sys.network === 'kaia' ? 'public-en.node.kaia.io' : sys.network === 'kairos' ? 'public-en-kairos.node.kaia.io' : 'RPC', sys.rpc?.block ? 'Healthy' : 'Failing', sys.rpc?.block ? 'answering' : 'no answer']], height: sys.rpc?.block ? n(sys.rpc.block) : 'Not known', lag: lag == null ? 'Not known' : lag + (lag === 1 ? ' block' : ' blocks') },
    images: { generated: 'n/a', rejected: 'n/a', fallback: 'n/a', cost: ai.costUsd != null ? Number(ai.costUsd).toFixed(2) + ' USD' : 'n/a', per: 'AI spend this month, ' + (ai.runs ?? 0) + ' runs', model: 'Set in the server config (IMAGE_MODEL)' },
    domains: (dom.domains || []).map((d: any) => ({ d: d.domain, name: d.display_name, rule: RULE[d.rule] || d.rule, on: d.enabled, up: d.signups7d, no: d.refused7d ?? 0 })),
    refusedDomains: { total: dom.refusedNotListed7d?.total ?? 0, top: (dom.refusedNotListed7d?.top || []).map((t: any) => [t.domain, t.n]) },
    admins: (adm.admins || []).map((a: any) => ({ email: a.email, role: a.role.charAt(0).toUpperCase() + a.role.slice(1), last: T.date(Math.floor(Date.parse(a.created_at) / 1000)) + (a.added_by ? ' by ' + a.added_by : '') })),
    app: { version: app.minAppVersion, min: app.minAppVersion, maintenance: m.on, msg: m.message, end: m.endsAt || '', since: m.since ? T.hm(m.since) : '' },
    log: auditRows(sys.audit || [], now),
  };
}

export default function System() {
  const { state } = usePageCtx('system', ['adddomain', 'addadmin']);
  const inval = useInvalidate();
  const page = usePageData(['system'], liveSystem, { refetchInterval: 60_000 });
  const { loading, error, updatedAt, q } = page;
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : state;
  const D = page.D || EMPTY;
  const html = useMemo(() => render(D), [D, state, X.role, X.env]);
  const maintOn = CONFIG.mock ? is('maintenance') : D.app?.maintenance;

  function maintSheet() {
    confirm({ title: maintOn ? 'End maintenance mode?' : 'Turn on maintenance mode?', reason: CONFIG.mock && maintOn ? false : undefined,
      body: maintOn ? '<p>The app opens again for everyone. Held picks are sent if their question is still open.</p>' : '<p>Every player sees the maintenance page at once, with the message and expected end below the switch. ' + (CONFIG.mock ? 'About 1,926 players have played today and 138 have picks left. ' : '') + 'The install page and this admin keep working. Answers, settling and the airdrop keep running.</p>',
      placeholder: maintOn ? 'What was fixed?' : 'What is being fixed?', action: maintOn ? 'End maintenance' : 'Turn on maintenance', cancel: maintOn ? 'Keep it on' : 'Cancel', next: CONFIG.mock ? (maintOn ? '' : 'maintenance') : undefined, done: maintOn ? 'Maintenance mode is off.' : 'Maintenance mode is on.',
      run: CONFIG.mock ? undefined : async (why) => {
        const message = (document.getElementById('mmsg') as HTMLTextAreaElement)?.value.trim() || undefined, endsAt = (document.getElementById('mend') as HTMLInputElement)?.value.trim() || '';
        await api('/admin/v1/app', { body: { maintenance: !maintOn, message, endsAt, reason: why } }); void inval();
        return maintOn ? 'Maintenance mode is off.' : 'Maintenance mode is on.';
      } });
  }
  function domainSheet(d?: string) {
    const row = D.domains.find((x: any) => x.d === d), on = !row || row.on !== false;
    if (!on) {
      confirm({ title: 'Allow new sign ups from ' + d + ' again?', body: '<p>New players with a ' + esc(d) + ' address can sign up at once.</p>', placeholder: 'Why is this provider switched on again?', action: 'Switch on ' + esc(d), cancel: 'Keep it off', done: d + ' is on for new sign ups.',
        run: async (why) => { await api('/admin/v1/email-domains/' + d, { method: 'PATCH', body: { enabled: true, reason: why } }); void inval(); } });
      return;
    }
    confirm({ title: 'Stop new sign ups from ' + d + '?', body: '<p>New players with a ' + esc(d) + ' address see “We cannot use this email provider yet”. Players who already signed up with it keep playing, converting and withdrawing.</p>', placeholder: 'Why is this provider switched off?', action: 'Switch off ' + esc(d), cancel: 'Keep it on', done: d + ' is off for new sign ups.',
      run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/email-domains/' + d, { method: 'PATCH', body: { enabled: false, reason: why } }); void inval(); } });
  }
  useActs({
    run: (name) => {
      const label = (JOBS.find((j) => j[0] === name) || [name, name])[1];
      confirm({ title: 'Run ' + label + ' now?', reason: false, body: '<p>Starts one extra run. The next scheduled run still happens. The result shows in the Jobs table and in the log.</p>', action: 'Run now', done: label + ' started.',
        run: CONFIG.mock ? undefined : async () => { const r = await api('/admin/v1/jobs/' + name + '/run', { body: {} }); void inval(); return label + ' started (request ' + r.requestId + ').'; } });
    },
    domain: (d) => domainSheet(d),
    adddomain: () => {
      if (CONFIG.mock) { confirm({ title: 'Add proton.me to the allow list?', body: '<p>New players can sign up with a proton.me address at once. Addresses are stored lower case with +tags removed, and one normalised address is one player.</p>', placeholder: 'Why is this provider added?', action: 'Add proton.me', done: 'proton.me added. Sign ups are open.' }); return; }
      const dm = (document.getElementById('dm') as HTMLInputElement).value.trim().toLowerCase(), dn = (document.getElementById('dn') as HTMLInputElement).value.trim(), dr = (document.getElementById('dr') as HTMLSelectElement).value;
      const fieldErr = (m: string) => { const i = document.getElementById('dm') as HTMLInputElement; i.setAttribute('aria-invalid', 'true'); let e = document.getElementById('dm-e'); if (!e) { e = document.createElement('p'); e.className = 'err'; e.id = 'dm-e'; i.after(e); } e.innerHTML = ic('warn') + esc(m); i.setAttribute('aria-describedby', 'dm-e'); document.getElementById('dm-h')?.remove(); i.focus(); };
      if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dm)) { fieldErr('Enter a domain like example.com.'); return; }
      if (D.domains.some((x: any) => x.d === dm)) { fieldErr('This domain is already listed.'); return; }
      if (!dn) { (document.getElementById('dn') as HTMLInputElement).focus(); toast('Give the name shown at login.'); return; }
      const ruleLabel = (RULE as any)[dr];
      confirm({ title: 'Add ' + dm + ' to the allow list?', body: '<p>New players can sign up with a ' + esc(dm) + ' address at once. Addresses are stored lower case' + (dr === 'none' ? '' : ' with ' + ruleLabel.toLowerCase()) + ', and one normalised address is one player.</p>', placeholder: 'Why is this provider added?', action: 'Add ' + esc(dm), done: dm + ' added. Sign ups are open.',
        run: async (why) => { await api('/admin/v1/email-domains', { body: { domain: dm, displayName: dn, rule: dr, reason: why } }); go(''); void inval(); return dm + ' added. Sign ups are open.'; } });
    },
    addadmin: () => go('addadmin'),
    addadmin2: async (_a, el) => {
      if (CONFIG.mock) { toast('mina@cojam.app added as Operator.'); return; }
      const email = (document.getElementById('am') as HTMLInputElement).value.trim().toLowerCase(), role = (document.getElementById('ar') as HTMLSelectElement).value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter an email address.'); return; }
      busy(el as HTMLButtonElement, 'Adding');
      try { await api('/admin/v1/admins', { body: { email, role } }); toast(email + ' added as ' + role.charAt(0).toUpperCase() + role.slice(1) + '.'); go(''); void inval(); }
      catch (e) { unbusy(el as HTMLButtonElement); toast(errText(e).replace(/<[^>]+>/g, '')); }
    },
    rmadmin: (m) => confirm({ title: 'Remove ' + m + ' from the admin?', reason: false, body: '<p>Their session ends at once and they can no longer sign in.</p>', danger: 1, action: 'Remove', done: m + ' removed.',
      run: CONFIG.mock ? undefined : async () => { await api('/admin/v1/admins/' + encodeURIComponent(m || ''), { method: 'DELETE' }); void inval(); } }),
    maint: maintSheet,
  });
  useMemo(() => {
    if (!CONFIG.mock) return;
    setTimeout(() => { if (document.getElementById('sheet')) return; if (is('maint')) maintSheet(); if (is('disabledomain')) domainSheet('hotmail.com'); }, 0);
  }, [state]);

  return <Shell page="system" title="System" sub="Wallets, jobs, relayer, allow lists and the app switch" states={['failing', 'maintenance', 'maint', 'adddomain', 'domainerror', 'disabledomain', 'addadmin', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}
const EMPTY: any = { me: {}, owner: '', reserves: [], staking: {}, wallets: {}, jobs: [], sponsor: { actions: [], refusals: [], median: '', lastErr: '' }, chain: { rpc: [], height: '', lag: '' }, images: {}, domains: [], refusedDomains: { total: 0, top: [] }, admins: [], app: { maintenance: false }, log: [] };
