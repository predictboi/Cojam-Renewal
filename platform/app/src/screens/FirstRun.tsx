// A2 First run (platform/design-variants/paper/first-run.html): three pages, each a figure on a fresh sheet, a slab headline
// and one line; the optional invite code on the first one, the language
// control, and the setup line ("Setting up your game" until the device is ready to play).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ApiError } from '../api/errors';
import { LANGS, LANG_NAMES, setLang, t, useLang, type Lang } from '../i18n';
import { esc } from '../lib/fmt';
import { day5, halftone, icon, plate } from '../ui/h';
import { live } from '../state/ui';
import { Html, Icon, Seg, Shell } from '../ui/kit';
import { useOffline, usePreset } from '../state/app';
import { loadPlayKey, playKeyValid } from '../chain/playKey';
import { savedInvite } from './Gate';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

export default function FirstRun() {
  const { lang } = useLang();
  const st = usePreset();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const offline = useOffline() || st === 'code-offline';
  const from = sp.get('from');
  const exit = from === 'profile' ? '/profile' : '/';
  const [n, setN] = useState(+st >= 1 && +st <= 3 ? +st : st === 'settingup' ? 3 : 1);
  const V = DESIGN.invite;
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, enabled: !CONFIG.mockApi });
  const ownCode = session.data?.invite.code || '';
  const PRESET: Record<string, string> = { 'code-valid': V.code, 'code-unknown': 'KAIA999', 'code-own': V.self, 'code-linked': V.code, 'code-offline': V.code };
  // the invite code is a visible field on the first page (never a link to unfold); a code from the install link is already in it
  const codeOpen = from !== 'profile';
  const [code, setCode] = useState(PRESET[st] || savedInvite() || '');
  const [cs, setCs] = useState<{ kind: 'help' | 'checking' | 'ok' | 'error' | 'linked'; key?: string; name?: string }>({ kind: st === 'code-linked' ? 'linked' : 'help', name: st === 'code-linked' ? V.known[V.code as keyof typeof V.known] : undefined });
  const [ready, setReady] = useState(from === 'profile');
  const [waiting, setWaiting] = useState(false);
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  // setup (registration, play key) runs behind the panels; the last button waits for it when it is not done
  useEffect(() => {
    if (ready) return;
    let alive = true;
    const check = async () => {
      if (CONFIG.mockApi) { await new Promise((r) => setTimeout(r, st === 'settingup' ? 9000 : 3200)); }
      else { for (;;) { const k = await loadPlayKey(); if (k && playKeyValid(k)) break; await new Promise((r) => setTimeout(r, 1000)); if (!alive) return; } }
      if (alive) setReady(true);
    };
    void check();
    return () => { alive = false; };
  }, []);
  const leave = async () => {
    if (!ready) { setWaiting(true); return; }
    void api.patchMe({ onboarded: true }).catch(() => {}); void qc.invalidateQueries({ queryKey: ['me'] });
    nav(exit, { replace: true });
  };
  useEffect(() => { if (ready && waiting) void leave(); }, [ready, waiting]);

  const mapErr = (c: string) => (c === 'INVITE_SHORT' ? 'o.code.short' : c === 'INVITE_OWN' ? 'o.code.own' : c === 'NETWORK' ? 'o.code.offline' : 'o.code.unknown');
  // Apply only checks the code (GET /v1/invite/lookup); the link is made once, when the player moves on with it (redeem)
  const check = async (then?: () => void, now?: boolean) => {
    const v = norm(code); setCode(v); if (!v || cs.kind === 'checking') return;
    if (offline) return setCs({ kind: 'error', key: 'o.code.offline' });
    if (v.length < 6) return setCs({ kind: 'error', key: 'o.code.short' });
    if (v === (CONFIG.mockApi ? V.self : ownCode)) return setCs({ kind: 'error', key: 'o.code.own' });
    if (!now) setCs({ kind: 'checking' });
    try {
      const r = await api.inviteLookup(v);
      if (!r.valid) return setCs({ kind: 'error', key: 'o.code.unknown' });
      setCs({ kind: 'ok', name: r.inviterName }); then?.();
    } catch (e) { setCs({ kind: 'error', key: mapErr((e as ApiError).code) }); }
  };
  /** binding is final: POST /v1/invite/redeem, once, when the player leaves the first panel with a checked code */
  const redeemed = useRef(false);
  const redeem = async (): Promise<boolean> => {
    if (redeemed.current) return true;
    try { const r = await api.inviteRedeem(norm(code)); redeemed.current = true; setCs({ kind: 'linked', name: r.inviterName }); return true; }
    catch (e) {
      const c = (e as ApiError).code;
      if (c === 'INVITE_ALREADY_LINKED') { redeemed.current = true; setCs({ kind: 'linked', name: String((e as ApiError).extra?.inviterName || '') }); return true; }
      setCs({ kind: 'error', key: mapErr(c) }); return false;
    }
  };
  const preChecked = useRef(false);
  useEffect(() => { if (!preChecked.current && (PRESET[st] || (!st && savedInvite())) && st !== 'code-linked') { preChecked.current = true; void check(undefined, true); } }, []);
  const go = (i: number) => { if (i < 1) return; if (i > 3) { void leave(); return; } setN(i); setTimeout(() => (document.querySelector('[data-panel="' + i + '"] h1') as HTMLElement | null)?.focus({ preventScroll: true }), 0); };
  const next = async () => {
    // a code that is not right stops Next and says why (the message under the field, announced, with the field focused)
    if (n === 1 && codeOpen && code && cs.kind !== 'ok' && cs.kind !== 'linked') {
      if (cs.kind === 'error') { live(t(cs.key!)); (document.getElementById('code') as HTMLInputElement | null)?.focus(); document.getElementById('code-msg')?.scrollIntoView({ block: 'nearest' }); }
      else void check(async () => { if (await redeem()) go(2); });
      return;
    }
    if (n === 1 && codeOpen && cs.kind === 'ok' && !(await redeem())) return;
    go(n + 1);
  };
  const closeCode = () => { setCode(''); setCs({ kind: 'help' }); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; if (e.key === 'ArrowRight') go(n + 1); if (e.key === 'ArrowLeft') go(n - 1); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });
  const x0 = useRef<number | null>(null);
  // the drawing is scaled to the band, whatever the band's height on this phone
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fitArt = () => rootRef.current?.querySelectorAll<HTMLElement>('.onb-art').forEach((band) => {
      const f = band.firstElementChild as HTMLElement | null; if (!f) return; f.style.transform = '';
      const hid = band.closest('[hidden]') as HTMLElement | null; if (hid) hid.hidden = false;
      const k = Math.min(1, (band.clientHeight - 24) / f.offsetHeight, (band.clientWidth - 24) / f.offsetWidth);
      if (hid) hid.hidden = true; f.style.transform = k < 1 ? 'scale(' + k.toFixed(3) + ')' : '';
    });
    fitArt(); window.addEventListener('resize', fitArt); void document.fonts?.ready.then(fitArt);
    // the band shrinks when the invite code opens
    const ro = new ResizeObserver(fitArt); rootRef.current?.querySelectorAll('.onb-art').forEach((b) => ro.observe(b));
    return () => { window.removeEventListener('resize', fitArt); ro.disconnect(); };
  }, [lang]);

  const art = (i: number) => {
    if (i === 1) return '<div class="art-fig"><div class="art-cards" aria-hidden="true"><i></i><i><span class="art-img">' + halftone('/assets/img/q1-bitcoin.svg', 'crypto', 320, 240) + '</span><span class="art-ch"><b></b><b></b></span></i></div>' + day5(['done', 'done', 'pend', '', ''], { label: ' ' }) + '</div>';
    if (i === 2) return '<div class="art-fig"><div class="two"><div><p class="fig">+100P</p><p class="small muted">' + t('o.2.a') + '</p></div><div><p class="fig">+50P</p><p class="small muted">' + t('o.2.c') + '</p></div></div>' + day5(['done', 'done', 'done', 'done', 'done'], { label: ' ' }) + '</div>';
    return '<div class="art-swap" aria-hidden="true"><span class="art-coin">1,000P</span>' + icon('right', 28) + '<span class="art-coin">1 CT</span></div>';
  };
  const ok = cs.kind === 'ok' || cs.kind === 'linked';
  // the help line under the field is gone: the field shows only an error or a confirmation
  const msg = cs.kind === 'help' ? ''
    : cs.kind === 'checking' ? '<span class="spin"></span><span>' + t('o.code.checking') + '</span>'
      : cs.kind === 'ok' ? icon('check', 16) + '<span>' + t('o.code.ok', { name: '<b translate="no">' + esc(cs.name || '') + '</b>', w: V.welcome }) + '</span>'
        : cs.kind === 'linked' ? icon('check', 16) + '<span>' + t('o.code.linked', { name: '<b translate="no">' + esc(cs.name || '') + '</b>' }) + '</span>'
          : icon('warn', 16) + '<div><span>' + t(cs.key!) + '</span><button type="button" class="linkish" id="code-without">' + t('o.code.without') + '</button><small class="onb-code-later">' + t('o.code.later') + '</small></div>';
  const raw = (
    <div className={'auth auth--onb' + (n === 1 && codeOpen ? ' is-code' : '')} ref={rootRef}>
      <header className="gate-bar">
        {/* pages 2 and 3 have a way back to the page before (a swipe to the right does the same) */}
        {n > 1 && <button type="button" className="mast-back" id="onb-back" aria-label={t('hd.back')} onClick={() => go(n - 1)}><Icon name="back" size={22} /></button>}
        <Html as="span" className="onb-plate" html={plate()} />
        <a className="linkish linkish--pad" id="onb-exit" href={exit} onClick={(e) => { e.preventDefault(); void leave(); }}>{t(from === 'profile' ? 'common.close' : 'o.skip')}</a>
      </header>
      <div className="oxford" aria-hidden="true" />
      <div className="onb-wrap">
        <ol id="panels" style={{ touchAction: 'pan-y' }} onPointerDown={(e) => { x0.current = e.clientX; }} onPointerUp={(e) => { if (x0.current === null) return; const d = e.clientX - x0.current; x0.current = null; if (d < -60) next(); else if (d > 60) go(n - 1); }}>
          {[1, 2, 3].map((i) => (
            <li key={i} className="onb" hidden={i !== n} data-panel={i}>
              <Html className="onb-art" html={art(i)} />
              <div className="stack-12"><h1 tabIndex={-1}>{t('o.' + i + '.h')}</h1><p className="auth-lede">{t('pp.o' + i)}</p>
                {/* the wait before the first conversion is a fact of the reward, told here before the player meets it */}
                {i === 3 && <p className="fact" id="onb-first"><b>{t('c.first')}</b>{t('c.first.v')}</p>}</div>
            </li>
          ))}
        </ol>
        <div className="onb-foot">
          <div className="dots" role="img" aria-label={t('o.step', { n })} id="dots">{[1, 2, 3].map((i) => <i key={i} className={i === n ? 'is-on' : undefined} />)}</div>
          <div className="onb-code" id="codebox" hidden={!(n === 1 && from !== 'profile')}>
            <div className="onb-code" id="code-form" hidden={!codeOpen}>
              <div className="onb-code-top"><label htmlFor="code">{t('o.code.q')}<small>{t('o.code.opt')}</small></label></div>
              <div className={'field-box field-box--text' + (ok ? ' is-ok' : '') + (cs.kind === 'error' ? ' is-error' : '')}>
                <input id="code" name="invite-code" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="done" maxLength={8}
                  placeholder={t('o.code.ph')} value={code} readOnly={ok} aria-describedby="code-msg" aria-invalid={cs.kind === 'error' ? 'true' : undefined}
                  onChange={(e) => { setCode(norm(e.target.value)); setCs({ kind: 'help' }); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void check(); } }} />
                {cs.kind !== 'linked' && <button type="button" className="field-max" id="code-apply" disabled={!code || cs.kind === 'checking'} onClick={() => { if (cs.kind === 'ok') setCs({ kind: 'help' }); else void check(); }}>{cs.kind === 'ok' ? t('o.code.change') : t('o.code.apply')}</button>}
              </div>
              <div className={'onb-code-msg' + (cs.kind !== 'checking' && cs.kind !== 'help' ? ' is-' + (cs.kind === 'linked' ? 'ok' : cs.kind) : cs.kind === 'help' ? ' is-help' : '')} id="code-msg" aria-live="polite" dangerouslySetInnerHTML={{ __html: msg }}
                onClick={(e) => { if ((e.target as Element).closest('#code-without')) { closeCode(); go(n + 1); } }} />
            </div>
          </div>
          <div id="langrow" hidden={n !== 1 || from === 'profile'}>
            <Seg<Lang> label={t('lang.label')} value={lang} onChange={(l) => { setLang(l); void api.patchMe({ language: l }).catch(() => {}); }} items={LANGS.map((l) => ({ label: LANG_NAMES[l], value: l }))} lang />
          </div>
          <button type="button" className={'btn btn-primary btn-block' + (waiting && !ready ? ' is-loading' : '')} id="next" onClick={next}>
            {waiting && !ready ? <><span className="spin" /><span>{t('a.setup.h')}</span></> : <><span>{t(n === 3 ? (from === 'profile' ? 'common.done' : 'o.start') : 'o.next')}</span><Icon name="right" size={18} /></>}
          </button>
          <p className="row setup-line" id="setup-line" role="status" hidden={from === 'profile'} dangerouslySetInnerHTML={{ __html: ready ? icon('check', 16) + '<span>' + t('o.3.wait') + '</span>' : '<span class="spin"></span><span>' + t('a.setup.h') + '</span>' }} />
        </div>
      </div>
    </div>
  );
  return <Shell bare docTitle={t('o.1.h')} raw={raw} />;
}
