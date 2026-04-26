import { useQuery } from '@tanstack/react-query'
import { fetchLaps } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import { readSessionData, writeSessionData, isSessionDataComplete } from '../lib/f1PersistentStore'
import type { OpenF1Lap } from '../api/openf1'

export function useLaps(
  driverNumber?: number,
  options?: { preload?: boolean; refetchIntervalMs?: number | false }
) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval =
    options?.refetchIntervalMs !== undefined
      ? options.refetchIntervalMs
      : options?.preload
        ? false
        : 15_000

  return useQuery({
    queryKey: ['laps', sessionKey, driverNumber],
    queryFn: async () => {
      const key = sessionKey!
      // A full-session completion (-1) also covers per-driver checks
      const complete = await isSessionDataComplete('laps', key, driverNumber)
      if (complete) {
        const stored = await readSessionData<OpenF1Lap>('laps', key, driverNumber)
        if (stored.length > 0) return stored
      }
      const data = await fetchLaps(key, driverNumber, apiKey)
      void writeSessionData('laps', key, data, mode === 'historical', driverNumber)
      return data
    },
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 15_000,
      refetchInterval: liveRefetchInterval,
    }),
  })
}
