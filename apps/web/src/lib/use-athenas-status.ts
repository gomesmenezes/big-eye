'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetchPath } from './api';

export const ATHENAS_STATUS_QUERY_KEY = ['athenas', 'status'] as const;

export function useAthenasStatus({ poll = false }: Readonly<{ poll?: boolean }> = {}) {
  return useQuery({
    queryKey: ATHENAS_STATUS_QUERY_KEY,
    queryFn: () => apiFetchPath('/athenas/status'),
    staleTime: 60_000,
    refetchInterval: poll ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
