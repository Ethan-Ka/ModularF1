export const HELP = `# Standings Table

Season championship standings for the current year, with tabs for drivers and constructors.

- **Drivers tab**: Championship position, driver name, team, total points this season, and number of race wins.
- **Constructors tab**: Constructor (team) championship position, team name, combined driver points, and wins.
- **Points**: Accumulated across all completed rounds of the season (not just the current race).

Unfamiliar terms:

- *Constructors' Championship*: A separate title awarded to the team (constructor) that accumulates the most points across both their drivers over the season.
- *Wins*: Total race victories for the driver or constructor this season.
- *Round*: A single race weekend in the calendar.

Notes: standings are fetched from the season results database and update after each completed race. Data may lag by a few hours after the race finishes. For live in-race projected standings, use the Standings Board widget instead.
`
import { useState, useMemo } from 'react'
import { useSeasonStandings } from '../../hooks/useSeasonStandings'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { EmptyState } from '../widgetUtils'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

interface StandingsTableProps {
  widgetId: string
}

type Tab = 'drivers' | 'constructors'

interface ConstructorRow {
  name: string
  color: string
  points: number
  wins: number
  drivers: string[]
}

export function StandingsTable({ widgetId: _ }: StandingsTableProps) {
  const [tab, setTab] = useState<Tab>('drivers')
  const { standings, isLoading, raceCount } = useSeasonStandings(2026)
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const refreshFade = useRefreshFade([standings])

  const constructors = useMemo<ConstructorRow[]>(() => {
    if (!standings) return []
    const teams = new Map<string, ConstructorRow>()
    for (const s of standings) {
      const driver = getDriver(s.driverNumber)
      if (!driver) continue
      const teamName = driver.team_name
      const color = getTeamColor(s.driverNumber)
      const existing = teams.get(teamName)
      if (existing) {
        existing.points += s.points
        existing.wins += s.wins
        existing.drivers.push(driver.name_acronym)
      } else {
        teams.set(teamName, {
          name: teamName,
          color,
          points: s.points,
          wins: s.wins,
          drivers: [driver.name_acronym],
        })
      }
    }
    return [...teams.values()].sort((a, b) => b.points - a.points)
  }, [standings, getDriver, getTeamColor])

  const championshipTitle =
    tab === 'drivers'
      ? "DRIVERS' CHAMPIONSHIP 2026"
      : "CONSTRUCTORS' CHAMPIONSHIP 2026"

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px 0',
          flexShrink: 0,
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
          {championshipTitle}
        </span>
        {raceCount > 0 && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              color: 'var(--muted2)',
              background: 'var(--bg4)',
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              padding: '1px 4px',
              letterSpacing: '0.06em',
            }}
          >
            Rd {raceCount}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
          marginTop: 4,
        }}
      >
        {(['drivers', 'constructors'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: tab === t ? 'var(--white)' : 'var(--muted2)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
              padding: '5px 10px',
              cursor: 'pointer',
              marginBottom: -1, // overlap the container border-bottom
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Column headers */}
      {!isLoading && standings && standings.length > 0 && (
        <ColumnHeaders tab={tab} />
      )}

      {/* Body */}
      <SmoothScrollContainer style={{ flex: 1, minHeight: 0 }}>
        {isLoading ? (
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
            Loading standings…
          </div>
        ) : !standings || standings.length === 0 ? (
          <EmptyState message="No standings data" />
        ) : tab === 'drivers' ? (
          standings.map((s, index) => {
            const driver = getDriver(s.driverNumber)
            const code = driver?.name_acronym ?? `#${s.driverNumber}`
            const fullName = driver?.full_name ?? ''
            const teamName = driver?.team_name ?? '—'
            const color = getTeamColor(s.driverNumber)
            const pos = index + 1
            return (
              <DriverRow
                key={s.driverNumber}
                pos={pos}
                code={code}
                fullName={fullName}
                teamName={teamName}
                teamColor={color}
                points={s.points}
                wins={s.wins}
                podiums={s.podiums}
              />
            )
          })
        ) : (
          constructors.map((c, index) => (
            <ConstructorRow
              key={c.name}
              pos={index + 1}
              name={c.name}
              color={c.color}
              points={c.points}
              wins={c.wins}
              drivers={c.drivers}
            />
          ))
        )}
      </SmoothScrollContainer>
    </div>
  )
}

function ColumnHeaders({ tab }: { tab: Tab }) {
  const cols =
    tab === 'drivers'
      ? ['POS', '', 'DRIVER', 'TEAM', 'PTS', 'W', 'POD']
      : ['POS', '', 'TEAM', 'DRIVERS', 'PTS', 'W']

  const gridTemplate =
    tab === 'drivers'
      ? '20px 4px 1fr 52px 30px 20px 24px'
      : '20px 4px 1fr 52px 30px 20px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
        columnGap: 5,
        padding: '3px 8px',
        background: 'var(--bg4)',
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {cols.map((col, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.08em',
            color: 'var(--muted2)',
            textAlign: col === 'POS' || col === 'PTS' || col === 'W' || col === 'POD' ? 'right' : 'left',
          }}
        >
          {col}
        </span>
      ))}
    </div>
  )
}

interface DriverRowProps {
  pos: number
  code: string
  fullName: string
  teamName: string
  teamColor: string
  points: number
  wins: number
  podiums: number
}

function DriverRow({ pos, code, fullName, teamName, teamColor, points, wins, podiums }: DriverRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 4px 1fr 52px 30px 20px 24px',
        alignItems: 'center',
        columnGap: 5,
        padding: '0 8px',
        height: 28,
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* POS */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: pos <= 3 ? 'var(--gold)' : 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {pos}
      </span>

      {/* Team color bar */}
      <div
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          background: teamColor,
          flexShrink: 0,
        }}
      />

      {/* Driver name */}
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
          {code}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--muted2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {fullName}
        </span>
      </div>

      {/* Team */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {teamName}
      </span>

      {/* PTS */}
      <span
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--white)',
          textAlign: 'right',
        }}
      >
        {points}
      </span>

      {/* W */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {wins}
      </span>

      {/* POD */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {podiums}
      </span>
    </div>
  )
}

interface ConstructorRowProps {
  pos: number
  name: string
  color: string
  points: number
  wins: number
  drivers: string[]
}

function ConstructorRow({ pos, name, color, points, wins, drivers }: ConstructorRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 4px 1fr 52px 30px 20px',
        alignItems: 'center',
        columnGap: 5,
        padding: '0 8px',
        height: 28,
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* POS */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: pos <= 3 ? 'var(--gold)' : 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {pos}
      </span>

      {/* Team color bar */}
      <div
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />

      {/* Team name */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--white)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--muted2)',
            lineHeight: 1.2,
          }}
        >
          {drivers.join(' · ')}
        </span>
      </div>

      {/* Drivers column (acronyms repeated small for layout symmetry) */}
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
        {drivers.join(' ')}
      </span>

      {/* PTS */}
      <span
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--white)',
          textAlign: 'right',
        }}
      >
        {points}
      </span>

      {/* W */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {wins}
      </span>
    </div>
  )
}
