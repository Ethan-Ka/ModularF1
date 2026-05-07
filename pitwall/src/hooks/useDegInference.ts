import { useMemo } from 'react'
import { useStints } from './useStints'
import { useLaps } from './useLaps'
import { useWeather } from './useWeather'
import type { OpenF1Stint } from '../api/openf1'

// ─── Canonical constants (single source of truth for all tyre widgets) ────────

export const BASE_WINDOW: Record<string, number> = {
  SOFT: 18,
  MEDIUM: 28,
  HARD: 40,
  INTERMEDIATE: 35,
  INTER: 35,
  WET: 50,
}

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'var(--red)',
  MEDIUM: '#FFD600',
  HARD: 'var(--white)',
  INTERMEDIATE: 'var(--green)',
  INTER: 'var(--green)',
  WET: 'var(--blue)',
}

export const COMPOUND_ABBR: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  INTER: 'I',
  WET: 'W',
}

// Nominal degradation rate (s/lap) that BASE_WINDOW values were calibrated for.
// If observed rate is 2× this, cliff arrives at half the base window.
const BASE_DEG_RATE = 0.08

// Temperature baseline and sensitivity (% change in effective deg per °C above/below)
const TEMP_BASELINE = 45
const TEMP_SENSITIVITY = 0.015

export interface DegInference {
  compound: string
  tyreAge: number
  lapCount: number
  currentStint: OpenF1Stint | null

  // Observed deg rate from regression (null if < 2 stint laps available)
  degPerLap: number | null
  // Temperature factor: >1 = hotter than baseline = more degradation
  tempMultiplier: number
  trackTemp: number
  // Normalised load index: observed rate / base rate (>1 = harder on tyres than baseline)
  paceIntensity: number

  // Cliff prediction
  cliffTyreLife: number
  cliffLap: number
  lapsToCliff: number
  degradationPct: number

  // How many stint laps fed into the regression
  confidence: 'high' | 'medium' | 'low'
}

function linearRegressionSlope(points: { x: number; y: number }[]): number | null {
  const n = points.length
  if (n < 2) return null
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null
  return (n * sumXY - sumX * sumY) / denom
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function useDegInference(driverNumber: number | undefined): DegInference {
  const { data: stints } = useStints(driverNumber)
  const { data: laps } = useLaps(driverNumber)
  const { data: weatherAll } = useWeather()

  return useMemo((): DegInference => {
    const trackTemp = weatherAll?.[weatherAll.length - 1]?.track_temperature ?? TEMP_BASELINE
    const tempMultiplier = clamp(1 + (trackTemp - TEMP_BASELINE) * TEMP_SENSITIVITY, 0.6, 2.0)

    const NULL_RESULT: DegInference = {
      compound: 'UNKNOWN',
      tyreAge: 0,
      lapCount: 0,
      currentStint: null,
      degPerLap: null,
      tempMultiplier,
      trackTemp,
      paceIntensity: 1,
      cliffTyreLife: 25,
      cliffLap: 0,
      lapsToCliff: 0,
      degradationPct: 0,
      confidence: 'low',
    }

    if (!stints?.length) return NULL_RESULT

    const currentStint = [...stints].sort((a, b) => b.stint_number - a.stint_number)[0]
    const compound = (currentStint.compound ?? 'UNKNOWN').toUpperCase()
    const baseWindow = BASE_WINDOW[compound] ?? 25

    // Count valid (non-pit-out) laps in the current stint
    const endLap = currentStint.lap_end ?? Number.POSITIVE_INFINITY
    const stintLaps = (laps ?? [])
      .filter(
        (l) =>
          l.lap_number >= currentStint.lap_start &&
          l.lap_number <= endLap &&
          l.lap_duration != null &&
          Number.isFinite(l.lap_duration) &&
          l.lap_duration > 0 &&
          !l.is_pit_out_lap,
      )
      .sort((a, b) => a.lap_number - b.lap_number)

    const lapCount = (laps ?? []).filter((l) => l.lap_number != null).length

    // Tyre age: laps already on set before stint + laps in this stint
    const tyreAge = Math.max(
      0,
      lapCount - currentStint.lap_start + 1 + (currentStint.tyre_age_at_start ?? 0),
    )

    // ── Regression: slope in seconds/lap over tyre age ────────────────────────
    let degPerLap: number | null = null
    if (stintLaps.length >= 2) {
      const firstPace = stintLaps[0].lap_duration!
      const regressionPoints = stintLaps.map((lap) => ({
        // x = tyre age (absolute laps on this set)
        x: Math.max(1, (currentStint.tyre_age_at_start ?? 0) + (lap.lap_number - currentStint.lap_start) + 1),
        // y = delta from first lap (so regression slope = s/lap of degradation)
        y: lap.lap_duration! - firstPace,
      }))
      const slope = linearRegressionSlope(regressionPoints)
      // Only use positive slopes (actual degradation); negative means tyre improvement / messy data
      if (slope !== null && slope > 0) degPerLap = slope
    }

    // ── Cliff projection ──────────────────────────────────────────────────────
    // When regression is available: use it directly (it already encodes pace + wear effects)
    // Temperature adjusts the forward projection (hot track → expect faster wear going forward)
    const effectiveRate = (degPerLap ?? BASE_DEG_RATE) * tempMultiplier
    const cliffTyreLife = Math.max(3, Math.round(baseWindow * (BASE_DEG_RATE / effectiveRate)))
    const cliffLap = currentStint.lap_start - (currentStint.tyre_age_at_start ?? 0) + cliffTyreLife
    const lapsToCliff = cliffLap - lapCount
    const degradationPct = clamp((tyreAge / cliffTyreLife) * 100, 0, 100)

    // paceIntensity: how much harder the car is working vs the nominal baseline
    // When degPerLap is available this is purely data-driven; otherwise defaults to 1.
    const paceIntensity = degPerLap != null ? clamp(degPerLap / BASE_DEG_RATE, 0.2, 5.0) : 1.0

    const confidence: 'high' | 'medium' | 'low' =
      stintLaps.length >= 5 ? 'high' : stintLaps.length >= 2 ? 'medium' : 'low'

    return {
      compound,
      tyreAge,
      lapCount,
      currentStint,
      degPerLap,
      tempMultiplier,
      trackTemp,
      paceIntensity,
      cliffTyreLife,
      cliffLap,
      lapsToCliff,
      degradationPct,
      confidence,
    }
  }, [stints, laps, weatherAll])
}
