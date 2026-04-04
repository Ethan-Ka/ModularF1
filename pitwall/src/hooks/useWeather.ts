import { useQuery } from '@tanstack/react-query'
import { fetchWeather } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'

export function useWeather() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['weather', sessionKey],
    queryFn: () => fetchWeather(sessionKey!, apiKey),
    enabled: !!sessionKey,
    staleTime: 30_000,
    refetchInterval: mode === 'live' ? 30_000 : false,
  })
}
