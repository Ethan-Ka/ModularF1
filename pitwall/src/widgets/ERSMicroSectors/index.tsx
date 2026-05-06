export const HELP = `# ERS Micro-Sectors

Inferred ERS (energy recovery) deployment and harvesting split across 8 track micro-sectors, shown as a stacked bar chart.

- **Green bars (upward)**: Estimated energy *harvesting* — proportional to average brake % in the bucket, indicating the driver is recovering energy under braking.
- **Team-color bars (downward)**: Estimated energy *deployment* — proportional to average throttle %, indicating power being drawn from the battery.
- **Net ERS**: Harvest minus deploy per sector (positive = net gain, negative = net drain).
- **Midline**: Zero reference — bars above harvest, bars below deploy.

Unfamiliar terms:

- *ERS*: Energy Recovery System — captures kinetic energy under braking and heat from exhaust gases, storing it in a battery. That energy is then deployed as additional power on acceleration.
- *Micro-sector*: A fine subdivision of a lap used for localized analysis, not the same as the official S1/S2/S3 split points.

Notes: ERS deployment and harvesting are *inferred* from throttle and brake telemetry — treat this as an approximation, not a direct measurement. In live mode the most recent 40 samples are bucketed; in historical mode the last completed lap is used via FastF1.
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

const DRS_OPEN_THRESHOLD = 10
const MAX_SAMPLES = 40
const BUCKET_COUNT = 8
const SAMPLES_PER_BUCKET = MAX_SAMPLES / BUCKET_COUNT // 5

interface ErsBucket {
  deployPct: number  // avg throttle / 100
  harvestPct: number // avg brake / 100
  netERS: number     // harvestPct - deployPct
}

function computeBuckets(
  samples: Array<{ throttle: number; brake: number }>,
  bucketCount: number,
): ErsBucket[] {
  if (!samples.length) return []

  const perBucket = Math.max(1, Math.floor(samples.length / bucketCount))
  const buckets: ErsBucket[] = []

  for (let i = 0; i < bucketCount; i++) {
    const start = i * perBucket
    const end = i === bucketCount - 1 ? samples.length : start + perBucket
    const slice = samples.slice(start, end)
    if (!slice.length) {
      buckets.push({ deployPct: 0, harvestPct: 0, netERS: 0 })
      continue
    }
    const deployPct = slice.reduce((s, d) => s + d.throttle, 0) / slice.length / 100
    const harvestPct = slice.reduce((s, d) => s + d.brake, 0) / slice.length / 100
    buckets.push({ deployPct, harvestPct, netERS: harvestPct - deployPct })
  }

  return buckets
}

function MicroSectorBar({ bucket, index, teamColor }: {
  bucket: ErsBucket
  index: number
  teamColor: string
}) {
  const deployH = Math.round(Math.min(bucket.deployPct, 1) * 60)
  const harvestH = Math.round(Math.min(bucket.harvestPct, 1) * 60)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 2 }}>
      {/* Stacked bar: harvest (top, green) + deploy (bottom, team color) */}
      <div style={{
        width: '100%',
        height: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 1,
        position: 'relative',
      }}>
        {/* Midline */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: 'var(--border)',
        }} />
        {/* Harvest segment (green, grows upward from midline) */}
        <div style={{
          position: 'absolute',
          bottom: '50%',
          left: 2,
          right: 2,
          height: harvestH,
          background: 'var(--green)',
          borderRadius: '2px 2px 0 0',
          opacity: 0.85,
          transition: 'height 0.3s ease',
        }} />
        {/* Deploy segment (team color, grows downward from midline) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 2,
          right: 2,
          height: deployH,
          background: teamColor,
          borderRadius: '0 0 2px 2px',
          opacity: 0.75,
          transition: 'height 0.3s ease',
        }} />
      </div>
      {/* Bucket label */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 6,
        color: 'var(--muted2)',
        letterSpacing: '0.06em',
      }}>
        µ{index + 1}
      </span>
    </div>
  )
}

export function ERSMicroSectors({ widgetId }: { widgetId: string }) {
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

  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)
  const refreshFade = useRefreshFade([liveData])

  // Rolling history buffer — dedup by date string
  const history = useRollingHistory(
    mode === 'live' ? liveData : null,
    MAX_SAMPLES,
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
  const buckets = useMemo((): ErsBucket[] => {
    if (isHistorical) {
      if (!telemetry?.length) return []
      return computeBuckets(
        telemetry.map((t) => ({ throttle: t.Throttle, brake: t.Brake ? 100 : 0 })),
        BUCKET_COUNT,
      )
    }
    if (!history.length) return []
    return computeBuckets(
      history.map((d) => ({ throttle: d.throttle, brake: d.brake })),
      BUCKET_COUNT,
    )
  }, [isHistorical, history, telemetry])

  // Net ERS balance across all buckets
  const netERS = useMemo(() => {
    if (!buckets.length) return null
    const net = buckets.reduce((s, b) => s + b.netERS, 0) / buckets.length
    return net
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

  const netPct = Math.round(Math.abs(netERS ?? 0) * 100)
  const netPositive = (netERS ?? 0) >= 0

  // Fill to always show BUCKET_COUNT bars (pad with empty buckets if buffer not full yet)
  const displayBuckets = buckets.length < BUCKET_COUNT
    ? [
        ...Array.from({ length: BUCKET_COUNT - buckets.length }, () => ({
          deployPct: 0, harvestPct: 0, netERS: 0,
        })),
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

      {/* Net ERS balance indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
          color: 'var(--muted2)', textTransform: 'uppercase',
        }}>
          ERS MICRO-SECTORS
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: netPositive ? 'var(--green)' : 'var(--red)',
        }}>
          NET {netPositive ? '+' : '-'}{netPct}%
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 1, background: 'var(--green)', opacity: 0.85 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em' }}>HARVEST</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 1, background: teamColor, opacity: 0.75 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em' }}>DEPLOY</span>
        </div>
      </div>

      {/* Micro-sector bars */}
      <div style={{ display: 'flex', flex: 1, gap: 4, alignItems: 'stretch', minHeight: 0 }}>
        {displayBuckets.map((bucket, i) => (
          <MicroSectorBar
            key={i}
            bucket={bucket}
            index={i}
            teamColor={teamColor}
          />
        ))}
      </div>

      {/* Live sample count info */}
      {!isHistorical && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.06em',
        }}>
          {history.length}/{MAX_SAMPLES} samples · {SAMPLES_PER_BUCKET}/bucket
        </div>
      )}
    </div>
  )
}
