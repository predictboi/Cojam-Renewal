// Routes, the install Gate (DEV-PLAN 9.4), sign in and setup guards, and the full screen system states.
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CONFIG } from './config';
import { useConfig, useMe } from './api';
import { setTokenSource } from './api/client';
import { setChainConfig } from './chain/chain';
import { startPlay } from './state/play';
import { useNet } from './state/app';
import { useWalletStore, walletApi } from './wallet/wallet';
import { setBehaviourHooks } from './ui/behaviours';
import { LiveRegion, SheetRoot, Toasts } from './ui/kit';
import { sheet } from './state/ui';
import { aiSheetHtml } from './ui/h';
import { qOf } from './ui/qcard';
import { t, useLang } from './i18n';
import { useTxNav } from './ui/tx';
import { loadPlayKey, playKeyValid } from './chain/playKey';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from './state/ui';
import type { Today } from './api/types';

import Gate from './screens/Gate';
import Login from './screens/Login';
import FirstRun from './screens/FirstRun';
import HomeCards from './screens/HomeCards';
import HomeList from './screens/HomeList';
import Done from './screens/Done';
import Results from './screens/Results';
import Ranking from './screens/Ranking';
import Staking from './screens/Staking';
import Stakes from './screens/Stakes';
import Wallet from './screens/Wallet';
import Convert from './screens/Convert';
import Deposit from './screens/Deposit';
import Withdraw from './screens/Withdraw';
import Profile from './screens/Profile';
import Invite from './screens/Invite';
import System from './screens/System';

const SA_KEY = 'cjp.standalone';
export function isStandalone(): boolean {
  const sa = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (sa) return true;
  if (!CONFIG.dev) return false;
  const q = new URLSearchParams(location.search).get('standalone');
  try {
    if (q === '1') sessionStorage.setItem(SA_KEY, '1');
    if (q === '0') sessionStorage.removeItem(SA_KEY);
    return sessionStorage.getItem(SA_KEY) === '1';
  } catch { return q === '1'; }
}
const cmpVer = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

/** wires the delegated behaviours to the router and the query cache */
function Wiring() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();
  useTxNav();
  useLang(); // re-render on language change
  useEffect(() => {
    setBehaviourHooks({
      nav: (to) => nav(to),
      reload: () => { const u = new URL(location.href); u.searchParams.delete('state'); nav(u.pathname + u.search, { replace: true }); void qc.invalidateQueries(); },
      offline: () => !useNet.getState().online || /[?&]state=offline/.test(location.search),
      ai: (id) => {
        const today = qc.getQueriesData<Today>({ queryKey: ['today'] }).map(([, d]) => d).find(Boolean);
        const m = today?.markets.find((x) => x.marketId === id);
        if (!m) return;
        const q = qOf(m);
        sheet.open(aiSheetHtml(q.rule, t('h.ai.after', { time: q.settle })));
      },
    });
  }, [nav, qc]);
  useEffect(() => { window.scrollTo(0, 0); sheet.close(true); }, [loc.pathname]);
  // a new version: "Update ready" (vite-plugin-pwa prompt mode)
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({ immediate: true });
  useEffect(() => { if (need) toast(t('toast.update'), { btn: t('toast.reload'), fn: () => void updateServiceWorker(true), key: 'update', ms: 60_000 }); }, [need]);
  return null;
}

/** signed in, set up on this device, and the outbox running */
function Guard({ children }: { children: ReactNode }) {
  const w = useWalletStore();
  const cfg = useConfig();
  const loc = useLocation();
  const [keyOk, setKeyOk] = useState<boolean | null>(CONFIG.mockApi ? true : null);
  const me = useMe(w.authenticated);
  useEffect(() => { setTokenSource(() => walletApi().getAccessToken()); }, []);
  useEffect(() => {
    if (CONFIG.mockApi || !w.authenticated || !w.address) return;
    void loadPlayKey().then((k) => setKeyOk(!!k && playKeyValid(k) && k.player === w.address!.toLowerCase()));
  }, [w.authenticated, w.address]);
  useEffect(() => { if (cfg.data && w.authenticated && keyOk) { setChainConfig(cfg.data); startPlay(cfg.data); } }, [cfg.data, w.authenticated, keyOk]);
  if (!w.ready) return null;
  if (!w.authenticated) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (keyOk === null) return null;
  if (!keyOk || me.data?.registration === 'pending') return <Navigate to="/login?setup=1" replace />;
  return <>{children}</>;
}

export function App() {
  const cfg = useConfig();
  const online = useNet((s) => s.online);
  const loc = useLocation();
  useEffect(() => { if (cfg.data) setChainConfig(cfg.data); }, [cfg.data]);
  const sa = isStandalone();
  const gateRoute = /^\/(gate|i\/)/.test(loc.pathname);

  let content: ReactNode;
  if (cfg.data?.flags.maintenance) content = <System kind="maintenance" />;
  else if (cfg.data && cmpVer(CONFIG.appVersion, cfg.data.minAppVersion) < 0 && !/^\/system/.test(loc.pathname)) content = <System kind="update" />;
  else if (!online && cfg.isError && !cfg.data) content = <System kind="offline" />;
  else if (!sa || gateRoute) content = (
    <Routes>
      <Route path="/system/:kind" element={<System />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
  else content = (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<FirstRun />} />
      <Route path="/system/:kind" element={<System />} />
      <Route path="/" element={<Guard><HomeCards /></Guard>} />
      <Route path="/list" element={<Guard><HomeList /></Guard>} />
      <Route path="/done" element={<Guard><Done /></Guard>} />
      <Route path="/results" element={<Guard><Results /></Guard>} />
      <Route path="/ranking" element={<Guard><Ranking /></Guard>} />
      <Route path="/staking" element={<Guard><Staking /></Guard>} />
      <Route path="/stakes" element={<Guard><Stakes /></Guard>} />
      <Route path="/wallet" element={<Guard><Wallet /></Guard>} />
      <Route path="/convert" element={<Guard><Convert /></Guard>} />
      <Route path="/deposit" element={<Guard><Deposit /></Guard>} />
      <Route path="/withdraw" element={<Guard><Withdraw /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="/invite" element={<Guard><Invite /></Guard>} />
      <Route path="*" element={<System kind="notfound" />} />
    </Routes>
  );
  return (
    <>
      <Wiring />
      {content}
      <Toasts />
      <LiveRegion />
      <SheetRoot />
    </>
  );
}
