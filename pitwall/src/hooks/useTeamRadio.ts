import { useQuery } from '@tanstack/react-query'
import { fetchLiveTeamRadio } from '../api/liveTimingBridge'
import { useSessionStore } from '../store/sessionStore'

// Team radio is live-only, sourced from the F1 timing SignalR feed via the
// Python bridge. Requires live mode + F1TV authentication + sidecar running.
export function useTeamRadio(driverNumber?: number) {
  const mode = useSessionStore((s) => s.mode)
  const f1tvAuthenticated = useSessionStore((s) => s.f1tvAuthenticated)
  const fastf1ServerAvailable = useSessionStore((s) => s.fastf1ServerAvailable)

  const enabled = mode === 'live' && f1tvAuthenticated && fastf1ServerAvailable

  return useQuery({
    queryKey: ['live_team_radio', driverNumber ?? null],
    queryFn: () => fetchLiveTeamRadio(driverNumber),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 10_000 : false,
    refetchOnWindowFocus: false,
    retry: (failureCount) => failureCount < 2,
  })
}
