// The admin shell, a port of Admin.mount in admin.js: header band (status dot, network badge, who is signed in),
// side navigation with counts, page head with the update stamp and Refresh, the viewer note, the page body
// (HTML from the ported builders), the design review states line (mock only), the phone message, toasts and live region.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CONFIG } from './config';
import { X, href, ic, note, T, resetTables } from './lib/x';
import { tick } from './lib/ui';
import { useAppState, useMe, useNet, useOverview, usePendingParams, mockD } from './api/hooks';
import { useAuth } from './auth';

const NAV: [string, string, string, string][] = [['index', '/', 'Dashboard', 'dash'], ['rewards', '/rewards', 'Reward settings', 'sliders'], ['questions', '/questions', 'Questions', 'cards'], ['answers', '/answers', 'Answers', 'check'], ['ranking', '/ranking', 'Ranking and airdrop', 'podium'], ['system', '/system', 'System', 'pulse'], ['players', '/players', 'Players', 'people']];
const Ic = ({ name, size = 16 }: { name: string; size?: number }) => <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: ic(name, size) }} />;

type Count = [string, string, string] | null;
function mockStatus(page: string): [string, string] {
  // a failing job is a fact of the system, not of one page: once System is opened in its failing state the dot stays red until System is opened healthy again
  let mem: string | null = null;
  try { if (page === 'system') sessionStorage.setItem('cj-admin-sys', X.state === 'failing' ? 'failing' : ''); mem = sessionStorage.getItem('cj-admin-sys'); } catch { /* storage off */ }
  if (mem === 'failing') return ['down', '1 job failing'];
  if (page === 'system' && X.state === 'failing') return ['down', '1 job failing'];
  if (page === 'system' && X.state === 'maintenance') return ['warn', 'Maintenance mode is on'];
  if (page === 'index' && X.state === 'calm') return ['ok', 'All systems normal'];
  return ['warn', '2 warnings'];
}

export function useLiveStatus(): { st: [string, string]; counts: Record<string, Count> } {
  const ov = useOverview(!CONFIG.mock);
  const app = useAppState(!CONFIG.mock);
  const pp = usePendingParams(!CONFIG.mock);
  const alerts: { level: string; code: string; message: string }[] = ov.data?.alerts || [];
  const crit = alerts.filter((a) => a.level === 'critical').length, warn = alerts.length - crit;
  let st: [string, string] = ov.isError ? ['warn', 'Status unknown'] : crit ? ['down', crit + (crit === 1 ? ' alert' : ' alerts') + ' need action'] : warn ? ['warn', warn + (warn === 1 ? ' warning' : ' warnings')] : ['ok', 'All systems normal'];
  if (app.data?.maintenance?.on && st[0] !== 'down') st = ['warn', 'Maintenance mode is on'];
  const dayN = alerts.filter((a) => a.code === 'DAY_INCOMPLETE').length;
  const ansN = (ov.data?.answersNeedingAttention || []).length;
  const sysN = alerts.filter((a) => /FEE_PAYER|RESERVE|INDEXER|REGISTRATION|loop-failing|operator-balance|fee-payer/.test(a.code)).length;
  const rev = ov.data?.reviewListCount || 0;
  return {
    st,
    counts: {
      questions: dayN ? [String(dayN), 'warn', dayN + (dayN === 1 ? ' day needs' : ' days need') + ' attention'] : null,
      answers: ansN ? [String(ansN), 'warn', ansN + ' late or low confidence'] : null,
      players: rev ? [String(rev), '', rev + ' waiting for review'] : null,
      system: sysN ? [String(sysN), 'down', sysN + ' system alerts'] : null,
      rewards: pp.data?.pending ? ['1', '', '1 pending change'] : null,
    },
  };
}

export interface ShellProps { page: string; title: string; sub?: string; states?: string[]; html: string; loading?: boolean; error?: boolean; updatedAt?: number; onRefresh?: () => void; after?: (view: HTMLElement) => void; extra?: React.ReactNode }

export function Shell(p: ShellProps) {
  const loc = useLocation();
  const me = useMe();
  const net = useNet();
  const live = useLiveStatus();
  const auth = useAuth();
  const view = useRef<HTMLDivElement>(null);
  X.page = p.page;
  if (me.data) X.role = me.data.role;
  const k = CONFIG.mock ? new URLSearchParams(loc.search).get('env') === 'kairos' : net.data?.network === 'kairos';
  X.env = k ? 'kairos' : 'kaia';
  X.explorer = k ? 'https://kairos.kaiascan.io' : 'https://kaiascan.io';

  useEffect(() => { document.title = p.title + ' · Cojam admin'; }, [p.title]);
  useEffect(() => { tick(); return () => resetTables(); }, []);
  useLayoutEffect(() => { if (view.current && p.after) p.after(view.current); });

  const st = CONFIG.mock ? mockStatus(p.page) : live.st;
  const calm = st[0] === 'ok';
  const D = CONFIG.mock ? mockD() : null;
  const counts: Record<string, Count> = CONFIG.mock
    ? { questions: calm ? null : ['2', 'warn', '2 days need attention'], answers: calm ? null : ['2', 'warn', '1 late, 1 flagged'], players: calm ? null : [String(D.abuse.review), '', D.abuse.review + ' waiting for review'], system: calm ? null : st[0] === 'down' ? ['2', 'down', '1 job failing, fee payer below its floor'] : ['1', 'down', 'Fee payer below its floor'], rewards: ['1', '', '1 pending change'] }
    : live.counts;
  const role = X.role.charAt(0).toUpperCase() + X.role.slice(1);
  const mail = me.data?.email || '';
  const nowU = Date.now() / 1000;
  const dayLine = CONFIG.mock ? <>{D.now.day}<br />Day 4 of week {D.now.week}</> : <>{T.long(nowU)}<br />Day {((Math.floor((nowU + 9 * 3600) / 86400) + 3) % 7) + 1} of the week</>;
  const stamp = p.loading ? 'Loading' : p.error ? (p.updatedAt ? 'Last updated ' + T.hms(p.updatedAt / 1000) + ' KST' : 'Not updated') : CONFIG.mock ? 'Updated ' + D.now.time + ' KST' : 'Updated ' + T.hms((p.updatedAt || Date.now()) / 1000) + ' KST';
  const mockLoading = CONFIG.mock && X.state === 'loading', mockErr = CONFIG.mock && X.state === 'error';

  return (
    <>
      <a className="sr" href="#page" data-native="">Skip to content</a>
      <header className="top">
        <Link className="top-logo" to={href('/')}><span className="chip-logo"><img src="/assets/cojam-mark.svg" alt="" />Cojam</span><span className="top-name">Admin</span></Link>
        <div className="top-end">
          <Link className="top-status" to={href('/system')}><span className="dot" data-s={st[0]}></span>{st[1]}</Link>
          <span className="env" data-env={X.env} title={k ? 'Kairos test network, chain id 1001' : 'Kaia mainnet, chain id 8217'}>{k ? 'Kairos test' : 'Mainnet'}</span>
          <span className="top-who"><b>{mail}</b><span>{role} role</span></span>
          <a className="top-out" href="/signin" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void auth.signOut(); }}>Sign out</a>
        </div>
      </header>
      <nav className="side" aria-label="Admin screens">
        <ul className="nav">
          {NAV.map((x) => {
            const c = counts[x[0]];
            return (
              <li key={x[0]}><Link to={href(x[1])} aria-current={x[0] === p.page ? 'page' : undefined}><Ic name={x[3]} size={18} /><span>{x[2]}</span>
                {c && <span className="cnt" data-k={c[1] || undefined} title={c[2]}>{c[0]}<span className="sr"> {c[2]}</span></span>}</Link></li>
            );
          })}
        </ul>
        <div className="side-foot"><span>{dayLine}</span><span>Session ends after 30 minutes without activity.</span>{(CONFIG.mock || CONFIG.devAdmin) && <Link to={href('/hub')}>All screens and states</Link>}<a href={'mailto:' + CONFIG.supportEmail}>{CONFIG.supportEmail}</a></div>
      </nav>
      <main className="main" id="page" tabIndex={-1}>
        <div className="wrap">
          <div className="ph"><h1>{p.title}</h1>{p.sub && <p className="ph-sub" dangerouslySetInnerHTML={{ __html: p.sub }} />}
            <div className="ph-end"><span className="stamp" data-s={p.error || mockErr ? 'stale' : undefined}><i></i>{mockLoading ? 'Loading' : mockErr ? 'Last updated 14:21:40 KST' : stamp}</span>
              <button type="button" className="btn btn-s" onClick={() => p.onRefresh?.()} data-reload={CONFIG.mock ? '' : undefined}><Ic name="refresh" size={14} />Refresh</button></div>
          </div>
          {X.role === 'viewer' && <><div dangerouslySetInnerHTML={{ __html: note('', '<b>Read only.</b> You are signed in with the Viewer role. Actions that change something are switched off.') }} /><div style={{ height: 16 }}></div></>}
          <div id="view" ref={view} dangerouslySetInnerHTML={{ __html: p.html }} />
          {p.extra}
          {CONFIG.mock && p.states && (
            <p className="states"><span>Design review, states of this screen:</span>
              {[['', 'default'], ...p.states.map((s) => [s, s])].map((s) => <Link key={s[0]} to={href(loc.pathname, s[0])} aria-current={s[0] === X.state ? 'true' : undefined}>{s[1]}</Link>)}
            </p>
          )}
        </div>
      </main>
      <div className="phone"><h1>Open the admin on a computer</h1><p>The Cojam admin is built for a wide screen. Open admin.cojam.app on a laptop or desktop, at least 1024 pixels wide.</p><p>Is something urgent? Write to <a href={'mailto:' + CONFIG.supportEmail}>{CONFIG.supportEmail}</a>.</p></div>
      <div className="toasts" role="status" aria-live="polite"></div><div className="sr" id="live" aria-live="polite"></div>
    </>
  );
}
