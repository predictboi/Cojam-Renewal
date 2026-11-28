// K1 Weekly ranking: the league table (platform/design-variants/paper/ranking.html). The pool and the time left lead
// (the time on the dateline); ranks 1 to 3 are set larger, the leader largest, in one table with ranks 4 to 10. The
// player's own rank is pinned above the tab bar in ink and steps aside while the own row of "Around you" is on screen.
import { useEffect, useRef, useState } from 'react';
import { useConfig, useMe, useRanking, useResults } from '../api';
import { t } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, errorNote, hold, icon, nameHtml, note, skel, stamp, tag } from '../ui/h';
import { Html, Shell, Seg } from '../ui/kit';
import { usePreset, useHold } from '../state/app';
import { sheet } from '../state/ui';
import type { RankRow, Ranking as R } from '../api/types';
import { CONFIG } from '../config';

const rankNo = (n: number) => '<span class="sr-only">' + t('k.rank.sr', { n }) + '</span><span aria-hidden="true">' + n + '</span>';
// one face for every name in the table (the text face); the "x" of an address is shaped on its own so it never becomes a multiplication sign
const rankName = (n: string) => (/^0x/i.test(n) ? '<span translate="no">0<span class="xb">x</span>' + esc(n.slice(2)) + '</span>' : nameHtml(n));
const gap = (g: number) => t(g > 0 ? 'k.gap.up' : g < 0 ? 'k.gap.down' : 'k.gap.same', { n: F.int(Math.abs(g)) });

export default function Ranking() {
  const st = usePreset();
  const [week, setWeek] = useState<'current' | 'last'>(st === 'lastweek' || st === 'sent' ? 'last' : 'current');
  const q = useRanking(week);
  const cur = useRanking('current');   // the dateline always says when this week ends
  const cfgQ = useConfig();
  const held = useHold() || st === 'hold';
  const loading = st === 'loading' || q.isPending;
  const d = q.data;
  const w = week === 'last' ? 'last' : 'this';
  /* who counts for a prize (3 days played in the week, joined more than 7 days ago): an unranked player is told what is still missing */
  const unranked = !!d && w === 'this' && d.me.rank === null && !held;
  const meQ = useMe();
  const res = useResults(unranked);
  const elig = (): string => {
    const joined = meQ.data ? Date.parse(meQ.data.signedUpAt) : NaN;
    if (joined && Date.now() - joined < 7 * 86400000) return t('k.elig.age', { date: F.date(joined + 7 * 86400000) });
    if (res.data) {
      // the ranking week starts on Monday 09:00 KST (a day is a UTC day, dayId = unix / 86400)
      const today = Math.floor(Date.now() / 86400000), dow = new Date().getUTCDay() || 7, monday = today - (dow - 1);
      const played = res.data.days.filter((g) => g.dayId >= monday && g.dayId <= today && g.answered > 0).length;
      if (played < 3) return t('k.elig.days', { k: played });
    }
    return t('k.elig.play');
  };

  /* one row pattern for the whole table: rank, player, points, prize. Ranks 1 to 3 take the larger setting. */
  let rowN = 0;
  function row(r: RankRow & { gap?: number }) {
    const lead = r.prize !== undefined && r.rank <= 3;
    return '<li style="--i:' + rowN++ + '" class="krow' + (lead ? ' krow--lead' : '') + (lead && r.rank === 1 ? ' krow--first' : '') + (r.me ? ' is-me' : '') + '" data-rank="' + r.rank + '"><span class="krow-rank">' + rankNo(r.rank) + '</span>' +
      '<p class="krow-name">' + rankName(r.name) + (r.me ? tag(t('k.you'), 'ink') : '') + '</p><p class="krow-pts">' + F.pts(r.points) + '</p>' +
      (r.prize === undefined ? '' : '<p class="krow-prize"><span data-prize="' + r.prize + '">' + F.prize(r.prize) + '</span><small>CT</small></p>') +
      (r.gap === undefined ? '' : '<p class="krow-gap krow-gap--one">' + (r.me ? '' : gap(r.gap)) + '</p>') + '</li>';
  }
  function pool(): string {
    if (loading || !d) return '<section class="sec pool" aria-busy="true">' + skel('120px') + skel('180px', '44px') + '</section>';
    // the time left is on the dateline; beside the pool sits the way to the rules (or, for a closed week, its state)
    const how = '<button type="button" class="linkish" id="how">' + t('k.split.q') + icon('chev', 16) + '</button>';
    const right = '<div class="end">' + (w === 'last' && d.state !== 'sent' ? tag(t('k.final.h'), 'ink') : '') + how + '</div>';
    // when the prizes go out: a short labelled fact under the pool (a week already sent says so in its notice)
    const when = d.state === 'sent' ? '' : '<p class="fact pool-when"><b>' + t('k.sent.lbl') + '</b>' + t('k.final.time') + '</p>';
    return '<section class="sec pool"><div class="pool-top"><div class="mhero"><p class="lbl">' + t(w === 'last' ? 'k.lastweek' : 'k.pool') + '</p><p class="fig fig--xl">' + F.int(d.pool.ct) + '<small>CT</small></p></div>' + right + '</div>' + when + '</section>';
  }
  function list(): string {
    const colsHead = '<p class="cols" aria-hidden="true"><span>' + t('pp.rank.col') + '</span><span>' + t('pp.player.col') + '</span><span>' + t('pp.pts.col') + '</span><span>' + t('k.col.prize') + '</span></p>';
    if (loading || !d) return colsHead + '<ul class="klist" id="top10" aria-busy="true">' + [1, 2, 3, 4, 5, 6, 7, 8].map(() => '<li class="krow">' + skel('20px', '20px') + skel('120px', '14px') + skel('48px', '12px') + skel('64px', '14px') + '</li>').join('') + '</ul>';
    let voids = '';
    for (let i = d.top.length + 1; i <= 10; i++) voids += '<li class="krow is-void"><span class="krow-rank" aria-hidden="true">' + i + '</span><p class="krow-name">' + t('k.void') + '</p></li>';
    return colsHead + '<ol class="klist" id="top10">' + d.top.map(row).join('') + voids + '</ol>';
  }
  function around(): string {
    if (loading || !d || !d.around.length || held || (w === 'this' && d.me.rank !== null && d.me.rank <= 10)) return '';
    const i = Math.max(0, d.around.findIndex((r) => r.me));
    const rows = d.around.slice(Math.max(0, i - 1), i + 2);
    const mine = rows.find((r) => r.me) || rows[0];
    return '<section class="sec sec-rule" id="around" tabindex="-1"><div class="sh"><h2>' + t('k.around') + '</h2></div>' +
      '<ol class="klist klist--gap" aria-label="' + esc(t('k.col.gap')) + '">' + rows.map((r) => row({ ...r, gap: r.points - mine.points })).join('') + '</ol></section>';
  }
  function view(): string {
    let n = '';
    rowN = 0;
    if (held) n = hold(t('hold.rank'));
    else if (w === 'last' && d) n = d.state === 'sent' ? note('ok', t('k.sent') + ' <a href="' + (cfgQ.data?.explorer || CONFIG.chain.explorer) + '/tx/' + (d.airdropTx || '') + '" target="_blank" rel="noopener">' + t('w.scan') + '</a>') : note('', t('k.closed', { time: t('k.final.time') }));
    else if (d?.lastWeek) n = note('ok', t('k.last', { rank: d.lastWeek.rank, amount: F.prize(d.lastWeek.amount) }));
    return n + pool() + '<section class="sec sec-rule"><div class="sh"><h2>' + t('k.top') + '</h2>' + (loading || w === 'last' ? '' : stamp(12)) + '</div>' +
      '<div class="ktable">' + list() + '</div></section>' + around();
  }
  function howSheet(r: R) {
    const ct = r.pool.ct;
    const split = r.pool.splitPct.map((p, i) => '<div><span>' + t('k.rankth', { n: i + 1 }) + '</span><span>' + p + '%</span><b>' + F.prize((ct * p) / 100) + ' CT</b></div>').join('');
    sheet.open('<h2>' + t('k.split.q') + '</h2><div class="stack-8"><p class="sheet-lead">' + t('k.pool.line', { n: F.int(ct) }) + '</p><p class="sheet-lead">' + t('k.tie') + ' ' + t('k.tie.note') + '</p><p class="sheet-lead">' + t('k.split.note') + '</p></div>' +
      '<div class="split">' + split + '</div><div class="sheet-acts">' + btn(t('common.close'), { block: true, attrs: 'data-sheet-close' }) + '</div>');
  }
  const toAround = () => {
    const a = document.getElementById('around'); if (!a) return;
    a.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); a.focus({ preventScroll: true });
    a.classList.remove('is-flash'); void a.offsetWidth; a.classList.add('is-flash');
  };
  const html = view();
  const viewRef = useRef<HTMLElement>(null);
  /* the prizes of the first three roll up as their rows set; a week change turns like a page (the new table is in place at once) */
  const lastWeek = useRef(week);
  useEffect(() => {
    const v = viewRef.current; if (!v || loading || !d) return;
    if (!reduceMotion()) {
      v.querySelectorAll<HTMLElement>('#top10 .krow--lead [data-prize]').forEach((el, i) => {
        const to = +el.getAttribute('data-prize')!; el.textContent = F.prize(0);
        setTimeout(() => { const t0 = performance.now(); const step = (now: number) => { const k = Math.min(1, (now - t0) / 560), e = 1 - Math.pow(1 - k, 4); el.textContent = F.prize(to * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, 120 + i * 90);
      });
      if (lastWeek.current !== week && v.animate) { const dir = week === 'last' ? -1 : 1; v.animate([{ opacity: 0, transform: 'translateX(' + dir * -18 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); }
    }
    lastWeek.current = week;
    // while the player's own row is on screen the pinned own bar steps aside: the same line is never shown twice
    const own = v.querySelector('#around .is-me');
    if (!own || !window.IntersectionObserver) return;
    const io = new IntersectionObserver((en) => { document.getElementById('pin')?.classList.toggle('is-away', en[0].isIntersecting); }, { rootMargin: '0px 0px -130px 0px', threshold: 0.6 });
    io.observe(own);
    return () => io.disconnect();
  }, [week, loading, q.dataUpdatedAt]); // eslint-disable-line
  useEffect(() => { if (st === 'how' && d) howSheet(d); }, [!!d]); // eslint-disable-line
  /* At rest the pinned own bar never cuts through a row: the table is set down by the few pixels it takes for a row to end
     exactly at the bar's top edge (on load, once the bar has come in, on resize, fonts and week change) */
  useEffect(() => {
    const wholeRows = () => {
      const sec = document.querySelector('#view .sec-rule') as HTMLElement | null, p = document.getElementById('pin'); if (!sec) return;
      // measured with transitions off (under reduced motion every property still transitions for a moment, so a read in the same frame would be stale)
      const v = document.getElementById('view'); v?.classList.add('is-measuring'); requestAnimationFrame(() => v?.classList.remove('is-measuring'));
      sec.style.marginTop = '';
      if (!p || p.classList.contains('is-flow') || p.classList.contains('is-away') || window.scrollY > 0) return;
      // the bar's resting edge (it may still be sliding up as a ticker strip): the top of the tab bar minus its own height
      const tb = document.querySelector('.tb'); const top = (tb ? tb.getBoundingClientRect().top : innerHeight) - p.offsetHeight;
      for (const r of Array.from(document.querySelectorAll('#top10 .krow, #view .sh, #view .cols'))) {
        const q = r.getBoundingClientRect();
        // the exact (fractional) offset: a whole pixel rounded up would leave up to 1 px of the row above under the bar
        if (q.top < top - 0.5 && q.bottom > top + 0.5) { sec.style.marginTop = (Math.ceil((top - q.top) * 100) / 100) + 'px'; break; }
      }
    };
    wholeRows();
    const tms = [setTimeout(wholeRows, 400), setTimeout(wholeRows, 800)];
    window.addEventListener('resize', wholeRows); void document.fonts?.ready.then(wholeRows); document.fonts?.addEventListener?.('loadingdone', wholeRows);
    // rows change height as late font subsets arrive: measure again whenever the table changes size (idempotent, so it settles)
    const ro = new ResizeObserver(() => wholeRows()); const v = document.getElementById('top10'); if (v) ro.observe(v);
    return () => { ro.disconnect(); tms.forEach(clearTimeout); window.removeEventListener('resize', wholeRows); document.fonts?.removeEventListener?.('loadingdone', wholeRows); };
  }, [week, loading, q.dataUpdatedAt]); // eslint-disable-line

  let pin: React.ReactNode = null;
  if (!loading && d && !q.isError && st !== 'error') {
    const bar = (rank: number, title: string, sub: string, pts: number, label: string) =>
      <button type="button" className="pin" id="pin" aria-label={t('k.around.open')} onClick={toAround}><span className="pin-rank"><span className="sr-only">{t('k.rank.sr', { n: rank })}</span><span aria-hidden="true">{rank}</span></span><span className="pin-main"><b>{title}</b><span>{sub}</span></span><span className="pin-pts">{F.pts(pts)}<small>{label}</small></span></button>;
    if (held) pin = <aside className="pin pin--wide" id="pin" aria-label={t('k.you')}><span className="pin-main"><b>{t('k.you')}</b><span>{t('hold.rank.pin')}</span></span><span className="pin-pts">{F.pts(d.me.points)}<small>{t(w === 'last' ? 'k.lastweek' : 'r.week')}</small></span></aside>;
    else if (w === 'last') pin = bar(d.me.rank || 0, t('k.you'), t('k.final.h'), d.me.points, t('k.lastweek'));
    else if (d.me.rank === null) pin = <aside className="pin pin--wide" id="pin" aria-label={t('k.you')}><div className="pin-main"><b>{t('k.none.h')}</b><span id="pin-elig">{elig()}</span></div><Html as="span" style={{ display: 'contents' }} html={btn(t('k.play'), { sm: true, href: '/', cls: 'btn-onink' })} /></aside>;
    else if (d.me.rank <= 10) pin = bar(d.me.rank, t('k.in'), t('k.prize', { c: F.prize(d.me.prize || 0) }), d.me.points, t('r.week'));
    else pin = bar(d.me.rank, t('k.you'), t('k.gap', { gap: F.int(d.me.gap || 0) }), d.me.points, t('r.week'));
  }
  const onClick = (e: React.MouseEvent) => { if ((e.target as Element).closest('#how') && d) howSheet(d); };
  const ends = cur.data?.endsAt;
  const live = ends ? '<span>' + t('k.ends') + '</span> <b data-cd="' + Math.round((ends - Date.now()) / 1000) + '" data-cd-end="' + ends + '" data-cd-fmt="dh"></b>' : '';
  return (
    <Shell tab="rank" cls="sc-rank" docTitle={t('k.title')} live={live} head={<Html className="ph-top" html={'<h1>' + t('k.title') + '</h1>'} />} pin={pin}>
      {st === 'error' || q.isError ? <Html as="div" style={{ display: 'contents' }} html={errorNote()} /> : (
        <>
          <Seg<'current' | 'last'> label={t('k.week')} value={week} onChange={setWeek} items={[{ label: t('r.week'), value: 'current' }, { label: t('k.lastweek'), value: 'last' }]} />
          <Html className="pg-view" id="view" html={html} onClick={onClick} ref={viewRef} />
        </>
      )}
    </Shell>
  );
}
