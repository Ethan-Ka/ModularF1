export const HELP = `# Strategy Timeline

Horizontal timeline showing every driver's stint history across the race, ordered by current position.

- **Rows**: One row per driver (top = P1, bottom = P20). Driver code and team color bar on the left.
- **Stint bars**: Color-coded by tyre compound — Soft (red), Medium (yellow), Hard (grey), Intermediate (green), Wet (blue).
- **Lap axis**: Horizontal axis spans the full race distance. Each bar covers the laps driven on that set of tyres.
- **Pit markers**: Visible as gaps between consecutive stint bars.

Unfamiliar terms:

- *Stint*: A continuous run on one tyre set. Stint 1 starts at race start; each pit stop begins a new stint.
- *Undercut*: Pitting earlier than a rival to gain track position through a faster out-lap on fresh tyres.
- *Overcut*: Staying out longer than a rival, allowing them to pit first and hoping to maintain position through pace or traffic.

Notes: stints are loaded per driver and may arrive at slightly different times. Drivers who have not yet completed a lap may not appear.
`
import { useMemo } from 'react'
import { usePositions } from '../../hooks/usePositions'
import { useStints } from '../../hooks/useStints'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import type { OpenF1Driver } from '../../api/openf1'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

const DEFAULT_MAX_LAP = 70

const COMPOUND_COLOR: Record<string, string> = {
  SOFT: '#e8002d',
  MEDIUM: '#ffd600',
  HARD: '#d0d0d0',
  INTERMEDIATE: '#39b54a',
  INTER: '#39b54a',
  WET: '#0067ff',
}

function compoundColor(c: string): string {
  return COMPOUND_COLOR[c?.toUpperCase()] ?? '#555'
}

// ─── Sub-component: one row per driver ───────────────────────────────────────

interface DriverRowProps {
  driverNumber: number
  position: number
  maxLap: number
  getDriver: (n: number) => OpenF1Driver | undefined
  getTeamColor: (n: number) => string
}

function DriverRow({ driverNumber, position, maxLap, getDriver, getTeamColor }: DriverRowProps) {
  const { data: stints } = useStints(driverNumber)

  const driver = getDriver(driverNumber)
  const code = driver?.name_acronym ?? `#${driverNumber}`
  const teamColor = getTeamColor(driverNumber)
  const isTopThree = position <= 3

  const sortedStints = useMemo(() => {
    if (!stints || stints.length === 0) return []
    return [...stints].sort((a, b) => a.lap_start - b.lap_start)
  }, [stints])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 22,
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Left label: position, team color bar, driver code */}
      <div
        style={{
          width: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 6,
          paddingRight: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: isTopThree ? 'var(--gold)' : 'var(--muted)',
            minWidth: 14,
            textAlign: 'right',
          }}
        >
          {position}
        </span>
        <div
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: teamColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--white)',
            lineHeight: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {code}
        </span>
      </div>

      {/* Right side: stint bars */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          minWidth: 0,
        }}
      >
        {sortedStints.map((stint, index) => {
          const lapStart = stint.lap_start
          const lapEnd = stint.lap_end ?? maxLap
          const clampedEnd = Math.min(lapEnd, maxLap)
          const clampedStart = Math.max(lapStart, 0)

          const leftPct = (clampedStart / maxLap) * 100
          const widthPct = Math.max(0, ((clampedEnd - clampedStart) / maxLap) * 100)

          return (
            <div key={`${stint.stint_number ?? index}-${lapStart}`}>
              {/* Pit marker: vertical line at start of this stint (not first) */}
              {index > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'var(--muted2)',
                    opacity: 0.6,
                  }}
                />
              )}
              {/* Stint bar */}
              <div
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: 8,
                  borderRadius: 2,
                  background: compoundColor(stint.compound),
                  minWidth: widthPct > 0 ? 2 : 0,
                }}
                title={`${stint.compound} — L${lapStart}–L${lapEnd}`}
              />
            </div>
          )
        })}

        {/* Empty state: dim track bar */}
        {sortedStints.length === 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 2,
              background: 'var(--border)',
              borderRadius: 1,
              opacity: 0.5,
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Lap axis ruler ───────────────────────────────────────────────────────────

function LapAxis({ maxLap }: { maxLap: number }) {
  const ticks = useMemo(() => {
    const result: number[] = []
    for (let lap = 0; lap <= maxLap; lap += 10) {
      result.push(lap)
    }
    return result
  }, [maxLap])

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        height: 14,
        flexShrink: 0,
        marginLeft: 64,
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      {ticks.map((lap) => {
        const leftPct = (lap / maxLap) * 100
        return (
          <div
            key={lap}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {/* Tick mark */}
            <div
              style={{
                width: 1,
                height: 4,
                background: 'var(--muted2)',
                opacity: 0.5,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: 'var(--muted2)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {lap === 0 ? 'L0' : lap}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function StrategyTimeline({ widgetId: _ }: { widgetId: string }) {
  const { data: positions } = usePositions()
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const refreshFade = useRefreshFade([positions])

  const sortedPositions = useMemo(() => {
    if (!positions || positions.length === 0) return []
    return [...positions]
      .filter((p) => Number.isFinite(p.position) && p.position > 0)
      .sort((a, b) => a.position - b.position)
  }, [positions])

  if (!positions || positions.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--muted2)',
        }}
      >
        Waiting for session data...
      </div>
    )
  }

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Widget header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 8px',
          background: 'var(--bg4)',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
          }}
        >
          Strategy Timeline
        </span>
        {/* Compound legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const).map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div
                style={{
                  width: 8,
                  height: 6,
                  borderRadius: 1,
                  background: compoundColor(c),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 7,
                  color: 'var(--muted2)',
                  letterSpacing: '0.04em',
                }}
              >
                {c === 'INTERMEDIATE' ? 'INT' : c[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lap axis ruler */}
      <LapAxis maxLap={DEFAULT_MAX_LAP} />

      {/* Driver rows — scrollable */}
      <SmoothScrollContainer
        style={{
          flex: 1,
          minHeight: 0,
        }}
      >
        {sortedPositions.map((pos) => (
          <DriverRow
            key={pos.driver_number}
            driverNumber={pos.driver_number}
            position={pos.position}
            maxLap={DEFAULT_MAX_LAP}
            getDriver={getDriver}
            getTeamColor={getTeamColor}
          />
        ))}
      </SmoothScrollContainer>
    </div>
  )
}
