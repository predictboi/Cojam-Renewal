// AD3 Questions, ported from platform/design/admin/pages/questions.js. States (mock): scheduled | edit | short |
// noimage | regen | swap | cancel | void | emptyqueue | loading | error. Also ?day= and ?q= (both modes).
// Live: GET /admin/v1/questions (14 days) and /admin/v1/drafts (the AI queue); writes: cancel, replace (save),
// void, image, swap with a draft, schedule a draft, discard a draft, add a question, run the drafter, and the
// question's Polymarket link for the data room (GET|POST|DELETE /admin/v1/questions/:id/outside, operator writes).
import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, tag, ic, esc, cd, btn, kv, note, table, thumb, empty, T } from '../lib/x';
import { confirm, sheet, toast, go, closeSheet, busy, unbusy, sheetError, errText } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate } from '../api/hooks';
import { usePageCtx, useActs, nowS } from '../page';
import { Shell } from '../Shell';
import { qid, CAT, STATUS, IMG_STATE } from '../live';

const LIM: Record<string, { title: number; c: number; rule: number }> = { en: { title: 70, c: 12, rule: 60 }, ko: { title: 44, c: 8, rule: 40 }, ja: { title: 44, c: 8, rule: 40 } };
const LNAME: Record<string, string> = { en: 'English', ko: 'Korean', ja: 'Japanese' };
const len = (s: string) => [...(s || '')].length;
const CATS = ['Crypto', 'Markets', 'Weather', 'Sports', 'Culture'];
const WHY = (id: string, label = 'Reason') => '<div class="fl"><label for="' + id + '">' + label + ' <span class="cnt">Required, written to the audit log</span></label><textarea class="inp" id="' + id + '" rows="2" data-why2></textarea></div>';

function pickState(D: any, qs: URLSearchParams) {
  const BY: Record<string, [string, string | null]> = CONFIG.mock
    ? { scheduled: ['1127', 'Q-1127-1'], edit: ['1127', 'Q-1127-1'], swap: ['1127', 'Q-1127-4'], cancel: ['1127', 'Q-1127-4'], short: ['1128', null], noimage: ['1129', 'Q-1129-3'], regen: ['1129', 'Q-1129-3'], void: ['1126', 'Q-1126-2'] }
    : {};
  const by = BY[X.state] || [D.todayId, D.questions.find((x: any) => x.day === D.todayId)?.id ?? null];
  const day = qs.get('day') || by[0];
  let selId = qs.get('q') || (qs.get('day') ? null : by[1]);
  const rows = D.questions.filter((x: any) => x.day === day);
  if (qs.get('day') && !selId && rows.length) selId = rows[0].id;
  const sel = selId ? D.questions.find((x: any) => x.id === selId) || null : null;
  const dayInfo = D.days.find((d: any) => d.id === day) || D.days[0];
  return { day, selId, rows, sel, dayInfo };
}

/** The linked outside market of each selected question: undefined while reading, 'error', null (none) or the record. */
type OutsideMap = Record<number, any>;

function render(D: any, qs: URLSearchParams, OUT: OutsideMap = {}): string {
  begin();
  const { day, rows, sel, dayInfo } = pickState(D, qs);
  const url = (d: string, q?: string) => '?day=' + d + (q ? '&q=' + q : '');

  function cal() {
    return '<nav class="cal" aria-label="Schedule, next 14 days">' + D.days.map((d: any) => {
      const k = d.far ? 'far' : d.n < 5 || d.img < d.n ? 'warn' : '';
      let pips = '';
      for (let i = 0; i < 5; i++) pips += '<i data-s="' + (i >= d.n ? 'none' : i >= d.img ? 'noimg' : '') + '"></i>';
      const m = d.far ? (d.n ? 'Drafting' : 'Not yet') : d.n < 5 ? 5 - d.n + ' missing' : d.img + ' images';
      return '<a href="' + (D.dayLong[d.id] ? url(d.id) : '#') + '"' + (d.id === day ? ' aria-current="true"' : '') + (k ? ' data-k="' + k + '"' : '') + ' aria-label="' + d.d + ': ' + d.n + ' of 5 questions, ' + d.img + ' with an image"><span class="d">' + (d.tag ? '<b>' + d.tag + '</b>' : d.d) + '</span><span class="n">' + d.n + '<small>/5</small></span><span class="m">' + m + '</span><span class="pips" aria-hidden="true">' + pips + '</span></a>';
    }).join('') + '</nav>' +
      '<p class="hint" style="margin-top:8px">Each bar is one of the day\'s 5 slots: filled, filled without an image (striped), or empty. The drafter runs daily at 18:00 KST and keeps the next 7 days full; later days are not expected to be filled yet. A day is written on chain at 08:30 KST and goes live at 09:00.</p>';
  }

  function dayTable() {
    const live = dayInfo.state === 'Live' || dayInfo.state === 'Closed';
    const list: any[] = rows.slice();
    if (CONFIG.mock) { if (day === '1128') list.push({ empty: true, slot: 5 }); }
    else if (!live) { for (let s = 1; s <= 5; s++) if (!rows.some((r: any) => r.slot === s)) list.push({ empty: true, slot: s }); list.sort((a, b) => a.slot - b.slot); }
    const t = table<any>({
      caption: 'Questions on ' + D.dayLong[day], rows: list, loading: is('loading'), error: is('error'), what: 'The schedule', cls: 'tight',
      selected: (r) => sel && r.id === sel.id,
      empty: empty('No questions on this day', live ? 'The day was not published.' : 'The drafter fills it at 18:00 KST. You can also add a question by hand or take one from the AI queue below.'),
      cols: [
        { h: 'Slot', w: '44px', cell: (r) => '<span class="nb"' + (r.empty ? ' data-k="off"' : '') + '>' + r.slot + '</span>' },
        { h: 'Question', cell: (r) => (r.empty ? '<span class="t1" style="color:var(--warn)">Empty slot</span><span class="t2">The drafter fills it at 18:00 today. You can also take one from the AI queue below.</span>' : '<div class="qcell">' + thumb(r.img) + '<div><a class="t1" href="' + url(day, r.id) + '" style="color:inherit">' + esc(r.en.title) + '</a><span class="t2">' + r.id + ' · ' + r.cat + '</span></div></div>') },
        { h: 'Choices', cell: (r) => (r.empty ? '' : '<span class="pk" data-d="l">' + esc(r.en.left) + '</span><br><span class="pk" data-d="r">' + esc(r.en.right) + '</span>') },
        { h: 'Answer due', cell: (r) => (r.empty ? '' : '<span class="nowrap">' + r.due + '</span>') },
        { h: 'Image', cell: (r) => (r.empty ? '' : tag(r.imgState)) },
        { h: 'By', cell: (r) => (r.empty ? '' : r.source) },
        { h: 'State', cell: (r) => (r.empty ? tag('Missing', 'warn') : tag(r.state)) },
        { h: '', sr: 'Actions', cell: (r) => '<div class="row-acts">' + (r.empty ? btn('Fill from queue', { small: 1, act: 'jump', arg: r.slot, write: 1 }) : live ? btn('Void', { link: 1, danger: 1, act: 'void', arg: r.id, write: 1, disabled: !CONFIG.mock && r.state !== 'Live' && r.state !== 'Closed' && r.state !== 'Answer set' }) : btn('Swap', { link: 1, act: 'swap', arg: r.id, write: 1 }) + btn('Cancel', { link: 1, danger: 1, act: 'cancelq', arg: r.id, write: 1 })) + '</div>' },
      ],
    });
    const closeAll = 'All five close together ' + (rows[0] ? rows[0].closes : D.closesOf?.(day) || '') + ' KST. ';
    const nt = live ? closeAll + 'A live question cannot be edited: you can replace its image or void it.' : rows.length < 5 ? 'Goes on chain ' + dayInfo.d + ' at 08:30 KST. If a slot is still empty then, the day is published with ' + rows.length + ' questions and nobody can earn the 100 P for finishing all 5.' : 'Goes on chain ' + dayInfo.d + ' at 08:30 KST. ' + closeAll + 'Until then every text and image can be changed. Nothing needs approval.';
    let shortNote = '';
    if (!is('loading', 'error')) {
      if (CONFIG.mock && day === '1128') shortNote = note('warn', '<b>Saturday has 4 of 5 questions.</b> The drafter threw out its fifth draft (its outcome would have been known before the day ends) and will try again at 18:00 KST today. D-2232 in the queue fits Saturday only.', btn('Schedule D-2232 into slot 5', { small: 1, act: 'sched', arg: 'D-2232', write: 1 })) + '<div style="height:12px"></div>';
      else if (!CONFIG.mock && !live && rows.length < 5) {
        const fit = D.queue.find((x: any) => x.targetDay === day);
        const free = [1, 2, 3, 4, 5].find((s) => !rows.some((r: any) => r.slot === s));
        shortNote = note('warn', '<b>' + D.dayLong[day].split(' ')[0] + ' has ' + rows.length + ' of 5 questions.</b> The drafter fills empty slots at 18:00 KST and again at 00:00 KST; from 22:00 KST the day\'s reserve drafts fill what is left.' + (fit ? ' ' + fit.id + ' in the queue fits this day.' : ''), fit ? btn('Schedule ' + fit.id + ' into slot ' + free, { small: 1, act: 'sched', arg: fit.id + ':' + day + ':' + free, write: 1 }) : btn('Add question', { small: 1, act: 'add', arg: day + ':' + free, write: 1 })) + '<div style="height:12px"></div>';
      }
    }
    return '<section class="sec"><div class="sec-head"><h2>' + D.dayLong[day] + '</h2>' + tag(dayInfo.state) + (rows.length < 5 ? tag(rows.length + ' of 5', 'warn') : '') + '<span class="sec-note">' + nt + '</span></div>' + shortNote + t + '</section>';
  }

  /* the front card as the app draws it, at 360 or 430 wide, scaled down */
  function card(q: any, lang: string) {
    const t = q[lang], long = lang === 'en' ? t.title.length > 44 : t.title.length > 22;
    return '<article class="qcard" lang="' + lang + '" aria-label="Card preview">' +
      (q.img && !is('regen') ? '<div class="qimg"><img src="' + esc(q.img) + '" alt=""></div>' : '<div class="qimg qimg--fallback"><span class="qimg-tile">' + ic('spark', 64) + '</span></div>') +
      '<div class="qcard-top"><span class="qchip">' + q.cat + '</span><span class="qchip">' + q.slot + '/5</span></div>' +
      '<div class="qcard-body"><h5' + (long ? ' class="is-long"' : '') + '>' + esc(t.title) + '</h5><div class="qcard-meta"><span>' + esc(t.rule) + '</span><span>' + esc(t.settle) + '</span></div><div class="choices"><span class="choice">' + esc(t.left) + '</span><span class="choice" data-d="r">' + esc(t.right) + '</span></div></div></article>';
  }
  function imageBlock(q: any) {
    const live = q.state !== 'Scheduled', regen = is('regen') || q.imgState === 'Pending', rejected = q.imgState === 'Rejected by check';
    const longest = ['en', 'ko', 'ja'].sort((a, b) => len(q[b].title) / LIM[b].title - len(q[a].title) / LIM[a].title)[0];
    return '<div class="crop"><div class="acts" style="gap:8px"><div class="seg" role="group" aria-label="Preview language" data-pick="lang">' + ['en', 'ko', 'ja'].map((l) => '<button type="button" value="' + l + '" aria-pressed="' + (l === longest) + '">' + l.toUpperCase() + '</button>').join('') + '</div><div class="seg" role="group" aria-label="Preview width" data-pick="w"><button type="button" value="360" aria-pressed="true">360</button><button type="button" value="430" aria-pressed="false">430</button></div></div>' +
      '<div class="crop-stage" id="stage" data-w="360">' + card(q, longest) + '</div>' +
      '<p class="hint">The card as players see it, 4:5. Opens on ' + LNAME[longest] + ', the longest title for its limit.</p>' +
      '<div class="crop-row">' + (q.img && !regen ? '<div class="crop-src"><img src="' + esc(q.img) + '" alt="Generated image, uncropped"><span class="safe"></span><span class="text"></span></div>' : '<div class="crop-src none">' + (regen ? '<span class="spin" style="margin:auto"></span>Generating, about 40 s' : 'No image in use') + '</div>') +
      '<div class="stack" style="gap:6px"><span>' + tag(regen ? 'Generating' : q.imgState, regen ? 'sky' : undefined) + '</span><p class="hint">Source image. The subject has to sit above the dashed line; the striped area is under the text.</p><div class="qcell">' + thumb(regen ? null : q.thumb || q.img, 1) + '<span class="hint">List thumbnail</span></div></div></div>' +
      (rejected && !regen ? note('down', '<b>Rejected by the check.</b> ' + esc(q.imgWhy || '') + ' The card shows the category illustration until a new image passes.') : '') +
      '<div class="acts">' + btn(regen ? 'Generating' : 'Generate again', { small: 1, act: 'regen', arg: q.id, write: 1, disabled: regen, icon: 'refresh' }) + btn('Use category illustration', { link: 1, act: 'fallback', arg: q.id, write: 1 }) +
      btn('Upload image', { link: 1, act: 'upload', arg: q.id, write: 1, disabled: !CONFIG.mock, title: CONFIG.mock ? '' : 'Uploads need the image store (R2), which is not set up yet' }) + '</div>' +
      '<p class="hint">' + (live ? 'The image is not part of the content hash, so it can still be replaced while the question is live. ' : '') + 'Prompts never name real people, teams, logos or trademarks.</p></div>';
  }
  function langCol(q: any, l: string, editable: boolean) {
    const t = q[l], L = LIM[l], over = is('edit') && l === 'ko';
    const title = over ? '11월 29일(일) 오후 9시가 되었을 때 솔라나 가격은 과연 250달러 위에 올라가 있을까요?' : t.title;
    function f(id: string, label: string, val: string, max: number, rowsN?: number) {
      const c = len(val), left = max - c, cid = id + '-' + l;
      const cnt = '<span class="cnt"' + (left < 0 ? ' data-over' : '') + ' data-count="' + cid + '">' + (editable ? (left < 0 ? -left + ' over' : left + ' left') : c + '/' + max) + '</span>';
      if (!editable) return '<div class="fl"><span class="lab">' + label + cnt + '</span><p class="ro" lang="' + l + '">' + esc(val) + '</p></div>';
      return '<div class="fl"><label for="' + cid + '">' + label + cnt + '</label>' + (rowsN ? '<textarea class="inp" rows="' + rowsN + '"' : '<input class="inp"') + ' id="' + cid + '" lang="' + l + '" data-max="' + max + '"' + (left < 0 ? ' aria-invalid="true" aria-describedby="' + cid + '-e"' : '') + (rowsN ? '>' + esc(val) + '</textarea>' : ' value="' + esc(val) + '">') +
        (left < 0 ? '<p class="err" id="' + cid + '-e">' + ic('warn') + 'The question is too long for the card in ' + LNAME[l] + '.</p>' : '') + '</div>';
    }
    return '<div><h4>' + LNAME[l] + (l === 'en' ? ' <span class="hint" style="font-weight:400">source</span>' : ' <span class="hint" style="font-weight:400">written natively</span>') + '</h4>' +
      f('title', 'Question', title, L.title, 3) + '<div class="cols cols-2" style="gap:12px">' + f('left', '<span class="pk" data-d="l">Left</span>', t.left, L.c) + f('right', '<span class="pk" data-d="r">Right</span>', t.right, L.c) + '</div>' + f('rule', 'Answer rule', t.rule, L.rule, 2) + f('settle', 'Settle time phrase', t.settle, 24) + '</div>';
  }
  function editor(q: any) {
    const live = q.state !== 'Scheduled', editable = !live && X.canWrite, bad = is('edit');
    const fits = ['en', 'ko', 'ja'].every((l) => len(q[l].title) <= LIM[l].title && len(q[l].left) <= LIM[l].c && len(q[l].right) <= LIM[l].c && len(q[l].rule) <= LIM[l].rule);
    const host = (q.src[0] || '').replace(/^https:\/\/(www\.)?/, '').split('/')[0];
    const checks = CONFIG.mock ? [
      ['ok', 'Can be decided from a public source', host],
      ['ok', 'Outcome is not known before the day ends', 'Day ends ' + q.closes + ', outcome ' + q.outcome],
      ['ok', 'Answer due within 24 hours after the set closes', ''],
      [bad ? 'fail' : 'ok', bad ? 'Text does not fit the card in Korean' : 'Text fits the card in all three languages', bad ? 'Question 4 over' : ''],
      ['ok', 'Not a repeat of the last 7 days', ''],
      [q.imgState === 'Rejected by check' ? 'fail' : 'ok', q.imgState === 'Rejected by check' ? 'Image rejected: lettering that reads as a film title' : 'Image: no real people, logos, trademarks or lettering', q.imgState === 'Rejected by check' ? 'Fallback in use' : ''],
    ] : [
      [host ? 'ok' : 'fail', 'Can be decided from a public source', host || 'No source'],
      [q.resolvesAt >= q.closesAt ? 'ok' : 'fail', 'Outcome is not known before the day ends', 'Day ends ' + q.closes + ', answer due ' + q.due],
      q.resolvesAt <= q.closesAt + 86400 ? ['ok', 'Answer due within 24 hours after the set closes', ''] : ['ok', 'Long question: answer due ' + Math.ceil((q.resolvesAt - q.closesAt) / 86400) + ' days after the set closes', 'At most 2 a day'],
      [fits ? 'ok' : 'fail', fits ? 'Text fits the card in all three languages' : 'Text does not fit the card in every language', ''],
      [q.imgState === 'Rejected by check' ? 'fail' : 'ok', q.imgState === 'Rejected by check' ? 'Image rejected by the check' : 'Image: no real people, logos, trademarks or lettering', q.imgState === 'Rejected by check' ? 'Fallback in use' : q.imgState],
    ];
    const head = '<div class="sec-head"><h2>' + q.id + '</h2>' + tag(q.state) + tag(q.source === 'AI' ? 'Drafted by AI' : 'Written by hand', 'line') + '<span class="sec-note">Slot ' + q.slot + ' of ' + D.dayLong[q.day] + '</span><span class="sec-end">' +
      (live ? btn('Void this question', { link: 1, danger: 1, act: 'void', arg: q.id, write: 1 }) : btn('Cancel question', { link: 1, danger: 1, act: 'cancelq', arg: q.id, write: 1 }) + btn('Swap with a draft', { act: 'swap', arg: q.id, write: 1 }) + btn('Save changes', { primary: 1, act: 'save', arg: q.id, write: 1, disabled: bad })) + '</span></div>';
    const sel = (v: string) => '<select class="inp" style="width:180px" aria-label="Category" data-f="cat">' + CATS.map((c) => '<option' + (c === v ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>';
    const meta = '<div class="cols cols-2 split" style="margin-top:24px"><div>' + kv([
      ['Category', editable ? sel(q.cat) : q.cat],
      ['Closes', q.closes + ' KST <span class="dim">with the whole day' + (q.closesIn ? ', in ' + cd(q.closesIn) : '') + '. A question has no close time of its own.</span>'],
      ['Answer due', editable ? '<input class="inp" style="width:180px" aria-label="Answer due, KST" data-f="due" value="' + esc(CONFIG.mock ? q.due : q.dueInput) + '"><span class="hint" style="display:block;margin-top:4px">KST' + (CONFIG.mock ? '' : ', as YYYY-MM-DD HH:MM') + '. After the day ends: within 24 hours, or later for a long question (at most 2 a day, up to the limit in Reward settings).</span>' : q.due + ' KST'],
      ['Resolve rule', editable ? '<textarea class="inp" rows="3" aria-label="Resolve rule" data-f="crit">' + esc(q.resolve) + '</textarea>' : esc(q.resolve)],
      ['Polymarket', outsideCell(q)],
      ['Source', q.src.map((s: string, i: number) => (editable ? '<input class="inp" aria-label="Source URL" data-f="src" data-i="' + i + '" value="' + esc(s) + '">' : '<a href="' + esc(s) + '" target="_blank" rel="noopener">' + esc(s) + '</a>')).join('')],
    ]) + '</div><div><div class="sec-head" style="min-height:0"><h3 class="sub" style="margin:0">AI checks</h3><span class="sec-end">Confidence <b class="num-d" style="font-size:16px;margin-left:6px">' + (q.conf == null ? 'n/a' : q.conf.toFixed(2)) + '</b></span></div><ul class="chk">' + checks.map((c) => '<li data-s="' + c[0] + '">' + ic(c[0] === 'ok' ? 'ok' : 'no') + '<span>' + c[1] + '</span><span class="v">' + esc(c[2]) + '</span></li>').join('') + '</ul>' +
      '<p class="hint" style="margin-top:8px">Confidence is the drafter\'s own estimate that the answer can be set from the source without a person. Below 0.90 the question is listed in Answers for a look after it resolves.</p></div></div>';
    return '<section class="sec" id="editor">' + head + (live ? note('', '<b>Live questions cannot be edited.</b> The texts, times and rule are fixed by the content hash on chain. If the question is wrong, void it: it pays no hit points and a pick on it still counts toward the 5.') + '<div style="height:16px"></div>' : '') +
      '<div class="editor">' + imageBlock(q) + '<div><div class="langs">' + ['en', 'ko', 'ja'].map((l) => langCol(q, l, editable)).join('') + '</div>' + meta + '</div></div></section>';
  }

  /** The question's linked Polymarket market: the data room compares our split with its price, read once at the close. */
  function outsideCell(q: any): string {
    const linkBtn = (label: string) => btn(label, { link: 1, act: 'outside', arg: q.id, write: 1 });
    if (CONFIG.mock) return '<span class="dim">None linked.</span> ' + linkBtn('Link a market');
    const o = OUT[q.marketId];
    if (o === undefined) return '<span class="dim">Reading the link</span>';
    if (o === 'error') return '<span class="dim">The link could not be read.</span>';
    if (!o) return '<span class="dim">None linked. The data room shows no comparison line for this question.</span> ' + linkBtn('Link a market');
    const price = o.rightPrice != null && o.takenAt
      ? 'Price read ' + T.wd(o.takenAt) + ' ' + T.hm(o.takenAt) + ' KST: <b>' + o.rightPrice + '%</b> for “' + esc(o.rightOutcome) + '”. The record is final.'
      : o.error ? 'The price read failed: ' + esc(o.error) + '.' : 'The price is read once, when the day closes.';
    return '<a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + esc(o.marketSlug) + '</a>' +
      '<span class="hint" style="display:block;margin-top:4px">Our right choice (' + esc(q.en.right || 'Right') + ') is “' + esc(o.rightOutcome) + '” there. ' + price + ' Linked by ' + esc(o.linkedBy) + '.</span>' +
      '<span class="acts" style="margin-top:6px">' + btn('Change link', { link: 1, act: 'outside', arg: q.id, write: 1, disabled: !!o.takenAt, title: o.takenAt ? 'The price was read: the record is final' : '' }) + btn('Remove link', { link: 1, danger: 1, act: 'outside-rm', arg: q.id, write: 1 }) + '</span>';
  }

  function queue() {
    const list = is('emptyqueue') ? [] : D.queue;
    const addBtn = btn('Add question', { act: 'add', write: 1 });
    return '<section class="sec" id="queue"><div class="sec-head"><h2>AI queue</h2><span class="nb">' + list.length + '</span><span class="sec-note">Drafts that are written and checked but not on a day yet. Nothing here needs approval: scheduling is automatic.</span><span class="sec-end">' + addBtn + btn('Assign 5 per day', { act: 'assign', write: 1 }) + '</span></div>' +
      table<any>({
        caption: 'AI queue', rows: list, cls: 'tight', sort: [5, 'desc'],
        empty: empty('The queue is empty', 'Every draft is on a day. The drafter writes new ones at 18:00 KST. If a day is short before then, add a question by hand.', addBtn + btn('Run the drafter now', { link: 1, act: 'drafter', write: 1 })),
        cols: [
          { h: 'Draft', val: (r) => r.title, cell: (r) => '<div class="qcell">' + thumb(r.img) + '<div><span class="t1">' + esc(r.title) + '</span><span class="t2">' + r.id + ' · ' + r.cat + ' · ' + esc(r.l) + ' / ' + esc(r.r) + '</span></div></div>' },
          { h: 'Answer rule and source', cell: (r) => esc(r.rule) + '<span class="t2">' + esc(r.src) + '</span>' },
          { h: 'Fits', cell: (r) => r.fits },
          { h: 'Image', cell: (r) => tag(r.imgState) },
          { h: 'Confidence', num: 1, val: (r) => r.conf ?? 0, cell: (r) => (r.conf == null ? '<span class="dim">n/a</span>' : r.conf.toFixed(2) + (r.conf < 0.9 ? ' ' + tag('Low', 'warn') : '')) },
          { h: 'Drafted', val: (r) => r.id, cell: (r) => r.drafted },
          { h: '', cell: (r) => '<div class="row-acts">' + btn('Schedule', { small: 1, act: 'sched', arg: r.id, write: 1 }) + btn('Edit', { link: 1, act: 'qedit', arg: r.id, write: 1, disabled: !CONFIG.mock, title: CONFIG.mock ? '' : 'Schedule it first, then edit it on its day' }) + btn('Discard', { link: 1, danger: 1, act: 'discard', arg: r.id, write: 1 }) + '</div>' },
        ],
      }) + '</section>';
  }

  return '<section class="sec" style="padding-bottom:20px"><div class="sec-head"><h2>Schedule</h2><span class="sec-note">' + (CONFIG.mock ? '5 questions a day, open all day. 7 of the next 7 days are drafted, 2 need attention.' : '5 questions a day, open all day. ' + D.summary) + '</span><span class="sec-end"><label class="search"><span class="sr">Search questions</span>' + ic('search') + '<input class="inp" type="search" placeholder="Search id, text or source" data-qsearch></label></span></div>' + cal() + '</section>' +
    dayTable() + (is('loading', 'error') ? '' : (sel ? editor(sel) : '') + queue());
}

/* ---------- live ---------- */
const kstInput = (u: number) => { const d = new Date((u + 9 * 3600) * 1000); return d.toISOString().slice(0, 16).replace('T', ' '); };
const parseKst = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s.trim()); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 1000 - 9 * 3600 : NaN; };

async function liveQuestions() {
  const now = nowS(), today = Math.floor(now / 86400);
  const [qr, dr] = await Promise.all([api('/admin/v1/questions?status=all&from=' + today + '&to=' + (today + 13)), api('/admin/v1/drafts').catch(() => ({ drafts: [] }))]);
  const qsList = (qr.questions || []).filter((m: any) => m.status !== 'cancelled' && m.status !== 'draft');
  const questions = qsList.map((m: any) => {
    const tx = m.text || {}, src = (m.sources || []).map((s: any) => s.url);
    return {
      id: qid(m.dayId, m.slot), marketId: m.marketId, day: String(m.dayId), slot: m.slot + 1, cat: CAT(m.category), img: m.image?.imageUrl || null, thumb: m.image?.thumbUrl || null,
      imgState: IMG_STATE[m.image?.state] || 'Fallback', imgWhy: '', state: STATUS[m.status] || m.status, closes: T.wd(m.closesAt) + ' ' + T.hm(m.closesAt), closesIn: m.dayId === today ? Math.max(0, m.closesAt - now) : 0,
      closesAt: m.closesAt, resolvesAt: m.resolvesAt, due: T.rel(m.resolvesAt, now), dueInput: kstInput(m.resolvesAt), conf: null, source: /^Written by/.test(m.rationale || '') ? 'Manual' : 'AI',
      src, srcFull: m.sources || [], resolve: m.criteria || '', en: tx.en || {}, ko: tx.ko || {}, ja: tx.ja || {}, picks: [m.picks, 0], editable: m.editable,
    };
  });
  const days = [] as any[];
  const dayLong: Record<string, string> = {};
  for (let d = today; d < today + 14; d++) {
    const rows = questions.filter((q: any) => q.day === String(d)), u = d * 86400;
    const st = d === today ? 'Live' : rows.some((r: any) => r.state === 'Live') ? 'Live' : d - today > 7 ? 'Drafting' : 'Scheduled';
    days.push({ id: String(d), d: T.dd(u), n: rows.length, img: rows.filter((r: any) => r.imgState === 'Generated' || r.imgState === 'Replaced').length, tag: d === today ? 'Today' : undefined, state: st, far: d - today > 7 });
    dayLong[String(d)] = T.dayLong(u);
  }
  const need = days.filter((d: any) => !d.far && d.id !== String(today) && d.n < 5).length;
  const queue = (dr.drafts || []).map((x: any) => {
    const host = String(x.sources?.[0]?.url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return { id: 'D-' + x.id, draftId: x.id, targetDay: String(x.targetDay), cat: CAT(x.category), img: null, imgState: 'Pending', title: x.en?.title || '', l: x.en?.left || '', r: x.en?.right || '', rule: x.en?.rule || '', src: host, conf: x.quality, drafted: x.createdAt ? T.rel(x.createdAt, now) : '', fits: T.dd(x.targetDay * 86400) + ' only' };
  });
  return { todayId: String(today), questions, days, dayLong, queue, summary: (7 - need) + ' of the next 7 days are full' + (need ? ', ' + need + ' need attention.' : '.') };
}

export default function Questions() {
  const { state, qs } = usePageCtx('questions');
  const inval = useInvalidate();
  const page = usePageData(['questions'], liveQuestions);
  const { loading, error, updatedAt, q } = page;
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : '';
  const D = page.D || EMPTY;
  if (CONFIG.mock) { D.todayId = '1126'; }
  const qsKey = qs.toString();
  const [outside, setOutside] = useState<OutsideMap>({});
  const html = useMemo(() => render(D, qs, outside), [D, qsKey, X.role, X.env, outside]);
  const { sel } = pickState(D, qs);
  const selMarket: number | undefined = CONFIG.mock ? undefined : sel?.marketId;
  const readOutside = (id: number) =>
    api('/admin/v1/questions/' + id + '/outside').then((r) => setOutside((o) => ({ ...o, [id]: r.outside ?? null }))).catch(() => setOutside((o) => ({ ...o, [id]: 'error' })));
  useEffect(() => { if (selMarket != null && !(selMarket in outside)) void readOutside(selMarket); }, [selMarket]);
  const byId = (id?: string) => D.questions.find((x: any) => x.id === id);
  const draftById = (id?: string) => D.queue.find((x: any) => x.id === id);
  const done = (m: string) => { toast(m); void inval(); };

  function outsideSheet(id?: string) {
    if (CONFIG.mock) { toast('A form for the Polymarket link opens here.'); return; }
    const qq = byId(id); if (!qq) return;
    const cur = outside[qq.marketId];
    const o = cur && cur !== 'error' ? cur : null;
    sheet({ title: (o ? 'Change the Polymarket link of ' : 'Link ') + id + (o ? '' : ' to a Polymarket market'), wide: 1,
      body: '<p>' + esc(qq.en.title) + '</p><p class="hint">The data room adds a comparison line where the same question exists on Polymarket. Its price is read once, when our day closes; after that the link is final. The answer is still set by our own answer runs from the question\'s source.</p>' +
        '<div class="fl"><label for="o-url">Polymarket link <span class="cnt">A market or event page on polymarket.com</span></label><input class="inp" id="o-url" autofocus placeholder="https://polymarket.com/event/…" value="' + esc(o?.url || '') + '"></div>' +
        '<div class="cols cols-2" style="gap:12px"><div class="fl"><label for="o-slug">Market slug <span class="cnt">Only for an event page with several markets</span></label><input class="inp" id="o-slug" value="' + esc(o && o.marketSlug && !String(o.url).includes(o.marketSlug) ? o.marketSlug : '') + '"></div>' +
        '<div class="fl"><label for="o-right">Outcome there that matches “' + esc(qq.en.right || 'Right') + '” <span class="cnt">Usually Yes</span></label><input class="inp" id="o-right" value="' + esc(o?.rightOutcome || 'Yes') + '"></div></div>' +
        WHY('o-why') + '<div data-run-err style="display:contents"></div>',
      action: btn(o ? 'Save the link' : 'Link the market', { primary: 1, act: 'outside-go', arg: id }) });
  }
  function outsideRemove(id?: string) {
    const qq = byId(id); if (!qq) return;
    const o = outside[qq.marketId];
    confirm({ title: 'Remove the Polymarket link of ' + id + '?', reason: false, body: '<p>' + esc(qq.en.title) + '</p><p>The data room stops showing the comparison line for this question' + (o && o !== 'error' && o.rightPrice != null ? ', and the price already read (' + o.rightPrice + '%) is dropped' : '') + '. The removal is written to the audit log.</p>', danger: 1, action: 'Remove the link', cancel: 'Keep it', done: 'The link of ' + id + ' is removed.',
      run: async () => { await api('/admin/v1/questions/' + qq.marketId + '/outside', { method: 'DELETE' }); setOutside((m) => ({ ...m, [qq.marketId]: null })); return 'The link of ' + id + ' is removed.'; } });
  }
  function swapSheet(id?: string) {
    const qq = byId(id); if (!qq) return;
    const fits = CONFIG.mock ? D.queue.slice(0, 4) : D.queue.filter((d: any) => d.targetDay === qq.day);
    const list = fits.length ? fits : D.queue.slice(0, 6);
    sheet({ title: 'Swap ' + id + ' with a draft', wide: 1, body: '<p>' + esc(qq.en.title) + (CONFIG.mock ? ' goes back to the queue.' : ' is cancelled.') + ' The draft you pick takes slot ' + qq.slot + ' of ' + D.dayLong[qq.day] + '.</p>' +
      (list.length ? '<div role="radiogroup" aria-label="Draft to schedule">' + list.map((d: any, i: number) => '<label class="qcell" style="padding:8px 0;border-bottom:var(--hair);cursor:pointer"><input type="radio" name="swap" value="' + d.id + '"' + (i === 0 ? ' checked autofocus' : '') + '>' + thumb(d.img) + '<span><span class="t1" style="font-weight:700;display:block">' + esc(d.title) + '</span><span class="dim" style="font-size:12.5px">' + d.id + ' · ' + d.cat + ' · fits: ' + d.fits + ' · confidence ' + (d.conf == null ? 'n/a' : d.conf.toFixed(2)) + '</span></span></label>').join('') + '</div>' : '<p class="dim">The queue has no draft for this day. Run the drafter, or cancel the question and add one by hand.</p>') +
      (CONFIG.mock ? '' : WHY('swapwhy') + '<div data-run-err style="display:contents"></div>'),
      action: CONFIG.mock ? '<button type="button" class="btn btn-primary" data-confirm="Swapped. ' + id + ' is back in the queue.">Swap</button>' : btn('Swap', { primary: 1, act: 'swap-go', arg: id, disabled: !list.length }) });
  }
  function cancelSheet(id?: string) {
    const qq = byId(id); if (!qq) return;
    confirm({ title: 'Cancel ' + id + '?', body: '<p>' + esc(qq.en.title) + '</p><p>The question is removed from ' + D.dayLong[qq.day] + ' and discarded. Slot ' + qq.slot + ' becomes empty: the drafter fills it at 18:00 KST, or you schedule a draft now.</p>', placeholder: 'Why is this question removed?', danger: 1, action: 'Cancel the question', cancel: 'Keep it', done: id + ' cancelled. Slot ' + qq.slot + ' is empty.',
      run: CONFIG.mock ? undefined : async (why) => { await api('/admin/v1/questions/' + qq.marketId + '/cancel', { body: { reason: why } }); void inval(); return id + ' cancelled. Slot ' + qq.slot + ' is empty: the worker refills it.'; } });
  }
  function voidSheet(id?: string) {
    const qq = byId(id); if (!qq) return;
    const p = qq.picks ? qq.picks[0] + qq.picks[1] : 0;
    confirm({ title: 'Void ' + id + ' while it is live?', body: '<p>' + esc(qq.en.title) + '</p>' + kv([['Picks so far', n(p) + ' players'], ['Hit points', 'None will be paid on this question'], ["The day's 100 P", 'A pick on it still counts toward the 5'], ['Players see', 'Cancelled, in Results']]) + note('warn', '<b>This cannot be undone.</b> A voided question stays in the set until it closes and cannot be reopened.'),
      placeholder: 'What is wrong with the question?', signer: 'Sent with the operator key through the worker. No owner signature.', danger: 1, action: 'Void the question', cancel: 'Keep it live', done: id + ' voided. It pays no hit points.',
      run: CONFIG.mock ? undefined : async (why) => { const r = await api('/admin/v1/questions/' + qq.marketId + '/void', { body: { reason: why } }); void inval(); return id + ' void is queued for the worker (request ' + r.requestId + '). It pays no hit points.'; } });
  }
  function schedSheet(arg?: string) {
    if (CONFIG.mock) { toast(arg + ' scheduled into Sat 28 Nov, slot 5.'); return; }
    const [did, dayArg, slotArg] = (arg || '').split(':');
    const d = draftById(did); if (!d) return;
    const day = dayArg || d.targetDay;
    const taken = D.questions.filter((x: any) => x.day === day).map((x: any) => x.slot);
    const slot = slotArg ? +slotArg : [1, 2, 3, 4, 5].find((s) => !taken.includes(s));
    if (!slot) { toast(D.dayLong[day] + ' is full. Cancel a question there first, or swap it with this draft.'); return; }
    confirm({ title: 'Schedule ' + d.id + '?', body: '<p>' + esc(d.title) + '</p>' + kv([['Day', D.dayLong[day] || day], ['Slot', String(slot)], ['Image', 'Generated after scheduling']]), placeholder: 'Why this draft?', action: 'Schedule', done: d.id + ' scheduled.',
      run: async (why) => { await api('/admin/v1/drafts/' + d.draftId + '/schedule', { body: { dayId: +day, slot: slot - 1, reason: why } }); void inval(); return d.id + ' scheduled into ' + (D.dayLong[day] || day) + ', slot ' + slot + '.'; } });
  }
  function addSheet(arg?: string) {
    if (CONFIG.mock) { toast('A blank question form opens here.'); return; }
    const today = +D.todayId;
    const open: [string, number][] = [];
    for (const d of D.days) { if (+d.id <= today) continue; for (let s = 1; s <= 5; s++) if (!D.questions.some((x: any) => x.day === d.id && x.slot === s)) open.push([d.id, s]); }
    const [ad, as] = (arg || '').split(':');
    if (!open.length) { toast('Every slot of the next 14 days is filled. Cancel a question to free a slot.'); return; }
    const opt = open.map(([d, s]) => '<option value="' + d + ':' + s + '"' + (d === ad && String(s) === as ? ' selected' : '') + '>' + D.dayLong[d] + ', slot ' + s + '</option>').join('');
    const lang = (l: string) => '<div><h4>' + LNAME[l] + '</h4>' + ['title', 'left', 'right', 'rule', 'settle'].map((f) => '<div class="fl"><label for="a-' + f + '-' + l + '">' + { title: 'Question', left: 'Left choice', right: 'Right choice', rule: 'Answer rule', settle: 'Settle time phrase' }[f] + ' <span class="cnt" data-count="a-' + f + '-' + l + '">' + (f === 'title' ? LIM[l].title : f === 'rule' ? LIM[l].rule : f === 'settle' ? 24 : LIM[l].c) + ' left</span></label><input class="inp" id="a-' + f + '-' + l + '" lang="' + l + '" data-max="' + (f === 'title' ? LIM[l].title : f === 'rule' ? LIM[l].rule : f === 'settle' ? 24 : LIM[l].c) + '"' + (f === 'left' && l === 'en' ? ' value="No"' : f === 'right' && l === 'en' ? ' value="Yes"' : '') + '></div>').join('') + '</div>';
    sheet({ title: 'Add a question', wide: 1, body: '<div class="cols cols-2" style="gap:12px"><div class="fl"><label for="a-slot">Day and slot</label><select class="inp" id="a-slot">' + opt + '</select></div><div class="fl"><label for="a-cat">Category</label><select class="inp" id="a-cat">' + CATS.map((c) => '<option>' + c + '</option>').join('') + '</select></div></div>' +
      '<div class="langs">' + ['en', 'ko', 'ja'].map(lang).join('') + '</div>' +
      '<div class="cols cols-2" style="gap:12px"><div class="fl"><label for="a-due">Answer due, KST <span class="cnt">YYYY-MM-DD HH:MM</span></label><input class="inp" id="a-due" placeholder="2026-12-01 18:00"></div><div class="fl"><label for="a-src">Source URL</label><input class="inp" id="a-src" placeholder="https://"></div></div>' +
      '<div class="fl"><label for="a-crit">Resolve rule <span class="cnt">One sentence with the exact time and time zone</span></label><textarea class="inp" id="a-crit" rows="2"></textarea></div>' + WHY('a-why') +
      '<p class="hint">The day closes at its end, 09:00 KST the next day; the answer must be due between then and 24 hours later, or later for a long question (at most 2 a day, up to the limit in Reward settings). The text is checked again and hashed when the day goes on chain.</p><div data-run-err style="display:contents"></div>',
      action: btn('Add question', { primary: 1, act: 'add-go' }) });
  }
  const readText = (pre: string) => Object.fromEntries(['en', 'ko', 'ja'].map((l) => [l, Object.fromEntries(['title', 'left', 'right', 'rule', 'settle'].map((f) => [f, ((document.getElementById(pre + f + '-' + l) as HTMLInputElement)?.value || '').trim()]))]));
  const sheetFail = (m: string) => { const b = document.querySelector('#sheet [data-run-err]') as HTMLElement | null; if (b) b.innerHTML = '<div class="note" data-k="down" role="alert">' + ic('warn') + '<div>' + m + '</div></div>'; else toast(m.replace(/<[^>]+>/g, '')); };

  useActs({
    swap: (id) => swapSheet(id), cancelq: (id) => cancelSheet(id), void: (id) => voidSheet(id),
    outside: (id) => outsideSheet(id), 'outside-rm': (id) => outsideRemove(id),
    'outside-go': async (id, el) => {
      const qq = byId(id); if (!qq) return;
      const url = (document.getElementById('o-url') as HTMLInputElement).value.trim(), slug = (document.getElementById('o-slug') as HTMLInputElement).value.trim(), right = (document.getElementById('o-right') as HTMLInputElement).value.trim(), why = (document.getElementById('o-why') as HTMLTextAreaElement).value.trim();
      if (!/^https:\/\/(www\.)?polymarket\.com\/\S+/.test(url)) { sheetFail('Give a polymarket.com market or event link.'); return; }
      if (slug && !/^[a-z0-9-]{3,200}$/i.test(slug)) { sheetFail('The market slug has letters, digits and hyphens only.'); return; }
      if (!right) { sheetFail('Name the outcome that matches our right choice.'); return; }
      if (why.length < 8) { sheetFail('Give a reason.'); return; }
      busy(el as HTMLButtonElement, 'Saving');
      try {
        const r = await api('/admin/v1/questions/' + qq.marketId + '/outside', { body: { source: 'polymarket', url, ...(slug ? { marketSlug: slug } : {}), rightOutcome: right, reason: why } });
        setOutside((m) => ({ ...m, [qq.marketId]: r.outside ?? null }));
        closeSheet(true); toast(id + ' is linked to ' + (r.outside?.marketSlug || 'the market') + '.');
      } catch (e) { unbusy(el as HTMLButtonElement); sheetError(errText(e)); }
    },
    jump: () => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' }),
    sched: (a) => schedSheet(a), add: (a) => addSheet(a),
    regen: async (id, el) => {
      if (CONFIG.mock) { go('regen'); return; }
      const qq = byId(id); if (!qq) return; busy(el as HTMLButtonElement, 'Generating');
      try { const r = await api('/admin/v1/questions/' + qq.marketId + '/image', { body: { action: 'regenerate' } }); done('A new image for ' + id + ' is queued (request ' + r.requestId + ').'); } catch (e) { unbusy(el as HTMLButtonElement); toast(errText(e).replace(/<[^>]+>/g, '')); }
    },
    fallback: (id) => {
      if (CONFIG.mock) { toast('The category illustration is used for ' + id + '.'); return; }
      const qq = byId(id); if (!qq) return;
      confirm({ title: 'Use the category illustration for ' + id + '?', reason: false, body: '<p>The generated image is dropped and the card shows the ' + qq.cat + ' illustration.</p>', action: 'Use the illustration', done: 'The category illustration is used for ' + id + '.', run: async () => { await api('/admin/v1/questions/' + qq.marketId + '/image', { body: { action: 'fallback' } }); void inval(); } });
    },
    upload: () => toast('Upload: 4:5, at least 800 by 1000 pixels. It passes the same check.'),
    qedit: (id) => toast('The editor opens on ' + id + '.'),
    toast: (m) => toast(m || ''),
    drafter: () => {
      if (CONFIG.mock) { toast('Question drafter started.'); return; }
      confirm({ title: 'Run the drafter now?', reason: false, body: '<p>Starts one extra run of the question drafter. It fills empty slots of the next 7 days from the queue first, then drafts new questions for days still short.</p>', action: 'Run now', done: 'Question drafter started.', run: async () => { const r = await api('/admin/v1/jobs/draft/run', { body: {} }); void inval(); return 'Question drafter started (request ' + r.requestId + ').'; } });
    },
    discard: (id) => {
      const d = draftById(id);
      confirm({ title: 'Discard draft ' + id + '?', reason: false, body: '<p>The draft and its image are deleted. The drafter may write a similar question again on another day.</p>', danger: 1, action: 'Discard the draft', cancel: 'Keep it', done: id + ' discarded.',
        run: CONFIG.mock || !d ? undefined : async () => { await api('/admin/v1/drafts/' + d.draftId + '/discard', { body: {} }); void inval(); } });
    },
    assign: () => confirm({ title: 'Assign 5 per day?', reason: false, body: CONFIG.mock ? '<p>Fills every empty slot of the next 7 days from the queue, oldest draft first, keeping each draft on a day it fits. Right now that is 1 slot: Sat 28 Nov, slot 5, with D-2232.</p>' : '<p>Fills every empty slot of the next 7 days from the queue, keeping each draft on the day it was written for. Days the queue cannot fill are drafted again. It runs on the worker; the schedule updates in about a minute.</p>', action: 'Assign', done: CONFIG.mock ? '1 slot filled: D-2232 into Sat 28 Nov, slot 5.' : 'The worker is filling the empty slots.',
      run: CONFIG.mock ? undefined : async () => { const r = await api('/admin/v1/jobs/draft/run', { body: {} }); void inval(); return 'The worker is filling the empty slots (request ' + r.requestId + ').'; } }),
    lang: (l) => { const st = document.getElementById('stage'); if (st && sel) st.innerHTML = renderCard(sel, l || 'en'); },
    w: (w) => { const st = document.getElementById('stage'); if (st) st.dataset.w = w || '360'; },
    save: async (id, el) => {
      if (CONFIG.mock) { toast('Saved ' + id + '. The three language texts and times are stored.'); return; }
      const qq = byId(id); if (!qq) return;
      const content = readText('');
      const over = document.querySelector('#editor [data-over]');
      if (over) { toast('A text is too long for the card. Shorten it first.'); return; }
      const resolvesAt = parseKst((document.querySelector('[data-f="due"]') as HTMLInputElement).value);
      if (!isFinite(resolvesAt)) { toast('Answer due: write it as YYYY-MM-DD HH:MM in KST.'); return; }
      const srcs = [...document.querySelectorAll<HTMLInputElement>('[data-f="src"]')].map((i, k) => ({ name: qq.srcFull[k]?.name || new URL(i.value).hostname, url: i.value.trim(), role: k === 0 ? 'primary' : 'secondary' }));
      confirm({ title: 'Save ' + id + '?', body: '<p>The three language texts, the answer due time, the rule and the sources are stored. The image is generated again for the new text. The day is hashed as edited when it goes on chain.</p>', placeholder: 'What did you change, and why?', action: 'Save changes', done: 'Saved ' + id + '.',
        run: async (why) => { await api('/admin/v1/questions/' + qq.marketId + '/replace', { body: { reason: why, question: { category: (document.querySelector('[data-f="cat"]') as HTMLSelectElement).value, content, resolvesAt, sources: srcs, criteria: (document.querySelector('[data-f="crit"]') as HTMLTextAreaElement).value.trim() } } }); void inval(); return 'Saved ' + id + '. The three language texts and times are stored.'; } });
      void el;
    },
    'swap-go': async (id, el) => {
      const qq = byId(id); const pick = (document.querySelector('#sheet input[name="swap"]:checked') as HTMLInputElement)?.value; const d = draftById(pick);
      const why = (document.getElementById('swapwhy') as HTMLTextAreaElement).value.trim();
      if (!qq || !d) return; if (why.length < 8) { sheetFail('Give a reason.'); return; }
      busy(el as HTMLButtonElement, 'Swapping');
      try { await api('/admin/v1/questions/' + qq.marketId + '/swap', { body: { draftId: d.draftId, reason: why } }); closeSheet(true); done('Swapped. ' + d.id + ' is in slot ' + qq.slot + '.'); }
      catch (e) { unbusy(el as HTMLButtonElement); sheetError(errText(e)); }
    },
    'add-go': async (_a, el) => {
      const [day, slot] = (document.getElementById('a-slot') as HTMLSelectElement).value.split(':');
      const content = readText('a-');
      const miss = ['en', 'ko', 'ja'].some((l) => ['title', 'left', 'right', 'rule', 'settle'].some((f) => !(content as any)[l][f]));
      const resolvesAt = parseKst((document.getElementById('a-due') as HTMLInputElement).value);
      const src = (document.getElementById('a-src') as HTMLInputElement).value.trim(), crit = (document.getElementById('a-crit') as HTMLTextAreaElement).value.trim(), why = (document.getElementById('a-why') as HTMLTextAreaElement).value.trim();
      if (miss) { sheetFail('Fill in every text in all three languages.'); return; }
      if (document.querySelector('#sheet [data-over]')) { sheetFail('A text is too long for the card.'); return; }
      if (!isFinite(resolvesAt)) { sheetFail('Answer due: write it as YYYY-MM-DD HH:MM in KST.'); return; }
      if (!/^https?:\/\/\S+\.\S+/.test(src)) { sheetFail('Give the source URL.'); return; }
      if (!crit) { sheetFail('Write the resolve rule.'); return; }
      if (why.length < 8) { sheetFail('Give a reason.'); return; }
      busy(el as HTMLButtonElement, 'Adding');
      try {
        const r = await api('/admin/v1/questions', { body: { dayId: +day, slot: +slot - 1, reason: why, question: { category: (document.getElementById('a-cat') as HTMLSelectElement).value, content, resolvesAt, sources: [{ name: new URL(src).hostname, url: src, role: 'primary' }], criteria: crit } } });
        closeSheet(true); done('Added to ' + D.dayLong[day] + ', slot ' + slot + ' (' + qid(+day, r.marketId % 5) + ').');
      } catch (e) { unbusy(el as HTMLButtonElement); sheetError(errText(e)); }
    },
  });

  // search inside the day table and the queue
  useEffect(() => {
    const on = (e: Event) => { const t = e.target as HTMLInputElement; if (!t.matches('[data-qsearch]')) return; const v = t.value.toLowerCase(); document.querySelectorAll<HTMLElement>('#view .tbl tbody tr').forEach((tr) => { tr.hidden = !!v && !tr.textContent!.toLowerCase().includes(v); }); };
    document.addEventListener('input', on); return () => document.removeEventListener('input', on);
  }, []);
  useEffect(() => {
    if (!CONFIG.mock || document.getElementById('sheet')) return;
    const { selId } = pickState(D, qs);
    if (is('swap')) swapSheet(selId || undefined); if (is('cancel')) cancelSheet(selId || undefined); if (is('void')) voidSheet(selId || undefined);
  }, [state]);

  return <Shell page="questions" title="Questions" sub="Drafted, illustrated and scheduled by AI. You correct, swap, cancel or void." states={['scheduled', 'edit', 'short', 'noimage', 'regen', 'swap', 'cancel', 'void', 'emptyqueue', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} />;
}

function renderCard(q: any, lang: string) {
  const t = q[lang], long = lang === 'en' ? t.title.length > 44 : t.title.length > 22;
  return '<article class="qcard" lang="' + lang + '" aria-label="Card preview">' +
    (q.img && !is('regen') ? '<div class="qimg"><img src="' + esc(q.img) + '" alt=""></div>' : '<div class="qimg qimg--fallback"><span class="qimg-tile">' + ic('spark', 64) + '</span></div>') +
    '<div class="qcard-top"><span class="qchip">' + q.cat + '</span><span class="qchip">' + q.slot + '/5</span></div>' +
    '<div class="qcard-body"><h5' + (long ? ' class="is-long"' : '') + '>' + esc(t.title) + '</h5><div class="qcard-meta"><span>' + esc(t.rule) + '</span><span>' + esc(t.settle) + '</span></div><div class="choices"><span class="choice">' + esc(t.left) + '</span><span class="choice" data-d="r">' + esc(t.right) + '</span></div></div></article>';
}
const EMPTY: any = { todayId: '0', questions: [], days: [{ id: '0', d: '', n: 0, img: 0, state: 'Scheduled' }], dayLong: { 0: '' }, queue: [], summary: '' };
