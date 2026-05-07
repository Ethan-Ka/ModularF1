export const HELP = `# Throttle Heatmap

Visualises average throttle application across 16 equal time-buckets spanning the lap, using colour intensity to show aggression.

- **Buckets**: The lap is divided into 16 segments (left = lap start, right = lap end).
- **Colour intensity**: Brighter green = higher average throttle; darker = lighter throttle or heavy braking zones.
- **Each bar**: Average throttle % for all samples within that segment.

Unfamiliar terms:

- *Micro-sector*: A small sub-division of a lap used for fine-grained telemetry analysis — not the same as the three official timing sectors (S1/S2/S3).
- *Throttle %*: How hard the driver is pressing the throttle pedal, expressed as a percentage of full pressure.

Notes: in live mode a rolling buffer of recent samples is bucketed. In historical mode the full last-completed-lap telemetry is used via the FastF1 sidecar. Bucket count is fixed at 16 — short laps or sparse data may show uneven coverage.
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

// Defaults (overridden by widget settings)
const DEFAULT_MAX_SAMPLES = 80
const DEFAULT_BUCKET_COUNT = 16

function computeBuckets(samples: Array<{ throttle: number }>, n: number): number[] {
  const perBucket = Math.max(1, Math.floor(samples.length / n))
  return Array.from({ length: n }, (_, i) => {
    const start = i * perBucket
    const end = i === n - 1 ? samples.length : start + perBucket
    const slice = samples.slice(start, end)
    if (!slice.length) return 0
    return slice.reduce((s, d) => s + d.throttle, 0) / slice.length
  })
}

function throttleColor(avg: number): string {
  const t = avg / 100
  return `rgba(74, 222, 128, ${Math.min(0.08 + t * 0.87, 0.95)})`
}

export function ThrottleHeatmap({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const mode = useSessionStore((s) => s.mode)
  const activeFastF1Session = useSessionStore((s) => s.activeFastF1Session)
  const fastf1Available = useSessionStore((s) => s.fastf1ServerAvailable)

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const driverAcronym = driver?.name_acronym

  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)
  const refreshFade = useRefreshFade([liveData])

  // Configurable buffer / buckets
  const maxSamples = (config?.settings?.maxSamples as number) ?? DEFAULT_MAX_SAMPLES
  const bucketCount = (config?.settings?.bucketCount as number) ?? DEFAULT_BUCKET_COUNT

  // Rolling history buffer — dedup by date string
  const history = useRollingHistory(
    mode === 'live' ? liveData : null,
    maxSamples,
    (s) => s.date,
  )

  // Historical path
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

  // Buckets: live uses rolling buffer, historical uses full telemetry lap
  const buckets = useMemo((): number[] => {
    if (isHistorical) {
      if (!telemetry?.length) return []
      return computeBuckets(
        telemetry.map((t) => ({ throttle: t.Throttle })),
        bucketCount,
      )
    }
    if (!history.length) return []
    return computeBuckets(
      history.map((d) => ({ throttle: d.throttle })),
      bucketCount,
    )
  }, [isHistorical, history, telemetry])

  const avgThrottle = useMemo(() => {
    if (!buckets.length) return null
    return buckets.reduce((s, b) => s + b, 0) / buckets.length
  }, [buckets])

  if (!driverNumber) return <EmptyState message="No driver selected" />

  if (!buckets.length) {
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

  // Pad to always show configured bucketCount cells (prepend empty if buffer not full yet)
  const displayBuckets = buckets.length < bucketCount
    ? [
        ...Array.from({ length: bucketCount - buckets.length }, () => 0),
        ...buckets,
      ]
    : buckets

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
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.12em',
            color: isHistorical ? 'var(--amber)' : 'var(--green)',
            background: isHistorical ? 'rgba(224,144,0,0.12)' : 'rgba(74,222,128,0.12)',
            border: isHistorical
              ? '0.5px solid rgba(224,144,0,0.3)'
              : '0.5px solid rgba(74,222,128,0.3)',
            borderRadius: 2,
            padding: '1px 4px',
          }}>
            {isHistorical ? 'HIST' : 'LIVE'}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.08em', color: 'var(--green)',
        }}>
          AVG {Math.round(avgThrottle ?? 0)}%
        </span>
      </div>

      {/* Sub-header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
          color: 'var(--muted2)', textTransform: 'uppercase',
        }}>
          THROTTLE HEATMAP
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7,
          color: 'var(--muted2)', letterSpacing: '0.1em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* 4x4 heatmap grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gap: 3,
        minHeight: 0,
      }}>
        {displayBuckets.map((avg, i) => (
          <div
            key={i}
            style={{
              background: throttleColor(avg),
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 6,
              color: 'var(--muted2)',
              letterSpacing: '0.06em',
              marginTop: 'auto',
              paddingBottom: 2,
            }}>
              µ{i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Live sample count footer */}
      {!isHistorical && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.06em',
        }}>
          {history.length}/{maxSamples} samples · {Math.max(1, Math.floor(maxSamples / bucketCount))}/bucket
        </div>
      )}
    </div>
  )
}
