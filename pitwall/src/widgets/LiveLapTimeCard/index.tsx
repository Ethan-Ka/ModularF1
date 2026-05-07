export const HELP = `# Lap Time Card

Shows a live running lap timer for the selected driver's current lap.

- **Elapsed time**: Time ticking up from the start of the current lap (live mode only).
- **Prior lap**: Last completed lap time for reference.
- **PB**: Personal best lap time for this session.
- **Delta to PB**: How the current lap is tracking against the personal best.

Unfamiliar terms:

- *PB*: Personal Best — the fastest lap the driver has set this session.
- *Delta*: Seconds faster (negative) or slower (positive) than the reference time.

Notes: the running timer only appears in live mode. In historical mode the widget falls back to showing the last completed lap. Timer precision depends on when the lap start timestamp was received — early laps may show a brief delay.
`
import { useEffect, useMemo, useState } from 'react'
import { useLaps } from '../../hooks/useLaps'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { formatLap, formatDelta, EmptyState } from '../widgetUtils'
import type { UnitMode } from '../widgetUtils'

interface LiveLapTimeCardProps {
  widgetId: string
}

type LiveLapStartPayload = {
  driverNumber: number
  lapNumber?: number
  startTimeIso?: string
  startTimeMs?: number
}

export function LiveLapTimeCard({ widgetId }: LiveLapTimeCardProps) {
  const config = useWidgetConfig(widgetId)
  const units: UnitMode = (config?.settings?.units as UnitMode) ?? 's'
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  // live mode gate: historical mode never shows a running timer even with a known active lap
  const mode = useSessionStore((s) => s.mode)
  const { data: laps } = useLaps(driverNumber ?? undefined, {
    refetchIntervalMs: mode === 'live' ? 60_000 : 15_000,
  })
  const refreshFade = useRefreshFade([driverNumber, laps])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [webhookLapStartMs, setWebhookLapStartMs] = useState<number | null>(null)

  const allLaps = useMemo(
    () => [...(laps ?? [])].sort((a, b) => b.lap_number - a.lap_number),
    [laps]
  )
  const timedLaps = allLaps.filter((lap) => lap.lap_duration != null)
  const activeLap = allLaps[0]

  const activeLapStartFromApiMs =
    activeLap?.date_start != null
      ? (() => {
          const t = Date.parse(activeLap.date_start)
          return Number.isFinite(t) ? t : null
        })()
      : null

  const resolvedLiveLapStartMs =
    webhookLapStartMs != null ? webhookLapStartMs : activeLapStartFromApiMs

  const liveLapElapsedMs =
    resolvedLiveLapStartMs != null ? nowMs - resolvedLiveLapStartMs : null
  const MAX_LIVE_LAP_MS = 10 * 60 * 1000

  const isLiveLapRunning =
    mode === 'live' &&
    activeLap != null &&
    activeLap.lap_number > 0 &&
    activeLap.lap_duration == null &&
    liveLapElapsedMs != null &&
    liveLapElapsedMs >= 0 &&
    liveLapElapsedMs <= MAX_LIVE_LAP_MS

  useEffect(() => {
    setWebhookLapStartMs(null)
  }, [driverNumber])

  useEffect(() => {
    function onWebhookLapStart(event: Event) {
      const customEvent = event as CustomEvent<LiveLapStartPayload>
      const payload = customEvent.detail
      if (!payload || payload.driverNumber !== driverNumber) return

      const startFromMs =
        typeof payload.startTimeMs === 'number' && Number.isFinite(payload.startTimeMs)
          ? payload.startTimeMs
          : payload.startTimeIso
            ? Date.parse(payload.startTimeIso)
            : Number.NaN

      if (!Number.isFinite(startFromMs)) return
      setWebhookLapStartMs(startFromMs)
    }

    window.addEventListener('pitwall-live-lap-start', onWebhookLapStart as EventListener)
    return () => {
      window.removeEventListener('pitwall-live-lap-start', onWebhookLapStart as EventListener)
    }
  }, [driverNumber])

  useEffect(() => {
    if (!isLiveLapRunning) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [isLiveLapRunning])

  if (!driverNumber) {
    return <EmptyState message="No driver selected" subMessage="Assign a driver context in widget settings." />
  }

  const driver = getDriver(driverNumber)
  const teamColor = getTeamColor(driverNumber)

  const showZeroLap = mode === 'live' && timedLaps.length === 0 && !isLiveLapRunning

  if (timedLaps.length === 0 && !isLiveLapRunning && !showZeroLap) {
    return <EmptyState message="No lap timings yet" subMessage="Waiting for a completed lap." />
  }

  const liveLapDurationSeconds = isLiveLapRunning
    ? Math.max(0, liveLapElapsedMs! / 1000)
    : null

  const latestLap = timedLaps[0] ?? null
  const bestLap =
    timedLaps.length > 0
      ? timedLaps.reduce((best, lap) => {
          if (lap.lap_duration == null) return best
          if (!best || (best.lap_duration != null && lap.lap_duration < best.lap_duration)) return lap
          return best
        }, timedLaps[0])
      : null

  const lastLap = latestLap?.lap_duration ?? null
  const pbLap = bestLap?.lap_duration ?? null
  const deltaToPb = lastLap != null && pbLap != null ? lastLap - pbLap : null
  const isLapPb = lastLap != null && pbLap != null && Math.abs(lastLap - pbLap) < 0.0005

  const headerLabel = isLiveLapRunning
    ? `Live lap (L${activeLap!.lap_number})`
    : showZeroLap
      ? 'Waiting for start'
      : latestLap
        ? `Last lap (L${latestLap.lap_number})`
        : 'Lap time'

  const heroValue = isLiveLapRunning ? liveLapDurationSeconds : showZeroLap ? 0 : lastLap
  const heroColor = isLiveLapRunning ? teamColor : isLapPb ? 'var(--green)' : 'var(--white)'

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 3,
              height: 22,
              borderRadius: 2,
              background: teamColor,
              boxShadow: `0 0 8px ${teamColor}66`,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
              }}
            >
              Lap time
            </span>
            <span
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 16,
                lineHeight: 1,
                fontWeight: 700,
                color: 'var(--white)',
              }}
            >
              {driver?.name_acronym ?? `#${driverNumber}`}
            </span>
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          {badgeLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
            }}
          >
            {headerLabel}
          </span>
          {isLiveLapRunning && latestLap && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 16,
                fontFamily: 'var(--cond)',
                fontSize: 23,
                lineHeight: 1,
                fontWeight: 700,
                color: 'var(--muted2)',
                opacity: 0.32,
                pointerEvents: 'none',
              }}
            >
              {formatLap(lastLap, units)}
            </span>
          )}
          {isLiveLapRunning && latestLap && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
              }}
            >
              Last lap (L{latestLap.lap_number})
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--cond)',
              fontSize: isLiveLapRunning ? 38 : 30,
              lineHeight: 0.95,
              fontWeight: 700,
              color: heroColor,
              textShadow: isLiveLapRunning ? `0 0 10px ${teamColor}44` : undefined,
            }}
          >
            {formatLap(heroValue, units)}
          </span>
        </div>

        {!isLiveLapRunning && latestLap && (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                marginBottom: 2,
              }}
            >
              Delta to PB
            </div>
            <div
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1,
                color: isLapPb
                  ? 'var(--green)'
                  : deltaToPb != null && deltaToPb > 0
                    ? 'var(--amber)'
                    : 'var(--white)',
              }}
            >
              {isLapPb ? 'PB' : formatDelta(deltaToPb, units)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
