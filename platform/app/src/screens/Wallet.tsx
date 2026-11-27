// W1 Wallet: the accounts, read at a glance (platform/design-variants/paper/wallet.html). One figure (CT available) with
// its two actions, three short rows, then the points with the one primary action. Every explanation is behind a "?"
// (why KAIA, how points become CT) or in the closed token disclosure. A zero is never a hero: it drops to plain grey text.
import { useConfig, useWallet } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { addr, btn, help, hold, icon, note, qbtn, skel, stamp } from '../ui/h';
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
  const err = st === 'error' || q.isError;
  const ko = currentLang() === 'ko';
  let body: string;
  if (loading) {
    body = '<section class="msec" aria-busy="true">' + skel('90px') + skel('220px', '56px') + '<div class="acts">' + skel('100%', '44px') + skel('100%', '44px') + '</div>' + skel('100%', '48px') + skel('100%', '48px') + '</section>' +
      '<section class="msec" aria-busy="true">' + skel('60px') + skel('140px', '44px') + skel('100%', '52px') + '</section><p class="sr-only" role="status">' + t('common.loading') + '</p>';
  } else {
    const d = q.data!;
    const pts = d.points, a = d.address, ct = d.ct;
    const token = cfg.data?.contracts.ct || DESIGN.token;
    const explorer = cfg.data?.explorer || CONFIG.chain.explorer;
    const rate = F.int(d.convert.pointsPerCT || 1000) + 'P = 1 CT';
    const hit = d.pendingHit;
    body = (offline ? note('warn', t('w.offline')) : '') + (held ? hold(t('hold.wallet')) : '') +
      '<section class="msec" aria-labelledby="ct-h">' + (err ? note('warn', t('e.rpc'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' })) : '') +
      '<div class="mhero"><h2 class="lbl" id="ct-h">' + t('w.avail') + '</h2><p class="fig fig--xl" id="ct-fig">' + (ct ? F.dec(ct) + '<small>CT</small>' : '<span class="is-zero">0 CT</span>') + '</p>' + (ko ? '<p class="sub">' + F.krw(ct) + '</p>' : '') + '</div>' +
      '<div class="acts">' + btn(t('w.deposit'), { icon: 'download', href: '/deposit', disabled: offline, id: 'dep' }) + btn(t('w.withdraw'), { icon: 'share', href: '/withdraw', disabled: offline, id: 'wd' }) + '</div>' +
      '<div class="list"><div class="wrow wrow--addr"><span>' + t('pp.addr') + '</span>' + addr(a, { id: 'copy-addr' }) + '</div>' +
      '<a class="wrow" href="/stakes"><span>' + t('w.staked') + '</span><b id="staked">' + F.dec(d.staked) + ' <small>CT</small></b><span class="wrow-go"><span class="sr-only">' + t('s.mine', { n: d.openStakes }) + '</span><span aria-hidden="true">' + d.openStakes + '</span>' + icon('chev', 16) + '</span></a>' +
      // why KAIA matters is one tap away; on hold the player pays fees, which is a state, so it is a labelled fact
      '<div class="wrow"><span class="wrow-l">KAIA' + qbtn('kaia', 'KAIA') + '</span><b>' + F.dec(d.kaia, 4) + ' <small>KAIA</small></b>' + (held ? '<small class="fact"><b>' + t('pp.youpay') + '</b></small>' : '') + '</div></div></section>' +
      '<section class="msec" aria-labelledby="pt-h"><div class="mhero"><h2 class="lbl lbl--q" id="pt-h">' + t('w.points') + qbtn('points', t('w.points')) + '</h2><p class="fig" id="pt-fig">' + (pts ? F.int(pts) + '<small>P</small>' : '<span class="is-zero">0P</span>') + '</p></div>' +
      '<p class="fact"><b>' + rate + '</b>' + (hit ? '<span class="fact-sep" aria-hidden="true"></span>' + t('pp.at', { p: hit.points, time: F.time(hit.landsAt) }) : '') + '</p>' +
      '<div class="wconvert">' + btn(t('w.convert'), { kind: 'primary', block: true, href: '/convert', disabled: offline || held, id: 'convert' }) + '</div>' +
      '<a class="inv-row" id="to-invite" href="/invite?from=wallet"><span class="inv-row-t"><b>' + t('w.invite') + '</b></span><span class="inv-row-go">+' + F.pts(d.inviteWeek) + icon('chev', 16) + '</span></a></section>' +
      help(t('w.info'), '<p class="hold-why">' + icon('warn', 16) + '<span>' + t('w.token') + '</span></p><div class="mcontract"><p class="addr-v" translate="no">' + F.groups(token) + '</p>' +
        btn(t('w.token.copy'), { sm: true, icon: 'copy', attrs: 'data-copy="' + token + '" data-toast="' + esc(t('w.token.copied')) + '" data-done="' + esc(t('w.copy.done')) + '"' }) +
        '<a class="linkish" id="scan" translate="no" href="' + explorer + '/address/' + a + '" target="_blank" rel="noopener" aria-label="' + esc(t('w.scan')) + '">Kaiascan' + icon('ext', 16) + '</a></div>');
  }
  return (
    <Shell tab="wallet" docTitle={t('w.title')} live={err ? stamp(48) : ''} head={<Html className="ph-top" html={'<h1>' + t('w.title') + '</h1>'} />} pts={loading ? 'loading' : err ? 'stale' : ''}>
      <Html as="div" style={{ display: 'contents' }} html={body} />
    </Shell>
  );
}
