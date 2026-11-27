// W3 Deposit (platform/design-variants/paper/deposit.html): the address as a QR code, then in full in two lines of five
// groups, copy as the one primary action, a live line that waits for deposits (it becomes a stamp when CT lands), and what
// may be sent here. What to send and the token contract are in the sheet behind "?".
import { useEffect, useRef } from 'react';
import { useConfig, useWallet } from '../api';
import { t } from '../i18n';
import { esc, F, reduceMotion } from '../lib/fmt';
import { btn, icon, note, qbtn, rows, rstamp, skel } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { qrSvg } from '../lib/qr';
import { useOffline, usePreset } from '../state/app';
import { toast } from '../state/ui';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

export default function Deposit() {
  const st = usePreset();
  const q = useWallet();
  const cfg = useConfig();
  const offline = useOffline();
  const loading = st === 'loading' || q.isPending;
  const a = q.data?.address || '';
  const token = cfg.data?.contracts.ct || DESIGN.token;
  const prevCt = useRef<number | null>(null);
  const arrived = useRef<number | null>(st === 'arrived' ? -1 : null);
  // a deposit is seen when the CT balance goes up while this screen is open (the wallet read refreshes every 30 s)
  useEffect(() => {
    // a deposit arrived: the waiting line becomes a stamp that lands, and a slip says how much
    const land = (n: string) => { const w = document.getElementById('watch'); if (w) { w.innerHTML = rstamp('hit', t('dp.arrived', { a: n })); const s = w.querySelector('.rstamp') as HTMLElement | null; if (s && !reduceMotion()) { s.style.setProperty('--d', '0ms'); s.classList.add('is-land'); } } toast(t('dp.toast', { a: n })); };
    if (st === 'arrived') { const tm = setTimeout(() => { arrived.current = 250; land('250'); }, 1400); return () => clearTimeout(tm); }
    const ct = q.data?.ct;
    if (ct === undefined) return;
    if (prevCt.current !== null && ct > prevCt.current) land(F.dec(ct - prevCt.current));
    prevCt.current = ct;
  }, [q.data?.ct, st]);
  let body: string;
  if (st === 'error' || q.isError) body = note('error', t('dp.err'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' }));
  else {
    const qr = loading ? '<div class="qr" aria-busy="true">' + skel('100%', '176px') + '</div>' : '<div class="qr" role="img" aria-label="' + esc(t('dp.qr')) + '" data-qr="' + esc(a) + '">' + qrSvg(a) + '<span class="qr-mark"><img src="/assets/cojam-mark.svg" alt="" width="32" height="32"></span></div>';
    body = (offline ? note('warn', t('w.offline')) : '') + '<section class="msec dp-qr">' + qr + '</section>' +
      '<section class="msec" aria-labelledby="addr-h"><h2 class="lbl lbl--q" id="addr-h">' + t('pp.addr') + qbtn('deposit', t('dp.title')) + '</h2>' +
      (loading ? skel('100%', '44px') : '<p class="addr-v addr-v--lg" id="addr" translate="no">' + F.groups(a) + '</p>') +
      btn(t('w.copy'), { kind: 'primary', block: true, icon: 'copy', id: 'copy-addr', attrs: 'data-copy="' + a + '" data-done="' + esc(t('w.copy.done')) + '"', disabled: loading }) +
      '<p class="watch watch--live" id="watch" role="status">' + (offline ? icon('offline', 16) + '<span>' + t('dp.offline') + '</span>' : '<i class="press" aria-hidden="true"></i><span>' + t('dp.watch') + '</span>') + '</p></section>' +
      '<section class="msec">' + rows([[t('dp.net'), t('dp.net.v')], [t('dp.token'), t('dp.token.v')]]) +
      // one plain warning stays on the surface; old CT, exchanges and the token contract are in the sheet behind "?"
      '<p class="hold-why">' + icon('warn', 16) + '<span>' + t('dp.w1') + '</span></p></section>';
  }
  return <Shell tab="wallet" back="/wallet" title={t('dp.title')} pts={loading ? 'loading' : ''}><Html as="div" style={{ display: 'contents' }} html={body} /></Shell>;
}
