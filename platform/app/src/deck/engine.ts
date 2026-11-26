// The swipe card stack: a port of App.deck in platform/design/assets/components.js (spec 6.3), unchanged in feel.
// Drag follows the finger, a release past the threshold (or a fling) throws the card, the next one springs forward.
// Release: a drag commits past 35% of the card width however slowly it was made. A fling commits only with real travel
// (96 px at 0.5 px/ms) or with clearly more speed (1.1 px/ms after 56 px), always in the direction of the drag. A drag that
// is more vertical than horizontal never commits. Guards: for 400 ms after a commit a tap on an answer is dropped, while a
// swipe or a key press within 200 ms is a second deliberate pick: one is queued and plays when that guard ends.
// Differences from the prototype: React owns the card elements, so a thrown card is hidden (not removed) after its
// throw, and restore() unhides it for Undo. The cards may sit in a display: contents wrapper inside the deck.
import { reduceMotion } from '../lib/fmt';

export type Dir = 'l' | 'r';
export interface DeckOpts {
  disabled?: () => boolean;
  onBlocked?: () => void;
  onCommit?: (n: number, dir: Dir, remaining: number, card: HTMLElement) => void;
  nokeys?: boolean;
}
export interface DeckApi { layout(): void; live(): HTMLElement[]; restore(card: HTMLElement, dir: Dir): void; destroy(): void }

const $ = (sel: string, root: ParentNode) => root.querySelector(sel) as HTMLElement | null;
const $$ = (sel: string, root: ParentNode) => Array.from(root.querySelectorAll(sel)) as HTMLElement[];

export function createDeck(root: HTMLElement, o: DeckOpts = {}): DeckApi {
  const reduce = reduceMotion();
  const ARM = 0.35, GUARD = 200, TAP_GUARD = 400, FLING = { far: 96, v: 0.5, near: 56, fast: 1.1 };
  let guardUntil = 0, tapUntil = 0, queued: Dir | null = null, qTimer: ReturnType<typeof setTimeout> | undefined;
  const live = () => $$('.qcard:not(.is-out)', root);
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
  }
  function buzz(ms: number) { try { navigator.vibrate?.(ms); } catch { /* */ } }
  function paint(card: HTMLElement, k: number, armed: boolean) {
    const dir = k > 0 ? 'r' : k < 0 ? 'l' : '', a = Math.abs(k);
    $$('.choice', card).forEach((b) => b.classList.toggle('is-hot', !!armed && b.getAttribute('data-dir') === dir));
    const tint = $('.qtint', card)!; if (dir) tint.setAttribute('data-dir', dir); tint.style.opacity = armed ? '0.2' : '0';
    const hint = armed ? 1 : Math.min(0.4, a * 1.6);
    const sl = $('.qstamp--l', card)!, sr = $('.qstamp--r', card)!;
    sl.style.opacity = String(dir === 'l' ? hint : 0); sr.style.opacity = String(dir === 'r' ? hint : 0);
    sl.classList.toggle('is-armed', !!armed && dir === 'l'); sr.classList.toggle('is-armed', !!armed && dir === 'r');
  }
  function feedback(card: HTMLElement, dx: number, dy: number) {
    const w = card.offsetWidth, k = Math.max(-1, Math.min(1, dx / w));
    card.style.transform = 'translate(' + dx + 'px,' + (dy * 0.18).toFixed(1) + 'px)' + (reduce ? '' : ' rotate(' + (k * 8).toFixed(2) + 'deg)');
    paint(card, k, Math.abs(k) >= ARM);
    return k;
  }
  function reset(card: HTMLElement) { card.classList.remove('is-drag'); card.style.transform = ''; paint(card, 0, false); }
  const off = (sign: number, w: number, dy?: number) => 'translate(' + sign * (innerWidth * 0.5 + w) + 'px,' + ((dy || 0) * 0.4 + 30).toFixed(0) + 'px) rotate(' + sign * 22 + 'deg)';
  function commit(card: HTMLElement, dir: Dir, v: number, dx: number, dy: number, src: string) {
    if (card.classList.contains('is-out')) return;
    if (o.disabled?.()) { reset(card); o.onBlocked?.(); return; }
    if (src === 'tap' ? Date.now() < tapUntil : guarded()) { reset(card); if (src !== 'tap') queue(dir); return; }
    guardUntil = Date.now() + GUARD; tapUntil = Date.now() + TAP_GUARD;
    const w = card.offsetWidth, sign = dir === 'r' ? 1 : -1, dist = innerWidth * 0.5 + w - Math.abs(dx || 0);
    const ms = reduce ? 200 : Math.round(Math.max(190, Math.min(380, dist / Math.max(v || 0, 1.6))));
    card.classList.remove('is-drag'); card.classList.add('is-out'); card.setAttribute('data-pos', 'out');
    paint(card, sign * 0.5, true);
    card.style.transition = reduce ? '' : 'transform ' + ms + 'ms cubic-bezier(0.3, 0.55, 0.4, 1), opacity ' + ms + 'ms cubic-bezier(0.6, 0, 0.9, 0.4)';
    void card.offsetWidth;
    if (!reduce) card.style.transform = off(sign, w, dy);
    card.style.opacity = '0';
    buzz(12);
    layout();
    if (card.contains(document.activeElement)) root.focus({ preventScroll: true });
    (card as HTMLElement & { _rm?: ReturnType<typeof setTimeout> })._rm = setTimeout(() => { card.hidden = true; }, ms + 40);
    o.onCommit?.(+card.getAttribute('data-q')!, dir, live().length, card);
  }
  /* Undo: the thrown card flies back in from the side it left and takes the front */
  function restore(card: HTMLElement, dir: Dir) {
    clearTimeout((card as HTMLElement & { _rm?: ReturnType<typeof setTimeout> })._rm);
    const first = live()[0] || null, sign = dir === 'r' ? 1 : -1;
    card.hidden = false;
    card.style.transition = 'none'; card.style.opacity = '0';
    if (!reduce) card.style.transform = off(sign, root.offsetWidth, 0);
    card.classList.remove('is-out', 'is-drag'); paint(card, 0, false);
    const parent = card.parentNode as HTMLElement;
    parent.insertBefore(card, first && first.parentNode === parent ? first : parent.firstChild);
    card.setAttribute('data-pos', '0');
    void card.offsetWidth;
    layout();
    guardUntil = tapUntil = Date.now() + 250; queued = null; clearTimeout(qTimer);
    root.focus({ preventScroll: true });
  }
  let drag: { card: HTMLElement; x: number; y: number; id: number; lock: boolean; armed: boolean; pts: { x: number; t: number }[] } | null = null, swallow = 0;
  const down = (e: PointerEvent) => {
    const card = (e.target as Element).closest('.qcard[data-pos="0"]') as HTMLElement | null;
    if (!card || card.classList.contains('is-out') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { card, x: e.clientX, y: e.clientY, id: e.pointerId, lock: false, armed: false, pts: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.lock) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.lock = true; drag.card.classList.add('is-drag'); try { drag.card.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    e.preventDefault();
    drag.pts.push({ x: e.clientX, t: e.timeStamp }); if (drag.pts.length > 8) drag.pts.shift();
    const k = feedback(drag.card, dx, dy), armed = Math.abs(k) >= ARM && Math.abs(dx) > Math.abs(dy);
    if (armed !== drag.armed) { drag.armed = armed; if (armed) buzz(5); }
  };
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; if (!d.lock) return;
    swallow = Date.now();
    const dx = e.clientX - d.x, dy = e.clientY - d.y, w = d.card.offsetWidth, ax = Math.abs(dx), sign = dx > 0 ? 1 : -1;
    const pts = d.pts.filter((p) => e.timeStamp - p.t <= 100), a = pts[0], b = pts[pts.length - 1];
    const v = a && b.t > a.t ? Math.max(0, (sign * (b.x - a.x)) / (b.t - a.t)) : 0;
    const fling = (ax >= FLING.far && v >= FLING.v) || (ax >= FLING.near && v >= FLING.fast);
    if (e.type !== 'pointercancel' && ax > Math.abs(dy) && (ax / w >= ARM || fling)) commit(d.card, sign > 0 ? 'r' : 'l', v, dx, dy, 'swipe'); else reset(d.card);
  };
  const click = (e: MouseEvent) => {
    const b = (e.target as Element).closest('.choice') as HTMLButtonElement | null; if (!b || b.disabled) return;
    if (Date.now() - swallow < 250) { e.preventDefault(); return; }
    const card = b.closest('.qcard') as HTMLElement; if (card.getAttribute('data-pos') !== '0') return;
    commit(card, b.getAttribute('data-dir') as Dir, 0, 0, 0, 'tap');
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('#sheet-root.is-open')) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && a !== root && !root.contains(a) && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(a.tagName)) return;
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
    layout, live, restore,
    destroy() {
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', end); root.removeEventListener('pointercancel', end);
      root.removeEventListener('click', click); document.removeEventListener('keydown', key); clearTimeout(qTimer);
    },
  };
}
