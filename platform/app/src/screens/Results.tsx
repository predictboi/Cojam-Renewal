// R1 Results: the box scores (platform/design-variants/paper/results.html). Three figures divided by column rules, a
// filter, then one section per day with a stamp for every answer that is set. Stamps land once in list order; the filter and
// the clippings work on the page in place, so nothing lands again.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CONFIG } from '../config';
import { useResults, useToday } from '../api';
import { api } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, count as countCell, empty, errorNote, icon, pick, qbtn, skel, aiSheetHtml } from '../ui/h';
import { Html, Shell, Seg } from '../ui/kit';
import { usePreset } from '../state/app';
import { sheet } from '../state/ui';
import type { ResultDay, ResultRow } from '../api/types';
import { saysText, shareText, splitView, topView } from '../lib/dataLine';

const MARK: Record<string, string> = { hit: 'hit', pend: 'hit', corr: 'hit', miss: 'miss', wait: 'wait', none: 'off', void: 'off' };
const mark = (k: string) => '<i class="rmark rmark--' + k + '" aria-hidden="true"></i>';
/* every stamp sits at its own small angle, fixed by its place in the list (stable between visits), and lands in list order */
const ANG = [-5, 3, -2, 4, -4, 2, -3, 5];
type Filter = 'all' | 'wait' | 'set';

export default function Results() {
  const st = usePreset();
  const q = useResults();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>(st === 'nowaiting' ? 'wait' : st === 'noset' ? 'set' : 'all');
  const [more, setMore] = useState<ResultDay[]>([]);
  const [cursorDone, setCursorDone] = useState(false);
  const L = currentLang();
  const loading = st === 'loading' || q.isPending;
  useEffect(() => { setMore([]); setCursorDone(false); }, [q.dataUpdatedAt]);
  // opening Results clears the tab badge (PATCH /v1/me resultsSeen), once per visit
  const qc = useQueryClient();
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current || st || CONFIG.mockApi || !q.data) return;
    seen.current = true;
    void api.patchMe({ resultsSeen: true }).then(() => qc.invalidateQueries({ queryKey: ['me'] })).catch(() => { seen.current = false; });
  }, [q.data, st]);

  const summary = () => {
    if (loading) return '<section class="sec" aria-busy="true"><div class="tri">' + [1, 2, 3].map(() => '<div class="tri-c">' + skel('72px', '24px') + skel('60px', '12px', 'margin-top:6px') + '</div>').join('') + '</div></section>';
    const s = q.data!.summary;
    const col = (fig: string, label: string, sub: string) => '<div class="tri-c"><h2 class="tri-lbl">' + label + '</h2><p class="tri-fig">' + fig + '</p>' + (sub ? '<p class="tri-sub tnum">' + sub + '</p>' : '') + '</div>';
    return '<section class="sec" aria-label="' + esc(t('r.sum.sr')) + '"><div class="tri">' +
      col(F.pts(s.week.points), t('r.week'), t('r.sum.hits', { a: s.week.hits, b: s.week.answered })) +
      col(F.pts(s.all.points), t('r.all'), t('r.sum.rate', { n: s.all.hitRate })) +
      col('+' + F.pts(s.pending.points), t('r.pending'), s.pending.landsAt ? t('r.at', { time: F.time(s.pending.landsAt) }) : '') + '</div></section>';
  };
  // what a waiting pick can pay is said once, in the legend, not on every row
  const legend = '<ul class="rs-legend" aria-label="' + esc(t('r.legend')) + '"><li>' + mark('hit') + t('r.o.hit') + '</li><li>' + mark('miss') + t('r.o.miss') + '</li><li>' + mark('wait') + t('r.f.wait') + '<small class="rs-if">' + t('r.o.ifhit') + '</small></li></ul>';

  let stampN = 0;
  const stamp = (kind: string, text: string) => { const k = stampN++; return '<span class="rstamp rstamp--' + kind + (reduceMotion() ? '' : ' is-land') + '" style="--rot:' + ANG[k % ANG.length] + 'deg;--d:' + Math.min(k, 9) * 70 + 'ms">' + text + '</span>'; };
  /* the right column of every row: the stamp or the state, then the points, always in the same place */
  function side(r: ResultRow): string {
    let chip: string, pts: string;
    switch (r.outcome) {
      case 'wait': chip = '<span class="rchip rchip--wait">' + mark('wait') + t('pp.answerat', { time: r.expectedAt ? F.dayTime(r.expectedAt) : '' }) + '</span>'; pts = ''; break;
      case 'hit': chip = stamp('hit', t('r.o.hit')); pts = '<span class="rs-pts">+50P</span>'; break;
      case 'pend': chip = stamp('hit', t('r.o.hit')); pts = '<span class="rs-pts">+50P<small>' + t('r.at', { time: r.landsAt ? F.time(r.landsAt) : '' }) + '</small></span>'; break;
      case 'corr': chip = stamp('corr', t('r.o.corr')); pts = '<span class="rs-pts">+50P</span>'; break;
      case 'miss': chip = stamp('miss', t('r.o.miss')); pts = ''; break;
      case 'none': chip = '<span class="rchip">' + t('r.o.none') + '</span>'; pts = ''; break;
      default: chip = '<span class="rchip">' + t('r.o.void') + '</span>'; pts = '';
    }
    return '<span class="rs-side">' + chip + pts + '</span>';
  }
  const rowsById = useRef<Record<string, { r: ResultRow; date: number }>>({});
  function row(r: ResultRow, gi: number, ri: number, date: number): string {
    const id = 'x-' + gi + '-' + ri, tx = r.text[L] || r.text.en;
    rowsById.current[id] = { r, date };
    const set = r.outcome === 'hit' || r.outcome === 'pend' || r.outcome === 'miss' || r.outcome === 'corr';
    let m = '';
    const ans = r.answer || (r.outcome === 'miss' ? (r.choice === 'r' ? 'l' : 'r') : r.choice) || 'r';
    // the evidence of the deciding run (GET /v1/results evidenceUrl) as a link; the design's sentence without one
    const ev = r.evidenceUrl && /^https:\/\//.test(r.evidenceUrl)
      ? '<a class="linkish" href="' + esc(r.evidenceUrl) + '" target="_blank" rel="noopener" translate="no">' + esc(new URL(r.evidenceUrl).hostname.replace(/^www\./, '')) + icon('ext', 16) + '</a>'
      : t('p.evidence');
    if (set) m += '<span><b>' + t('r.x.answer') + ':</b> ' + esc(ans === 'l' ? tx.left : tx.right) + '</span><span><b>' + t('r.x.evidence') + ':</b> ' + ev + '</span><span><b>' + t('r.x.setat') + ':</b> ' + F.date(r.setAt || date, true) + '</span>';
    if (r.outcome === 'pend') m += '<span>' + t('r.o.pend.help') + '</span>';
    if (r.outcome === 'corr') m += '<span>' + t('r.o.corr.line', { date: F.date(r.correctedAt || date) }) + ' ' + t('r.o.added') + '</span>';
    if (r.outcome === 'void') m += '<span>' + t('r.o.void.line') + '</span>';
    if (r.outcome === 'wait') m += '<span><b>' + t('h.ai.src') + ':</b> ' + esc(tx.rule || '') + '</span>';
    // how the players picked: one small line under the player's own pick, the players and the top players behind the tap
    let says = '';
    if (r.choice && r.split) {
      const w = { l: esc(tx.left), r: esc(tx.right) }, v = splitView(r.split), tv = topView(r.split);
      says = '<span class="rs-split">' + saysText(v, w, t, (n) => '<span class="nw">' + n + '%</span>') + '</span>';
      m += '<span><b>' + t('dr.x.players') + ':</b> <span class="tnum">' + F.int(r.split.players) + '</span></span>' + (tv && v.kind !== 'counting' ? '<span><b>' + t('dr.x.top') + ':</b> ' + shareText(tv, w, t, (n) => '<span class="nw">' + n + '%</span>') + '</span>' : '');
    }
    const inner = '<span class="rs-main"><span class="rrow-q">' + esc(tx.title) + '</span><span class="rs-meta">' + (r.choice ? '<span>' + pick(r.choice, esc(r.choice === 'l' ? tx.left : tx.right)) + '</span>' : '<span>' + t('cat.' + r.category) + '</span>') + '</span>' + says + '</span>' + side(r);
    const li = '<li data-out="' + (r.outcome === 'wait' ? 'wait' : 'set') + '">';
    if (!m) return li + '<div class="rrow">' + inner + '</div></li>';
    return li + '<button type="button" class="rrow" aria-expanded="false" aria-controls="' + id + '">' + inner + icon('down', 18, 'rrow-ch') + '</button>' +
      '<div class="rrow-more" id="' + id + '" hidden><div class="rrow-clip">' + m + (r.outcome === 'void' ? '' : '<button type="button" class="linkish" data-how="' + id + '">' + t('h.ai.h') + icon('chev', 16) + '</button>') + '</div></div></li>';
  }
  function group(g: ResultDay, gi: number): string {
    // by day id (a day opens 09:00 KST = 00:00 UTC, dayId = unix / 86400), not by elapsed hours
    const ago = g.dayId ? Math.floor(Date.now() / 86400000) - g.dayId : Math.round((Date.now() - g.date) / 86400000);
    // every day names its date; today and yesterday also say so in words
    const label = ago === 0 || ago === 1 ? t(ago === 0 ? 'common.today' : 'common.yesterday') + ' <small class="rs-date">' + F.weekday(g.date) + '</small>' : F.weekday(g.date);
    const n: Record<string, number> = { hit: 0, miss: 0, wait: 0, off: 0 }; g.rows.forEach((r) => n[MARK[r.outcome]]++);
    return '<section class="sec rs-day" data-group><div class="rs-dayh"><div class="rs-dayh-t"><h2>' + label + '</h2><span class="rmarks" role="img" aria-label="' + esc(t('r.marks.sr', { h: n.hit, m: n.miss, w: n.wait })) + '">' + g.rows.map((r) => mark(MARK[r.outcome])).join('') + '</span></div>' +
      (g.completed ? '' : '<p class="rs-dayh-sub">' + t('r.g.part', { k: g.answered }) + '</p>') + '<p class="rs-count' + (g.points ? '' : ' is-zero') + '" data-roll="' + g.points + '">+' + F.pts(g.points) + '</p></div>' +
      (g.inviteBonus ? '<a class="rs-inv" href="/invite"><b>' + t('r.inv') + '</b><span class="rs-inv-p">+' + F.pts(g.inviteBonus.points) + '</span>' + icon('chev', 16) + '</a>' : '') +
      '<ul class="list">' + g.rows.map((r, ri) => row(r, gi, ri, g.date)).join('') + '</ul></section>';
  }

  // the filter works on the rows in place (the stamps never land again)
  const groupsRef = useRef<HTMLElement>(null);
  const days = q.data ? [...q.data.days, ...more] : [];
  const [groupsHtml, setGroupsHtml] = useState('');
  useEffect(() => { if (q.data) { rowsById.current = {}; setGroupsHtml(days.map(group).join('')); } }, [q.dataUpdatedAt, more.length, L]); // eslint-disable-line
  const [any, setAny] = useState(true);
  useEffect(() => {
    const el = groupsRef.current; if (!el) return;
    let found = false;
    el.querySelectorAll<HTMLElement>('[data-group]').forEach((g) => {
      let shown = 0; g.querySelectorAll<HTMLElement>('li[data-out]').forEach((li) => { const on = filter === 'all' || li.getAttribute('data-out') === filter; li.hidden = !on; if (on) shown++; });
      g.hidden = !shown; if (shown) found = true;
    });
    setAny(found);
  }, [filter, groupsHtml]);
  // the points of each day count up once, after its stamps have started to land (the first two days are on screen)
  const rolled = useRef(false);
  useEffect(() => {
    const el = groupsRef.current; if (!el || !groupsHtml || rolled.current || reduceMotion()) return;
    rolled.current = true;
    Array.from(el.querySelectorAll<HTMLElement>('[data-roll]')).slice(0, 2).forEach((c, i) => {
      const to = +c.getAttribute('data-roll')!; c.textContent = '+0P';
      setTimeout(() => { const t0 = performance.now(); const step = (now: number) => { const k = Math.min(1, (now - t0) / 520), e = 1 - Math.pow(1 - k, 4); c.textContent = '+' + F.pts(to * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, 180 + i * 260);
    });
  }, [groupsHtml]);
  // ?state=open: the first row with a set answer opened in place
  useEffect(() => { if (st === 'open' && groupsHtml) (groupsRef.current?.querySelector('button.rrow') as HTMLButtonElement | null)?.click(); }, [groupsHtml]);

  const onClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    const h = el.closest('[data-how]');
    if (h) { const x = rowsById.current[h.getAttribute('data-how')!]; if (!x) return; const tx = x.r.text[L] || x.r.text.en; sheet.open(aiSheetHtml(tx.rule || '', x.r.outcome === 'wait' ? (tx.settle ? t('h.ai.after', { time: tx.settle }) : t('r.at', { time: x.r.expectedAt ? F.dayTime(x.r.expectedAt) : '' })) : F.date(x.r.setAt || x.date, true))); return; }
    const b = el.closest('button.rrow'); if (!b) return;
    // the detail unfolds under its row like a clipping (the one place a height is animated, through grid rows)
    const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open));
    const m = document.getElementById(b.getAttribute('aria-controls')!) as (HTMLElement & { _h?: ReturnType<typeof setTimeout> }) | null; if (!m) return;
    clearTimeout(m._h);
    if (open) { m.hidden = false; void m.offsetHeight; m.classList.add('is-open'); } else { m.classList.remove('is-open'); m._h = setTimeout(() => { m.hidden = true; }, reduceMotion() ? 0 : 250); }
  };

  let body: React.ReactNode;
  const segEl = <Seg<Filter> label={t('r.filter')} value={filter} onChange={setFilter} items={[{ label: t('r.f.all'), value: 'all' }, { label: t('r.f.wait'), value: 'wait' }, { label: t('r.f.set'), value: 'set' }]} />;
  if (st === 'error' || q.isError) body = <Html as="div" style={{ display: 'contents' }} html={errorNote()} />;
  else if (!loading && q.data!.days.length === 0) body = <Html as="div" style={{ display: 'contents' }} html={empty({ icon: 'list', title: t('r.empty.h'), body: t('r.empty.b'), action: btn(t('r.empty.btn'), { kind: 'primary', href: '/' }) })} />;
  else if (loading) body = (<><Html as="div" style={{ display: 'contents' }} html={summary()} />{segEl}<Html as="div" style={{ display: 'contents' }} html={[1, 2].map(() => '<section class="sec rs-day" aria-busy="true"><div class="rs-dayh">' + skel('90px', '20px') + skel('64px', '26px') + '</div>' + [1, 2, 3].map(() => '<div class="rrow"><span class="rs-main">' + skel('90%', '16px') + skel('50%', '12px') + '</span>' + skel('64px', '24px') + '</div>').join('') + '</section>').join('') + '<p class="sr-only" role="status">' + t('common.loading') + '</p>'} /></>);
  else {
    const loadMore = async () => { const r = await api.results(q.data!.nextCursor || 'more'); setMore((m) => [...m, ...r.days]); setCursorDone(!r.nextCursor); };
    body = (
      <>
        <Html as="div" style={{ display: 'contents' }} html={summary()} />
        {segEl}
        <Html as="div" style={{ display: 'contents' }} html={legend} />
        <Html className="pg-groups" id="groups" html={groupsHtml} onClick={onClick} ref={groupsRef} />
        <div id="fempty" hidden={any} dangerouslySetInnerHTML={{ __html: any ? '' : empty({ icon: filter === 'wait' ? 'check' : 'clock', title: t(filter === 'wait' ? 'r.fe.wait' : 'r.fe.set') }) }} />
        {any && !cursorDone && q.data!.nextCursor && <button type="button" className="btn btn-block" id="more" onClick={loadMore}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<path d="M6 9l6 6 6-6"/>' }} /><span>{t('r.more')}</span></button>}
      </>
    );
  }
  const next = today.data?.nextOpenAt;
  return (
    <Shell tab="results" cls="sc-results" docTitle={t('r.title')} live={next ? countCell('d.next', next) : ''}
      head={<Html className="ph-top ph-top--q" html={'<h1>' + t('r.title') + '</h1>' + qbtn('results', t('h.ai.h'))} />} pts={!st ? 'hits' : loading ? 'loading' : ''} badges={{ results: 0 }}>
      {body}
    </Shell>
  );
}
