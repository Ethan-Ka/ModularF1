import { useQuery } from '@tanstack/react-query'
import { fetchWeather } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'

export function useWeather(options?: { preload?: boolean }) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval = options?.preload ? false : 30_000

  return useQuery({
    queryKey: ['weather', sessionKey],
    queryFn: () => fetchWeather(sessionKey!, apiKey),
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 30_000,
      refetchInterval: liveRefetchInterval,
    }),
  })
}
