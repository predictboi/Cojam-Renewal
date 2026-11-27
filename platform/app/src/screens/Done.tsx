// H3 Day done: an extra edition (platform/design-variants/paper/done.html, MOTION.md section 2). It opens the moment the
// fifth pick is made. While that pick can still be undone, Undo sits in a pick bar pinned above the tab bar with its fuse,
// the press runs and the headline is set letter by letter; a tap on the headline area or the primary action means "finish
// now". The reward is never shown before it is confirmed on chain (DEV-PLAN 4.6): "Saving your last pick" while any of the
// five is not mined, then the band inks in as "Extra", "+100P" counts up from 0, a "Paid" stamp lands, the fifth box inks
// in, the dateline turns to "Next set in" and the points in the masthead count up. A tap after that skips to the settled page.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMe, useToday, useWallet } from '../api';
import { t } from '../i18n';
import { esc, reduceMotion } from '../lib/fmt';
import { btn, count as countCell, datelineInner, day5, pick, qbtn, rstamp } from '../ui/h';
import { Html, Shell, Icon } from '../ui/kit';
import { qOf } from '../ui/qcard';
import { usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { outbox, hasOutbox, kick, useOutbox } from '../chain/outbox/runner';
import { UNDO_MS } from '../chain/outbox/policy';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

const num = (v: number) => '+' + String(Math.round(v)).replace(/\d/g, '<i class="dg">$&</i>') + 'P';
function letters(text: string) {
  let i = 0;
  return '<span aria-hidden="true">' + text.split(' ').map((w) => '<span class="wd">' + Array.from(w).map((c) => '<span class="ltr" style="--i:' + i++ + '">' + esc(c) + '</span>').join('') + '</span>').join(' ') + '</span>';
}
type Mode = 'undo' | 'saving' | 'paid' | 'settled';

export default function Done() {
  const st0 = usePreset();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const today = useToday();
  const wallet = useWallet();
  const meQ = useMe();
  const items = useOutbox((s) => s.items);
  const td = today.data;
  const dayItems = items.filter((i) => td && i.dayId === td.dayId);
  // the reward moment plays once: a reload of a paid day shows the settled screen
  const momentReq = st0 === 'moment' || sp.get('moment') === '1';
  const allMined = !!td && td.markets.length === 5 && td.markets.every((m) => m.choice.chain || dayItems.some((i) => i.marketId === m.marketId && (i.state === 'mined' || i.state === 'done_elsewhere')));
  const [simPaid, setSimPaid] = useState(false);
  const paidNow = (!!td && td.completed) || simPaid;
  const [wasPaidAtOpen] = useState(() => paidNow);
  const st = st0 === 'moment' && wasPaidAtOpen ? '' : st0;
  const preset = st === 'saving' || st === 'results' || st === 'zero' || st === 'welcome' || st === 'offline';
  const wel = st === 'welcome' || !!td?.welcomePaid;
  const W = DESIGN.invite.welcome;
  const animate = !preset && momentReq && !wasPaidAtOpen;
  // the Undo of the fifth pick, carried over from the deck: what is left of its window
  const undoQ = sp.get('q') || '';
  const [undoMs] = useState(() => (animate ? Math.max(0, Math.min(UNDO_MS, +(sp.get('undo') || 0))) : 0));
  const heldLast = dayItems.find((i) => i.marketId === undoQ && i.state === 'held');
  const [mode, setMode] = useState<Mode>(() => (!animate ? 'settled' : undoMs ? 'undo' : 'saving'));
  const phase: 'saving' | 'paid' = st === 'saving' ? 'saving' : preset ? 'paid' : paidNow ? 'paid' : momentReq || !allMined ? 'saving' : 'paid';
  const heroRef = useRef<HTMLElement>(null);
  const figRef = useRef<HTMLParagraphElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduceMotion() ? Math.min(ms, 300) : ms)); };
  const modeRef = useRef(mode); modeRef.current = mode;

  // the design preset "moment" opened on its own: the mock pays after the prototype's 0.9 s
  useEffect(() => { if (st0 === 'moment' && CONFIG.mockApi && td && !td.completed && !undoMs) { const tm = setTimeout(() => setSimPaid(true), 900); return () => clearTimeout(tm); } }, [st0, !!td]);
  // a mock walk: the fifth pick is mined by the mock chain about a second after it is sent
  useEffect(() => { if ((mode === 'saving' || mode === 'undo') && !preset) { const i = setInterval(() => void today.refetch(), 700); return () => clearInterval(i); } }, [mode]);

  // the picks actually made today (chain choices, or held and sent picks)
  const sample = [2, 2, 1, 2, 2]; // the prototype's sample picks when a preset is opened on its own
  const picks = (td?.markets || []).map((m) => {
    const it = dayItems.find((i) => i.marketId === m.marketId);
    const c = m.choice.chain || it?.choice || sample[m.slot];
    return { q: qOf(m), dir: (c === 1 ? 'l' : 'r') as 'l' | 'r' };
  });
  // today's answers are set only after the day ends: every pick waits ("results" shows the hit points of an earlier day on their way)
  const waiting = 5;

  /* ---------- the moment ---------- */
  // the Undo window of the fifth pick closes (or the player finished now): the pick is sent, then the points are paid
  const toSaving = () => {
    if (modeRef.current !== 'undo') return;
    setMode('saving');
    if (hasOutbox()) void outbox().flush().then(() => kick());
  };
  useEffect(() => {
    if (mode !== 'undo') return;
    const tm = setTimeout(toSaving, undoMs);
    document.getElementById('undo-last')?.focus({ preventScroll: true });   // the focus goes to Undo, where it also was on the deck
    return () => clearTimeout(tm);
  }, []); // eslint-disable-line
  // leaving inside the window sends the held pick at once (it can no longer be undone)
  useEffect(() => () => { if (modeRef.current === 'undo' && hasOutbox()) void outbox().flush().then(() => kick()); }, []);
  // the points are credited with the fifth pick: only then does anything say "paid"
  useEffect(() => {
    if (!animate || phase !== 'paid' || mode === 'paid' || mode === 'settled') return;
    if (mode === 'undo') return;
    setMode('paid');
    try { (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && navigator.vibrate?.([12, 40, 18]); } catch { /* */ }
    live(t('toast.paid', { n: 100 }));
    const fig = figRef.current as (HTMLElement & { _roll?: number }) | null;
    if (fig && !reduceMotion()) {
      const t0 = performance.now();
      const step = (now: number) => { const k = Math.min(1, (now - t0) / 620), e = 1 - Math.pow(1 - k, 4); fig.innerHTML = num(100 * e); if (k < 1) fig._roll = requestAnimationFrame(step); };
      fig._roll = requestAnimationFrame(step);
    }
    at(640, () => {
      if (modeRef.current === 'settled') return;
      const s = document.querySelector('#seal .rstamp') as HTMLElement | null;
      if (s && !reduceMotion()) { s.style.setProperty('--d', '0ms'); s.classList.remove('is-land'); void s.offsetWidth; s.classList.add('is-land'); }
      flipDateline(true);
    });
    at(1400, settle);
  }, [phase, mode]); // eslint-disable-line
  function flipDateline(anim: boolean) {
    const f = document.getElementById('dl-flip'); if (!f || f.getAttribute('data-k') === 'd.next') return;
    f.setAttribute('data-k', 'd.next'); (f.firstChild as HTMLElement).textContent = t('d.next');
    const sr = f.parentNode?.querySelector('[data-cd-sr]'); if (sr) sr.setAttribute('data-cd-sr', 'd.next');
    if (anim && !reduceMotion()) { f.classList.remove('is-flip'); void f.offsetWidth; f.classList.add('is-flip'); }
  }
  function settle() {
    if (modeRef.current === 'settled') return;
    timers.current.forEach(clearTimeout);
    const fig = figRef.current as (HTMLElement & { _roll?: number }) | null;
    if (fig) { if (fig._roll) cancelAnimationFrame(fig._roll); fig.innerHTML = num(100); }
    flipDateline(false);
    setMode('settled');
    heroRef.current?.getAnimations?.({ subtree: true }).forEach((a) => { try { a.finish(); } catch { /* */ } });
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  /* Undo on this page takes the fifth pick back and returns to the deck, where its card is on top again */
  const undoLast = async () => {
    if (modeRef.current !== 'undo') return;
    timers.current.forEach(clearTimeout);
    modeRef.current = 'saving';   // the unmount must not send it
    if (hasOutbox()) { const it = await outbox().undo(); if (it) live(t('h.undone', { n: it.slot + 1 })); }
    nav('/', { replace: true });
  };
  // a tap or a key: during the Undo window only the headline area or the primary action ends it early; after the points are paid it skips the show
  useEffect(() => {
    if (!animate) return;
    const skip = (e: Event) => {
      const tg = e.target as Element | null;
      if (tg?.closest?.('#undo-bar')) return;
      if (modeRef.current === 'undo') {
        const k = e as KeyboardEvent;
        if (e.type === 'keydown' ? (k.key === 'Enter' && tg?.closest?.('.btn-primary')) : (tg?.closest?.('#hero') || tg?.closest?.('.pg .btn-primary'))) toSaving();
      } else if (modeRef.current === 'paid') settle();
    };
    const zkey = (e: KeyboardEvent) => { if (modeRef.current === 'undo' && (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && !e.repeat) { e.preventDefault(); void undoLast(); } };
    document.addEventListener('pointerdown', skip, true); document.addEventListener('keydown', skip, true); document.addEventListener('keydown', zkey);
    return () => { document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true); document.removeEventListener('keydown', zkey); };
  }, []); // eslint-disable-line
  useEffect(() => {
    const z = () => { if (st !== 'zero') setTimeout(() => nav('/'), 1200); };
    document.addEventListener('cd:zero', z);
    if (st === 'zero') setTimeout(() => toast(t('h.new')), 600);
    return () => document.removeEventListener('cd:zero', z);
  }, [st]);

  /* ---------- the page ---------- */
  const shownPhase: 'undo' | 'saving' | 'paid' = !animate ? (phase === 'saving' ? 'saving' : 'paid') : mode === 'undo' ? 'undo' : mode === 'saving' ? 'saving' : 'paid';
  const [undoLeft, setUndoLeft] = useState(undoMs);
  useEffect(() => { if (mode !== 'undo') return; const t0 = Date.now(); const i = setInterval(() => setUndoLeft(Math.max(0, undoMs - (Date.now() - t0))), 200); return () => clearInterval(i); }, [mode]);
  // the row under the figure has one height in every phase: Undo's countdown, then "Saving your last pick", then the "Paid" stamp
  const row = shownPhase === 'undo'
    ? '<p class="done-st" id="reward">' + t('h.end.in', { n: '<b id="fin-n">' + Math.max(1, Math.ceil(undoLeft / 1000)) + '</b>' }) + '</p>'
    : shownPhase === 'saving' ? '<p class="done-st" id="reward"><span class="spin"></span>' + t('d.saving.st') + '</p>'
      : '<span class="seal" id="seal" aria-hidden="true">' + rstamp('hit', t('pp.paid')) + '</span>' + (wel ? '<p class="done-st" id="reward">' + t('d.wel.st', { n: 100 + W }) + '</p>' : '<p class="sr-only" id="reward">' + t('d.paid.st') + '</p>');
  const segs = shownPhase === 'paid' ? ['done', 'done', 'done', 'done', 'done'] : ['done', 'done', 'done', 'done', 'pend'];
  const heroCls = 'done-hero' + (animate ? ' is-moment' : '') + (shownPhase !== 'paid' ? ' is-saving' : '') + (animate && shownPhase === 'paid' ? ' is-paid' : '') + (mode === 'settled' && animate ? ' is-settled' : '');
  const [figInit] = useState(() => num(100));
  const hero = (
    <section className={heroCls} id="hero" ref={heroRef}>
      <div className="extra" id="extra"><span className="extra-run" aria-hidden="true" /><p className="extra-ink"><b>{t('pp.extra')}</b></p></div>
      <h1 aria-label={t('d.h1')} dangerouslySetInnerHTML={{ __html: letters(t('d.h1')) }} />
      <div className="done-figs">
        <p className={'done-fig' + (shownPhase !== 'paid' ? ' is-wait' : '')} id="done-fig" data-dg="" aria-hidden="true" ref={figRef} dangerouslySetInnerHTML={{ __html: figInit }} />
        {wel && <p className="done-wel" id="done-wel" aria-hidden="true"><b>+{W}P</b><span>{t('d.wel.tag')}</span></p>}
      </div>
      <Html className="done-row" aria-live="polite" id="reward-wrap" html={row} />
      <Html className="ph-line" html={day5(segs, { id: 'day5', label: '5/5' })} />
    </section>
  );
  const body = btn(t('d.rank'), { kind: 'primary', block: true, href: '/ranking', iconEnd: 'right' }) +
    (wel ? '<p class="done-welnote">' + t('d.wel.note', { name: '<b translate="no">' + esc(td?.inviterName || meQ.data?.referrer?.name || (CONFIG.mockApi ? DESIGN.invite.by : '')) + '</b>', w: W }) + '</p>' : '') +
    '<section class="sec sec-rule"><div class="sh"><h2>' + t('d.picks') + '</h2><a class="linkish" href="/results">' + t('d.results') + '</a></div>' +
    (waiting ? '<p class="done-wait-n">' + t('d.waitn', { n: waiting }) + qbtn('hits', t('h.ai.h')) + '</p>' : '') +
    '<ul class="list">' + picks.map((p) => '<li class="pick"><span class="pick-q">' + esc(p.q.title) + '</span><span class="pick-c">' + pick(p.dir, esc(p.q[p.dir])) + '</span></li>').join('') + '</ul></section>';
  // the dateline: while the last pick is saved it still reads "Closes in" (this edition is on the press); once paid it turns to the next set
  const [dl] = useState(() => {
    if (st === 'zero') return datelineInner('<span class="spin"></span> ' + t('d.loading'));
    const k = animate ? 'h.closes' : 'd.next';
    return datelineInner(countCell(k, td?.nextOpenAt ?? Date.now() + 3600_000, 'dl-flip').replace('id="dl-flip"', 'id="dl-flip" data-k="' + k + '"'));
  });
  // the masthead: the 100P is counted up when it is paid. Mock presets opened on their own add the 100P the prototype shows; on chain the wallet read already has it
  const pts = wallet.data?.points ?? 0;
  const paidShown = shownPhase === 'paid';
  const mockCredit = CONFIG.mockApi && !td?.completed ? (preset && st !== 'saving' ? 100 + (wel ? W : 0) : simPaid ? 100 : 0) : 0;
  const shownPts = animate && !paidShown ? pts + mockCredit - (paidNow ? (mockCredit ? mockCredit : 100) : 0) : pts + mockCredit;
  const lastQ = td?.markets.find((m) => m.marketId === undoQ);
  const lq = lastQ ? qOf(lastQ) : null, ldir: 'l' | 'r' | null = heldLast ? (heldLast.choice === 1 ? 'l' : 'r') : null;
  const undoBar = mode === 'undo' ? (
    <div className="pin pin--undo" id="undo-bar">
      <span className="fuse" aria-hidden="true"><i style={{ ['--gone' as string]: '-' + (UNDO_MS - undoMs) + 'ms' }} /></span>
      <span className="pickbar-msg"><Icon name="check" size={16} /><span dangerouslySetInnerHTML={{ __html: lq && ldir ? t('h.sync', { n: lq.n, choice: pick(ldir, esc(lq[ldir])) }) : t('h.qn.sr', { n: lq ? lq.n : 5 }) }} /></span>
      <button type="button" className="undo" id="undo-last" aria-label={t('h.undo.aria', { n: lq ? lq.n : 5, choice: lq && ldir ? lq[ldir] : '' })} onClick={() => void undoLast()}>
        <Icon name="undo" size={18} /><span>{t('h.undo')}</span><kbd aria-hidden="true">Z</kbd>
      </button>
    </div>
  ) : undefined;
  return (
    <Shell tab="home" cls="is-done" docTitle={t('d.h1')} points={shownPts} pts={!paidShown ? 'pending' : st === 'results' ? 'hits' : ''} badges={{ home: 0 }} pin={undoBar}
      raw={<><div className="dateline" dangerouslySetInnerHTML={{ __html: dl }} />{hero}<Html className="pg" html={body} /></>} />
  );
}
