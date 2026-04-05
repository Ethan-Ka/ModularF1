import type { AppMode } from '../store/sessionStore'

interface LiveQueryPolicy {
  staleTime: number
  refetchInterval: number | false
}

/**
 * Historical mode should behave like a one-time snapshot fetch:
 * no background refetching and effectively permanent cache.
 */
export function queryModePolicy(
  mode: AppMode,
  live: LiveQueryPolicy,
  options?: { historicalStaleTime?: number }
) {
  if (mode === 'historical') {
    return {
      staleTime: options?.historicalStaleTime ?? Infinity,
      gcTime: Infinity,
      refetchInterval: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    } as const
  }

  return {
    staleTime: live.staleTime,
    refetchInterval: mode === 'live' ? live.refetchInterval : false,
  } as const
}
