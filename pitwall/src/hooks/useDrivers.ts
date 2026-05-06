import { useSessionStore } from '../store/sessionStore'
import { useDriverStore } from '../store/driverStore'
import { useEffect } from 'react'
import type { OpenF1Driver } from '../api/openf1'
import { useFastF1Drivers } from './useFastF1'
import type { FastF1Driver } from '../api/fastf1Bridge'

function normalizeFastF1Driver(driver: FastF1Driver): OpenF1Driver {
  const teamColor = driver.team_colour?.replace('#', '') ?? '6B6B70'
  const fullName = driver.full_name ?? driver.name_acronym ?? ''
  return {
    driver_number: driver.driver_number,
    name_acronym: driver.name_acronym ?? String(driver.driver_number),
    full_name: fullName,
    team_name: driver.team_name ?? 'Unknown',
    team_colour: teamColor,
    session_key: 0,
  }
}

export function useDrivers() {
  const sessionYear = useSessionStore((s) => s.activeSession?.year ?? null)
  const fastf1Ref = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)
  const setDrivers = useDriverStore((s) => s.setDrivers)
  const applySeasonVisualsFromPublic = useDriverStore((s) => s.applySeasonVisualsFromPublic)

  const query = useFastF1Drivers(fastf1Available && fastf1Ref ? fastf1Ref : null)

  useEffect(() => {
    if (query.data) {
      const normalized = query.data.map(normalizeFastF1Driver)
      setDrivers(normalized, { seasonYear: sessionYear })

      if (sessionYear != null) {
        void applySeasonVisualsFromPublic(sessionYear).catch(() => {
          // Optional visual override; keep API colors if season bundle is unavailable.
        })
      }
    }
  }, [query.data, setDrivers, sessionYear, applySeasonVisualsFromPublic])

  return query
}
