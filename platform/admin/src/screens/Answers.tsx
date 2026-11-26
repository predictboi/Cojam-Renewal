// AD4 Answers, ported from platform/design/admin/pages/answers.js. States (mock): correct | after | sign | compensate |
// compensated | void | late | rerun | waiting | corrected | empty | loading | error. Also ?q= and ?tab= (both modes).
// Live: GET /admin/v1/answers?status=all (last 14 days) and the audit log; writes: rerun, correct inside the window
// (operator key), corrected outcome after the window (unsigned setCorrectedOutcome for the owner wallet, then the
// worker pays compensation), void.
import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, tag, ic, esc, cd, dur, tx, addr, btn, kv, note, table, link, empty, log, meter, T } from '../lib/x';
import { confirm, toast, go } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate, mockD } from '../api/hooks';
import { usePageCtx, useActs, nowS } from '../page';
import { Shell } from '../Shell';
import { ownerFlow } from '../wallet/flow';
import { auditRows, qid } from '../live';

const ansOf = (a: any, d: string | null) => (a.state === 'Cancelled' && !d ? '<span class="dim">Voided</span>' : d ? '<span class="pk" data-d="' + d + '">' + esc(a[d]) + '</span>' : '<span class="dim">Not set</span>');

function prep(D: any, qs: URLSearchParams, fixOpen: string | null) {
  const BY: Record<string, string> = { after: 'Q-1124-4', sign: 'Q-1124-4', compensate: 'Q-1124-4', compensated: 'Q-1124-4', late: 'Q-1124-1', rerun: 'Q-1124-1', waiting: 'Q-1125-3', corrected: 'Q-1124-2' };
  const selId = qs.get('q') || (CONFIG.mock ? BY[X.state] || 'Q-1125-1' : D.answers[0]?.id);
  let sel = D.answers.find((a: any) => a.id === selId) || D.answers[0] || null;
  const done = is('compensated');
  const tab = is('empty') ? 'near' : qs.get('tab') || 'all';
  if (done && sel) sel = Object.assign({}, sel, { state: 'Corrected', ai: 'r', hits: 1844, corrected: { from: 'l', by: 'ops@cojam.app', at: 'Today 14:41', why: sel.fix.note, inside: false } });
  if (!CONFIG.mock && sel && fixOpen === sel.id && !sel.fix) sel = Object.assign({}, sel, { fix: D.fixFor(sel) });
  return { sel, tab, done };
}

function render(D: any, qs: URLSearchParams, fixOpen: string | null): string {
  begin();
  const { sel, tab, done } = prep(D, qs, fixOpen);
  const list = () => D.answers.map((a: any) => (sel && a.id === sel.id ? sel : a));
  const HP = D.hitPoints ?? 50;

  function tbl() {
    const all = list(), counts: Record<string, number> = { all: all.length, waiting: 0, set: 0, corrected: 0, late: 0, near: 0 };
    all.forEach((a: any) => { const t = a.state === 'Corrected' ? 'corrected' : a.tab; if (counts[t] != null && t !== 'all') counts[t]++; if (a.near) counts.near++; });
    const rows = tab === 'all' ? all : tab === 'near' ? all.filter((a: any) => a.near) : all.filter((a: any) => (a.state === 'Corrected' ? 'corrected' : a.tab) === tab);
    const closest = all.filter((a: any) => a.deadlineIn).sort((a: any, b: any) => a.deadlineIn - b.deadlineIn)[0];
    const seg = '<div class="seg" role="group" aria-label="Filter answers">' + [['all', 'All'], ['waiting', 'Waiting'], ['set', 'Set'], ['corrected', 'Corrected'], ['late', 'Late'], ['near', 'Near deadline']].map((t) => '<a href="?tab=' + t[0] + '" aria-current="' + (t[0] === tab ? 'page' : 'false') + '">' + t[1] + ' <span class="c">' + counts[t[0]] + '</span></a>').join('') + '</div>';
    return '<section class="sec"><div class="sec-head">' + seg + '<span class="sec-note">The last ' + (CONFIG.mock ? '2 sets' : '14 days') + '.</span><span class="sec-end"><label class="search" style="width:240px"><span class="sr">Search answers</span>' + ic('search') + '<input class="inp" type="search" placeholder="Search id or text" data-asearch></label></span></div>' +
      table<any>({
        caption: 'Answers', rows, loading: is('loading'), error: is('error'), what: 'The answer list', cls: 'tight', sort: [4, 'desc'],
        selected: (r) => !!sel && r.id === sel.id,
        empty: empty('No answer is near its deadline', 'A question is cancelled 48 hours after its set closes if it still has no answer. Anything with less than 8 hours left shows here.' + (CONFIG.mock ? ' The closest now is Q-1124-1, with 18 hours left.' : closest ? ' The closest now is ' + closest.id + ', with ' + dur(closest.deadlineIn) + ' left.' : ''), link('Show all answers', '?tab=all')),
        cols: [
          { h: 'Question', val: (r) => r.sortKey ?? r.id, cell: (r) => '<a class="t1" style="color:inherit" href="?q=' + r.id + '">' + esc(r.title) + '</a><span class="t2">' + r.id + ' · set of ' + r.set + ' · closed ' + r.closed + '</span>' },
          { h: 'AI answer', cell: (r) => ansOf(r, r.ai) + (r.corrected ? '<span class="t2">was ' + esc(r[r.corrected.from]) + '</span>' : '') },
          { h: 'Confidence', num: 1, val: (r) => r.conf || 0, cell: (r) => (r.conf ? r.conf.toFixed(2) + (r.conf < 0.9 && r.state !== 'Corrected' ? ' ' + tag('Low', 'warn') : '') : '') },
          { h: 'Set at', cell: (r) => r.setAt || (r.late ? '<span style="color:var(--warn);font-weight:700">' + r.late + '</span>' : r.due ? '<span class="dim">Due ' + r.due + '</span>' : '') },
          { h: 'Correction window', val: (r) => (r.winIn ? 1e6 : 0), cell: (r) => (r.winIn ? '<b>Ends in ' + cd(r.winIn) + '</b><span class="t2">Nobody is paid yet</span>' : r.winEnds ? '<span class="dim">Ended ' + r.winEnds + '</span>' : '') },
          { h: 'Hits', num: 1, val: (r) => r.hits, cell: (r) => (r.hits ? n(r.hits) + '<span class="t2">' + (r.paid ? 'paid' : 'pending') + '</span>' : '') },
          { h: 'Deadline', cell: (r) => (r.state === 'Waiting' || r.state === 'Late' ? r.deadline + (r.deadlineIn ? '<span class="t2">in ' + cd(r.deadlineIn) + '</span>' : '') : '<span class="dim">' + r.deadline + '</span>') },
          { h: 'State', cell: (r) => tag(r.state) + (r.flag && r.state !== 'Corrected' ? ' ' + tag('Check', 'warn') : '') },
        ],
      }) + '</section>';
  }

  function evidence(a: any) {
    const p = a.picks, pc = p[0] + p[1] ? (p[0] / (p[0] + p[1])) * 100 : 50;
    const ev = a.ev.length ? '<table class="tbl tight vtop"><caption class="sr">Evidence</caption><thead><tr><th scope="col">Source</th><th scope="col">Quoted text</th><th scope="col">Captured value</th><th scope="col">Fetched</th></tr></thead><tbody>' + a.ev.map((e: any) => '<tr><td><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.src) + '</a></td><td><span class="mono">' + esc(e.quote) + '</span></td><td><b>' + esc(e.value) + '</b></td><td class="nowrap">' + e.at + '</td></tr>').join('') + '</tbody></table>' :
      '<p class="dim">' + (a.err ? 'No evidence was accepted. ' + esc(a.err) : a.state === 'Cancelled' ? 'No answer: the question was voided.' : 'The AI has not run yet. It runs at the due time and fetches the source then.') + '</p>';
    return '<h3 class="sub">Evidence</h3>' + ev + '<h3 class="sub">Record</h3>' + kv([
      ['Answer rule', esc(a.rule)],
      ['AI answer', ansOf(a, a.ai) + (a.conf ? ' <span class="dim">confidence ' + a.conf.toFixed(2) + (a.ev.length > 1 ? ', ' + a.ev.length + ' sources agree' : ', 1 source') + '</span>' : '')],
      ['Set on chain', a.tx ? a.setAt + ' KST by the operator key ' + tx(a.tx) : a.setAt ? a.setAt + ' KST' : 'Not yet'],
      ['Picks', '<div class="splitcell" style="max-width:320px"><span><span class="pk" data-d="l">' + esc(a.l) + ' ' + n(p[0]) + '</span><span class="pk" data-d="r">' + n(p[1]) + ' ' + esc(a.r) + '</span></span><div class="splitbar" role="img" aria-label="' + n(p[0]) + ' picked ' + esc(a.l) + ', ' + n(p[1]) + ' picked ' + esc(a.r) + '"><i style="width:' + pc + '%"></i><u></u></div></div>'],
      ['Hits', a.hits ? n(a.hits) + ' × ' + HP + ' P = ' + n(a.hits * HP) + ' P, ' + (a.paid ? 'paid ' + a.winEnds + ' KST' : 'pays ' + a.winEnds + ' KST when the window ends') : 'None'],
      ['Deadline', a.deadline + ' KST (set close plus 48 hours)'],
    ]);
  }

  function impact(a: any) {
    const f = a.fix, right = f.right, wrong = right === 'l' ? 'r' : 'l', pay = f.players * HP, inv = f.invited * HP * (D.refPct ?? 10) / 100;
    const invN = f.inviters ?? (CONFIG.mock ? 214 : null);
    return '<table class="tbl tight"><caption class="sr">What the correction pays</caption><thead><tr><th scope="col">Who</th><th scope="col" class="num">Players</th><th scope="col" class="num">Points</th></tr></thead><tbody>' +
      '<tr><td><b>Picked ' + esc(a[right]) + '</b><span class="t2">Get the hit they were owed, +' + HP + ' P each</span></td><td class="num">' + n(f.players) + '</td><td class="num">+' + n(pay) + ' P</td></tr>' +
      '<tr><td><b>Their inviters</b><span class="t2">' + (D.refPct ?? 10) + '% on top, for the ' + n(f.invited) + ' of those players who were invited</span></td><td class="num">' + (invN == null ? '<span class="dim">up to ' + n(f.invited) + '</span>' : n(invN)) + '</td><td class="num">+' + n(CONFIG.mock ? f.invited * 5 : inv) + ' P</td></tr>' +
      '<tr><td><b>Picked ' + esc(a[wrong]) + '</b><span class="t2">Were paid on the wrong answer. They keep their points: no balance is ever lowered</span></td><td class="num">' + n(f.wrongPaid) + '</td><td class="num">0 P</td></tr>' +
      '</tbody><tfoot><tr><td>New points to mint</td><td class="num">' + (invN == null ? n(f.players) + '+' : n(f.players + invN)) + '</td><td class="num">+' + n(pay + (CONFIG.mock ? f.invited * 5 : inv)) + ' P</td></tr></tfoot></table>' +
      '<p class="hint" style="margin-top:8px"><b style="color:var(--ink)">Counts in the week ' + f.week + ' ranking' + (f.weekSent ? ' only if it is not paid out' : '') + '.</b> The question belongs to week ' + f.week + (f.weekSent ? ', which was already paid out, so the ' + HP + ' P count in the current week instead.' : ' and that airdrop has not been sent, so the ' + HP + ' P land there as hit points. Had week ' + f.week + ' already been paid out, they would count in the current week instead.') + (CONFIG.mock ? ' 6 of the current top 10 picked ' + esc(a[right]) + '.' : '') + ' Worth ' + n((pay + (CONFIG.mock ? f.invited * 5 : inv)) / (D.rate ?? 1000), 2) + ' CT at ' + n(D.rate ?? 1000) + ' P = 1 CT.</p>';
  }

  function tool(a: any) {
    const st = a.state;
    if (is('compensate')) return '<h3 class="sub">Compensation is running</h3><ol class="steps"><li data-s="done"><span class="nb" data-k="ink">' + ic('check', 14) + '</span><div><p class="t1">Corrected answer signed by the owner wallet</p><p class="t2">Today 14:38 KST ' + tx(mockD().TX('fix-1124-4')) + '</p></div></li><li data-s="now"><span class="nb">2</span><div><p class="t1">Operator pays the compensation</p><p class="t2">Batch 13 of 21. 612 of 1,041 players paid, 30,600 P and 1,090 P invite bonus so far.</p>' + meter(612, 1041, { left: '612 of 1,041', right: 'about 40 s left' }) + '</div><span class="spin"></span></li><li data-s="wait"><span class="nb" data-k="off">3</span><div><p class="t1">Players see Corrected in Results</p><p class="t2">With the date, and a toast: +50P paid.</p></div></li></ol><p class="hint">You can leave this page. The batches continue on the worker and every transaction is written to the log below. If a batch fails, nothing in it is paid and a Retry button appears here.</p>';
    if (a.compensating) return '<h3 class="sub">Compensation is waiting</h3>' + note('sky', '<b>The owner correction was built ' + esc(a.compensating.at) + '.</b> The worker pays the compensation batches as soon as the owner wallet\'s setCorrectedOutcome is on chain (it waits up to 7 days). Request ' + a.compensating.id + ', ' + esc(a.compensating.status) + '.') + '<div class="acts" style="margin-top:12px">' + btn('Sign again with the owner wallet', { act: 'sign', write: 1, disabled: X.role !== 'owner' }) + '</div>';
    if (st === 'Corrected') { const c = a.corrected; return '<h3 class="sub">Correction record</h3>' + note('up', '<b>Corrected ' + (c.inside ? 'inside the window' : 'after the window, with compensation') + '.</b> ' + (c.inside ? 'Nobody had been paid, so the pending hits simply changed.' : CONFIG.mock ? '1,041 players were paid +50 P each (52,050 P) and their inviters 1,860 P. The 803 players paid for No kept their points. The points count in the week 48 ranking.' : 'The players who were right were paid their hit points by the worker. Nobody lost points.')) + '<div style="height:12px"></div>' + kv([['From', ansOf(a, c.from)], ['To', ansOf(a, a.ai)], ['By', esc(c.by) + ', ' + c.at + ' KST'], ['Signed with', c.inside ? 'Operator key' : 'Owner wallet (answer), operator key (compensation)'], ['Reason', esc(c.why)]]); }
    if (st === 'Cancelled') return '<h3 class="sub">Voided</h3>' + kv([['By', a.voided ? esc(a.voided.by) + ', ' + a.voided.at + ' KST' : 'The worker'], ['Reason', esc(a.voided?.why || 'Both answer runs found the question could not be settled, or the 48 hour deadline passed.')], ['Effect', "No hit points. Picks on it counted toward the day's 5."]]);
    if (st === 'Waiting') return '<h3 class="sub">Waiting for the answer</h3><div class="fig"><span class="fig-l">The AI runs in</span><span class="fig-v">' + cd(a.dueIn) + '</span><span class="fig-s">Due ' + a.due + ' KST. Nothing to do until then.</span></div>' + '<div class="acts" style="margin-top:16px">' + (!CONFIG.mock && !a.dueIn ? btn(a.rerunning ? 'Running' : 'Run AI now', { act: 'rerun', write: 1, disabled: !!a.rerunning }) : '') + btn('Void this question', { link: 1, danger: 1, act: 'void', write: 1 }) + '</div>';
    if (st === 'Late') return '<h3 class="sub">The answer is late</h3>' + (is('rerun') || a.rerunning ? note('sky', '<b>The AI is running again.</b> ' + (CONFIG.mock ? 'Fetching indexes.nikkei.co.jp, attempt 5. ' : 'Request ' + a.rerunning + ' is with the worker. ') + 'This usually takes under a minute.', '<span class="spin"></span>') : note('warn', '<b>' + a.late + '.</b> ' + esc(a.err || ''))) +
      '<div class="fig" style="margin-top:16px"><span class="fig-l">Cancelled automatically in</span><span class="fig-v">' + cd(a.deadlineIn) + '</span><span class="fig-s">At ' + a.deadline + ' KST, 48 hours after the set closed. Players then see Cancelled and no hit points are paid.</span></div>' +
      '<div class="acts" style="margin-top:16px">' + btn(is('rerun') || a.rerunning ? 'Running' : 'Run AI again', { primary: 1, act: 'rerun', write: 1, disabled: is('rerun') || !!a.rerunning }) + btn('Set the answer by hand', { act: 'correct', write: 1, disabled: !CONFIG.mock, title: CONFIG.mock ? '' : 'The API sets answers through the AI runs only: run it again, or void the question' }) + btn('Void this question', { link: 1, danger: 1, act: 'void', write: 1 }) + '</div>' +
      '<p class="hint" style="margin-top:8px">Setting by hand uses the operator key and starts the normal 6 hour correction window.</p>';
    if (a.winIn) return '<h3 class="sub">Correction window is open</h3><div class="fig"><span class="fig-l">Hit points are paid in</span><span class="fig-v l">' + cd(a.winIn) + '</span><span class="fig-s">At ' + a.winEnds + ' KST. Until then nobody is paid, so a correction only changes the pending hits.</span></div>' +
      '<div class="acts" style="margin-top:16px">' + btn('Correct this answer', { act: 'correct', write: 1 }) + btn('Void this question', { link: 1, danger: 1, act: 'void', write: 1 }) + '</div>' +
      '<p class="hint" style="margin-top:8px">Inside the window the operator key replaces the answer. No owner signature, no compensation.</p>';
    if (!a.fix) return '<h3 class="sub">Paid</h3><p class="dim">The window ended ' + a.winEnds + ' KST and ' + n(a.hits) + ' hits were paid. If the answer turns out wrong, set a corrected outcome: the players who were right are paid, nobody loses points.</p><div class="acts" style="margin-top:12px">' + btn('Set a corrected outcome', { act: 'fixopen', arg: a.id, write: 1 }) + '</div>';
    return '<h3 class="sub">Set a corrected outcome and compensate</h3>' + note('warn', '<b>The window ended ' + a.winEnds + ' KST and ' + n(a.hits) + ' hits were paid for ' + esc(a[a.ai]) + '.</b> A correction now pays the players who were right. It takes nothing back.') +
      '<div class="stack" style="margin-top:16px;gap:16px"><fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;font-size:13px;padding:0;margin-bottom:6px">The right answer</legend><div class="seg" role="radiogroup"><button type="button" role="radio" aria-checked="' + (a.fix.right === 'l') + '" aria-pressed="' + (a.fix.right === 'l') + '"' + (a.ai === 'l' ? ' disabled' : '') + '>' + ansOf(a, 'l') + '</button><button type="button" role="radio" aria-checked="' + (a.fix.right === 'r') + '" aria-pressed="' + (a.fix.right === 'r') + '"' + (a.ai === 'r' && !CONFIG.mock ? ' disabled' : '') + '>' + ansOf(a, 'r') + '</button></div></fieldset>' +
      '<div class="fl"><label for="fixwhy">Reason <span class="cnt">Required, shown in the audit log</span></label><textarea class="inp" id="fixwhy" rows="2">' + esc(a.fix.note) + '</textarea></div>' + impact(a) +
      '<div class="acts">' + btn('Review and sign', { primary: 1, act: 'sign', write: 1, disabled: !CONFIG.mock && X.role !== 'owner', title: !CONFIG.mock && X.role !== 'owner' ? 'After the window only the owner can record a corrected answer' : '' }) + btn('Void instead', { link: 1, danger: 1, act: 'void', write: 1 }) + '</div></div>';
  }

  function detail(a: any) {
    return '<section class="sec"><div class="sec-head"><h2>' + a.id + '</h2>' + tag(a.state) + (a.flag && a.state !== 'Corrected' ? tag('Low confidence', 'warn') : '') + '<span class="sec-note">' + esc(a.title) + '</span></div><div class="cols cols-7-5 split"><div>' + evidence(a) + '</div><div>' + tool(a) + '</div></div></section>';
  }

  let lg = D.answerAudit;
  if (done) lg = [{ t: 'Thu 14:41:52', who: 'Compensation', lv: 'info', msg: 'Q-1124-4: paid 1,041 players 52,050 P and 214 inviters 1,860 P in 21 batches.', tx: mockD().TX('comp-1124-4') }, { t: 'Thu 14:38:20', who: 'Owner wallet', lv: 'info', msg: 'Corrected Q-1124-4 from No to Yes after the window. Built by ops@cojam.app. Reason: ' + sel.fix.note, tx: mockD().TX('fix-1124-4') }].concat(lg);
  return tbl() + (is('loading', 'error', 'empty') || !sel ? '' : detail(sel) + '<section class="sec"><div class="sec-head"><h2>Audit log</h2><span class="sec-note">Every answer set, correction, void and payment, with who did it</span></div>' + log(lg) + '</section>');
}

/* ---------- live ---------- */
async function liveAnswers() {
  const [ar, aud, pr, reqs] = await Promise.all([api('/admin/v1/answers?status=all'), api('/admin/v1/audit?limit=200'), api('/admin/v1/params').catch(() => null), api('/admin/v1/operator-requests').catch(() => ({ requests: [] }))]);
  const now = nowS();
  const p = pr?.current;
  const entries: any[] = aud.entries || [];
  const atOf = (e: any) => Math.floor(new Date(e.created_at).getTime() / 1000);
  const OUT = (o: number | null) => (o === 1 ? 'l' : o === 2 ? 'r' : null);
  const answers = (ar.answers || []).map((m: any) => {
    const id = qid(m.dayId, m.slot), closes = m.closesAt ?? (m.dayId + 1) * 86400, deadline = closes + 48 * 3600;
    const lastRuns = (m.runs || []).slice(-3);
    const conf = lastRuns.reduce((x: number | null, r: any) => (r.confidence == null ? x : x == null ? r.confidence : Math.min(x, r.confidence)), null);
    const ev = lastRuns.flatMap((r: any) => (r.evidence || []).map((e: any) => ({ src: String(e.url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Source', url: e.url, quote: e.quote, value: r.outcome === 'A' ? m.left : r.outcome === 'B' ? m.right : r.outcome, at: e.observedAt ? T.wd(e.observedAt) + ' ' + T.hms(e.observedAt) : T.wd(r.at) + ' ' + T.hms(r.at) })));
    const voided = m.outcome === 3 || m.status === 'voided';
    const finalO = m.correctedOutcome || m.outcome;
    const corrAudit = entries.find((e) => e.target === String(m.marketId) && /^answer\.correct/.test(e.action));
    const voidAudit = entries.find((e) => e.target === String(m.marketId) && e.action === 'question.void');
    const reqOf = (kind: string) => (reqs.requests || []).find((r: any) => r.target === String(m.marketId) && r.kind === kind && (r.status === 'queued' || r.status === 'running' || r.status === 'waiting'));
    const late = !m.outcome && m.resolvesAt < now - 3600;
    const state = voided ? 'Cancelled' : m.status === 'corrected' || m.correctedOutcome ? 'Corrected' : m.outcome ? 'Answer set' : late ? 'Late' : 'Waiting';
    const winIn = m.correctionWindowLeft || 0;
    const pickR = m.picks.right, pickL = m.picks.left;
    const hits = finalO === 1 ? pickL : finalO === 2 ? pickR : 0;
    const a: any = {
      id, marketId: m.marketId, sortKey: m.marketId, set: T.dd(m.dayId * 86400), title: m.title, l: m.left || 'No', r: m.right || 'Yes', picks: [pickL, pickR], invited: m.invited, closed: T.wd(closes) + ' ' + T.hm(closes),
      ai: voided ? null : OUT(finalO), conf, setAt: m.resolvedAt ? T.wd(m.resolvedAt) + ' ' + T.hm(m.resolvedAt) : null, winEnds: m.settlesAt ? T.rel(m.settlesAt, now) : null, winIn,
      due: T.rel(m.resolvesAt, now), dueIn: Math.max(0, m.resolvesAt - now), hits, paid: !!m.settlesAt && m.settlesAt <= now, deadline: T.wd(deadline) + ' ' + T.hm(deadline), deadlineIn: !m.outcome ? Math.max(0, deadline - now) : 0,
      near: !m.outcome && deadline - now < 8 * 3600, state, tab: state === 'Waiting' ? 'waiting' : state === 'Late' ? 'late' : state === 'Answer set' ? 'set' : 'all',
      rule: m.rule || m.criteria || '', ev, tx: m.outcomeTx, late: late ? dur(now - m.resolvesAt).replace(/ \d+s$/, '') + ' late' : '', err: late ? (lastRuns.length ? 'The answer runs did not agree with enough confidence. Last run: ' + (lastRuns[lastRuns.length - 1].reasoning || 'no reason given').slice(0, 300) : 'No answer run has finished yet.') : '',
      flag: conf != null && conf < 0.9 ? 'Low confidence' : '', rerunning: reqOf('resolve_rerun')?.id || null,
      compensating: !m.correctedOutcome && reqOf('compensate') ? { id: reqOf('compensate').id, status: reqOf('compensate').status, at: T.rel(Math.floor(new Date(reqOf('compensate').created_at).getTime() / 1000), now) } : null,
      week: Math.floor((m.dayId + 3) / 7),
    };
    if (state === 'Corrected') a.corrected = { from: m.correctedOutcome ? OUT(m.outcome) : OUT(m.outcome === 1 ? 2 : 1), by: corrAudit?.actor || 'The worker', at: corrAudit ? T.rel(atOf(corrAudit), now) : '', why: corrAudit?.payload?.reason || 'Corrected by the answer re-check', inside: !m.correctedOutcome };
    if (voided) a.voided = voidAudit ? { by: voidAudit.actor, at: T.rel(atOf(voidAudit), now), why: voidAudit.payload?.reason || '' } : null;
    return a;
  });
  const marketIds = new Set(answers.map((a: any) => String(a.marketId)));
  const answerAudit = auditRows(entries.filter((e) => marketIds.has(String(e.target)) && /^(answer|question\.void|owner_tx\.answer)/.test(e.action)).slice(0, 30), now);
  const curWeek = Math.floor((Math.floor(now / 86400) + 3) / 7);
  // a past week counts as paid out once its airdrop was sent (the worker freezes it then)
  const D_sent = (w: number) => w < curWeek - 1 || (w === curWeek - 1 && now > (w * 7 - 3 + 7) * 86400 + 60 * 3600);
  return {
    answers, answerAudit, owner: pr?.owner, settleHours: p ? +(p.settleDelay / 3600).toFixed(1) : 6, hitPoints: p?.hitPoints ?? 50, refPct: (p?.referralBps ?? 1000) / 100, rate: p?.pointsPerCT ?? 1000,
    fixFor: (a: any) => { const right = a.ai === 'l' ? 'r' : 'l'; return { right, players: right === 'l' ? a.picks[0] : a.picks[1], invited: right === 'l' ? a.invited.left : a.invited.right, inviters: null, wrongPaid: a.hits, week: a.week, weekSent: a.week < curWeek && D_sent(a.week), note: '' }; },
  };
}

export default function Answers() {
  const { state, qs, net } = usePageCtx('answers');
  const inval = useInvalidate();
  const page = usePageData(['answers'], liveAnswers, { refetchInterval: 30_000 });
  const { loading, error, updatedAt, q } = page;
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : '';
  const D = page.D || EMPTY;
  const [fixOpen, setFixOpen] = useState<string | null>(null);
  const qsKey = qs.toString();
  const html = useMemo(() => render(D, qs, fixOpen), [D, qsKey, fixOpen, X.role, X.env]);
  const { sel } = prep(D, qs, fixOpen);
  const chainId = net?.chainId || 8217;

  function correctSheet() {
    const a = sel, other = a.ai === 'l' ? 'r' : 'l';
    confirm({ title: (a.ai ? 'Correct ' : 'Set ') + a.id + (a.ai ? ' inside the window?' : ' by hand?'), body: '<p>' + esc(a.title) + '</p>' + kv(a.ai ? [['AI answer', ansOf(a, a.ai)], ['Corrected to', ansOf(a, other)], ['Pending hits', n(a.picks[a.ai === 'l' ? 0 : 1]) + ' change to ' + n(a.picks[other === 'l' ? 0 : 1])], ['Paid so far', 'Nobody. The window ends in ' + dur(a.winIn || 0)]] : [['Answer', '<div class="seg" role="radiogroup"><button type="button" role="radio" aria-pressed="true">' + ansOf(a, 'l') + '</button><button type="button" role="radio" aria-pressed="false">' + ansOf(a, 'r') + '</button></div>'], ['Then', 'The 6 hour correction window starts now']]),
      placeholder: 'Which source shows the right answer?', reasonErr: 'Give a reason for the correction.', signer: 'Sent with the operator key through the worker. No owner signature.', action: a.ai ? 'Apply correction' : 'Set the answer', done: a.id + (a.ai ? ' corrected to ' + a[other] + '. Pending hits changed.' : ' set. The correction window is open.'),
      run: CONFIG.mock ? undefined : async (why) => { const r = await api('/admin/v1/answers/' + a.marketId + '/correct', { body: { outcome: other === 'l' ? 1 : 2, reason: why } }); void inval(); return a.id + ' correction to ' + a[other] + ' is queued (request ' + r.requestId + '). Pending hits change when it lands.'; } });
  }
  function signSheet() {
    const a = sel;
    if (!CONFIG.mock) {
      const right = a.fix.right;
      const why = ((document.getElementById('fixwhy') as HTMLTextAreaElement)?.value || '').trim();
      if (why.length < 8) { (document.getElementById('fixwhy') as HTMLElement)?.focus(); toast('Give a reason for the correction.'); return; }
      ownerFlow({
        title: 'Correct ' + a.id + ' and pay compensation', owner: D.owner, chainId,
        body: '<p>' + esc(a.title) + '</p>' + kv([['Was', ansOf(a, a.ai)], ['Corrected to', ansOf(a, right)], ['Counts in', 'Week ' + a.fix.week + ' ranking, unless its airdrop is already sent'], ['Reason', esc(why)]]),
        signTitle: 'Connect the owner wallet and sign the corrected answer', signText: 'After the window only the owner can change an answer. It signs in this browser and pays the network fee.',
        later: [['The operator pays the compensation', 'The worker sends compensate batches with the operator key once the corrected answer is on chain. The invite bonus is paid in the same transactions.']],
        build: async () => (await api('/admin/v1/answers/' + a.marketId + '/correct', { body: { outcome: right === 'l' ? 1 : 2, reason: why } })).unsignedTx,
        record: { action: 'answer.setCorrectedOutcome', target: String(a.marketId) },
        sentText: () => '<b>Corrected answer recorded on chain.</b> The worker now pays the players who were right.',
        onDone: () => { setFixOpen(null); void inval(); },
      });
      return;
    }
    import('../lib/ui').then(({ sheet }) => sheet({ title: 'Correct ' + a.id + ' and pay compensation', wide: 1, body: '<p>' + esc(a.title) + '</p>' + kv([['Was', ansOf(a, a.ai)], ['Corrected to', ansOf(a, a.fix.right)], ['Counts in', 'Week ' + a.fix.week + " ranking: the question's week, its airdrop is not sent yet"], ['Reason', esc(a.fix.note)]]) + renderImpact(D, a) +
      '<ol class="steps"><li data-s="now"><span class="nb">1</span><div><p class="t1">Connect the owner wallet and sign the corrected answer</p><p class="t2">After the window only the owner can change an answer: ' + addr(mockD().owner, { full: 1, link: false }) + '. It signs in this browser and pays the network fee.</p></div></li><li data-s="wait"><span class="nb" data-k="off">2</span><div><p class="t1">The operator pays the compensation</p><p class="t2">21 batches of 50 players, sent by the worker with the operator key. The invite bonus is paid in the same transactions.</p></div></li></ol>',
      cancel: 'Back', action: '<button type="button" class="btn btn-primary" data-act="go" data-arg="compensate">Connect the owner wallet</button>' }));
  }
  function voidSheet() {
    const a = sel;
    confirm({ title: 'Void ' + a.id + '?', body: '<p>' + esc(a.title) + '</p>' + kv([['Hit points', a.paid ? n(a.hits) + ' hits already paid stay with the players' : 'None will be paid'], ['Players see', 'Cancelled, in Results'], ["The day's 100 P", 'Not affected']]) + note('warn', '<b>This cannot be undone.</b> Use it when the question itself was broken, not when the AI read the source wrong: for that, correct the answer.'),
      placeholder: 'What made the question impossible to settle?', signer: 'Sent with the operator key. No owner signature.', danger: 1, action: 'Void the question', cancel: 'Keep it', done: a.id + ' voided.',
      run: CONFIG.mock ? undefined : async (why) => { const r = await api('/admin/v1/questions/' + a.marketId + '/void', { body: { reason: why } }); void inval(); return a.id + ' void is queued (request ' + r.requestId + ').'; } });
  }
  useActs({
    correct: correctSheet, sign: signSheet, void: voidSheet, go: (s) => go(s || ''),
    rerun: async () => {
      if (CONFIG.mock) { go('rerun'); return; }
      confirm({ title: 'Run the AI again on ' + sel.id + '?', reason: false, body: '<p>Two fresh answer runs read the source again. If they agree with confidence 0.90 or more the answer is set and the 6 hour window starts.</p>', action: 'Run AI again', done: 'Running.', run: async () => { const r = await api('/admin/v1/answers/' + sel.marketId + '/rerun', { body: { reason: 'admin rerun' } }); void inval(); return 'The AI runs again (request ' + r.requestId + ').'; } });
    },
    fixopen: (id) => { if (CONFIG.mock) toast('Choose the right answer, give a reason, and the impact table opens here.'); else setFixOpen(id || null); },
    toast: (m) => toast(m || ''),
  });
  useEffect(() => {
    const on = (e: Event) => { const t = e.target as HTMLInputElement; if (!t.matches('[data-asearch]')) return; const v = t.value.toLowerCase(); document.querySelectorAll<HTMLElement>('#view .tbl tbody tr').forEach((tr) => { tr.hidden = !!v && !tr.textContent!.toLowerCase().includes(v); }); };
    document.addEventListener('input', on); return () => document.removeEventListener('input', on);
  }, []);
  useEffect(() => { if (!CONFIG.mock || document.getElementById('sheet')) return; if (is('correct')) correctSheet(); if (is('sign')) signSheet(); if (is('void')) voidSheet(); }, [state]);

  return <Shell page="answers" title="Answers" sub={'Set by AI. Hit points are paid ' + (D.settleHours ?? 6) + ' hours after an answer is set.'} states={['correct', 'after', 'sign', 'compensate', 'compensated', 'void', 'late', 'rerun', 'waiting', 'corrected', 'empty', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}

/** the impact table on its own, for the mock sign sheet */
function renderImpact(D: any, a: any) {
  const f = a.fix, right = f.right, wrong = right === 'l' ? 'r' : 'l', pay = f.players * 50, inv = f.invited * 5;
  void D;
  return '<table class="tbl tight"><caption class="sr">What the correction pays</caption><thead><tr><th scope="col">Who</th><th scope="col" class="num">Players</th><th scope="col" class="num">Points</th></tr></thead><tbody>' +
    '<tr><td><b>Picked ' + esc(a[right]) + '</b><span class="t2">Get the hit they were owed, +50 P each</span></td><td class="num">' + n(f.players) + '</td><td class="num">+' + n(pay) + ' P</td></tr>' +
    '<tr><td><b>Their inviters</b><span class="t2">10% on top, for the ' + n(f.invited) + ' of those players who were invited</span></td><td class="num">214</td><td class="num">+' + n(inv) + ' P</td></tr>' +
    '<tr><td><b>Picked ' + esc(a[wrong]) + '</b><span class="t2">Were paid on the wrong answer. They keep their points: no balance is ever lowered</span></td><td class="num">' + n(f.wrongPaid) + '</td><td class="num">0 P</td></tr>' +
    '</tbody><tfoot><tr><td>New points to mint</td><td class="num">' + n(f.players + 214) + '</td><td class="num">+' + n(pay + inv) + ' P</td></tr></tfoot></table>' +
    '<p class="hint" style="margin-top:8px"><b style="color:var(--ink)">Counts in the week ' + f.week + ' ranking.</b> The question belongs to week ' + f.week + ' and that airdrop has not been sent, so the 50 P land there as hit points. Had week ' + f.week + ' already been paid out, they would count in the current week instead. 6 of the current top 10 picked ' + esc(a[right]) + '. Worth ' + n((pay + inv) / 1000, 2) + ' CT at 1,000 P = 1 CT.</p>';
}
const EMPTY: any = { answers: [], answerAudit: [], fixFor: () => null };
