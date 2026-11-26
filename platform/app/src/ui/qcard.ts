// A question card (C.qcard in components.js): image led, the category and number chips, the title, the answer rule,
// "AI settles it", the two answers (coral left, sky right) and the drag stamps.
import { currentLang, t } from '../i18n';
import { esc } from '../lib/fmt';
import type { Market, QText } from '../api/types';
import { CAT_ICON, icon } from './h';

export interface Q { id: string; n: number; img: string | null; cat: string; title: string; l: string; r: string; rule: string; settle: string }
export function qOf(m: Pick<Market, 'marketId' | 'n' | 'imageUrl' | 'category' | 'text'>): Q {
  const L: QText = m.text[currentLang()] || m.text.en;
  return { id: m.marketId, n: m.n, img: m.imageUrl, cat: m.category, title: L.title, l: L.left, r: L.right, rule: L.rule || '', settle: L.settle || '' };
}

export function qcard(q: Q, o: { top?: boolean; disabled?: boolean; static?: boolean; failed?: boolean; noimg?: boolean; final?: boolean; pos?: number } = {}): string {
  const img = o.noimg ? null : q.img;
  const media = img
    ? '<div class="qimg"><img src="' + esc(img) + '" alt="" width="800" height="1000" decoding="async" draggable="false"></div>'
    : '<div class="qimg qimg--fallback"><span class="qimg-tile">' + icon(CAT_ICON[q.cat] || 'spark', 64) + '</span></div>';
  const long = /[　-鿿가-힯]/.test(q.title) ? q.title.length > 22 : q.title.length > 44;
  const choice = (d: 'l' | 'r') =>
    '<button type="button" class="choice" data-dir="' + d + '"' + (o.disabled ? ' aria-disabled="true"' : '') + (o.static ? ' tabindex="-1"' : '') + ' aria-label="' + esc(t('h.pick.aria', { choice: q[d], q: q.title })) + '">' +
    (d === 'l' ? icon('left', 18) : '') + '<span>' + esc(q[d]) + '</span>' + (d === 'r' ? icon('right', 18) : '') + '</button>';
  return '<article class="qcard' + (o.top ? ' qcard--top' : '') + '" data-q="' + q.n + '" data-id="' + esc(q.id) + '" data-pos="' + (o.pos || 0) + '" role="group" aria-label="' + esc(t('h.qn.sr', { n: q.n }) + ': ' + q.title) + '">' +
    media + '<span class="qtint" aria-hidden="true"></span>' +
    '<span class="qstamp qstamp--l" aria-hidden="true">' + esc(q.l) + '</span><span class="qstamp qstamp--r" aria-hidden="true">' + esc(q.r) + '</span>' +
    '<div class="qcard-top"><span class="qchip">' + t('cat.' + q.cat) + '</span><span class="qchip" aria-hidden="true">' + t('h.qn', { n: q.n }) + '</span></div>' +
    '<div class="qcard-body"><h2' + (long ? ' class="is-long"' : '') + '>' + esc(q.title) + '</h2>' +
    (o.failed ? '<p class="qcard-note">' + icon('warn', 16) + t('h.notsaved') + '</p>' : '') +
    '<div class="qcard-meta"><span>' + icon('search', 14) + '<span>' + t('h.answer', { rule: esc(q.rule) }) + '</span></span>' +
    (o.static ? '<span>' + icon('clock', 14) + '<span>' + t('h.ai', { time: esc(q.settle) }) + '</span></span>' :
      '<button type="button" class="qmeta-btn" data-ai-info="' + esc(q.id) + '" aria-haspopup="dialog">' + icon('clock', 14) + '<span>' + t('h.ai', { time: esc(q.settle) }) + '</span>' + icon('info', 14) + '</button>') + '</div>' +
    '<div class="choices">' + choice('l') + choice('r') + '</div>' +
    (o.final ? '<p class="qcard-final">' + t('h.final') + '</p>' : '') +
    '</div></article>';
}

/** the view switch on the home header: the selected view is named in words, the other one is its icon */
export function viewSwitch(cur: 'card' | 'term'): string {
  const a = (id: 'card' | 'term', href: string, ic: string) => { const on = id === cur; return '<a href="' + href + '"' + (on ? ' aria-current="page"' : ' aria-label="' + esc(t('h.view.' + id)) + '"') + '>' + (on ? '<span>' + t('h.view.' + id) + '</span>' : icon(ic, 20)) + '</a>'; };
  return '<div class="viewsw" role="group" aria-label="' + esc(t('h.view.label')) + '">' + a('card', '/', 'cards') + a('term', '/list', 'list') + '</div>';
}
export const closes = (endMs: number) => '<span class="ph-cd"><span>' + t('h.closes') + '</span><b data-cd="' + Math.max(0, Math.round((endMs - Date.now()) / 1000)) + '" data-cd-end="' + endMs + '"></b></span>';
