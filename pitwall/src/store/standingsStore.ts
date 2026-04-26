import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DriverSeasonStanding {
  driverNumber: number
  points: number
  wins: number
  podiums: number
  bestFinish: number
  racesEntered: number
  raceResults: Array<{
    round: number
    circuitShortName: string
    position: number
    points: number
  }>
}

interface StandingsStore {
  year: number | null
  standings: DriverSeasonStanding[] | null
  raceCount: number          // number of races included in this snapshot
  computedAt: number | null  // ms timestamp
  setStandings: (year: number, standings: DriverSeasonStanding[], raceCount: number) => void
  clearStandings: () => void
}

export const useStandingsStore = create<StandingsStore>()(
  persist(
    (set) => ({
      year: null,
      standings: null,
      raceCount: 0,
      computedAt: null,

      setStandings: (year, standings, raceCount) =>
        set({ year, standings, raceCount, computedAt: Date.now() }),

      clearStandings: () =>
        set({ year: null, standings: null, raceCount: 0, computedAt: null }),
    }),
    {
      name: 'pitwall-standings',
      version: 2,
      migrate: () => ({ year: null, standings: null, raceCount: 0, computedAt: null }),
    }
  )
)
