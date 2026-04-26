import { useQuery } from '@tanstack/react-query'
import { fetchWeather } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import { readSessionData, writeSessionData, isSessionDataComplete } from '../lib/f1PersistentStore'
import type { OpenF1Weather } from '../api/openf1'

export function useWeather(options?: { preload?: boolean }) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval = options?.preload ? false : 30_000

  return useQuery({
    queryKey: ['weather', sessionKey],
    queryFn: async () => {
      const key = sessionKey!
      const complete = await isSessionDataComplete('weather', key)
      if (complete) {
        const stored = await readSessionData<OpenF1Weather>('weather', key)
        if (stored.length > 0) return stored
      }
      const data = await fetchWeather(key, apiKey)
      void writeSessionData('weather', key, data, mode === 'historical')
      return data
    },
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 30_000,
      refetchInterval: liveRefetchInterval,
    }),
  })
}
