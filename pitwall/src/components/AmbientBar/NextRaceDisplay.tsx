import { useEffect, useReducer } from 'react'
import { useNextRace } from '../../hooks/useNextRace'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days}D ${hours}H`
  if (hours > 0) return `${hours}H ${minutes}M`
  return `${minutes}M`
}

export function NextRaceDisplay({ year = new Date().getFullYear() }: { year?: number }) {
  const { session: nextRace, proximity, msToStart } = useNextRace(year)
  const [, tick] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!nextRace || proximity === 'live' || proximity === 'none') return null

  const circuit = nextRace.circuit_short_name ?? nextRace.country_name ?? ''
  const countdown = formatCountdown(msToStart)
  const isImminent = proximity === 'imminent' || proximity === 'today'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexShrink: 0,
        opacity: isImminent ? 0.95 : 0.65,
        transition: 'opacity 1.2s ease',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
        }}
      >
        NEXT
      </span>
      <span
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--white)',
          letterSpacing: '0.03em',
          lineHeight: 1,
        }}
      >
        {circuit.toUpperCase()}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          letterSpacing: '0.08em',
          color: isImminent ? 'var(--white)' : 'var(--muted)',
          opacity: 0.75,
        }}
      >
        {countdown}
      </span>
    </div>
  )
}
