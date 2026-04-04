import { useQuery } from '@tanstack/react-query'
import { fetchStints } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'

export function useStints(driverNumber?: number) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['stints', sessionKey, driverNumber],
    queryFn: () => fetchStints(sessionKey!, driverNumber, apiKey),
    enabled: !!sessionKey,
    staleTime: 10_000,
    refetchInterval: mode === 'live' ? 10_000 : false,
  })
}
