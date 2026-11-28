// Data hooks. Every screen renders one view model shaped like the design's mock data (window.AD in data.js), so the
// ported markup builders stay line for line. Mock mode hands over the design data itself; live mode builds the same
// shape from the admin API (adapt.ts). Live loading and error map onto the design's own `loading` and `error` states.
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { CONFIG } from '../config';
import { api, ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status >= 400 && e.status < 500), refetchOnWindowFocus: false, staleTime: 15_000 } },
});

export const mockD = (): any => (window as any).AD;

/** ?state=, ?env=, ?role= presets. Mock: every preset. Live: only `allowed` navigational states. */
export function usePreset(allowed: string[] = []) {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  const raw = qs.get('state') || '';
  return { state: CONFIG.mock ? raw : allowed.includes(raw) ? raw : '', qs };
}

export interface Me { email: string; role: 'viewer' | 'operator' | 'owner'; privyUserId?: string }
export function useMe(enabled = true) {
  const loc = useLocation();
  return useQuery<Me>({
    queryKey: ['me', CONFIG.mock ? loc.search : ''],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (CONFIG.mock) {
        const role = ((new URLSearchParams(loc.search).get('role') || 'operator').toLowerCase()) as Me['role'];
        return { email: role === 'owner' ? 'founder@cojam.app' : role === 'viewer' ? 'cs@cojam.app' : mockD().me.email, role };
      }
      return api<Me>('/admin/v1/me');
    },
  });
}

export interface NetConfig { network: string; chainId: number; contracts: Record<string, string | null>; time?: { now: number; dayId: number; dayEndsAt: number; weekId: number } }
/** GET /v1/config (public): the network badge, chain id and contract addresses. */
export function useNet() {
  const loc = useLocation();
  return useQuery<NetConfig>({
    queryKey: ['net', CONFIG.mock ? loc.search : ''],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (CONFIG.mock) {
        const k = new URLSearchParams(loc.search).get('env') === 'kairos';
        return { network: k ? 'kairos' : 'kaia', chainId: k ? 1001 : 8217, contracts: {} };
      }
      const r = await fetch(CONFIG.apiUrl + '/v1/config');
      if (!r.ok) throw new ApiError('HTTP_' + r.status, 'config');
      return r.json();
    },
  });
}

/** Live: the overview (alerts, counts) drives the status dot and the side navigation counts. */
export function useOverview(enabled = true) {
  return useQuery<any>({ queryKey: ['overview'], enabled: enabled && !CONFIG.mock, refetchInterval: 60_000, queryFn: () => api('/admin/v1/overview') });
}
export function useAppState(enabled = true) {
  return useQuery<any>({ queryKey: ['app'], enabled: enabled && !CONFIG.mock, queryFn: () => api('/admin/v1/app') });
}
export function usePendingParams(enabled = true) {
  return useQuery<any>({ queryKey: ['params'], enabled: enabled && !CONFIG.mock, queryFn: () => api('/admin/v1/params') });
}

/** One screen's view model: mock data, or the adapter over a live fetch. */
export function usePageData(key: unknown[], live: () => Promise<any>, opts: { refetchInterval?: number } = {}) {
  const q = useQuery<any>({ queryKey: ['page', ...key], enabled: !CONFIG.mock, queryFn: live, refetchInterval: opts.refetchInterval });
  if (CONFIG.mock) return { D: mockD(), loading: false, error: null as null | Error, updatedAt: 0, q };
  return { D: q.data, loading: q.isPending, error: q.error as Error | null, updatedAt: q.dataUpdatedAt, q };
}

export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
