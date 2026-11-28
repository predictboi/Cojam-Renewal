// Per screen context: the preset state (mock) or navigational state (live), the role and the network badge are put
// on X before the screen builds its markup, so the ported builders read them exactly as admin.js did.
import { useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CONFIG } from './config';
import { X } from './lib/x';
import { setActs, setHooks, type Act } from './lib/ui';
import { useMe, useNet, usePreset, useInvalidate } from './api/hooks';

export function usePageCtx(page: string, liveStates: string[] = []) {
  const { state, qs } = usePreset(liveStates);
  const me = useMe();
  const net = useNet();
  const loc = useLocation();
  X.page = page;
  X.state = state;
  if (me.data) X.role = me.data.role;
  const k = CONFIG.mock ? qs.get('env') === 'kairos' : net.data?.network === 'kairos';
  X.env = k ? 'kairos' : 'kaia';
  X.explorer = k ? 'https://kairos.kaiascan.io' : 'https://kaiascan.io';
  return { state, qs, me: me.data, net: net.data, loc };
}

/** Registers the screen's delegated actions (data-act) after each render. */
export function useActs(map: Record<string, Act>) {
  useLayoutEffect(() => { setActs(map); });
}

/** Wires X.go (state presets) and reload to the router and the query cache. */
export function useRouterHooks() {
  const navigate = useNavigate();
  const inval = useInvalidate();
  useLayoutEffect(() => {
    setHooks({
      nav: (to) => navigate(to),
      go: (state) => { const u = new URLSearchParams(location.search); if (state) u.set('state', state); else u.delete('state'); navigate(location.pathname + (u.toString() ? '?' + u : '')); },
      reload: () => { if (CONFIG.mock) location.reload(); else void inval(); },
    });
  }, [navigate, inval]);
}

export const ctWei = (w: string | null | undefined) => (w == null ? null : Number(BigInt(w) / 10n ** 14n) / 10_000);
export const nowS = () => Math.floor(Date.now() / 1000);
