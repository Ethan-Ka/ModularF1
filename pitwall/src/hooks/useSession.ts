import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchFastF1Events, type FastF1SessionRef, type FastF1Event } from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'
import type { OpenF1Session } from '../api/openf1'

export interface FastF1SessionRow {
  ref: FastF1SessionRef
  event_name: string
  circuit_name: string
  country: string
  session_name: string
  date: string | null
}

const SESSION_ORDER: Record<string, number> = {
  FP1: 1,
  FP2: 2,
  FP3: 3,
  SQ: 4,
  S: 5,
  Q: 6,
  R: 7,
}

function sessionKeyFromRef(ref: FastF1SessionRef): number {
  const order = SESSION_ORDER[ref.session] ?? 9
  return ref.year * 10000 + ref.round * 10 + order
}

function buildSessionMeta(event: FastF1Event, session: { type: string; name: string; date_start?: string | null; date_end?: string | null }, year: number): OpenF1Session {
  const ref: FastF1SessionRef = { year, round: event.round_number, session: session.type }
  const dateStart = session.date_start ?? event.date ?? ''
  const dateEnd = session.date_end ?? event.date ?? dateStart

  return {
    session_key: sessionKeyFromRef(ref),
    meeting_key: event.round_number,
    session_type: session.name,
    session_name: session.name,
    circuit_short_name: event.circuit_name,
    date_start: dateStart ?? '',
    date_end: dateEnd ?? '',
    year,
    country_name: event.country,
  }
}

export function useSessions(year?: number) {
  const mode = useSessionStore((s) => s.mode)
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['sessions', year, 'fastf1'],
    queryFn: async () => {
      const events = await fetchFastF1Events(year!)
      const sessions: OpenF1Session[] = []
      for (const event of events) {
        for (const session of event.sessions) {
          sessions.push(buildSessionMeta(event, session, year!))
        }
      }
      return sessions
    },
    enabled: !!year && mode !== 'onboarding' && available,
    ...queryModePolicy(mode, {
      staleTime: 60_000,
      refetchInterval: false,
    }),
  })
}

export function useLatestSession() {
  const mode = useSessionStore((s) => s.mode)
  const available = useSessionStore((s) => s.fastf1ServerAvailable)
  const year = new Date().getFullYear()

  return useQuery({
    queryKey: ['sessions', 'latest', 'fastf1', year],
    queryFn: async () => {
      const events = await fetchFastF1Events(year)
      const sessions: OpenF1Session[] = []
      for (const event of events) {
        for (const session of event.sessions) {
          sessions.push(buildSessionMeta(event, session, year))
        }
      }
      const latest = sessions
        .filter((s) => s.date_start)
        .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]
      return latest ? [latest] : []
    },
    enabled: mode !== 'onboarding' && available,
    ...queryModePolicy(mode, {
      staleTime: 30_000,
      refetchInterval: 60_000,
    }),
  })
}

export function useFastF1Sessions(year?: number): UseQueryResult<FastF1SessionRow[]> {
  const available = useSessionStore((s) => s.fastf1ServerAvailable)

  return useQuery({
    queryKey: ['fastf1', 'sessions', year],
    queryFn: async () => {
      const events = await fetchFastF1Events(year!)
      const rows: FastF1SessionRow[] = []
      for (const event of events) {
        for (const session of event.sessions) {
          rows.push({
            ref: { year: year!, round: event.round_number, session: session.type },
            event_name: event.event_name,
            circuit_name: event.circuit_name,
            country: event.country,
            session_name: session.name,
            date: session.date_start ?? event.date,
          })
        }
      }
      return rows
    },
    enabled: !!year && available,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1_000,
  })
}
