import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAmbientStore } from '../../store/ambientStore'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { usePositions } from '../../hooks/usePositions'
import { loadSeasonCatalog, type SeasonCatalogEntry } from '../../lib/seasonData'
import { DriverCard } from './DriverCard'

interface DriverManagerPanelProps {
  onClose: () => void
}

function normalizeHex(value: string): string {
  const cleaned = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return '#6B6B70'
  return `#${cleaned.toUpperCase()}`
}

export function DriverManagerPanel({ onClose }: DriverManagerPanelProps) {
  const EXIT_MS = 220
  const STAR_EXIT_MS = 320
  const STAR_ENTER_MS = 380
  const {
    drivers,
    starred,
    canvasFocus,
    seasonYear,
    setCanvasFocus,
    toggleStar,
    getTeamColor,
    setTeamColorForTeam,
    clearTeamColorForTeam,
    importSeasonFromPublic,
    applySeasonVisualsFromPublic,
  } = useDriverStore()
  const activeSessionYear = useSessionStore((s) => s.activeSession?.year ?? null)
  const addToast = useAmbientStore((s) => s.addToast)
  const { data: positions } = usePositions()
  const [isImportingSeason, setIsImportingSeason] = useState(false)
  const [isSyncingColors, setIsSyncingColors] = useState(false)
  const [teamColorSettingsOpen, setTeamColorSettingsOpen] = useState(false)
  const [catalogSeasons, setCatalogSeasons] = useState<SeasonCatalogEntry[]>([])
  const [selectedSeasonYear, setSelectedSeasonYear] = useState<number>(2026)
  const [isClosing, setIsClosing] = useState(false)
  const [exitingStarred, setExitingStarred] = useState<number[]>([])
  const [enteringStarred, setEnteringStarred] = useState<number[]>([])
  const [displayOrder, setDisplayOrder] = useState<number[]>(starred)
  const lastAutoSyncedYear = useRef<number | null>(null)
  const prevStarredRef = useRef(starred)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusChipItemRefs = useRef(new Map<string, HTMLDivElement>())
  const prevFocusChipRectsRef = useRef(new Map<string, DOMRect>())
  const starredCardItemRefs = useRef(new Map<number, HTMLDivElement>())
  const prevStarredCardRectsRef = useRef(new Map<number, DOMRect>())

  useEffect(() => {
    const removed = prevStarredRef.current.filter((num) => !starred.includes(num))
    const added = starred.filter((num) => !prevStarredRef.current.includes(num))

    if (removed.length > 0) {
      setExitingStarred((prev) => Array.from(new Set([...prev, ...removed])))
    }

    if (added.length > 0) {
      setEnteringStarred((prev) => Array.from(new Set([...prev, ...added])))
    }

    setDisplayOrder((prev) => {
      const exitingNow = new Set([...exitingStarred, ...removed].filter((num) => !starred.includes(num)))
      const next = prev.filter((num) => starred.includes(num) || exitingNow.has(num))
      for (const num of starred) {
        if (!next.includes(num)) next.push(num)
      }
      for (const num of exitingNow) {
        if (!next.includes(num)) next.push(num)
      }
      return next
    })

    prevStarredRef.current = starred
  }, [starred, exitingStarred])

  useEffect(() => {
    if (enteringStarred.length === 0) return
    const timer = setTimeout(() => {
      setEnteringStarred((prev) => prev.filter((num) => !starred.includes(num)))
    }, STAR_ENTER_MS)
    return () => clearTimeout(timer)
  }, [enteringStarred, starred])

  useEffect(() => {
    if (exitingStarred.length === 0) return
    const timer = setTimeout(() => {
      setExitingStarred((prev) => prev.filter((num) => starred.includes(num)))
    }, STAR_EXIT_MS)
    return () => clearTimeout(timer)
  }, [exitingStarred, starred])

  function handleRequestClose() {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      onClose()
    }, EXIT_MS)
  }

  useEffect(() => {
    let mounted = true
    void loadSeasonCatalog()
      .then((seasons) => {
        if (!mounted) return
        setCatalogSeasons(seasons)
      })
      .catch(() => {
        if (!mounted) return
        setCatalogSeasons([{ year: 2026, label: '2026 (bundle)', status: 'ready' }])
      })
    return () => {
      mounted = false
    }
  }, [])

  const seasonOptions = useMemo(() => {
    const seeded = [...catalogSeasons]
    if (seasonYear != null && !seeded.some((entry) => entry.year === seasonYear)) {
      seeded.unshift({ year: seasonYear, label: `${seasonYear} (loaded)`, status: 'ready' })
    }
    if (activeSessionYear != null && !seeded.some((entry) => entry.year === activeSessionYear)) {
      seeded.unshift({ year: activeSessionYear, label: `${activeSessionYear} (session)`, status: 'ready' })
    }
    if (seeded.length === 0) {
      return [{ year: 2026, label: '2026 (bundle)', status: 'ready' }]
    }
    return seeded
      .sort((a, b) => b.year - a.year)
      .filter((entry, index, array) => array.findIndex((candidate) => candidate.year === entry.year) === index)
  }, [catalogSeasons, seasonYear, activeSessionYear])

  useEffect(() => {
    if (seasonOptions.length === 0) return
    const preferredYear = seasonYear ?? activeSessionYear ?? seasonOptions[0].year
    setSelectedSeasonYear(preferredYear)
  }, [seasonOptions, seasonYear, activeSessionYear])

  async function handleImportSeason(options?: { silent?: boolean }) {
    if (isImportingSeason) return
    setIsImportingSeason(true)
    try {
      const result = await importSeasonFromPublic(selectedSeasonYear)
      if (!options?.silent) {
        addToast(`Loaded ${result.year} season data (${result.count} drivers).`, 'GREEN')
      }
    } catch {
      if (!options?.silent) {
        addToast(`Failed to load season bundle from /public/seasons/${selectedSeasonYear}.`, 'RED')
      }
    } finally {
      setIsImportingSeason(false)
    }
  }

  useEffect(() => {
    if (seasonOptions.length === 0) return
    void handleImportSeason({ silent: true })
  }, [seasonOptions.length, selectedSeasonYear])

  async function handleApplyTeamColors(options?: { silent?: boolean }) {
    if (isSyncingColors) return
    setIsSyncingColors(true)
    try {
      const result = await applySeasonVisualsFromPublic(selectedSeasonYear)
      if (!options?.silent) {
        addToast(
          `Applied ${result.year} palette to ${result.updated} drivers.`,
          'GREEN'
        )
      }
    } catch {
      if (!options?.silent) {
        addToast(`Failed to apply team colors from /public/seasons/${selectedSeasonYear}.`, 'RED')
      }
    } finally {
      setIsSyncingColors(false)
    }
  }

  useEffect(() => {
    if (drivers.length === 0) return
    if (isImportingSeason || isSyncingColors) return
    if (lastAutoSyncedYear.current === selectedSeasonYear) return

    lastAutoSyncedYear.current = selectedSeasonYear
    void handleApplyTeamColors({ silent: true })
  }, [selectedSeasonYear, drivers.length, isImportingSeason, isSyncingColors])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  function getPosition(driverNumber: number): number | null {
    if (!positions) return null
    return positions.find((p) => p.driver_number === driverNumber)?.position ?? null
  }

  const renderedStarredNumbers = displayOrder
  const starredCardLayoutKeys = useMemo(() => displayOrder, [displayOrder])

  const starredDrivers = renderedStarredNumbers
    .map((num) => {
      const driver = drivers.find((d) => d.driver_number === num)
      if (!driver) return null
      return {
        driver,
        exiting: !starred.includes(num),
      }
    })
    .filter((entry): entry is { driver: (typeof drivers)[number]; exiting: boolean } => Boolean(entry))

  const focusChipKeys = useMemo(() => ['inherit', ...displayOrder.map((num) => `d-${num}`)], [displayOrder])

  useLayoutEffect(() => {
    if (exitingStarred.length > 0) return

    const nextRects = new Map<string, DOMRect>()

    for (const key of focusChipKeys) {
      const el = focusChipItemRefs.current.get(key)
      if (!el) continue
      nextRects.set(key, el.getBoundingClientRect())
    }

    for (const [key, rect] of nextRects) {
      const el = focusChipItemRefs.current.get(key)
      if (!el) continue

      const prevRect = prevFocusChipRectsRef.current.get(key)
      if (!prevRect) {
        el.style.transition = 'none'
        el.style.opacity = '0'
        el.style.transform = 'translateY(5px) scale(0.94)'

        requestAnimationFrame(() => {
          el.style.transition = 'transform var(--motion-base) var(--motion-spring), opacity var(--motion-base) ease'
          el.style.opacity = '1'
          el.style.transform = 'translate(0, 0) scale(1)'
        })
        continue
      }

      const deltaX = prevRect.left - rect.left
      const deltaY = prevRect.top - rect.top
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue

      el.style.transition = 'none'
      el.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
        el.style.transform = 'translate(0, 0)'
      })
    }

    prevFocusChipRectsRef.current = nextRects
  }, [focusChipKeys.join(','), exitingStarred.length])

  useLayoutEffect(() => {
    if (exitingStarred.length > 0) return

    const nextRects = new Map<number, DOMRect>()

    for (const key of starredCardLayoutKeys) {
      const el = starredCardItemRefs.current.get(key)
      if (!el) continue
      nextRects.set(key, el.getBoundingClientRect())
    }

    for (const [key, rect] of nextRects) {
      const prevRect = prevStarredCardRectsRef.current.get(key)
      const el = starredCardItemRefs.current.get(key)
      if (!prevRect || !el) continue

      const deltaX = prevRect.left - rect.left
      const deltaY = prevRect.top - rect.top
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue

      el.style.transition = 'none'
      el.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
        el.style.transform = 'translate(0, 0)'
      })
    }

    prevStarredCardRectsRef.current = nextRects
  }, [starredCardLayoutKeys.join(','), exitingStarred.length])

  // Group all drivers by team
  const teamMap = new Map<string, typeof drivers>()
  for (const d of drivers) {
    const existing = teamMap.get(d.team_name) ?? []
    teamMap.set(d.team_name, [...existing, d])
  }

  return (
    // Backdrop
    <div
      onClick={handleRequestClose}
      className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={isClosing ? 'modal-panel modal-panel-exit' : 'modal-panel'}
        style={{
          width: 'min(1360px, calc(100vw - 10px))',
          maxHeight: 'calc(100vh - 112px)',
          background: 'var(--bg3)',
          border: '0.5px solid var(--border2)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
          gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--cond)',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.04em',
            flex: 1,
          }}>
            Driver Manager
          </span>
          <button
            onClick={() => setTeamColorSettingsOpen((open) => !open)}
            className="interactive-button"
            style={{
              padding: '4px 10px',
              borderRadius: 3,
              border: '0.5px solid var(--border2)',
              background: teamColorSettingsOpen ? 'var(--bg2)' : 'var(--bg4)',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: teamColorSettingsOpen ? 'var(--white)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Team colors
          </button>
          <button
            onClick={() => void handleApplyTeamColors()}
            disabled={isImportingSeason || isSyncingColors}
            className="interactive-button"
            style={{
              padding: '4px 10px',
              borderRadius: 3,
              border: '0.5px solid var(--border2)',
              background: 'var(--bg4)',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: (isImportingSeason || isSyncingColors) ? 'var(--muted2)' : 'var(--muted)',
              cursor: (isImportingSeason || isSyncingColors) ? 'not-allowed' : 'pointer',
              opacity: (isImportingSeason || isSyncingColors) ? 0.8 : 1,
            }}
            title="Apply team colors from selected season bundle"
          >
            {isSyncingColors ? 'Syncing...' : 'Sync colors'}
          </button>
          <select
            className="interactive-chip animated-scale-in"
            value={selectedSeasonYear}
            onChange={(e) => setSelectedSeasonYear(Number(e.target.value))}
            style={{
              height: 24,
              borderRadius: 3,
              border: '0.5px solid var(--border2)',
              background: 'var(--bg4)',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--muted)',
              paddingInline: 8,
              cursor: 'pointer',
            }}
            aria-label="Select season bundle"
          >
            {seasonOptions.map((entry) => (
              <option key={entry.year} value={entry.year}>
                {entry.label ?? `${entry.year}`}
              </option>
            ))}
          </select>
          <button
            onClick={handleImportSeason}
            disabled={isImportingSeason}
            className="interactive-button"
            style={{
              padding: '4px 10px',
              borderRadius: 3,
              border: '0.5px solid var(--border2)',
              background: 'var(--bg4)',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: isImportingSeason ? 'var(--muted2)' : 'var(--muted)',
              cursor: isImportingSeason ? 'not-allowed' : 'pointer',
              opacity: isImportingSeason ? 0.8 : 1,
            }}
          >
            {isImportingSeason ? 'Importing...' : 'Check local data'}
          </button>
          <button
            onClick={handleRequestClose}
            className="interactive-button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="scroll-fade" style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {/* Canvas focus strip (embedded) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
              marginRight: 4,
            }}>
              Canvas focus
            </span>
            <div
              ref={(el) => {
                if (!el) {
                  focusChipItemRefs.current.delete('inherit')
                  return
                }
                focusChipItemRefs.current.set('inherit', el)
              }}
              style={{ display: 'flex', willChange: 'transform, opacity' }}
            >
              <FocusChip
                label="Inherit"
                color="var(--green)"
                active={canvasFocus === null}
                onClick={() => setCanvasFocus(null)}
              />
            </div>
            {starredDrivers.map(({ driver, exiting }) => {
              const color = getTeamColor(driver.driver_number)
              const isFocused = canvasFocus === driver.driver_number
              const entering = !exiting && enteringStarred.includes(driver.driver_number)
              return (
                <div
                  key={driver.driver_number}
                  ref={(el) => {
                    const key = `d-${driver.driver_number}`
                    if (!el) {
                      focusChipItemRefs.current.delete(key)
                      return
                    }
                    focusChipItemRefs.current.set(key, el)
                  }}
                  style={{
                    display: 'flex',
                    willChange: 'transform, opacity',
                    overflow: 'hidden',
                    pointerEvents: exiting ? 'none' : 'auto',
                  }}
                >
                  <FocusChip
                    label={driver.name_acronym}
                    color={color}
                    active={isFocused}
                    onClick={() => setCanvasFocus(isFocused ? null : driver.driver_number)}
                    className={[
                      entering ? 'animated-star-add' : '',
                      exiting ? 'animated-star-remove' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  />
                </div>
              )
            })}
          </div>

          {/* Starred drivers section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
              marginBottom: 10,
            }}>
              Starred drivers — {starred.length}
            </div>
            {starredDrivers.length === 0 ? (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted2)',
                padding: '12px 0',
              }}>
                No starred drivers. Star drivers from the grid below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {starredDrivers.map(({ driver, exiting }) => {
                  const entering = !exiting && enteringStarred.includes(driver.driver_number)
                  return (
                    <div
                      key={driver.driver_number}
                      ref={(el) => {
                        if (!el) {
                          starredCardItemRefs.current.delete(driver.driver_number)
                          return
                        }
                        starredCardItemRefs.current.set(driver.driver_number, el)
                      }}
                      style={{
                        overflow: 'hidden',
                        pointerEvents: exiting ? 'none' : 'auto',
                      }}
                    >
                      <DriverCard
                        driver={driver}
                        teamColor={getTeamColor(driver.driver_number)}
                        position={getPosition(driver.driver_number)}
                        isStarred={true}
                        onToggleStar={() => toggleStar(driver.driver_number)}
                        onSetFocus={() => setCanvasFocus(
                          canvasFocus === driver.driver_number ? null : driver.driver_number
                        )}
                        isCanvasFocus={canvasFocus === driver.driver_number}
                        animateIn={entering}
                        animateOut={exiting}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* All drivers — grouped by team */}
          <div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
              marginBottom: 12,
            }}>
              All drivers — {seasonYear ?? activeSessionYear ?? 'current'} season
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
            {Array.from(teamMap.entries()).map(([teamName, teamDrivers]) => {
              const teamColor = normalizeHex(getTeamColor(teamDrivers[0].driver_number))
              const defaultTeamColor = normalizeHex(`#${teamDrivers[0].team_colour}`)
              const hasTeamOverride = teamColor !== defaultTeamColor

              return (
                <div key={teamName} style={{ minWidth: 312 }}>
                  {/* Team label */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}>
                    <div style={{
                      width: 12,
                      height: 8,
                      borderRadius: 1,
                      background: teamColor,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}>
                      {teamName}
                    </span>
                  </div>

                  <div
                    aria-hidden={!teamColorSettingsOpen}
                    style={{
                      display: 'grid',
                      gridTemplateRows: teamColorSettingsOpen ? '1fr' : '0fr',
                      marginBottom: teamColorSettingsOpen ? 10 : 0,
                      opacity: teamColorSettingsOpen ? 1 : 0,
                      transition: [
                        'grid-template-rows var(--motion-base) var(--motion-spring)',
                        'margin-bottom var(--motion-base) var(--motion-out)',
                        'opacity var(--motion-fast) ease',
                      ].join(', '),
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 8px',
                        borderRadius: 4,
                        background: 'var(--bg4)',
                        border: '0.5px solid var(--border)',
                        transform: teamColorSettingsOpen ? 'translateY(0)' : 'translateY(-5px)',
                        transition: 'transform var(--motion-base) var(--motion-spring)',
                        pointerEvents: teamColorSettingsOpen ? 'auto' : 'none',
                      }}>
                        <input
                          type="color"
                          value={teamColor}
                          onChange={(e) => setTeamColorForTeam(teamName, e.target.value)}
                          aria-label={`${teamName} color`}
                          style={{
                            width: 26,
                            height: 20,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        />
                        <input
                          value={teamColor}
                          onChange={(e) => {
                            const next = e.target.value.toUpperCase()
                            if (!/^#[0-9A-F]{0,6}$/.test(next)) return
                            if (next.length === 7) {
                              setTeamColorForTeam(teamName, next)
                            }
                          }}
                          placeholder="#RRGGBB"
                          aria-label={`${teamName} hex color`}
                          spellCheck={false}
                          style={{
                            width: 86,
                            height: 20,
                            borderRadius: 3,
                            border: '0.5px solid var(--border2)',
                            background: 'var(--bg3)',
                            fontFamily: 'var(--mono)',
                            fontSize: 8,
                            letterSpacing: '0.06em',
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            paddingInline: 6,
                          }}
                        />
                        <button
                          onClick={() => clearTeamColorForTeam(teamName)}
                          disabled={!hasTeamOverride}
                          className="interactive-button"
                          style={{
                            height: 20,
                            padding: '0 8px',
                            borderRadius: 3,
                            border: '0.5px solid var(--border2)',
                            background: 'var(--bg3)',
                            fontFamily: 'var(--mono)',
                            fontSize: 8,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: hasTeamOverride ? 'var(--muted)' : 'var(--muted2)',
                            cursor: hasTeamOverride ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Driver cards */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {teamDrivers.map((driver) => (
                      <DriverCard
                        key={driver.driver_number}
                        driver={driver}
                        teamColor={getTeamColor(driver.driver_number)}
                        position={getPosition(driver.driver_number)}
                        isStarred={starred.includes(driver.driver_number)}
                        onToggleStar={() => toggleStar(driver.driver_number)}
                        onSetFocus={() => setCanvasFocus(
                          canvasFocus === driver.driver_number ? null : driver.driver_number
                        )}
                        isCanvasFocus={canvasFocus === driver.driver_number}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            </div>

            {drivers.length === 0 && (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted2)',
                padding: '12px 0',
              }}>
                No driver data. Select an active session or import a season bundle.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FocusChip({
  label,
  color,
  active,
  onClick,
  className,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={className ? `interactive-chip ${className}` : 'interactive-chip'}
      style={{
        padding: '3px 8px',
        borderRadius: 3,
        border: `0.5px solid ${active ? color : `${color}44`}`,
        background: active ? `${color}22` : 'transparent',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: active ? color : 'var(--muted)',
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}
