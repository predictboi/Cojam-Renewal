// H1 Home, card view: the front page (platform/design-variants/paper/home.html). Each pick is held 3 seconds with Undo in
// the pick bar pinned above the tab bar, then signed by the play key and sent in the background (the outbox). The next card
// shows at once. The fifth pick opens day done at once; the Undo of that pick lives there for what is left of its window.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToday } from '../api';
import { t, useLang } from '../i18n';
import { esc, reduceMotion } from '../lib/fmt';
import { btn, closes, count as countCell, day5, empty, errorNote, icon, pick, skel, banner } from '../ui/h';
import { Html, Shell, Icon } from '../ui/kit';
import { qcard, qOf, viewSwitch, type Q } from '../ui/qcard';
import { createDeck, type DeckApi, type Dir } from '../deck/engine';
import { useHold, useOffline, usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { outbox, hasOutbox, kick, slowCount, useOutbox, viewOf } from '../chain/outbox/runner';
import { UNDO_MS, UNDO_HIDE_EARLY_MS, KEY_HOLD_MAX_MS } from '../chain/outbox/policy';
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
/** design presets: picks that were already being sent when the screen opened confirm after a moment (not "slow") */
export function usePresetConfirm(st: string, plan: [number, number][]): number[] {
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => { const ts = plan.map(([n, ms]) => setTimeout(() => setDone((d) => [...d, n]), ms)); return () => ts.forEach(clearTimeout); }, [st]);
  return done;
}
export function useSlots(today: Today | undefined, st: string, confirmed: number[] = []): Slot[] {
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
      if (v === 'saved') { seg = 'done'; answered = true; }
      if (v === 'failed' && !m.choice.chain) seg = 'fail';
      if (P.sending?.includes(m.n)) { seg = confirmed.includes(m.n) ? 'done' : 'pend'; answered = true; }
      if (P.fail === m.n) seg = 'fail';
      return { m, q: qOf(m), item, seg, answered };
    });
  }, [today, items, st, lang, confirmed.length]);
}

/** the head: the page title with the view switch, then the five boxes (the count is kept for screen readers) */
export function HomeHead({ view, count, segs, loading }: { view: 'card' | 'term'; count: number; segs: string[]; loading?: boolean }) {
  return (
    <>
      <Html className="ph-top" html={'<h1>' + t('h.title') + '</h1>' + viewSwitch(view)} />
      <Html className="ph-line" html={'<span class="sr-only"><span id="cnt">' + (loading ? 0 : count) + '</span>/5</span>' + day5(loading ? ['', '', '', '', ''] : segs, { id: 'day5' })} />
    </>
  );
}
/** the dateline's live fact on home: the time until the set closes, or, once the day is done, until the next set */
export function homeLive(o: { loading?: boolean; none?: boolean; fin?: boolean; endsAt: number }): string {
  if (o.none) return '';
  if (o.loading) return skel('96px', '12px');
  return o.fin ? countCell('d.next', o.endsAt) : closes(o.endsAt);
}

export function playBannerHtml(state: string, slow: number): string {
  if (state === 'slow' || slow) return banner(t('h.slow', { n: slow || 1 }), { spin: true, btn: t('h.retrynow'), attrs: 'data-retry-now' });
  if (state === 'reconnect') return banner(t('h.reconnect'), { spin: true });
  if (state === 'reconnectfail') return banner(t('h.reconnect.fail'), { kind: 'warn', icon: 'warn', btn: t('common.retry'), attrs: 'data-reconnect' });
  return '';
}
export const holdPanel = () => empty({ icon: 'pause', title: t('hold.home.h'), body: t('hold.home.b'), action: btn(t('hold.home.btn'), { href: '/system/blocked', iconEnd: 'right', id: 'hold-more' }) });
export const otherDevicePanel = () => empty({ icon: 'phone', title: t('h.other.h'), body: t('h.other.b'), action: btn(t('h.other.btn'), { kind: 'primary', attrs: 'data-play-here' }) });
export const loadingDeck = () => '<div class="deck" aria-busy="true"><div class="qcard" data-pos="0"><div class="qcard-top">' + skel('64px', '12px') + skel('72px', '12px') + '</div><div class="qimg"></div><div class="qcard-body">' + skel('92%', '24px') + skel('60%', '24px') +
  skel('100%', '40px') + '<div class="choices">' + skel('100%', '54px') + skel('100%', '54px') + '</div></div></div></div><p class="sr-only" role="status">' + t('common.loading') + '</p>';
export const emptySet = (endsAt: number) => empty({ icon: 'clock', title: t('h.empty.h'), body: t('h.empty.b', { time: t('time.kst9') }), extra: '<p class="fig" data-dg data-cd="' + Math.round((endsAt - Date.now()) / 1000) + '" data-cd-end="' + endsAt + '"></p>' });
export const closedSet = (href: string) => empty({ icon: 'refresh', title: t('h.closed'), action: btn(t('h.closed.btn'), { kind: 'primary', href }) });
/* the wait before the day is sent is a printer's rule used up from the right, the same fuse as on the pick bar */
const endRing = (id?: string) => '<div class="end-mark" aria-hidden="true">' + icon('check', 30) + '</div><span class="fuse fuse--end" aria-hidden="true"' + (id ? ' id="' + id + '"' : '') + '></span>';

/* ---------- the deck: React renders the cards once, the engine moves them ---------- */
const Cards = memo(function Cards({ cards, failedN, offline, noimgN }: { cards: Q[]; failedN?: number; offline: boolean; noimgN?: number }) {
  return <Html as="div" style={{ display: 'contents' }} html={cards.map((q) => qcard(q, { failed: failedN === q.n, disabled: offline, noimg: noimgN === q.n, final: true })).join('')} />;
});

/** the fifth pick: day done opens with the Undo of that pick for what is left of its window */
export const doneMomentHref = (it: { createdAt: number; sendAfter: number; marketId: string } | undefined) =>
  it ? '/done?moment=1&undo=' + Math.max(0, Math.min(UNDO_MS, it.sendAfter - Date.now())) + '&q=' + encodeURIComponent(it.marketId) : '/done?moment=1';

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
  const confirmed = usePresetConfirm(st, st === 'syncing' ? [[2, 2600], [3, 4000]] : []);
  const slots = useSlots(today.data, st, confirmed);
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
  const finishing = useRef(false);
  const focusUndo = useRef(false);

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
      onCommit: (n, dir, remaining, card, src) => {
        const s = slots.find((x) => x.q.n === n), td = live$.current.today;
        if (!s || !td || !hasOutbox()) return;
        const ae = document.activeElement;
        // after a pick made with the keyboard or a screen reader, Undo is where the focus goes next
        const byKey = src === 'key' || (!!ae && (ae.id === 'undo' || card.contains(ae)));
        focusUndo.current = byKey;
        stopNudge();
        live(t(byKey ? 'pp.live.key' : 'pp.live.picked', { choice: s.q[dir] }));
        (card as HTMLElement & { _dir?: Dir })._dir = dir;
        const fifth = live$.current.count + 1 >= 5 && remaining === 0;
        if (fifth) finishing.current = true;   // the fifth pick stays held: day done owns its Undo
        void outbox().commit({ marketId: s.m.marketId, dayId: td.dayId, slot: s.m.slot, choice: dir === 'l' ? 1 : 2, closesAt: s.m.closesAt, player: live$.current.player || '0x0' }).then((it) => {
          kick();
          // the fifth pick: the day done page opens at once (the throw is still on screen for a moment)
          if (fifth) setTimeout(() => nav(doneMomentHref(it || undefined)), reduceMotion() ? 0 : 320);
        });
      },
    });
    el.focus({ preventScroll: true });
    // the very first card a player ever sees leans right, then left, once: each lean shows that answer as a proof stamp
    let nudge: Animation[] = [], nudgeT: ReturnType<typeof setTimeout>[] = [];
    const stopNudge = () => { nudge.forEach((a) => { try { a.cancel(); } catch { /* */ } }); nudge = []; nudgeT.forEach(clearTimeout); nudgeT = []; el.querySelectorAll('.choice.is-hot').forEach((b) => b.classList.remove('is-hot')); el.removeAttribute('data-nudge'); };
    let seen = '1'; try { seen = localStorage.getItem(NUDGED) || ''; } catch { /* */ }
    const nt = !st && live$.current.count === 0 && !reduceMotion() && !live$.current.offline && seen !== '1' ? setTimeout(() => {
      const card = el.querySelector('.qcard[data-pos="0"]') as HTMLElement | null;
      if (!card || live$.current.count || card.classList.contains('is-drag') || !card.animate) return;
      try { localStorage.setItem(NUDGED, '1'); } catch { /* */ }
      el.setAttribute('data-nudge', '1');
      const STEP = 'steps(1, end)', PR = 'rotate(-7deg) scale(0.86)', PL = 'rotate(7deg) scale(0.86)';
      const o = { duration: 1500, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' };
      nudge = [
        card.animate([{ transform: 'none' }, { transform: 'translateX(34px) rotate(2.6deg)', offset: 0.24 }, { transform: 'translateX(34px) rotate(2.6deg)', offset: 0.4 }, { transform: 'translateX(-34px) rotate(-2.6deg)', offset: 0.68 }, { transform: 'translateX(-34px) rotate(-2.6deg)', offset: 0.82 }, { transform: 'none' }], o),
        card.querySelector('.qstamp--r')!.animate([{ opacity: 0, transform: PR, easing: STEP }, { opacity: 1, transform: PR, offset: 0.12, easing: STEP }, { opacity: 0, transform: PR, offset: 0.46, easing: STEP }, { opacity: 0, transform: PR }], { duration: 1500 }),
        card.querySelector('.qstamp--l')!.animate([{ opacity: 0, transform: PL, easing: STEP }, { opacity: 1, transform: PL, offset: 0.58, easing: STEP }, { opacity: 0, transform: PL, offset: 0.9, easing: STEP }, { opacity: 0, transform: PL }], { duration: 1500 }),
      ];
      const cr = card.querySelector('.choice[data-dir="r"]'), cl = card.querySelector('.choice[data-dir="l"]');
      nudgeT = [setTimeout(() => cr?.classList.add('is-hot'), 180), setTimeout(() => cr?.classList.remove('is-hot'), 690), setTimeout(() => cl?.classList.add('is-hot'), 870), setTimeout(() => cl?.classList.remove('is-hot'), 1350)];
      nudge[0].onfinish = stopNudge;
    }, 700) : undefined;
    el.addEventListener('pointerdown', stopNudge, true);
    document.addEventListener('keydown', stopNudge, true);
    return () => { clearTimeout(nt); stopNudge(); el.removeEventListener('pointerdown', stopNudge, true); document.removeEventListener('keydown', stopNudge, true); deck.current?.destroy(); deck.current = null; };
  }, [deckKey, !!today.data]); // eslint-disable-line

  // leaving Home inside an undo window sends the held picks at once (4.3.1); coming back says "Pick saved"
  useEffect(() => {
    const flush = () => { if (!hasOutbox() || finishing.current) return; void outbox().flush().then((n) => { noteLeft(n); kick(); }); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); flush(); };
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

  // opened with all five held or sent (a reload inside the window): day done takes over as soon as nothing can be undone
  useEffect(() => {
    if (finRef.current || st || count < 5 || held.length || finishing.current || !today.data || deckCards.length === 0) return;
    finishing.current = true;
    const tm = setTimeout(() => nav('/done?moment=1'), reduceMotion() ? 0 : 500);
    return () => clearTimeout(tm);
  }, [count, held.length]);
  const finishNow = async () => { finishing.current = true; if (hasOutbox()) { await outbox().flush(); kick(); } nav('/done?moment=1'); };

  // delegated buttons inside HTML strings
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    if (el.closest('[data-retry-now]')) { kick(); return; }
    if (el.closest('[data-reconnect]')) { void retryReconnect(); return; }
    if (el.closest('[data-play-here]')) { void playHere(); return; }
  };

  let body: React.ReactNode, hasDeck = false;
  if (loading) body = <Html as="div" style={{ display: 'contents' }} html={loadingDeck()} />;
  else if (today.isError || st === 'error') body = <Html as="div" style={{ display: 'contents' }} html={errorNote()} />;
  else if (today.data!.state === 'empty') body = <Html as="div" style={{ display: 'contents' }} html={emptySet(endsAt)} />;
  else if (today.data!.state === 'closed') body = <Html as="div" style={{ display: 'contents' }} html={closedSet('/')} />;
  else if (otherDevice) body = <Html as="div" style={{ display: 'contents' }} html={otherDevicePanel()} />;
  else if (hold) body = <Html as="div" style={{ display: 'contents' }} html={holdPanel()} />;
  else if (finRef.current && deckCards.length === 0) {
    body = <Html as="div" className="deck is-empty home-fin" html={'<div class="deck-end">' + endRing() + '<h2>' + t('h.end.h') + '</h2><p>' + t('h.fin.b') + '</p>' + btn(t('h.fin.btn'), { kind: 'primary', href: today.data!.completed ? '/done' : '/done?moment=1', iconEnd: 'right' }) + '</div>'} />;
  } else {
    hasDeck = true;
    body = (
      <>
        {playBannerHtml(bannerState, slow) && <Html as="div" style={{ display: 'contents' }} html={playBannerHtml(bannerState, slow)} />}
        <div className="deck" id="deck" ref={deckRef} key={deckKey}>
          <DeckEnd count={count} held={held} onFinish={finishNow} />
          <Cards cards={deckCards} failedN={st === 'failed' ? 2 : undefined} offline={offline} noimgN={st === 'noimage' ? 1 : undefined} />
        </div>
      </>
    );
  }
  const none = st === 'empty' || st === 'closed' || st === 'hold' || otherDevice || hold || today.data?.state === 'empty' || today.data?.state === 'closed';
  return (
    <Shell tab="home" cls={'is-home' + (offline ? ' is-offline' : '')} docTitle={t('h.title')} badges={{ home: 5 - count && !hold ? 'dot' : 0 }}
      live={homeLive({ loading, none, fin: finRef.current && deckCards.length === 0, endsAt })}
      head={<HomeHead view="card" count={count} segs={segs} loading={loading} />}
      pin={hasDeck ? <PickBar held={held} items={dayItems} slots={slots} count={count} offline={offline} onUndo={undo} focusUndo={focusUndo} sendingPreset={st === 'syncing' ? (confirmed.includes(3) ? 0 : 3) : st === 'slow' ? 2 : 0} /> : undefined}>
      <div style={{ display: 'contents' }} onClick={onClick}>{body}</div>
    </Shell>
  );
}

/* behind the last card: the wait before the day is sent ("Finishing in 3") and a button that ends it. With the fifth pick
   opening day done at once this shows only when the deck runs out some other way (for example after a reload). */
function DeckEnd({ count, held, onFinish }: { count: number; held: OutboxItem[]; onFinish: () => void }) {
  const p = held[held.length - 1];
  const on = count === 5;
  const [, force] = useState(0);
  useEffect(() => { if (!on || !p) return; const i = setInterval(() => force((x) => x + 1), 100); return () => clearInterval(i); }, [on, p?.id]);
  const left = p ? Math.max(1, Math.ceil((p.sendAfter - Date.now()) / 1000)) : 0;
  return (
    <div className="deck-end" id="deck-end" aria-hidden={on ? 'false' : 'true'}>
      <div className="end-mark" aria-hidden="true"><Icon name="check" size={30} /></div>
      <span className="fuse fuse--end" aria-hidden="true" id="end-run">{on && p && <i key={p.id} style={{ ['--gone' as string]: '-' + (Date.now() - p.createdAt) + 'ms' }} />}</span>
      <h2>{t('h.end.h')}</h2>
      <p id="end-p" dangerouslySetInnerHTML={{ __html: !on ? '' : p ? t('h.end.in', { n: '<b>' + left + '</b>' }) : t('h.end.b') }} />
      <div id="end-act">{on && p && <button type="button" className="btn btn-primary" id="finish" onClick={onFinish}><span>{t('h.end.now')}</span></button>}</div>
    </div>
  );
}

/* the pick bar, pinned directly above the tab bar: the newest held pick with Undo and its fuse, then "Saving" and "Saved",
   at rest how to pick. While Undo has keyboard focus the fuse waits (10 seconds at most from the pick). */
function PickBar({ held, items, slots, count, offline, onUndo, focusUndo, sendingPreset }: { held: OutboxItem[]; items: OutboxItem[]; slots: Slot[]; count: number; offline: boolean; onUndo: () => void; focusUndo: React.MutableRefObject<boolean>; sendingPreset: number }) {
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
  }, [p?.id, p?.sendAfter]);
  // the window closed with no pick left to undo: the announcement no longer offers Undo
  const hadHeld = useRef(false);
  useEffect(() => { if (held.length) hadHeld.current = true; else if (hadHeld.current) { hadHeld.current = false; live(t('pp.final')); } }, [held.length]);
  // keyboard focus on Undo: the fuse waits, capped at 10 s from the pick; it runs on with what was left when the focus leaves
  const paused = useRef<{ id: string; left: number } | null>(null);
  const [isPaused, setPaused] = useState(false);
  const undoRef = useRef<HTMLButtonElement>(null);
  const onFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!p || !hasOutbox() || !e.currentTarget.matches(':focus-visible') || paused.current) return;
    paused.current = { id: p.id, left: Math.max(300, p.sendAfter - Date.now()) };
    setPaused(true);
    void outbox().setHold(p.id, p.createdAt + KEY_HOLD_MAX_MS).then(() => kick());
  };
  const onBlur = () => {
    setTimeout(() => {
      if (document.activeElement?.id === 'undo' || !paused.current || !hasOutbox()) return;
      const pz = paused.current; paused.current = null; setPaused(false);
      void outbox().setHold(pz.id, Date.now() + pz.left).then(() => kick());
    }, 0);
  };
  useEffect(() => { if (!p) { paused.current = null; setPaused(false); } else if (paused.current && paused.current.id !== p.id) { const pz = paused.current; paused.current = null; setPaused(false); if (hasOutbox()) void outbox().setHold(pz.id, Date.now() + pz.left).then(() => kick()); } }, [p?.id]);
  useEffect(() => { if (p && focusUndo.current) { focusUndo.current = false; undoRef.current?.focus({ preventScroll: true }); } }, [p?.id]);
  const canHover = useMemo(() => matchMedia('(hover: hover) and (pointer: fine)').matches, []);

  let content: React.ReactNode = null;
  if (p && hideUndo !== p.id) {
    const gone = UNDO_MS - Math.max(0, Math.min(UNDO_MS, (paused.current?.left ?? (p.sendAfter - Date.now()))));
    const s = slots[p.slot]; const dir: Dir = p.choice === 1 ? 'l' : 'r';
    content = (
      <>
        <span className="fuse" aria-hidden="true"><i key={p.id + ':' + p.sendAfter} style={{ ['--gone' as string]: '-' + gone + 'ms', animationPlayState: isPaused ? 'paused' : undefined }} /></span>
        <span className="pickbar-msg" id="pick-msg"><Icon name="check" size={16} /><span dangerouslySetInnerHTML={{ __html: label(p) }} /></span>
        <button type="button" className="undo" id="undo" ref={undoRef} aria-label={t('h.undo.aria', { n: p.slot + 1, choice: s ? s.q[dir] : '' })} onClick={onUndo} onFocus={onFocus} onBlur={onBlur}>
          <Icon name="undo" size={18} /><span>{t('h.undo')}</span><kbd aria-hidden="true">Z</kbd>
        </button>
      </>
    );
  } else if (sendingPreset && !recent) {
    const s = slots[sendingPreset - 1];
    content = <span className="pickbar-msg is-quiet" role="status"><span className="spin" /><span dangerouslySetInnerHTML={{ __html: t('common.saving') + ' ' + t('h.sync', { n: sendingPreset, choice: pick('r', esc(s?.q.r || '')) }) }} /></span>;
  } else if (recent && v === 'saving') {
    content = <span className="pickbar-msg is-quiet" role="status"><span className="spin" /><span dangerouslySetInnerHTML={{ __html: t('common.saving') + ' ' + label(recent) }} /></span>;
  } else if (recent && v === 'saved' && faded !== recent.id + ':saved') {
    content = <span className={'pickbar-msg is-quiet' + (out ? ' is-out' : '')} role="status"><Icon name="check" size={16} /><span dangerouslySetInnerHTML={{ __html: t('h.saved') + ' ' + label(recent) }} /></span>;
  } else if (!offline) {
    const left = 5 - count;
    if (count === 0) content = <span className="pickbar-hint is-swipe"><Icon name="left" size={14} /><span>{t(canHover ? 'h.hint.keys' : 'h.hint.touch')}</span><Icon name="right" size={14} /></span>;
    else if (left) content = <span className="pickbar-hint"><span>{t('h.left', { n: left })}</span></span>;
  }
  return <div className="pin pickbar" id="pickbar">{content}</div>;
}
