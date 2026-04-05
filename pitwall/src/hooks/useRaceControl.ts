import { useQuery } from '@tanstack/react-query'
import { fetchRaceControl } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'
import { useAmbientStore } from '../store/ambientStore'
import { useEffect, useRef } from 'react'
import type { FlagState } from '../store/ambientStore'
import { queryModePolicy } from './queryModePolicy'

function mapFlagToState(flag: string | null, message: string): FlagState | null {
  const msg = message.toUpperCase()
  if (msg.includes('NATIONAL ANTHEM')) return 'NATIONAL_ANTHEM'
  if (
    msg.includes('START PROCEDURE') ||
    msg.includes('FORMATION LAP') ||
    msg.includes('RACE START') ||
    msg.includes('WILL START')
  ) {
    return 'WAITING_FOR_START'
  }
  if (msg.includes('FASTEST LAP')) return 'FASTEST_LAP'

  if (!flag) return null
  const f = flag.toUpperCase()
  if (f === 'RED') return 'RED'
  if (f === 'YELLOW' || f === 'DOUBLE YELLOW') return 'YELLOW'
  if (f === 'GREEN') return 'GREEN'
  if (f === 'CHEQUERED') return 'CHECKERED'
  if (f === 'SC DEPLOYED' || message.includes('SAFETY CAR DEPLOYED')) return 'SAFETY_CAR'
  if (f === 'VSC DEPLOYED' || message.includes('VIRTUAL SAFETY CAR DEPLOYED')) return 'VIRTUAL_SC'
  if (f === 'SC ENDING' || f === 'VSC ENDING') return 'GREEN'
  return null
}

export function useRaceControl() {
  const apiKey = useSessionStore((s) => s.apiKey) ?? undefined
  const sessionKey = useSessionStore((s) => s.activeSession?.session_key)
  const mode = useSessionStore((s) => s.mode)
  const setFlagState = useAmbientStore((s) => s.setFlagState)
  const lastProcessedRef = useRef<string>('')

  const query = useQuery({
    queryKey: ['race_control', sessionKey],
    queryFn: () => fetchRaceControl(sessionKey!, apiKey),
    enabled: !!sessionKey,
    ...queryModePolicy(mode, {
      staleTime: 10_000,
      refetchInterval: 10_000,
    }),
    retry: (failureCount, error) => (error as any)?.status !== 429 && failureCount < 2,
  })

  useEffect(() => {
    if (!query.data || query.data.length === 0) return
    const latest = query.data[query.data.length - 1]
    const key = `${latest.date}-${latest.message}`
    if (key === lastProcessedRef.current) return
    lastProcessedRef.current = key

    const state = mapFlagToState(latest.flag, latest.message)
    if (state) setFlagState(state, latest.message)
  }, [query.data, setFlagState])

  return query
}
