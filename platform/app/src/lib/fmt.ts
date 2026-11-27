// One formatter for every screen (port of App.fmt in platform/design/assets/components.js).
import { currentLang, t } from '../i18n';

export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
let krwPerCt = 195;
export function setKrwPerCt(v: number) { if (v > 0) krwPerCt = v; }

export const F = {
  int: (n: number) => Math.round(n).toLocaleString('en-US'),
  pts: (n: number) => F.int(n) + 'P',
  dec: (n: number, d?: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 4 : d }),
  ct: (n: number, d?: number) => F.dec(n, d) + ' CT',
  kaia: (n: number) => F.dec(n, 4) + ' KAIA',
  fix4: (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
  prize: (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  krw: (ct: number) => t('common.krw', { krw: F.int(ct * krwPerCt) }),
  date: (d: Date | number, withTime?: boolean) => {
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; o.hour12 = false; }
    return new Intl.DateTimeFormat(currentLang(), o).format(d);
  },
  dateLong: (d: Date | number) => new Intl.DateTimeFormat(currentLang(), { year: 'numeric', month: 'short', day: 'numeric' }).format(d),
  weekday: (d: Date | number) => new Intl.DateTimeFormat(currentLang(), { weekday: 'short', month: 'short', day: 'numeric' }).format(d),
  time: (d: Date | number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
  hms: (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return [h, m, x].map((v) => (v < 10 ? '0' : '') + v);
  },
  short: (a: string) => a.slice(0, 6) + '…' + a.slice(-4),
  /** a full address is two equal lines of five groups of four (the first group carries 0x) */
  groups: (a: string) => {
    const g = a.replace(/^0x/, '').match(/.{1,4}/g)!.map((x, i) => '<i>' + (i === 0 ? '0x' : '') + x + '</i>');
    return '<span>' + g.slice(0, 5).join('') + '</span><span>' + g.slice(5).join('') + '</span>';
  },
};

/** forgiving amount parser (App.parseAmount) */
export function parseAmount(s: string): { empty?: true; bad?: true; value?: number; decimals?: number } {
  s = String(s).replace(/[\uFF10-\uFF19\uFF0E\uFF0C]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).trim().replace(/\s*(ct|p|kaia)$/i, '').replace(/,/g, '');
  if (s === '') return { empty: true };
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return { bad: true };
  const dec = (s.split('.')[1] || '').length;
  return { value: parseFloat(s), decimals: dec };
}

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
