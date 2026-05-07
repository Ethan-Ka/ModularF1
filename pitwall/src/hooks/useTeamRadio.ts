import { useQuery } from '@tanstack/react-query'
import { fetchSessions, fetchTeamRadio } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { queryModePolicy } from './queryModePolicy'


// OpenF1 is the only source with team radio data.
// FastF1 does not expose a team_radio accessor.
export function useTeamRadio(driverNumber?: number) {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const activeSession = useSessionStore((s) => s.activeSession)
  const mode = useSessionStore((s) => s.mode)
  const apiRequestsEnabled = useSessionStore((s) => s.apiRequestsEnabled)

  const { data: openf1SessionKey } = useQuery({
    queryKey: ['openf1', 'session-key', activeSession?.year, activeSession?.session_name, activeSession?.circuit_short_name, apiKey ? 'auth' : 'anon'],
    queryFn: async () => {
      if (!activeSession?.year) return null
      const sessions = await fetchSessions({ year: activeSession.year }, apiKey)
      const match = sessions.find((s) =>
        s.circuit_short_name?.toLowerCase() === activeSession.circuit_short_name?.toLowerCase()
        && s.session_name?.toLowerCase() === activeSession.session_name?.toLowerCase()
      )
      return match?.session_key ?? null
    },
    enabled: !!activeSession?.year && !!apiKey && apiRequestsEnabled,
    staleTime: 60_000,
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })

  return useQuery({
    queryKey: ['team_radio', openf1SessionKey, driverNumber],
    queryFn: () => fetchTeamRadio(openf1SessionKey!, driverNumber, apiKey),
    enabled: !!openf1SessionKey && !!apiKey && apiRequestsEnabled,
    ...queryModePolicy(mode, {
      staleTime: 30_000,
      refetchInterval: 30_000,
    }),
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })
}
