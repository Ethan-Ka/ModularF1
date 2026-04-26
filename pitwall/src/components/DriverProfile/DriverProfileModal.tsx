import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDriverStore } from '../../store/driverStore'
import { useStandingsStore } from '../../store/standingsStore'
import { useDriverCareer } from '../../hooks/useDriverCareer'

interface DriverProfileModalProps {
  driverNumber: number
  onClose: () => void
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '10px 14px',
        background: 'var(--bg4)',
        border: '0.5px solid var(--border)',
        borderRadius: 4,
        minWidth: 64,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          color: accent ?? 'var(--white)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function DriverProfileModal({ driverNumber, onClose }: DriverProfileModalProps) {
  const EXIT_MS = 220
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { getDriver, getTeamColor } = useDriverStore()
  const standings = useStandingsStore((s) => s.standings)
  const driver = getDriver(driverNumber)
  const teamColor = getTeamColor(driverNumber)

  const currentStanding = standings?.find((s) => s.driverNumber === driverNumber)
  const { career, isLoading: careerLoading } = useDriverCareer(currentStanding?.driverId)

  const code = driver?.name_acronym ?? `#${driverNumber}`
  const fullName = driver?.full_name ?? `Driver ${driverNumber}`
  const teamName = driver?.team_name ?? '—'
  const headshotUrl = driver?.headshot_url
  const nationality = driver?.nationality

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

  const firstName = fullName.split(' ')[0]
  const lastName = fullName.split(' ').slice(1).join(' ')

  return createPortal(
    <div
      onClick={handleRequestClose}
      className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 300,
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
          width: 'min(780px, calc(100vw - 80px))',
          maxHeight: 'calc(100vh - 120px)',
          background: 'var(--bg3)',
          border: '0.5px solid var(--border2)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `0 0 60px ${teamColor}22, 0 24px 48px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Hero header */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            background: `linear-gradient(135deg, ${teamColor}18 0%, var(--bg3) 55%)`,
            borderBottom: '0.5px solid var(--border)',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 140,
          }}
        >
          {/* Team color left stripe */}
          <div style={{ width: 4, background: teamColor, flexShrink: 0, alignSelf: 'stretch' }} />

          {/* Headshot */}
          <div
            style={{
              width: 120,
              alignSelf: 'stretch',
              background: `linear-gradient(180deg, ${teamColor}22 0%, transparent 70%)`,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {headshotUrl ? (
              <img
                src={headshotUrl}
                alt={code}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 36,
                    fontWeight: 800,
                    color: teamColor,
                    opacity: 0.6,
                  }}
                >
                  {code}
                </span>
              </div>
            )}
          </div>

          {/* Driver info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '18px 20px',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: teamColor,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                #{driverNumber}
              </span>
              {nationality && (
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--muted2)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {nationality}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--muted)',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  {firstName}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 32,
                    fontWeight: 800,
                    color: 'var(--white)',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                  }}
                >
                  {lastName || firstName}
                </span>
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted2)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {teamName}
            </span>

            {/* Career summary chips */}
            {career && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {career.championships > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      background: 'rgba(201,168,76,0.12)',
                      border: '0.5px solid rgba(201,168,76,0.35)',
                      borderRadius: 3,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>🏆</span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 8,
                        color: '#C9A84C',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {career.championships}× CHAMPION
                    </span>
                  </div>
                )}
                <div
                  style={{
                    padding: '3px 8px',
                    background: 'var(--bg4)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 3,
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--muted)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {career.seasonsRaced} SEASONS
                </div>
                <div
                  style={{
                    padding: '3px 8px',
                    background: 'var(--bg4)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 3,
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--muted)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {career.totalWins} CAREER WINS
                </div>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleRequestClose}
            className="interactive-button"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
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

        {/* Current season stats */}
        {currentStanding && (
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '0.5px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted2)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 10,
              }}
            >
              2026 Season
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatBox label="Points" value={currentStanding.points} accent={teamColor} />
              <StatBox label="Wins" value={currentStanding.wins} accent={currentStanding.wins > 0 ? '#C9A84C' : undefined} />
              <StatBox label="Podiums" value={currentStanding.podiums} />
              <StatBox label="Races" value={currentStanding.racesEntered} />
              {currentStanding.bestFinish > 0 && currentStanding.bestFinish < Infinity && (
                <StatBox label="Best Finish" value={`P${currentStanding.bestFinish}`} />
              )}
            </div>
          </div>
        )}

        {/* Career history */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '0.5px solid var(--border)',
              background: 'var(--bg4)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
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
              Career History
            </span>
            {careerLoading && (
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 7,
                  color: 'var(--muted2)',
                  letterSpacing: '0.08em',
                }}
              >
                Loading…
              </span>
            )}
            {!careerLoading && !currentStanding?.driverId && (
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 7,
                  color: 'var(--muted2)',
                  letterSpacing: '0.08em',
                }}
              >
                Not available
              </span>
            )}
          </div>

          {career && career.seasons.length > 0 && (
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Column headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px 36px 64px 36px 1fr',
                  columnGap: 8,
                  padding: '5px 16px',
                  borderBottom: '0.5px solid var(--border)',
                  background: 'var(--bg4)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                {['SEASON', 'POS', 'PTS', 'W', 'TEAM'].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 7,
                      color: 'var(--muted2)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {career.seasons.map((s) => {
                const pos = parseInt(s.position, 10)
                const isChamp = pos === 1
                const teamNames = s.constructors.map((c) => c.name).join(' / ')
                return (
                  <div
                    key={s.season}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '52px 36px 64px 36px 1fr',
                      columnGap: 8,
                      padding: '7px 16px',
                      borderBottom: '0.5px solid var(--border)',
                      background: isChamp ? 'rgba(201,168,76,0.06)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--cond)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: isChamp ? '#C9A84C' : 'var(--white)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s.season}
                      {isChamp && (
                        <span style={{ marginLeft: 4, fontSize: 10 }}>🏆</span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--cond)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: pos <= 3 ? '#C9A84C' : 'var(--muted)',
                      }}
                    >
                      P{s.position}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--white)',
                        fontWeight: 600,
                      }}
                    >
                      {s.points}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: parseInt(s.wins) > 0 ? '#C9A84C' : 'var(--muted2)',
                      }}
                    >
                      {s.wins}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--body)',
                        fontSize: 10,
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {teamNames}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {!careerLoading && career && career.seasons.length === 0 && (
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
              No career data found
            </div>
          )}

          {careerLoading && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 2,
                  background: 'var(--bg4)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: '40%',
                    background: teamColor,
                    borderRadius: 2,
                    animation: 'shimmer 1.2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
