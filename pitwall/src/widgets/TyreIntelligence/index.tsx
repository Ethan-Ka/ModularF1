import { useStints } from '../../hooks/useStints'
import { useLaps } from '../../hooks/useLaps'
import { useWeather } from '../../hooks/useWeather'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface TyreIntelligenceProps {
  widgetId: string
}

const BASE_WINDOW: Record<string, number> = {
  SOFT: 18,
  MEDIUM: 28,
  HARD: 40,
  INTERMEDIATE: 35,
  INTER: 35,
  WET: 50,
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'var(--red)',
  MEDIUM: '#FFD600',
  HARD: 'var(--white)',
  INTERMEDIATE: 'var(--green)',
  INTER: 'var(--green)',
  WET: 'var(--blue)',
}

const COMPOUND_ABBR: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  INTER: 'I',
  WET: 'W',
}

function compoundKey(compound: string): string {
  return compound.toUpperCase()
}

function getLapCount(laps: { lap_number: number }[] | undefined, driverNumber: number | null): number {
  if (!laps || !driverNumber) return 0
  // Count distinct lap numbers for this driver (already filtered by driver)
  return laps.filter((l) => l.lap_number != null).length
}

export function TyreIntelligence({ widgetId }: TyreIntelligenceProps) {
  const tabs = useWorkspaceStore((s) => s.tabs)
  let config = undefined as ReturnType<typeof useWorkspaceStore.getState>['tabs'][0]['widgets'][string] | undefined
  for (const tab of tabs) {
    if (tab.widgets[widgetId]) { config = tab.widgets[widgetId]; break }
  }

  const { driverNumber } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const { data: stints } = useStints(driverNumber ?? undefined)
  const { data: laps } = useLaps(driverNumber ?? undefined)
  const { data: weatherAll } = useWeather()
  const refreshFade = useRefreshFade([driverNumber, stints, laps, weatherAll])

  const latestWeather = weatherAll?.[weatherAll.length - 1]
  const trackTemp = latestWeather?.track_temperature ?? 45
  const scLaps = 0 // SC laps not available in Phase 1; placeholder

  // Current stint = latest
  const currentStint = stints
    ? [...stints].sort((a, b) => b.stint_number - a.stint_number)[0]
    : null

  if (!driverNumber) {
    return (
      <NoDriverState />
    )
  }

  if (!currentStint) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted2)',
      }}>
        No stint data…
      </div>
    )
  }

  const compound = compoundKey(currentStint.compound)
  const lapCount = getLapCount(laps, driverNumber)
  const tyreAge = Math.max(0, lapCount - currentStint.lap_start + 1 + (currentStint.tyre_age_at_start ?? 0))
  const baseWindow = BASE_WINDOW[compound] ?? 25

  // Degradation rate estimate: simplified for Phase 1
  const degRate = 0.05

  const cliffLap = Math.round(
    currentStint.lap_start +
    baseWindow -
    (trackTemp - 45) * 0.3 -
    degRate * 1.8 +
    scLaps * 2.1
  )

  const lapsToCliff = cliffLap - lapCount
  const cliffTyreLife = Math.max(1, cliffLap - currentStint.lap_start + 1 + (currentStint.tyre_age_at_start ?? 0))
  const degradationPct = Math.max(0, Math.min(100, (tyreAge / cliffTyreLife) * 100))
  const compoundColor = COMPOUND_COLORS[compound] ?? 'var(--muted)'
  const compoundAbbr = COMPOUND_ABBR[compound] ?? compound.slice(0, 1)
  const cliffText = lapsToCliff > 0
    ? `Cliff lap ${cliffLap} (${lapsToCliff} to cliff)`
    : `Cliff lap ${cliffLap} (past cliff)`

  const formula = (config?.settings?.formula as string) ??
    `CLIFF = stint_start + BASE_WINDOW[${compound}]\n  − (track_temp−45)×0.3\n  − deg_rate×1.8\n  + sc_laps×2.1`

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      padding: 8,
      overflow: 'hidden',
    }}>
      {/* Compound badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${compoundColor}`,
          background: `${compoundColor}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--cond)',
          fontWeight: 800,
          fontSize: 18,
          color: compoundColor,
          flexShrink: 0,
        }}>
          {compoundAbbr}
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
          }}>
            Compound
          </div>
          <div style={{
            fontFamily: 'var(--cond)',
            fontSize: 16,
            fontWeight: 700,
            color: compoundColor,
          }}>
            {compound}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 7,
        marginBottom: 10,
      }}>
        <DegradationStatBox
          percentage={degradationPct}
          cliffText={cliffText}
          accentColor={compoundColor}
        />
        <StatBox label="Tyre age" value={`${tyreAge} laps`} />
        <StatBox label="Tyre life" value={`${tyreAge}/${cliffTyreLife} laps`} />
        <StatBox label="Track temp" value={`${trackTemp.toFixed(0)}°C`} />
      </div>

      {/* Accuracy label */}
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 7,
        color: 'var(--muted)',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        Est. accuracy: ±3 laps
      </div>

      {/* Formula collapsed block */}
      <details style={{ marginTop: 0 }}>
        <summary style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          cursor: 'pointer',
          userSelect: 'none',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span>▶ Formula</span>
        </summary>
        <pre style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted)',
          lineHeight: 1.7,
          marginTop: 6,
          padding: '6px 8px',
          background: 'var(--bg)',
          borderRadius: 3,
          border: '0.5px solid var(--border)',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}>
          {formula}
        </pre>
      </details>
    </div>
  )
}

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--bg4) 0%, var(--bg3) 100%)',
      borderRadius: 3,
      border: '0.5px solid var(--border)',
      padding: '6px 8px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 7,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--cond)',
        fontSize: 18,
        fontWeight: 700,
        color: valueColor ?? 'var(--white)',
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  )
}

function DegradationStatBox({
  percentage,
  cliffText,
  accentColor,
}: {
  percentage: number
  cliffText: string
  accentColor: string
}) {
  let meterColor = 'var(--green)'
  if (percentage >= 90) meterColor = 'var(--red)'
  else if (percentage >= 75) meterColor = 'var(--amber)'

  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--bg4) 0%, var(--bg3) 100%)',
      borderRadius: 3,
      border: '0.5px solid var(--border)',
      padding: '6px 8px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 3,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          lineHeight: 1,
        }}>
          Tyre degradation
        </div>
        <div style={{
          fontFamily: 'var(--cond)',
          fontSize: 20,
          fontWeight: 700,
          color: meterColor,
          lineHeight: 1,
        }}>
          {Math.round(percentage)}%
        </div>
      </div>

      <div style={{
        position: 'relative',
        height: 8,
        borderRadius: 999,
        border: '0.5px solid var(--border2)',
        background: `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, var(--bg3) 100%)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 78%, ${meterColor}) 0%, ${meterColor} 100%)`,
          transition: 'width 220ms ease-out',
        }} />
      </div>

      <div style={{
        marginTop: 4,
        fontFamily: 'var(--mono)',
        fontSize: 7,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }} title={cliffText}>
        {cliffText}
      </div>
    </div>
  )
}

function NoDriverState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 8,
      fontFamily: 'var(--mono)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        No driver selected
      </div>
      <div style={{ fontSize: 8, color: 'var(--muted2)' }}>
        Set canvas focus or pin a driver
      </div>
    </div>
  )
}
