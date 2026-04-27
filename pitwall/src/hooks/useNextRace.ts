import { useMemo } from 'react'
import { useSessions } from './useSession'
import type { OpenF1Session } from '../api/openf1'

export type RaceProximity =
  | 'live'      // race session is currently running
  | 'imminent'  // < 2 hours to start
  | 'today'     // race day, 2–8 hours to start
  | 'weekend'   // within 7 days
  | 'upcoming'  // > 7 days away
  | 'none'      // no race found in schedule

export interface NextRaceInfo {
  session: OpenF1Session | null
  proximity: RaceProximity
  msToStart: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export function useNextRace(year: number = new Date().getFullYear()): NextRaceInfo {
  const { data: sessions } = useSessions(year)

  return useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return { session: null, proximity: 'none', msToStart: Infinity }
    }

    const now = Date.now()
    // Find the earliest Race session that hasn't ended yet
    const race = sessions
      .filter(s => s.session_type === 'Race' && new Date(s.date_end).getTime() > now - 30 * 60 * 1000)
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0] ?? null

    if (!race) return { session: null, proximity: 'none', msToStart: Infinity }

    const start = new Date(race.date_start).getTime()
    const end = new Date(race.date_end).getTime()
    const msToStart = start - now

    let proximity: RaceProximity
    if (now >= start && now <= end) proximity = 'live'
    else if (msToStart <= 2 * HOUR) proximity = 'imminent'
    else if (msToStart <= 8 * HOUR) proximity = 'today'
    else if (msToStart <= 7 * DAY) proximity = 'weekend'
    else proximity = 'upcoming'

    return { session: race, proximity, msToStart }
  }, [sessions])
}
