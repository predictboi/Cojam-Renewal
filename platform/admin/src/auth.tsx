// Admin sign in. Live: the SEPARATE admin Privy app (VITE_PRIVY_ADMIN_APP_ID), email code login with our own form
// (useLoginWithEmail), then GET /admin/v1/me decides: an email that is not on admin_users gets FORBIDDEN and is
// signed out again. Local dev: VITE_DEV_ADMIN sends X-Dev-Admin instead (removed from production builds).
// Mock: always signed in. The session ends after 30 minutes without activity.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CONFIG } from './config';
import { api, ApiError, setOnUnauthorized, setTokenSource } from './api/client';
import { queryClient } from './api/hooks';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export interface AuthApi {
  status: AuthStatus;
  /** set after a sign in attempt that the allow list refused */
  refused: string | null;
  sendCode: (email: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  signOut: (why?: 'idle') => Promise<void>;
  idle: boolean;
}
const Ctx = createContext<AuthApi>({ status: 'loading', refused: null, sendCode: async () => {}, loginWithCode: async () => {}, signOut: async () => {}, idle: false });
export const useAuth = () => useContext(Ctx);

const IDLE_MS = CONFIG.idleMinutes * 60_000;
function useIdle(active: boolean, onIdle: () => void) {
  const last = useRef(Date.now());
  useEffect(() => {
    if (!active) return;
    const bump = () => { last.current = Date.now(); };
    const ev = ['mousedown', 'keydown', 'wheel', 'touchstart', 'mousemove'];
    ev.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last.current > IDLE_MS) onIdle(); }, 15_000);
    return () => { ev.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [active, onIdle]);
}

/** Mock and local dev: no Privy. Dev keeps a "signed out" flag in the session so the sign in screen can be walked. */
export function SimpleAuth({ children }: { children: ReactNode }) {
  const key = 'cj-admin-dev-out';
  const [out, setOut] = useState(() => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } });
  const [idle, setIdle] = useState(false);
  const signOut = useCallback(async (why?: 'idle') => { try { sessionStorage.setItem(key, '1'); } catch { /* */ } setIdle(why === 'idle'); setOut(true); queryClient.clear(); }, []);
  useIdle(!CONFIG.mock && !out, useCallback(() => void signOut('idle'), [signOut]));
  const value = useMemo<AuthApi>(() => ({
    status: CONFIG.mock ? 'signedIn' : out ? 'signedOut' : 'signedIn',
    refused: null,
    idle,
    sendCode: async () => { await new Promise((r) => setTimeout(r, 300)); },
    loginWithCode: async () => {
      // dev: the header identity must be on the allow list, exactly like a Privy login
      await api('/admin/v1/me');
      try { sessionStorage.removeItem(key); } catch { /* */ }
      setIdle(false); setOut(false);
    },
    signOut,
  }), [out, idle, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Live: Privy, loaded only when used (mock and dev builds never download it). */
export function PrivyAuth({ children, privy }: { children: ReactNode; privy: typeof import('@privy-io/react-auth') }) {
  const { PrivyProvider } = privy;
  return (
    <PrivyProvider appId={CONFIG.privyAppId} config={{ loginMethods: ['email'], embeddedWallets: { ethereum: { createOnLogin: 'off' } }, appearance: { theme: 'light' } } as never}>
      <PrivyInner privy={privy}>{children}</PrivyInner>
    </PrivyProvider>
  );
}
function PrivyInner({ children, privy }: { children: ReactNode; privy: typeof import('@privy-io/react-auth') }) {
  const { ready, authenticated, logout, getAccessToken } = privy.usePrivy();
  const email = privy.useLoginWithEmail();
  const [refused, setRefused] = useState<string | null>(null);
  const [checked, setChecked] = useState<'no' | 'ok'>('no');
  const [idle, setIdle] = useState(false);
  useEffect(() => { setTokenSource(authenticated ? () => getAccessToken() : null); }, [authenticated, getAccessToken]);
  const signOut = useCallback(async (why?: 'idle') => { setIdle(why === 'idle'); setChecked('no'); queryClient.clear(); await logout(); }, [logout]);
  useEffect(() => { setOnUnauthorized(() => void signOut()); }, [signOut]);
  // after a login: the allow list decides
  useEffect(() => {
    if (!ready || !authenticated || checked === 'ok') return;
    let gone = false;
    api('/admin/v1/me').then(() => { if (!gone) { setRefused(null); setChecked('ok'); } }).catch(async (e) => {
      if (gone) return;
      if (e instanceof ApiError && e.code === 'FORBIDDEN') { setRefused('notallowed'); await logout(); } else { setRefused('failed'); await logout(); }
    });
    return () => { gone = true; };
  }, [ready, authenticated, checked, logout]);
  useIdle(authenticated && checked === 'ok', useCallback(() => void signOut('idle'), [signOut]));
  const status: AuthStatus = !ready ? 'loading' : authenticated ? (checked === 'ok' ? 'signedIn' : 'loading') : 'signedOut';
  const value = useMemo<AuthApi>(() => ({
    status, refused, idle,
    sendCode: async (e: string) => { setRefused(null); setIdle(false); await email.sendCode({ email: e }); },
    loginWithCode: async (c: string) => { await email.loginWithCode({ code: c }); },
    signOut,
  }), [status, refused, idle, email, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
