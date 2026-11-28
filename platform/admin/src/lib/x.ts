// HTML string builders: a line by line port of the helpers in platform/design/admin/admin.js (Admin.*), so every
// screen keeps the approved markup and class names and admin.css styles it unchanged. Screens build their static
// markup with these and React sets it as innerHTML; clicks are handled by delegated listeners (ui.ts).
// Everything inserted from data goes through esc().
import { CONFIG } from '../config';

/** The signed in context the builders read (role gates write buttons, env picks the explorer). */
export const X = {
  /** the ?state= preset (mock), or the navigational state (live) */
  state: '',
  env: 'kaia' as 'kaia' | 'kairos',
  role: 'operator' as 'viewer' | 'operator' | 'owner',
  get canWrite() { return this.role !== 'viewer'; },
  page: '',
  mock: CONFIG.mock,
  explorer: 'https://kaiascan.io',
};
export const is = (...s: string[]) => s.indexOf(X.state) > -1;

/* ---------- formatting ---------- */
export const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export const n = (v: number | string, dp?: number) => Number(v).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
export const pct = (v: number, dp?: number) => (isFinite(v) ? (v * 100).toFixed(dp == null ? 1 : dp) + '%' : '0%');
export const short = (a: string) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
export function dur(s: number): string {
  s = Math.max(0, Math.round(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return d ? d + 'd ' + p(h) + 'h ' + p(m) + 'm' : h ? h + 'h ' + p(m) + 'm ' + p(ss) + 's' : m + 'm ' + p(ss) + 's';
}
export const cd = (sec: number) => '<span data-cd="' + Math.max(0, Math.round(sec)) + '">' + dur(sec) + '</span>';

/* ---------- icons: one stroke weight ---------- */
const P: Record<string, string> = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  cards: '<rect x="4" y="7" width="13" height="14" rx="2.5"/><path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  podium: '<path d="M9 21V9h6v12M3 21v-7h6M15 21v-9h6v9M2 21h20"/>',
  pulse: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  warn: '<path d="M12 3.5l9.5 16.5h-19L12 3.5zM12 10v4.5M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  no: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4.5 4.5"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v9A2.5 2.5 0 0 0 6.5 19H20V8H6.5A2.5 2.5 0 0 1 4 7.5zM16 13.5h.5"/>',
  spark: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
};
export const ic = (name: string, size = 16) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
export const ICON_PATHS = P;
const SORT = '<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true"><path class="up" d="M4 0l4 5H0z"/><path class="dn" d="M4 12L0 7h8z"/></svg>';

/* ---------- small pieces ---------- */
export const STATE_KIND: Record<string, string> = {
  Live: 'ink', Draft: 'line', Scheduled: '', Closed: 'line', 'Answer set': 'up', Corrected: 'sky', Cancelled: 'down', Waiting: 'line', Late: 'warn', Drafting: 'line',
  Healthy: 'up', Slow: 'warn', Failing: 'down', Off: 'line', Blocked: 'down', Review: 'warn', Cleared: 'up',
  Generated: 'line', Replaced: 'line', Fallback: 'warn', 'Rejected by check': 'down', Pending: 'line', Sent: 'up', Failed: 'down', Ready: 'ink', Sending: 'sky', 'Not due': 'line', 'Waiting for late answers': 'warn',
  Owner: 'ink', Operator: '', Viewer: 'line', info: 'line', warn: 'warn', error: 'down',
};
export const tag = (label: string, kind?: string) => { if (kind == null) kind = STATE_KIND[label] || ''; return '<span class="tag"' + (kind ? ' data-k="' + kind + '"' : '') + '>' + esc(label) + '</span>'; };
export function addr(a: string, o: { full?: boolean | number; link?: boolean } = {}): string {
  if (!a) return '<span class="dim">Not set</span>';
  const isTx = a.length > 42;
  const shown = o.full ? '<span class="a-full">' + esc(a) + '</span><span class="a-short">' + short(a) + '</span>' : short(a);
  return '<span class="addr" title="' + esc(a) + '">' + (o.link === false ? shown : '<a href="' + X.explorer + '/' + (isTx ? 'tx' : 'address') + '/' + esc(a) + '" target="_blank" rel="noopener">' + shown + '</a>') +
    '<button type="button" data-copy="' + esc(a) + '" aria-label="Copy ' + (isTx ? 'transaction hash' : 'address') + ' ' + esc(a) + '">' + ic('copy', 14) + '</button></span>';
}
export const tx = (h: string) => addr(h);
export const fig = (label: string, value: string | number, sub?: string, cls?: string) => '<div class="fig"><span class="fig-l">' + label + '</span><span class="fig-v ' + (cls || '') + '">' + value + '</span>' + (sub ? '<span class="fig-s">' + sub + '</span>' : '') + '</div>';
export function meter(used: number, cap: number, o: { k?: string; left?: string; right?: string; aria?: string; mark?: number } = {}): string {
  const p = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  return '<div class="meter"' + (o.k ? ' data-k="' + o.k + '"' : '') + '><div class="meter-bar" role="img" aria-label="' + esc(o.aria || p.toFixed(1) + '% used') + '"><i style="width:' + p + '%"></i>' + (o.mark != null ? '<u style="left:' + o.mark + '%"></u>' : '') + '</div>' +
    '<div class="meter-cap"><span>' + (o.left || '') + '</span><span>' + (o.right || '') + '</span></div></div>';
}
export const note = (kind: string, html: string, end?: string) => '<div class="note"' + (kind ? ' data-k="' + kind + '"' : '') + '>' + ic(kind === 'up' ? 'ok' : kind === 'warn' || kind === 'down' ? 'warn' : 'info') + '<div>' + html + '</div>' + (end ? '<span class="end">' + end + '</span>' : '') + '</div>';
export const empty = (title: string, body: string, acts?: string) => '<div class="empty"><h3>' + title + '</h3><p>' + body + '</p>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
export const errorBlock = (what?: string, msg?: string) => '<div class="empty" role="alert"><h3>' + (what || 'This list') + ' did not load.</h3><p>' + (msg ? esc(msg) + ' ' : 'The admin API did not answer in 10 seconds. ') + 'Nothing was changed. The figures below this point may be out of date.</p><div class="acts"><button type="button" class="btn" data-reload>' + ic('refresh') + 'Try again</button></div></div>';
export const thumb = (img: string | null | undefined, sq?: boolean | number) => img ? '<span class="thumb' + (sq ? ' sq' : '') + '"><img src="' + esc(img) + '" alt="" loading="lazy"></span>' : '<span class="thumb none' + (sq ? ' sq' : '') + '" title="No image: the category illustration is used">' + ic('image') + '</span>';
export const kv = (rows: [string, string | number, (boolean | number)?][]) => '<dl class="kv">' + rows.map((r) => '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="r"' : '') + '>' + r[1] + '</dd>').join('') + '</dl>';
export const link = (label: string, href: string) => '<a class="link" href="' + esc(href) + '">' + label + ic('right', 14) + '</a>';
export interface BtnOpts { link?: boolean | number; danger?: boolean | number; primary?: boolean | number; small?: boolean | number; act?: string; arg?: string | number; disabled?: boolean; write?: boolean | number; title?: string; icon?: string }
export function btn(label: string, o: BtnOpts = {}): string {
  const dis = o.disabled || (o.write && !X.canWrite);
  return '<button type="button" class="' + (o.link ? 'link' + (o.danger ? ' danger' : '') : 'btn' + (o.primary ? ' btn-primary' : '') + (o.small ? ' btn-s' : '')) + '"' + (o.act ? ' data-act="' + o.act + '"' : '') + (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') +
    (dis ? ' disabled' : '') + (o.write && !X.canWrite ? ' title="Your role is Viewer: read only"' : o.title ? ' title="' + esc(o.title) + '"' : '') + '>' + (o.icon ? ic(o.icon) : '') + label + '</button>';
}
/** In app link: keeps ?env and ?role in mock mode, as Admin.href did. */
export function href(path: string, state?: string): string {
  const u = new URLSearchParams();
  if (state) u.set('state', state);
  if (X.mock) { if (X.env === 'kairos') u.set('env', 'kairos'); if (X.role !== 'operator') u.set('role', X.role); }
  const s = u.toString();
  return path + (s ? (path.includes('?') ? '&' : '?') + s : '');
}

/* ---------- table: cols [{ h, num, w, cell(row), val(row) }] ---------- */
export interface Col<R> { h: string; num?: boolean | number; w?: string; cls?: string; sr?: string; cell: (r: R, i: number) => string; val?: (r: R) => string | number }
export interface TableOpts<R> {
  cols: Col<R>[]; rows?: R[]; sort?: [number, 'asc' | 'desc']; caption?: string; cls?: string; loading?: boolean | number; error?: boolean | number; what?: string;
  empty?: string; foot?: string; after?: string; selected?: (r: R) => boolean | undefined; rowClass?: (r: R) => string; rowAttr?: (r: R) => string;
}
let tid = 0;
const tables: Record<string, { o: TableOpts<any>; body: (list: any[]) => string }> = {};
export function resetTables() { for (const k of Object.keys(tables)) delete tables[k]; }
/** Call at the start of a screen's markup build: table ids restart, so the same data gives the same HTML string
 *  (React then leaves the DOM, typed input values and running countdowns alone). */
export function begin() { tid = 0; resetTables(); }
export function table<R>(o: TableOpts<R>): string {
  const id = 't' + ++tid, cols = o.cols, rows = o.rows || [], sorted = o.sort;
  const head = '<thead><tr>' + cols.map((c, i) => {
    const s = sorted && sorted[0] === i ? (sorted[1] === 'asc' ? 'ascending' : 'descending') : c.val ? 'none' : null;
    return '<th scope="col"' + (c.num ? ' class="num"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') + (s ? ' aria-sort="' + s + '"' : '') + '>' + (c.val ? '<button type="button" class="th-sort" data-sort="' + i + '">' + c.h + SORT + '</button>' : c.h || '<span class="sr">' + (c.sr || 'Actions') + '</span>') + '</th>';
  }).join('') + '</tr></thead>';
  const body = (list: R[]) => list.map((r, ri) =>
    '<tr' + (o.selected && o.selected(r) ? ' aria-selected="true"' : '') + (o.rowClass ? ' class="' + (o.rowClass(r) || '') + '"' : '') + (o.rowAttr ? ' ' + o.rowAttr(r) : '') + '>' + cols.map((c) => '<td' + (c.num ? ' class="num"' : c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.cell(r, ri) + '</td>').join('') + '</tr>').join('');
  let html: string;
  if (o.loading) html = '<table class="tbl ' + (o.cls || '') + '" aria-busy="true">' + head + '<tbody>' + [0, 1, 2, 3, 4].map((i) => '<tr>' + cols.map((_c, j) => '<td><span class="skel" style="width:' + (40 + ((i * 13 + j * 29) % 50)) + '%"></span></td>').join('') + '</tr>').join('') + '</tbody></table>';
  else if (o.error) html = errorBlock(o.what);
  else if (!rows.length) html = '<table class="tbl ' + (o.cls || '') + '">' + head + '</table>' + (o.empty || empty('Nothing here', 'There are no rows to show.'));
  else html = '<table class="tbl ' + (o.cls || '') + '" id="' + id + '">' + (o.caption ? '<caption class="sr">' + o.caption + '</caption>' : '') + head + '<tbody>' + body(rows) + '</tbody>' + (o.foot || '') + '</table>';
  tables[id] = { o, body };
  return '<div class="tbl-wrap">' + html + '</div>' + (o.after || '');
}
export function sortTable(btnEl: HTMLElement, live: (m: string) => void) {
  const tableEl = btnEl.closest('table') as HTMLTableElement | null; if (!tableEl) return;
  const t = tables[tableEl.id]; if (!t) return;
  const i = +(btnEl.dataset.sort as string), th = btnEl.closest('th') as HTMLElement, c = t.o.cols[i];
  let dir: 'asc' | 'desc' = th.getAttribute('aria-sort') === 'descending' ? 'asc' : 'desc';
  if (th.getAttribute('aria-sort') === 'none' && !c.num) dir = 'asc';
  const rows = (t.o.rows || []).slice().sort((a: unknown, b: unknown) => { const x = c.val!(a), y = c.val!(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'asc' ? 1 : -1); });
  tableEl.querySelectorAll('th[aria-sort]').forEach((h) => h.setAttribute('aria-sort', 'none'));
  th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
  tableEl.tBodies[0].innerHTML = t.body(rows);
  live('Sorted by ' + c.h.replace(/<[^>]+>/g, '') + ', ' + (dir === 'asc' ? 'ascending' : 'descending'));
}

/* ---------- log viewer ---------- */
export interface LogRow { t: string; lv: 'info' | 'warn' | 'error'; who: string; msg: string; tx?: string | null; json?: string | null }
export function log(rows: LogRow[], o: { tools?: boolean } = {}): string {
  return (o.tools === false ? '' : '<div class="log-tools"><div class="seg" role="group" aria-label="Level"><button type="button" aria-pressed="true" data-lv="">All</button><button type="button" aria-pressed="false" data-lv="warn">Warnings</button><button type="button" aria-pressed="false" data-lv="error">Errors</button></div>' +
    '<label class="search"><span class="sr">Search the log</span>' + ic('search') + '<input class="inp" type="search" placeholder="Search job, question id or address" data-logq></label><span class="dim" style="margin-left:auto">Times in KST. Newest first.</span></div>') +
    (rows.length ? '<ol class="log">' + rows.map((r) =>
      '<li data-lv="' + r.lv + '"><time>' + esc(r.t) + '</time>' + tag(r.lv === 'info' ? 'Info' : r.lv === 'warn' ? 'Warning' : 'Error', STATE_KIND[r.lv]) + '<span class="who">' + esc(r.who) + '</span><p>' + esc(r.msg) + (r.tx ? ' ' + tx(r.tx) : '') + '</p>' +
      (r.json ? '<button type="button" class="link" aria-expanded="false" data-json>Details</button><pre hidden>' + esc(r.json) + '</pre>' : '<span></span>') + '</li>').join('') + '</ol>'
      : '<ol class="log"></ol>' + empty('No events yet', 'Writes and worker events appear here as they happen.'));
}

/* ---------- KST time formatting for live data ---------- */
const KST = 9 * 3600;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const kd = (unix: number) => new Date((unix + KST) * 1000);
const p2 = (x: number) => String(x).padStart(2, '0');
export const T = {
  hm: (u: number) => { const d = kd(u); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); },
  hms: (u: number) => { const d = kd(u); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()); },
  dayKey: (u: number) => Math.floor((u + KST) / 86400),
  wd: (u: number) => WD[kd(u).getUTCDay()],
  /** "Thu 26 Nov 2026" */
  long: (u: number) => { const d = kd(u); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); },
  /** "Thursday 26 Nov" */
  dayLong: (u: number) => { const d = kd(u); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; },
  /** "Thu 26" */
  dd: (u: number) => { const d = kd(u); return WD[d.getUTCDay()] + ' ' + d.getUTCDate(); },
  /** "26 Nov 2026" */
  date: (u: number) => { const d = kd(u); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); },
  /** "Wed 25 Nov, 16:10 KST" */
  full: (u: number) => { const d = kd(u); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ', ' + T.hm(u) + ' KST'; },
  /** relative to now: "Today 14:02", "Yesterday 22:40", "Fri 09:00", "25 Nov 14:00" */
  rel: (u: number, now = Date.now() / 1000) => {
    const a = T.dayKey(u), b = T.dayKey(now);
    if (a === b) return 'Today ' + T.hm(u);
    if (a === b - 1) return 'Yesterday ' + T.hm(u);
    if (Math.abs(a - b) < 6) return T.wd(u) + ' ' + T.hm(u);
    const d = kd(u); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ' ' + T.hm(u);
  },
  /** log time: "14:32:01" today, "Wed 21:00:44" earlier */
  logt: (u: number, now = Date.now() / 1000) => (T.dayKey(u) === T.dayKey(now) ? T.hms(u) : T.wd(u) + ' ' + T.hms(u)),
};
