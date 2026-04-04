import { useQuery } from '@tanstack/react-query'
import { fetchPositions } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import type { OpenF1Position } from '../api/openf1'

// Returns latest position per driver
export function usePositions() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)

  return useQuery({
    queryKey: ['positions', sessionKey],
    queryFn: async () => {
      const all = await fetchPositions(sessionKey!, apiKey)
      // Deduplicate: keep latest position per driver
      const map = new Map<number, OpenF1Position>()
      for (const p of all) {
        const existing = map.get(p.driver_number)
        if (!existing || p.date > existing.date) map.set(p.driver_number, p)
      }
      return Array.from(map.values()).sort((a, b) => a.position - b.position)
    },
    enabled: !!sessionKey,
    staleTime: 3_000,
    refetchInterval: mode === 'live' ? 3_000 : false,
  })
}

// Returns position for a specific driver
export function useDriverPosition(driverNumber: number | null) {
  const { data: positions } = usePositions()
  if (!driverNumber || !positions) return null
  return positions.find((p) => p.driver_number === driverNumber) ?? null
}
