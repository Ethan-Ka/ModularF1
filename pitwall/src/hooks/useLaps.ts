import { useQuery } from '@tanstack/react-query'
import { fetchLaps } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'

export function useLaps(driverNumber?: number) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['laps', sessionKey, driverNumber],
    queryFn: () => fetchLaps(sessionKey!, driverNumber, apiKey),
    enabled: !!sessionKey,
    staleTime: 15_000,
    refetchInterval: mode === 'live' ? 15_000 : false,
  })
}
