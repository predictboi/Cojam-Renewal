// AD0 Sign in, ported from platform/design/admin/signin.html. States (mock): sending | code | wrongcode | expired |
// notallowed | failed | idle. Live: the same states driven by the admin Privy email login and the allow list.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONFIG } from '../config';
import { useAuth } from '../auth';

const Warn = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19L12 3.5zM12 10v4.5M12 17.5v.5" /></svg>;
const Err = ({ id, children }: { id: string; children: React.ReactNode }) => <p className="err" id={id} role="alert"><Warn />{children}</p>;

type Step = '' | 'sending' | 'code' | 'wrongcode' | 'expired' | 'notallowed' | 'failed' | 'idle' | 'verifying';

export default function SignIn() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const preset = (new URLSearchParams(loc.search).get('state') || '') as Step;
  const [st, setSt] = useState<Step>(CONFIG.mock ? preset : auth.idle ? 'idle' : '');
  const [mail, setMail] = useState(CONFIG.mock ? (preset === 'notallowed' ? 'minji@naver.com' : preset ? 'ops@cojam.app' : '') : CONFIG.devAdmin || '');
  const [code, setCode] = useState(CONFIG.mock ? (preset === 'wrongcode' ? '418207' : preset === 'expired' ? '550913' : '') : '');
  const [left, setLeft] = useState(42);
  const timer = useRef(0);
  useEffect(() => { document.title = 'Sign in · Cojam admin'; }, []);
  useEffect(() => { if (CONFIG.mock) { setSt(preset); } }, [preset]);
  useEffect(() => { if (!CONFIG.mock && auth.refused) setSt(auth.refused as Step); }, [auth.refused]);
  useEffect(() => { if (!CONFIG.mock && auth.status === 'signedIn') navigate('/', { replace: true }); }, [auth.status, navigate]);
  useEffect(() => {
    window.clearInterval(timer.current);
    if (st === 'code' || st === 'wrongcode') { timer.current = window.setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000); }
    return () => window.clearInterval(timer.current);
  }, [st]);

  const codeStep = st === 'code' || st === 'wrongcode' || st === 'expired' || st === 'verifying';
  const go = (s: Step) => { if (CONFIG.mock) navigate('?state=' + s); else setSt(s); };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (CONFIG.mock) { go('code'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { setSt('failed'); return; }
    setSt('sending');
    try { await auth.sendCode(mail.trim().toLowerCase()); setLeft(42); setCode(''); setSt('code'); } catch { setSt('failed'); }
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (CONFIG.mock) { navigate('/'); return; }
    setSt('verifying');
    try { await auth.loginWithCode(code.trim()); if (CONFIG.devAdmin) navigate('/', { replace: true }); }
    catch (er) {
      const m = String((er as Error)?.message || '');
      if ((er as { code?: string }).code === 'FORBIDDEN') setSt('notallowed');
      else setSt(/expire/i.test(m) ? 'expired' : 'wrongcode');
    }
  }
  async function resend() { if (CONFIG.mock) { go('code'); return; } setSt('sending'); try { await auth.sendCode(mail.trim().toLowerCase()); setLeft(42); setCode(''); setSt('code'); } catch { setSt('failed'); } }

  const foot = <p className="auth-foot">Only emails on the admin allow list can sign in. The list is kept by the Owner role in System. The session ends after 30 minutes without activity.</p>;
  return (
    <div className="auth">
      <header className="auth-top"><span className="chip-logo"><img src="/assets/cojam-mark.svg" alt="" />Cojam</span><span className="top-name">Admin</span></header>
      <main className="auth-main">
        <div className="panel" id="panel">
          {!codeStep ? (
            <>
              <h1>Cojam admin</h1>
              {st === 'idle' && <div className="note" data-k="sky"><div>You were signed out after 30 minutes without activity.</div></div>}
              {CONFIG.devAdmin && !CONFIG.mock && <div className="note" data-k="sky"><div>Local dev sign in as <b>{CONFIG.devAdmin}</b> (X-Dev-Admin). Any code works; the allow list still decides.</div></div>}
              <p>Sign in with an approved email.</p>
              <form className="stack" onSubmit={send} noValidate>
                <div className="fl"><label htmlFor="em">Email</label>
                  <input className="inp" id="em" type="email" autoComplete="email" placeholder="you@cojam.app" value={mail} onChange={(e) => setMail(e.target.value)}
                    aria-invalid={st === 'notallowed' || st === 'failed' ? 'true' : undefined} aria-describedby={st === 'notallowed' || st === 'failed' ? 'em-e' : undefined} readOnly={st === 'sending'} autoFocus={st !== 'sending'} />
                  {st === 'notallowed' ? <Err id="em-e">This email is not approved for the admin.</Err> : st === 'failed' ? <Err id="em-e">Sign in failed. Try again.</Err> : null}
                </div>
                {st === 'sending' ? <button type="button" className="btn btn-primary is-busy" disabled><span className="spin"></span>Sending the code</button> : <button type="submit" className="btn btn-primary">Send code</button>}
              </form>
              {st === 'notallowed' && <p className="hint">{CONFIG.mock ? 'No code was sent. ' : 'You were signed out again. '}If you should have access, ask an Owner to add this address, or write to <a href={'mailto:' + CONFIG.supportEmail}>{CONFIG.supportEmail}</a>.</p>}
              {foot}
            </>
          ) : (
            <>
              <h1>Enter the code</h1>
              <p>We sent a 6 digit code to <b>{mail || 'ops@cojam.app'}</b>. It is valid for 10 minutes.</p>
              <form className="stack" onSubmit={signIn} noValidate>
                <div className="fl"><label htmlFor="cd">Code</label>
                  <input className="inp code" id="cd" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    aria-invalid={st === 'wrongcode' || st === 'expired' ? 'true' : undefined} aria-describedby={st === 'wrongcode' || st === 'expired' ? 'cd-e' : undefined} autoFocus />
                  {st === 'wrongcode' ? <Err id="cd-e">That code is not right.</Err> : st === 'expired' ? <Err id="cd-e">This code has expired. Send a new code.</Err> : null}
                </div>
                {st === 'verifying' ? <button type="button" className="btn btn-primary is-busy" disabled><span className="spin"></span>Signing in</button> : <button type="submit" className="btn btn-primary">Sign in</button>}
              </form>
              <div className="acts" style={{ justifyContent: 'space-between' }}>
                <a className="link" href="?" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (CONFIG.mock) navigate('?'); else { setCode(''); setSt(''); } }}>Use another email</a>
                {st === 'expired' || left === 0 ? <a className="link" href="?state=code" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void resend(); }}>Send a new code</a> : <span className="hint">Send again in 0:{String(left).padStart(2, '0')}</span>}
              </div>
              {foot}
            </>
          )}
        </div>
        <div className="phone"><h1>Open the admin on a computer</h1><p>The Cojam admin is built for a wide screen. Open admin.cojam.app on a laptop or desktop, at least 1024 pixels wide.</p><p>Is something urgent? Write to <a href={'mailto:' + CONFIG.supportEmail}>{CONFIG.supportEmail}</a>.</p></div>
      </main>
    </div>
  );
}
