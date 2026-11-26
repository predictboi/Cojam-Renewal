// H1 Home, card view (platform/design/home-cards.html). Each pick is held 3 seconds with Undo under the deck, then
// signed by the play key and sent in the background (the outbox). The next card shows at once.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../api';
import { t, useLang } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, day5, empty, errorNote, icon, pick, skel, banner } from '../ui/h';
import { Html, Shell, Icon } from '../ui/kit';
import { qcard, qOf, viewSwitch, closes, type Q } from '../ui/qcard';
import { createDeck, type DeckApi, type Dir } from '../deck/engine';
import { useHold, useOffline, usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { outbox, hasOutbox, kick, slowCount, useOutbox, viewOf } from '../chain/outbox/runner';
import { UNDO_MS, UNDO_HIDE_EARLY_MS } from '../chain/outbox/policy';
import { usePlay, playHere, retryReconnect } from '../state/play';
import { useWalletStore } from '../wallet/wallet';
import { CONFIG } from '../config';
import { resetDay } from '../api/mock';
import { db } from '../chain/db';
import type { OutboxItem } from '../chain/db';
import type { Market, Today } from '../api/types';

export const LEFT_KEY = 'cjp.left';
export function takeLeft(): number { try { const n = +(sessionStorage.getItem(LEFT_KEY) || 0); sessionStorage.removeItem(LEFT_KEY); return n; } catch { return 0; } }
export function noteLeft(n: number) { if (!n) return; try { sessionStorage.setItem(LEFT_KEY, String(+(sessionStorage.getItem(LEFT_KEY) || 0) + n)); } catch { /* */ } }
const NUDGED = 'cjp.nudged';

/** "?state=fresh": the explicit reset of the mock day (dropped from the address once used) */
export function useFreshReset(st: string) {
  const nav = useNavigate();
  useEffect(() => {
    if (st !== 'fresh' || !CONFIG.mockApi) return;
    resetDay();
    void db().outbox.clear().then(() => { kick(); nav(location.pathname, { replace: true }); });
  }, [st]);
}

/* one market's state on Home: chain answer, held pick, saving, saved, failed */
export interface Slot { m: Market; q: Q; item?: OutboxItem; seg: string; answered: boolean }
export function useSlots(today: Today | undefined, st: string): Slot[] {
  const items = useOutbox((s) => s.items);
  const { lang } = useLang();
  return useMemo(() => {
    if (!today) return [];
    const preset: Record<string, { sending?: number[]; fail?: number }> = { syncing: { sending: [2, 3] }, slow: { sending: [2] }, failed: { fail: 2 } };
    const P = preset[st] || {};
    return today.markets.map((m) => {
      const item = items.find((i) => i.marketId === m.marketId && i.dayId === today.dayId);
      const v = viewOf(item);
      let seg = '', answered = false;
      if (m.choice.chain) { seg = 'done'; answered = true; }
      if (v === 'held' || v === 'saving') { seg = 'pend'; answered = true; }
      if (v === 'saved') { seg = 'done fill'; answered = true; }
      if (v === 'failed' && !m.choice.chain) seg = 'fail';
      if (P.sending?.includes(m.n)) { seg = 'pend'; answered = true; }
      if (P.fail === m.n) seg = 'fail';
      return { m, q: qOf(m), item, seg, answered };
    });
  }, [today, items, st, lang]);
}

export function HomeHead({ view, count, segs, loading, noClock, endsAt }: { view: 'card' | 'term'; count: number; segs: string[]; loading?: boolean; noClock?: boolean; endsAt?: number }) {
  const cd = noClock ? '' : loading || !endsAt ? skel('96px', '12px') : closes(endsAt);
  return (
    <>
      <Html className="ph-top" html={'<h1>' + t('h.title') + '</h1>' + viewSwitch(view)} />
      <Html className="ph-line" html={'<span class="ph-count"><span id="cnt">' + (loading ? 0 : count) + '</span><small>/5</small></span>' + day5(loading ? ['', '', '', '', ''] : segs, { band: true, id: 'day5' }) + cd} />
    </>
  );
}

export function playBannerHtml(state: string, slow: number): string {
  if (state === 'slow' || slow) return banner(t('h.slow', { n: slow || 1 }), { spin: true, btn: t('h.retrynow'), attrs: 'data-retry-now' });
  if (state === 'reconnect') return banner(t('h.reconnect'), { spin: true });
  if (state === 'reconnectfail') return banner(t('h.reconnect.fail'), { kind: 'warn', icon: 'warn', btn: t('common.retry'), attrs: 'data-reconnect' });
  return '';
}
export const holdPanel = () => empty({ icon: 'pause', title: t('hold.home.h'), body: t('hold.home.b'), action: btn(t('hold.home.btn'), { href: '/system/blocked', iconEnd: 'right', id: 'hold-more' }) });
export const otherDevicePanel = () => empty({ icon: 'phone', title: t('h.other.h'), body: t('h.other.b'), action: btn(t('h.other.btn'), { kind: 'primary', attrs: 'data-play-here' }) });
export const loadingDeck = () => '<div class="deck" aria-busy="true"><div class="qcard" data-pos="0"><div class="qimg"></div><div class="qcard-top">' + skel('72px', '28px') + skel('52px', '28px') +
  '</div><div class="qcard-body">' + skel('92%', '22px') + skel('60%', '22px') + '<div class="qcard-meta">' + skel('80%') + skel('66%') + '</div><div class="choices">' + skel('100%', '54px') + skel('100%', '54px') + '</div></div></div></div><p class="sr-only" role="status">' + t('common.loading') + '</p>';
export const emptySet = (endsAt: number) => empty({ icon: 'clock', title: t('h.empty.h'), body: t('h.empty.b', { time: t('time.kst9') }), extra: '<p class="fig fig--md" data-cd="' + Math.round((endsAt - Date.now()) / 1000) + '" data-cd-end="' + endsAt + '"></p>' });
export const closedSet = (href: string) => empty({ icon: 'refresh', title: t('h.closed'), action: btn(t('h.closed.btn'), { kind: 'primary', href }) });

/* ---------- the deck: React renders the cards once, the engine moves them ---------- */
const Cards = memo(function Cards({ cards, failedN, offline, noimgN, top }: { cards: Q[]; failedN?: number; offline: boolean; noimgN?: number; top: boolean }) {
  return <Html as="div" style={{ display: 'contents' }} html={cards.map((q) => qcard(q, { failed: failedN === q.n, disabled: offline, noimg: noimgN === q.n, top, final: true })).join('')} />;
});

export default function HomeCards() {
  const st = usePreset();
  useFreshReset(st);
  const nav = useNavigate();
  const today = useToday();
  const hold = useHold() || st === 'hold';
  const offline = useOffline();
  const play = usePlay((s) => s.status);
  const items = useOutbox((s) => s.items);
  const player = useWalletStore((s) => s.address);
  const { lang } = useLang();
  const slots = useSlots(today.data, st);
  const count = slots.filter((s) => s.answered).length;
  const segs = slots.map((s) => s.seg);
  const dayItems = items.filter((i) => today.data && i.dayId === today.data.dayId);
  const held = dayItems.filter((i) => i.state === 'held').sort((a, b) => a.createdAt - b.createdAt);
  const slow = st === 'slow' ? 1 : slowCount(dayItems);
  const bannerState = st === 'reconnect' || st === 'reconnectfail' ? st : play === 'reconnect' || play === 'reconnectfail' ? play : '';
  const otherDevice = st === 'otherdevice' || play === 'otherdevice';
  const loading = st === 'loading' || today.isPending;
  const endsAt = today.data?.nextOpenAt ?? Date.now() + 3600_000;

  // the deck is built from the unanswered cards when the set (or the language, or a failed pick) changes
  const failedIds = dayItems.filter((i) => i.state === 'failed').map((i) => i.id).join(',');
  const deckKey = (today.data?.dayId ?? 0) + ':' + lang + ':' + failedIds + ':' + st;
  const deckCards = useMemo(() => {
    const open = slots.filter((s) => !s.answered).map((s) => s.q);
    if (st === 'failed') open.sort((a, b) => (a.n === 2 ? -1 : 0) - (b.n === 2 ? -1 : 0));
    return open;
  }, [deckKey, today.dataUpdatedAt > 0]); // eslint-disable-line
  const [fin] = useState(() => !st && count === 5 && held.length === 0);
  const finRef = useRef(fin);
  if (today.data && !finRef.current && !st && count === 5 && held.length === 0 && deckCards.length === 0) finRef.current = true;

  const deckRef = useRef<HTMLDivElement>(null);
  const deck = useRef<DeckApi | null>(null);
  const live$ = useRef({ offline, count, player, today: today.data });
  live$.current = { offline, count, player, today: today.data };
  const [leaving, setLeaving] = useState(false);

  // toasts on arrival: picks sent at once because the player left inside their undo window
  useEffect(() => {
    const n = takeLeft();
    if (n) toast(n > 1 ? t('h.left.savedn', { n }) : t('h.left.saved'));
    if (st === 'failed') toast(t('h.toast.fail', { n: 2 }), { btn: t('common.retry') });
  }, []);

  // the engine
  useEffect(() => {
    const el = deckRef.current; if (!el) return;
    deck.current = createDeck(el, {
      disabled: () => live$.current.offline,
      onBlocked: () => toast(t('h.offline'), { key: 'offline' }),
      onCommit: (n, dir, remaining, card) => {
        const s = slots.find((x) => x.q.n === n), td = live$.current.today;
        if (!s || !td || !hasOutbox()) return;
        void outbox().commit({ marketId: s.m.marketId, dayId: td.dayId, slot: s.m.slot, choice: dir === 'l' ? 1 : 2, closesAt: s.m.closesAt, player: live$.current.player || '0x0' }).then(() => kick());
        stopNudge();
        live(t('h.live.picked', { choice: s.q[dir], k: remaining }));
        (card as HTMLElement & { _dir?: Dir })._dir = dir;
      },
    });
    el.focus({ preventScroll: true });
    // the very first card a player ever sees leans right, then left, once: it teaches the throw
    let nudge: Animation[] = [];
    const stopNudge = () => { nudge.forEach((a) => { try { a.cancel(); } catch { /* */ } }); nudge = []; el.removeAttribute('data-nudge'); };
    let seen = '1'; try { seen = localStorage.getItem(NUDGED) || ''; } catch { /* */ }
    const nt = !st && live$.current.count === 0 && !reduceMotion() && !live$.current.offline && seen !== '1' ? setTimeout(() => {
      const card = el.querySelector('.qcard[data-pos="0"]') as HTMLElement | null;
      if (!card || live$.current.count || card.classList.contains('is-drag') || !card.animate) return;
      try { localStorage.setItem(NUDGED, '1'); } catch { /* */ }
      el.setAttribute('data-nudge', '1');
      const o = { duration: 1500, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' };
      nudge = [
        card.animate([{ transform: 'none' }, { transform: 'translateX(34px) rotate(2.6deg)', offset: 0.24 }, { transform: 'translateX(34px) rotate(2.6deg)', offset: 0.4 }, { transform: 'translateX(-34px) rotate(-2.6deg)', offset: 0.68 }, { transform: 'translateX(-34px) rotate(-2.6deg)', offset: 0.82 }, { transform: 'none' }], o),
        card.querySelector('.qstamp--r')!.animate([{ opacity: 0 }, { opacity: 0.4, offset: 0.24 }, { opacity: 0.4, offset: 0.4 }, { opacity: 0, offset: 0.52 }, { opacity: 0 }], o),
        card.querySelector('.qstamp--l')!.animate([{ opacity: 0 }, { opacity: 0, offset: 0.54 }, { opacity: 0.4, offset: 0.68 }, { opacity: 0.4, offset: 0.82 }, { opacity: 0 }], o),
      ];
      nudge[0].onfinish = stopNudge;
    }, 700) : undefined;
    el.addEventListener('pointerdown', stopNudge, true);
    document.addEventListener('keydown', stopNudge, true);
    return () => { clearTimeout(nt); el.removeEventListener('pointerdown', stopNudge, true); document.removeEventListener('keydown', stopNudge, true); deck.current?.destroy(); deck.current = null; };
  }, [deckKey, !!today.data]); // eslint-disable-line

  // leaving Home inside an undo window sends the held picks at once (4.3.1); coming back says "Pick saved"
  useEffect(() => {
    const flush = () => { if (!hasOutbox()) return; void outbox().flush().then((n) => { noteLeft(n); kick(); }); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); if (!finishing.current) flush(); };
  }, []);

  const undo = async () => {
    if (!hasOutbox()) return;
    const it = await outbox().undo(); if (!it) return;
    const card = deckRef.current?.querySelector('.qcard[data-id="' + it.marketId + '"]') as (HTMLElement & { _dir?: Dir }) | null;
    if (card) deck.current?.restore(card, card._dir || (it.choice === 1 ? 'l' : 'r'));
    live(t('h.undone', { n: it.slot + 1 }));
  };
  // Undo from the keyboard while the window is open: Z or Backspace
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key !== 'z' && e.key !== 'Z' && e.key !== 'Backspace') || e.repeat || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('#sheet-root.is-open')) return;
      const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (!useOutbox.getState().items.some((i) => i.state === 'held')) return;
      e.preventDefault(); void undo();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  // all five picked and nothing left to undo: day done opens
  const finishing = useRef(false);
  useEffect(() => {
    if (finRef.current || st || count < 5 || held.length || leaving || !today.data) return;
    if (deckCards.length === 0) return; // opened finished: the finished panel links to day done instead
    finishing.current = true; setLeaving(true);
    const tm = setTimeout(() => nav('/done?moment=1'), reduceMotion() ? 0 : 500);
    return () => clearTimeout(tm);
  }, [count, held.length]);
  const finishNow = async () => { finishing.current = true; if (hasOutbox()) { await outbox().flush(); kick(); } setLeaving(true); nav('/done?moment=1'); };

  // delegated buttons inside HTML strings
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    if (el.closest('[data-retry-now]')) { kick(); return; }
    if (el.closest('[data-reconnect]')) { void retryReconnect(); return; }
    if (el.closest('[data-play-here]')) { void playHere(); return; }
  };

  let body: React.ReactNode;
  if (loading) body = <Html as="div" style={{ display: 'contents' }} html={loadingDeck()} />;
  else if (today.isError || st === 'error') body = <Html as="div" style={{ display: 'contents' }} html={errorNote()} />;
  else if (today.data!.state === 'empty') body = <Html as="div" style={{ display: 'contents' }} html={emptySet(endsAt)} />;
  else if (today.data!.state === 'closed') body = <Html as="div" style={{ display: 'contents' }} html={closedSet('/')} />;
  else if (otherDevice) body = <Html as="div" style={{ display: 'contents' }} html={otherDevicePanel()} />;
  else if (hold) body = <Html as="div" style={{ display: 'contents' }} html={holdPanel()} />;
  else if (finRef.current && deckCards.length === 0) {
    body = <Html as="div" className="deck is-empty home-fin" html={'<div class="deck-end"><div class="end-ring" aria-hidden="true"><svg class="ring" viewBox="0 0 92 92"><circle class="trk" cx="46" cy="46" r="40"/><circle class="run" cx="46" cy="46" r="40"/></svg>' + icon('check', 32) + '</div>' +
      '<h2>' + t('h.end.h') + '</h2><p>' + t('h.fin.b') + '</p>' + btn(t('h.fin.btn'), { kind: 'primary', href: today.data!.completed ? '/done' : '/done?moment=1', iconEnd: 'right' }) + '</div>'} />;
  } else {
    body = (
      <>
        {playBannerHtml(bannerState, slow) && <Html as="div" style={{ display: 'contents' }} html={playBannerHtml(bannerState, slow)} />}
        <div className="deck" id="deck" ref={deckRef} key={deckKey}>
          <DeckEnd count={count} held={held} deckLeft={deckRef} onFinish={finishNow} />
          <Cards cards={deckCards} failedN={st === 'failed' ? 2 : undefined} offline={offline} noimgN={undefined} top={st === 'imagetop'} />
        </div>
        <PickBar held={held} items={dayItems} slots={slots} count={count} offline={offline} onUndo={undo} sendingPreset={st === 'syncing' ? 3 : st === 'slow' ? 2 : 0} />
      </>
    );
  }
  const noClock = st === 'empty' || st === 'hold' || hold || today.data?.state === 'empty' || today.data?.state === 'closed';
  return (
    <Shell tab="home" cls={'is-home' + (offline ? ' is-offline' : '')} docTitle={t('h.title')} badges={{ home: 5 - count && !hold ? 'dot' : 0 }}
      head={<HomeHead view="card" count={count} segs={segs} loading={loading} noClock={noClock} endsAt={endsAt} />}>
      <div style={{ display: 'contents' }} onClick={onClick}>{body}</div>
    </Shell>
  );
}

/* behind the last card: the countdown of the fifth pick (a ring and "Finishing in 3") and a button that ends the wait */
function DeckEnd({ count, held, onFinish }: { count: number; held: OutboxItem[]; deckLeft: React.RefObject<HTMLDivElement | null>; onFinish: () => void }) {
  const p = held[held.length - 1];
  const on = count === 5;
  const [, force] = useState(0);
  useEffect(() => { if (!on || !p) return; const i = setInterval(() => force((x) => x + 1), 100); return () => clearInterval(i); }, [on, p?.id]);
  const left = p ? Math.max(1, Math.ceil((UNDO_MS - (Date.now() - p.createdAt)) / 1000)) : 0;
  return (
    <div className="deck-end" id="deck-end" aria-hidden={on ? 'false' : 'true'}>
      <div className="end-ring" aria-hidden="true">
        <svg className="ring" viewBox="0 0 92 92"><circle className="trk" cx="46" cy="46" r="40" />
          <circle className="run" id="end-run" cx="46" cy="46" r="40" key={p?.id || 'none'}
            style={!on ? undefined : p ? { animationDuration: UNDO_MS + 'ms', animationDelay: '-' + (Date.now() - p.createdAt) + 'ms' } : { animation: 'none', strokeDashoffset: 251.4 }} />
        </svg>
        <Icon name="check" size={32} />
      </div>
      <h2>{t('h.end.h')}</h2>
      <p id="end-p" dangerouslySetInnerHTML={{ __html: !on ? '' : p ? t('h.end.in', { n: '<b>' + left + '</b>' }) : t('h.end.b') }} />
      <div id="end-act">{on && p && <button type="button" className="btn btn-primary" id="finish" onClick={onFinish}><span>{t('h.end.now')}</span></button>}</div>
    </div>
  );
}

/* the pick bar under the deck: the newest held pick with Undo, then "Saving" and "Saved", at rest how to pick */
function PickBar({ held, items, slots, count, offline, onUndo, sendingPreset }: { held: OutboxItem[]; items: OutboxItem[]; slots: Slot[]; count: number; offline: boolean; onUndo: () => void; sendingPreset: number }) {
  const p = held[held.length - 1];
  const label = (it: { slot: number; choice: 1 | 2 }) => {
    const s = slots[it.slot]; const dir: Dir = it.choice === 1 ? 'l' : 'r';
    return t('h.sync', { n: it.slot + 1, choice: pick(dir, esc(s ? s.q[dir] : '')) });
  };
  // the most recent pick that left its window: "Saving", then "Saved" for 1.2 s, then it fades
  const recent = items.filter((i) => i.state !== 'held').sort((a, b) => (b.sentAt || b.createdAt) - (a.sentAt || a.createdAt))[0];
  const [faded, setFaded] = useState<string | null>(null);
  const [out, setOut] = useState(false);
  const v = viewOf(recent);
  useEffect(() => {
    if (!recent || v !== 'saved') return;
    setOut(false);
    const a = setTimeout(() => setOut(true), 1200), b = setTimeout(() => setFaded(recent.id + ':saved'), 1600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [recent?.id, v]);
  const [hideUndo, setHideUndo] = useState<string | null>(null);
  useEffect(() => {
    if (!p) return;
    const tm = setTimeout(() => setHideUndo(p.id), Math.max(0, p.sendAfter - UNDO_HIDE_EARLY_MS - Date.now()));
    return () => clearTimeout(tm);
  }, [p?.id]);
  const canHover = useMemo(() => matchMedia('(hover: hover) and (pointer: fine)').matches, []);

  let content: React.ReactNode = null;
  if (p) {
    const gone = Date.now() - p.createdAt;
    const s = slots[p.slot]; const dir: Dir = p.choice === 1 ? 'l' : 'r';
    content = (
      <>
        <span className="pickbar-msg" id="pick-msg"><Icon name="check" size={16} /><span dangerouslySetInnerHTML={{ __html: label(p) }} /></span>
        {hideUndo !== p.id && (
          <button type="button" className="undo" id="undo" key={p.id} aria-label={t('h.undo.aria', { n: p.slot + 1, choice: s ? s.q[dir] : '' })} onClick={onUndo}>
            <svg className="undo-ring" viewBox="0 0 22 22" aria-hidden="true"><circle className="trk" cx="11" cy="11" r="8" /><circle className="run" cx="11" cy="11" r="8" style={{ animationDuration: UNDO_MS + 'ms', animationDelay: '-' + gone + 'ms' }} /></svg>
            <span>{t('h.undo')}</span><kbd aria-hidden="true">Z</kbd>
          </button>
        )}
      </>
    );
  } else if (sendingPreset && !recent) {
    const s = slots[sendingPreset - 1];
    content = <span className="pickbar-msg is-quiet" role="status"><span className="spin" /><span dangerouslySetInnerHTML={{ __html: t('common.saving') + ': ' + t('h.sync', { n: sendingPreset, choice: pick('r', esc(s?.q.r || '')) }) }} /></span>;
  } else if (recent && v === 'saving') {
    content = <span className="pickbar-msg is-quiet" role="status"><span className="spin" /><span dangerouslySetInnerHTML={{ __html: t('common.saving') + ': ' + label(recent) }} /></span>;
  } else if (recent && v === 'saved' && faded !== recent.id + ':saved') {
    content = <span className={'pickbar-msg is-quiet' + (out ? ' is-out' : '')} role="status"><Icon name="check" size={16} /><span dangerouslySetInnerHTML={{ __html: t('h.saved') + ': ' + label(recent) }} /></span>;
  } else if (!offline) {
    const left = 5 - count;
    if (count === 0) content = <span className="pickbar-hint"><Icon name="left" size={14} /><span>{t(canHover ? 'h.hint.keys' : 'h.hint.touch')}</span><Icon name="right" size={14} /></span>;
    else if (left) content = <span className="pickbar-hint"><span>{t('h.left', { n: left })}</span></span>;
  }
  return <div className="pickbar" id="pickbar">{content}</div>;
}
