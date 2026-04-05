import { useQuery } from '@tanstack/react-query'
import { fetchDrivers } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { useDriverStore } from '../store/driverStore'
import { useEffect } from 'react'

export function useDrivers() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const setDrivers = useDriverStore((s) => s.setDrivers)

  const query = useQuery({
    queryKey: ['drivers', sessionKey],
    queryFn: () => fetchDrivers(sessionKey!, apiKey),
    enabled: !!sessionKey,
    staleTime: Infinity,
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })

  useEffect(() => {
    if (query.data) setDrivers(query.data)
  }, [query.data, setDrivers])

  return query
}
