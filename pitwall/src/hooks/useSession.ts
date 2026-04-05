import { useQuery } from '@tanstack/react-query'
import { fetchSessions, fetchLatestSession } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'

const noRetry429 = (failureCount: number, error: unknown) =>
  (error as any)?.status !== 429 && failureCount < 2

export function useSessions(year?: number) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const mode = useSessionStore((s) => s.mode)
  const apiRequestsEnabled = useSessionStore((s) => s.apiRequestsEnabled)
  return useQuery({
    queryKey: ['sessions', year, apiKey ? 'auth' : 'anon'],
    queryFn: () => fetchSessions({ year }, apiKey),
    enabled: mode !== 'onboarding' && apiRequestsEnabled,
    ...queryModePolicy(mode, {
      staleTime: 60_000,
      refetchInterval: false,
    }),
    retry: noRetry429,
  })
}

export function useLatestSession() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const mode = useSessionStore((s) => s.mode)
  const apiRequestsEnabled = useSessionStore((s) => s.apiRequestsEnabled)
  return useQuery({
    queryKey: ['sessions', 'latest', apiKey ? 'auth' : 'anon', mode],
    queryFn: () => fetchLatestSession(apiKey),
    enabled: mode !== 'onboarding' && apiRequestsEnabled,
    ...queryModePolicy(mode, {
      staleTime: 30_000,
      refetchInterval: 60_000,
    }),
    retry: noRetry429,
  })
}
