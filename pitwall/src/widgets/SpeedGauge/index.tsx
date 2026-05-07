export const HELP = `# Speed Gauge

Displays live telemetry for the selected driver: speed, gear, RPM, throttle, and brake.

- **Speed**: Current speed in km/h.
- **Gear**: Current gear selection (1–8).
- **RPM**: Engine revolutions per minute, shown as a bar against the maximum (≈15,000 rpm).
- **Throttle %**: Throttle pedal pressure (0–100%).
- **Brake %**: Brake pedal pressure (0–100%).
- **DRS**: Shown when the DRS flap is open (raw value ≥ 10).

Unfamiliar terms:

- *DRS*: Drag Reduction System — a movable rear-wing flap opened on designated straights to reduce drag and increase speed. Indicated by the DRS badge.
- *RPM*: Revolutions Per Minute — how fast the engine is spinning. F1 engines typically rev to around 15,000 rpm.

Notes: in live mode data streams from FastF1 timing telemetry. In historical mode the last completed lap's telemetry is fetched via the FastF1 sidecar — FastF1 must be running for historical data to appear.
`
import { useMemo } from 'react'
import { useCarData } from '../../hooks/useCarData'
import { useFastF1Telemetry, useFastF1Laps } from '../../hooks/useFastF1'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { EmptyState } from '../widgetUtils'

// DRS values ≥ 10 indicate the flap is actually open
const DRS_OPEN_THRESHOLD = 10
const MAX_RPM = 15_000

interface NormalizedSample {
  speed: number    // km/h
  gear: number
  rpm: number
  throttle: number // 0-100
  brake: number    // 0-100
  drsOpen: boolean
}

function MetricBar({ label, value, pct, color }: {
  label: string; value: string; pct: number; color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
        letterSpacing: '0.1em', width: 24, flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(Math.max(pct * 100, 0), 100)}%`,
          height: '100%', background: color, borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--white)',
        textAlign: 'right', minWidth: 36, flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  )
}

export function SpeedGauge({ widgetId }: { widgetId: string }) {
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

  // --- Live path: FastF1-derived telemetry samples ---
  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)

  // --- Historical path: FastF1 telemetry for the last completed lap ---
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

  // Peak speed sample from the last lap (most meaningful historical snapshot)
  const peakSample = useMemo((): NormalizedSample | null => {
    if (!telemetry?.length) return null
    const peak = telemetry.reduce((a, b) => (b.Speed > a.Speed ? b : a), telemetry[0])
    return {
      speed: peak.Speed,
      gear: peak.nGear,
      rpm: peak.RPM,
      throttle: peak.Throttle,
      brake: peak.Brake ? 100 : 0,
      drsOpen: peak.DRS >= DRS_OPEN_THRESHOLD,
    }
  }, [telemetry])

  // Normalize live telemetry data to same shape
  const liveSample = useMemo((): NormalizedSample | null => {
    if (!liveData) return null
    return {
      speed: liveData.speed,
      gear: liveData.n_gear,
      rpm: liveData.rpm,
      throttle: liveData.throttle,
      brake: liveData.brake,
      drsOpen: liveData.drs >= DRS_OPEN_THRESHOLD,
    }
  }, [liveData])

  const sample = mode === 'live' ? liveSample : peakSample
  const isHistorical = mode === 'hub'

  const refreshFade = useRefreshFade([liveData])

  if (!driverNumber) {
    return <EmptyState message="No driver selected" />
  }

  if (!sample) {
    const subMsg = isHistorical && !fastf1Available
      ? 'Requires FastF1 sidecar'
      : isHistorical && !activeFastF1Session
        ? 'Requires a live FastF1 session'
        : undefined
    return <EmptyState message={isHistorical ? 'No telemetry available' : 'Waiting for telemetry…'} subMessage={subMsg} />
  }

  const rpmPct = sample.rpm / MAX_RPM

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
              PEAK
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.1em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Hero: Speed + Gear */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minHeight: 0 }}>
        {/* Speed */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'left' }}>
          <span style={{
            fontFamily: 'var(--cond)', fontSize: 54, fontWeight: 800, lineHeight: 0.9,
            color: 'var(--white)', letterSpacing: '-0.02em',
          }}>
            {Math.round(sample.speed)}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)',
            letterSpacing: '0.14em', marginLeft: 6, marginBottom: 2,
          }}>
            KM/H
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: '65%', background: 'var(--border)', marginInline: 10, flexShrink: 0 }} />

        {/* Gear */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--cond)', fontSize: 44, fontWeight: 800, lineHeight: 0.9,
            color: teamColor, letterSpacing: '-0.02em',
          }}>
            {sample.gear > 0 ? sample.gear : 'N'}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
            letterSpacing: '0.14em', marginTop: 3,
          }}>
            GEAR
          </span>
        </div>
      </div>

      {/* RPM + Throttle + Brake + DRS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <MetricBar
          label="RPM"
          value={sample.rpm.toLocaleString()}
          pct={rpmPct}
          color={teamColor}
        />
        <MetricBar
          label="THR"
          value={`${Math.round(sample.throttle)}%`}
          pct={sample.throttle / 100}
          color="var(--green)"
        />
        <MetricBar
          label="BRK"
          value={`${Math.round(sample.brake)}%`}
          pct={sample.brake / 100}
          color="var(--red)"
        />

        {/* DRS indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
            letterSpacing: '0.1em', width: 24, flexShrink: 0,
          }}>
            DRS
          </span>
          <span style={{
            fontSize: 9, lineHeight: 1,
            color: sample.drsOpen ? 'var(--green)' : 'var(--muted2)',
            transition: 'color 0.2s ease',
          }}>
            ●
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.1em',
            color: sample.drsOpen ? 'var(--green)' : 'var(--muted2)',
          }}>
            {sample.drsOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>
    </div>
  )
}
