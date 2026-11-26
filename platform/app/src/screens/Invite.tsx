// I1 Invite friends (platform/design/invite.html): the offer on the band, my code and link, how it works, results, rules.
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvite } from '../api';
import { t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, code, hold, icon, note, skel, tag } from '../ui/h';
import { Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { live, toast } from '../state/ui';
import { DESIGN } from '../api/mock';

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

  const head = '<div class="inv-hero"><h1><span class="inv-pct" aria-hidden="true">' + rate + '<small>%</small></span><span class="inv-line">' + t('inv.hero.line', { r: rate }) + '</span></h1>' +
    '<p class="inv-sub">' + t('inv.hero.sub') + '</p>' +
    '<div class="inv-ex" role="img" aria-label="' + esc(t('inv.ex.sr', { a: day, b: cut })) + '"><div><span>' + t('inv.ex.friend') + '</span><b>+' + F.pts(day) + '</b></div>' + icon('right', 20) + '<div><span>' + t('inv.ex.you') + '</span><b>+' + F.pts(cut) + '</b></div></div></div>';
  const c = V?.code || DESIGN.invite.code, link = V?.link || DESIGN.invite.link, linkShort = V?.linkShort || DESIGN.invite.linkShort;
  const codeSec = held
    ? '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t('inv.code.h') + '</h2>' + hold(t('hold.invite')) + '</section>'
    : '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t('inv.code.h') + '</h2>' + code(c, { id: 'code', done: st === 'copied' }) +
      '<p class="inv-link" translate="no">' + esc(linkShort) + '</p>' +
      (offline ? '<p class="hold-why" id="inv-off">' + icon('offline', 16) + '<span>' + t('inv.offline') + '</span></p>' : '') +
      '<div class="inv-acts">' + btn(t('inv.share'), { kind: 'primary', block: true, icon: 'share', id: 'share' }) +
      btn(t('inv.copylink'), { block: true, icon: 'copy', id: 'copylink', attrs: 'data-copy="' + esc(link) + '" data-done="' + esc(t('inv.linkcopied')) + '"' }) + '</div></section>';
  const w = '<b>+' + welcome + 'P</b>', r = '<b>' + rate + '%</b>';
  const how = '<section class="sec" aria-labelledby="how-h"><h2 class="sect-h" id="how-h">' + t('inv.how.h') + '</h2><ol class="inv-steps"><li><span>' + t('inv.how.1') + '</span></li><li><span>' +
    t('inv.how.2', { w: '\u0001' }).replace('+\u0001P', w) + '</span></li><li><span>' + t('inv.how.3', { r: '\u0001' }).replace('\u0001%', r) + '</span></li></ol></section>';
  let results: string;
  if (loading) results = '<section class="sec" aria-busy="true">' + skel('120px', '20px') + '<div class="inv-tri">' + [1, 2, 3].map(() => '<div>' + skel('64px', '26px') + skel('72px', '12px') + '</div>').join('') + '</div>' +
    [1, 2, 3].map(() => '<div class="inv-friend">' + skel('110px', '16px') + skel('70px', '22px') + skel('56px', '16px') + '</div>').join('') + '<p class="sr-only" role="status">' + t('common.loading') + '</p></section>';
  else if (st === 'error' || q.isError) results = '<section class="sec" aria-labelledby="res-h"><h2 class="sect-h" id="res-h">' + t('inv.res.h') + '</h2>' + note('error', t('inv.error'), btn(t('common.retry'), { sm: true, icon: 'refresh', attrs: 'data-reload' })) + '</section>';
  else if (!V!.stats.joined) results = '<section class="sec" aria-labelledby="res-h"><h2 class="sect-h" id="res-h">' + t('inv.res.h') + '</h2><p class="inv-none">' + t('inv.empty') + '</p></section>';
  else results = '<section class="sec" aria-labelledby="res-h"><h2 class="sect-h" id="res-h">' + t('inv.res.h') + '</h2>' + (offline ? '<p class="hold-why" id="inv-stale">' + icon('info', 16) + '<span>' + t('inv.stale') + '</span></p>' : '') +
    (held ? '<p class="hold-why" id="inv-hold">' + icon('info', 16) + '<span>' + t('hold.invite.bonus') + '</span></p>' : '') + '<div class="inv-tri">' +
    '<div><b>' + V!.stats.joined + '</b><span>' + t('inv.res.joined') + '</span></div><div><b>' + F.pts(V!.stats.bonusWeek) + '</b><span>' + t('inv.res.week') + '</span></div><div><b>' + F.pts(V!.stats.bonusTotal) + '</b><span>' + t('inv.res.total') + '</span></div></div>' +
    '<h3 class="inv-sub-h">' + t('inv.friends.h') + '</h3><ul class="list inv-friends">' + V!.friends.map((f) => '<li class="inv-friend"><span class="inv-friend-n" translate="no">' + esc(f.name) + '</span>' + tag(t('inv.st.' + f.state), f.state === 'first' ? 'ink' : '') +
      '<b' + (f.points ? '' : ' class="is-zero"') + '>' + (f.points ? '+' + F.pts(f.points) : '0P') + '</b></li>').join('') + '</ul></section>';
  const rules = '<section class="sec" aria-labelledby="rules-h"><h2 class="sect-h" id="rules-h">' + t('inv.rules.h') + '</h2><ul class="inv-rules">' + [1, 2, 3, 4].map((i) => '<li>' + t('inv.rule.' + i) + '</li>').join('') + '</ul></section>';

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
    <Shell back={back} title={t('inv.title')} head={<Html as="div" style={{ display: 'contents' }} html={head} />} pts={loading ? 'loading' : ''}>
      <Html as="div" style={{ display: 'contents' }} html={codeSec + (held ? '' : how) + results + rules} onClick={onClick} />
    </Shell>
  );
}
