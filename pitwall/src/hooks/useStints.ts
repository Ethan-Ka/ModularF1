import { useQuery } from '@tanstack/react-query'
import { fetchFastF1Stints } from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import type { OpenF1Stint } from '../api/openf1'
import type { FastF1Stint } from '../api/fastf1Bridge'

const GC_24H = 24 * 60 * 60 * 1_000

function normalizeFastF1Stint(stint: FastF1Stint): OpenF1Stint {
  return {
    session_key: 0,
    driver_number: parseInt(stint.driver_number, 10),
    stint_number: stint.stint ?? 0,
    compound: stint.compound ?? 'UNKNOWN',
    tyre_age_at_start: stint.tyre_life_start ?? 0,
    lap_start: stint.lap_start,
    lap_end: stint.lap_end,
  }
}

export function useStints(driverNumber?: number, options?: { preload?: boolean }) {
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const usingFastF1 = fastf1Available && !!fastf1Ref

  const liveRefetchInterval = options?.preload ? false : 10_000
  const sessionEnabled = driverNumber !== undefined || options?.preload === true

  // Fetch all stints for the session; select filters to the requested driver client-side.
  const fastf1Query = useQuery({
    queryKey: ['stints', 'fastf1', fastf1Ref?.year, fastf1Ref?.round, fastf1Ref?.session],
    queryFn: async () => {
      const data = await fetchFastF1Stints(fastf1Ref!)
      return data.map(normalizeFastF1Stint)
    },
    enabled: usingFastF1 && sessionEnabled,
    select: driverNumber !== undefined
      ? (stints) => stints.filter((s) => s.driver_number === driverNumber)
      : undefined,
    ...queryModePolicy(mode, {
      staleTime: Infinity,
      refetchInterval: liveRefetchInterval,
    }),
    gcTime: GC_24H,
  })

  return fastf1Query
}
