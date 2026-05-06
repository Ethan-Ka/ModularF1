import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Position } from '../api/openf1'
import { useFastF1Timing } from './useFastF1'

// Returns latest position per driver (deduplicated + sorted by position)
export function usePositions() {
  const mode = useSessionStore((s) => s.mode)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)
  const usingFastF1 = fastf1Available && !!fastf1Ref

  const timingQuery = useFastF1Timing(usingFastF1 ? fastf1Ref : null, { live: mode === 'live' })

  const positions = timingQuery.data
    ?.map((row) => ({
      session_key: 0,
      driver_number: row.driver_number,
      position: row.position,
      date: row.date,
    } as OpenF1Position))
    .sort((a, b) => a.position - b.position)

  return {
    ...timingQuery,
    data: positions,
  }
}

// Returns position for a specific driver
export function useDriverPosition(driverNumber: number | null) {
  const { data: positions } = usePositions()
  if (!driverNumber || !positions) return null
  return positions.find((p) => p.driver_number === driverNumber) ?? null
}
