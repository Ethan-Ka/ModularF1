import { useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Interval } from '../api/openf1'
import { useFastF1Timing } from './useFastF1'

export function useIntervalHistory(options?: { preload?: boolean }) {
  const mode = useSessionStore((s) => s.mode)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const usingFastF1 = fastf1Available && !!fastf1Ref

  const timingQuery = useFastF1Timing(usingFastF1 ? fastf1Ref : null, { live: mode === 'live' })

  const data = timingQuery.data?.map((row) => ({
    session_key: 0,
    driver_number: row.driver_number,
    gap_to_leader: row.gap_to_leader ?? 0,
    interval: row.interval ?? 0,
    date: row.date,
  } satisfies OpenF1Interval))

  return {
    ...timingQuery,
    data,
  }
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
