// SYS full screen states (platform/design-variants/paper/system.html): maintenance, update required, offline, not found,
// each the one notice under the nameplate, and the full explanation of an account on hold.
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConfig } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, icon, notice, plate, tag } from '../ui/h';
import { Html, Shell, usePlateFit } from '../ui/kit';
import { CONFIG } from '../config';

export default function System({ kind }: { kind?: string }) {
  const params = useParams();
  const cfg = useConfig();
  const S = kind || params.kind || 'maintenance';
  const MAIL = CONFIG.supportEmail;
  const li = (ic: string, keys: string[]) => '<ul>' + keys.map((k) => '<li>' + icon(ic, 18) + '<span>' + t(k) + '</span></li>').join('') + '</ul>';
  const until = cfg.data?.flags.maintenanceUntil ? Date.parse(cfg.data.flags.maintenanceUntil) : Date.now() + 40 * 60000;
  const msg = cfg.data?.flags.maintenanceMessage?.[currentLang()] || t('sys.maint.msg');
  const V: Record<string, { icon: string; h: string; b: string; btn: string; extra?: string; foot?: string; href?: string }> = {
    maintenance: { icon: 'tool', h: 'sys.maint.h', b: 'sys.maint.b', btn: 'sys.maint.btn', extra: '<div class="sys-box"><p class="small">' + esc(msg) + '</p><p class="sys-fee">' + t('sys.maint.eta', { time: F.date(until, true) }) + '</p></div>', foot: t('sys.maint.auto') },
    update: { icon: 'download', h: 'sys.update.h', b: 'sys.update.b', btn: 'sys.update.btn' },
    offline: { icon: 'offline', h: 'sys.off.h', b: 'sys.off.b', btn: 'common.retry' },
    notfound: { icon: 'search', h: 'sys.404.h', b: 'sys.404.b', btn: 'sys.404.btn', href: '/' },
  };
  // the nameplate (on hold and not found with a back arrow), the thick and thin rule, then one notice
  const back = S === 'blocked' ? '/wallet' + (CONFIG.mockApi ? '?state=hold' : '') : '/';
  const top = '<header class="gate-bar">' + (S === 'blocked' || S === 'notfound' ? '<a class="mast-back" href="' + back + '" aria-label="' + esc(t('hd.back')) + '" data-back>' + icon('back', 22) + '</a>' : '') +
    '<a class="mast-home" href="' + back + '" aria-label="' + esc(t('hd.home')) + '">' + plate() + '</a>' + (S === 'blocked' ? tag(t('hold.tag'), 'ink', 'pause') : '') + '</header><div class="oxford" aria-hidden="true"></div>';
  let raw: string;
  if (S === 'blocked') {
    // account on hold: calm and complete; the address is a mail link and also a copy chip
    raw = '<div class="sys"><h1>' + t('sys.blocked.h') + '</h1><p>' + t('sys.blocked.b') + '</p>' +
      '<section class="sys-box" aria-labelledby="works-h"><h2 id="works-h">' + t('sys.blocked.works.h') + '</h2>' + li('check', [1, 2, 3, 4].map((i) => 'sys.blocked.works.' + i)) + '<p class="sys-fee">' + t('sys.blocked.fee') + '</p></section>' +
      '<section class="sys-box" aria-labelledby="stops-h"><h2 id="stops-h">' + t('sys.blocked.stops.h') + '</h2>' + li('x', [1, 2, 3, 4, 5].map((i) => 'sys.blocked.stops.' + i)) + '</section>' +
      '<section class="sys-box"><p class="small">' + t('sys.blocked.note') + '</p><div class="sys-contact">' + btn(t('sys.blocked.contact'), { href: 'mailto:' + MAIL, icon: 'mail', block: true, id: 'contact' }) +
      '<button type="button" class="addr-chip addr-chip--text" id="mail-copy" data-copy="' + MAIL + '" data-done="' + esc(t('w.copy.done')) + '" aria-label="' + esc(t('sys.blocked.mail') + ': ' + MAIL) + '"><span class="addr-chip-v" translate="no">' + MAIL + '</span>' + icon('copy', 16) + '</button></div>' +
      '<a class="sys-link" href="' + back + '">' + t('sys.blocked.btn') + '</a></section></div>';
  } else {
    const v = V[S] || V.notfound;
    raw = '<div class="sys sys--center">' + notice(v.icon) + '<h1>' + t(v.h) + '</h1><p>' + t(v.b) + '</p>' + (v.extra || '') +
      btn(t(v.btn), { kind: 'primary', href: v.href, id: 'act' }) + (v.foot ? '<p class="sys-fee">' + v.foot + '</p>' : '') + '</div>';
  }
  raw = '<div class="auth">' + top + raw + '</div>';
  const nav = useNavigate();
  // the nameplate gives way to the mark when the bar is too narrow (the "On hold" tag beside it at 320 px), as in the masthead
  const plateRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { plateRef.current = document.querySelector('.auth > .gate-bar .plate'); });
  usePlateFit(plateRef, '.tag', [S]);
  const onClick = (e: React.MouseEvent) => {
    // Back returns to where the player came from (Home, Wallet, Staking); the fixed parent is the fallback for a direct visit
    if ((e.target as Element).closest('[data-back]') && window.history.length > 1 && (window.history.state?.idx ?? 0) > 0) { e.preventDefault(); nav(-1); return; }
    const b = (e.target as Element).closest('button#act') as HTMLButtonElement | null; if (!b) return;
    b.classList.add('is-loading'); b.innerHTML = '<span class="spin"></span><span>' + t('common.loading') + '</span>';
    setTimeout(() => {
      if (S === 'update' && 'serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then((r) => r?.update()).finally(() => location.reload());
      else location.reload();
    }, 900);
  };
  return <Shell bare docTitle={t((V[S] || { h: 'sys.blocked.h' }).h)} raw={<Html as="div" style={{ display: 'contents' }} html={raw} onClick={onClick} />} />;
}
