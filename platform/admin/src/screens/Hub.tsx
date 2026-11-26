// Review hub (port of platform/design/admin/hub.html): every screen and state, one click each. Mock and dev only.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CONFIG } from '../config';

const S: [string, string, string, string[]][] = [
  ['AD0', '/signin', 'Sign in', ['sending', 'code', 'wrongcode', 'expired', 'notallowed', 'failed', 'idle']],
  ['AD1', '/', 'Dashboard', ['calm', 'loading', 'error']],
  ['AD2', '/rewards', 'Reward settings', ['none', 'editing', 'invalid', 'review', 'connect', 'wrongwallet', 'signing', 'failed', 'proposed', 'ready', 'cancel', 'loading', 'error']],
  ['AD3', '/questions', 'Questions', ['scheduled', 'edit', 'short', 'noimage', 'regen', 'swap', 'cancel', 'void', 'emptyqueue', 'loading', 'error']],
  ['AD4', '/answers', 'Answers', ['correct', 'after', 'sign', 'compensate', 'compensated', 'void', 'late', 'rerun', 'waiting', 'corrected', 'empty', 'loading', 'error']],
  ['AD5', '/ranking', 'Ranking and airdrop', ['last', 'ready', 'waiting', 'sending', 'failed', 'lowreserve', 'capped', 'empty', 'loading', 'error']],
  ['AD6', '/system', 'System', ['failing', 'maintenance', 'maint', 'adddomain', 'domainerror', 'disabledomain', 'addadmin', 'loading', 'error']],
  ['AD7', '/players', 'Players', ['detail', 'block', 'blockerror', 'clear', 'blocked', 'unblock', 'unblockfail', 'invites', 'search', 'noresult', 'empty', 'loading', 'error']],
];
export const HUB = S;
export default function Hub() {
  useEffect(() => { document.title = 'All screens · Cojam admin'; }, []);
  return (
    <div className="hub">
      <p style={{ marginBottom: 12 }}><span className="chip-logo" style={{ boxShadow: 'inset 0 0 0 2px var(--ink)' }}><img src="/assets/cojam-mark.svg" alt="" />Cojam</span></p>
      <h1>Admin design hub</h1>
      <p className="dim" style={{ maxWidth: '76ch', margin: '8px 0 24px' }}>{CONFIG.mock ? <>Every admin screen and state, with the design's mock data. The mock moment is Thursday 26 Nov 2026, 14:32 KST, day 4 of week 48. Add <b>env=kairos</b> to any link for the test network badge and <b>role=viewer</b> or <b>role=owner</b> for the other roles.</> : <>Live data from the admin API. The state links only work in mock mode (VITE_API_MOCK=1).</>} The admin is English only and built for 1024 pixels and wider.</p>
      <ul className="hub-list">
        {S.map((s) => (
          <li key={s[0]}><span className="nb">{s[0]}</span><Link className="name" to={s[1]}>{s[2]}</Link>
            <span className="st">{s[3].map((x) => <Link key={x} to={s[1] + '?state=' + x}>{x}</Link>)}
              {s[0] !== 'AD0' && <><Link to={s[1] + '?env=kairos'}>env=kairos</Link><Link to={s[1] + '?role=viewer'}>role=viewer</Link>{(s[0] === 'AD6' || s[0] === 'AD2') && <Link to={s[1] + '?role=owner'}>role=owner</Link>}</>}
            </span></li>
        ))}
      </ul>
    </div>
  );
}
