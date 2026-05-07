export const HELP = `# Pit Window Urgency

Shows how close the selected driver is to the typical tyre life limit for their current compound, with a colour-coded urgency signal.

- **Compound**: Current tyre type (Soft, Medium, Hard, Intermediate, Wet) with compound colour.
- **Tyre age**: Laps completed on the current set.
- **Urgency level**: OK (green) / WATCH (amber) / PIT NOW (red), based on percentage of compound-typical life used.
- **% used**: Tyre age as a fraction of the compound's estimated maximum laps.
- **Typical max laps**: The reference limits used — Soft ≈ 20 laps, Medium ≈ 35, Hard ≈ 50, Intermediate ≈ 30, Wet ≈ 40.

Unfamiliar terms:

- *Cliff*: The point where tyre performance drops sharply — often associated with visible graining or severe degradation. The urgency levels are a proxy for approaching this point.
- *Compound*: The tyre specification; Pirelli produces multiple compounds ranging from Soft (fastest, least durable) to Wet (for heavy rain).

Notes: typical max laps are fixed heuristics and will vary with circuit, weather, driving style, and team strategy. Treat urgency as a prompt to monitor the driver more closely, not a definitive pit call.
`
import { useMemo } from 'react'
import { useLaps } from '../../hooks/useLaps'
import { useStints } from '../../hooks/useStints'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useDegInference } from '../../hooks/useDegInference'
import { EmptyState } from '../widgetUtils'

// ─── Constants ───────────────────────────────────────────────────────────────


const COMPOUND_COLOR: Record<string, string> = {
  SOFT: 'var(--red)',
  MEDIUM: 'var(--gold)',
  HARD: '#e0e0e0',
  INTERMEDIATE: 'var(--green)',
  INTER: 'var(--green)',
  WET: 'var(--blue)',
}

// ─── Urgency logic ────────────────────────────────────────────────────────────

function getUrgency(
  tyreAge: number,
  cliffTyreLife: number,
): { level: 'OK' | 'WATCH' | 'PIT NOW'; color: string; pct: number } {
  const pct = Math.min(tyreAge / Math.max(1, cliffTyreLife), 1)
  if (pct < 0.65) return { level: 'OK', color: 'var(--green)', pct }
  if (pct < 0.85) return { level: 'WATCH', color: 'var(--amber)', pct }
  return { level: 'PIT NOW', color: 'var(--red)', pct }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color,
}: {
  label: string
  value: React.ReactNode
  color?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
      <div style={{
        fontFamily: 'var(--cond)', fontSize: 18, fontWeight: 700, lineHeight: 1,
        color: color ?? 'var(--white)', letterSpacing: '-0.01em', paddingBottom: 2,
      }}>
        {value}
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.1em',
        color: 'var(--muted2)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function PitWindowUrgency({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const driverAcronym = driver?.name_acronym

  const { data: stints } = useStints(driverNumber)
  const { data: laps } = useLaps(driverNumber)
  const deg = useDegInference(driverNumber ?? undefined)

  const refreshFade = useRefreshFade([stints, laps])

  // ── Derived values ──────────────────────────────────────────────────────────

  const result = useMemo(() => {
    if (!deg.currentStint) return null

    const compound = deg.compound
    const urgency = getUrgency(deg.tyreAge, deg.cliffTyreLife)
    const compoundColor = COMPOUND_COLOR[compound] ?? 'var(--muted)'

    const compoundLabel =
      compound === 'INTERMEDIATE' ? 'INTER'
      : compound === 'MEDIUM' ? 'MED'
      : compound

    return { compound, compoundLabel, compoundColor, tyreAge: deg.tyreAge, max: deg.cliffTyreLife, urgency }
  }, [deg])

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!driverNumber) return <EmptyState message="No driver selected" />
  if (!result) return <EmptyState message="No stint data" />

  const { compoundLabel, compoundColor, tyreAge, max, urgency } = result

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 8 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
          color: 'var(--white)', fontWeight: 600,
        }}>
          {driverAcronym ?? '—'}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', letterSpacing: '0.1em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Hero: urgency level */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBlock: 2 }}>
        <span style={{
          fontFamily: 'var(--cond)', fontSize: 36, fontWeight: 700, lineHeight: 0.9,
          letterSpacing: '-0.01em', color: urgency.color,
          transition: 'color 0.3s ease',
        }}>
          {urgency.level}
        </span>
      </div>

      {/* Urgency progress bar */}
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{
          width: `${Math.round(urgency.pct * 100)}%`,
          height: '100%',
          background: urgency.color,
          borderRadius: 3,
          transition: 'width 0.4s ease, background 0.3s ease',
        }} />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 0, alignItems: 'stretch',
        borderTop: '1px solid var(--border)', paddingTop: 8,
      }}>
        {/* COMPOUND */}
        <StatCell
          label="COMPOUND"
          value={
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              color: compoundColor, letterSpacing: '0.04em',
              border: `1px solid ${compoundColor}`,
              borderRadius: 3, padding: '1px 6px',
              background: `color-mix(in srgb, ${compoundColor} 12%, transparent)`,
              paddingTop: 2,
            }}>
              {compoundLabel}
            </span>
          }
        />

        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

        {/* AGE */}
        <StatCell
          label="AGE"
          value={`${tyreAge}L`}
          color={urgency.color}
        />

        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

        {/* CLIFF */}
        <StatCell
          label="CLIFF"
          value={`~${max}L`}
          color="var(--muted)"
        />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)',
          letterSpacing: '0.06em', fontStyle: 'italic',
        }}>
          cliff: live regression · temp {deg.trackTemp.toFixed(0)}°C · load {deg.paceIntensity.toFixed(2)}×
        </span>
      </div>
    </div>
  )
}
