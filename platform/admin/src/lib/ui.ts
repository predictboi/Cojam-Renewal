// Shared behaviour, ported from admin.js: confirmation sheets (with the required audit note), the drawer, toasts,
// the live region, the delegated click and input listeners (copy, sort, log filters, json details, switches,
// segmented pickers, character counters) and the countdown tick. Screens register their actions in `acts`.
// One difference from the static prototype: a confirmation can carry `run(note)`, the real write. While it runs the
// action button is busy; a failure is shown inside the sheet and the sheet stays open, so nothing is lost.
import { X, esc, ic, short, sortTable, dur } from './x';

export type Act = (arg: string | undefined, el: HTMLElement) => void;
export const acts: Record<string, Act> = {};
/** Replaces the screen's actions; the owner signing sheet's own actions (flow-*) survive re-renders. */
export function setActs(map: Record<string, Act>) { for (const k of Object.keys(acts)) if (!k.startsWith('flow-')) delete acts[k]; Object.assign(acts, map); }

const hooks = { nav: (_to: string) => {}, reload: () => location.reload(), go: (_state: string) => {} };
export function setHooks(h: Partial<typeof hooks>) { Object.assign(hooks, h); }
export const go = (state: string) => hooks.go(state);
export const nav = (to: string) => hooks.nav(to);

/* ---------- dialog (confirmation sheet) and drawer ---------- */
let opener: Element | null = null;
let onClose: (() => void) | null = null;
export interface SheetOpts { title?: string; body: string; action?: string; cancel?: string | false; drawer?: boolean; wide?: boolean | number; alert?: boolean; sticky?: boolean; onClose?: () => void }
export function sheet(o: SheetOpts): HTMLElement {
  closeSheet(true);
  opener = document.activeElement;
  const el = document.createElement('div');
  el.className = 'scrim' + (o.drawer ? ' side-r' : '');
  el.id = 'sheet';
  el.innerHTML = o.drawer ? '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1">' + o.body + '</aside>' :
    '<div class="dlg' + (o.wide ? ' wide' : '') + '" role="' + (o.alert ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1"><h2 id="sheet-h">' + o.title + '</h2>' + o.body +
    '<div class="dlg-foot">' + (o.cancel === false ? '' : '<button type="button" class="link" data-close>' + (o.cancel || 'Cancel') + '</button>') + (o.action || '') + '</div></div>';
  document.body.appendChild(el);
  document.documentElement.style.overflow = 'hidden';
  onClose = o.onClose || null;
  const box = el.firstElementChild as HTMLElement, f = (box.querySelector('[autofocus]') as HTMLElement) || box;
  f.focus();
  el.addEventListener('mousedown', (e) => { if (e.target === el && !el.dataset.sticky) closeSheet(); });
  if (o.sticky) el.dataset.sticky = '1';
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.dataset.sticky) { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const items = box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]'); if (!items.length) return;
    const a = items[0], z = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === a || document.activeElement === box)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  return el;
}
export function closeSheet(silent?: boolean) {
  const el = document.getElementById('sheet'); if (!el) return;
  el.remove(); document.documentElement.style.overflow = '';
  const cb = onClose; onClose = null; pendingConfirm = null;
  if (opener && (opener as HTMLElement).focus) (opener as HTMLElement).focus();
  if (!silent && cb) cb();
}
export const sheetBox = () => document.querySelector('#sheet .dlg, #sheet .drawer') as HTMLElement | null;

export interface ConfirmOpts {
  title: string; body?: string; reason?: false; reasonLabel?: string; placeholder?: string; prefill?: string; reasonErr?: string; signer?: string;
  danger?: boolean | number; action: string; cancel?: string; done?: string; next?: string; wide?: boolean | number; onClose?: () => void;
  /** the real write; receives the note. Resolve with an optional toast message, throw to keep the sheet open with the error. */
  run?: (note: string) => Promise<string | void>;
}
let pendingConfirm: ConfirmOpts | null = null;
/** A confirmation that needs a written reason: the action stays off until the note is long enough. */
export function confirm(o: ConfirmOpts) {
  const el = sheet({ title: o.title, alert: true, wide: o.wide, onClose: o.onClose, cancel: o.cancel, body: (o.body || '') +
    (o.reason === false ? '' : '<div class="fl"><label for="why">' + (o.reasonLabel || 'Reason') + ' <span class="cnt">Required, written to the audit log</span></label><textarea class="inp" id="why" rows="3" data-why autofocus placeholder="' + esc(o.placeholder || 'What did you check, and why is this right?') + '">' + esc(o.prefill || '') + '</textarea><p class="err" hidden data-why-err>' + ic('warn') + (o.reasonErr || 'Give a reason.') + '</p></div>') +
    '<div data-run-err style="display:contents"></div>' + (o.signer ? '<p class="hint">' + o.signer + '</p>' : ''),
    action: '<button type="button" class="btn btn-primary' + (o.danger ? ' btn-danger' : '') + '" data-confirm="' + esc(o.done || 'Done.') + '"' + (o.next ? ' data-next="' + o.next + '"' : '') + '>' + o.action + '</button>' });
  pendingConfirm = o;
  return el;
}
/** Shows an error inside the open sheet (the write failed; nothing changed). */
export function sheetError(html: string) {
  const box = document.querySelector('#sheet [data-run-err]') || sheetBox();
  if (!box) { toast(html.replace(/<[^>]+>/g, '')); return; }
  const div = document.createElement('div');
  div.innerHTML = '<div class="note" data-k="down" role="alert">' + ic('warn') + '<div>' + html + '</div></div><div style="height:12px"></div>';
  if ((box as HTMLElement).dataset.runErr !== undefined) box.innerHTML = div.innerHTML; else box.prepend(div);
}

export function toast(msg: string) {
  const box = document.querySelector('.toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
export function live(msg: string) { const l = document.getElementById('live'); if (l) l.textContent = msg; }
export function busy(b: HTMLButtonElement, label: string) {
  b.dataset.label = b.innerHTML; b.disabled = true; b.classList.add('is-busy'); b.innerHTML = '<span class="spin"></span>' + esc(label);
}
export function unbusy(b: HTMLButtonElement) { if (b.dataset.label) b.innerHTML = b.dataset.label; b.disabled = false; b.classList.remove('is-busy'); }

/* ---------- countdowns: every [data-cd] counts down ---------- */
let ticking = 0;
export function tick() {
  if (ticking) return;
  ticking = window.setInterval(() => {
    document.querySelectorAll<HTMLElement>('[data-cd]').forEach((el) => { const s = Math.max(0, +(el.dataset.cd as string) - 1); el.dataset.cd = String(s); el.textContent = dur(s); });
  }, 1000);
}

/* ---------- shared behaviour ---------- */
let installed = false;
export function installBehaviours() {
  if (installed) return; installed = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // in app links: client side navigation
    const a = target.closest('a[href]') as HTMLAnchorElement | null;
    if (a && !a.target && !a.hasAttribute('download') && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.origin === location.origin && !a.href.startsWith('mailto:') && !a.closest('[data-native]')) {
      const url = new URL(a.href);
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return; // in page anchor
      e.preventDefault();
      closeSheet(true);
      hooks.nav(url.pathname + url.search + url.hash);
      return;
    }
    const t = target.closest('[data-copy], [data-sort], [data-json], [data-close], [data-reload], [data-confirm], [data-act], [data-lv], [role=switch], .seg[data-pick] > button') as HTMLElement | null;
    if (!t) return;
    if (t.dataset.copy) { if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.copy).catch(() => {}); toast('Copied ' + short(t.dataset.copy)); }
    else if (t.dataset.sort != null) sortTable(t, live);
    else if (t.hasAttribute('data-json')) { const pre = t.nextElementSibling as HTMLElement, open = t.getAttribute('aria-expanded') === 'true'; t.setAttribute('aria-expanded', String(!open)); pre.hidden = open; t.textContent = open ? 'Details' : 'Hide details'; }
    else if (t.hasAttribute('data-close')) { if (X.mock && X.state && t.closest('#sheet') && SHEET_STATES.has(X.state)) { closeSheet(true); hooks.go(''); } else closeSheet(); }
    else if (t.hasAttribute('data-reload')) hooks.reload();
    else if (t.dataset.confirm != null) void runConfirm(t as HTMLButtonElement);
    else if (t.dataset.lv != null) {
      t.parentNode!.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
      const ol = t.closest('.log-tools')!.nextElementSibling as HTMLElement;
      ol.querySelectorAll<HTMLElement>('li').forEach((li) => { li.hidden = !!t.dataset.lv && li.dataset.lv !== t.dataset.lv; });
    }
    else if (t.getAttribute('role') === 'switch' && !t.dataset.act) t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true'));
    else if ((t.parentNode as HTMLElement).dataset && (t.parentNode as HTMLElement).dataset.pick != null && !t.dataset.act) {
      const p = t.parentNode as HTMLElement;
      p.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
      const f = acts[p.dataset.pick as string]; if (f) f((t as HTMLButtonElement).value, t);
    }
    else if (t.dataset.act && acts[t.dataset.act]) acts[t.dataset.act](t.dataset.arg, t);
  });
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-logq]')) { const v = t.value.toLowerCase(); (t.closest('.log-tools')!.nextElementSibling as HTMLElement).querySelectorAll<HTMLElement>('li').forEach((li) => { li.hidden = !!v && li.textContent!.toLowerCase().indexOf(v) < 0; }); }
    if (t.matches('[data-max]')) {
      const c = document.querySelector('[data-count="' + t.id + '"]');
      if (c) { const left = +(t.dataset.max as string) - [...t.value].length; c.textContent = left < 0 ? -left + ' over' : left + ' left'; if (left < 0) { c.setAttribute('data-over', ''); t.setAttribute('aria-invalid', 'true'); } else { c.removeAttribute('data-over'); t.removeAttribute('aria-invalid'); } }
    }
    if (t.matches('[data-why]') && t.value.trim().length >= 8) { t.removeAttribute('aria-invalid'); const er = document.querySelector('[data-why-err]') as HTMLElement | null; if (er) er.hidden = true; }
  });
}
/** states whose whole point is an open sheet: closing it returns to the screen's default state (mock review) */
export const SHEET_STATES = new Set(['review', 'connect', 'wrongwallet', 'signing', 'failed', 'cancel', 'swap', 'void', 'correct', 'sign', 'maint', 'disabledomain', 'detail', 'block', 'blockerror', 'clear', 'unblock']);

async function runConfirm(t: HTMLButtonElement) {
  const why = document.querySelector('[data-why]') as HTMLTextAreaElement | null;
  if (why && why.value.trim().length < 8) {
    const er = document.querySelector('[data-why-err]') as HTMLElement; er.hidden = false; why.setAttribute('aria-invalid', 'true'); why.setAttribute('aria-describedby', 'why-err'); er.id = 'why-err'; why.focus(); return;
  }
  const o = pendingConfirm, next = t.dataset.next, msg = t.dataset.confirm as string;
  if (o?.run) {
    busy(t, 'Working');
    try {
      const out = await o.run(why ? why.value.trim() : '');
      closeSheet(true);
      toast(out || msg);
    } catch (err) {
      unbusy(t);
      sheetError(errText(err));
    }
    return;
  }
  if (next) { closeSheet(true); hooks.go(next); } else { closeSheet(true); toast(msg); }
}

/** A readable sentence for any thrown error (admin API errors carry code and message). */
export function errText(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number };
  const map: Record<string, string> = {
    ADMIN_FORBIDDEN: 'Your role cannot do this.', FORBIDDEN: 'This account is not on the admin allow list.', UNAUTHORIZED: 'Your session ended. Sign in again.',
    QUESTION_PUBLISHED: 'The question is already on chain and can no longer be changed.', CORRECTION_WINDOW_OVER: 'The correction window has ended.',
    NETWORK: 'The admin API did not answer. Check the connection and try again.', NOT_FOUND: 'Not found: it may have changed in the meantime. Refresh and try again.',
  };
  const lead = (e?.code && map[e.code]) || '';
  const detail = e?.message && e.message !== lead ? esc(e.message) : '';
  return '<b>Nothing was changed.</b> ' + (lead ? esc(lead) + ' ' : '') + detail;
}
