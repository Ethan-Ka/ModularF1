export const HELP = `# Pit Stop Log

Chronological record of all pit stops made during the session, showing compound changes and stint lengths.

- **Lap**: The lap on which the pit stop was made.
- **Driver**: Three-letter code with team colour bar.
- **Compound change**: Outgoing tyre → incoming tyre, shown as colour-coded compound pills (e.g., SOF→MED).
- **Stint laps**: Number of laps completed on the outgoing tyre set before the stop.

Unfamiliar terms:

- *Stint laps*: How many laps the outgoing tyre set was used — longer stints imply a longer strategy. May show "?" if the stint start lap is unknown.
- *Compound pill*: The 3-letter abbreviation and colour dot representing the tyre type: SOF (Soft, red), MED (Medium, yellow), HAR (Hard, grey), INT (Intermediate, green), WET (Wet, blue).

Notes: stops are derived from stint data — a new stint at a different tyre age implies a pit stop on that lap. The first stint of each driver does not appear as a stop. Data may lag a lap or two behind the live timing.
`
import { useEffect, useState } from 'react'
import { usePositions } from '../../hooks/usePositions'
import { useStints } from '../../hooks/useStints'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { EmptyState } from '../widgetUtils'
import type { OpenF1Stint } from '../../api/openf1'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

// ─── Compound colours ────────────────────────────────────────────────────────

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#e8002d',
  MEDIUM: '#ffd600',
  HARD: '#d0d0d0',
  INTERMEDIATE: '#39b54a',
  INTER: '#39b54a',
  WET: '#0067ff',
}

function compoundColor(compound: string): string {
  return COMPOUND_COLORS[compound?.toUpperCase()] ?? '#888'
}

/** Abbreviate compound to 3-char label */
function compoundLabel(compound: string): string {
  const c = compound?.toUpperCase() ?? '?'
  if (c === 'INTERMEDIATE') return 'INT'
  return c.slice(0, 3)
}

// ─── Derived types ────────────────────────────────────────────────────────────

interface PitStop {
  lap: number
  driverNumber: number
  prevCompound: string
  newCompound: string
  /** Number of laps completed on the outgoing stint, null if unknown */
  stintLaps: number | null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CompoundPillProps {
  compound: string
}

function CompoundPill({ compound }: CompoundPillProps) {
  const color = compoundColor(compound)
  const label = compoundLabel(compound)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }} />
    </span>
  )
}

interface PitRowProps {
  stop: PitStop
  getDriver: (n: number) => { name_acronym?: string } | undefined
  getTeamColor: (n: number) => string
}

function PitRow({ stop, getDriver, getTeamColor }: PitRowProps) {
  const driver = getDriver(stop.driverNumber)
  const code = driver?.name_acronym ?? `#${stop.driverNumber}`
  const teamColor = getTeamColor(stop.driverNumber)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      borderBottom: '0.5px solid var(--border)',
      minHeight: 24,
      boxSizing: 'border-box',
    }}>
      {/* Lap number */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        minWidth: 28,
        flexShrink: 0,
      }}>
        L{stop.lap}
      </span>

      {/* Team colour bar */}
      <div style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: teamColor,
        flexShrink: 0,
      }} />

      {/* Driver code */}
      <span style={{
        fontFamily: 'var(--cond)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--white)',
        minWidth: 28,
        flexShrink: 0,
      }}>
        {code}
      </span>

      {/* Compound change */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        minWidth: 0,
      }}>
        <CompoundPill compound={stop.prevCompound} />
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
        }}>
          →
        </span>
        <CompoundPill compound={stop.newCompound} />
      </div>

      {/* Stint duration */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        flexShrink: 0,
        textAlign: 'right',
        minWidth: 28,
      }}>
        {stop.stintLaps != null ? `${stop.stintLaps}L` : '—'}
      </span>
    </div>
  )
}

// ─── Per-driver stint fetcher ─────────────────────────────────────────────────

interface DriverPitRowsProps {
  driverNumber: number
  getDriver: (n: number) => { name_acronym?: string } | undefined
  getTeamColor: (n: number) => string
  /** Callback to report pit stop count so parent can show the badge */
  onStops?: (count: number) => void
}

/**
 * Renders all pit stop rows for a single driver.
 * Hooks cannot be called in a loop, so we use one component instance per driver.
 * Returns null if this driver has no pit stops yet.
 */
function DriverPitRows({ driverNumber, getDriver, getTeamColor }: DriverPitRowsProps) {
  const { data: stints } = useStints(driverNumber)

  if (!stints || stints.length < 2) return null

  // A pit stop is the transition between consecutive stints (stint n → n+1).
  // We sort by stint_number to be safe.
  const sorted = [...stints].sort((a, b) => a.stint_number - b.stint_number)

  const stops: PitStop[] = sorted.slice(1).map((incomingStint, i) => {
    const outgoing: OpenF1Stint = sorted[i]
    const stintLaps =
      outgoing.lap_end != null
        ? outgoing.lap_end - outgoing.lap_start + 1
        : null

    return {
      lap: incomingStint.lap_start,
      driverNumber,
      prevCompound: outgoing.compound,
      newCompound: incomingStint.compound,
      stintLaps,
    }
  })

  return (
    <>
      {stops.map((stop, i) => (
        <PitRow
          key={`${driverNumber}-${stop.lap}-${i}`}
          stop={stop}
          getDriver={getDriver}
          getTeamColor={getTeamColor}
        />
      ))}
    </>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

/**
 * Aggregates pit stop counts from all DriverPitRows children by scanning the
 * rendered DOM would be fragile, so instead we derive the total from a second
 * pass over stints via a separate pure count component. However, since hooks
 * can't be called conditionally or in loops, the simplest approach is to render
 * a hidden counter that uses the same hook and reports a count. But to avoid
 * the O(2N) fetches we just accept that the badge will not be pre-computed —
 * instead the badge is derived by summing visible rows.
 *
 * In practice we show a rough badge by collecting driver numbers and counting
 * stints per driver at the parent level. We could call useStints for each driver
 * again (React query deduplicates the underlying fetch), but that doubles hook
 * count for no network cost.
 *
 * For simplicity: the parent renders DriverPitCount components (which are
 * invisible, call useStints, and push a count into local state via a callback
 * pattern using useEffect). This approach is safe because the number of components
 * is bounded by the driver count (≤20) and never changes within a session.
 */

interface DriverPitCountProps {
  driverNumber: number
  onCount: (driverNumber: number, count: number) => void
}

/**
 * Invisible component: fetches stints, derives stop count, calls onCount.
 * React Query will serve from cache so no extra network requests.
 */
function DriverPitCount({ driverNumber, onCount }: DriverPitCountProps) {
  const { data: stints } = useStints(driverNumber)

  useEffect(() => {
    const count = stints && stints.length >= 2 ? stints.length - 1 : 0
    onCount(driverNumber, count)
  }, [stints, driverNumber, onCount])

  return null
}

export function PitStopLog({ widgetId: _ }: { widgetId: string }) {
  const { data: positions } = usePositions()
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const refreshFade = useRefreshFade([positions])

  // Track total stop count for the badge
  const [stopCounts, setStopCounts] = useState<Record<number, number>>({})

  const handleCount = (driverNumber: number, count: number) => {
    setStopCounts((prev) => {
      if (prev[driverNumber] === count) return prev
      return { ...prev, [driverNumber]: count }
    })
  }

  const driverNumbers = (positions ?? [])
    .filter((p) => Number.isFinite(p.position) && p.position > 0)
    .sort((a, b) => a.position - b.position)
    .map((p) => p.driver_number)

  const totalStops = Object.values(stopCounts).reduce((sum, n) => sum + n, 0)
  const hasAnyStops = totalStops > 0

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg4)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flex: 1,
        }}>
          Pit Stop Log
        </span>

        {/* Stop count badge */}
        {driverNumbers.length > 0 && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: hasAnyStops ? 'var(--white)' : 'var(--muted2)',
            background: hasAnyStops ? 'var(--bg3)' : 'transparent',
            border: hasAnyStops ? '0.5px solid var(--border)' : 'none',
            borderRadius: 3,
            padding: hasAnyStops ? '1px 5px' : undefined,
            letterSpacing: '0.06em',
          }}>
            {totalStops} {totalStops === 1 ? 'stop' : 'stops'}
          </span>
        )}
      </div>

      {/* Invisible counters — React Query deduplicates fetches from DriverPitRows */}
      {driverNumbers.map((dn) => (
        <DriverPitCount key={dn} driverNumber={dn} onCount={handleCount} />
      ))}

      {/* Scrollable rows area */}
      <SmoothScrollContainer style={{ flex: 1, minHeight: 0 }}>
        {driverNumbers.length === 0 ? (
          <EmptyState message="No pit stops yet" />
        ) : !hasAnyStops ? (
          <EmptyState message="No pit stops yet" subMessage="Waiting for first stop..." />
        ) : (
          // Collect all stops, sort by lap, then render.
          // We render each driver's stops inline; the outer list needs a sort.
          // Since each DriverPitRows renders its own rows, global lap-sorting
          // requires lifting data. We use a wrapper that renders sorted stops
          // from a lightweight in-memory structure.
          <SortedPitList
            driverNumbers={driverNumbers}
            getDriver={getDriver}
            getTeamColor={getTeamColor}
          />
        )}
      </SmoothScrollContainer>
    </div>
  )
}

// ─── Globally sorted list ─────────────────────────────────────────────────────

/**
 * Renders pit stop rows sorted globally by lap number ascending.
 * Uses one DriverStintCollector per driver (safe — fixed list, never changes mid-session).
 * Each collector calls useStints (deduplicated by React Query) and pushes derived
 * stops into a shared accumulator via callback. Once all drivers have reported,
 * we sort and render.
 */

interface CollectedStop extends PitStop {
  key: string
}

interface DriverStintCollectorProps {
  driverNumber: number
  onStops: (driverNumber: number, stops: CollectedStop[]) => void
}

function DriverStintCollector({ driverNumber, onStops }: DriverStintCollectorProps) {
  const { data: stints } = useStints(driverNumber)

  useEffect(() => {
    if (!stints || stints.length < 2) {
      onStops(driverNumber, [])
      return
    }

    const sorted = [...stints].sort((a, b) => a.stint_number - b.stint_number)

    const stops: CollectedStop[] = sorted.slice(1).map((incoming, i) => {
      const outgoing: OpenF1Stint = sorted[i]
      const stintLaps =
        outgoing.lap_end != null
          ? outgoing.lap_end - outgoing.lap_start + 1
          : null

      return {
        key: `${driverNumber}-${incoming.lap_start}-${i}`,
        lap: incoming.lap_start,
        driverNumber,
        prevCompound: outgoing.compound,
        newCompound: incoming.compound,
        stintLaps,
      }
    })

    onStops(driverNumber, stops)
  }, [stints, driverNumber, onStops])

  return null
}

interface SortedPitListProps {
  driverNumbers: number[]
  getDriver: (n: number) => { name_acronym?: string } | undefined
  getTeamColor: (n: number) => string
}

function SortedPitList({ driverNumbers, getDriver, getTeamColor }: SortedPitListProps) {
  const [allStops, setAllStops] = useState<Record<number, CollectedStop[]>>({})

  const handleStops = (driverNumber: number, stops: CollectedStop[]) => {
    setAllStops((prev) => {
      // Avoid re-render if nothing changed
      const existing = prev[driverNumber]
      if (existing?.length === stops.length) return prev
      return { ...prev, [driverNumber]: stops }
    })
  }

  const sortedStops = Object.values(allStops)
    .flat()
    .sort((a, b) => a.lap - b.lap || a.driverNumber - b.driverNumber)

  return (
    <>
      {driverNumbers.map((dn) => (
        <DriverStintCollector key={dn} driverNumber={dn} onStops={handleStops} />
      ))}
      {sortedStops.map((stop) => (
        <PitRow
          key={stop.key}
          stop={stop}
          getDriver={getDriver}
          getTeamColor={getTeamColor}
        />
      ))}
    </>
  )
}
