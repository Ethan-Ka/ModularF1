import { useQuery } from '@tanstack/react-query'
import { fetchStints } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'

export function useStints(driverNumber?: number, options?: { preload?: boolean }) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval = options?.preload ? false : 10_000

  return useQuery({
    queryKey: ['stints', sessionKey, driverNumber],
    queryFn: () => fetchStints(sessionKey!, driverNumber, apiKey),
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 10_000,
      refetchInterval: liveRefetchInterval,
    }),
  })
}
