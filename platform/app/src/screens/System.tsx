// SYS full screen states (platform/design/system.html): maintenance, update required, offline, not found, account on hold.
import { useParams } from 'react-router-dom';
import { useConfig } from '../api';
import { currentLang, t } from '../i18n';
import { esc, F } from '../lib/fmt';
import { btn, icon } from '../ui/h';
import { Html, Shell } from '../ui/kit';
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
    maintenance: { icon: 'tool', h: 'sys.maint.h', b: 'sys.maint.b', btn: 'sys.maint.btn', extra: '<p class="sys-msg">' + esc(msg) + '</p><p class="sys-meta">' + t('sys.maint.eta', { time: F.date(until, true) }) + '</p>', foot: t('sys.maint.auto') },
    update: { icon: 'download', h: 'sys.update.h', b: 'sys.update.b', btn: 'sys.update.btn' },
    offline: { icon: 'offline', h: 'sys.off.h', b: 'sys.off.b', btn: 'common.retry' },
    notfound: { icon: 'search', h: 'sys.404.h', b: 'sys.404.b', btn: 'sys.404.btn', href: '/' },
  };
  let raw: string;
  if (S === 'blocked') {
    raw = '<div class="sys sys--hold"><div class="sys-ic">' + icon('pause', 30) + '</div><h1>' + t('sys.blocked.h') + '</h1><p>' + t('sys.blocked.b') + '</p>' +
      '<section class="sys-box" aria-labelledby="works-h"><h2 id="works-h">' + t('sys.blocked.works.h') + '</h2>' + li('check', [1, 2, 3, 4].map((i) => 'sys.blocked.works.' + i)) + '<p class="sys-fee">' + t('sys.blocked.fee') + '</p></section>' +
      '<section class="sys-box" aria-labelledby="stops-h"><h2 id="stops-h">' + t('sys.blocked.stops.h') + '</h2>' + li('x', [1, 2, 3, 4, 5].map((i) => 'sys.blocked.stops.' + i)) + '</section>' +
      '<p>' + t('sys.blocked.note') + '</p><div class="sys-contact">' + btn(t('sys.blocked.contact'), { href: 'mailto:' + MAIL, icon: 'mail', block: true, id: 'contact' }) +
      '<button type="button" class="addr-chip" id="mail-copy" data-copy="' + MAIL + '" data-done="' + esc(t('w.copy.done')) + '" aria-label="' + esc(t('sys.blocked.mail') + ': ' + MAIL) + '"><span class="addr-chip-v" translate="no">' + MAIL + '</span>' + icon('copy', 16) + '</button></div>' +
      '<a class="sys-link" href="/wallet' + (CONFIG.mockApi ? '?state=hold' : '') + '">' + t('sys.blocked.btn') + '</a></div>';
  } else {
    const v = V[S] || V.notfound;
    raw = '<div class="sys"><div class="sys-ic">' + icon(v.icon, 38) + '</div><h1>' + t(v.h) + '</h1><p>' + t(v.b) + '</p>' + (v.extra || '') +
      btn(t(v.btn), { kind: 'primary', href: v.href, id: 'act' }) + (v.foot ? '<p class="sys-meta">' + v.foot + '</p>' : '') + '</div>';
  }
  const onClick = (e: React.MouseEvent) => {
    const b = (e.target as Element).closest('button#act') as HTMLButtonElement | null; if (!b) return;
    b.classList.add('is-loading'); b.innerHTML = '<span class="spin"></span><span>' + t('common.loading') + '</span>';
    setTimeout(() => {
      if (S === 'update' && 'serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then((r) => r?.update()).finally(() => location.reload());
      else location.reload();
    }, 900);
  };
  return <Shell bare docTitle={t((V[S] || { h: 'sys.blocked.h' }).h)} raw={<Html as="div" style={{ display: 'contents' }} html={raw} onClick={onClick} />} />;
}
