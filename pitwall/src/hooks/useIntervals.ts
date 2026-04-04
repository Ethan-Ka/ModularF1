import { useQuery } from '@tanstack/react-query'
import { fetchIntervals } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Interval } from '../api/openf1'

export function useIntervals() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['intervals', sessionKey],
    queryFn: async () => {
      const all = await fetchIntervals(sessionKey!, apiKey)
      // Keep latest interval per driver
      const map = new Map<number, OpenF1Interval>()
      for (const i of all) {
        const ex = map.get(i.driver_number)
        if (!ex || i.date > ex.date) map.set(i.driver_number, i)
      }
      return Array.from(map.values())
    },
    enabled: !!sessionKey,
    staleTime: 2_000,
    refetchInterval: mode === 'live' ? 2_000 : false,
  })
}
