// R1 Results (platform/design/results.html): this week, all time and pending, then each day with a mark per question.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CONFIG } from '../config';
import { useResults } from '../api';
import { api } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, empty, errorNote, icon, pick, skel, rows as rowsHtml, aiSheetHtml } from '../ui/h';
import { Html, Shell, Seg } from '../ui/kit';
import { usePreset } from '../state/app';
import { sheet } from '../state/ui';
import type { ResultDay, ResultRow } from '../api/types';

const MARK: Record<string, string> = { hit: 'hit', pend: 'hit', corr: 'hit', miss: 'miss', wait: 'wait', none: 'off', void: 'off' };
const mark = (k: string) => '<i class="rmark rmark--' + k + '" aria-hidden="true"></i>';
type Filter = 'all' | 'wait' | 'set';

export default function Results() {
  const st = usePreset();
  const q = useResults();
  const [filter, setFilter] = useState<Filter>(st === 'nowaiting' ? 'wait' : st === 'noset' ? 'set' : 'all');
  const [more, setMore] = useState<ResultDay[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
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
    if (loading) return '<section class="sec" aria-busy="true"><div class="tri">' + [1, 2, 3].map(() => '<div class="tri-c">' + skel('72px', '26px') + skel('60px', '12px', 'margin-top:6px') + '</div>').join('') + '</div></section>';
    const s = q.data!.summary;
    const col = (fig: string, label: string, sub: string) => '<div class="tri-c"><p class="tri-fig">' + fig + '</p><h2 class="tri-lbl">' + label + '</h2>' + (sub ? '<p class="tri-sub">' + sub + '</p>' : '') + '</div>';
    return '<section class="sec" aria-label="' + esc(t('r.sum.sr')) + '"><div class="tri">' +
      col(F.pts(s.week.points), t('r.week'), t('r.sum.hits', { a: s.week.hits, b: s.week.answered })) +
      col(F.pts(s.all.points), t('r.all'), t('r.sum.rate', { n: s.all.hitRate })) +
      col('+' + F.pts(s.pending.points), t('r.pending'), s.pending.landsAt ? t('r.at', { time: F.time(s.pending.landsAt) }) : '') + '</div></section>';
  };
  const legend = '<ul class="rs-legend" aria-label="' + esc(t('r.legend')) + '"><li>' + mark('hit') + t('r.o.hit') + '</li><li>' + mark('miss') + t('r.o.miss') + '</li><li>' + mark('wait') + t('r.f.wait') + '</li></ul>';

  function side(r: ResultRow): string {
    let chip: string, pts: string;
    switch (r.outcome) {
      case 'wait': chip = '<span class="rchip rchip--wait">' + icon('clock', 14) + t('r.o.waitat', { time: r.expectedAt ? F.time(r.expectedAt) : '' }) + '</span>'; pts = '<span class="rs-pts is-if">' + t('r.o.ifhit') + '</span>'; break;
      case 'hit': chip = '<span class="rchip rchip--hit">' + t('r.o.hit') + '</span>'; pts = '<span class="rs-pts">+50P</span>'; break;
      case 'pend': chip = '<span class="rchip rchip--hit">' + t('r.o.hit') + '</span>'; pts = '<span class="rs-pts">+50P<small>' + t('r.at', { time: r.landsAt ? F.time(r.landsAt) : '' }) + '</small></span>'; break;
      case 'corr': chip = '<span class="rchip rchip--corr">' + t('r.o.corr') + '</span>'; pts = '<span class="rs-pts">+50P</span>'; break;
      case 'miss': chip = '<span class="rchip">' + t('r.o.miss') + '</span>'; pts = '<span class="rs-pts is-zero">0P</span>'; break;
      case 'none': chip = '<span class="rchip rchip--off">' + t('r.o.none') + '</span>'; pts = '<span class="rs-pts is-zero">0P</span>'; break;
      default: chip = '<span class="rchip rchip--off">' + t('r.o.void') + '</span>'; pts = '<span class="rs-pts is-zero">0P</span>';
    }
    return '<span class="rs-side">' + chip + pts + '</span>';
  }
  const rowsById: Record<string, { r: ResultRow; date: number }> = {};
  function row(r: ResultRow, gi: number, ri: number, date: number): string {
    const id = 'x-' + gi + '-' + ri, tx = r.text[L] || r.text.en;
    rowsById[id] = { r, date };
    const set = r.outcome === 'hit' || r.outcome === 'pend' || r.outcome === 'miss' || r.outcome === 'corr';
    let m = '';
    const ans = r.answer || (r.outcome === 'miss' ? (r.choice === 'r' ? 'l' : 'r') : r.choice) || 'r';
    // the evidence of the deciding run (GET /v1/results evidenceUrl) as a link; the design's sentence without one
    const ev = r.evidenceUrl && /^https:\/\//.test(r.evidenceUrl)
      ? '<a class="linkish" href="' + esc(r.evidenceUrl) + '" target="_blank" rel="noopener" translate="no">' + esc(new URL(r.evidenceUrl).hostname.replace(/^www\./, '')) + icon('ext', 14) + '</a>'
      : t('p.evidence');
    if (set) m += '<span><b>' + t('r.x.answer') + ':</b> ' + esc(ans === 'l' ? tx.left : tx.right) + '</span><span><b>' + t('r.x.evidence') + ':</b> ' + ev + '</span><span><b>' + t('r.x.setat') + ':</b> ' + F.date(r.setAt || date, true) + '</span>';
    if (r.outcome === 'pend') m += '<span>' + t('r.o.pend.help') + '</span>';
    if (r.outcome === 'corr') m += '<span>' + t('r.o.corr.line', { date: F.date(r.correctedAt || date) }) + ' ' + t('r.o.added') + '</span>';
    if (r.outcome === 'void') m += '<span>' + t('r.o.void.line') + '</span>';
    if (r.outcome === 'wait') m += '<span><b>' + t('h.ai.src') + ':</b> ' + esc(tx.rule || '') + '</span>';
    const inner = '<span class="rs-main"><span class="rrow-q">' + esc(tx.title) + '</span><span class="rs-meta"><span>' + t('cat.' + r.category) + '</span>' + (r.choice ? '<span>' + t('r.you', { choice: pick(r.choice, esc(r.choice === 'l' ? tx.left : tx.right)) }) + '</span>' : '') + '</span></span>' + side(r);
    const kind = r.outcome === 'wait' ? 'wait' : 'set';
    const hidden = filter !== 'all' && filter !== kind;
    const li = '<li data-out="' + kind + '"' + (hidden ? ' hidden' : '') + '>';
    if (!m) return li + '<div class="rrow rs-btn">' + inner + '</div></li>';
    const isOpen = !!open[id];
    return li + '<button type="button" class="rrow rs-btn" aria-expanded="' + isOpen + '" aria-controls="' + id + '" data-row="' + id + '">' + inner + '</button>' +
      '<div class="rrow-more rs-more" id="' + id + '"' + (isOpen ? '' : ' hidden') + '>' + m + (r.outcome === 'void' ? '' : '<button type="button" class="linkish" data-how="' + id + '">' + t('h.ai.h') + icon('chev', 16) + '</button>') + '</div></li>';
  }
  function group(g: ResultDay, gi: number): string {
    // by day id (a day opens 09:00 KST = 00:00 UTC, dayId = unix / 86400), not by elapsed hours
    const ago = g.dayId ? Math.floor(Date.now() / 86400000) - g.dayId : Math.round((Date.now() - g.date) / 86400000);
    const label = ago === 0 ? t('common.today') : ago === 1 ? t('common.yesterday') : F.weekday(g.date);
    const n: Record<string, number> = { hit: 0, miss: 0, wait: 0, off: 0 }; g.rows.forEach((r) => n[MARK[r.outcome]]++);
    const shown = g.rows.filter((r) => filter === 'all' || (r.outcome === 'wait' ? 'wait' : 'set') === filter).length;
    const pending = g.pendingPoints;
    return '<section class="sec rs-day" data-group' + (shown ? '' : ' hidden') + '><div class="rs-dayh"><div class="rs-dayh-t"><h2>' + label + '</h2><span class="rmarks" role="img" aria-label="' + esc(t('r.marks.sr', { h: n.hit, m: n.miss, w: n.wait })) + '">' + g.rows.map((r) => mark(MARK[r.outcome])).join('') + '</span></div>' +
      '<p class="rs-dayh-sub">' + (g.completed ? t('r.g.done') : t('r.g.part', { k: g.answered })) + (pending ? (L === 'ja' ? '、' : ', ') + t('r.g.pending', { q: pending }) : '') + '</p><p class="rs-count">+' + F.pts(g.points) + '</p></div>' +
      (g.inviteBonus ? '<a class="rs-inv" href="/invite"><b>' + t('r.inv') + '</b><small>' + t('r.inv.sub', { r: 10 }) + '</small><span class="rs-inv-p">+' + F.pts(g.inviteBonus.points) + '</span>' + icon('chev', 16) + '</a>' : '') +
      '<ul class="list">' + g.rows.map((r, ri) => row(r, gi, ri, g.date)).join('') + '</ul></section>';
  }

  let body: React.ReactNode;
  const segEl = <Seg<Filter> label={t('r.filter')} value={filter} onChange={setFilter} items={[{ label: t('r.f.all'), value: 'all' }, { label: t('r.f.wait'), value: 'wait' }, { label: t('r.f.set'), value: 'set' }]} />;
  if (st === 'error' || q.isError) body = <Html as="div" style={{ display: 'contents' }} html={errorNote()} />;
  else if (!loading && q.data!.days.length === 0) body = <Html as="div" style={{ display: 'contents' }} html={empty({ icon: 'list', title: t('r.empty.h'), body: t('r.empty.b'), action: btn(t('r.empty.btn'), { kind: 'primary', href: '/' }) })} />;
  else if (loading) body = (<><Html as="div" style={{ display: 'contents' }} html={summary()} />{segEl}<Html as="div" style={{ display: 'contents' }} html={[1, 2, 3].map(() => '<section class="sec rs-day" aria-busy="true"><div class="rs-dayh">' + skel('90px', '18px') + skel('64px', '32px') + '</div>' + [1, 2].map(() => '<div class="rrow rs-btn"><span class="rs-main">' + skel('90%', '16px') + skel('50%', '12px') + '</span>' + skel('64px', '22px') + '</div>').join('') + '</section>').join('')} /></>);
  else {
    const days = [...q.data!.days, ...more];
    const groups = days.map(group).join('');
    const any = days.some((g) => g.rows.some((r) => filter === 'all' || (r.outcome === 'wait' ? 'wait' : 'set') === filter));
    const onClick = (e: React.MouseEvent) => {
      const el = e.target as Element;
      const h = el.closest('[data-how]');
      if (h) { const x = rowsById[h.getAttribute('data-how')!]; if (!x) return; const tx = x.r.text[L] || x.r.text.en; sheet.open(aiSheetHtml(tx.rule || '', x.r.outcome === 'wait' ? (tx.settle ? t('h.ai.after', { time: tx.settle }) : t('r.at', { time: x.r.expectedAt ? F.time(x.r.expectedAt) : '' })) : F.date(x.r.setAt || x.date, true))); return; }
      const b = el.closest('button[data-row]'); if (b) { const id = b.getAttribute('data-row')!; setOpen((o) => ({ ...o, [id]: !o[id] })); }
    };
    const loadMore = async () => { const r = await api.results(q.data!.nextCursor || 'more'); setMore((m) => [...m, ...r.days]); setCursorDone(!r.nextCursor); };
    body = (
      <>
        <Html as="div" style={{ display: 'contents' }} html={summary()} />
        {segEl}
        <Html as="div" style={{ display: 'contents' }} html={legend} />
        <Html className="stack" id="groups" html={groups} onClick={onClick} />
        <div id="fempty" hidden={any} dangerouslySetInnerHTML={{ __html: any ? '' : empty({ icon: filter === 'wait' ? 'check' : 'clock', title: t(filter === 'wait' ? 'r.fe.wait' : 'r.fe.set') }) }} />
        {any && !cursorDone && q.data!.nextCursor && <button type="button" className="btn btn-ghost btn-block" id="more" onClick={loadMore}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<path d="M6 9l6 6 6-6"/>' }} /><span>{t('r.more')}</span></button>}
      </>
    );
  }
  void rowsHtml;
  return (
    <Shell tab="results" cls="sc-results" docTitle={t('r.title')} head={<Html className="ph-top" html={'<h1>' + t('r.title') + '</h1>'} />} pts={!st ? 'hits' : loading ? 'loading' : ''} badges={{ results: 0 }}>
      {body}
    </Shell>
  );
}
