import { useMemo } from 'react'
import { useLaps } from '../../hooks/useLaps'
import { useStints } from '../../hooks/useStints'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useDegInference } from '../../hooks/useDegInference'
import { formatTime, EmptyState } from '../widgetUtils'

// ---------- linear regression ----------
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length
  if (n < 2) return null
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
} 

export const HELP = `# Deg Rate Graph

Plots tyre degradation for the current stint of the selected driver.

- **X axis**: Tyre age in laps (since the start of the stint).
- **Y axis**: Lap time delta vs. the first lap of the stint (in seconds).
- **Trend line**: Linear regression showing average degradation per lap.
- **Stats**: First/last lap times, average deg/lap.

**Usage:**
- Select a driver to view their current stint.
- At least 2 laps are required in the stint to show the graph.

**Notes:**
- Only the current stint is shown (latest for the driver).
- Degradation is calculated as the increase in lap time relative to the first lap of the stint.
- Useful for comparing tyre wear rates and stint management.
`

// ---------- compound badge colour ----------
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'var(--red)',
  MEDIUM: '#f0c040',
  HARD: 'var(--white)',
  INTERMEDIATE: 'var(--green)',
  WET: 'var(--blue)',
}

function compoundColor(compound: string): string {
  return COMPOUND_COLORS[compound.toUpperCase()] ?? 'var(--muted2)'
}

// ---------- SVG chart constants ----------
const VIEW_W = 200
const VIEW_H = 80
const X_MIN = 10   // px left margin
const X_MAX = 190  // px right margin
const Y_TOP = 10   // px top  — fast (delta 0)
const Y_BOT = 70   // px bottom — slow (delta 3 s)
const DELTA_RANGE = 3 // seconds shown in full Y range

function mapX(age: number, minAge: number, maxAge: number): number {
  if (maxAge === minAge) return (X_MIN + X_MAX) / 2
  return X_MIN + ((age - minAge) / (maxAge - minAge)) * (X_MAX - X_MIN)
}

function mapY(delta: number): number {
  const clamped = Math.max(0, Math.min(DELTA_RANGE, delta))
  return Y_TOP + (clamped / DELTA_RANGE) * (Y_BOT - Y_TOP)
}

// ---------- sub-components ----------
function CompoundBadge({ compound }: { compound: string }) {
  const color = compoundColor(compound)
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 6,
        letterSpacing: '0.1em',
        color,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        border: `0.5px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: 2,
        padding: '1px 4px',
      }}
    >
      {compound.toUpperCase()}
    </span>
  )
}

function StintBadge({ stintNumber }: { stintNumber: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 6,
        letterSpacing: '0.1em',
        color: 'var(--muted2)',
        background: 'var(--bg4)',
        border: '0.5px solid var(--border)',
        borderRadius: 2,
        padding: '1px 4px',
      }}
    >
      S{stintNumber}
    </span>
  )
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: valueColor ?? 'var(--white)', letterSpacing: '0.05em' }}>
        {value}
      </span>
    </div>
  )
}

// ---------- main widget ----------
export function DegRateGraph({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const driverAcronym = driver?.name_acronym
  const teamColor = driverNumber != null ? getTeamColor(driverNumber) : 'var(--purple)'

  const { data: stints } = useStints(driverNumber ?? undefined)
  const { data: laps } = useLaps(driverNumber ?? undefined)
  const deg = useDegInference(driverNumber ?? undefined)

  const refreshFade = useRefreshFade([laps, stints])

  // ---------- derive current stint ----------
  const currentStint = useMemo(() => {
    if (!stints?.length) return null
    return [...stints].sort((a, b) => b.stint_number - a.stint_number)[0]
  }, [stints])

  // ---------- filter laps for this stint ----------
  const stintLaps = useMemo(() => {
    if (!currentStint || !laps?.length) return []
    const endLap = currentStint.lap_end ?? Number.POSITIVE_INFINITY
    return laps
      .filter(
        (lap) =>
          lap.lap_number >= currentStint.lap_start &&
          lap.lap_number <= endLap &&
          lap.lap_duration != null &&
          Number.isFinite(lap.lap_duration) &&
          lap.lap_duration > 0 &&
          !lap.is_pit_out_lap
      )
      .sort((a, b) => a.lap_number - b.lap_number)
  }, [currentStint, laps])

  // ---------- build chart points ----------
  interface ChartPoint {
    age: number
    pace: number
    delta: number
  }

  const chartPoints = useMemo((): ChartPoint[] => {
    if (!currentStint || stintLaps.length === 0) return []
    const firstPace = stintLaps[0].lap_duration!
    return stintLaps.map((lap) => {
      const age = Math.max(1, currentStint.tyre_age_at_start + (lap.lap_number - currentStint.lap_start) + 1)
      const pace = lap.lap_duration!
      return { age, pace, delta: pace - firstPace }
    })
  }, [currentStint, stintLaps])

  // ---------- SVG coordinates ----------
  const minAge = chartPoints.length > 0 ? chartPoints[0].age : 1
  const maxAge = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].age : 1

  const svgPoints = useMemo(
    () => chartPoints.map((p) => ({ x: mapX(p.age, minAge, maxAge), y: mapY(p.delta), age: p.age, pace: p.pace })),
    [chartPoints, minAge, maxAge]
  )

  const polylinePoints = svgPoints.map((p) => `${p.x},${p.y}`).join(' ')

  // Trend line
  const regression = useMemo(
    () => linearRegression(svgPoints.map((p) => ({ x: p.x, y: p.y }))),
    [svgPoints]
  )
  const trendLine = useMemo(() => {
    if (!regression) return null
    const x1 = X_MIN
    const x2 = X_MAX
    const y1 = regression.slope * x1 + regression.intercept
    const y2 = regression.slope * x2 + regression.intercept
    return { x1, y1: Math.max(Y_TOP - 2, Math.min(Y_BOT + 2, y1)), x2, y2: Math.max(Y_TOP - 2, Math.min(Y_BOT + 2, y2)) }
  }, [regression])

  // ---------- stats ----------
  const firstLapTime = chartPoints.length > 0 ? chartPoints[0].pace : null
  const lastLapTime = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].pace : null

  // Use shared inference engine for deg/lap so all widgets stay consistent
  const degPerLap = deg.degPerLap

  // ---------- X axis tick ages ----------
  const tickAges = useMemo(() => {
    if (chartPoints.length === 0) return []
    const ages = chartPoints.map((p) => p.age)
    // Show every age tick if ≤ 10 laps, else sample to avoid clutter
    if (ages.length <= 10) return ages
    const step = Math.ceil(ages.length / 10)
    return ages.filter((_, i) => i % step === 0 || i === ages.length - 1)
  }, [chartPoints])

  // ---------- Y axis labels (min and max pace) ----------
  const minPace = firstLapTime  // delta = 0, fastest reference
  const maxPace = lastLapTime   // delta = last - first (may not be true max but representative)

  // ---------- empty state ladder ----------
  if (!driverNumber) {
    return <EmptyState message="No driver selected" />
  }
  if (!currentStint) {
    return <EmptyState message="No stint data" />
  }
  if (chartPoints.length < 2) {
    return <EmptyState message="Need 2+ laps in current stint" />
  }

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 8,
        boxSizing: 'border-box',
        gap: 6,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Team colour bar */}
          <div style={{ width: 2, height: 12, borderRadius: 1, background: teamColor, flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--white)',
            fontWeight: 600,
          }}>
            {driverAcronym ?? '—'}
          </span>
          <CompoundBadge compound={currentStint.compound} />
          <StintBadge stintNumber={currentStint.stint_number} />
        </div>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.1em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* SVG chart — grows to fill available height */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Y axis labels pinned at top and bottom left */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          fontFamily: 'var(--mono)',
          fontSize: 5,
          color: 'var(--muted2)',
          letterSpacing: '0.05em',
          lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {formatTime(minPace)}
        </div>
        {maxPace !== minPace && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            fontFamily: 'var(--mono)',
            fontSize: 5,
            color: 'var(--muted2)',
            letterSpacing: '0.05em',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {formatTime(maxPace)}
          </div>
        )}

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Horizontal reference line at delta = 0 (first lap baseline) */}
          <line
            x1={X_MIN} y1={Y_TOP} x2={X_MAX} y2={Y_TOP}
            stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 2"
          />

          {/* Trend line (linear regression) */}
          {trendLine && (
            <line
              x1={trendLine.x1} y1={trendLine.y1}
              x2={trendLine.x2} y2={trendLine.y2}
              stroke="var(--muted2)"
              strokeWidth={0.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Connecting line through data points */}
          {svgPoints.length > 1 && (
            <polyline
              points={polylinePoints}
              stroke={teamColor}
              strokeWidth={1}
              fill="none"
              strokeLinejoin="round"
              opacity={0.85}
            />
          )}

          {/* Data point circles */}
          {svgPoints.map((p) => (
            <circle
              key={p.age}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill={teamColor}
            />
          ))}

          {/* X axis tick marks and labels */}
          {tickAges.map((age) => {
            const x = mapX(age, minAge, maxAge)
            return (
              <g key={age}>
                <line
                  x1={x} y1={Y_BOT + 1}
                  x2={x} y2={Y_BOT + 3}
                  stroke="var(--border)"
                  strokeWidth={0.5}
                />
                <text
                  x={x}
                  y={Y_BOT + 7}
                  textAnchor="middle"
                  fontSize={4}
                  fontFamily="var(--mono)"
                  fill="var(--muted2)"
                >
                  {age}
                </text>
              </g>
            )
          })}

          {/* X axis label */}
          <text
            x={(X_MIN + X_MAX) / 2}
            y={VIEW_H - 1}
            textAnchor="middle"
            fontSize={3.5}
            fontFamily="var(--mono)"
            fill="var(--muted2)"
            letterSpacing="0.1"
          >
            TYRE AGE (LAPS)
          </text>
        </svg>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexShrink: 0,
        paddingTop: 4,
        borderTop: '0.5px solid var(--border)',
      }}>
        <StatCell label="FIRST LAP" value={formatTime(firstLapTime)} />
        <StatCell label="LAST LAP" value={formatTime(lastLapTime)} />
        <StatCell
          label="DEG/LAP"
          value={degPerLap == null
            ? '—'
            : degPerLap > 0
              ? `+${degPerLap.toFixed(3)}s`
              : degPerLap < 0
                ? `${degPerLap.toFixed(3)}s`
                : '0.000s'
          }
          valueColor={degPerLap != null && degPerLap > 0 ? 'var(--amber)' : undefined}
        />
        <StatCell
          label="TEMP ×"
          value={`${deg.tempMultiplier.toFixed(2)}×`}
          valueColor={deg.tempMultiplier > 1.1 ? 'var(--amber)' : 'var(--muted2)'}
        />
        <StatCell
          label="LOAD"
          value={`${deg.paceIntensity.toFixed(2)}×`}
          valueColor={deg.paceIntensity > 1.2 ? 'var(--red)' : deg.paceIntensity > 0.9 ? 'var(--amber)' : 'var(--green)'}
        />
      </div>
    </div>
  )
}
