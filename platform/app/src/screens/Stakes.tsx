// S2 My stakes (platform/design/stakes.html): the total, interest so far and claimable (ticking), then one section per
// stake with its progress, interest and the action. On hold, claims and withdrawals are user paid (DECISIONS).
import { useEffect, useState } from 'react';
import { useConfig, usePositions, useWallet } from '../api';
import { t } from '../i18n';
import { F } from '../lib/fmt';
import { btn, empty, errorNote, help, hold, icon, note, rows, skel, tag } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { runTx, showTx } from '../ui/tx';
import { actions } from '../chain/chain';
import { live } from '../state/ui';
import { StakeTabs } from './Staking';
import type { Position } from '../api/types';

const DAY = 86400000, YEAR = 365 * 86400;
function calc(s: Position, now = Date.now()) {
  const el = Math.min((now - s.start) / 1000, s.lockDays * 86400), per = (s.amount * s.aprPct) / 100 / YEAR;
  return { interest: per * el - s.claimed, per, cap: per * s.lockDays * 86400, day: Math.min(s.lockDays, Math.floor(el / 86400) + 1), unlocked: el >= s.lockDays * 86400, unlock: s.start + s.lockDays * DAY, pct: Math.min(100, el / (s.lockDays * 864)) };
}

export default function Stakes() {
  const st = usePreset();
  const q = usePositions();
  const w = useWallet();
  const cfg = useConfig();
  const offline = useOffline();
  const held = useHold() || /^hold/.test(st);
  const fee = cfg.data?.userTxFeeKaia ?? 0.0021;
  const minClaim = cfg.data?.params.minClaim ?? 10;
  const kaia = w.data?.kaia ?? 0;
  const noKaia = held && kaia < fee;
  const [, setTick] = useState(0);
  const loading = st === 'loading' || q.isPending;
  // the unlock moment: the tag flips and the withdraw button appears, no reload
  useEffect(() => { if (st !== 'unlocking') return; const tm = setTimeout(() => { setTick((x) => x + 1); live(t('m.unlocked')); }, 6500); return () => clearTimeout(tm); }, [st]);
  useEffect(() => { if (st === 'claim') showTx('success', { key: 'claim', label: '', success: { title: t('m.ok.claim', { i: '263.01' }) }, exec: async () => '' }); }, [st]);

  const stakes = q.data?.positions || [];
  const total = stakes.reduce((a, s) => a + s.amount, 0);
  const sofar = stakes.reduce((a, s) => a + calc(s).interest, 0), perAll = stakes.reduce((a, s) => { const c = calc(s); return a + (c.unlocked ? 0 : c.per); }, 0);
  const claimable = stakes.reduce((a, s) => { const c = calc(s); return a + (c.unlocked || c.interest >= minClaim ? c.interest : 0); }, 0);
  const feeLine = held ? '<p class="hold-why" data-fee-line>' + icon('info', 16) + '<span>' + t('hold.fee.line') + ' (' + t('x.fee.v', { f: fee }) + ')</span></p>' : '';
  const out = (s: Position) => Math.round((s.amount + calc(s).interest) * 1e4) / 1e4;
  function card(s: Position): string {
    const c = calc(s);
    let acts: string;
    if (c.unlocked) acts = '<div class="mstake-acts" data-actions>' + btn(t('m.withdraw', { a: F.dec(out(s), 4) }), { kind: 'primary', block: true, attrs: 'data-wd="' + s.id + '"', disabled: offline || noKaia }) + '<p class="tiny muted center">' + t('m.withint', { p: F.dec(s.amount), i: F.dec(c.interest, 4) }) + '</p>' + feeLine + '</div>';
    else if (c.interest >= minClaim) acts = '<div class="mstake-acts" data-actions>' + btn(t('m.claim', { i: F.dec(c.interest, 2) }), { block: true, attrs: 'data-claim="' + s.id + '"', disabled: offline || noKaia }) + feeLine + '</div>';
    else acts = '<p class="mstake-gap" data-actions>' + t('m.claim.gap', { g: F.dec(minClaim - c.interest, 2) }) + '</p>';
    return '<article class="msec stake mstake" data-stake="' + s.id + '"><div class="mstake-top"><div><p class="fig">' + F.dec(s.amount) + '<small>CT</small></p><p class="small muted">' + t('m.card.period', { d: s.lockDays, r: s.aprPct }) + '</p></div>' +
      '<span data-status>' + (c.unlocked ? tag(t('m.unlocked'), 'sky') : tag(t('m.locked'), '', 'lock')) + '</span></div>' +
      '<div class="stack-8"><div class="mbar' + (c.unlocked ? ' is-full' : '') + '" role="img" aria-label="' + t('m.day', { x: c.day, d: s.lockDays }) + '"><i style="width:' + c.pct.toFixed(1) + '%"></i></div>' +
      '<div class="mbar-meta"><span>' + t('m.started', { date: F.date(s.start) }) + '</span><b>' + t('m.day', { x: c.day, d: s.lockDays }) + '</b><span>' + t('m.unlocks', { date: F.date(c.unlock) }) + '</span></div></div>' +
      rows([[t('m.interest'), '<span data-tick="' + c.interest + '|' + (c.unlocked ? 0 : c.per) + '|' + c.cap + '">' + F.fix4(c.interest) + '</span> CT' + (offline ? '<small>' + t('m.paused') + '</small>' : ''), true]]) +
      acts + '</article>';
  }
  const rv = (title: string, amount: string) => held ? { title, rows: [[t('x.amount'), amount], [t('x.fee'), t('x.fee.v', { f: fee })], [t('x.kaia'), F.kaia(kaia)]] as [string, string][], note: t('hold.fee.line') + '. ' + t('hold.fee.rv'), confirm: t('tx.confirm') } : null;
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    const c = el.closest('[data-claim]') as HTMLButtonElement | null, wd = el.closest('[data-wd]') as HTMLButtonElement | null;
    if (c && !c.disabled) { const s = stakes.find((x) => x.id === c.getAttribute('data-claim'))!; const i = F.dec(calc(s).interest, 2); void runTx({ key: 'claim:' + s.id, label: t('m.chip.claim', { i }), review: rv(t('m.claim', { i }), F.ct(calc(s).interest)), success: { title: t('m.ok.claim', { i }) }, exec: (p) => actions.claim(s.id, held, p) }); }
    if (wd && !wd.disabled) { const s = stakes.find((x) => x.id === wd.getAttribute('data-wd'))!; const a = F.dec(out(s), 4); void runTx({ key: 'wd:' + s.id, label: t('m.chip.wd', { a }), review: rv(t('m.withdraw', { a }), F.ct(out(s))), success: { title: t('m.ok.wd', { a }) }, exec: (p) => actions.withdrawStake(s.id, held, p) }); }
  };
  const hq = held ? '?state=hold' : '';
  const tabs = <StakeTabs cur="mine" n={st === 'empty' ? 0 : stakes.length} hq={hq} />;
  let body: string;
  if (st === 'error' || q.isError) body = errorNote();
  else if (loading) body = '<section class="msec" aria-busy="true">' + skel('90px') + skel('170px', '44px') + skel('70%', '22px') + '</section>' + [1, 2].map(() => '<article class="msec" aria-busy="true">' + skel('120px', '28px') + skel('100%', '14px') + skel('100%') + skel('100%', '44px') + '</article>').join('');
  else if (!stakes.length) body = empty({ icon: 'lock', title: t('m.empty.h'), body: t('m.empty.b'), action: btn(t('m.empty.btn'), { kind: 'primary', href: '/staking' }) });
  else body = (held ? hold(t('hold.stakes')) + (noKaia ? note('warn', t('hold.nokaia', { f: fee, k: F.dec(kaia, 4) }), btn(t('x.fix.kaia'), { sm: true, href: '/deposit', id: 'get-kaia' })) : '') : '') +
    '<section class="msec" id="total"><div class="mhero"><h2 class="lbl">' + t('m.staked') + '</h2><p class="fig">' + F.dec(total) + '<small>CT</small></p></div>' +
    '<div class="stats mstats"><div class="stat"><b><span data-tick="' + sofar + '|' + perAll + '">' + F.fix4(sofar) + '</span></b><span>' + t('m.sofar') + ' (CT)</span></div><div class="stat"><b>' + F.fix4(claimable) + '</b><span>' + t('m.claimable') + ' (CT)</span></div></div>' +
    (held ? rows([[t('x.kaia'), F.kaia(kaia)], [t('x.fee'), t('x.fee.v', { f: fee })]]) : '') + '</section>' +
    stakes.map(card).join('') +
    help(t('m.closed.q', { n: (q.data?.closed || []).length }), (q.data?.closed || []).map((s) => '<div class="mclosed"><div class="row-between"><span>' + F.ct(s.amount) + ', ' + t('m.card.period', { d: s.lockDays, r: s.aprPct }) + '</span>' + tag(t('m.closed'), 'line') + '</div><p class="tiny">' + t('m.paidout', { a: F.dec(s.paid || 0, 2) }) + '</p></div>').join(''));
  return (
    <Shell tab="stake" docTitle={t('s.title')} head={<Html className="ph-top" html={'<h1>' + t('s.title') + '</h1>'} />} badges={{ stake: 'dot' }}>
      {tabs}
      <Html as="div" style={{ display: 'contents' }} html={body} onClick={onClick} />
    </Shell>
  );
}
