import { useQuery } from '@tanstack/react-query'
import { fetchFastF1Weather } from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import type { OpenF1Weather } from '../api/openf1'
import type { FastF1WeatherSample } from '../api/fastf1Bridge'

const GC_24H = 24 * 60 * 60 * 1_000

function normalizeFastF1Weather(sample: FastF1WeatherSample): OpenF1Weather {
  return {
    session_key: 0,
    date: '',
    air_temperature: sample.AirTemp ?? 0,
    track_temperature: sample.TrackTemp ?? 0,
    humidity: sample.Humidity ?? 0,
    pressure: sample.Pressure ?? 0,
    wind_direction: sample.WindDirection ?? 0,
    wind_speed: sample.WindSpeed ?? 0,
    rainfall: sample.Rainfall ? 1 : 0,
  }
}

export function useWeather(options?: { preload?: boolean }) {
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const usingFastF1 = fastf1Available && !!fastf1Ref

  const liveRefetchInterval = options?.preload ? false : 30_000

  const fastf1Query = useQuery({
    queryKey: ['weather', 'fastf1', fastf1Ref?.year, fastf1Ref?.round, fastf1Ref?.session],
    queryFn: async () => {
      const data = await fetchFastF1Weather(fastf1Ref!)
      return data.map(normalizeFastF1Weather)
    },
    enabled: usingFastF1,
    ...queryModePolicy(mode, {
      staleTime: Infinity,
      refetchInterval: liveRefetchInterval,
    }),
    gcTime: GC_24H,
  })

  return fastf1Query
}
