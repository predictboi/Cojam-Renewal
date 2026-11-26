// W3 Deposit (platform/design/deposit.html): the full address with its QR, copy as the primary action, the network and
// token, and the watch line that turns into "arrived" when CT lands.
import { useEffect, useRef } from 'react';
import { useConfig, useWallet } from '../api';
import { t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, icon, note, rows, skel, tag } from '../ui/h';
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
    if (st === 'arrived') { const tm = setTimeout(() => { arrived.current = 250; const w = document.getElementById('watch'); if (w) w.innerHTML = tag(t('dp.arrived', { a: '250' }), 'up', 'check'); toast(t('dp.toast', { a: '250' })); }, 1400); return () => clearTimeout(tm); }
    const ct = q.data?.ct;
    if (ct === undefined) return;
    if (prevCt.current !== null && ct > prevCt.current) { const n = F.dec(ct - prevCt.current); const w = document.getElementById('watch'); if (w) w.innerHTML = tag(t('dp.arrived', { a: n }), 'up', 'check'); toast(t('dp.toast', { a: n })); }
    prevCt.current = ct;
  }, [q.data?.ct, st]);
  let body: string;
  if (st === 'error' || q.isError) body = note('error', t('dp.err'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' }));
  else {
    const qr = loading ? '<div class="qr" aria-busy="true">' + skel('100%', 'auto') + '</div>' : '<div class="qr" role="img" aria-label="' + esc(t('dp.qr')) + '" data-qr="' + esc(a) + '">' + qrSvg(a) + '<span class="qr-mark"><img src="/assets/cojam-mark.svg" alt="" width="32" height="32"></span></div>';
    body = '<p class="lead">' + t('dp.lead') + '</p><section class="msec dp-qr">' + qr + '</section>' +
      '<section class="msec maddr" aria-labelledby="addr-h"><h2 class="lbl" id="addr-h">' + t('w.addr') + '</h2>' +
      (loading ? skel('100%', '50px') : '<p class="addr-v" id="addr" translate="no">' + F.groups(a) + '</p>') +
      btn(t('w.copy'), { kind: 'primary', block: true, icon: 'copy', id: 'copy-addr', attrs: 'data-copy="' + a + '" data-done="' + esc(t('w.copy.done')) + '"', disabled: loading }) +
      '<div class="maddr-links"><p class="watch" id="watch" role="status">' + (offline ? icon('offline', 16) + '<span>' + t('dp.offline') + '</span>' : '<span class="live-dot"></span><span>' + t('dp.watch') + '</span>') + '</p></div></section>' +
      '<section class="msec">' + rows([[t('dp.net'), t('dp.net.v')], [t('dp.token'), t('dp.token.v')]]) +
      '<div class="dp-token"><p class="addr-v" translate="no">' + F.groups(token) + '</p><button type="button" class="linkish" data-copy="' + token + '" data-toast="' + esc(t('w.token.copied')) + '" aria-label="' + esc(t('w.token.copy')) + '">' + icon('copy', 16) + '<span>' + t('common.copy') + '</span></button></div>' +
      '<div class="note note-warn">' + icon('warn', 18) + '<div class="note-body"><ul><li>' + t('dp.w1') + '</li><li>' + t('dp.w2') + ' <a href="' + CONFIG.swapUrl + '" target="_blank" rel="noopener">' + t('g.swap.btn') + '</a></li><li>' + t('dp.w3') + '</li></ul></div></div></section>';
  }
  return <Shell tab="wallet" back="/wallet" title={t('dp.title')} pts={loading ? 'loading' : ''}><Html as="div" style={{ display: 'contents' }} html={body} /></Shell>;
}
