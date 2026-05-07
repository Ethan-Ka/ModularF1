import { useMemo, useEffect, useRef } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { useAmbientStore } from '../store/ambientStore'
import type { FlagState } from '../store/ambientStore'
import type { OpenF1RaceControl } from '../api/openf1'
import type { FastF1RaceControlMessage } from '../api/fastf1Bridge'
import { useFastF1RaceControl } from './useFastF1'

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

function normalizeFastF1(msg: FastF1RaceControlMessage): OpenF1RaceControl {
  return {
    flag: msg.Flag ?? null,
    message: msg.Message,
    category: msg.Category,
    driver_number: msg.RacingNumber ? parseInt(msg.RacingNumber, 10) || null : null,
    date: msg.UTC ?? '',
    session_key: 0,
    scope: msg.Scope ?? undefined,
    sector: msg.Sector ?? undefined,
    lap_number: msg.Lap ?? undefined,
  }
}

export function useRaceControl() {
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)
  const activeFastF1Session = useSessionStore((s) => s.activeFastF1Session)
  const setFlagState = useAmbientStore((s) => s.setFlagState)
  const lastProcessedRef = useRef<string>('')

  const usingFastF1 = fastf1Available && !!activeFastF1Session
  const fastf1Query = useFastF1RaceControl(usingFastF1 ? activeFastF1Session : null)

  const fastf1Data = useMemo(
    () => fastf1Query.data?.map(normalizeFastF1),
    [fastf1Query.data]
  )

  const data = fastf1Data

  useEffect(() => {
    if (!data?.length) return
    const latest = data[data.length - 1]
    const key = `${latest.date}-${latest.message}`
    if (key === lastProcessedRef.current) return
    lastProcessedRef.current = key

    const state = mapFlagToState(latest.flag, latest.message)
    if (state) setFlagState(state, latest.message)
  }, [data, setFlagState])

  return {
    data,
    isLoading: fastf1Query.isLoading,
    isFetching: fastf1Query.isFetching,
    error: fastf1Query.error,
  }
}
