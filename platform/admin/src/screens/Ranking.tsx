// AD5 Ranking and airdrop, ported from platform/design/admin/pages/ranking.js. States (mock): last | ready | waiting |
// sending | failed | lowreserve | capped | empty | loading | error. Live: ?state=last (and ?week=) picks the closed week.
// Data: GET /admin/v1/ranking/:weekId (rows with wallets, airdrop rows, backlog, last airdrop request); writes:
// display name reset, run or retry the airdrop (operator key through the worker).
import { useMemo, useState } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, tag, ic, esc, cd, addr, btn, kv, note, table, link, empty, fig, meter, pct, short, href, T } from '../lib/x';
import { confirm, toast, go } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate } from '../api/hooks';
import { usePageCtx, useActs, ctWei, nowS } from '../page';
import { Shell } from '../Shell';

function render(D: any, more: boolean): string {
  begin();
  const M = CONFIG.mock;
  const lastWeek = is('last', 'ready', 'waiting', 'sending', 'failed', 'lowreserve'), capped = is('capped');
  const air = M ? ({ last: 'Sent', ready: 'Ready', waiting: 'Waiting for late answers', sending: 'Sending', failed: 'Failed', lowreserve: 'Ready' } as Record<string, string>)[X.state] || 'Not due' : lastWeek ? D.last.air : 'Not due';
  const rankBlock = (r: number) => '<span class="nb" data-k="' + (r === 1 ? 'ink' : r === 2 ? 'brand' : r === 3 ? 'sky' : '') + '">' + r + '</span>';
  const split: number[] = D.split, cap = D.week.cap;
  const split10 = (pool: number) => split.map((p) => Math.round(pool * p) / 100);

  function selector() {
    const opts = M ? '<option>Earlier weeks</option><option>Week 46, 9 to 16 Nov: 978 CT sent</option><option>Week 45, 2 to 9 Nov: 702 CT sent</option>' : '<option value="">Earlier weeks</option>' + D.earlier.map((w: any) => '<option value="' + w.id + '">' + esc(w.label) + '</option>').join('');
    return '<div class="sec-head" style="margin-bottom:16px"><div class="seg" role="group" aria-label="Week"><a href="?" aria-current="' + (lastWeek ? 'false' : 'page') + '">This week <span class="c">' + D.week.n + '</span></a><a href="?state=last" aria-current="' + (lastWeek ? 'page' : 'false') + '">Last week <span class="c">' + D.last.n + '</span></a></div>' +
      '<label class="sr" for="wk">Earlier weeks</label><select class="inp" id="wk" style="width:220px" data-week>' + opts + '</select>' +
      '<span class="sec-note">' + (lastWeek ? 'Week ' + D.last.n + ', ' + D.last.range + '. Closed. Late answers could add points until ' + D.last.due + '.' : 'Week ' + D.week.n + ', ' + D.now.weekRange + '. Ends in ' + cd(D.now.weekEndsIn) + '.') + '</span><span class="sec-end">' + btn('Download CSV', { act: 'csv' }) + '</span></div>';
  }

  function pool() {
    const w = lastWeek ? { qualified: D.last.qualified, pool: D.last.pool } : capped ? { qualified: 11460, pool: 10000 } : is('empty') ? { qualified: 0, pool: 0 } : D.week;
    const played = M ? (lastWeek ? 2512 : capped ? 19840 : is('empty') ? 0 : D.users.activeWeek) : lastWeek ? D.last.played : D.week.playersRanked;
    const not = played - (w.qualified ?? 0);
    const reasons = lastWeek ? [998, 352, 31] : capped ? [6210, 2098, 72] : is('empty') ? [0, 0, 0] : [1102, 318, 36];
    const atCap = capped || (!M && w.pool >= cap);
    const why = M ? n(not) + ' players who played are not in the pool: ' + n(reasons[0]) + ' played fewer than 3 days, ' + n(reasons[1]) + ' have an account younger than 7 days, ' + reasons[2] + ' are blocked.' : w.qualified == null ? 'The worker counts qualified players every 5 minutes.' : n(Math.max(0, not)) + ' ranked players are not in the pool: they played fewer than 3 days, their account is younger than 7 days, or they are blocked.';
    return '<section class="sec"><div class="sec-head"><h2>Pool</h2>' + (atCap ? tag('At the cap', 'warn') : '') + '<span class="sec-note">' + n(D.week.per) + ' CT per qualified player, capped at ' + n(cap) + ' CT. Qualified: played 3 or more days this week, account older than 7 days, not blocked.</span></div>' +
      '<div class="cols cols-2 split"><div class="figs">' + fig('Qualified players', w.qualified == null ? '<span class="dim">n/a</span>' : n(w.qualified), 'of ' + n(played) + (M ? ' who played' : ' ranked')) + fig('Pool per player', n(D.week.per) + '<small>CT</small>', 'Server setting') + fig(lastWeek ? 'Pool, final' : 'Pool so far', n(w.pool) + '<small>CT</small>', atCap && capped ? '<b>' + n(w.qualified - 10000) + ' CT</b> cut by the cap' : lastWeek ? 'Fixed when the week closed' : 'Grows until Mon 09:00 KST') + '</div>' +
      '<div class="stack">' + meter(w.pool, cap, { k: atCap ? 'warn' : '', left: '<b>Weekly pool cap:</b> ' + n(w.pool) + ' of ' + n(cap) + ' CT', right: pct(w.pool / cap) + ' used', aria: pct(w.pool / cap) + ' of the weekly pool cap used' }) +
      '<p class="hint">' + (is('empty') || (!M && !played) ? 'Nobody has played 3 days yet. The first players can qualify on Wednesday.' : why + (atCap ? ' The cap is a contract value: raising it is an owner proposal in Reward settings.' : '')) + '</p></div></div></section>';
  }

  function standings() {
    let rows = lastWeek ? D.last.rows : D.rank.concat(more || !M ? D.rankNext : D.rankNext);
    if (!M && !lastWeek && !more) rows = rows.slice(0, 12);
    const prizes = split10(capped ? 10000 : 0);
    if (capped) rows = rows.map((r: any, i: number) => Object.assign({}, r, { prize: i < 10 ? prizes[i] : undefined }));
    if (is('empty')) rows = [];
    const sent = air === 'Sent';
    const cols: any[] = [
      { h: 'Rank', w: '52px', val: (r: any) => r.rank, cell: (r: any) => (r.rank <= 10 ? rankBlock(r.rank) : '<span class="nb" data-k="off">' + r.rank + '</span>') },
      { h: 'Player', val: (r: any) => r.name.toLowerCase(), cell: (r: any) => '<span class="t1">' + esc(r.name) + '</span>' },
      { h: 'Address', cell: (r: any) => addr(r.addr, { full: 1 }) },
      { h: 'Weekly points', num: 1, val: (r: any) => r.pts, cell: (r: any) => n(r.pts) + ' P' + (r.hits != null ? '<span class="t2">' + r.days + ' days, ' + r.hits + ' hits</span>' : '') },
      { h: 'Share', num: 1, cell: (r: any) => (r.rank <= 10 ? split[r.rank - 1] + '%' : '') },
      { h: 'Prize', num: 1, val: (r: any) => r.prize || 0, cell: (r: any) => (r.prize ? '<span class="num-d" style="font-size:15px">' + n(r.prize, 2) + '</span> CT' : '<span class="dim">Outside the top 10</span>') },
    ];
    if (lastWeek) cols.push({ h: 'Payout', cell: (r: any) => (sent ? tag('Sent', 'up') : air === 'Sending' ? (M ? (r.rank <= 4 ? tag('Sent', 'up') : tag('Sending', 'sky')) : tag('Sending', 'sky')) : air === 'Failed' ? tag('Not sent', 'down') : tag('Waiting', 'line')) });
    else cols.push({ h: 'Order note', cell: (r: any) => (r.tie ? '<span class="dim">' + r.tie + '</span>' : '') });
    cols.push({ h: '', cell: (r: any) => '<div class="row-acts">' + btn('Reset name', { link: 1, act: 'reset', arg: r.addr + '|' + r.name, write: 1, disabled: /^0x/.test(r.name) }) + '</div>' });
    const sk = D.last.skipped;
    const skipped = lastWeek && sk ? note('', '<b>1 blocked winner skipped.</b> ' + addr(sk.addr) + ' finished with ' + n(sk.pts) + ' P and would have ranked ' + sk.wouldBe + '. ' + esc(sk.why) + '. Ranks ' + sk.wouldBe + ' to 10 moved up one place and the 11th player took rank 10.', link('Open in Players', href('/players', 'blocked'))) + '<div style="height:12px"></div>' : '';
    const total = capped ? 10000 : lastWeek ? D.last.pool : D.week.pool;
    return '<section class="sec"><div class="sec-head"><h2>' + (lastWeek ? 'Final standings' : 'Standings') + '</h2><span class="sec-note">' + (lastWeek ? 'Prediction points only. Invite bonus and welcome points are not counted.' : 'Prediction points only (' + D.rules.completion + ' P per finished day, ' + D.rules.hit + ' P per hit). Same points: whoever got there first ranks higher, then by address. Prizes are never split.') + '</span></div>' + skipped +
      table<any>({ caption: 'Weekly standings', rows, cols, sort: [0, 'asc'], loading: is('loading'), error: is('error'), what: 'The standings', cls: 'tight',
        empty: empty('No standings yet', M ? 'Week 49 started at 09:00 KST and no hit points have been paid in it. The list fills as the first answers settle, about 6 hours after they are set.' : 'Week ' + (lastWeek ? D.last.n : D.week.n) + ' has no points yet. The list fills as the first days are finished and the first answers settle.'),
        foot: !rows.length || is('loading', 'error') ? '' : '<tfoot><tr><td colspan="5">Top 10 prizes</td><td class="num">' + n(total, 2) + ' CT</td><td colspan="2"></td></tr></tfoot>',
        after: lastWeek || !rows.length || is('loading', 'error') ? '' : '<div class="tbl-foot"><span>Ranks 1 to ' + rows.length + ' of ' + n(D.week.playersRanked) + '. ' + (M ? "7 of this week's 35 questions are settled, so the order still changes several times a day." : D.week.settled + ' of this week\'s ' + D.week.questions + ' questions are settled' + (D.week.settled < D.week.questions ? ', so the order still changes.' : '.')) + '</span>' + (M || (!more && D.week.playersRanked > 12) ? btn('Show ranks 13 to 50', { link: 1, act: 'more' }) : '') + '</div>' }) + '</section>';
  }

  function airdrop() {
    const L = D.last, need = L.pool, low = M ? is('lowreserve') : L.reserve != null && L.reserve < need, reserve = M ? (low ? 640 : 25931) : L.reserve;
    if (!lastWeek) return '<section class="sec"><div class="sec-head"><h2>Airdrop</h2>' + tag('Not due') + '</div><div class="cols cols-2 split"><div>' + kv([['Sends', D.week.sends], ['Waits for', M ? 'Every answer of week 48: 35 questions, 7 settled so far' : 'Every answer of week ' + D.week.n + ': ' + D.week.questions + ' questions, ' + D.week.settled + ' settled so far'], ['Needs', 'About ' + n(capped ? 10000 : D.week.pool) + ' CT from the prediction reserve, which holds ' + (D.reserveCt == null ? 'an unknown amount' : n(D.reserveCt) + ' CT')], ['Last week', 'Week ' + L.n + ' ' + (L.air === 'Sent' ? 'sent, ' + n(L.pool) + ' CT' : L.air.toLowerCase()) + ' <a class="link" href="?state=last">Open week ' + L.n + '</a>']]) + '</div><p class="hint">The airdrop needs no approval. This screen is for watching the checks, and for sending again by hand if a send fails. Blocked winners are skipped and the next rank moves up.</p></div></section>';
    const checks = [
      [air === 'Waiting for late answers' ? 'wait' : 'ok', 'Every answer of week ' + L.n + ' is in', air === 'Waiting for late answers' ? (M ? '34 of 35. Q-1122-3 is late' : L.backlog.settled + ' of ' + L.backlog.total + ', ' + L.backlog.open + ' still open') : M ? '34 set, 1 cancelled' : L.backlog.settled + ' of ' + L.backlog.total + ' set'],
      ['ok', "Order matches the contract's rule", 'Points, then first to reach them, then address'],
      ['ok', 'Blocked winners skipped', L.skipped ? '1 skipped: ' + short(L.skipped.addr) + ', ranks moved up' : 'None in the top 10'],
      [low ? 'fail' : 'ok', 'The reward reserve has ' + (reserve == null ? 'an unknown amount of' : n(reserve)) + ' CT, this airdrop needs ' + n(need) + ' CT', low ? 'Short by ' + n(need - reserve) + ' CT' : reserve == null ? 'Not read' : 'Enough'],
      [air === 'Failed' ? 'fail' : 'ok', 'Operator wallet can pay the fee', air === 'Failed' ? (M ? '0.4 KAIA, needs about 1.2 KAIA' : esc(L.failReason || 'The last send failed')) : M ? '96.3 KAIA' : L.opKaia == null ? 'Not read' : n(L.opKaia, 1) + ' KAIA'],
    ];
    const head: Record<string, string> = {
      Sent: note('up', '<b>Week ' + L.n + ' airdrop sent.</b> ' + (M ? '10 payouts, ' + n(need) + ' CT, ' + L.sentAt + ' in ' + addr(L.tx) + ', block ' + L.block + '.' : L.payouts + ' payouts, ' + n(need, 2) + ' CT' + (L.tx ? ' in ' + addr(L.tx) : '') + '.')),
      Ready: low ? note('down', '<b>The airdrop cannot be sent: the reserve is short by ' + n(need - reserve) + ' CT.</b> Payouts are paused, nothing is debited and players see a paused note. It sends by itself once the owner funds the prediction reserve.', link('Open System', href('/system'))) : note('sky', '<b>Ready.</b> Every check passed. It sends by itself at ' + L.due + '. You can also send it now.'),
      'Waiting for late answers': note('warn', '<b>Waiting for ' + (M ? '1 late answer' : L.backlog.open + (L.backlog.open === 1 ? ' late answer' : ' late answers')) + '.</b> ' + (M ? 'Q-1122-3 can still add 50 P to players of week 47.' : 'They can still add hit points to players of week ' + L.n + '.') + ' The airdrop sends when ' + (M ? 'it is' : 'they are') + ' set or cancelled, at the latest ' + L.due + '.', link('Open Answers', href('/answers', 'late'))),
      Sending: note('sky', '<b>Sending.</b> ' + (M ? '4 of 10 payouts confirmed. ' : 'The worker is sending the payouts. ') + 'Do not close the reserve or change the operator key while this runs.', '<span class="spin"></span>'),
      Failed: note('down', '<b>Airdrop failed' + (M ? ': the operator wallet could not pay the network fee.' : ': ' + esc(L.failReason || 'the transaction did not go through.')) + '</b> Nothing was sent and no prize was debited. ' + (M ? 'Top up the operator wallet, then retry.' : 'Fix the cause, then retry.'), link('Open System', href('/system'))),
      'Not due': note('', '<b>Not due yet.</b> It sends by itself at ' + L.due + ' once every answer of the week is in.'),
    };
    const act = air === 'Ready' || (!M && air === 'Not due') ? btn('Run airdrop now', { primary: 1, act: 'run', write: 1, disabled: low }) : air === 'Failed' ? btn('Retry airdrop', { primary: 1, act: 'retry', write: 1 }) : air === 'Sending' ? '<button type="button" class="btn btn-primary is-busy" disabled><span class="spin"></span>' + (M ? 'Sending 5 of 10' : 'Sending') + '</button>' : '';
    return '<section class="sec"><div class="sec-head"><h2>Airdrop, week ' + L.n + '</h2>' + tag(air) + '<span class="sec-note">Automatic on Wednesday 21:00 KST (12:00 UTC), after every answer of the week is in.</span></div>' + head[air] +
      '<div class="cols cols-2 split" style="margin-top:16px"><div><h3 class="sub">Checks before sending</h3><ul class="chk">' + checks.map((c) => '<li data-s="' + c[0] + '">' + ic(c[0] === 'ok' ? 'ok' : c[0] === 'wait' ? 'clock' : 'no') + '<span>' + c[1] + '</span><span class="v">' + c[2] + '</span></li>').join('') + '</ul></div><div>' +
      kv([['Pays', n(need, 2) + ' CT to ' + (M ? 10 : Math.min(10, L.rows.length)) + ' addresses in 1 transaction'], ['From', 'Prediction reserve ' + addr(D.predict)], ['Sent by', 'Operator key, through the worker. No owner signature'], ['Due', L.due]]) + (act ? '<div class="acts" style="margin-top:16px">' + act + '</div>' : '') + '</div></div></section>';
  }

  return selector() + (is('loading', 'error') ? standings() : pool() + standings() + airdrop());
}

/* ---------- live ---------- */
async function liveRanking(lastId?: number) {
  const now = nowS(), today = Math.floor(now / 86400), cur = Math.floor((today + 3) / 7), last = lastId ?? cur - 1;
  const [c, l, app, pr, dash] = await Promise.all([api('/admin/v1/ranking/' + cur), api('/admin/v1/ranking/' + last), api('/admin/v1/app').catch(() => null), api('/admin/v1/params').catch(() => null), api('/admin/v1/dashboard').catch(() => null)]);
  const p = pr?.current, split = (c.splitBps || []).map((b: number) => b / 100);
  const rows = (r: any) => (r.rows || []).map((x: any, i: number, all: any[]) => {
    const prev = all[i - 1];
    const tie = prev && prev.points === x.points && x.last_completion_at ? 'Reached ' + n(x.points) + ' P at ' + T.wd(x.last_completion_at) + ' ' + T.hm(x.last_completion_at) + ', after rank ' + prev.rank : '';
    return { rank: x.rank, name: x.display_name || short(x.wallet), addr: x.wallet, pts: x.points, prize: x.rank <= 10 && r.poolWei ? (ctWei(r.poolWei)! * split[x.rank - 1]) / 100 : undefined, tie };
  });
  const range = (w: number) => { const a = (w * 7 - 3) * 86400, b = a + 7 * 86400; return T.wd(a) + ' ' + T.date(a).replace(/ \d{4}$/, '') + ' to ' + T.wd(b) + ' ' + T.date(b).replace(/ \d{4}$/, ''); };
  const lr = rows(l);
  const airRows = (l.airdrop || []) as any[];
  const skippedRow = airRows.find((a) => a.rank > 100);
  const sentRows = airRows.filter((a) => a.rank <= 10);
  const req = l.lastRequest;
  const status = l.week?.status === 'airdropped' || sentRows.some((a) => a.tx_hash) ? 'Sent' : req && (req.status === 'running' || req.status === 'queued') ? 'Sending' : req && req.status === 'failed' ? 'Failed' : l.backlog?.open ? 'Waiting for late answers' : now >= l.airdropDueAt ? 'Ready' : 'Not due';
  const due = T.full(l.airdropDueAt);
  const kaia = (w: string | null | undefined) => (w == null ? null : Number(BigInt(w) / 10n ** 15n) / 1000);
  const lastSent = sentRows.length ? sentRows.map((a) => ({ rank: a.rank, name: lr.find((x: any) => x.addr === a.wallet)?.name || short(a.wallet), addr: a.wallet, pts: a.points, prize: ctWei(a.amount) || 0 })) : lr.slice(0, 10);
  const earlier = [2, 3, 4, 5].map((k) => ({ id: cur - k, label: 'Week ' + (cur - k) + ', ' + range(cur - k) }));
  return {
    split, rules: { completion: p?.completionPoints ?? 100, hit: p?.hitPoints ?? 50 }, predict: '',
    now: { weekRange: range(cur) + ', 09:00 KST', weekEndsIn: Math.max(0, c.endsAt - now) },
    week: { n: cur, qualified: c.qualifiedPlayers, per: app?.server?.weeklyPoolPerPlayerCt ?? 1, cap: p?.maxWeeklyPool ?? 10000, pool: ctWei(c.poolWei) || 0, playersRanked: c.rankedPlayers ?? 0, settled: c.backlog?.settled ?? 0, questions: c.backlog?.total ?? 0, sends: T.full(c.airdropDueAt) + ', by itself' },
    rank: rows(c).slice(0, 10), rankNext: rows(c).slice(10),
    reserveCt: c.reserveWei == null ? null : ctWei(c.reserveWei),
    last: {
      n: last, range: range(last), qualified: l.qualifiedPlayers, pool: ctWei(l.poolWei) || 0, played: l.rankedPlayers ?? 0, due, air: status, tx: sentRows.find((a) => a.tx_hash)?.tx_hash || l.week?.airdrop_tx || null, payouts: sentRows.length,
      skipped: skippedRow ? { addr: skippedRow.wallet, pts: skippedRow.points, wouldBe: Number(String(skippedRow.skipped_reason || '').match(/rank (\d+)/)?.[1] || skippedRow.rank - 100), why: 'Blocked: ' + (skippedRow.skipped_reason || 'on hold') } : null,
      rows: lastSent, backlog: l.backlog || { open: 0, total: 0, settled: 0 }, reserve: l.reserveWei == null ? null : ctWei(l.reserveWei), failReason: req?.result?.error || (typeof req?.result === 'string' ? req.result : null), opKaia: kaia(dash?.reserves?.operatorWei),
    },
    earlier,
  };
}

export default function Ranking() {
  const { state, qs, net } = usePageCtx('ranking', ['last']);
  const inval = useInvalidate();
  const weekQ = qs.get('week');
  const page = usePageData(['ranking', weekQ || ''], () => liveRanking(weekQ ? +weekQ : undefined));
  const { loading, error, updatedAt, q } = page;
  const [more, setMore] = useState(false);
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : state;
  const D = page.D ? (CONFIG.mock ? mockVM(page.D) : page.D) : EMPTY;
  if (!CONFIG.mock && net) D.predict = net.contracts?.predict || '';
  const html = useMemo(() => render(D, more), [D, state, more, X.role, X.env, qs.toString()]);
  const lastWeek = is('last', 'ready', 'waiting', 'sending', 'failed', 'lowreserve');

  function runSheet(retry: boolean) {
    const L = D.last;
    const first = L.rows[0];
    confirm({ title: (retry ? 'Retry' : 'Run') + ' the week ' + L.n + ' airdrop now?', reason: false,
      body: kv(CONFIG.mock ? [['Pays', '1,131.00 CT to 10 addresses'], ['Rank 1', 'kaia_whale, 339.30 CT'], ['Skipped', '1 blocked winner'], ['Reserve after', '24,800 CT']] : [['Pays', n(L.pool, 2) + ' CT to ' + Math.min(10, L.rows.length) + ' addresses'], ['Rank 1', first ? esc(first.name) + ', ' + n(first.prize || 0, 2) + ' CT' : 'Nobody'], ['Skipped', L.skipped ? '1 blocked winner' : 'None'], ['Reserve after', L.reserve == null ? 'Not known' : n(L.reserve - L.pool) + ' CT']]) + '<p class="hint">Sent once: the contract refuses a second airdrop for the same week.</p>',
      signer: 'Sent with the operator key through the worker. No owner signature.', action: retry ? 'Retry airdrop' : 'Run airdrop now', next: CONFIG.mock ? 'sending' : undefined,
      run: CONFIG.mock ? undefined : async () => { const r = await api('/admin/v1/ranking/' + L.n + '/airdrop', { body: {} }); void inval(); return 'Airdrop of week ' + L.n + ' is with the worker (request ' + r.requestId + ').'; } });
  }
  useActs({
    csv: () => {
      const rows = lastWeek ? D.last.rows : D.rank.concat(D.rankNext);
      const csv = 'rank,name,address,points,prize_ct\n' + rows.map((r: any) => [r.rank, '"' + String(r.name).replace(/"/g, '""') + '"', r.addr, r.pts, r.prize ?? ''].join(',')).join('\n');
      const name = 'cojam-week-' + (lastWeek ? D.last.n : D.week.n) + '-ranking.csv';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(name + ' downloaded.');
    },
    more: () => { if (CONFIG.mock) toast('Ranks 13 to 50 load here.'); else setMore(true); },
    reset: (arg) => {
      const [wallet, name] = (arg || '|').split('|');
      confirm({ title: 'Reset the display name “' + name + '”?', body: '<p>The player sees their short address until they save a new name. Points, rank and prizes do not change.</p>', placeholder: 'What is wrong with the name?', action: 'Reset the name', done: 'Name reset. The short address is shown.',
        run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/players/' + wallet + '/reset-name', { body: { reason: why } }); void inval(); } });
    },
    run: () => runSheet(false), retry: () => runSheet(true), go: (s) => go(s || ''),
  });
  // earlier weeks select
  const onSel = (e: Event) => { const t = e.target as HTMLSelectElement; if (!t.matches('[data-week]') || !t.value || CONFIG.mock) return; go('last'); setTimeout(() => { const u = new URLSearchParams(location.search); u.set('week', t.value); history.replaceState(null, '', '?' + u); void q.refetch(); }, 0); };
  if (typeof document !== 'undefined') { document.removeEventListener('change', (window as any).__cjWeekSel); (window as any).__cjWeekSel = onSel; document.addEventListener('change', onSel); }

  return <Shell page="ranking" title="Ranking and airdrop" sub="Weeks run Monday 09:00 KST to Monday 09:00 KST" states={['last', 'ready', 'waiting', 'sending', 'failed', 'lowreserve', 'capped', 'empty', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}

/** the design data as this screen's view model */
function mockVM(A: any) {
  return {
    split: A.split, rules: { completion: 100, hit: 50 }, predict: A.contracts.prediction, now: A.now, users: A.users,
    week: { ...A.week, n: 48, sends: 'Wed 2 Dec, 21:00 KST (12:00 UTC), by itself', cap: 10000 }, rank: A.rank, rankNext: A.rankNext, reserveCt: A.reserves[0].bal,
    last: { ...A.last, rows: A.last.rows, skipped: A.last.skipped, air: 'Sent' },
  };
}
const EMPTY: any = { split: [], rules: {}, predict: '', now: { weekRange: '', weekEndsIn: 0 }, week: { n: '', per: 1, cap: 10000, pool: 0, playersRanked: 0, settled: 0, questions: 0, sends: '' }, rank: [], rankNext: [], reserveCt: null, last: { n: '', rows: [], pool: 0, air: 'Not due', backlog: { open: 0, total: 0, settled: 0 } }, earlier: [] };
