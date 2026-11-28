// The swipe card stack: a port of App.deck in platform/design-variants/paper/assets/app.js (spec 6.3, MOTION.md section 1).
// Drag follows the finger; the sheet lifts (1.012, a flat ink shadow) and turns about the hand. Under the threshold the
// answer shows as a dashed proof stamp; at the threshold it presses in. A release past the threshold (35% of the width) or
// a flick (48 px at a peak of 0.6 px/ms) throws the card; across must be 1.3 times the vertical travel. A tap or a key holds
// the sheet 130 ms while the stamp lands, then throws it. Guards: a tap within 400 ms of a pick is dropped, a swipe or a key
// within 200 ms is queued. Differences from the prototype: React owns the card elements, so a thrown card is hidden (not
// removed) after its throw, and restore() unhides it for Undo. The cards may sit in a display: contents wrapper.
import { reduceMotion } from '../lib/fmt';

export type Dir = 'l' | 'r';
export type PickSource = 'swipe' | 'tap' | 'key' | 'queue';
export interface DeckOpts {
  disabled?: () => boolean;
  onBlocked?: () => void;
  onCommit?: (n: number, dir: Dir, remaining: number, card: HTMLElement, src: PickSource) => void;
  nokeys?: boolean;
}
export interface DeckApi { layout(): void; live(): HTMLElement[]; restore(card: HTMLElement, dir: Dir): void; fit(): void; destroy(): void }

const $ = (sel: string, root: ParentNode) => root.querySelector(sel) as HTMLElement | null;
const $$ = (sel: string, root: ParentNode) => Array.from(root.querySelectorAll(sel)) as HTMLElement[];
type Card = HTMLElement & { _rm?: ReturnType<typeof setTimeout>; _fly?: ReturnType<typeof setTimeout>; _bk?: ReturnType<typeof setTimeout>; _low?: boolean };

export function createDeck(root: HTMLElement, o: DeckOpts = {}): DeckApi {
  const reduce = reduceMotion();
  const ARM = 0.35, GUARD = 200, TAP_GUARD = 400, FLING = { far: 48, v: 0.6 }, SLOPE = 1.3;
  let guardUntil = 0, tapUntil = 0, queued: Dir | null = null, qTimer: ReturnType<typeof setTimeout> | undefined;
  const live = () => $$('.qcard:not(.is-out)', root) as Card[];
  const guarded = () => Date.now() < guardUntil;
  function queue(dir: Dir) {
    queued = dir; clearTimeout(qTimer);
    qTimer = setTimeout(() => { const d = queued, c = live()[0]; queued = null; if (d && c) commit(c, d, 0, 0, 0, 'queue'); }, Math.max(0, guardUntil - Date.now()) + 10);
  }
  function layout() {
    const cards = live();
    cards.forEach((c, i) => {
      c.setAttribute('data-pos', i < 3 ? String(i) : 'x'); c.style.transform = ''; c.style.transition = ''; c.style.opacity = '';
      if (i === 0) c.removeAttribute('inert'); else c.setAttribute('inert', '');
      if (i === 1 || i === 2) { const im = $('img', c) as HTMLImageElement | null; if (im?.decode) im.decode().catch(() => {}); }
    });
    root.classList.toggle('is-empty', !cards.length);
    fit();
  }
  /* the picture needs 64 px to read (a strip); with less it is dropped (never a sliver). The card keeps the deck's height: the
     question block is centred and the headline set one size up when that still fits. Still too short: the deck grows. */
  function fit() {
    root.style.minHeight = '';
    const c = live()[0]; if (!c) return;
    // measured with transitions off: under reduced motion every property still transitions for a moment, and a read in the
    // same frame would see the size of the class just removed
    c.classList.add('is-measuring'); requestAnimationFrame(() => c.classList.remove('is-measuring'));
    c.classList.remove('is-tight', 'is-up', 'is-snug');
    let need = 0;
    const measure = () => { const body = $('.qcard-body', c), top = $('.qcard-top', c); need = (top ? top.offsetHeight : 0) + (body ? body.offsetHeight : 0) + 4; return root.clientHeight - need - 12; };
    let room = measure();
    // From 600 px of height the card always has its picture, as a band of at least 72 px: the card closes up first (a smaller
    // headline, tighter gaps, the second source sentence moves to Rules); if that is not enough the deck grows and the page scrolls.
    if (window.innerHeight >= 600) {
      if (room < 72) { c.classList.add('is-snug'); room = measure(); }
      if (room < 72) root.style.minHeight = need + 12 + 72 + 'px';
      return;
    }
    if (room < 64) { c.classList.add('is-tight'); if (room > 20) { c.classList.add('is-up'); if (c.scrollHeight > c.clientHeight + 1) c.classList.remove('is-up'); } }
    if (root.clientHeight < need) root.style.minHeight = need + 'px';
  }
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  // the faces are self hosted subsets that load on first use: measure again whenever a face arrives
  const onFonts = () => { if (root.isConnected) fit(); };
  void document.fonts?.ready.then(onFonts);
  document.fonts?.addEventListener?.('loadingdone', onFonts);
  // a face can arrive before this deck exists (fonts.ready resolves early with lazy subsets): measure once more after the first paints
  const refits = [setTimeout(onFonts, 400), setTimeout(onFonts, 1200)];
  function buzz(ms: number) { try { (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && navigator.vibrate?.(ms); } catch { /* */ } }
  /* under the threshold the stamp is a proof (an unfilled outline that grows with the travel); at the threshold it presses in */
  function paint(card: HTMLElement, k: number, armed: boolean) {
    const dir = k > 0 ? 'r' : k < 0 ? 'l' : '', a = Math.abs(k);
    $$('.choice', card).forEach((b) => b.classList.toggle('is-hot', !!armed && b.getAttribute('data-dir') === dir));
    const tint = $('.qtint', card); if (tint) { if (dir) tint.setAttribute('data-dir', dir); tint.style.opacity = armed ? '0.2' : '0'; }
    ([['l', 7], ['r', -7]] as const).forEach(([d, rot]) => {
      const el = $('.qstamp--' + d, card); if (!el) return; const on = dir === d;
      el.style.opacity = String(on ? (armed ? 1 : Math.min(1, a * 12)) : 0);
      el.style.transform = on && !armed ? 'rotate(' + rot + 'deg) scale(' + (0.8 + Math.min(0.2, a * 0.58)).toFixed(3) + ')' : '';
      el.classList.toggle('is-armed', !!armed && on);
    });
  }
  /* the sheet lifts off the stack while it is held: a flat shadow of ink follows it */
  const lift = document.createElement('div'); lift.className = 'deck-lift'; lift.setAttribute('aria-hidden', 'true'); root.appendChild(lift);
  function setLift(tf: string) { root.classList.toggle('is-lift', !!tf); lift.style.transform = tf || ''; }
  function feedback(card: Card, dx: number, dy: number) {
    const w = card.offsetWidth, k = Math.max(-1, Math.min(1, dx / w));
    const rot = reduce ? '' : ' rotate(' + (k * 7 * (card._low ? -1 : 1)).toFixed(2) + 'deg)', pos = 'translate(' + dx + 'px,' + (dy * 0.18).toFixed(1) + 'px)';
    card.style.transform = pos + rot + (reduce ? '' : ' scale(1.012)');
    if (!reduce) setLift('translate(' + (dx + 5) + 'px,' + (dy * 0.18 + 9).toFixed(1) + 'px)' + rot);
    paint(card, k, Math.abs(k) >= ARM);
    return k;
  }
  /* let go under the threshold: the sheet flicks back onto the stack with a small overshoot */
  function back(card: Card) { card.classList.add('is-back'); clearTimeout(card._bk); card._bk = setTimeout(() => card.classList.remove('is-back'), 460); }
  function reset(card: Card) { card.classList.remove('is-drag'); setLift(''); back(card); card.style.transform = ''; paint(card, 0, false); }
  const off = (sign: number, w: number, dy?: number) => 'translate(' + sign * (innerWidth * 0.5 + w) + 'px,' + ((dy || 0) * 0.4 + 30).toFixed(0) + 'px) rotate(' + sign * 18 + 'deg)';
  function commit(card: Card, dir: Dir, v: number, dx: number, dy: number, src: PickSource) {
    if (card.classList.contains('is-out')) return;
    if (o.disabled?.()) { reset(card); o.onBlocked?.(); return; }
    if (src === 'tap' ? Date.now() < tapUntil : guarded()) { reset(card); if (src !== 'tap') queue(dir); return; }
    guardUntil = Date.now() + GUARD; tapUntil = Date.now() + TAP_GUARD;
    const w = card.offsetWidth, sign = dir === 'r' ? 1 : -1, dist = innerWidth * 0.5 + w - Math.abs(dx || 0);
    const ms = reduce ? 200 : Math.round(Math.max(190, Math.min(380, dist / Math.max(v || 0, 1.6))));
    card.classList.remove('is-drag', 'is-back'); card.classList.add('is-out'); card.setAttribute('data-pos', 'out'); setLift('');
    paint(card, sign * 0.5, true);
    $('.qstamp--' + dir, card)?.classList.add('is-thunk');   // the stamp comes down for good
    // a tap or a key has no drag to show the stamp: the sheet holds 130 ms while it lands, then it is thrown. The pick is taken at once.
    const hold = src === 'swipe' || reduce ? 0 : 130;
    const fly = () => {
      card.style.transition = reduce ? '' : 'transform ' + ms + 'ms cubic-bezier(0.3, 0.55, 0.4, 1), opacity ' + ms + 'ms cubic-bezier(0.6, 0, 0.9, 0.4)';
      void card.offsetWidth;
      if (!reduce) card.style.transform = off(sign, w, dy);
      card.style.opacity = '0';
    };
    if (hold) { card.style.transition = 'transform 130ms cubic-bezier(0.23, 1, 0.32, 1)'; card.style.transform = 'translateY(-3px) scale(1.012)'; card._fly = setTimeout(fly, hold); } else fly();
    buzz(12);
    layout();
    if (card.contains(document.activeElement)) root.focus({ preventScroll: true });
    card._rm = setTimeout(() => { card.hidden = true; }, ms + 40 + hold);
    o.onCommit?.(+card.getAttribute('data-q')!, dir, live().length, card, src);
  }
  /* Undo: the thrown card comes back in low from the side it left, still turned, and settles with the same overshoot */
  function restore(card: Card, dir: Dir) {
    clearTimeout(card._rm); clearTimeout(card._fly);
    const first = live()[0] || null, sign = dir === 'r' ? 1 : -1;
    card.hidden = false;
    card.style.transition = 'none'; card.style.opacity = '0';
    if (!reduce) card.style.transform = 'translate(' + sign * root.offsetWidth * 0.92 + 'px,26px) rotate(' + sign * 11 + 'deg)';
    card.classList.remove('is-out', 'is-drag'); paint(card, 0, false); $$('.qstamp', card).forEach((q) => q.classList.remove('is-thunk')); back(card);
    const parent = card.parentNode as HTMLElement;
    parent.insertBefore(card, first && first.parentNode === parent ? first : parent.firstChild);
    card.setAttribute('data-pos', '0');
    void card.offsetWidth;
    layout();
    guardUntil = tapUntil = Date.now() + 250; queued = null; clearTimeout(qTimer);
    root.focus({ preventScroll: true });
  }
  let drag: { card: Card; x: number; y: number; id: number; lock: boolean; armed: boolean; pts: { x: number; t: number }[] } | null = null, swallow = 0;
  const down = (e: PointerEvent) => {
    const card = (e.target as Element).closest('.qcard[data-pos="0"]') as Card | null;
    if (!card || card.classList.contains('is-out') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cr = card.getBoundingClientRect(); card._low = e.clientY > cr.top + cr.height * 0.6;
    drag = { card, x: e.clientX, y: e.clientY, id: e.pointerId, lock: false, armed: false, pts: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.lock) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }   // vertical first: hand over to page scroll
      if (Math.abs(dx) < 10) return;
      drag.lock = true; drag.card.classList.remove('is-back'); drag.card.classList.add('is-drag'); try { drag.card.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    e.preventDefault();
    drag.pts.push({ x: e.clientX, t: e.timeStamp }); if (drag.pts.length > 8) drag.pts.shift();
    const k = feedback(drag.card, dx, dy), armed = Math.abs(k) >= ARM && Math.abs(dx) > SLOPE * Math.abs(dy);
    if (armed !== drag.armed) { drag.armed = armed; if (armed) buzz(5); }   // a light tick when the release would commit
  };
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; if (!d.lock) return;
    swallow = Date.now();
    const dx = e.clientX - d.x, dy = e.clientY - d.y, w = d.card.offsetWidth, ax = Math.abs(dx), sign = dx > 0 ? 1 : -1;
    // release speed: the samples of the last 100 ms only, signed; the peak between two samples counts (a flick that slows in its last frame is still a flick)
    const pts = d.pts.filter((p) => e.timeStamp - p.t <= 100), a = pts[0], b = pts[pts.length - 1];
    let v = a && b.t > a.t ? Math.max(0, (sign * (b.x - a.x)) / (b.t - a.t)) : 0;
    for (let i = 1; i < pts.length; i++) { const dt = pts[i].t - pts[i - 1].t; if (dt > 0) v = Math.max(v, (sign * (pts[i].x - pts[i - 1].x)) / dt); }
    const fling = ax >= FLING.far && v >= FLING.v;
    if (e.type !== 'pointercancel' && ax > SLOPE * Math.abs(dy) && (ax / w >= ARM || fling)) commit(d.card, sign > 0 ? 'r' : 'l', v, dx, dy, 'swipe'); else reset(d.card);
  };
  const click = (e: MouseEvent) => {
    const b = (e.target as Element).closest('.choice') as HTMLButtonElement | null; if (!b || b.disabled) return;
    if (Date.now() - swallow < 250) { e.preventDefault(); return; }
    const card = b.closest('.qcard') as Card; if (card.getAttribute('data-pos') !== '0') return;
    commit(card, b.getAttribute('data-dir') as Dir, 0, 0, 0, 'tap');
  };
  /* arrow keys pick from anywhere on the screen, unless a form control, a link or a sheet has the focus (Undo excepted) */
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('#sheet-root.is-open')) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && a !== root && !root.contains(a) && a.id !== 'undo' && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(a.tagName)) return;
    const card = live()[0]; if (!card) return;
    e.preventDefault(); commit(card, e.key === 'ArrowRight' ? 'r' : 'l', 0, 0, 0, 'key');
  };
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('click', click);
  if (!o.nokeys) document.addEventListener('keydown', key);
  root.setAttribute('tabindex', '-1');
  layout();
  return {
    layout, live, restore, fit,
    destroy() {
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', end); root.removeEventListener('pointercancel', end);
      root.removeEventListener('click', click); document.removeEventListener('keydown', key); window.removeEventListener('resize', onResize); document.fonts?.removeEventListener?.('loadingdone', onFonts); refits.forEach(clearTimeout); clearTimeout(qTimer);
      lift.remove();
    },
  };
}
