import { useMemo } from 'react'
import { usePositions } from '../../hooks/usePositions'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { RACE_POINTS_BY_POSITION } from '../../lib/f1Points'

interface StandingsBoardProps {
  widgetId: string
}

interface DriverStandingRow {
  driverNumber: number
  position: number
  code: string
  teamName: string
  teamColor: string
  points: number
}

interface TeamStandingRow {
  teamName: string
  teamColor: string
  points: number
  bestPosition: number
  averagePosition: number
  carsRunning: number
}

function getProjectedPoints(position: number): number {
  return RACE_POINTS_BY_POSITION[position] ?? 0
}

export function StandingsBoard({ widgetId: _ }: StandingsBoardProps) {
  const { data: positions } = usePositions()
  const { getDriver, getTeamColor } = useDriverStore()
  const refreshFade = useRefreshFade([positions])

  const data = useMemo(() => {
    const rows = (positions ?? [])
      .filter((row) => Number.isFinite(row.position) && row.position > 0)
      .sort((a, b) => a.position - b.position)

    const driverRows: DriverStandingRow[] = rows.map((row) => {
      const driver = getDriver(row.driver_number)
      const teamName = driver?.team_name ?? 'Unknown Team'
      const code = driver?.name_acronym ?? `#${row.driver_number}`
      const points = getProjectedPoints(row.position)

      return {
        driverNumber: row.driver_number,
        position: row.position,
        code,
        teamName,
        teamColor: getTeamColor(row.driver_number),
        points,
      }
    })

    const teamAccumulator = new Map<string, TeamStandingRow>()

    for (const row of driverRows) {
      const existing = teamAccumulator.get(row.teamName)
      if (!existing) {
        teamAccumulator.set(row.teamName, {
          teamName: row.teamName,
          teamColor: row.teamColor,
          points: row.points,
          bestPosition: row.position,
          averagePosition: row.position,
          carsRunning: 1,
        })
        continue
      }

      const carsRunning = existing.carsRunning + 1
      teamAccumulator.set(row.teamName, {
        ...existing,
        points: existing.points + row.points,
        bestPosition: Math.min(existing.bestPosition, row.position),
        averagePosition: (existing.averagePosition * existing.carsRunning + row.position) / carsRunning,
        carsRunning,
      })
    }

    const teamRows = Array.from(teamAccumulator.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (a.averagePosition !== b.averagePosition) return a.averagePosition - b.averagePosition
      return a.teamName.localeCompare(b.teamName)
    })

    return { driverRows, teamRows }
  }, [positions, getDriver, getTeamColor])

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
        Waiting for standings data...
      </div>
    )
  }

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: 8,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <section
        style={{
          border: '0.5px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <TableHeader title="Driver Standings" />
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {data.driverRows.map((row) => (
            <div
              key={row.driverNumber}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 4px 1fr 36px',
                alignItems: 'center',
                columnGap: 6,
                padding: '5px 8px',
                borderBottom: '0.5px solid var(--border)',
                minHeight: 24,
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
                  height: 14,
                  borderRadius: 2,
                  background: row.teamColor,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--white)',
                    lineHeight: 1,
                  }}
                >
                  {row.code}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 7,
                    color: 'var(--muted2)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.teamName}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--cond)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: row.points > 0 ? 'var(--white)' : 'var(--muted2)',
                  textAlign: 'right',
                }}
              >
                {row.points}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          border: '0.5px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <TableHeader title="Constructor Stats" />
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {data.teamRows.map((team, index) => (
            <div
              key={team.teamName}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 4px 1fr 34px 30px',
                alignItems: 'center',
                columnGap: 6,
                padding: '5px 8px',
                borderBottom: '0.5px solid var(--border)',
                minHeight: 24,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: index < 3 ? 'var(--gold)' : 'var(--muted)',
                  textAlign: 'right',
                }}
              >
                {index + 1}
              </span>
              <div
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 2,
                  background: team.teamColor,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--white)',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {team.teamName}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 7,
                    color: 'var(--muted2)',
                    letterSpacing: '0.04em',
                  }}
                >
                  P{team.bestPosition} BEST
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  color: 'var(--muted2)',
                  textAlign: 'right',
                }}
              >
                {team.averagePosition.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: 'var(--cond)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: team.points > 0 ? 'var(--white)' : 'var(--muted2)',
                  textAlign: 'right',
                }}
              >
                {team.points}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TableHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        padding: '6px 8px',
        background: 'var(--bg4)',
        borderBottom: '0.5px solid var(--border)',
        columnGap: 8,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.08em',
        }}
      >
        PTS
      </span>
    </div>
  )
}
