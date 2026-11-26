// HTML string builders: a line by line port of the C.* helpers in platform/design/assets/components.js, so every
// screen keeps the approved markup and class names exactly. Static parts of a screen are built with these and set as
// innerHTML by React; interactive parts are React components (kit.tsx). Copy, sheet close, press feedback and the
// language select are handled by delegated listeners (behaviours.ts), as in the prototype.
// Everything inserted from data (names, addresses, question text) goes through esc().
import { t } from '../i18n';
import { F, esc } from '../lib/fmt';
import { IC } from './icons';

export function icon(name: string, size = 20, cls?: string): string {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (cls ? ' class="' + cls + '"' : '') + '>' + (IC[name] || '') + '</svg>';
}

export interface BtnOpts {
  kind?: 'primary' | 'ghost' | 'danger' | 'onband' | 'onink' | 'icon';
  block?: boolean; sm?: boolean; wrap?: boolean; cls?: string; loading?: boolean;
  icon?: string; iconEnd?: string; id?: string; attrs?: string; href?: string; ext?: boolean; disabled?: boolean;
}
export function btn(label: string, o: BtnOpts = {}): string {
  const cls = 'btn' + (o.kind ? ' btn-' + o.kind : '') + (o.block ? ' btn-block' : '') + (o.sm ? ' btn-sm' : '') + (o.wrap ? ' btn-wrap' : '') + (o.cls ? ' ' + o.cls : '');
  const inner = (o.loading ? '<span class="spin"></span>' : '') + (o.icon ? icon(o.icon, 18) : '') + '<span>' + label + '</span>' + (o.iconEnd ? icon(o.iconEnd, 18) : '');
  const attrs = (o.id ? ' id="' + o.id + '"' : '') + (o.attrs ? ' ' + o.attrs : '');
  if (o.href && !o.disabled) return '<a class="' + cls + '" href="' + o.href + '"' + (o.ext ? ' target="_blank" rel="noopener"' : '') + attrs + '>' + inner + '</a>';
  return '<button type="button" class="' + cls + (o.loading ? ' is-loading' : '') + '"' + (o.disabled ? ' disabled' : '') + attrs + '>' + inner + '</button>';
}

/** the signature: states is an array of 5 from "", done, pend, fail, miss, wait */
export function day5(states: string[], o: { band?: boolean; size?: string; ink?: boolean; cls?: string; label?: string; id?: string } = {}): string {
  const n = states.filter((s) => s === 'done' || s === 'pend' || s.startsWith('done')).length;
  return '<div class="day5' + (o.band ? ' day5--band' : '') + (o.size ? ' day5--' + o.size : '') + (o.ink ? ' day5--ink' : '') + (o.cls ? ' ' + o.cls : '') + '" role="img" aria-label="' + esc(o.label || t('h.prog.sr', { n })) + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
    states.map((s, i) => '<i style="--i:' + i + '"' + (s ? ' class="' + s.split(' ').map((x) => 'is-' + x).join(' ') + '"' : '') + '>' + (o.size === 'lg' ? icon('check', 24) : '') + '</i>').join('') + '</div>';
}
/** a made pick carries the colour of its answer (coral left, sky right) as a dot */
export const pick = (dir: 'l' | 'r', text: string) => '<span class="pk pk--' + dir + '"><i aria-hidden="true"></i>' + text + '</span>';
export const tag = (text: string, kind?: string, ic?: string) => '<span class="tag' + (kind ? ' tag-' + kind : '') + '">' + (ic ? icon(ic, 14) : '') + text + '</span>';
export type Row = [string, string, boolean?] | null | false | undefined;
export function rows(list: Row[]): string {
  return '<dl class="rows">' + list.filter(Boolean).map((r) => { const x = r as [string, string, boolean?]; return '<div' + (x[2] ? ' class="is-em"' : '') + '><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
}
export function note(kind: string, html: string, action = ''): string {
  const ic = kind === 'warn' || kind === 'error' ? 'warn' : kind === 'ok' ? 'check' : 'info';
  return '<div class="note' + (kind ? ' note-' + kind : '') + '"' + (kind === 'error' ? ' role="alert"' : '') + '>' + icon(ic, 18) + '<div class="note-body"><div>' + html + '</div>' + action + '</div></div>';
}
/** the player's address as a compact chip: the whole chip copies the full address */
export function addr(a: string, o: { id?: string } = {}): string {
  return '<button type="button" class="addr-chip"' + (o.id ? ' id="' + o.id + '"' : '') + ' data-copy="' + esc(a) + '" data-done="' + esc(t('w.copy.done')) + '" aria-label="' + esc(t('w.copy') + ': ' + a) + '">' +
    '<span class="addr-chip-v" translate="no">' + F.short(a) + '</span>' + icon('copy', 16) + '</button>';
}
/** an invite code as a copy block */
export function code(c: string, o: { done?: boolean; cls?: string; id?: string; label?: string } = {}): string {
  return '<button type="button" class="code-block' + (o.done ? ' is-done' : '') + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + ' data-copy="' + esc(c) + '"' + (o.done ? '' : ' data-done="' + esc(t('w.copy.done')) + '"') + '>' +
    '<b class="code-v" translate="no">' + esc(c) + '</b><i class="code-act">' + icon('copy', 18) + icon('check', 18) + '<span>' + (o.done ? t('w.copy.done') : o.label || t('common.copy')) + '</span></i></button>';
}
export function empty(o: { icon?: string; title: string; body?: string; extra?: string; action?: string }): string {
  return '<div class="empty"><div class="empty-ic">' + icon(o.icon || 'inbox', 32) + '</div><h2>' + o.title + '</h2>' + (o.body ? '<p>' + o.body + '</p>' : '') + (o.extra || '') + (o.action || '') + '</div>';
}
export const errorNote = (key?: string) => note('error', t(key || 'e.load'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' }));
export const skel = (w: string, h?: string, extra?: string) => '<span class="skel" style="width:' + w + ';height:' + (h || '14px') + ';' + (extra || '') + '"></span>';
export const help = (q: string, a: string, open?: boolean) => '<details class="help"' + (open ? ' open' : '') + '><summary>' + q + icon('down', 18) + '</summary><div class="help-body">' + a + '</div></details>';
export const stamp = (n = 4) => '<p class="stamp"><span class="live-dot"></span><span data-stamp="' + n + '">' + t('common.updated', { n }) + '</span></p>';
export const logo = () => '<span class="chip-logo"><img src="/assets/cojam-mark.svg" alt="" width="26" height="26">Cojam</span>';
export const steps = (items: [string, string?][]) => '<ol class="steps">' + items.map((s) => '<li><span>' + s[0] + '</span>' + (s[1] ? icon(s[1], 22) : '<span></span>') + '</li>').join('') + '</ol>';
export function hold(html: string, o: { action?: string; more?: boolean } = {}): string {
  return '<div class="hold" role="status">' + icon('pause', 20) + '<div class="hold-body"><b class="hold-t">' + t('hold.t') + '</b><p>' + html + '</p>' + (o.action || '') +
    (o.more === false ? '' : '<a class="hold-more" href="/system/blocked">' + t('hold.more') + icon('chev', 16) + '</a>') + '</div></div>';
}
export function banner(text: string, o: { kind?: string; spin?: boolean; icon?: string; btn?: string; attrs?: string } = {}): string {
  return '<div class="banner' + (o.kind ? ' banner-' + o.kind : '') + '" role="status">' + (o.spin ? '<span class="spin"></span>' : icon(o.icon || 'info', 18)) + '<span>' + text + '</span>' + (o.btn ? btn(o.btn, { sm: true, attrs: o.attrs || '' }) : '') + '</div>';
}
export const CAT_ICON: Record<string, string> = { crypto: 'coin', markets: 'chart', weather: 'sun', sports: 'ball', culture: 'film' };
export function thumb(img: string | null | undefined, cat: string): string {
  return '<span class="trow-thumb" aria-hidden="true">' + (img ? '<img src="' + esc(img) + '" alt="" width="52" height="52" loading="lazy">' : icon(CAT_ICON[cat] || 'spark', 24)) + '</span>';
}
export function langSelect(lang: string, names: Record<string, string>): string {
  return '<label class="select">' + icon('globe', 18) + '<span class="sr-only">' + t('lang.label') + '</span><select data-lang aria-label="' + esc(t('lang.label')) + '">' +
    Object.keys(names).map((l) => '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + names[l] + '</option>').join('') + '</select>' + icon('down', 16) + '</label>';
}
export function seg(items: { label: string; value?: string; on?: boolean; href?: string }[], o: { label?: string; name?: string; disabled?: boolean } = {}): string {
  return '<div class="seg" role="group" aria-label="' + esc(o.label || '') + '"' + (o.name ? ' data-seg="' + o.name + '"' : '') + '>' + items.map((it) => {
    if (it.href) return '<a class="seg-btn" href="' + it.href + '"' + (it.on ? ' aria-current="page"' : '') + '>' + it.label + '</a>';
    return '<button type="button" class="seg-btn" data-value="' + esc(it.value) + '" aria-pressed="' + (it.on ? 'true' : 'false') + '"' + (o.disabled ? ' disabled' : '') + '>' + it.label + '</button>';
  }).join('') + '</div>';
}
/** the steps of the transaction sheet and of the "how answers are set" sheet */
export function aiSheetHtml(rule: string, when: string): string {
  return '<h2>' + t('h.ai.h') + '</h2><ol class="txsteps txsteps--plain">' + ['h.ai.1', 'h.ai.2', 'h.ai.3'].map((k, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + t(k) + '</span></li>').join('') + '</ol>' +
    (rule || when ? rows([rule ? [t('h.ai.src'), esc(rule)] : null, when ? [t('h.ai.when'), when] : null]) : '') +
    '<div class="sheet-acts">' + btn(t('common.close'), { block: true, attrs: 'data-sheet-close' }) + '</div>';
}
export const clockHtml = (secs: number, id?: string) => {
  const p = F.hms(secs);
  const g = (v: string, u: string) => '<div class="clock-g"><span>' + v + '</span><small>' + t(u) + '</small></div>';
  return '<div class="clock" data-cd="' + secs + '" data-cd-fmt="clock"' + (id ? ' id="' + id + '"' : '') + ' aria-hidden="true">' + g(p[0], 'd.u.h') + '<i>:</i>' + g(p[1], 'd.u.m') + '<i>:</i>' + g(p[2], 'd.u.s') + '</div>' +
    '<p class="sr-only" data-cd-sr>' + t('d.next.sr', { h: +p[0], m: +p[1] }) + '</p>';
};
