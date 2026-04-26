import { useMemo } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchIntervals } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Interval } from '../api/openf1'
import { queryModePolicy } from './queryModePolicy'
import { readSessionData, writeSessionData, isSessionDataComplete } from '../lib/f1PersistentStore'

export function useIntervalHistory(options?: { preload?: boolean }) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const liveRefetchInterval = options?.preload ? false : 8_000

  return useQuery({
    queryKey: ['intervals-history', sessionKey],
    queryFn: async () => {
      const key = sessionKey!

      // For historical sessions, stored data is immutable — skip the network entirely
      const complete = await isSessionDataComplete('intervals', key)
      if (complete) {
        const stored = await readSessionData<OpenF1Interval>('intervals', key)
        if (stored.length > 0) return stored
      }

      // For live sessions, read what we have as a fallback in case the API fails
      const stored = complete ? [] : await readSessionData<OpenF1Interval>('intervals', key)

      try {
        const all = await fetchIntervals(key, apiKey)

        if (all.length === 0 && stored.length > 0) return stored

        void writeSessionData('intervals', key, all, mode === 'historical')
        return all
      } catch (error) {
        if (stored.length > 0) return stored
        throw error
      }
    },
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 5_000,
      refetchInterval: liveRefetchInterval,
    }),
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })
}

export function useIntervals(options?: { preload?: boolean }) {
  const historyQuery = useIntervalHistory(options)

  const latestIntervals = useMemo(() => {
    if (!historyQuery.data) return undefined
    const map = new Map<number, OpenF1Interval>()
    for (const interval of historyQuery.data) {
      const existing = map.get(interval.driver_number)
      if (!existing || interval.date > existing.date) {
        map.set(interval.driver_number, interval)
      }
    }
    return Array.from(map.values())
  }, [historyQuery.data])

  return {
    ...historyQuery,
    data: latestIntervals,
  } as UseQueryResult<OpenF1Interval[], Error>
}
