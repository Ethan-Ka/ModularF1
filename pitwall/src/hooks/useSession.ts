import { useQuery } from '@tanstack/react-query'
import { fetchSessions, fetchLatestSession } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'

export function useSessions(year?: number) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  return useQuery({
    queryKey: ['sessions', year],
    queryFn: () => fetchSessions({ year }, apiKey),
    staleTime: 60_000,
  })
}

export function useLatestSession() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const mode = useSessionStore((s) => s.mode)
  return useQuery({
    queryKey: ['sessions', 'latest'],
    queryFn: () => fetchLatestSession(apiKey),
    staleTime: 30_000,
    refetchInterval: mode === 'live' ? 60_000 : false,
  })
}
