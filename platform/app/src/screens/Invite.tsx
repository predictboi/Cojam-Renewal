// I1 Invite friends (platform/design-variants/paper/invite.html): the offer is the headline ("10%" in the slab), worked once
// as two figures divided by a rule; then the code, the link, the action, and the results. How it works and the rules are behind "?".
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvite } from '../api';
import { t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, code, empty, hold, icon, note, qbtn, skel, tag } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

export default function Invite() {
  const st = usePreset();
  const [sp] = useSearchParams();
  const q = useInvite();
  const offline = useOffline();
  const held = useHold() || st === 'hold';
  const loading = st === 'loading' || q.isPending;
  const V = q.data;
  const rate = V ? V.referralBps / 100 : DESIGN.invite.rate, welcome = V?.welcomePoints ?? DESIGN.invite.welcome;
  const back = sp.get('from') === 'wallet' ? '/wallet' : '/profile';
  const day = 350, cut = Math.round((day * rate) / 100);
  useEffect(() => { if (st === 'shared') toast(t('inv.shared')); }, [st]);

  const hero = '<section class="sec inv-hero"><h1><span class="inv-pct" aria-hidden="true">' + rate + '<small>%</small></span><span class="inv-line">' + t('inv.hero.line', { r: rate }) + qbtn('invite', t('inv.title')) + '</span></h1>' +
    '<div class="inv-ex" role="img" aria-label="' + esc(t('inv.ex.sr', { a: day, b: cut })) + '"><div><span>' + t('inv.ex.friend') + '</span><b>+' + F.pts(day) + '</b></div>' + icon('right', 18) + '<div><span>' + t('inv.ex.you') + '</span><b>+' + F.pts(cut) + '</b></div></div>' +
    '<p class="fact" id="inv-gets"><span>' + t('inv.friend', { w: '<b>' + welcome + '</b>' }).replace(/\+<b>(\d+)<\/b>P/, '<b>+$1P</b>') + '</span></p></section>';
  const M = CONFIG.mockApi; // the design's sample code shows only in mock mode while the read is loading
  const c = V?.code || (M ? DESIGN.invite.code : ''), link = V?.link || (M ? DESIGN.invite.link : ''), linkShort = V?.linkShort || (M ? DESIGN.invite.linkShort : '');
  const codeSec = held
    ? '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t('inv.code.h') + '</h2>' + hold(t('hold.invite')) + '</section>'
    : '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t('inv.code.h') + '</h2>' + code(c, { id: 'code', done: st === 'copied' }) +
      '<p class="inv-link" translate="no">' + esc(linkShort) + '</p>' +
      (offline ? '<p class="hold-why" id="inv-off">' + icon('offline', 16) + '<span>' + t('inv.offline') + '</span></p>' : '') +
      '<div class="inv-acts">' + btn(t('inv.share'), { kind: 'primary', block: true, icon: 'share', id: 'share' }) +
      btn(t('inv.copylink'), { block: true, icon: 'copy', id: 'copylink', attrs: 'data-copy="' + esc(link) + '" data-done="' + esc(t('inv.linkcopied')) + '"' }) + '</div></section>';
  let results: string;
  if (loading) results = '<section class="sec" aria-busy="true">' + skel('120px', '20px') + '<div class="tri">' + [1, 2, 3].map(() => '<div class="tri-c">' + skel('64px', '24px') + skel('72px', '12px') + '</div>').join('') + '</div>' +
    [1, 2, 3].map(() => '<div class="inv-friend">' + skel('110px', '16px') + skel('70px', '22px') + skel('56px', '16px') + '</div>').join('') + '<p class="sr-only" role="status">' + t('common.loading') + '</p></section>';
  else if (st === 'error' || q.isError) results = '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t('inv.res.h') + '</h2>' + note('error', t('inv.error'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' })) + '</section>';
  // no friend yet: the one notice pattern of every empty state (a stamp, the headline, one line)
  else if (!V!.stats.joined) results = '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t('inv.res.h') + '</h2>' + empty({ title: t('inv.empty.h'), body: t('inv.empty.b') }) + '</section>';
  else results = '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t('inv.res.h') + '</h2>' + (offline ? '<p class="hold-why" id="inv-stale">' + icon('info', 16) + '<span>' + t('inv.stale') + '</span></p>' : '') +
    (held ? '<p class="hold-why" id="inv-hold">' + icon('info', 16) + '<span>' + t('hold.invite.bonus') + '</span></p>' : '') + '<div class="tri">' +
    '<div class="tri-c"><p class="tri-fig">' + V!.stats.joined + '</p><p class="tri-sub">' + t('inv.res.joined') + '</p></div><div class="tri-c"><p class="tri-fig">' + F.pts(V!.stats.bonusWeek) + '</p><p class="tri-sub">' + t('inv.res.week') + '</p></div><div class="tri-c"><p class="tri-fig">' + F.pts(V!.stats.bonusTotal) + '</p><p class="tri-sub">' + t('inv.res.total') + '</p></div></div>' +
    '<h3 class="inv-sub-h">' + t('inv.friends.h') + '</h3><ul class="list">' + V!.friends.map((f) => '<li class="inv-friend"><span translate="no">' + esc(f.name) + '</span>' + tag(t('inv.st.' + f.state), f.state === 'first' ? 'ink' : '') +
      '<b' + (f.points ? '' : ' class="is-zero"') + '>' + (f.points ? '+' + F.pts(f.points) : '0P') + '</b></li>').join('') + '</ul></section>';

  const busy = useRef(false);
  const onClick = (e: React.MouseEvent) => {
    const share = (e.target as Element).closest('#share') as HTMLButtonElement | null; if (!share) return;
    const data = { title: 'Cojam', text: t('inv.share.text', { code: c, w: welcome }), url: link };
    if (navigator.share && !offline) { navigator.share(data).then(() => toast(t('inv.shared'))).catch(() => {}); return; }
    try { void navigator.clipboard?.writeText(link).catch(() => {}); } catch { /* */ }
    if (busy.current) return; busy.current = true;
    const lab = share.querySelector('span')!; const old = lab.textContent; lab.textContent = t('inv.linkcopied'); share.classList.add('is-done'); live(t('inv.linkcopied'));
    setTimeout(() => { lab.textContent = old; share.classList.remove('is-done'); busy.current = false; }, 2000);
  };
  return (
    <Shell back={back} title={t('inv.title')} pts={loading ? 'loading' : ''}>
      <Html as="div" style={{ display: 'contents' }} html={hero + codeSec + results} onClick={onClick} />
    </Shell>
  );
}
