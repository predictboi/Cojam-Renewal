// The app's API: the HTTP client, or the mock adapter when VITE_API_MOCK=1. Reads go through TanStack Query.
import { QueryClient, useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { CONFIG } from '../config';
import { httpApi, type Api } from './client';
import { mockApi } from './mock';
import { setKrwPerCt } from '../lib/fmt';
import type { AppConfig } from './types';

export const api: Api = CONFIG.mockApi ? mockApi : httpApi;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: (n, e) => n < 2 && (e as { status?: number }).status !== 401, refetchOnWindowFocus: true },
  },
});

/* In mock mode the preset is part of the key, so opening another preset (or dropping it) reads again. */
function useKey(name: string, ...rest: unknown[]) {
  const loc = useLocation();
  return CONFIG.mockApi ? [name, loc.pathname, loc.search, ...rest] : [name, ...rest];
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async (): Promise<AppConfig> => { const c = await api.config(); setKrwPerCt(c.krwPerCt); return c; },
    staleTime: 5 * 60_000,
  });
}
export const useMe = (enabled = true) => useQuery({ queryKey: useKey('me'), queryFn: api.me, enabled });
export const useToday = () => useQuery({ queryKey: useKey('today'), queryFn: api.today, refetchInterval: 60_000 });
export const useWallet = () => useQuery({ queryKey: useKey('wallet'), queryFn: api.wallet, refetchInterval: 30_000 });
export const useResults = () => useQuery({ queryKey: useKey('results'), queryFn: () => api.results() });
export const useRanking = (week: 'current' | 'last') => useQuery({ queryKey: useKey('ranking', week), queryFn: () => api.ranking(week), refetchInterval: 30_000 });
export const usePositions = () => useQuery({ queryKey: useKey('positions'), queryFn: api.positions });
export const useInvite = () => useQuery({ queryKey: useKey('invite'), queryFn: api.invite });
