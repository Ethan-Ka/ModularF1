import { useMemo } from 'react'
import type { OpenF1CarData } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { useFakeTelemetryStore } from '../store/fakeTelemetryStore'
import { useFastF1TelemetryLatest } from './useFastF1'

// Incremental polling hook for /car_data, modelled after useLocation.
// Only enabled in live mode — car data for a full historical session would be huge.
export function useCarData(driverNumber?: number | null) {
  const mode = useSessionStore((s) => s.mode)
  const fakeEnabled = useFakeTelemetryStore((s) => s.enabled)
  const buildSample = useFakeTelemetryStore((s) => s.buildSample)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const fastf1Query = useFastF1TelemetryLatest(
    fastf1Available && !!fastf1Ref ? fastf1Ref : null,
    driverNumber ?? undefined,
  )

  const normalized = useMemo<OpenF1CarData | null>(() => {
    if (fakeEnabled && driverNumber) return buildSample(driverNumber)
    const sample = fastf1Query.data?.[0]
    if (!sample || driverNumber == null) return null
    return {
      driver_number: driverNumber,
      speed: sample.Speed ?? 0,
      throttle: sample.Throttle ?? 0,
      brake: sample.Brake ? 100 : 0,
      rpm: sample.RPM ?? 0,
      n_gear: sample.nGear ?? 0,
      drs: sample.DRS ?? 0,
      date: sample.Date ?? new Date().toISOString(),
      session_key: 0,
    }
  }, [fakeEnabled, driverNumber, buildSample, fastf1Query.data])

  return {
    ...fastf1Query,
    data: normalized,
  }
}
