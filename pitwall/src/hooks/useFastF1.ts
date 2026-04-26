// React Query hooks for the FastF1 bridge sidecar.
// All historical data uses staleTime: Infinity — sessions are immutable once finished.
// gcTime of 24h keeps data in memory across widget re-mounts without refetching.

import { useQuery } from '@tanstack/react-query'
import {
  checkFastF1Server,
  fetchFastF1Events,
  fetchFastF1Laps,
  fetchFastF1RaceControl,
  fetchFastF1Results,
  fetchFastF1Stints,
  fetchFastF1Telemetry,
  fetchFastF1Weather,
  type FastF1SessionRef,
} from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'

const GC_24H = 24 * 60 * 60 * 1_000
const HISTORICAL_OPTS = { staleTime: Infinity, gcTime: GC_24H } as const

// ---------------------------------------------------------------------------
// Server health — polls fast (2s) until available, then every 30s
// ---------------------------------------------------------------------------

export function useFastF1ServerStatus() {
  const setAvailable = useSessionStore((s) => s.setFastF1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'health'],
    queryFn: async () => {
      const ok = await checkFastF1Server()
      setAvailable(ok)
      return ok
    },
    refetchInterval: (query) => (query.state.data === true ? 30_000 : 2_000),
    staleTime: 0,
    retry: false,
  })
}

// ---------------------------------------------------------------------------
// Events (season calendar)
// ---------------------------------------------------------------------------

export function useFastF1Events(year?: number) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'events', year],
    queryFn: () => fetchFastF1Events(year!),
    enabled: !!year && available,
    ...HISTORICAL_OPTS,
  })
}

// ---------------------------------------------------------------------------
// Session data
// ---------------------------------------------------------------------------

export function useFastF1Laps(ref?: FastF1SessionRef | null, driver?: string) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'laps', ref?.year, ref?.round, ref?.session, driver],
    queryFn: () => fetchFastF1Laps(ref!, driver),
    enabled: !!ref && available,
    ...HISTORICAL_OPTS,
  })
}

export function useFastF1Telemetry(ref?: FastF1SessionRef | null, driver?: string, lap?: number) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'telemetry', ref?.year, ref?.round, ref?.session, driver, lap],
    queryFn: () => fetchFastF1Telemetry(ref!, driver!, lap),
    enabled: !!ref && !!driver && available,
    ...HISTORICAL_OPTS,
  })
}

export function useFastF1Stints(ref?: FastF1SessionRef | null) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'stints', ref?.year, ref?.round, ref?.session],
    queryFn: () => fetchFastF1Stints(ref!),
    enabled: !!ref && available,
    ...HISTORICAL_OPTS,
  })
}

export function useFastF1Weather(ref?: FastF1SessionRef | null) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'weather', ref?.year, ref?.round, ref?.session],
    queryFn: () => fetchFastF1Weather(ref!),
    enabled: !!ref && available,
    ...HISTORICAL_OPTS,
  })
}

export function useFastF1RaceControl(ref?: FastF1SessionRef | null) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'race_control', ref?.year, ref?.round, ref?.session],
    queryFn: () => fetchFastF1RaceControl(ref!),
    enabled: !!ref && available,
    ...HISTORICAL_OPTS,
  })
}

export function useFastF1Results(ref?: FastF1SessionRef | null) {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'results', ref?.year, ref?.round, ref?.session],
    queryFn: () => fetchFastF1Results(ref!),
    enabled: !!ref && available,
    ...HISTORICAL_OPTS,
  })
}
