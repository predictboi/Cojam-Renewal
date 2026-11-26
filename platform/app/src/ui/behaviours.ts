// Global behaviours of the prototype (components.js), installed once: press feedback, copy controls, sheet close,
// grip drag, focus trap, the language select, in app links, and the "enhance" pass that brings countdowns,
// "Updated n s ago" stamps and interest tickers to life wherever they appear (a MutationObserver finds them).
import { setLang, t, type Lang } from '../i18n';
import { F, reduceMotion } from '../lib/fmt';
import { icon } from './h';
import { live, sheet, toast } from '../state/ui';

type Nav = (to: string) => void;
const hooks: { nav: Nav; reload: () => void; ai: (id: string) => void; offline: () => boolean } = {
  nav: (to) => { location.href = to; },
  reload: () => location.reload(),
  ai: () => {},
  offline: () => false,
};
export function setBehaviourHooks(h: Partial<typeof hooks>) { Object.assign(hooks, h); }

const $ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as E | null;
const $$ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as E[];

/* ---------- enhance: countdowns, stamps, tickers ---------- */
function enhance(root: ParentNode) {
  $$('[data-cd]', root).forEach((el) => {
    const x = el as HTMLElement & { _cd?: number };
    if (x._cd) return;
    const endAttr = el.getAttribute('data-cd-end');
    const end = endAttr ? +endAttr : Date.now() + +el.getAttribute('data-cd')! * 1000;
    const fmt = el.getAttribute('data-cd-fmt') || 'inline';
    let lastMin = -1, zero = false;
    const tick = () => {
      if (!el.isConnected) { clearInterval(x._cd); return; }
      const s = Math.max(0, Math.round((end - Date.now()) / 1000)), p = F.hms(s);
      const sr = el.parentNode?.querySelector('[data-cd-sr]');
      if (sr && +p[1] !== lastMin) { lastMin = +p[1]; sr.textContent = t('d.next.sr', { h: +p[0], m: +p[1] }); }
      if (fmt === 'clock') { const sp = $$('span', el); sp[0].textContent = p[0]; sp[1].textContent = p[1]; sp[2].textContent = p[2]; }
      else if (fmt === 'dh') el.textContent = t('k.dh', { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) });
      else el.textContent = p.join(':');
      if (s === 0 && !zero) { zero = true; el.dispatchEvent(new CustomEvent('cd:zero', { bubbles: true })); }
    };
    tick();
    x._cd = window.setInterval(tick, 1000);
  });
  $$('[data-stamp]', root).forEach((el) => {
    const x = el as HTMLElement & { _st?: number };
    if (x._st) return;
    let n = +el.getAttribute('data-stamp')!;
    x._st = window.setInterval(() => { if (!el.isConnected) { clearInterval(x._st); return; } n = n >= 59 ? 1 : n + 1; el.textContent = t('common.updated', { n }); }, 1000);
  });
  /* interest tickers: data-tick="start value|per second|cap" */
  $$('[data-tick]', root).forEach((el) => {
    const x = el as HTMLElement & { _tk?: number };
    if (x._tk || hooks.offline()) return;
    const p = el.getAttribute('data-tick')!.split('|'), v = +p[0], rate = +p[1], t0 = Date.now(), cap = p[2] ? +p[2] : Infinity;
    x._tk = window.setInterval(() => {
      if (!el.isConnected) { clearInterval(x._tk); return; }
      el.textContent = Number(Math.min(cap, v + (rate * (Date.now() - t0)) / 1000)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }, reduceMotion() ? 10000 : 1000);
  });
}

let installed = false;
export function installBehaviours() {
  if (installed) return;
  installed = true;
  enhance(document);
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) enhance(n as Element); });
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('is-hidden', document.hidden));

  /* press feedback */
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest?.('.btn, .choice, .seg-btn, .field-max, .period button, .undo') as HTMLButtonElement | null;
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    el.classList.add('is-pressed');
    const t0 = Date.now();
    const up = () => {
      setTimeout(() => el.classList.remove('is-pressed'), Math.max(0, 90 - (Date.now() - t0)));
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });

  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    const c = target.closest?.('[data-copy]') as (HTMLElement & { _old?: string | null }) | null;
    if (c) {
      const text = c.getAttribute('data-copy')!;
      try { void navigator.clipboard?.writeText(text).catch(() => {}); } catch { /* */ }
      if (c.hasAttribute('data-toast')) toast(c.getAttribute('data-toast')!);
      const dn = c.getAttribute('data-done'), lab = $('span', c);
      if (dn && lab && !c._old) {
        const chip = c.classList.contains('addr-chip'), svg = chip ? $('svg', c) : null, was = svg?.outerHTML;
        if (chip) { c.style.minWidth = c.offsetWidth + 'px'; if (svg) svg.outerHTML = icon('check', 16); live(dn); }
        if (c.classList.contains('code-block')) live(dn);
        c._old = lab.textContent; lab.textContent = dn; c.classList.add('is-done');
        setTimeout(() => {
          lab.textContent = c._old ?? ''; c._old = null; c.classList.remove('is-done');
          if (chip) { const s2 = $('svg', c); if (s2 && was) s2.outerHTML = was; c.style.minWidth = ''; }
        }, 2000);
      }
      if (c.classList.contains('btn-icon')) { const old = c.innerHTML; c.classList.add('is-done'); c.innerHTML = icon('check', 18); setTimeout(() => { c.classList.remove('is-done'); c.innerHTML = old; }, 1600); }
      return;
    }
    if (target.closest?.('[data-sheet-scrim]') && sheet.closable()) { sheet.close(); return; }
    if (target.closest?.('[data-sheet-close]')) { sheet.close(); return; }
    if (target.closest?.('[data-reload]')) { e.preventDefault(); hooks.reload(); return; }
    const tm = target.closest?.('[data-toast-msg]'); if (tm) toast(tm.getAttribute('data-toast-msg')!);
    const ai = target.closest?.('[data-ai-info]'); if (ai) { hooks.ai(ai.getAttribute('data-ai-info')!); return; }
    /* in app links rendered inside HTML strings */
    const a = target.closest?.('a[href]') as HTMLAnchorElement | null;
    if (a && !e.defaultPrevented && !a.target && !a.hasAttribute('download') && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      const href = a.getAttribute('href')!;
      if (href.startsWith('/') && !href.startsWith('//') && !a.hasAttribute('data-rr')) { e.preventDefault(); hooks.nav(href); }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.matches?.('[data-lang]')) setLang(el.value as Lang);
  });

  document.addEventListener('keydown', (e) => {
    const open = $('#sheet-root.is-open');
    if (e.key === 'Escape' && open) {
      if (sheet.closable()) sheet.close();
      else { const vb = $<HTMLButtonElement>('#sheet [data-tx="cancel"], #sheet [data-tx="hide"]'); vb?.click(); }
    }
    if (e.key === 'Tab' && open) {
      const f = $$<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select', $('#sheet')!);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#sheet'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* grip drag closes the sheet where closing is allowed */
  let y0: number | null = null, sh: HTMLElement | null = null;
  document.addEventListener('pointerdown', (e) => { if (!(e.target as Element).closest?.('[data-grip]') || !sheet.closable()) return; sh = $('#sheet'); y0 = e.clientY; if (sh) sh.style.transition = 'none'; });
  document.addEventListener('pointermove', (e) => { if (y0 === null || !sh) return; sh.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; });
  document.addEventListener('pointerup', (e) => { if (y0 === null || !sh) return; const d = e.clientY - y0; y0 = null; sh.style.transition = ''; if (d > 80) sheet.close(); else sh.style.transform = ''; });
}
