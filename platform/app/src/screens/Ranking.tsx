// K1 Weekly ranking (platform/design/ranking.html): the pool, a podium for ranks 1 to 3, ranks 4 to 10, "Around you",
// and the pinned bar with the player's own rank.
import { useEffect, useLayoutEffect, useState } from 'react';
import { useConfig, useRanking } from '../api';
import { t } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, errorNote, hold, icon, note, skel, tag } from '../ui/h';
import { Html, Shell, Seg } from '../ui/kit';
import { usePreset, useHold } from '../state/app';
import { sheet } from '../state/ui';
import type { RankRow, Ranking as R } from '../api/types';
import { CONFIG } from '../config';

const name = (r: RankRow) => '<span translate="no">' + esc(r.name) + '</span>';
const rankNo = (n: number) => '<span class="sr-only">' + t('k.rank.sr', { n }) + '</span><span aria-hidden="true">' + n + '</span>';
const gap = (g: number) => t(g > 0 ? 'k.gap.up' : g < 0 ? 'k.gap.down' : 'k.gap.same', { n: F.int(Math.abs(g)) });
function pod(r: RankRow) {
  return '<li class="pod' + (r.me ? ' is-me' : '') + '" data-rank="' + r.rank + '"><p class="pod-name">' + name(r) + (r.me ? ' ' + tag(t('k.you'), 'ink') : '') + '</p><p class="pod-pts">' + F.pts(r.points) + '</p>' +
    '<p class="pod-prize">' + F.prize(r.prize || 0) + '<small>CT</small></p><p class="pod-step">' + rankNo(r.rank) + '</p></li>';
}
function row(r: RankRow & { gap?: number }) {
  return '<li class="krow' + (r.me ? ' is-me' : '') + '" data-rank="' + r.rank + '"><span class="krow-rank">' + rankNo(r.rank) + '</span>' +
    '<div class="grow"><p class="krow-name">' + name(r) + (r.me ? tag(t('k.you'), 'ink') : '') + '</p><p class="krow-pts">' + F.pts(r.points) + '</p></div>' +
    (r.prize === undefined ? '' : '<p class="krow-prize">' + F.prize(r.prize) + '<small>CT</small></p>') +
    (r.gap === undefined || r.me ? '' : '<p class="krow-gap">' + gap(r.gap) + '</p>') + '</li>';
}

export default function Ranking() {
  const st = usePreset();
  const [week, setWeek] = useState<'current' | 'last'>(st === 'lastweek' || st === 'sent' ? 'last' : 'current');
  const q = useRanking(week);
  const cfgQ = useConfig();
  const held = useHold() || st === 'hold';
  const loading = st === 'loading' || q.isPending;
  const d = q.data;
  const w = week === 'last' ? 'last' : 'this';

  function pool(): string {
    if (loading || !d) return '<section class="sec pool" aria-busy="true">' + skel('120px') + skel('160px', '32px') + '</section>';
    const right = w === 'last' ? '<div class="end">' + (d.state === 'sent' ? tag(t('k.sent'), 'sky', 'check') : tag(t('k.final.h'), 'ink')) + '</div>' :
      '<div class="end"><p class="lbl">' + t('k.ends') + '</p><p class="fig fig--md" data-cd="' + Math.round((d.endsAt - Date.now()) / 1000) + '" data-cd-end="' + d.endsAt + '" data-cd-fmt="dh"></p></div>';
    return '<section class="sec pool"><div class="pool-top"><div><p class="lbl">' + t(w === 'last' ? 'k.lastweek' : 'k.pool') + '</p><p class="fig">' + F.int(d.pool.ct) + '<small>CT</small></p></div>' + right + '</div>' +
      '<button type="button" class="linkish" id="how">' + t('k.split.q') + icon('chev', 16) + '</button></section>';
  }
  function list(): string {
    if (loading || !d) return '<ul class="list" id="top10" aria-busy="true">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => '<li class="krow">' + skel('24px', '24px') + '<div>' + skel('120px', '14px') + skel('60px', '10px', 'margin-top:8px') + '</div>' + skel('64px', '16px') + '</li>').join('') + '</ul>';
    const rows = d.top;
    let voids = '';
    for (let i = rows.length + 1; i <= 10; i++) voids += '<li class="krow is-void"><span class="krow-rank" aria-hidden="true">' + i + '</span><p class="krow-name">' + t('k.void') + '</p><p class="krow-prize"></p></li>';
    return '<div id="top10"><ol class="podium">' + rows.slice(0, 3).map(pod).join('') + '</ol>' +
      '<p class="cols" aria-hidden="true"><span>' + t('k.col.player') + '</span><span>' + t('k.col.prize') + '</span></p><ol class="list" start="4">' + rows.slice(3).map(row).join('') + voids + '</ol></div>';
  }
  function around(): string {
    if (loading || !d || !d.around.length || held) return '';
    const mine = d.around.find((r) => r.me) || d.around[1];
    const rows = d.around.map((r) => ({ ...r, gap: r.points - mine.points }));
    return '<section class="sec sec-rule" id="around" tabindex="-1"><div class="sect-h"><h2 class="sect-h">' + t('k.around') + '</h2><span class="muted">' + t('k.around.sub', { a: rows[0].rank, b: rows[rows.length - 1].rank }) + '</span></div>' +
      '<ol class="list" aria-label="' + esc(t('k.col.gap')) + '">' + rows.map(row).join('') + '</ol></section>';
  }
  function view(): string {
    let n = '';
    if (held) n = hold(t('hold.rank'));
    else if (w === 'last' && d) n = d.state === 'sent' ? note('ok', t('k.sent') + ' <a href="' + (cfgQ.data?.explorer || CONFIG.chain.explorer) + '/tx/' + (d.airdropTx || '') + '" target="_blank" rel="noopener">' + t('w.scan') + '</a>') : note('sky', t('k.closed', { time: t('k.final.time') }));
    else if (d?.lastWeek) n = note('sky', t('k.last', { rank: d.lastWeek.rank, amount: F.prize(d.lastWeek.amount) }));
    return n + pool() + '<section class="sec sec-rule"><div class="sect-h"><h2 class="sect-h">' + t('k.top') + '</h2>' + (loading || w === 'last' ? '' : '<span class="live"><span class="live-dot"></span><span data-stamp="12">' + t('common.updated', { n: 12 }) + '</span></span>') + '</div>' +
      list() + '<p class="tie-line">' + icon('info', 16) + '<span>' + t('k.tie') + '</span></p></section>' + around();
  }
  function howSheet(r: R) {
    const ct = r.pool.ct;
    const split = r.pool.splitPct.map((p, i) => '<div><span>' + t('k.rankth', { n: i + 1 }) + '</span><span>' + p + '%</span><b>' + F.prize((ct * p) / 100) + ' CT</b></div>').join('');
    sheet.open('<h2>' + t('k.split.q') + '</h2><div class="stack-12"><p class="sheet-lead">' + t('k.pool.line', { n: F.int(ct) }) + '</p><p class="sheet-lead">' + t('k.tie') + ' ' + t('k.tie.note') + '</p><p class="sheet-lead">' + t('k.split.note') + '</p></div>' +
      '<div class="split">' + split + '</div><div class="sheet-acts">' + btn(t('common.close'), { block: true, attrs: 'data-sheet-close' }) + '</div>');
  }
  const toAround = () => {
    const a = document.getElementById('around'); if (!a) return;
    a.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); a.focus({ preventScroll: true });
    a.classList.remove('is-flash'); void a.offsetWidth; a.classList.add('is-flash');
  };
  // first view: the pinned bar's top edge lands on a line between two rows, never through one
  const snap = () => {
    const app = document.querySelector('.app') as HTMLElement | null, first = document.querySelector('#top10 .list .krow'), p = document.getElementById('pin');
    if (!app || !first || !p) return;
    app.style.removeProperty('--krow-h'); app.style.removeProperty('--pod-h');
    const avail = p.getBoundingClientRect().top - (first.getBoundingClientRect().top + window.scrollY), n = Math.floor(avail / 53);
    if (avail <= 0) return;
    const h = n ? Math.min(avail / n, 64) : 0, left = Math.ceil(avail - n * h);
    if (left > 32) return;
    if (n) app.style.setProperty('--krow-h', h + 'px'); if (left > 0) app.style.setProperty('--pod-h', 88 + left + 'px');
  };
  useLayoutEffect(() => { snap(); });
  useEffect(() => { void document.fonts?.ready.then(snap); window.addEventListener('resize', snap); return () => window.removeEventListener('resize', snap); }, []);

  let pin: React.ReactNode = null;
  if (!loading && d && !q.isError && st !== 'error') {
    const bar = (rank: number, title: string, sub: string, pts: number, label: string) =>
      <button type="button" className="pin" id="pin" aria-label={t('k.around.open')} onClick={toAround}><span className="pin-rank"><span className="sr-only">{t('k.rank.sr', { n: rank })}</span><span aria-hidden="true">{rank}</span></span><span className="pin-main"><b>{title}</b><span>{sub}</span></span><span className="pin-pts">{F.pts(pts)}<small>{label}</small></span></button>;
    if (held) pin = <aside className="pin pin--wide" id="pin" aria-label={t('k.you')}><span className="pin-main"><b>{t('k.you')}</b><span>{t('hold.rank.pin')}</span></span><span className="pin-pts">{F.pts(d.me.points)}<small>{t(w === 'last' ? 'k.lastweek' : 'r.week')}</small></span></aside>;
    else if (w === 'last') pin = bar(d.me.rank || 0, t('k.you'), t('k.final.h'), d.me.points, t('k.lastweek'));
    else if (d.me.rank === null) pin = <aside className="pin pin--wide" id="pin" aria-label={t('k.you')}><div className="pin-main"><b>{t('k.none')}</b></div><Html as="span" style={{ display: 'contents' }} html={btn(t('k.play'), { sm: true, href: '/', cls: 'btn-onink' })} /></aside>;
    else if (d.me.rank <= 10) pin = bar(d.me.rank, t('k.in'), t('k.prize', { c: F.prize(d.me.prize || 0) }), d.me.points, t('r.week'));
    else pin = bar(d.me.rank, t('k.you'), t('k.gap', { gap: F.int(d.me.gap || 0) }), d.me.points, t('r.week'));
  }
  const onClick = (e: React.MouseEvent) => { if ((e.target as Element).closest('#how') && d) howSheet(d); };
  return (
    <Shell tab="rank" cls="sc-rank" docTitle={t('k.title')} head={<Html className="ph-top" html={'<h1>' + t('k.title') + '</h1>'} />} pin={pin}>
      {st === 'error' || q.isError ? <Html as="div" style={{ display: 'contents' }} html={errorNote()} /> : (
        <>
          <Seg<'current' | 'last'> label={t('k.week')} value={week} onChange={setWeek} items={[{ label: t('r.week'), value: 'current' }, { label: t('k.lastweek'), value: 'last' }]} />
          <Html className="stack pg-fade" id="view" key={week} html={view()} onClick={onClick} />
        </>
      )}
    </Shell>
  );
}
