export const HELP = `# Engine Mode Tracker

Infers the driver's current power unit deployment mode from throttle, RPM, and brake data, and shows a confidence histogram across recent samples.

- **Hero mode label**: The most frequent inferred mode over the last 20 samples (e.g., PUSH, STANDARD).
- **Confidence bars**: Percentage breakdown of how often each mode was inferred across those samples.

Modes are inferred as follows:

- *PUSH*: Throttle ≥ 90% and RPM ≥ 11,000 — maximum deployment.
- *ATTACK*: Throttle ≥ 70% and RPM ≥ 9,000 — aggressive but not flat out.
- *STANDARD*: Throttle ≥ 40% or RPM ≥ 7,000 — normal running.
- *HARVEST*: Brake > 30% — likely recovering energy under braking.
- *CONSERVE*: All other conditions — coasting or low demand.

Unfamiliar terms:

- *Power unit mode*: A software configuration on the hybrid power unit that governs how aggressively the engine and ERS battery are used. Real modes are team-specific and not publicly available — these labels are heuristic approximations.
- *RPM*: Revolutions Per Minute — engine speed.

Notes: all modes are *inferred* from observable telemetry, not read directly from car systems. Actual team power unit modes are proprietary and may not correspond to these labels. Use as a rough indicator of deployment intensity, not a definitive mode readout.
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

const MAX_SAMPLES = 20

type EngineMode = 'PUSH' | 'ATTACK' | 'STANDARD' | 'HARVEST' | 'CONSERVE'

interface ModeDef {
  mode: EngineMode
  color: string
  label: string
}

const MODE_DEFS: ModeDef[] = [
  { mode: 'PUSH',     color: 'var(--red)',   label: 'PUSH' },
  { mode: 'ATTACK',   color: 'var(--amber)', label: 'ATTACK' },
  { mode: 'STANDARD', color: 'var(--green)', label: 'STANDARD' },
  { mode: 'HARVEST',  color: 'var(--cyan)',  label: 'HARVEST' },
  { mode: 'CONSERVE', color: 'var(--muted)', label: 'CONSERVE' },
]

function inferMode(throttle: number, rpm: number, brake: number): EngineMode {
  if (throttle >= 90 && rpm >= 11000) return 'PUSH'
  if (throttle >= 70 && rpm >= 9000)  return 'ATTACK'
  if (throttle >= 40 || rpm >= 7000)  return 'STANDARD'
  if (brake > 30)                     return 'HARVEST'
  return 'CONSERVE'
}

function buildHistogram(modes: EngineMode[]): Record<EngineMode, number> {
  const counts: Record<EngineMode, number> = {
    PUSH: 0, ATTACK: 0, STANDARD: 0, HARVEST: 0, CONSERVE: 0,
  }
  for (const m of modes) counts[m]++
  return counts
}

function ConfidenceBar({ def, pct }: { def: ModeDef; pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.08em',
        color: def.color, width: 54, flexShrink: 0,
      }}>
        {def.label}
      </span>
      <div style={{
        flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.round(pct * 100)}%`,
          height: '100%',
          background: def.color,
          borderRadius: 2,
          opacity: 0.85,
          transition: 'width 0.35s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
        minWidth: 28, textAlign: 'right', flexShrink: 0,
      }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

export function EngineModeTracker({ widgetId }: { widgetId: string }) {
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

  const { currentMode, histogram, sampleCount } = useMemo((): {
    currentMode: EngineMode | null
    histogram: Record<EngineMode, number>
    sampleCount: number
  } => {
    const empty = { currentMode: null, histogram: buildHistogram([]), sampleCount: 0 }

    if (isHistorical) {
      if (!telemetry?.length) return empty
      // Current mode from peak (highest throttle) sample; histogram from full lap
      // This gives a richer confidence spread than a single peak sample would.
      const peakSample = telemetry.reduce((a, b) => (b.Throttle > a.Throttle ? b : a), telemetry[0])
      const curMode = inferMode(
        peakSample.Throttle,
        peakSample.RPM,
        peakSample.Brake ? 100 : 0,
      )
      const modes = telemetry.map((t) =>
        inferMode(t.Throttle, t.RPM, t.Brake ? 100 : 0),
      )
      return { currentMode: curMode, histogram: buildHistogram(modes), sampleCount: modes.length }
    }

    if (!history.length) return empty
    const latest = history[history.length - 1]
    const curMode = inferMode(latest.throttle, latest.rpm, latest.brake)
    const modes = history.map((d) => inferMode(d.throttle, d.rpm, d.brake))
    return { currentMode: curMode, histogram: buildHistogram(modes), sampleCount: modes.length }
  }, [isHistorical, history, telemetry])

  if (!driverNumber) return <EmptyState message="No driver selected" />

  if (!currentMode) {
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

  const currentDef = MODE_DEFS.find((d) => d.mode === currentMode)!

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

      {/* Current mode hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBlock: 4 }}>
        <span style={{
          fontFamily: 'var(--cond)', fontSize: 38, fontWeight: 800, lineHeight: 0.9,
          letterSpacing: '-0.02em', color: currentDef.color,
          transition: 'color 0.25s ease',
        }}>
          {currentDef.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.12em',
            color: 'var(--muted2)', background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid var(--border)', borderRadius: 2, padding: '1px 4px',
          }}>
            INFERRED
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.06em',
          }}>
            ENGINE MODE
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginInline: -8 }} />

      {/* Confidence bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, justifyContent: 'center' }}>
        {MODE_DEFS.map((def) => {
          const count = histogram[def.mode]
          const pct = sampleCount > 0 ? count / sampleCount : 0
          return <ConfidenceBar key={def.mode} def={def} pct={pct} />
        })}
      </div>

      {/* Sample info */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
        letterSpacing: '0.06em',
      }}>
        {isHistorical
          ? `${sampleCount} lap samples`
          : `${sampleCount}/${MAX_SAMPLES} samples`}
      </div>
    </div>
  )
}
