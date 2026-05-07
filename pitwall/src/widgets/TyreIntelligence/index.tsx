import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useDegInference, COMPOUND_COLORS, COMPOUND_ABBR } from '../../hooks/useDegInference'
import { useStints } from '../../hooks/useStints'
import { useLaps } from '../../hooks/useLaps'
import { useWeather } from '../../hooks/useWeather'

interface TyreIntelligenceProps {
  widgetId: string
}

export const HELP = `# Tyre Intelligence

Estimates tyre life and degradation for the selected driver.

- **Compound**: Shows the current tyre compound and stint number.
- **Tyre life**: Laps completed on current tyres vs. estimated maximum ("cliff").
- **Degradation**: Percentage of tyre life used, with a visual meter.
- **Cliff lap**: Predicted lap when tyre performance drops off sharply.
- **Track temp**: Current track temperature (affects tyre life estimate).
- **Pace load**: How hard the car is being driven vs. baseline (>1 = higher wear rate).
- **Formula**: Shows the calculation used for cliff prediction.

**Usage:**
- Select a driver to view their current stint and tyre status.
- Useful for pit strategy and stint planning.

**Notes:**
- When 2+ stint laps are available, cliff is predicted from live regression data.
- At low confidence (new stint), temperature and compound baseline are used.
- Estimates are approximate and may vary with race conditions.
`

export function TyreIntelligence({ widgetId }: TyreIntelligenceProps) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber } = useWidgetDriver(config?.driverContext ?? 'FOCUS')

  const { data: stints } = useStints(driverNumber ?? undefined)
  const { data: laps } = useLaps(driverNumber ?? undefined)
  const { data: weatherAll } = useWeather()

  const deg = useDegInference(driverNumber ?? undefined)
  const refreshFade = useRefreshFade([driverNumber, stints, laps, weatherAll])

  if (!driverNumber) {
    return <NoDriverState />
  }

  if (!deg.currentStint) {
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

  const compound = deg.compound
  const compoundColor = COMPOUND_COLORS[compound] ?? 'var(--muted)'
  const compoundAbbr = COMPOUND_ABBR[compound] ?? compound.slice(0, 1)

  const cliffText = deg.lapsToCliff > 0
    ? `Cliff lap ${deg.cliffLap} (${deg.lapsToCliff} to cliff)`
    : `Cliff lap ${deg.cliffLap} (past cliff)`

  const confLabel =
    deg.confidence === 'high' ? '±2 laps' :
    deg.confidence === 'medium' ? '±3 laps' : '±5 laps (est)'

  const degRateLabel = deg.degPerLap != null
    ? `+${deg.degPerLap.toFixed(3)}s/lap`
    : 'N/A'

  const formula = (config?.settings?.formula as string) ??
    (deg.degPerLap != null
      ? `CLIFF = stint_start − tyre_age_at_start + round(BASE_WINDOW[${compound}] × BASE_DEG_RATE / (deg_rate × temp_mult))\n  deg_rate = ${deg.degPerLap.toFixed(3)} s/lap  (regression)\n  temp_mult = ${deg.tempMultiplier.toFixed(3)}  (track ${deg.trackTemp.toFixed(0)}°C vs 45°C baseline)\n  pace_load = ${deg.paceIntensity.toFixed(2)}  (observed wear / baseline)`
      : `CLIFF = stint_start − tyre_age_at_start + round(BASE_WINDOW[${compound}] / temp_mult)\n  temp_mult = ${deg.tempMultiplier.toFixed(3)}  (track ${deg.trackTemp.toFixed(0)}°C vs 45°C baseline)\n  [using baseline rate — need 2+ stint laps for regression]`)

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
          percentage={deg.degradationPct}
          cliffText={cliffText}
          accentColor={compoundColor}
        />
        <StatBox label="Stint" value={`#${deg.currentStint.stint_number}`} />
        <StatBox label="Tyre life" value={`${deg.tyreAge}/${deg.cliffTyreLife} laps`} />
        <StatBox label="Track temp" value={`${deg.trackTemp.toFixed(0)}°C`} />
        <StatBox
          label="Deg rate"
          value={degRateLabel}
          valueColor={deg.degPerLap != null ? 'var(--amber)' : 'var(--muted)'}
        />
        <StatBox
          label="Pace load"
          value={`${deg.paceIntensity.toFixed(2)}×`}
          valueColor={deg.paceIntensity > 1.2 ? 'var(--red)' : deg.paceIntensity > 0.9 ? 'var(--amber)' : 'var(--green)'}
        />
      </div>

      {/* Confidence label */}
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 7,
        color: 'var(--muted)',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        {deg.confidence === 'low' ? '⚠ ' : ''}Est. accuracy: {confLabel}
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
