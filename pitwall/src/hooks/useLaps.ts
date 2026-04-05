import { useQuery } from '@tanstack/react-query'
import { fetchLaps } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'

export function useLaps(driverNumber?: number, options?: { preload?: boolean }) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval = options?.preload ? false : 15_000

  return useQuery({
    queryKey: ['laps', sessionKey, driverNumber],
    queryFn: () => fetchLaps(sessionKey!, driverNumber, apiKey),
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 15_000,
      refetchInterval: liveRefetchInterval,
    }),
  })
}
