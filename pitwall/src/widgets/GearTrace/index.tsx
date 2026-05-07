export const HELP = `# Gear Trace

Step-function chart of gear selection over time for the selected driver.

- **Y axis**: Gear number — 0 = neutral, 1–8 = forward gears.
- **X axis**: Sample index (left = oldest, right = most recent).
- **Step shape**: Gear changes appear as vertical jumps, revealing upshift/downshift patterns.

Unfamiliar terms:

- *Step function*: A line that changes only in discrete vertical jumps, matching the discrete nature of gear changes.
- *Upshift / Downshift*: Moving to a higher or lower gear. High upshift density = approaching the rev limiter. Heavy downshifting = approaching a braking zone.

Notes: in live mode samples are derived from FastF1 timing telemetry. In historical mode the last completed lap is shown via the FastF1 sidecar. Gear 0 (neutral) briefly appears during pit stops and at race start.
`
import { useMemo } from 'react'
import { useCarData } from '../../hooks/useCarData'
import { useFastF1Telemetry, useFastF1Laps } from '../../hooks/useFastF1'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { EmptyState, useRollingHistory } from '../widgetUtils'

const MAX_SAMPLES = 60
const GEAR_MIN = 0
const GEAR_MAX = 8
const CHART_H = 80  // SVG viewBox height in px units
const CHART_W = 400 // SVG viewBox width (arbitrary; scales via preserveAspectRatio)

const GEAR_LABELS = ['N', '1', '2', '3', '4', '5', '6', '7', '8']

/** Map a gear value (0–8) to a Y coordinate: gear 8 at top (y=0), gear 0 at bottom (y=CHART_H) */
function gearToY(gear: number): number {
  return ((GEAR_MAX - gear) / GEAR_MAX) * CHART_H
}

/** Build an SVG step-function path string from an array of gear values */
function buildStepPath(gears: number[], W: number, H: number): string {
  if (gears.length === 0) return ''
  if (gears.length === 1) {
    const y = gearToY(gears[0])
    return `M 0,${y} H ${W}`
  }

  const step = W / (gears.length - 1)
  let d = `M 0,${gearToY(gears[0])}`

  for (let i = 1; i < gears.length; i++) {
    const x = i * step
    const y = gearToY(gears[i])
    // Horizontal to current x, then vertical to current y (step function)
    d += ` H ${x} V ${y}`
  }

  return d
}

interface GearSample {
  gear: number
  date: string
}

export function GearTrace({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const mode = useSessionStore((s) => s.mode)
  const activeFastF1Session = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const driverAcronym = driver?.name_acronym
  const teamColor = driverNumber != null ? getTeamColor(driverNumber) : 'var(--purple)'

  // --- Live path ---
  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)
  const refreshFade = useRefreshFade([liveData])

  // Adapt live data to rolling sample shape
  const liveSample = useMemo((): GearSample | null => {
    if (!liveData) return null
    return { gear: liveData.n_gear, date: liveData.date }
  }, [liveData])

  const history = useRollingHistory(
    mode === 'live' ? liveSample : null,
    MAX_SAMPLES,
    (s) => s.date,
  )

  // --- Historical path ---
  const histEnabled = mode === 'hub' && fastf1Available && !!activeFastF1Session && !!driverAcronym
  const { data: laps } = useFastF1Laps(histEnabled ? activeFastF1Session : null, driverAcronym)

  const lastLapNumber = useMemo(() => {
    if (!laps?.length) return undefined
    const completed = laps.filter((l) => l.LapTime != null)
    return completed.length > 0 ? Math.max(...completed.map((l) => l.LapNumber)) : undefined
  }, [laps])

  const { data: telemetry } = useFastF1Telemetry(
    histEnabled && lastLapNumber != null ? activeFastF1Session : null,
    driverAcronym,
    lastLapNumber,
  )

  const isHistorical = mode === 'hub'

  // Resolve the gear sequence to render
  const gears = useMemo((): number[] => {
    if (isHistorical) {
      if (!telemetry?.length) return []
      return telemetry.map((t) => t.nGear)
    }
    return history.map((s) => s.gear)
  }, [isHistorical, history, telemetry])

  // Current gear: last sample
  const currentGear = gears.length > 0 ? gears[gears.length - 1] : null

  // Step path string — recomputed only when gear sequence changes
  const stepPath = useMemo(
    () => buildStepPath(gears, CHART_W, CHART_H),
    [gears],
  )

  // Y-axis label positions for gears 1–8 (skip N on y-axis to avoid clutter)
  const yAxisLabels = useMemo(() => {
    return [8, 7, 6, 5, 4, 3, 2, 1].map((g) => ({
      gear: g,
      y: gearToY(g),
      label: String(g),
    }))
  }, [])

  // --- Guards ---
  if (!driverNumber) {
    return <EmptyState message="No driver selected" />
  }

  if (!gears.length) {
    const subMsg = isHistorical && !fastf1Available
      ? 'Requires FastF1 sidecar'
      : isHistorical && !activeFastF1Session
        ? 'Requires a live FastF1 session'
        : undefined
    return (
      <EmptyState
        message={isHistorical ? 'No telemetry available' : 'Waiting for telemetry…'}
        subMessage={subMsg}
      />
    )
  }

  const gearDisplay = currentGear === 0 ? 'N' : currentGear != null ? String(currentGear) : '—'

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
            color: 'var(--white)', fontWeight: 600,
          }}>
            {driverAcronym ?? '—'}
          </span>
          {isHistorical && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.12em',
              color: 'var(--amber)', background: 'rgba(224,144,0,0.12)',
              border: '0.5px solid rgba(224,144,0,0.3)', borderRadius: 2, padding: '1px 4px',
            }}>
              HIST
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.1em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Hero: current gear + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--cond)', fontSize: 44, fontWeight: 800, lineHeight: 0.9,
            color: teamColor, letterSpacing: '-0.02em',
          }}>
            {gearDisplay}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
            letterSpacing: '0.14em', marginTop: 3,
          }}>
            GEAR
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />

        {/* Widget label */}
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Gear Trace
        </span>
      </div>

      {/* SVG step chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        {/* Y-axis labels */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 12,
          flexShrink: 0,
          paddingTop: 0,
          paddingBottom: 0,
        }}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((g) => (
            <span key={g} style={{
              fontFamily: 'var(--mono)',
              fontSize: 6,
              color: 'var(--muted2)',
              lineHeight: 1,
              textAlign: 'right',
              userSelect: 'none',
            }}>
              {g}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          >
            {/* Horizontal grid lines for each gear */}
            {yAxisLabels.map(({ gear, y }) => (
              <line
                key={gear}
                x1={0}
                y1={y}
                x2={CHART_W}
                y2={y}
                stroke="var(--border)"
                strokeWidth={0.5}
                strokeDasharray="4 4"
              />
            ))}

            {/* Step-function path */}
            {stepPath && (
              <path
                d={stepPath}
                fill="none"
                stroke={teamColor}
                strokeWidth={1.5}
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
            )}

            {/* Latest-sample dot */}
            {gears.length > 0 && (() => {
              const lastX = gears.length === 1 ? 0 : CHART_W
              const lastY = gearToY(gears[gears.length - 1])
              return (
                <circle
                  cx={lastX}
                  cy={lastY}
                  r={2.5}
                  fill={teamColor}
                  opacity={0.9}
                />
              )
            })()}
          </svg>
        </div>
      </div>

      {/* Sample count footer */}
      {!isHistorical && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.06em',
        }}>
          {gears.length}/{MAX_SAMPLES} samples
        </div>
      )}
    </div>
  )
}
