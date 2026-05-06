export const HELP = `# Car Visualization

Displays a graphical side profile of the selected car, with live telemetry overlays.

- **Car image**: Shows the current car model and livery for the selected team.
- **Telemetry overlays**: May include DRS, RPM, tyre compound, and other live data.
- **Compound color**: Tyre color matches the selected compound (Soft, Medium, Hard, etc.).

**Tips:**
- Use to visually confirm car/tyre selection or for broadcast overlays.
- If a team/car asset is missing, a fallback image is shown.

**Notes:**
- Telemetry overlays depend on available data and may not show all fields.
- Car images are based on the current season and may not match historical data.

**Unfamiliar terms:**
- *DRS*: Drag Reduction System, a device to reduce drag and increase speed on straights.
- *RPM*: Revolutions per minute, engine speed.
`
import { useMemo, useRef } from 'react'
import { useCarData } from '../../hooks/useCarData'
import { useFastF1Telemetry, useFastF1Laps } from '../../hooks/useFastF1'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useStints } from '../../hooks/useStints'
import { EmptyState } from '../widgetUtils'

const DRS_OPEN_THRESHOLD = 10
const MAX_RPM = 15_000
const SIDE_PROFILE_BASE = '/seasons/2026/cars/sideProfile/'

// Keyed by team shortName from teams.json → asset filename
const TEAM_CAR_ASSETS: Record<string, string> = {
  Alpine: '2026alpinecarright.avif',
  'Aston Martin': '2026astonmartincarright.avif',
  Audi: '2026audicarright.avif',
  Cadillac: '2026cadillaccarright.avif',
  Haas: '2026haascarright.avif',
  McLaren: '2026mclarencarright.avif',
  Mercedes: '2026mercedescarright.avif',
  'Racing Bulls': '2026racingbullscarright.avif',
  'Red Bull': '2026redbullracingcarright.avif',
  Williams: '2026williamscarright.avif',
  Ferrari: '2026ferraricarright.avif',
  // Ferrari has no 2026 side profile — falls through to masked fallback
}

const FALLBACK_CAR_URL = `${SIDE_PROFILE_BASE}2026mercedescarright.avif`

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'var(--red)',
  MEDIUM: '#FFD600',
  HARD: 'var(--white)',
  INTERMEDIATE: 'var(--green)',
  INTER: 'var(--green)',
  WET: '#4488FF',
}

const COMPOUND_ABBR: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  INTER: 'I',
  WET: 'W',
}

interface NormalizedSample {
  speed: number
  gear: number
  rpm: number
  throttle: number // 0–100
  brake: number    // 0–100
  drsOpen: boolean
}

function resolveCarAsset(teamName: string | null | undefined): { url: string; hasLivery: boolean } {
  if (!teamName) return { url: FALLBACK_CAR_URL, hasLivery: false }
  const file = TEAM_CAR_ASSETS[teamName]
  if (file) return { url: `${SIDE_PROFILE_BASE}${file}`, hasLivery: true }
  return { url: FALLBACK_CAR_URL, hasLivery: false }
}

export function CarVisualization({ widgetId }: { widgetId: string }) {
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
  const teamName = driver?.team_name ?? null

  const { url: carUrl, hasLivery } = useMemo(() => resolveCarAsset(teamName), [teamName])

  // Stints for tyre compound
  const { data: stints } = useStints(driverNumber ?? undefined)
  const currentStint = useMemo(() => {
    if (!stints?.length) return undefined
    return [...stints].sort((a, b) => b.stint_number - a.stint_number)[0]
  }, [stints])
  const compound = (currentStint?.compound ?? '').toUpperCase()
  const compoundColor = COMPOUND_COLORS[compound] ?? 'var(--muted)'
  const compoundAbbr = COMPOUND_ABBR[compound] ?? '?'
  const compoundName = compound || null

  // Live path: FastF1 telemetry latest sample
  const { data: liveData } = useCarData(mode === 'live' ? driverNumber : null)

  // Historical path: FastF1 telemetry for peak-speed sample of the last completed lap
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

  const currentSample = mode === 'live' ? liveSample : peakSample
  const isHistorical = mode === 'hub'
  const refreshFade = useRefreshFade([liveData])

  // Persist the last known good sample so the car stays visible when
  // switching to historical mode before FastF1 data loads.
  const lastSampleRef = useRef<NormalizedSample | null>(null)
  if (currentSample != null) lastSampleRef.current = currentSample
  const sample = currentSample ?? lastSampleRef.current

  if (!driverNumber) return <EmptyState message="No driver selected" />

  if (!sample) {
    return (
      <EmptyState
        message="Waiting for telemetry…"
      />
    )
  }

  const rpmPct = Math.min(Math.max(sample.rpm / MAX_RPM, 0), 1)
  const throttlePct = Math.min(Math.max(sample.throttle / 100, 0), 1)
  const brakePct = Math.min(Math.max(sample.brake / 100, 0), 1)

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        padding: '8px 10px', gap: 6, overflow: 'hidden', boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 3, height: 12, borderRadius: 1, flexShrink: 0,
            background: teamColor, display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.12em',
            color: 'var(--white)', fontWeight: 700,
          }}>
            {driverAcronym ?? '—'}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted2)',
            letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {teamName ?? '—'}
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
          {!hasLivery && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.1em',
              color: 'var(--muted2)', background: 'var(--bg3)',
              border: '0.5px solid var(--border)', borderRadius: 2, padding: '1px 4px',
            }}>
              2026 LIVERY N/A
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.1em' }}>
          {badgeLabel}
        </span>
      </div>

      {/* Main row: speed + gear + rpm / car image / tyre */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 10, alignItems: 'stretch' }}>

        {/* Left column: Speed, Gear, RPM */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 6, flexShrink: 0, width: 80,
        }}>
          {/* Speed */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: 'var(--cond)', fontSize: 46, fontWeight: 800,
              lineHeight: 0.88, color: 'var(--white)', letterSpacing: '-0.02em',
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

          <div style={{ width: '80%', height: 0.5, background: 'var(--border)' }} />

          {/* Gear */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{
              fontFamily: 'var(--cond)', fontSize: 34, fontWeight: 800,
              lineHeight: 1, color: teamColor,
            }}>
              {sample.gear > 0 ? sample.gear : 'N'}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
              letterSpacing: '0.14em',
            }}>
              GEAR
            </span>
          </div>

          <div style={{ width: '80%', height: 0.5, background: 'var(--border)' }} />

          {/* RPM number */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: 'var(--cond)', fontSize: 28, fontWeight: 800,
              lineHeight: 1, color: teamColor, letterSpacing: '-0.01em',
            }}>
              {Math.round(sample.rpm).toLocaleString()}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)',
              letterSpacing: '0.14em', marginLeft: 6, marginBottom: 2,
            }}>
              RPM
            </span>
          </div>

          {/* RPM bar */}
          <div style={{
            width: '100%', height: 3, background: 'var(--bg3)',
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${rpmPct * 100}%`,
              height: '100%',
              background: teamColor,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Center: Car image with DRS overlay and pedal bars */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
        }}>
          <img
            src={carUrl}
            alt={teamName ?? 'F1 Car'}
            draggable={false}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
              filter: hasLivery ? undefined : 'grayscale(1) brightness(1.35)',
              transition: 'filter 0.3s ease',
            }}
          />
          {/* White overlay to wash out livery when no team asset */}
          {!hasLivery && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.28)',
              pointerEvents: 'none',
            }} />
          )}

          {/* DRS badge — overlaid on rear wing (left of right-facing car), pushed lower */}
          <div style={{
            position: 'absolute', top: '35%', left: '3%',
            background: sample.drsOpen ? 'rgba(29,184,106,0.9)' : 'rgba(255,255,255,0.06)',
            color: sample.drsOpen ? 'var(--white)' : 'var(--muted)',
            fontFamily: 'var(--mono)',
            fontSize: 14,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 3,
            letterSpacing: '0.1em',
            boxShadow: sample.drsOpen ? '0 0 8px rgba(29,184,106,0.7)' : 'none',
            border: sample.drsOpen ? 'none' : '0.5px solid var(--border2)',
            transition: 'all 0.25s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            DRS
          </div>

          {/* Tyre compound — overlaid above rear wheel (right-facing car: rear wheel lower-right) */}
          <div style={{
            position: 'absolute', bottom: '28%', right: '14%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            pointerEvents: 'none', userSelect: 'none',
          }}>
            <div style={{
              width: 45, height: 45, borderRadius: '50%',
              border: `1.5px solid ${compoundColor}`,
              background: compoundName
                ? `color-mix(in srgb, ${compoundColor} 15%, rgba(11,11,12,0.85))`
                : 'rgba(11,11,12,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--cond)', fontSize: 18, fontWeight: 700,
                color: compoundColor, lineHeight: 1,
              }}>
                {compoundAbbr}
              </span>
            </div>
            {compoundName && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 12,
                color: compoundColor, letterSpacing: '0.06em',
              }}>
                {compoundName}
              </span>
            )}
          </div>

        </div>

        {/* Pedal bars column */}
        <div style={{
          flexShrink: 0, paddingLeft: 6,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4,
        }}>
          {/* Bar row: BRK left, THR right */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 4, flex: 1, height: '100%' }}>
            {/* Brake bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}>
              <div style={{
                flex: 1, width: 8,
                background: 'var(--bg3)', borderRadius: 3,
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: '100%',
                  height: `${brakePct * 100}%`,
                  background: 'var(--red)',
                  borderRadius: 3,
                  transition: 'height 0.3s ease',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)',
                letterSpacing: '0.04em', lineHeight: 1,
              }}>BRK</span>
            </div>
            {/* Throttle bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}>
              <div style={{
                flex: 1, width: 8,
                background: 'var(--bg3)', borderRadius: 3,
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: '100%',
                  height: `${throttlePct * 100}%`,
                  background: 'var(--green)',
                  borderRadius: 3,
                  transition: 'height 0.3s ease',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)',
                letterSpacing: '0.04em', lineHeight: 1,
              }}>THR</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
