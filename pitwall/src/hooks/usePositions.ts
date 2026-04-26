import { useQuery } from '@tanstack/react-query'
import { fetchPositions } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Position } from '../api/openf1'
import { queryModePolicy } from './queryModePolicy'
import { readSessionData, writeSessionData, isSessionDataComplete } from '../lib/f1PersistentStore'

// Returns latest position per driver (deduplicated + sorted by position)
export function usePositions() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['positions', sessionKey],
    queryFn: async () => {
      const key = sessionKey!

      // Positions are stored already deduplicated, so a stored hit is ready to return directly
      const complete = await isSessionDataComplete('positions', key)
      if (complete) {
        const stored = await readSessionData<OpenF1Position>('positions', key)
        if (stored.length > 0) return stored.sort((a, b) => a.position - b.position)
      }

      const all = await fetchPositions(key, apiKey)
      const map = new Map<number, OpenF1Position>()
      for (const p of all) {
        const existing = map.get(p.driver_number)
        if (!existing || p.date > existing.date) map.set(p.driver_number, p)
      }
      const deduplicated = Array.from(map.values()).sort((a, b) => a.position - b.position)

      // Store the deduplicated result — positions table PK is (session_key, driver_number)
      void writeSessionData('positions', key, deduplicated, mode === 'historical')

      return deduplicated
    },
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 3_000,
      refetchInterval: 5_000,
    }),
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })
}

// Returns position for a specific driver
export function useDriverPosition(driverNumber: number | null) {
  const { data: positions } = usePositions()
  if (!driverNumber || !positions) return null
  return positions.find((p) => p.driver_number === driverNumber) ?? null
}
