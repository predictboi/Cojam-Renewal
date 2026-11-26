// W1 Wallet (platform/design/wallet.html): CT as the hero with the address chip, deposit and withdraw, staked and KAIA,
// then points with Convert as the one primary action, the invite bonus row, and the token contract for reference.
import { useConfig, useMe, useWallet } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { addr, btn, help, hold, icon, note, skel, stamp, tag } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

export default function Wallet() {
  const st = usePreset();
  const q = useWallet();
  const cfg = useConfig();
  const offline = useOffline();
  const held = useHold() || st === 'hold';
  const loading = st === 'loading' || q.isPending;
  const ko = currentLang() === 'ko';
  let body: string;
  if (loading) {
    body = '<section class="msec" aria-busy="true">' + skel('90px') + skel('200px', '44px') + '<div class="acts">' + skel('100%', '44px') + skel('100%', '44px') + '</div></section>' +
      '<section class="msec" aria-busy="true">' + skel('150px') + skel('100%', '44px') + skel('100%', '44px') + '</section><section class="msec" aria-busy="true">' + skel('60px') + skel('140px', '28px') + skel('100%') + '</section><p class="sr-only" role="status">' + t('common.loading') + '</p>';
  } else {
    const d = q.data!;
    const err = st === 'error' || q.isError;
    const pts = d.points, canCt = Math.floor(pts / (d.convert.pointsPerCT || 1000)), a = d.address;
    const token = cfg.data?.contracts.ct || DESIGN.token;
    const explorer = cfg.data?.explorer || CONFIG.chain.explorer;
    body = (offline ? note('warn', t('w.offline')) : '') + (held ? hold(t('hold.wallet')) : '') +
      '<section class="msec" aria-labelledby="ct-h">' + (err ? note('warn', t('e.rpc'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' })) : '') +
      '<div class="mhero"><h2 class="lbl" id="ct-h">' + t('w.avail') + '</h2><p class="fig" id="ct-fig">' + F.dec(d.ct) + '<small>CT</small></p>' + (ko ? '<p class="sub">' + F.krw(d.ct) + '</p>' : '') + '</div>' +
      '<div class="wid">' + addr(a, { id: 'copy-addr' }) + stamp(err ? 48 : 6) + '</div>' +
      '<div class="acts">' + btn(t('w.deposit'), { href: '/deposit', icon: 'download', disabled: offline }) + btn(t('w.withdraw'), { href: '/withdraw', icon: 'share', disabled: offline, id: 'wd' }) + '</div>' +
      '<div class="list"><a class="wrow" href="/stakes"><span>' + t('w.staked') + '</span><b id="staked">' + F.dec(d.staked) + ' <small>CT</small></b><span class="wrow-go"><span class="sr-only">' + t('s.mine', { n: d.openStakes }) + '</span><span aria-hidden="true">' + d.openStakes + '</span>' + icon('chev', 16) + '</span></a>' +
      '<div class="wrow"><span>KAIA</span><b>' + F.dec(d.kaia, 4) + ' <small>KAIA</small></b><small>' + t(held ? 'hold.kaia.note' : 'w.kaia.note') + '</small></div></div></section>' +
      '<section class="msec" aria-labelledby="pt-h"><div class="mhero"><h2 class="lbl" id="pt-h">' + t('w.points') + '</h2><p class="fig mfig-2" id="pt-fig">' + F.int(pts) + '</p></div>' +
      '<p class="mline">' + (canCt ? t('w.ready', { n: canCt }) : t('w.notyet', { g: F.int(d.convert.min - pts) })) + '</p>' +
      (d.pendingHit && (st === '' || st === 'offline' || held) ? '<p class="wpend">' + tag(t('w.onway')) + '<span>' + t('w.pendinghit', { p: d.pendingHit.points, time: F.time(d.pendingHit.landsAt) }) + '</span></p>' : '') +
      '<div class="wconvert">' + btn(t('w.convert'), { kind: 'primary', block: true, href: '/convert', disabled: offline || held, id: 'convert' }) + (held ? '<p class="hold-why" id="convert-why">' + icon('pause', 16) + '<span>' + t('hold.convert.reason') + '</span></p>' : '') + '</div>' +
      '<a class="inv-row winv" id="to-invite" href="/invite?from=wallet"><span class="inv-row-t"><b>' + t('w.invite') + '</b><small>' + t('inv.entry.sub', { r: 10 }) + '</small></span><span class="inv-row-go">+' + F.pts(d.inviteWeek) + icon('chev', 16) + '</span></a></section>' +
      help(t('w.info'), '<p class="note note-warn">' + icon('warn', 18) + '<span>' + t('w.token') + '</span></p><div class="mcontract"><p class="addr-v" translate="no">' + F.groups(token) + '</p>' +
        btn(t('w.token.copy'), { sm: true, icon: 'copy', attrs: 'data-copy="' + token + '" data-toast="' + esc(t('w.token.copied')) + '" data-done="' + esc(t('w.copy.done')) + '"' }) +
        '<a class="linkish" id="scan" translate="no" href="' + explorer + '/address/' + a + '" target="_blank" rel="noopener" aria-label="' + esc(t('w.scan')) + '">Kaiascan' + icon('ext', 16) + '</a></div>');
  }
  return (
    <Shell tab="wallet" docTitle={t('w.title')} head={<Html className="ph-top" html={'<h1>' + t('w.title') + '</h1>'} />} pts={loading ? 'loading' : st === 'error' || q.isError ? 'stale' : ''}>
      <Html as="div" style={{ display: 'contents' }} html={body} />
    </Shell>
  );
}
