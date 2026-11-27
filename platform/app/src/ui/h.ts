// HTML string builders: a port of the C.* helpers of the "Daily Paper" look (platform/design-variants/paper/assets/app.js),
// so every screen keeps the approved markup and class names exactly. Static parts of a screen are built with these and set
// as innerHTML by React; interactive parts are React components (kit.tsx). Copy, sheet close, "?" sheets, press feedback and
// the language select are handled by delegated listeners (behaviours.ts), as in the prototype.
// Everything inserted from data (names, addresses, question text) goes through esc().
import { currentLang, t } from '../i18n';
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

/** the day in five numbered boxes: empty, hatched while a pick is being saved (pend), inked when it is in (done), fail */
export function day5(states: string[], o: { size?: string; cls?: string; label?: string; id?: string } = {}): string {
  const norm = states.map((s) => (s.startsWith('done') ? 'done' : s));
  const n = norm.filter((s) => s === 'done' || s === 'pend').length;
  return '<div class="day5' + (o.size ? ' day5--' + o.size : '') + (o.cls ? ' ' + o.cls : '') + '" role="img" aria-label="' + esc(o.label || t('h.prog.sr', { n })) + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
    norm.map((s, i) => '<i' + (s ? ' class="is-' + s + '"' : '') + '><b>' + (i + 1) + '</b></i>').join('') + '</div>';
}
/** a made pick carries the ink of its answer (persimmon left, teal right) as a small printed block */
export const pick = (dir: 'l' | 'r', text: string) => '<span class="pk pk--' + dir + '"><i aria-hidden="true"></i>' + text + '</span>';
export const tag = (text: string, kind?: string, ic?: string) => '<span class="tag' + (kind ? ' tag-' + kind : '') + '">' + (ic ? icon(ic, 14) : '') + text + '</span>';
/** a result as a rubber stamp: hit (blue, the reward), miss (hollow ink), corr (dashed), ink (a state) */
export const rstamp = (kind: string, text: string) => '<span class="rstamp rstamp--' + kind + '">' + text + '</span>';
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
/* the notice: one pattern for every empty, closed and blocked state and for the system screens. A stamp that names the state
   (in place of an icon tile), the headline in the slab, one line of body, the action. */
const STAMP: Record<string, string> = { clock: 'soon', refresh: 'closed', pause: 'hold', phone: 'inuse', tool: 'maint', download: 'update', offline: 'offline', search: '404' };
export const notice = (ic?: string) => '<span class="notice-st" aria-hidden="true">' + rstamp('ink', t('pp.st.' + (STAMP[ic || ''] || 'none'))) + '</span>';
export function empty(o: { icon?: string; title: string; body?: string; extra?: string; action?: string }): string {
  return '<div class="empty">' + notice(o.icon) + '<h2>' + o.title + '</h2>' + (o.body ? '<p>' + o.body + '</p>' : '') + (o.extra || '') + (o.action || '') + '</div>';
}
export const errorNote = (key?: string) => note('error', t(key || 'e.load'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' }));
export const actbar = (b: string, n?: string) => '<div class="pin pin--act">' + b + (n ? '<p class="pin-note">' + n + '</p>' : '') + '</div>';
export const skel = (w: string, h?: string, extra?: string) => '<span class="skel" style="width:' + w + ';height:' + (h || '14px') + ';' + (extra || '') + '"></span>';
export const help = (q: string, a: string, open?: boolean) => '<details class="help"' + (open ? ' open' : '') + '><summary>' + q + icon('down', 18) + '</summary><div class="help-body">' + a + '</div></details>';
/** "Updated 6s ago": a live line, shown only where a balance could not be refreshed */
export const stamp = (n = 4) => '<span class="upd"><span data-stamp="' + n + '">' + t('common.updated', { n }) + '</span></span>';
/** the nameplate: the Cojam mark and the paper's name. It is a logo, the same in every language. */
export const plate = (big?: boolean) => '<span class="plate' + (big ? ' plate--big' : '') + '" translate="no"><img src="/assets/cojam-mark.svg" alt="" width="' + (big ? 40 : 28) + '" height="' + (big ? 40 : 28) + '"><span>Cojam Daily</span></span>';
export const logo = plate;
/** numbered steps with the icon of the control to look for */
export const steps = (items: [string, string?][]) => '<ol class="steps">' + items.map((s, i) => '<li><b class="steps-n">' + (i + 1) + '</b><span>' + s[0] + '</span>' + (s[1] ? icon(s[1], 22) : '') + '</li>').join('') + '</ol>';
export function hold(html: string, o: { action?: string; more?: boolean } = {}): string {
  return '<div class="hold" role="status">' + icon('pause', 20) + '<div class="hold-body"><b class="hold-t">' + t('hold.t') + '</b><p>' + html + '</p>' + (o.action || '') +
    (o.more === false ? '' : '<a class="hold-more" href="/system/blocked">' + t('hold.more') + icon('chev', 16) + '</a>') + '</div></div>';
}
export function banner(text: string, o: { kind?: string; spin?: boolean; icon?: string; btn?: string; attrs?: string } = {}): string {
  return '<div class="banner' + (o.kind ? ' banner-' + o.kind : '') + '" role="status">' + (o.spin ? '<span class="spin"></span>' : icon(o.icon || 'info', 18)) + '<span>' + text + '</span>' + (o.btn ? btn(o.btn, { sm: true, attrs: o.attrs || '' }) : '') + '</div>';
}
export const CAT_ICON: Record<string, string> = { crypto: 'coin', markets: 'chart', weather: 'sun', sports: 'ball', culture: 'film' };
/** the picture of a question, printed through a halftone screen in one ink; with no picture, the category icon on the same ground */
export function halftone(img: string | null | undefined, cat: string, w: number, h: number, lazy?: boolean): string {
  return img ? '<span class="ht"><img src="' + esc(img) + '" alt="" width="' + w + '" height="' + h + '" decoding="async" draggable="false"' + (lazy ? ' loading="lazy"' : '') + '></span>' : icon(CAT_ICON[cat] || 'spark', Math.min(w, 56));
}
/** the list thumbnail: the card's own print, cropped on its subject */
export function thumb(img: string | null | undefined, cat: string, focus?: string): string {
  return '<span class="thumb' + (img ? '' : ' thumb--none') + '" aria-hidden="true">' + (img ? '<span class="ht"><img src="' + esc(img) + '" alt="" width="64" height="64" loading="lazy" decoding="async" draggable="false" style="--f:' + esc(focus || '50% 15%') + '"></span>' : icon(CAT_ICON[cat] || 'spark', 28)) + '</span>';
}
/** the language control on the cover screens: a globe and a two letter code that opens the native list */
export function langSelect(lang: string, names: Record<string, string>): string {
  return '<label class="select select--code">' + icon('globe', 18) + '<span class="select-v" aria-hidden="true">' + lang.toUpperCase() + '</span><select data-lang aria-label="' + esc(t('lang.label')) + '">' +
    Object.keys(names).map((l) => '<option value="' + l + '" lang="' + l + '"' + (l === lang ? ' selected' : '') + '>' + names[l] + '</option>').join('') + '</select></label>';
}
export function seg(items: { label: string; value?: string; on?: boolean; href?: string }[], o: { label?: string; name?: string; disabled?: boolean } = {}): string {
  return '<div class="seg" role="group" aria-label="' + esc(o.label || '') + '"' + (o.name ? ' data-seg="' + o.name + '"' : '') + '>' + items.map((it) => {
    if (it.href) return '<a class="seg-btn" href="' + it.href + '"' + (it.on ? ' aria-current="page"' : '') + '>' + it.label + '</a>';
    return '<button type="button" class="seg-btn" data-value="' + esc(it.value) + '" aria-pressed="' + (it.on ? 'true' : 'false') + '"' + (o.disabled ? ' disabled' : '') + '>' + it.label + '</button>';
  }).join('') + '</div>';
}
/** "?": an explanation is never on the surface of a screen; it is one tap away, in a short sheet (see ui/info.ts) */
export const qbtn = (id: string, topic = '') => '<button type="button" class="qbtn" data-info="' + id + '" aria-haspopup="dialog" aria-label="' + esc(t('pp.more', { topic })) + '"><span aria-hidden="true">?</span></button>';
/** the steps of the "how answers are set" sheet, opened from the source line of a question */
export function aiSheetHtml(rule: string, when: string): string {
  return '<h2>' + t('h.ai.h') + '</h2><ol class="txsteps txsteps--plain">' + ['h.ai.1', 'h.ai.2', 'h.ai.3'].map((k, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + t(k) + '</span></li>').join('') + '</ol>' +
    (rule || when ? rows([rule ? [t('h.ai.src'), esc(rule)] : null, when ? [t('h.ai.when'), when] : null]) : '') +
    '<p class="sheet-warn">' + icon('undo', 18) + '<span>' + t('pp.rule.final') + '</span></p>' +
    '<div class="sheet-acts">' + btn(t('common.close'), { block: true, attrs: 'data-sheet-close' }) + '</div>';
}
/** a countdown with its label for the dateline: the visible figure is hidden from screen readers, the spoken sentence is whole */
export const count = (labelKey: string, endMs: number, id?: string) =>
  '<span class="cd"' + (id ? ' id="' + id + '"' : '') + ' aria-hidden="true"><span>' + t(labelKey) + '</span> <b data-cd="' + Math.max(0, Math.round((endMs - Date.now()) / 1000)) + '" data-cd-end="' + endMs + '"></b></span><span class="sr-only" data-cd-sr="' + labelKey + '"></span>';
export const closes = (endMs: number) => count('h.closes', endMs);

/* ---------- the edition: date, day of the week and week number are real information on the dateline ----------
   A daily set runs from 09:00 KST to 09:00 KST, which is a UTC day; the week starts on Monday. */
export function issue(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), dow = d.getUTCDay() || 7;
  const th = new Date(d); th.setUTCDate(d.getUTCDate() + 4 - dow);
  const week = Math.ceil(((+th - Date.UTC(th.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return { date: d, day: dow, week };
}
/** the dateline: the date, the issue and one live fact of the screen, divided by column rules */
export function datelineInner(liveHtml?: string): string {
  const is = issue();
  return '<span>' + F.weekday(is.date) + '</span><span>' + t('pp.issue', { d: is.day, w: is.week }) + '</span>' + (liveHtml ? '<span class="dateline-live">' + liveHtml + '</span>' : '');
}
export const dateline = (liveHtml?: string, cls = '') => '<div class="dateline' + (cls ? ' ' + cls : '') + '">' + datelineInner(liveHtml) + '</div>';
/** a short wallet address is always set in the data face (no "0x" turned into a multiplication sign) */
export const nameHtml = (n: string) => (/^0x/i.test(n) ? '<span class="mono" translate="no">' + esc(n) + '</span>' : '<span translate="no">' + esc(n) + '</span>');
export const isCjk = () => currentLang() !== 'en';
