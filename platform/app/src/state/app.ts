// App wide state: connectivity and the account on hold flag.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { presetOf } from '../lib/preset';
import { useMe } from '../api';

export const useNet = create<{ online: boolean }>(() => ({ online: navigator.onLine }));
window.addEventListener('online', () => useNet.setState({ online: true }));
window.addEventListener('offline', () => useNet.setState({ online: false }));

/** offline: the browser says so, or the design preset ?state=offline on this screen */
export function useOffline(): boolean {
  const online = useNet((s) => s.online);
  const loc = useLocation();
  return !online || presetOf(loc.search) === 'offline';
}
export function usePreset(): string { return presetOf(useLocation().search); }

/** account on hold (frozen on chain or flagged): every screen shows the one hold notice */
export function useHold(): boolean {
  const me = useMe();
  return !!me.data?.frozen;
}

export function useTimeout(ms: number, deps: unknown[] = []) {
  const [done, setDone] = useState(false);
  useEffect(() => { setDone(false); const t = setTimeout(() => setDone(true), ms); return () => clearTimeout(t); }, deps);
  return done;
}
