import { useQuery } from '@tanstack/react-query'
import { fetchFastF1Laps } from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import type { OpenF1Lap } from '../api/openf1'
import type { FastF1Lap } from '../api/fastf1Bridge'

const GC_24H = 24 * 60 * 60 * 1_000

function normalizeFastF1Lap(lap: FastF1Lap): OpenF1Lap {
  return {
    session_key: 0,
    driver_number: parseInt(lap.DriverNumber, 10),
    lap_number: lap.LapNumber,
    lap_duration: lap.LapTime ?? 0,
    duration_sector_1: lap.Sector1Time ?? 0,
    duration_sector_2: lap.Sector2Time ?? 0,
    duration_sector_3: lap.Sector3Time ?? 0,
    is_pit_out_lap: lap.PitOutTime != null,
    date_start: '',
  }
}

export function useLaps(
  driverNumber?: number,
  options?: { preload?: boolean; refetchIntervalMs?: number | false }
) {
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const usingFastF1 = fastf1Available && !!fastf1Ref

  const liveRefetchInterval =
    options?.refetchIntervalMs !== undefined
      ? options.refetchIntervalMs
      : options?.preload
        ? false
        : 15_000

  const sessionEnabled = driverNumber !== undefined || options?.preload === true

  // Fetch all laps for the session; select filters to the requested driver client-side.
  // This way all callers share one cache entry per session instead of one per driver.
  const fastf1Query = useQuery({
    queryKey: ['laps', 'fastf1', fastf1Ref?.year, fastf1Ref?.round, fastf1Ref?.session],
    queryFn: async () => {
      const data = await fetchFastF1Laps(fastf1Ref!)
      return data.map(normalizeFastF1Lap)
    },
    enabled: usingFastF1 && sessionEnabled,
    select: driverNumber !== undefined
      ? (laps) => laps.filter((l) => l.driver_number === driverNumber)
      : undefined,
    ...queryModePolicy(mode, {
      staleTime: Infinity,
      refetchInterval: liveRefetchInterval,
    }),
    gcTime: GC_24H,
  })

  return fastf1Query
}
