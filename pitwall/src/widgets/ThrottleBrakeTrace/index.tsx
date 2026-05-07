export const HELP = `# Throttle / Brake Trace

Dual-line chart of pedal inputs over time for the selected driver — useful for understanding driving style and corner technique.

- **Throttle trace** (green): Throttle application as a percentage (0–100%) across recent samples.
- **Brake trace** (red): Brake pressure as a percentage (0–100%) across recent samples.
- **X axis**: Chronological sample index (left = oldest, right = most recent).

Unfamiliar terms:

- *Trace*: A time-series line showing how a value changes sample-by-sample.
- *Trail braking*: A driving technique where the driver gradually releases the brakes while turning — visible as overlapping brake and throttle on the chart.

Notes: in live mode a rolling buffer of recent samples is displayed. In historical mode the full telemetry of the last completed lap is shown via the FastF1 sidecar. The trace resets when a new lap begins.
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
const MAX_HIST_POINTS = 120
// Fixed viewBox dimensions — X axis maps 0–100, Y axis maps 0–100
const VB_W = 100
const VB_H = 100

interface TraceSample {
  throttle: number // 0–100
  brake: number    // 0–100
}

/**
 * Compute SVG polyline points string for a single channel.
 * Y = (100 - value) so that 100% appears at the top of the viewBox.
 * vectorEffect="non-scaling-stroke" on the polyline prevents stroke distortion
 * when the viewBox is stretched via preserveAspectRatio="none".
 */
function buildPoints(samples: TraceSample[], channel: 'throttle' | 'brake'): string {
  const n = samples.length
  if (n === 0) return ''
  if (n === 1) {
    const y = VB_H - samples[0][channel]
    return `0,${y}`
  }
  return samples
    .map((s, i) => {
      const x = (i / (n - 1)) * VB_W
      const y = VB_H - s[channel]
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

/** Downsample by stride so the last point of the lap is always represented. */
function downsample(arr: TraceSample[], max: number): TraceSample[] {
  if (arr.length <= max) return arr
  const stride = Math.ceil(arr.length / max)
  return arr.filter((_, i) => i % stride === 0)
}

export function ThrottleBrakeTrace({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const mode = useSessionStore((s) => s.mode)
  const activeFastF1Session = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const driverAcronym = driver?.name_acronym

  // --- Live path ---
  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)
  const refreshFade = useRefreshFade([liveData])

  const history = useRollingHistory(
    mode === 'live' ? liveData : null,
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

  // Build the sample array for whichever mode is active
  const samples = useMemo((): TraceSample[] => {
    if (isHistorical) {
      if (!telemetry?.length) return []
      const raw = telemetry.map((t) => ({
        throttle: t.Throttle,
        brake: t.Brake ? 100 : 0,
      }))
      return downsample(raw, MAX_HIST_POINTS)
    }
    return history.map((d) => ({ throttle: d.throttle, brake: d.brake }))
  }, [isHistorical, history, telemetry])

  const throttlePoints = useMemo(() => buildPoints(samples, 'throttle'), [samples])
  const brakePoints = useMemo(() => buildPoints(samples, 'brake'), [samples])

  // --- Empty states ---
  if (!driverNumber) {
    return <EmptyState message="No driver selected" />
  }

  if (!samples.length) {
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

      {/* Chart label */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
        color: 'var(--muted2)', textTransform: 'uppercase',
      }}>
        THROTTLE / BRAKE TRACE
      </div>

      {/* SVG chart — fills remaining height */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Y-axis grid lines at 25%, 50%, 75% */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          {/* Background grid lines */}
          {[25, 50, 75].map((pct) => (
            <line
              key={pct}
              x1={0}
              y1={VB_H - pct}
              x2={VB_W}
              y2={VB_H - pct}
              stroke="var(--border)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Zero baseline */}
          <line
            x1={0} y1={VB_H}
            x2={VB_W} y2={VB_H}
            stroke="var(--border)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Throttle trace */}
          {throttlePoints && (
            <polyline
              points={throttlePoints}
              fill="none"
              stroke="var(--green)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Brake trace */}
          {brakePoints && (
            <polyline
              points={brakePoints}
              fill="none"
              stroke="var(--red)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Y-axis labels (positioned absolutely over the SVG) */}
        <span style={{
          position: 'absolute', top: 0, left: 0,
          fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)',
          lineHeight: 1, pointerEvents: 'none',
        }}>
          100
        </span>
        <span style={{
          position: 'absolute', bottom: 0, left: 0,
          fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)',
          lineHeight: 1, pointerEvents: 'none',
        }}>
          0
        </span>
      </div>

      {/* Legend + sample count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 1, background: 'var(--green)' }} />
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em',
            }}>
              THR
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 1, background: 'var(--red)' }} />
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em',
            }}>
              BRK
            </span>
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em',
        }}>
          {isHistorical
            ? `${samples.length} pts`
            : `${history.length}/${MAX_SAMPLES} samples`}
        </span>
      </div>
    </div>
  )
}
