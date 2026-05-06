import { useRef, useEffect, useMemo } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { useFakeTelemetryStore } from '../store/fakeTelemetryStore'
import { useDriverStore } from '../store/driverStore'
import { useCircuitMap } from './useCircuitMap'
import { MELBOURNE_CIRCUIT_MAP } from '../data/melbourneCircuitMap'
import type { FastF1SessionRef } from '../api/fastf1Bridge'
import { useFastF1Locations } from './useFastF1'

export interface DriverXY {
  driverNumber: number
  x: number
  y: number
  date: string
}

interface TrackPoint { x: number; y: number }

const MAX_TRACK_POINTS = 3000
const DEFAULT_FAKE_DRIVER_NUMBERS = [1, 4, 6, 10, 11, 14, 16, 18, 22, 23, 24, 27, 30, 31, 44, 55, 63, 81, 87, 2]

export function useLocation() {
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const fakeEnabled = useFakeTelemetryStore((s) => s.enabled)
  const buildLocationSamples = useFakeTelemetryStore((s) => s.buildLocationSamples)
  const buildTrackPoints = useFakeTelemetryStore((s) => s.buildTrackPoints)

  const f1Ref = useSessionStore((s) => s.activeFastF1Session)
  const activeYear = useSessionStore((s) => s.activeSession?.year)
  // In fake mode, never inherit the persisted f1Ref (which may point to any prior circuit).
  // Always resolve through the Melbourne fallback so fake drivers follow the right track.
  const { data: circuitMap } = useCircuitMap(null)

  const fakeFallbackRef: FastF1SessionRef | null =
    fakeEnabled ? { year: activeYear ?? 2026, round: 1, session: 'R' } : null
  const { data: fallbackCircuitMap } = useCircuitMap(fakeFallbackRef)
  const effectiveCircuitMap = circuitMap ?? fallbackCircuitMap ?? (fakeEnabled ? MELBOURNE_CIRCUIT_MAP : null)

  const trackPointsRef = useRef<TrackPoint[]>([])

  useEffect(() => {
    trackPointsRef.current = []
  }, [sessionKey])

  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const fastf1Query = useFastF1Locations(
    fastf1Available && !!fastf1Ref ? fastf1Ref : null,
    { live: mode === 'live' },
  )

  const data = useMemo<DriverXY[] | undefined>(() => {
    if (fakeEnabled) {
      const storeDrivers = useDriverStore.getState().drivers.map((d) => d.driver_number)
      const driverNumbers = storeDrivers.length > 0 ? storeDrivers : DEFAULT_FAKE_DRIVER_NUMBERS
      const trackX = effectiveCircuitMap?.x
      const trackY = effectiveCircuitMap?.y
      const samples = buildLocationSamples(driverNumbers, trackX, trackY)
      trackPointsRef.current = buildTrackPoints(trackX, trackY)
      return samples
    }

    const raw = fastf1Query.data ?? []
    const mapped = raw.map((loc) => ({
      driverNumber: loc.driver_number,
      x: loc.x,
      y: loc.y,
      date: loc.date,
    }))

    const incoming = mapped.filter((_, i) => i % 5 === 0).map((l) => ({ x: l.x, y: l.y }))
    if (incoming.length > 0) {
      const merged = [...trackPointsRef.current, ...incoming]
      trackPointsRef.current = merged.length > MAX_TRACK_POINTS
        ? merged.slice(-MAX_TRACK_POINTS)
        : merged
    }

    return mapped
  }, [fakeEnabled, fastf1Query.data, buildLocationSamples, buildTrackPoints, effectiveCircuitMap?.x, effectiveCircuitMap?.y])

  return {
    ...fastf1Query,
    data,
    trackPoints: trackPointsRef.current,
  }
}
