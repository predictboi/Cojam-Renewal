// A1 Log in, the cover of the paper (platform/design-variants/paper/login.html): email (allow listed providers, typo help), the six digit code, then
// "Setting up your game": create the wallet (Privy createWallet), register the account (POST /v1/session, wait for the
// operator's registerPlayer), and get this device ready (play key + setPlayKey signed by the Privy wallet, sponsored).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, useConfig } from '../api';
import { LANG_NAMES, currentLang, t, useLang } from '../i18n';
import { esc, sleep } from '../lib/fmt';
import { btn, help, icon, langSelect, plate, qbtn } from '../ui/h';
import { Dateline, Html, Shell } from '../ui/kit';
import { useOffline, usePreset } from '../state/app';
import { useWalletStore, walletApi } from '../wallet/wallet';
import { ensurePlayKey, setChainConfig } from '../chain/chain';
import { savedInvite } from './Gate';
import { DESIGN } from '../api/mock';
import { CONFIG } from '../config';

const CODE_ST = ['code', 'verifying', 'wrong', 'short', 'expired', 'tries'];
const SETUP_ST = ['setup', 'returning', 'busy', 'walletfail', 'devicefail', 'refused-used', 'refused-provider', 'refused-many', 'refused'];

function dist(a: string, b: string) {
  const d: number[][] = []; let i, j;
  for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 1; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export default function Login() {
  useLang();
  const st0 = usePreset();
  const [sp] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const cfg = useConfig();
  const off = useOffline();
  const authed = useWalletStore((s) => s.authenticated);
  const providers: string[] = cfg.data?.emailProviders || DESIGN.emailProviders;
  const providerNames = '<span translate="no">' + esc(cfg.data?.providerNames || DESIGN.providerNames) + '</span>';
  const initialEmail = ({ bademail: 'minji@naver', unsupported: 'minji@proton.me', typo: 'minji@gmial.com', empty: '', '': '', offline: '' } as Record<string, string>)[st0] ?? DESIGN.user.email;
  const [step, setStep] = useState<'email' | 'code' | 'setup'>(CODE_ST.includes(st0) ? 'code' : SETUP_ST.includes(st0) || sp.get('setup') === '1' ? 'setup' : 'email');
  const [S, setS] = useState(sp.get('setup') === '1' && !st0 ? 'returning' : st0);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(S === 'wrong' || S === 'tries' ? '418205' : S === 'short' ? '418' : S === 'verifying' ? '418250' : '');
  const [done, setDone] = useState(S === 'returning' ? 2 : S === 'busy' ? 1 : 0);
  const [busyNote, setBusyNote] = useState(S === 'busy');
  const [resendAt, setResendAt] = useState(CODE_ST.includes(st0) && st0 !== 'expired' ? Date.now() + 60_000 : 0);
  const [, tick] = useState(0);
  const running = useRef(false);

  function emailErr(v: string): { text?: string; typo?: string; fixed?: string; note?: boolean } | null {
    if (!v) return { text: t('a.email.empty') };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { text: t('a.email.bad') };
    const dom = v.split('@')[1].toLowerCase();
    if (!providers.includes(dom)) {
      let best: string | null = null, bd = 3;
      providers.forEach((p) => { let d = dist(dom, p); if (dom.split('.')[0] === p.split('.')[0]) d = Math.min(d, 1); if (d > 0 && d < bd) { bd = d; best = p; } });
      return best ? { typo: best, fixed: (v.split('@')[0] + '@' + best).toLowerCase() } : { note: true };
    }
    return null;
  }
  const resendLeft = () => (resendAt ? Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)) : 60);
  useEffect(() => { if (step !== 'code' || !resendAt) return; const i = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(i); }, [step, resendAt]);

  async function send(addr: string) {
    setEmail(addr); setS('sending');
    try {
      const chk = await api.emailCheck(addr).catch(() => ({ allowed: true }) as { allowed: boolean; reason?: string });
      if (!chk.allowed) { setS(chk.reason === 'toomany' ? 'toomany' : 'unsupported'); return; }
      await walletApi().sendCode(addr);
      setStep('code'); setS('code'); setCode(''); setResendAt(Date.now() + 60_000);
    } catch (e) {
      setS(/too many|rate/i.test(String((e as Error).message)) ? 'toomany' : 'sendfail');
    }
  }
  async function verify(c: string) {
    setS('verifying');
    try { await walletApi().loginWithCode(c); setStep('setup'); setS('setup'); setDone(0); }
    catch (e) {
      const m = String((e as Error).message || '') + ' ' + String((e as { code?: string }).code || '');
      setS(/expired/i.test(m) ? 'expired' : /too many|attempt|locked/i.test(m) ? 'tries' : 'wrong');
    }
  }

  /* the setup steps: wallet, registration, device */
  async function runSetup() {
    if (running.current) return; running.current = true;
    const fromPreset = !!st0;
    try {
      // 1. wallet
      setDone(0); setS((x) => (x === 'returning' ? x : 'setup'));
      let address = useWalletStore.getState().address;
      if (!address) { address = await walletApi().createWallet(); for (let i = 0; i < 20 && !useWalletStore.getState().address; i++) await sleep(150); }
      await sleep(fromPreset || CONFIG.mockApi ? 900 : 0);
      setDone(1);
      // 2. registration: queued by the server, sent by the operator within about 10 s
      let s = await api.createSession(savedInvite() || undefined);
      const t0 = Date.now();
      while (s.registration === 'pending') { if (Date.now() - t0 > 4000) setBusyNote(true); await sleep(1500); s = await api.session(); }
      if (s.registration === 'refused') { setS(s.reason === 'used' ? 'refused-used' : s.reason === 'provider' ? 'refused-provider' : s.reason === 'many' ? 'refused-many' : 'refused'); return; }
      setBusyNote(false);
      await sleep(fromPreset || CONFIG.mockApi ? 900 : 0);
      setDone(2);
      // 3. this device: create the play key and authorise it with one Privy signature (sponsored setPlayKey)
      const c = cfg.data || (await api.config());
      setChainConfig(c);
      try { await ensurePlayKey(address!); } catch (e) { console.warn('setPlayKey failed', e); setS('devicefail'); return; }
      await sleep(fromPreset || CONFIG.mockApi ? 700 : 0);
      setDone(3);
      await qc.invalidateQueries();
      const me = await api.me().catch(() => null);
      const firstTime = s.isNew || (me && !me.onboarded);
      setTimeout(() => nav(S === 'returning' || !firstTime ? ((loc.state as { from?: string } | null)?.from || '/') : '/welcome', { replace: true }), 500);
    } catch (e) {
      console.warn('setup failed', e);
      setS(done === 0 ? 'walletfail' : 'devicefail');
    } finally { running.current = false; }
  }
  useEffect(() => { if (step === 'setup' && (S === 'setup' || S === 'returning') && (authed || CONFIG.mockWallet)) void runSetup(); }, [step, S, authed]);

  // the three facts fill the quiet lower part; they step aside when the form needs the room
  const factsRef = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const f = factsRef.current; if (!f) return;
    f.hidden = false;
  });
  const headline = step === 'email' ? t('a.h1') : step === 'code' ? t('a.code.h1') : t('a.setup.h1');

  let panel: React.ReactNode;
  if (step === 'email') {
    const sending = S === 'sending';
    const err = ['empty', 'bademail', 'unsupported', 'typo'].includes(S) ? emailErr(email) : null;
    const msg = err?.text ? err.text : S === 'toomany' ? t('a.email.toomany') : S === 'sendfail' ? t('a.email.sendfail') : off ? t('a.offline') : '';
    const bad = (!!err && !err.typo) || S === 'toomany' || S === 'sendfail' || (S === 'unsupported' && !err);
    const noteProv = (err && err.note) || (S === 'unsupported' && !err);
    panel = (
      <>
        <form className="stack" id="f-email" noValidate onSubmit={(e) => {
          e.preventDefault(); const v = email.trim(); const er = emailErr(v);
          if (er) { setEmail(v); setS(er.typo ? 'typo' : er.note ? 'unsupported' : v ? 'bademail' : 'empty'); return; }
          void send(v);
        }}>
          <div className="field">
            <div className="field-label"><label htmlFor="email"><b>{t('a.email.label')}</b></label><span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: qbtn('email', t('pp.i.email')) }} /></div>
            <div className={'field-box field-box--text' + (bad ? ' is-error' : '') + (off ? ' is-off' : '')}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon('mail', 20).replace(/^<svg[^>]*>|<\/svg>$/g, '') }} />
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} enterKeyHint="send" placeholder="you@gmail.com" value={email} autoFocus
                aria-describedby="email-msg" aria-invalid={bad ? 'true' : undefined} disabled={off || sending} onChange={(e) => { setEmail(e.target.value); if (S) setS(''); }} />
            </div>
            <div id="email-fb" aria-live="polite" onClick={(e) => { const fx = (e.target as Element).closest('[data-fix-email]'); if (fx) { e.preventDefault(); void send(fx.getAttribute('data-fix-email')!); } }}>
              {msg && <div className={'field-msg' + (bad ? ' is-error' : '')} id="email-msg"><span>{msg}</span></div>}
              {err?.typo && <Html className="typo" id="typo" html={'<span>' + t('a.email.typo', { domain: '<b translate="no">' + err.typo + '</b>' }) + '</span>' + btn(t('a.email.typo.fix', { email: '<span translate="no">' + esc(err.fixed!) + '</span>' }), { sm: true, wrap: true, attrs: 'data-fix-email="' + esc(err.fixed!) + '"' })} />}
              {noteProv && <Html className="note note-warn" role="alert" id="prov-note" html={icon('warn', 18) + '<div class="note-body"><b>' + t('a.email.unsupported') + '</b><span>' + t('a.email.supported', { list: providerNames }) + '</span></div>'} />}
            </div>
          </div>
          <button type="submit" id="send" className={'btn btn-primary btn-block' + (sending ? ' is-loading' : '')} disabled={off || !!noteProv}>{sending && <span className="spin" />}<span>{t(sending ? 'a.email.sending' : 'a.email.btn')}</span></button>
        </form>
        <Html as="div" style={{ display: 'contents' }} html={help(t('a.help.q'), '<p>' + t('a.help.a') + '</p>') + '<p class="fine">' + t('a.fine', { terms: '<a href="#terms">' + t('a.terms') + '</a>', privacy: '<a href="#privacy">' + t('a.privacy') + '</a>' }) + '</p>'} />
      </>
    );
  } else if (step === 'code') {
    const err = S === 'wrong' ? t('a.code.wrong') : S === 'short' ? t('a.code.short') : S === 'expired' ? t('a.code.expired') : S === 'tries' ? t('a.code.tries') : '';
    const busy = S === 'verifying', locked = S === 'tries', hard = !!err && S !== 'short';
    const left = resendLeft();
    panel = (
      <>
        <form className="stack" id="f-code" noValidate onSubmit={(e) => { e.preventDefault(); if (code.length < 6) { setS('short'); return; } void verify(code); }}>
          <div className="stack-8"><h2>{t('a.code.h')}</h2><p className="muted small" dangerouslySetInnerHTML={{ __html: t('a.code.body', { email: '<b translate="no">' + esc(email) + '</b>' }) }} /></div>
          <div className="field">
            <div className={'field-box field-box--code' + (hard ? ' is-error' : '') + (locked ? ' is-off' : '')}>
              <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" placeholder="______" value={code} autoFocus
                aria-label={t('a.code.label')} aria-describedby="code-msg" aria-invalid={hard ? 'true' : undefined} disabled={busy || locked}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (S === 'short' || S === 'wrong') setS('code'); if (v.length === 6) void verify(v); }} />
            </div>
            <div className={'field-msg' + (hard ? ' is-error' : '')} id="code-msg" aria-live="polite">{err && <span>{err}</span>}</div>
          </div>
          <button type="submit" className={'btn btn-primary btn-block' + (busy ? ' is-loading' : '')} disabled={S === 'expired' || locked}>{busy && <span className="spin" />}<span>{t(busy ? 'a.code.verifying' : 'a.code.btn')}</span></button>
        </form>
        <div className="stack-8">
          <p className="small muted" id="resend-in" hidden={S === 'expired' || left <= 0} dangerouslySetInnerHTML={{ __html: t('a.code.resendin', { s: '<b id="resend-s">' + left + '</b>' }) }} />
          <div className="row-between">
            <button type="button" className="linkish" id="resend" disabled={!(S === 'expired' || left <= 0)} onClick={() => void send(email)}>{t('a.code.resend')}</button>
            <button type="button" className="linkish" id="change" onClick={() => { setStep('email'); setS(''); }}>{t('a.code.change')}</button>
          </div>
        </div>
      </>
    );
  } else {
    const out = <button type="button" className="btn btn-block" id="change" onClick={async () => { try { await walletApi().logout(); } catch { /* */ } setStep('email'); setS(''); }}><span>{t('p.logout')}</span></button>;
    const retry = <button type="button" className="btn btn-primary btn-block" id="retry" onClick={() => { setS('setup'); }}><span>{t('common.retry')}</span></button>;
    const refused = (key: string, btns: React.ReactNode) => <><div className="setup"><div className="sheet-ic is-bad" dangerouslySetInnerHTML={{ __html: icon('warn', 28) }} /><h2>{t('a.refused.h')}</h2><p className="muted" role="alert" dangerouslySetInnerHTML={{ __html: t(key, { list: providerNames }) }} /></div>{btns}</>;
    if (S === 'refused-used') panel = refused('a.refused.used', out);
    else if (S === 'refused-provider') panel = refused('a.refused.provider', out);
    else if (S === 'refused-many') panel = refused('a.refused.many', <>{retry}{out}</>);
    else if (S === 'refused') panel = refused('a.setup.refused', out);
    else if (S === 'walletfail' || S === 'devicefail') panel = <><div className="setup"><div className="sheet-ic is-bad" dangerouslySetInnerHTML={{ __html: icon('x', 28) }} /><h2 role="alert">{t(S === 'walletfail' ? 'a.setup.fail' : 'a.setup.devicefail')}</h2></div>{retry}</>;
    else {
      const back = S === 'returning';
      panel = (
        <>
          <div className="stack-8" role="status"><h2>{t('a.setup.h')}</h2><p className="muted small">{t(back ? 'a.setup.body2' : 'a.setup.body')}</p></div>
          <ol className="txsteps" id="setup-steps" data-done={done}>
            {['a.setup.s1', 'a.setup.s2', 'a.setup.s3'].map((k, i) => {
              const s = i < done ? 'done' : i === done ? 'now' : 'wait';
              return (
                <li key={k} className={'is-' + s}>
                  <span className="n" dangerouslySetInnerHTML={{ __html: s === 'done' ? icon('check', 16) : String(i + 1) }} />
                  <span>{t(k)}{busyNote && i === 1 && <><br /><span className="tiny muted">{t('a.setup.busy')}</span></>}</span>
                  <span className="st">{s === 'now' && <span className="spin" />}</span>
                </li>
              );
            })}
          </ol>
        </>
      );
    }
  }
  return (
    <Shell bare docTitle={headline} raw={
      <div className="auth">
        <Html as="header" className="gate-bar" html={plate(true) + langSelect(currentLang(), LANG_NAMES)} />
        <div className="oxford" aria-hidden="true" />
        <Dateline cls="dateline--cover" live={'<span>' + t('d.next.at') + '</span>'} />
        <div className="auth-main">
          <div className="stack-12"><h1 id="h1">{headline}</h1><p className="auth-lede" id="lede" hidden={step !== 'email'}>{t('pp.lede')}</p></div>
          <section className="panel" id="panel">{panel}</section>
          {/* three plain lines between hairlines: no icon row */}
          <Html as="ul" className="facts" id="facts" ref={factsRef} html={'<li>' + t('a.fact.1') + '</li><li>' + t('a.fact.2') + '</li><li>' + t('a.fact.3') + '</li>'} />
        </div>
      </div>
    } />
  );
}
