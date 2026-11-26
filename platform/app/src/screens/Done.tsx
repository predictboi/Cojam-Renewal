// H3 Day done (platform/design/done.html). The reward is never shown before it is confirmed (DEV-PLAN 4.6):
// "Saving your last pick" while any of the five is not mined, then "+100P added to your points" with the pop and burst.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToday, useWallet } from '../api';
import { t } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, day5, icon, pick } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { qOf } from '../ui/qcard';
import { usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { useOutbox } from '../chain/outbox/runner';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

export default function Done() {
  const st0 = usePreset();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const today = useToday();
  const wallet = useWallet();
  const items = useOutbox((s) => s.items);
  const td = today.data;
  const dayItems = items.filter((i) => td && i.dayId === td.dayId);
  // the reward moment plays once: a reload of a paid day shows the settled screen
  const momentReq = st0 === 'moment' || sp.get('moment') === '1';
  const allMined = !!td && td.markets.length === 5 && td.markets.every((m) => m.choice.chain || dayItems.some((i) => i.marketId === m.marketId && (i.state === 'mined' || i.state === 'done_elsewhere')));
  const [simPaid, setSimPaid] = useState(false);
  const paidNow = (!!td && td.completed) || simPaid;
  // the design preset "moment" opened on its own: the mock pays after the prototype's 0.8 s
  useEffect(() => { if (st0 === 'moment' && CONFIG.mockApi && td && !td.completed) { const tm = setTimeout(() => setSimPaid(true), 800); return () => clearTimeout(tm); } }, [st0, !!td]);
  const [wasPaidAtOpen] = useState(() => paidNow);
  const st = st0 === 'moment' && wasPaidAtOpen ? '' : st0;
  const preset = st === 'saving' || st === 'results' || st === 'zero' || st === 'welcome' || st === 'offline';
  const phase: 'saving' | 'paid' = st === 'saving' ? 'saving' : preset ? 'paid' : paidNow ? 'paid' : momentReq || !allMined ? 'saving' : 'paid';
  const wel = st === 'welcome' || !!td?.welcomePaid;
  const W = DESIGN.invite.welcome;
  const animate = !preset && momentReq && !wasPaidAtOpen;
  const [popped, setPopped] = useState(false);
  const figRef = useRef<HTMLParagraphElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  // the picks actually made today (chain choices, or held and sent picks)
  const sample = [2, 2, 1, 2, 2]; // the prototype's sample picks when a preset is opened on its own
  const picks = (td?.markets || []).map((m) => {
    const it = dayItems.find((i) => i.marketId === m.marketId);
    const c = m.choice.chain || it?.choice || sample[m.slot];
    return { q: qOf(m), dir: (c === 1 ? 'l' : 'r') as 'l' | 'r' };
  });
  const outcome = st === 'results' ? ['wait', 'pend', 'miss', 'wait', 'wait'] : ['wait', 'wait', 'wait', 'wait', 'wait'];
  const waiting = outcome.filter((o) => o === 'wait').length;
  const pts = wallet.data?.points ?? 0;
  const showPaid = phase === 'paid' && (!animate || popped);

  // the day done moment: the fifth pick is mined (the 100P is credited in that same transaction), then the pop
  useEffect(() => {
    if (!animate || popped || phase !== 'paid') return;
    const tm = setTimeout(() => {
      setPopped(true);
      try { (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && navigator.vibrate?.([12, 40, 18]); } catch { /* */ }
      live(t('toast.paid', { n: 100 }));
      burst();
    }, 700);
    return () => clearTimeout(tm);
  }, [animate, phase]);
  // a mock walk: the fifth pick is mined by the mock chain about a second after it is sent
  useEffect(() => { if (phase === 'saving' && !preset) { const i = setInterval(() => void today.refetch(), 700); return () => clearInterval(i); } }, [phase]);

  function burst() {
    const el = figRef.current, band = el?.closest('.ph');
    if (reduceMotion() || !el || !band) return;
    const b = document.createElement('span'), r = el.getBoundingClientRect(), Wd = band.getBoundingClientRect().width;
    b.className = 'burst'; b.setAttribute('aria-hidden', 'true');
    let h = '';
    for (let i = 0; i < 32; i++) {
      const x = -r.width / 2 + 12 + Math.random() * (Wd - r.left - 36), y = (Math.random() - 0.5) * 84;
      h += '<i style="--n:' + i + ';--x:' + x.toFixed(0) + 'px;--y:' + y.toFixed(0) + 'px;--r:' + Math.round(Math.random() * 360) + 'deg"></i>';
    }
    b.innerHTML = h; el.appendChild(b); setTimeout(() => b.remove(), 2200);
  }
  useEffect(() => {
    const z = (e: Event) => { if (st !== 'zero') setTimeout(() => nav('/'), 1200); void e; };
    document.addEventListener('cd:zero', z);
    if (st === 'zero') setTimeout(() => toast(t('h.new')), 600);
    return () => document.removeEventListener('cd:zero', z);
  }, [st]);

  const segs = phase === 'saving' || (animate && !popped) ? ['done', 'done', 'done', 'done', 'pend'] : ['done', 'done', 'done', 'done', animate ? 'done fill' : 'done'];
  const status = !showPaid
    ? '<p class="done-st" id="reward"><span class="spin"></span>' + t('d.saving.st') + '</p>'
    : '<p class="done-st" id="reward">' + icon('check', 14) + (wel ? t('d.wel.st', { n: 100 + W }) : t('d.paid.st')) + '</p>';
  const figCls = 'done-fig' + (!showPaid ? ' is-wait' : animate && popped ? ' is-pop' : '');
  const head = (
    <>
      <div className="done-stack" ref={bandRef}>
        <h1>{t('d.h1')}</h1>
        {wel ? (
          <div className="done-figs"><p className={figCls} id="done-fig" aria-hidden="true" ref={figRef}>+100P</p><p className="done-wel" id="done-wel" aria-hidden="true"><b>+{W}P</b><span>{t('d.wel.tag')}</span></p></div>
        ) : <p className={figCls} id="done-fig" aria-hidden="true" ref={figRef}>+100P</p>}
        <Html aria-live="polite" id="reward-wrap" html={status} />
      </div>
      <Html className="ph-line" html={'<span class="ph-count">5<small>/5</small></span>' + day5(segs, { band: true, id: 'day5', cls: animate && !popped ? 'is-flash' : animate && popped ? 'is-wave' : '', label: '5/5' })} />
    </>
  );
  const secs = st === 'zero' ? 0 : Math.max(0, Math.round(((td?.nextOpenAt ?? Date.now()) - Date.now()) / 1000));
  const body = btn(t('d.rank'), { kind: 'primary', block: true, href: '/ranking', iconEnd: 'right' }) +
    '<p class="watch" id="next">' + (st === 'zero' ? '<span class="spin"></span><span>' + t('d.loading') + '</span>' :
      icon('clock', 16) + '<span>' + t('d.next') + '</span> <b class="clock-inline" id="clock" data-cd="' + secs + '"' + (td ? ' data-cd-end="' + td.nextOpenAt + '"' : '') + ' aria-hidden="true"></b><span class="sr-only" data-cd-sr></span>') + '</p>' +
    (wel ? '<p class="done-welnote">' + t('d.wel.note', { name: '<b translate="no">' + esc(td?.inviterName || DESIGN.invite.by) + '</b>', w: W }) + '</p>' : '') +
    '<section class="sec sec-rule done-picks"><div class="sect-h"><h2 class="sect-h">' + t('d.picks') + '</h2><a class="linkish" href="/results">' + t('d.results') + '</a></div>' +
    '<div class="done-wait">' + (waiting ? '<p class="done-wait-n">' + t('d.waitn', { n: waiting }) + '</p>' : '') + '<div class="plain-note"><p>' + t('d.hit.1') + '</p><p>' + t('d.hit.2') + '</p></div></div>' +
    '<ul class="list">' + picks.map((p, i) => {
      const o = outcome[i], sub = o === 'pend' ? t('d.hitpending', { time: '22:10' }) : o === 'miss' ? t('d.miss') : '';
      return '<li class="pick"><span class="pick-q">' + esc(p.q.title) + '</span><span class="pick-c">' + pick(p.dir, esc(p.q[p.dir])) + (sub ? '<small>' + sub + '</small>' : '') + '</span></li>';
    }).join('') + '</ul></section>';
  // the header pill: the 100P is counted up when the moment pops
  // mock presets opened on their own add the 100P the prototype shows; on chain the wallet read already has it
  const mockCredit = CONFIG.mockApi && !td?.completed ? (preset && st !== 'saving' ? 100 + (wel ? W : 0) : simPaid ? 100 : 0) : 0;
  const shownPts = animate && !popped ? pts + mockCredit - (paidNow ? (mockCredit ? mockCredit : 100) : 0) : pts + mockCredit;
  return (
    <Shell tab="home" cls="is-done" docTitle={t('d.h1')} head={head} points={shownPts} pts={!showPaid ? 'pending' : st === 'results' ? 'hits' : ''} badges={{ home: 0 }}>
      <Html as="div" style={{ display: 'contents' }} html={body} />
    </Shell>
  );
}
