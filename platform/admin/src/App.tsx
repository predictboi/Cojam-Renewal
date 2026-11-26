// Routes and the sign in guard.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CONFIG } from './config';
import { useAuth } from './auth';
import { useRouterHooks } from './page';
import SignIn from './screens/SignIn';
import Hub from './screens/Hub';
import Dashboard from './screens/Dashboard';

const Rewards = lazy(() => import('./screens/Rewards'));
const Questions = lazy(() => import('./screens/Questions'));
const Answers = lazy(() => import('./screens/Answers'));
const Ranking = lazy(() => import('./screens/Ranking'));
const System = lazy(() => import('./screens/System'));
const Players = lazy(() => import('./screens/Players'));

function Guard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const loc = useLocation();
  if (auth.status === 'loading') return <div className="auth"><main className="auth-main"><div className="panel"><p><span className="spin"></span> Checking your session</p></div></main></div>;
  if (auth.status !== 'signedIn') return <Navigate to={'/signin' + (auth.idle ? '?state=idle' : '')} replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export function App() {
  useRouterHooks();
  const g = (el: React.ReactNode) => <Guard><Suspense fallback={null}>{el}</Suspense></Guard>;
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      {(CONFIG.mock || CONFIG.devAdmin) && <Route path="/hub" element={<Hub />} />}
      <Route path="/" element={g(<Dashboard />)} />
      <Route path="/rewards" element={g(<Rewards />)} />
      <Route path="/questions" element={g(<Questions />)} />
      <Route path="/answers" element={g(<Answers />)} />
      <Route path="/ranking" element={g(<Ranking />)} />
      <Route path="/system" element={g(<System />)} />
      <Route path="/players" element={g(<Players />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
