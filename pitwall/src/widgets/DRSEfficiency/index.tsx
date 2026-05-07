export const HELP = `# DRS Efficiency

Tracks DRS activation patterns and the speed gain attributed to having the rear wing open.

- **DRS state**: Whether the DRS flap is currently open or closed (raw value ≥ 10 = open).
- **Activation count**: Total number of DRS zones activated this session.
- **Avg speed gain**: Average km/h difference between DRS-open and DRS-closed samples.
- **Last zone gain**: Speed delta recorded on the most recent DRS activation.

Unfamiliar terms:

- *DRS*: Drag Reduction System — a movable element on the rear wing that flattens to reduce aerodynamic drag, typically adding 10–15 km/h on straights. Drivers can open DRS within designated zones when within 1 second of the car ahead (race) or freely in qualifying.
- *DRS zone*: A designated straight section of the track where DRS may be activated.

Notes: speed gain is inferred by comparing speed samples taken just before and after DRS activation — it is an approximation and may be affected by other factors (corner exits, wind, fuel load). Live and historical data are derived from FastF1 timing telemetry.
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
const MAX_SAMPLES = 60

interface DrsZone {
  preSpeed: number   // speed just before DRS opened
  avgSpeed: number   // average speed while DRS open
  delta: number      // avgSpeed - preSpeed
}

interface DrsStats {
  activations: number
  avgGain: number | null
  lastGain: number | null
  currentDRS: boolean
}

function analyzeDrsZones(
  samples: Array<{ speed: number; drs: number }>,
): DrsStats {
  const zones: DrsZone[] = []
  let inZone = false
  let preSpeed = 0
  let zoneSpeedSum = 0
  let zoneCount = 0

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const open = s.drs >= DRS_OPEN_THRESHOLD

    if (!inZone && open) {
      // Transition: closed → open
      // Capture speed just before this point
      preSpeed = i > 0 ? samples[i - 1].speed : s.speed
      zoneSpeedSum = s.speed
      zoneCount = 1
      inZone = true
    } else if (inZone && open) {
      zoneSpeedSum += s.speed
      zoneCount++
    } else if (inZone && !open) {
      // Transition: open → closed — zone ended
      const avgSpeed = zoneCount > 0 ? zoneSpeedSum / zoneCount : preSpeed
      zones.push({ preSpeed, avgSpeed, delta: avgSpeed - preSpeed })
      inZone = false
      zoneSpeedSum = 0
      zoneCount = 0
    }
  }

  const currentDRS = samples.length > 0
    ? samples[samples.length - 1].drs >= DRS_OPEN_THRESHOLD
    : false

  const avgGain =
    zones.length > 0
      ? zones.reduce((s, z) => s + z.delta, 0) / zones.length
      : null

  const lastGain = zones.length > 0 ? zones[zones.length - 1].delta : null

  return {
    activations: zones.length,
    avgGain,
    lastGain,
    currentDRS,
  }
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1,
    }}>
      <span style={{
        fontFamily: 'var(--cond)', fontSize: 20, fontWeight: 700, lineHeight: 1,
        color: color ?? 'var(--white)', letterSpacing: '-0.01em',
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.1em',
        color: 'var(--muted2)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

export function DRSEfficiency({ widgetId }: { widgetId: string }) {
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

  const stats = useMemo((): DrsStats | null => {
    if (isHistorical) {
      if (!telemetry?.length) return null
      return analyzeDrsZones(
        telemetry.map((t) => ({ speed: t.Speed, drs: t.DRS })),
      )
    }
    if (!history.length) return null
    return analyzeDrsZones(
      history.map((d) => ({ speed: d.speed, drs: d.drs })),
    )
  }, [isHistorical, history, telemetry])

  if (!driverNumber) return <EmptyState message="No driver selected" />

  if (!stats) {
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

  const formatGainKmh = (v: number | null): string => {
    if (v == null) return '—'
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`
  }

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 8 }}
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

      {/* DRS state hero */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBlock: 4 }}>
        <span style={{
          fontSize: 14, lineHeight: 1,
          color: stats.currentDRS ? 'var(--green)' : 'var(--muted2)',
          transition: 'color 0.2s ease',
        }}>
          ●
        </span>
        <span style={{
          fontFamily: 'var(--cond)', fontSize: 36, fontWeight: 800, lineHeight: 0.9,
          letterSpacing: '-0.02em',
          color: stats.currentDRS ? 'var(--green)' : 'var(--muted)',
          transition: 'color 0.2s ease',
        }}>
          {stats.currentDRS ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginInline: -8 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
        <StatCell label="ACTIVATIONS" value={String(stats.activations)} />
        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
        <StatCell
          label="AVG GAIN"
          value={`${formatGainKmh(stats.avgGain)} km/h`}
          color={stats.avgGain != null && stats.avgGain > 0 ? 'var(--green)' : 'var(--muted)'}
        />
        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
        <StatCell
          label="LAST ZONE"
          value={`${formatGainKmh(stats.lastGain)} km/h`}
          color={stats.lastGain != null && stats.lastGain > 0 ? teamColor : 'var(--muted)'}
        />
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 'auto' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.06em', fontStyle: 'italic',
        }}>
          inferred from speed delta
        </span>
      </div>
    </div>
  )
}
