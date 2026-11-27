// G1 Gate (platform/design-variants/paper/gate.html, DEV-PLAN 9.4): the newsstand copy. In a browser tab the platform shows
// the nameplate, a headline, how to get the paper on this device, today's lead story as an example and the link to the swap;
// play happens only in the installed app. An invite link (/i/{code} or ?invite=) leads with the code.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { LANG_NAMES, currentLang, t, useLang } from '../i18n';
import { esc } from '../lib/fmt';
import { btn, code, dateline, help, icon, langSelect, note, plate, steps } from '../ui/h';
import { qcard, qOf } from '../ui/qcard';
import { Html, Shell } from '../ui/kit';
import { qrSvg } from '../lib/qr';
import { presetOf } from '../lib/preset';
import { CONFIG } from '../config';
import { DESIGN } from '../api/mock';
import type { Market } from '../api/types';

const INVITE_KEY = 'cjp.invite';
export function savedInvite(): string | null { try { return localStorage.getItem(INVITE_KEY); } catch { return null; } }
export function saveInvite(c: string) { try { localStorage.setItem(INVITE_KEY, c); } catch { /* */ } }

type BIPEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIPEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; });

function detect(): string {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const inapp = /KAKAOTALK|Line\/|Instagram|FBAN|FBAV|NAVER\(inapp/i.test(ua);
  if (inapp) return ios ? 'inapp-ios' : 'inapp';
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios';
  if (matchMedia('(min-width: 900px) and (pointer: fine)').matches) return 'desktop';
  if (/Android/i.test(ua)) return deferred ? 'android' : 'android-manual';
  return 'generic';
}

/** in the installed app an invite link only stores the code for the first run */
export function InviteRedirect() {
  const { code: c } = useParams();
  if (c) saveInvite(c.toUpperCase());
  return <Navigate to="/" replace />;
}

export default function Gate() {
  useLang();
  const loc = useLocation();
  const params = useParams();
  const st = presetOf(loc.search);
  const m = /^\/i\/([A-Za-z0-9]+)/.exec(loc.pathname);
  const invCode = (m?.[1] || new URLSearchParams(loc.search).get('invite') || '').toUpperCase();
  const [v, setV] = useState(() => st || (invCode ? 'invited' + (detect() === 'android' || detect() === 'android-manual' || detect() === 'desktop' || detect() === 'generic' ? '' : '-' + detect()) : detect()));
  const [inviter, setInviter] = useState<string | null>(invCode ? null : DESIGN.invite.by);
  const [panelOverride, setPanelOverride] = useState<string | null>(null);
  const [inappMore, setInappMore] = useState(false);
  void params;
  useEffect(() => { if (invCode) { saveInvite(invCode); void api.inviteLookup(invCode).then((r) => setInviter(r.valid ? r.inviterName || null : null)).catch(() => {}); } }, [invCode]);
  useEffect(() => { const h = () => { deferred = null; setPanelOverride(note('ok', t('g.installed'))); }; window.addEventListener('appinstalled', h); return () => window.removeEventListener('appinstalled', h); }, []);

  const wide = matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  const inv = /^invited/.test(v);
  let base = inv ? v.replace(/^invited-?/, '') : v;
  const noName = base === 'noname' || (inv && !inviter && !st);
  if (base === 'noname') base = '';
  const shownCode = invCode || DESIGN.invite.code;
  const link = invCode ? CONFIG.appUrl + 'i/' + invCode : CONFIG.appUrl;
  const manual: [string, string][] = [[t('g.manual.1'), 'more'], [t('g.manual.2'), 'addhome'], [t('g.manual.3'), 'phone']];
  const ios: [string, string][] = [[t('g.ios.1'), 'share'], [t('g.ios.2'), 'addhome'], [t('g.ios.3'), 'phone']];
  const copy = btn(t('g.copy'), { block: true, icon: 'copy', id: 'copylink', attrs: 'data-copy="' + esc(inv ? link : CONFIG.appUrl) + '" data-toast="' + esc(t(inv ? 'g.inv.copied' : 'g.copied')) + '"' });
  const qr = (text: string, label: string) => '<div class="qr" role="img" aria-label="' + esc(label) + '" data-qr="' + esc(text) + '">' + qrSvg(text) + '<span class="qr-mark"><img src="/assets/cojam-mark.svg" alt="" width="32" height="32"></span></div>';
  const invBlock = () => '<div class="gate-inv"><h2>' + (noName ? t('g.inv.h.anon') : t('g.inv.h', { name: '<b translate="no">' + esc(inviter || DESIGN.invite.by) + '</b>' })) + '</h2>' + code(shownCode, { id: 'inv-code', label: t('g.inv.code') }) +
    '<p>' + t('g.inv.b') + '</p><p class="gate-inv-get">' + t('g.inv.get', { w: DESIGN.invite.welcome }) + '</p></div>';
  function variant(x: string): string {
    switch (x) {
      case 'android': return '<h2>' + t('g.install.h') + '</h2><p class="muted">' + t('g.install.b') + '</p>' + btn(t('g.android.btn'), { kind: 'primary', block: true, icon: 'download', id: 'install' });
      case 'accepted': return note('ok', t('g.android.accepted'));
      case 'dismissed': return '<h2>' + t('g.install.h') + '</h2>' + btn(t('g.android.btn'), { kind: 'primary', block: true, icon: 'download', id: 'install' }) + '<p class="small muted">' + t('g.android.or') + '</p>' + steps(manual);
      case 'android-manual': return '<h2>' + t('g.manual.h') + '</h2>' + steps(manual);
      case 'ios': return '<h2>' + t('g.manual.h') + '</h2>' + steps(ios);
      case 'ios-other': return '<h2>' + t('g.manual.h') + '</h2>' + steps([[t('g.iosother.1'), 'share'], ios[1], ios[2]]) + note('', t('g.iosother.note')) + copy;
      case 'inapp': return '<h2>' + t('g.inapp.h') + '</h2><p class="muted">' + t('g.inapp.body', { app: 'KakaoTalk' }) + '</p>' + btn(t('g.inapp.btn'), { kind: 'primary', block: true, iconEnd: 'ext', id: 'openext' }) + '<div class="stack-8" id="inapp-more"' + (inappMore ? '' : ' hidden') + '><p class="small muted">' + t('g.inapp.or') + '</p>' + steps([[t('g.inapp.1'), 'dots'], [t('g.inapp.2'), 'ext']]) + '</div>' + copy;
      case 'inapp-ios': return '<h2>' + t('g.inapp.h') + '</h2><p class="muted">' + t('g.inapp.body', { app: 'Instagram' }) + '</p>' + steps([[t('g.inapp.1'), 'dots'], [t('g.inapp.2'), 'ext']]) + copy;
      case 'desktop': return '<h2>' + t('g.desk.h') + '</h2><p class="muted">' + t('g.desk.body') + '</p><div class="gate-qr">' + qr(CONFIG.appUrl + '?src=qr', t('g.qr.alt')) + '<p class="mono" translate="no">' + esc(CONFIG.appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</p></div>' + copy;
      case 'generic': return '<h2>' + t('g.desk.h') + '</h2><div class="gate-qr">' + qr(CONFIG.appUrl + '?src=qr', t('g.qr.alt')) + '</div>' + help(t('g.gen.ios'), steps(ios)) + help(t('g.gen.android'), steps(manual));
      case 'installed': return note('ok', t('g.installed'));
    }
    return '';
  }
  const panel = panelOverride ?? (inv && base ? invBlock() + variant(base).replace('<h2>', '<h3>').replace('</h2>', '</h3>') : inv ? invBlock() + '<h3>' + t('g.manual.h') + '</h3>' + steps(wide ? manual : ios) : variant(v));
  // today's lead story as the example; it cannot be played here ("Example" sits in the kicker row)
  const q1 = (DESIGN.questions as unknown as Record<string, { img?: string; cat: string } & Market['text']>).q1;
  const demoM: Pick<Market, 'marketId' | 'n' | 'imageUrl' | 'category' | 'text'> = { marketId: 'demo', n: 1, imageUrl: q1.img || null, category: q1.cat as Market['category'], text: q1 };
  const demo = '<div class="gate-demo" aria-hidden="true">' + qcard(qOf(demoM), { static: true }).replace('<article ', '<article inert ').replace(/(<span class="qno"[^>]*>)[^<]*/, '$1' + t('g.example')) + '</div>';
  // one voice for the headline: the second sentence on its own line, no italic word
  const h1 = t('g.h1').replace(/<em>(.*?)<\/em>/, '<span class="gate-h1-2">$1</span>');
  const raw = '<div class="auth gate"><p class="gate-top" role="note">' + icon('shield', 16) + '<span>' + t('g.top') + '</span></p>' +
    '<header class="gate-bar">' + plate(true) + langSelect(currentLang(), LANG_NAMES) + '</header><div class="oxford" aria-hidden="true"></div>' + dateline('<span>' + t('d.next.at') + '</span>', 'dateline--cover') +
    '<div class="gate-cols"><div class="gate-col"><div class="stack-12"><h1>' + h1 + '</h1><p class="auth-lede">' + t('g.lede') + '</p></div></div>' +
    '<div class="gate-col"><section class="panel" aria-live="polite" id="panel">' + panel + '</section>' + demo +
    '<ul class="facts"><li>' + t('g.fact.1') + '</li><li>' + t('g.fact.2') + '</li><li>' + t('g.fact.3') + '</li></ul>' +
    '<section class="gate-swap"><h2>' + t('g.swap.h') + '</h2><p>' + t('g.swap.body') + '</p>' + btn(t('g.swap.btn'), { href: CONFIG.swapUrl, ext: true, iconEnd: 'ext' }) + '</section></div></div>' +
    '<footer class="gate-foot"><a href="https://cojam.app" target="_blank" rel="noopener">' + t('hd.home') + '</a><span>© 2026 Cojam</span></footer></div>' +
    (v === 'ios' ? '<p class="ios-point" aria-hidden="true"><span>' + t('g.ios.point') + '</span>' + icon('down', 20) + '</p>' : '');
  // the slip that points at Safari's Share button never lies on the steps it explains: it steps aside while they are on screen
  useEffect(() => {
    const slip = document.querySelector('.ios-point'), pnl = document.getElementById('panel');
    if (!slip || !pnl || !pnl.querySelector('.steps') || !window.IntersectionObserver) return;
    const io = new IntersectionObserver((en) => slip.classList.toggle('is-away', en[0].isIntersecting), { rootMargin: '0px 0px -8px 0px', threshold: 0.05 });
    io.observe(pnl); return () => io.disconnect();
  }, [v]);
  // the nameplate on the cover keeps its words; the masthead plate gives way only in the app
  const onClick = async (e: React.MouseEvent) => {
    const el = e.target as Element;
    if (el.closest('#install')) {
      if (deferred) { const d = deferred; await d.prompt(); const r = await d.userChoice; deferred = null; setV(r.outcome === 'accepted' ? 'accepted' : 'dismissed'); if (r.outcome === 'accepted') setTimeout(() => setV('installed'), 2200); }
      else { setPanelOverride(note('ok', t('g.android.accepted'))); setTimeout(() => setPanelOverride(note('ok', t('g.installed'))), 2200); }
    }
    if (el.closest('#openext')) {
      // Android in app browsers: try to hand the page to Chrome; show the manual steps if nothing happened
      if (/Android/i.test(navigator.userAgent)) location.href = 'intent://' + location.host + location.pathname + '#Intent;scheme=https;package=com.android.chrome;end';
      setTimeout(() => setInappMore(true), 1500);
    }
  };
  return <Shell bare cls="is-gate" docTitle="Cojam" raw={<Html as="div" style={{ display: 'contents' }} html={raw} onClick={onClick} />} />;
}
