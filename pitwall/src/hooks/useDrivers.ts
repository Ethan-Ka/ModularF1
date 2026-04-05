import { useQuery } from '@tanstack/react-query'
import { fetchDrivers } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { useDriverStore } from '../store/driverStore'
import { useEffect } from 'react'
import { queryModePolicy } from './queryModePolicy'

export function useDrivers() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const sessionYear = useSessionStore((s) => s.activeSession?.year ?? null)
  const mode = useSessionStore((s) => s.mode)
  const setDrivers = useDriverStore((s) => s.setDrivers)
  const applySeasonVisualsFromPublic = useDriverStore((s) => s.applySeasonVisualsFromPublic)

  const query = useQuery({
    queryKey: ['drivers', sessionKey],
    queryFn: () => fetchDrivers(sessionKey!, apiKey),
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: Infinity,
      refetchInterval: false,
    }),
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })

  useEffect(() => {
    if (query.data) {
      setDrivers(query.data, { seasonYear: sessionYear })

      if (sessionYear != null) {
        void applySeasonVisualsFromPublic(sessionYear).catch(() => {
          // Optional visual override; keep API colors if season bundle is unavailable.
        })
      }
    }
  }, [query.data, setDrivers, sessionYear, applySeasonVisualsFromPublic])

  return query
}
