import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSeasonStandings, type DriverSeasonStanding } from '../../hooks/useSeasonStandings'
import { useDriverStore } from '../../store/driverStore'
import { DriverProfileModal } from '../DriverProfile/DriverProfileModal'

interface SeasonStandingsModalProps {
  onClose: () => void
}

function positionAccentColor(pos: number): string {
  if (pos === 1) return '#C9A84C'
  if (pos === 2) return '#9EA3A8'
  if (pos === 3) return '#B87333'
  return 'var(--muted)'
}

// Tiny colored square representing a single race result
function RaceDot({
  position,
  circuit,
  teamColor,
}: {
  position: number
  circuit: string
  teamColor: string
}) {
  const [hovered, setHovered] = useState(false)
  const bg =
    position === 1
      ? '#C9A84C'
      : position <= 3
        ? '#9EA3A8'
        : position <= 10
          ? teamColor
          : 'var(--bg4)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 7,
        height: 7,
        borderRadius: 1,
        background: bg,
        opacity: position > 10 ? 0.35 : 1,
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 4,
            background: 'var(--bg4)',
            border: '0.5px solid var(--border2)',
            borderRadius: 3,
            padding: '2px 6px',
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--white)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {circuit} · P{position}
        </div>
      )}
    </div>
  )
}

interface DriverRowProps {
  standing: DriverSeasonStanding
  rank: number
  maxPoints: number
  leaderPoints: number
  isHero: boolean
  staggerIndex: number
  onViewProfile: () => void
}

function DriverRow({ standing, rank, maxPoints, leaderPoints, isHero, staggerIndex, onViewProfile }: DriverRowProps) {
  const { getDriver, getTeamColor } = useDriverStore()
  const driver = getDriver(standing.driverNumber)
  const teamColor = getTeamColor(standing.driverNumber)
  const code = driver?.name_acronym ?? `#${standing.driverNumber}`
  const fullName = driver?.full_name ?? `Driver ${standing.driverNumber}`
  const teamName = driver?.team_name ?? '—'
  const headshotUrl = driver?.headshot_url
  const gap = leaderPoints - standing.points
  const barPct = maxPoints > 0 ? (standing.points / maxPoints) * 100 : 0

  return (
    <div
      onClick={onViewProfile}
      className="stagger-item interactive-card"
      style={
        {
          '--stagger-delay': `${Math.min(staggerIndex * 22, 300)}ms`,
          display: 'flex',
          flexDirection: 'column',
          borderBottom: '0.5px solid var(--border)',
          background: isHero
            ? `linear-gradient(90deg, ${teamColor}18 0%, transparent 60%)`
            : 'transparent',
          transition: 'background 0.15s',
          cursor: 'pointer',
          borderRadius: 0,
        } as React.CSSProperties
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isHero ? '38px 3px 44px 1fr 52px' : '32px 3px 36px 1fr 48px',
          alignItems: 'center',
          columnGap: 8,
          padding: isHero ? '10px 12px 6px' : '7px 12px 4px',
        }}
      >
        {/* Position */}
        <span
          style={{
            fontFamily: 'var(--cond)',
            fontSize: isHero ? 22 : 14,
            fontWeight: 800,
            color: positionAccentColor(rank),
            lineHeight: 1,
            letterSpacing: '-0.02em',
            textAlign: 'right',
          }}
        >
          P{rank}
        </span>

        {/* Team color bar */}
        <div
          style={{
            width: 3,
            height: isHero ? 28 : 20,
            borderRadius: 2,
            background: teamColor,
            boxShadow: isHero ? `0 0 6px ${teamColor}88` : 'none',
          }}
        />

        {/* Headshot / number */}
        <div
          style={{
            width: isHero ? 44 : 36,
            height: isHero ? 44 : 36,
            borderRadius: 3,
            overflow: 'hidden',
            background: 'var(--bg4)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {headshotUrl ? (
            <img
              src={headshotUrl}
              alt={code}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: 'var(--cond)',
                fontSize: isHero ? 14 : 11,
                fontWeight: 800,
                color: teamColor,
                letterSpacing: '-0.02em',
              }}
            >
              {code}
            </span>
          )}
        </div>

        {/* Driver info */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--cond)',
                fontSize: isHero ? 20 : 15,
                fontWeight: 800,
                color: 'var(--white)',
                lineHeight: 1,
                letterSpacing: '0.01em',
              }}
            >
              {code}
            </span>
            <span
              style={{
                fontFamily: 'var(--body)',
                fontSize: isHero ? 11 : 9,
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fullName.split(' ').slice(1).join(' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: 'var(--muted2)',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {teamName.toUpperCase()}
            </span>
            {/* Win indicators */}
            {standing.wins > 0 && (
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {Array.from({ length: Math.min(standing.wins, 8) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      background: '#C9A84C',
                      borderRadius: 1,
                      opacity: 0.9,
                    }}
                  />
                ))}
                {standing.wins > 8 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: '#C9A84C' }}>
                    +{standing.wins - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Points + gap */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span
            style={{
              fontFamily: 'var(--cond)',
              fontSize: isHero ? 24 : 16,
              fontWeight: 800,
              color: isHero ? positionAccentColor(1) : 'var(--white)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {standing.points}
          </span>
          {!isHero && gap > 0 && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: 'var(--muted2)',
                letterSpacing: '0.04em',
                marginTop: 1,
              }}
            >
              -{gap}
            </span>
          )}
          {isHero && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: '#C9A84C',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              LEADER
            </span>
          )}
        </div>
      </div>

      {/* Points bar */}
      <div style={{ padding: '0 12px 4px', paddingLeft: isHero ? 53 : 43 }}>
        <div
          style={{
            height: isHero ? 3 : 2,
            background: 'var(--bg4)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${barPct}%`,
              background: isHero
                ? `linear-gradient(90deg, ${teamColor}, ${teamColor}88)`
                : teamColor,
              borderRadius: 2,
              boxShadow: isHero ? `0 0 4px ${teamColor}` : 'none',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        {/* Race result dots */}
        {standing.raceResults.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center' }}>
            {standing.raceResults.map((r) => (
              <RaceDot
                key={r.round}
                position={r.position}
                circuit={r.circuitShortName}
                teamColor={teamColor}
              />
            ))}
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 6,
                color: 'var(--muted2)',
                marginLeft: 2,
                letterSpacing: '0.06em',
              }}
            >
              {standing.podiums > 0 ? `${standing.podiums}×PDM` : ''}
              {standing.podiums > 0 && standing.wins > 0 ? ' · ' : ''}
              {standing.wins > 0 ? `${standing.wins}×WIN` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface ConstructorRowProps {
  teamName: string
  teamColor: string
  teamLogo: string | null
  points: number
  wins: number
  podiums: number
  maxPoints: number
  rank: number
  staggerIndex: number
}

function ConstructorRow({
  teamName,
  teamColor,
  teamLogo,
  points,
  wins,
  podiums,
  maxPoints,
  rank,
  staggerIndex,
}: ConstructorRowProps) {
  const barPct = maxPoints > 0 ? (points / maxPoints) * 100 : 0

  return (
    <div
      className="stagger-item"
      style={
        {
          '--stagger-delay': `${Math.min(staggerIndex * 30, 300)}ms`,
          borderBottom: '0.5px solid var(--border)',
        } as React.CSSProperties
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 3px 1fr 44px',
          alignItems: 'center',
          columnGap: 8,
          padding: '8px 12px 5px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 14,
            fontWeight: 800,
            color: positionAccentColor(rank),
            textAlign: 'right',
          }}
        >
          P{rank}
        </span>
        <div
          style={{
            width: 3,
            height: 22,
            borderRadius: 2,
            background: teamColor,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {teamLogo && (
              <img
                src={teamLogo}
                alt={teamName}
                style={{
                  height: 14,
                  width: 'auto',
                  maxWidth: 28,
                  objectFit: 'contain',
                  opacity: 0.85,
                  flexShrink: 0,
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--white)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '0.02em',
              }}
            >
              {teamName}
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              color: 'var(--muted2)',
              letterSpacing: '0.06em',
              marginTop: 1,
            }}
          >
            {wins > 0 ? `${wins}W · ` : ''}{podiums > 0 ? `${podiums} PDM` : 'No podiums yet'}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--white)',
            textAlign: 'right',
          }}
        >
          {points}
        </span>
      </div>
      <div style={{ padding: '0 12px 6px', paddingLeft: 51 }}>
        <div
          style={{
            height: 2,
            background: 'var(--bg4)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${barPct}%`,
              background: teamColor,
              borderRadius: 2,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function SeasonStandingsModal({ onClose }: SeasonStandingsModalProps) {
  const EXIT_MS = 220
  const [isClosing, setIsClosing] = useState(false)
  const [profileDriverNumber, setProfileDriverNumber] = useState<number | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { standings, isLoading, isRefreshing, raceCount, loadedCount, totalFetchSteps } = useSeasonStandings(2026)
  const { getDriver, getTeamColor, getTeamLogo } = useDriverStore()

  function handleRequestClose() {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(onClose, EXIT_MS)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleRequestClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const maxDriverPoints = standings?.[0]?.points ?? 1

  // Build constructor standings from driver data
  const constructorStandings = useMemo(() => {
    if (!standings) return []

    const teamMap = new Map<
      string,
      {
        teamName: string
        teamColor: string
        teamLogo: string | null
        points: number
        wins: number
        podiums: number
      }
    >()

    for (const d of standings) {
      const driver = getDriver(d.driverNumber)
      const teamName = driver?.team_name ?? 'Unknown'
      const existing = teamMap.get(teamName)
      if (!existing) {
        teamMap.set(teamName, {
          teamName,
          teamColor: getTeamColor(d.driverNumber),
          teamLogo: getTeamLogo(d.driverNumber),
          points: d.points,
          wins: d.wins,
          podiums: d.podiums,
        })
      } else {
        teamMap.set(teamName, {
          ...existing,
          points: existing.points + d.points,
          wins: existing.wins + d.wins,
          podiums: existing.podiums + d.podiums,
        })
      }
    }

    return Array.from(teamMap.values()).sort((a, b) => b.points - a.points)
  }, [standings, getDriver, getTeamColor, getTeamLogo])

  const maxConstructorPoints = constructorStandings[0]?.points ?? 1

  // Leader color for ambient tint
  const leaderColor = standings?.[0]
    ? getTeamColor(standings[0].driverNumber)
    : 'var(--red)'

  const loadProgress = Math.round((loadedCount / totalFetchSteps) * 100)

  const modal = createPortal(
    <div
      onClick={handleRequestClose}
      className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 60,
        paddingBottom: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={isClosing ? 'modal-panel modal-panel-exit' : 'modal-panel'}
        style={{
          width: 'min(1040px, calc(100vw - 80px))',
          maxHeight: 'calc(100vh - 120px)',
          background: 'var(--bg3)',
          border: '0.5px solid var(--border2)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `0 0 60px ${leaderColor}18, 0 24px 48px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '0.5px solid var(--border)',
            flexShrink: 0,
            gap: 12,
            background: `linear-gradient(90deg, ${leaderColor}0a 0%, transparent 50%)`,
          }}
        >
          {/* Red accent stripe */}
          <div
            style={{
              width: 3,
              height: 20,
              background: 'var(--red)',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: 'var(--white)',
                lineHeight: 1,
              }}
            >
              2026 CHAMPIONSHIP
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted2)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              {isLoading
                ? `Loading race data… ${loadProgress}%`
                : isRefreshing
                  ? `${raceCount} Rounds · Updating…`
                  : `${raceCount} Round${raceCount !== 1 ? 's' : ''} Complete`}
            </span>
          </div>

          {/* Race circuit labels strip */}
          {!isLoading && standings && standings[0]?.raceResults.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                marginLeft: 12,
                flexWrap: 'wrap',
              }}
            >
              {standings[0].raceResults.map((r, i) => (
                <span
                  key={r.round}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 7,
                    color: 'var(--muted2)',
                    letterSpacing: '0.08em',
                    padding: '2px 5px',
                    border: '0.5px solid var(--border)',
                    borderRadius: 2,
                  }}
                >
                  R{i + 1} {r.circuitShortName.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={handleRequestClose}
            className="interactive-button"
            style={{
              background: 'none',
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              padding: '4px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              color: 'var(--muted2)',
              cursor: 'pointer',
            }}
          >
            ESC
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: 40,
            }}
          >
            <div
              style={{
                width: 200,
                height: 2,
                background: 'var(--bg4)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${loadProgress || 8}%`,
                  background: 'var(--red)',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted2)',
                letterSpacing: '0.1em',
              }}
            >
              {loadedCount === 0
                ? 'Fetching standings…'
                : 'Fetching race results…'}
            </span>
          </div>
        )}

        {/* No data */}
        {!isLoading && (!standings || standings.length === 0) && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--muted2)',
              letterSpacing: '0.1em',
            }}
          >
            No completed races found for 2026
          </div>
        )}

        {/* Main content — two columns */}
        {!isLoading && standings && standings.length > 0 && (
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 360px',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {/* Drivers championship */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '0.5px solid var(--border)' }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: '0.5px solid var(--border)',
                  background: 'var(--bg4)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted2)',
                  }}
                >
                  Drivers
                </span>
                <div style={{ flex: 1 }} />
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
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {standings.map((standing, i) => (
                  <DriverRow
                    key={standing.driverNumber}
                    standing={standing}
                    rank={i + 1}
                    maxPoints={maxDriverPoints}
                    leaderPoints={maxDriverPoints}
                    isHero={i === 0}
                    staggerIndex={i}
                    onViewProfile={() => setProfileDriverNumber(standing.driverNumber)}
                  />
                ))}
              </div>
            </div>

            {/* Constructors championship */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: '0.5px solid var(--border)',
                  background: 'var(--bg4)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted2)',
                  }}
                >
                  Constructors
                </span>
                <div style={{ flex: 1 }} />
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
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {constructorStandings.map((team, i) => (
                  <ConstructorRow
                    key={team.teamName}
                    rank={i + 1}
                    teamName={team.teamName}
                    teamColor={team.teamColor}
                    teamLogo={team.teamLogo}
                    points={team.points}
                    wins={team.wins}
                    podiums={team.podiums}
                    maxPoints={maxConstructorPoints}
                    staggerIndex={i}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <>
      {modal}
      {profileDriverNumber !== null && (
        <DriverProfileModal
          driverNumber={profileDriverNumber}
          onClose={() => setProfileDriverNumber(null)}
        />
      )}
    </>
  )
}
