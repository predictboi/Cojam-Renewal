// H2 Home, terminal view (platform/design/home-terminal.html): the five questions as a list, one open at a time.
// Same outbox as the card view: a pick is held 3 seconds with Undo, then sent.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../api';
import { t } from '../i18n';
import { esc, reduceMotion } from '../lib/fmt';
import { btn, icon, note, pick, skel, tag, thumb } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { outbox, hasOutbox, kick, slowCount, useOutbox, viewOf } from '../chain/outbox/runner';
import { UNDO_MS } from '../chain/outbox/policy';
import { usePlay, playHere, retryReconnect } from '../state/play';
import { useWalletStore } from '../wallet/wallet';
import { HomeHead, useSlots, useFreshReset, playBannerHtml, holdPanel, otherDevicePanel, emptySet, closedSet, takeLeft, noteLeft, type Slot } from './HomeCards';
import { errorNote } from '../ui/h';

export default function HomeList() {
  const st = usePreset();
  useFreshReset(st);
  const nav = useNavigate();
  const today = useToday();
  const hold = useHold() || st === 'hold';
  const offline = useOffline();
  const play = usePlay((s) => s.status);
  const items = useOutbox((s) => s.items);
  const player = useWalletStore((s) => s.address);
  const slots = useSlots(today.data, st === 'syncing' || st === 'slow' ? 'syncing-list' : st);
  // list presets: q1 answered, q2 picked and saving (syncing, slow) or failed
  const presetRow = (s: Slot): Slot => {
    if (!st || st === 'fresh' || st === 'partial0' || st === 'hold') return s;
    if (s.m.n === 2 && (st === 'syncing' || st === 'slow')) return { ...s, seg: 'pend', answered: true };
    if (s.m.n === 2 && st === 'failed') return { ...s, seg: 'fail', answered: false };
    if (s.m.n === 2) return { ...s, seg: 'done', answered: true };
    return s;
  };
  const rows = slots.map(presetRow);
  const count = rows.filter((s) => s.answered).length;
  const firstOpen = () => rows.find((s) => !s.answered)?.m.n ?? null;
  const [current, setCurrent] = useState<number | null>(null);
  const cur = current && rows.find((r) => r.m.n === current && !r.answered) ? current : firstOpen();
  const dayItems = items.filter((i) => today.data && i.dayId === today.data.dayId);
  const held = dayItems.filter((i) => i.state === 'held').sort((a, b) => a.createdAt - b.createdAt);
  const [fin] = useState(() => !st && count === 5 && !held.length);
  const [leaving, setLeaving] = useState(false);
  const lastPick = useRef(0);
  const finishing = useRef(false);
  const slow = st === 'slow' ? 1 : slowCount(dayItems);
  const bannerState = st === 'reconnect' || st === 'reconnectfail' ? st : play === 'reconnect' || play === 'reconnectfail' ? play : '';
  const loading = st === 'loading' || today.isPending;
  const endsAt = today.data?.nextOpenAt ?? Date.now() + 3600_000;
  useEffect(() => { try { localStorage.setItem('cjp.view', 'term'); } catch { /* */ } }, []);
  useEffect(() => {
    const n = takeLeft(); if (n) toast(n > 1 ? t('h.left.savedn', { n }) : t('h.left.saved'));
    if (st === 'failed') toast(t('h.toast.fail', { n: 2 }), { btn: t('common.retry') });
  }, []);
  useEffect(() => {
    const flush = () => { if (!hasOutbox()) return; void outbox().flush().then((n) => { noteLeft(n); kick(); }); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); if (!finishing.current) flush(); };
  }, []);
  // the hold window ticks the "Finishing in 3" line
  const [, tick] = useState(0);
  useEffect(() => { if (!held.length) return; const i = setInterval(() => tick((x) => x + 1), 100); return () => clearInterval(i); }, [held.length]);
  // all five picked and nothing left to undo: day done opens
  useEffect(() => {
    if (fin || st || count < 5 || held.length || leaving || !today.data) return;
    finishing.current = true; setLeaving(true);
    const tm = setTimeout(() => nav('/done?moment=1'), reduceMotion() ? 0 : 500);
    return () => clearTimeout(tm);
  }, [count, held.length]);
  // focus the opened question
  const focusNext = useRef(false);
  useEffect(() => { if (focusNext.current) { focusNext.current = false; (document.getElementById('open-q') as HTMLElement | null)?.focus({ preventScroll: true }); } });

  function row(s: Slot): string {
    const q = s.q, n = q.n, num = '<span class="trow-n" aria-hidden="true">0' + n + '</span>', tg = tag(t('cat.' + q.cat));
    const it = s.item, v = viewOf(it);
    const failed = s.seg === 'fail';
    if (s.answered) {
      const dir: 'l' | 'r' = s.m.choice.chain ? (s.m.choice.chain === 1 ? 'l' : 'r') : it ? (it.choice === 1 ? 'l' : 'r') : n === 2 && st ? 'l' : 'r';
      const isHeld = v === 'held';
      const undo = isHeld ? '<button type="button" class="undo" data-undo="' + n + '" aria-label="' + esc(t('h.undo.aria', { n, choice: q[dir] })) + '"><svg class="undo-ring" viewBox="0 0 22 22" aria-hidden="true"><circle class="trk" cx="11" cy="11" r="8"/><circle class="run" cx="11" cy="11" r="8" style="animation-duration:' + UNDO_MS + 'ms;animation-delay:-' + (Date.now() - it!.createdAt) + 'ms"/></svg><span>' + t('h.undo') + '</span></button>' : '';
      const saving = s.seg === 'pend' && !isHeld;
      return '<li class="trow is-done">' + num + '<div><p class="trow-q">' + esc(q.title) + '</p><div class="trow-foot">' + (undo ? '' : tg) + '<span class="trow-state">' +
        (saving ? '<span class="spin"></span><span class="sr-only">' + t('common.saving') + '</span>' : undo ? '' : icon('check', 16)) + t('h.t.chose', { choice: pick(dir, esc(q[dir])) }) + '</span>' + undo + '</div></div>' + thumb(q.img, q.cat) + '</li>';
    }
    if (n === cur) {
      return '<li class="trow is-open' + (failed ? ' is-fail' : '') + '">' + num + '<div><h2 class="trow-q" tabindex="-1" id="open-q">' + esc(q.title) + '</h2><div class="trow-foot">' + tg +
        (failed ? '<span class="trow-state">' + icon('warn', 16) + t('h.t.notsaved') + '</span>' : '') + '</div></div>' + thumb(q.img, q.cat) +
        '<div class="trow-body"><div class="qcard-meta"><span>' + icon('search', 14) + '<span>' + t('h.answer', { rule: esc(q.rule) }) + '</span></span><button type="button" class="qmeta-btn" data-ai-info="' + esc(q.id) + '" aria-haspopup="dialog">' + icon('clock', 14) + '<span>' + t('h.ai', { time: esc(q.settle) }) + '</span>' + icon('info', 14) + '</button></div>' +
        '<div class="choices">' + (['l', 'r'] as const).map((d) => '<button type="button" class="choice" data-pick="' + n + '" data-dir="' + d + '"' + (offline ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(t('h.pick.aria', { choice: q[d], q: q.title })) + '">' + (d === 'l' ? icon('left', 18) : '') + '<span>' + esc(q[d]) + '</span>' + (d === 'r' ? icon('right', 18) : '') + '</button>').join('') + '</div>' +
        (offline ? '<p class="small muted">' + t('h.offline') + '</p>' : '<p class="qcard-final">' + t('h.final') + '</p>') + '</div></li>';
    }
    return '<li class="trow' + (failed ? ' is-fail' : '') + '">' + num + '<div><p class="trow-q">' + esc(q.title) + '</p><div class="trow-foot">' + tg +
      (failed ? '<span class="trow-state">' + icon('warn', 16) + t('h.t.notsaved') + '</span>' : '') +
      btn(failed ? t('h.t.again') : t('h.t.pick'), { sm: true, attrs: 'data-open="' + n + '"' }) + '</div></div>' + thumb(q.img, q.cat) + '</li>';
  }

  // under the list once all five are picked: "Finishing in 3" with "Finish now", then "Saving", on a finished day the link
  const p = held[held.length - 1];
  const mode = count < 5 ? '' : held.length ? 'wait' : fin && !leaving ? 'fin' : 'saving';
  const endHtml = !mode ? '' : '<div class="term-end-txt"><h2>' + t('h.end.h') + '</h2><p id="term-end-p">' + (mode === 'fin' ? t('h.fin.b') : mode === 'saving' ? '<span class="spin"></span>' + t('h.end.b') : t('h.end.in', { n: '<b>' + Math.max(1, Math.ceil((UNDO_MS - (Date.now() - p!.createdAt)) / 1000)) + '</b>' })) + '</p></div>' +
    (mode === 'wait' ? btn(t('h.end.now'), { kind: 'primary', block: true, id: 'finish' }) : mode === 'fin' ? btn(t('h.fin.btn'), { kind: 'primary', block: true, href: today.data?.completed ? '/done' : '/done?moment=1', iconEnd: 'right' }) : '');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (mode === 'wait') endRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, [mode]);

  const onClick = async (e: React.MouseEvent) => {
    const el = e.target as Element;
    if (el.closest('[data-retry-now]')) { kick(); return; }
    if (el.closest('[data-reconnect]')) { void retryReconnect(); return; }
    if (el.closest('[data-play-here]')) { void playHere(); return; }
    if (el.closest('#finish')) { finishing.current = true; setLeaving(true); if (hasOutbox()) { await outbox().flush(); kick(); } nav('/done?moment=1'); return; }
    const o = el.closest('[data-open]'); if (o) { focusNext.current = true; setCurrent(+o.getAttribute('data-open')!); return; }
    const u = el.closest('[data-undo]');
    if (u) { if (!hasOutbox()) return; const it = await outbox().undo(); if (it) { focusNext.current = true; setCurrent(it.slot + 1); live(t('h.undone', { n: it.slot + 1 })); } return; }
    const b = el.closest('[data-pick]') as HTMLButtonElement | null; if (!b || b.disabled) return;
    if (offline) { toast(t('h.offline'), { key: 'offline' }); return; }
    if (Date.now() - lastPick.current < 400) return;
    lastPick.current = Date.now();
    const n = +b.getAttribute('data-pick')!, dir = b.getAttribute('data-dir') as 'l' | 'r';
    const s = rows.find((r) => r.m.n === n); if (!s || !today.data || !hasOutbox()) return;
    await outbox().commit({ marketId: s.m.marketId, dayId: today.data.dayId, slot: s.m.slot, choice: dir === 'l' ? 1 : 2, closesAt: s.m.closesAt, player: player || '0x0' });
    kick();
    try { (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && navigator.vibrate?.(10); } catch { /* */ }
    live(t('h.live.picked', { choice: s.q[dir], k: 5 - count - 1 }));
    focusNext.current = true; setCurrent(null);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key !== 'z' && e.key !== 'Z' && e.key !== 'Backspace') || e.repeat || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('#sheet-root.is-open')) return;
      const u = document.querySelector('[data-undo]') as HTMLButtonElement | null; if (u) { e.preventDefault(); u.click(); }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);

  let body: string;
  if (loading) body = '<ol class="term" aria-busy="true">' + [1, 2, 3, 4, 5].map((n) => '<li class="trow"><span class="trow-n" aria-hidden="true">0' + n + '</span><div>' + skel('94%', '16px') + '<div class="trow-foot">' + skel('64px', '22px') + skel('72px') + '</div></div></li>').join('') + '</ol><p class="sr-only" role="status">' + t('common.loading') + '</p>';
  else if (today.isError || st === 'error') body = errorNote();
  else if (today.data!.state === 'empty') body = emptySet(endsAt);
  else if (today.data!.state === 'closed') body = closedSet('/list');
  else if (st === 'otherdevice' || play === 'otherdevice') body = otherDevicePanel();
  else if (hold) body = holdPanel();
  else body = (offline ? note('warn', t('h.offline')) : '') + playBannerHtml(bannerState, slow) + '<ol class="term" id="term">' + rows.map(row).join('') + '</ol>';
  const noClock = st === 'empty' || hold || today.data?.state === 'empty' || today.data?.state === 'closed';
  const showList = !loading && !today.isError && today.data?.state === 'open' && !hold && st !== 'otherdevice' && st !== 'error';
  return (
    <Shell tab="home" docTitle={t('h.title')} badges={{ home: fin || hold ? 0 : 'dot' }}
      head={<HomeHead view="term" count={count} segs={rows.map((r) => r.seg)} loading={loading} noClock={noClock} endsAt={endsAt} />}>
      <div style={{ display: 'contents' }} onClick={onClick}>
        <Html as="div" style={{ display: 'contents' }} html={body} />
        {showList && <div ref={endRef} className={'term-end' + (mode === 'fin' ? ' is-fin' : '')} id="term-end" hidden={!mode} dangerouslySetInnerHTML={{ __html: endHtml }} />}
      </div>
    </Shell>
  );
}
