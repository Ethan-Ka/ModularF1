import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/shallow'
import { fetchJolpicaDriverStandings, fetchJolpicaRaceResults } from '../api/jolpica'
import type { JolpicaStandingsList, JolpicaRace } from '../api/jolpica'
import { useSessionStore } from '../store/sessionStore'
import { useStandingsStore, type DriverSeasonStanding } from '../store/standingsStore'

export type { DriverSeasonStanding }

const noRetry429 = (count: number, err: unknown) =>
  (err as any)?.status !== 429 && count < 2

function buildStandings(
  standingsList: JolpicaStandingsList,
  races: JolpicaRace[]
): DriverSeasonStanding[] {
  // Map driver permanent number → ordered race results
  const resultsByDriver = new Map<number, DriverSeasonStanding['raceResults']>()

  for (const race of races) {
    const round = parseInt(race.round, 10)
    const circuitShortName = race.Circuit.Location.country
    for (const r of race.Results) {
      const driverNumber = parseInt(r.Driver.permanentNumber || r.number, 10)
      if (!Number.isFinite(driverNumber) || driverNumber <= 0) continue
      const position = parseInt(r.position, 10)
      const points = parseFloat(r.points)
      if (!Number.isFinite(position) || !Number.isFinite(points)) continue

      const existing = resultsByDriver.get(driverNumber) ?? []
      resultsByDriver.set(driverNumber, [...existing, { round, circuitShortName, position, points }])
    }
  }

  return standingsList.DriverStandings.map((ds) => {
    const driverNumber = parseInt(ds.Driver.permanentNumber, 10)
    const results = (resultsByDriver.get(driverNumber) ?? []).sort((a, b) => a.round - b.round)
    const podiums = results.filter((r) => r.position <= 3).length
    const bestFinish = results.reduce((best, r) => Math.min(best, r.position), Infinity)

    return {
      driverNumber,
      points: parseFloat(ds.points),
      wins: parseInt(ds.wins, 10),
      podiums,
      bestFinish: Number.isFinite(bestFinish) ? bestFinish : 0,
      racesEntered: results.length,
      raceResults: results,
    }
  })
}

export function useSeasonStandings(year = 2026) {
  const mode = useSessionStore((s) => s.mode)
  const enabled = mode !== 'onboarding'

  const cached = useStandingsStore(
    useShallow((s) => ({
      standings: s.standings,
      raceCount: s.raceCount,
      year: s.year,
    }))
  )
  const setStandings = useStandingsStore((s) => s.setStandings)

  const hasCachedStandings = cached.standings !== null && cached.year === year

  const { data: standingsList, isLoading: standingsLoading } = useQuery({
    queryKey: ['jolpica-standings', year],
    queryFn: () => fetchJolpicaDriverStandings(year),
    enabled,
    staleTime: 5 * 60_000,
    retry: noRetry429,
  })

  const { data: races, isLoading: racesLoading } = useQuery({
    queryKey: ['jolpica-results', year],
    queryFn: () => fetchJolpicaRaceResults(year),
    enabled,
    staleTime: 5 * 60_000,
    retry: noRetry429,
  })

  const apiRoundCount = standingsList ? parseInt(standingsList.round, 10) : 0

  const needsRefresh =
    !hasCachedStandings || (standingsList !== undefined && apiRoundCount > cached.raceCount)

  useEffect(() => {
    if (!needsRefresh) return
    if (!standingsList || !races) return

    const computed = buildStandings(standingsList, races)
    setStandings(year, computed, apiRoundCount)
  }, [standingsList, races, needsRefresh, year, apiRoundCount, setStandings])

  const bothLoading = standingsLoading || racesLoading
  const isFirstLoad = !hasCachedStandings && needsRefresh

  return {
    standings: cached.standings,
    isLoading: isFirstLoad && bothLoading,
    isRefreshing: hasCachedStandings && needsRefresh && bothLoading,
    raceCount: Math.max(cached.raceCount, apiRoundCount),
    // 0 while fetching, 1 once standings arrive, 2 once results arrive (for progress bar)
    loadedCount: standingsList && races ? 2 : standingsList ? 1 : 0,
    totalFetchSteps: 2,
  }
}
