// /data, the public data room (DECISIONS "Data room", "Data room: outside comparison"): how the players picked, posted when a
// day closes and before its answers. Opens in any browser tab without sign in or install, and inside the app. Composed like a
// newspaper's poll column: the masthead of the cover pages, one figure (how often the larger share was right), then one
// section per closed day with one easy line per question ("62% Yes", and "7 points above Polymarket" where a market is
// linked). Everything else (players, top players, the outside price, the answer) sits behind a tap on the row.
// Rows are not framed: an ink frame means a pressable control, and a row is a line of the paper.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useDataRoom } from '../api';
import { currentLang, t, useLang } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { gapText, outsideGap, outsideShare, shareText, sideWord, splitView, topView, type SplitView, type Words } from '../lib/dataLine';
import { empty, errorNote, icon, qbtn, skel, plate } from '../ui/h';
import { Html, Shell, usePlateFit } from '../ui/kit';
import { usePreset } from '../state/app';
import type { DataDay, DataMarket } from '../api/types';

/** a share as a figure that never leaves its unit */
const nw = (n: number) => '<span class="nw">' + n + '%</span>';
const ANG = [-4, 3, -2, 4, -3, 2];

/** the figure of a row: the larger side's share with that answer's ink mark, "50% : 50%" between both marks, or Counting */
function figHtml(v: SplitView, w: Words): string {
  if (v.kind === 'counting') return '<span class="dr-fig dr-fig--count">' + t('dr.counting') + '</span>';
  // the ink mark rides inside the figure's no wrap span, so mark, figure and unit never part
  if (v.kind === 'even') return '<span class="dr-fig"><span class="nw"><i class="dr-mk" aria-hidden="true"></i>' + t('dr.even') + '<i class="dr-mk dr-mk--r dr-mk--end" aria-hidden="true"></i></span></span>';
  const mk = '<i class="dr-mk' + (v.side === 'r' ? ' dr-mk--r' : '') + '" aria-hidden="true"></i>';
  return '<span class="dr-fig">' + shareText(v, { l: esc(w.l), r: esc(w.r) }, t, (n) => '<span class="nw">' + mk + n + '%</span>') + '</span>';
}
/** the thin bar of the two inks, left by its share; none while counting */
function barHtml(v: SplitView): string {
  if (v.kind === 'counting') return '';
  const left = v.kind === 'even' ? 50 : v.side === 'l' ? v.share : 100 - v.share;
  return '<span class="dr-bar" aria-hidden="true"><i style="width:' + left + '%"></i><i></i></span>';
}

export default function DataRoom({ inApp }: { inApp: boolean }) {
  useLang();
  const nav = useNavigate();
  const st = usePreset();
  const q = useDataRoom();
  const L = currentLang();
  const [more, setMore] = useState<DataDay[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => { setMore([]); setCursor(undefined); }, [q.dataUpdatedAt]);
  const loading = st === 'loading' || q.isPending;
  const failed = st === 'error' || q.isError;
  const next = cursor === undefined ? q.data?.nextCursor ?? null : cursor;

  let stampN = 0;   // stamps land in list order, each at its own small angle
  function row(m: DataMarket): string {
    const tx = m.text[L] || m.text.en, w: Words = { l: tx.a, r: tx.b };
    const v = splitView(m.split), id = 'dx-' + m.marketId;
    const gap = gapText(outsideGap(v, m.outside), t);
    const k = m.crowdRight === null ? 0 : stampN++;
    // "Crowd right" is ink, not blue: blue stamps are the player's own rewards
    const stamp = m.crowdRight === null ? '' : '<span class="rstamp rstamp--' + (m.crowdRight ? 'ink' : 'miss') + (reduceMotion() ? '' : ' is-land') + '" style="--rot:' + ANG[k % ANG.length] + 'deg;--d:' + Math.min(k, 9) * 70 + 'ms">' + t(m.crowdRight ? 'dr.st.right' : 'dr.st.wrong') + '</span>';
    // the detail: players, the top players' share, the outside price with its link, and the answer once known
    const tv = topView(m.split);
    const pmLine = m.outside && /^https:\/\//.test(m.outside.url) && v.kind !== 'counting'
      ? '<span class="dr-x-pm"><b>' + t('dr.x.pm') + ':</b> <a class="linkish" href="' + esc(m.outside.url) + '" target="_blank" rel="noopener" data-pm>' +
        shareText(v.kind === 'even' ? { kind: 'side', side: 'r', share: outsideShare(v, m.outside) } : { kind: 'side', side: v.side, share: outsideShare(v, m.outside) }, { l: esc(w.l), r: esc(w.r) }, t, nw) + icon('ext', 16) + '</a></span>'
      : '';
    const x = '<span><b>' + t('dr.x.players') + ':</b> <span class="tnum">' + F.int(m.split.players) + '</span></span>' +
      (tv && v.kind !== 'counting' ? '<span><b>' + t('dr.x.top') + ':</b> ' + shareText(tv, { l: esc(w.l), r: esc(w.r) }, t, nw) + '</span>' : '') + pmLine +
      (m.outcome ? '<span><b>' + t('r.x.answer') + ':</b> ' + esc(sideWord(m.outcome, w)) + '</span>' : '<span>' + t('dr.x.noanswer') + '</span>');
    return '<li><button type="button" class="rrow dr-row' + (stamp ? '' : ' dr-row--plain') + '" aria-expanded="false" aria-controls="' + id + '">' +
      '<span class="rs-main">' + figHtml(v, w) + '<span class="dr-q">' + esc(tx.title) + '</span>' + (gap ? '<span class="dr-pm">' + gap + '</span>' : '') + '</span>' +
      (stamp ? '<span class="rs-side">' + stamp + '</span>' : '') + icon('down', 18, 'rrow-ch') + barHtml(v) + '</button>' +
      '<div class="rrow-more" id="' + id + '" hidden><div class="rrow-clip">' + x + '</div></div></li>';
  }
  const day = (d: DataDay) => '<section class="sec dr-day" data-day="' + d.dayId + '"><h2>' + F.weekday(d.dayId * 86400000) + '</h2><ul class="list">' + d.markets.map(row).join('') + '</ul></section>';

  const head = '<div class="dr-head"><h1>' + t('dr.title') + '</h1>' + qbtn('data', t('dr.title')) + '</div>';
  let body: string;
  let dayHtml: [number, string][] = [];
  if (failed) body = errorNote();
  else if (loading) body = '<div aria-busy="true">' + skel('60%', '30px', 'margin-bottom:var(--s-16)') + [1, 2].map(() => '<section class="sec dr-day">' + skel('110px', '20px') + '<ul class="list">' + [1, 2, 3].map(() => '<li class="rrow"><span class="rs-main">' + skel('96px', '26px') + skel('90%', '15px') + '</span></li>').join('') + '</ul></section>').join('') + '<p class="sr-only" role="status">' + t('common.loading') + '</p></div>';
  else {
    const r = q.data!;
    const days = [...r.days, ...more];
    if (!days.length) body = empty({ icon: 'clock', title: t('dr.empty.h') });
    else {
      const c = r.crowd;
      const crowd = c.rightPercent === null ? '' : '<p class="dr-crowd" aria-label="' + esc(t('dr.crowd.sr', { p: c.rightPercent, n: F.int(c.questions) })) + '"><span class="dr-crowd-l" aria-hidden="true">' + t('dr.crowd') + '</span>' +
        '<b class="dr-crowd-fig nw" aria-hidden="true">' + c.rightPercent + '%</b><small class="dr-crowd-n tnum" aria-hidden="true">' + t('dr.crowd.n', { n: F.int(c.questions) }) + '</small></p>';
      body = crowd;
      // one block per day, so the days already on the page (and an open row) stay as they are when earlier days arrive
      dayHtml = days.map((d) => [d.dayId, day(d)]);
    }
  }
  const page = head + body;

  // the detail unfolds under its row like a clipping (the Results pattern)
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    if (el.closest('[data-back]') && (window.history.state?.idx ?? 0) > 0) { e.preventDefault(); nav(-1); return; }
    const b = el.closest('button.dr-row'); if (!b) return;
    const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open));
    const m = document.getElementById(b.getAttribute('aria-controls')!) as (HTMLElement & { _h?: ReturnType<typeof setTimeout> }) | null; if (!m) return;
    clearTimeout(m._h);
    if (open) { m.hidden = false; void m.offsetHeight; m.classList.add('is-open'); } else { m.classList.remove('is-open'); m._h = setTimeout(() => { m.hidden = true; }, reduceMotion() ? 0 : 250); }
  };
  const rootRef = useRef<HTMLDivElement>(null);
  // ?state=open: the first row opened in place (design review)
  useEffect(() => { if (st === 'open' && q.data) (rootRef.current?.querySelector('button.dr-row') as HTMLButtonElement | null)?.click(); }, [q.dataUpdatedAt, st]); // eslint-disable-line
  const plateRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { plateRef.current = rootRef.current?.querySelector('.gate-bar .plate') as HTMLElement | null; });
  usePlateFit(plateRef, undefined, []);

  const loadMore = async () => {
    if (!next || moreBusy) return;
    setMoreBusy(true);
    try { const r = await api.getDataRoom(next); setMore((m) => [...m, ...r.days]); setCursor(r.nextCursor); } catch { /* the button stays for another try */ } finally { setMoreBusy(false); }
  };
  const back = inApp ? '/results' : '/';
  const bar = '<header class="gate-bar"><a class="mast-back" href="' + back + '" aria-label="' + esc(t('hd.back')) + '" data-back>' + icon('back', 22) + '</a><span class="mast-home">' + plate() + '</span></header><div class="oxford" aria-hidden="true"></div>';
  const showMore = !loading && !failed && !!q.data && (q.data.days.length + more.length) > 0 && !!next;
  return (
    <Shell bare docTitle={t('dr.title')} raw={
      <div className="auth dr" ref={rootRef} onClick={onClick}>
        <Html as="div" style={{ display: 'contents' }} html={bar} />
        <article className="dr-page" id="data">
          <Html as="div" style={{ display: 'contents' }} html={page} />
          {dayHtml.length > 0 && <div className="dr-days" id="dr-days">{dayHtml.map(([k, h]) => <Html key={k} as="div" style={{ display: 'contents' }} html={h} />)}</div>}
          {showMore && <button type="button" className="btn btn-block" id="dr-more" onClick={loadMore} disabled={moreBusy}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<path d="M6 9l6 6 6-6"/>' }} /><span>{t('r.more')}</span></button>}
          {!inApp && <Html as="p" className="dr-app" html={'<a class="linkish" href="/gate" id="dr-getapp">' + t('dr.getapp') + icon('chev', 16) + '</a>'} />}
        </article>
      </div>
    } />
  );
}
