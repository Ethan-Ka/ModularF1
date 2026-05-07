import { useState, useMemo } from 'react'
import { useSeasonStandings } from '../../hooks/useSeasonStandings'
import { useDriverStore } from '../../store/driverStore'
import { RACE_POINTS_BY_POSITION } from '../../lib/f1Points'
import { EmptyState } from '../widgetUtils'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

interface ChampionshipCalculatorProps {
  widgetId: string
}

type Mode = 'simulate' | 'target'
type TargetType = 'champPos' | 'points'

const TOP_N = 8

function computeNeedForPoints(currentPoints: number, targetPoints: number): string {
  if (currentPoints >= targetPoints) return 'DONE'
  for (let pos = 1; pos <= 10; pos++) {
    const gained = RACE_POINTS_BY_POSITION[pos] ?? 0
    if (currentPoints + gained >= targetPoints) return `P${pos}`
  }
  return 'N/A'
}

function computeNeedForChampPos(
  driverPosition: number,
  driverPoints: number,
  targetChampPos: number,
  standings: Array<{ driverNumber: number; points: number; position: number }>,
): string {
  if (driverPosition <= targetChampPos) return 'DONE'
  const targetStanding = standings[targetChampPos - 1]
  if (!targetStanding) return 'N/A'
  const threshold = targetStanding.points
  for (let pos = 1; pos <= 10; pos++) {
    const gained = RACE_POINTS_BY_POSITION[pos] ?? 0
    if (driverPoints + gained > threshold) return `P${pos}`
  }
  return 'N/A'
}

function needColor(need: string): string {
  if (need === 'DONE' || need === 'N/A') return 'var(--muted2)'
  const n = parseInt(need.slice(1), 10)
  if (n === 1) return 'var(--gold)'
  if (n <= 3) return 'var(--green)'
  if (n <= 10) return 'var(--amber)'
  return 'var(--red)'
}

const SIMULATE_GRID = '22px 4px 38px 42px 34px 40px 36px 44px'
const TARGET_GRID = '22px 4px 38px 42px 44px'

const pillBase: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 7,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  border: '0.5px solid var(--border)',
  borderRadius: 3,
  padding: '2px 6px',
  cursor: 'pointer',
}

export function ChampionshipCalculator({ widgetId: _ }: ChampionshipCalculatorProps) {
  const { standings, isLoading, raceCount } = useSeasonStandings()
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)

  const [hypothetical, setHypothetical] = useState<Record<number, number | null>>({})
  const [mode, setMode] = useState<Mode>('simulate')
  const [targetType, setTargetType] = useState<TargetType>('champPos')
  const [targetChampPos, setTargetChampPos] = useState<number>(1)
  const [targetPoints, setTargetPoints] = useState<number>(0)

  const top = useMemo(() => (standings ?? []).slice(0, TOP_N), [standings])

  const simulateResults = useMemo(() => {
    if (!top.length) return []
    return top
      .map((s) => {
        const hypoPos = hypothetical[s.driverNumber]
        const addedPoints = hypoPos != null ? (RACE_POINTS_BY_POSITION[hypoPos] ?? 0) : 0
        return { ...s, projectedPoints: s.points + addedPoints, addedPoints }
      })
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
  }, [top, hypothetical])

  const targetResults = useMemo(() => {
    if (!top.length) return []
    return top.map((s) => {
      const need =
        targetType === 'points'
          ? computeNeedForPoints(s.points, targetPoints)
          : computeNeedForChampPos(s.position, s.points, targetChampPos, standings ?? [])
      return { ...s, need }
    })
  }, [top, targetType, targetPoints, targetChampPos, standings])

  const leaderProjected = simulateResults[0]?.projectedPoints ?? 0

  if (isLoading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--muted2)',
        }}
      >
        Loading standings…
      </div>
    )
  }

  if (!standings || standings.length === 0) {
    return <EmptyState message="No standings data" />
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg4)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
              whiteSpace: 'nowrap',
            }}
          >
            Championship Calculator
          </span>
          {raceCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: 'var(--muted)',
                background: 'var(--bg3)',
                border: '0.5px solid var(--border)',
                borderRadius: 3,
                padding: '1px 5px',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              Rd {raceCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setMode('simulate')}
            style={{
              ...pillBase,
              background: mode === 'simulate' ? 'var(--bg3)' : 'transparent',
              color: mode === 'simulate' ? 'var(--white)' : 'var(--muted2)',
            }}
          >
            Simulate
          </button>
          <button
            onClick={() => setMode('target')}
            style={{
              ...pillBase,
              background: mode === 'target' ? 'var(--bg3)' : 'transparent',
              color: mode === 'target' ? 'var(--white)' : 'var(--muted2)',
            }}
          >
            Target
          </button>
          {mode === 'simulate' && (
            <button
              onClick={() => setHypothetical({})}
              style={{
                ...pillBase,
                background: 'transparent',
                color: 'var(--muted)',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Target selector bar */}
      {mode === 'target' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderBottom: '0.5px solid var(--border)',
            background: 'var(--bg4)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setTargetType('champPos')}
            style={{
              ...pillBase,
              background: targetType === 'champPos' ? 'var(--bg3)' : 'transparent',
              color: targetType === 'champPos' ? 'var(--white)' : 'var(--muted2)',
            }}
          >
            Champ Pos
          </button>
          <button
            onClick={() => setTargetType('points')}
            style={{
              ...pillBase,
              background: targetType === 'points' ? 'var(--bg3)' : 'transparent',
              color: targetType === 'points' ? 'var(--white)' : 'var(--muted2)',
            }}
          >
            Points
          </button>

          {targetType === 'champPos' ? (
            <select
              value={targetChampPos}
              onChange={(e) => setTargetChampPos(Number(e.target.value))}
              style={{
                background: 'var(--bg4)',
                color: 'var(--white)',
                border: '0.5px solid var(--border)',
                borderRadius: 3,
                padding: '2px 4px',
                fontFamily: 'var(--mono)',
                fontSize: 8,
                cursor: 'pointer',
              }}
            >
              {Array.from({ length: TOP_N }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  P{i + 1}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={0}
              value={targetPoints}
              onChange={(e) => setTargetPoints(Math.max(0, Number(e.target.value)))}
              style={{
                background: 'var(--bg4)',
                color: 'var(--white)',
                border: '0.5px solid var(--border)',
                borderRadius: 3,
                padding: '2px 4px',
                fontFamily: 'var(--mono)',
                fontSize: 8,
                width: 52,
              }}
            />
          )}
        </div>
      )}

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: mode === 'simulate' ? SIMULATE_GRID : TARGET_GRID,
          alignItems: 'center',
          columnGap: 4,
          padding: '3px 10px',
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg4)',
          flexShrink: 0,
        }}
      >
        {(mode === 'simulate'
          ? ['CHMP', '', 'DRIVER', 'NOW', '+PTS', 'PROJ', 'GAP', 'RACE']
          : ['CHMP', '', 'DRIVER', 'NOW', 'NEED']
        ).map((label, i) => (
          <span
            key={i}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              letterSpacing: '0.08em',
              color: 'var(--muted2)',
              textAlign: i === 0 || i >= 3 ? 'right' : 'left',
              visibility: i === 1 ? 'hidden' : 'visible',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Rows */}
      <SmoothScrollContainer style={{ flex: 1, minHeight: 0 }}>
        {mode === 'simulate'
          ? simulateResults.map((row, idx) => {
              const driver = getDriver(row.driverNumber)
              const teamColor = getTeamColor(row.driverNumber)
              const acronym = driver?.name_acronym ?? `#${row.driverNumber}`
              const projPos = idx + 1
              const gap = leaderProjected - row.projectedPoints
              const isLeader = projPos === 1

              return (
                <div
                  key={row.driverNumber}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: SIMULATE_GRID,
                    alignItems: 'center',
                    columnGap: 4,
                    padding: '0 10px',
                    height: 32,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: projPos <= 3 ? 'var(--gold)' : 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {projPos}
                  </span>

                  <div
                    style={{
                      width: 3,
                      height: 16,
                      borderRadius: 2,
                      background: teamColor,
                      flexShrink: 0,
                    }}
                  />

                  <span
                    style={{
                      fontFamily: 'var(--cond)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--white)',
                      letterSpacing: '0.02em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acronym}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {row.points}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: row.addedPoints > 0 ? 'var(--green)' : 'var(--muted2)',
                      textAlign: 'right',
                    }}
                  >
                    {row.addedPoints > 0 ? `+${row.addedPoints}` : '—'}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--cond)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: isLeader ? 'var(--white)' : 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {row.projectedPoints}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 8,
                      color: isLeader ? 'var(--gold)' : 'var(--red)',
                      textAlign: 'right',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isLeader ? 'LEAD' : `-${gap}`}
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <select
                      value={hypothetical[row.driverNumber] ?? ''}
                      onChange={(e) =>
                        setHypothetical((prev) => ({
                          ...prev,
                          [row.driverNumber]: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                      style={{
                        background: 'var(--bg4)',
                        color: 'var(--white)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 3,
                        padding: '2px 4px',
                        fontFamily: 'var(--mono)',
                        fontSize: 8,
                        width: 40,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">—</option>
                      {Array.from({ length: 20 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {`P${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })
          : targetResults.map((row) => {
              const driver = getDriver(row.driverNumber)
              const teamColor = getTeamColor(row.driverNumber)
              const acronym = driver?.name_acronym ?? `#${row.driverNumber}`

              return (
                <div
                  key={row.driverNumber}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: TARGET_GRID,
                    alignItems: 'center',
                    columnGap: 4,
                    padding: '0 10px',
                    height: 32,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: row.position <= 3 ? 'var(--gold)' : 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {row.position}
                  </span>

                  <div
                    style={{
                      width: 3,
                      height: 16,
                      borderRadius: 2,
                      background: teamColor,
                      flexShrink: 0,
                    }}
                  />

                  <span
                    style={{
                      fontFamily: 'var(--cond)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--white)',
                      letterSpacing: '0.02em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acronym}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {row.points}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: needColor(row.need),
                      textAlign: 'right',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {row.need}
                  </span>
                </div>
              )
            })}
      </SmoothScrollContainer>

      {/* Footer */}
      <div
        style={{
          padding: '4px 10px',
          borderTop: '0.5px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--muted2)',
            letterSpacing: '0.06em',
          }}
        >
          Points based on standard race scoring
        </span>
      </div>
    </div>
  )
}

export const HELP = `# Championship Calculator

Quick what-if calculator for driver championship outcomes.

- **Simulate**: assign hypothetical finishing positions for the top drivers to see projected points and ranking changes.
- **Target**: switch to *Champ Pos* to calculate the minimum race finish needed to achieve a particular championship position, or *Points* to compute required points.

Unfamiliar terms:

- *P1..P10*: finishing positions (P1 = win) used to look up race points.
- *Proj*: projected points after applying a hypothetical result.

Notes: this tool only considers the top drivers in the current standings and uses the standard points table.
`
