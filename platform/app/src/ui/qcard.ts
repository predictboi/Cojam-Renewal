// A question card (C.qcard of the "Daily Paper" look): the lead story of the front page. Kicker and number over a rule,
// the picture printed through a halftone screen, the headline, the source line that opens the rules, the two answers
// (persimmon left, teal right) and the answer stamps of the drag.
import { currentLang, t } from '../i18n';
import { esc } from '../lib/fmt';
import type { Market, QText } from '../api/types';
import { halftone, icon } from './h';

export interface Q { id: string; n: number; img: string | null; cat: string; title: string; l: string; r: string; rule: string; settle: string }
export function qOf(m: Pick<Market, 'marketId' | 'n' | 'imageUrl' | 'category' | 'text'>): Q {
  const lang = currentLang();
  const L: QText = m.text[lang] || m.text.en;
  // a Japanese question ends in a Latin question mark (Besley, like the numerals): no full width gap before it
  const title = lang === 'ja' ? L.title.replace(/？/g, '?') : L.title;
  return { id: m.marketId, n: m.n, img: m.imageUrl, cat: m.category, title, l: L.left, r: L.right, rule: L.rule || '', settle: L.settle || '' };
}

export function qcard(q: Q, o: { disabled?: boolean; static?: boolean; failed?: boolean; noimg?: boolean; final?: boolean; pos?: number } = {}): string {
  const img = o.noimg ? null : q.img;
  const cjk = /[　-鿿가-힯]/.test(q.title), long = cjk ? q.title.length > 22 : q.title.length > 44, xlong = cjk ? q.title.length > 40 : q.title.length > 80;
  const wordy = Math.max(q.l.length, q.r.length) > (cjk ? 6 : 10);
  const choice = (d: 'l' | 'r') =>
    '<button type="button" class="choice" data-dir="' + d + '"' + (o.disabled ? ' aria-disabled="true"' : '') + (o.static ? ' tabindex="-1"' : '') + ' aria-label="' + esc(t('h.pick.aria', { choice: q[d], q: q.title })) + '">' +
    (d === 'l' ? icon('left', 18) : '') + '<span>' + esc(q[d]) + '</span>' + (d === 'r' ? icon('right', 18) : '') + '</button>';
  const meta = '<span class="qmeta-t"><span>' + t('h.answer', { rule: esc(q.rule) }) + '</span><span>' + t('h.ai', { time: esc(q.settle) }) + '</span></span>';
  return '<article class="qcard" data-q="' + q.n + '" data-id="' + esc(q.id) + '" data-pos="' + (o.pos || 0) + '" role="group" aria-label="' + esc(t('h.qn.sr', { n: q.n }) + ': ' + q.title) + '">' +
    '<div class="qcard-top"><span class="qkick">' + t('cat.' + q.cat) + '</span><span class="qno" aria-hidden="true">' + t('pp.no', { n: q.n }) + '</span></div>' +
    '<div class="qimg' + (img ? '' : ' qimg--none') + '">' + halftone(img, q.cat, 800, 1000) + '</div>' +
    '<span class="qtint" aria-hidden="true"></span>' +
    '<span class="qstamp qstamp--l" aria-hidden="true">' + esc(q.l) + '</span><span class="qstamp qstamp--r" aria-hidden="true">' + esc(q.r) + '</span>' +
    '<div class="qcard-body"><h2' + (xlong ? ' class="is-xlong"' : long ? ' class="is-long"' : '') + '>' + esc(q.title) + '</h2>' +
    (o.failed ? '<p class="qcard-note">' + icon('warn', 16) + t('h.notsaved') + '</p>' : '') +
    (o.static ? '<div class="qmeta">' + meta + '</div>' : '<button type="button" class="qmeta" data-ai-info="' + esc(q.id) + '" aria-haspopup="dialog">' + meta + '<span class="qmeta-go">' + t('pp.rule') + icon('chev', 14) + '</span></button>') +
    '<div class="choices' + (wordy ? ' is-wordy' : '') + '">' + choice('l') + choice('r') + '</div>' +
    (o.final ? '<p class="qcard-final">' + t('h.final') + '</p>' : '') +
    '</div></article>';
}

/** the view switch on the home head: two words, the current one underlined in ink */
export function viewSwitch(cur: 'card' | 'term'): string {
  const a = (id: 'card' | 'term', href: string) => { const on = id === cur; return '<a href="' + href + '"' + (on ? ' aria-current="page"' : '') + '>' + t('h.view.' + id) + '</a>'; };
  return '<div class="viewsw" role="group" aria-label="' + esc(t('h.view.label')) + '">' + a('card', '/') + a('term', '/list') + '</div>';
}
