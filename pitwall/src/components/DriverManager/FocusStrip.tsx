import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDriverStore } from '../../store/driverStore'
import { usePositions } from '../../hooks/usePositions'
import { DriverManagerPanel } from './DriverManagerPanel'

function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="interactive-chip"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 18,
        boxSizing: 'border-box',
        padding: '2px 8px',
        borderRadius: 3,
        border: `0.5px solid ${active ? color : `${color}55`}`,
        background: active ? `${color}22` : 'transparent',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        lineHeight: 1,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: active ? color : `${color}99`,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: 1,
      height: 16,
      background: 'var(--border2)',
      flexShrink: 0,
      marginInline: 4,
    }} />
  )
}

const FOCUS_SELECTOR_OPTIONS = [
  { key: 'FOCUS', label: 'All' },
  { key: 'P1', label: 'P1' },
  { key: 'P2', label: 'P2' },
  { key: 'P3', label: 'P3' },
  { key: 'P4', label: 'P4' },
  { key: 'P5', label: 'P5' },
  { key: 'GAP+1', label: 'GAP+1' },
  { key: 'GAP-1', label: 'GAP-1' },
] as const

const FOCUS_SELECTOR_LABEL_BY_KEY = Object.fromEntries(
  FOCUS_SELECTOR_OPTIONS.map((option) => [option.key, option.label])
) as Record<typeof FOCUS_SELECTOR_OPTIONS[number]['key'], string>

export function FocusStrip() {
  const STAR_EXIT_MS = 320
  const STAR_ENTER_MS = 380
  const {
    drivers,
    starred,
    canvasFocus,
    windowFocusSelector,
    setCanvasFocus,
    setWindowFocusSelector,
    getTeamColor,
  } = useDriverStore()
  const { data: positions } = usePositions()
  const [panelOpen, setPanelOpen] = useState(false)
  const selectorTrackRef = useRef<HTMLDivElement | null>(null)
  const selectorButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [selectorIndicator, setSelectorIndicator] = useState({ left: 0, width: 52, ready: false })
  const [statusPulsing, setStatusPulsing] = useState(false)
  const starredButtonRefs = useRef(new Map<number, HTMLButtonElement>())
  const prevStarredRectsRef = useRef(new Map<number, DOMRect>())
  const prevStarredRef = useRef(starred)
  const [exitingStarred, setExitingStarred] = useState<number[]>([])
  const [enteringStarred, setEnteringStarred] = useState<number[]>([])
  const [displayOrder, setDisplayOrder] = useState<number[]>(starred)

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

  const renderedStarredNumbers = displayOrder

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

  const starredKeys = useMemo(() => displayOrder, [displayOrder])

  function getPosition(driverNumber: number): number | null {
    if (!positions) return null
    return positions.find((p) => p.driver_number === driverNumber)?.position ?? null
  }

  function resolveWindowFocusDriver(): number | null {
    if (windowFocusSelector === 'FOCUS') return canvasFocus
    if (!positions) return null

    if (windowFocusSelector === 'P1') return positions.find((p) => p.position === 1)?.driver_number ?? null
    if (windowFocusSelector === 'P2') return positions.find((p) => p.position === 2)?.driver_number ?? null
    if (windowFocusSelector === 'P3') return positions.find((p) => p.position === 3)?.driver_number ?? null
    if (windowFocusSelector === 'P4') return positions.find((p) => p.position === 4)?.driver_number ?? null
    if (windowFocusSelector === 'P5') return positions.find((p) => p.position === 5)?.driver_number ?? null

    if (windowFocusSelector === 'GAP+1') {
      const focusPos = positions.find((p) => p.driver_number === canvasFocus)?.position
      if (focusPos && focusPos > 1) {
        return positions.find((p) => p.position === focusPos - 1)?.driver_number ?? null
      }
      return null
    }

    const focusPos = positions.find((p) => p.driver_number === canvasFocus)?.position
    if (focusPos) {
      return positions.find((p) => p.position === focusPos + 1)?.driver_number ?? null
    }
    return null
  }

  const selectedDriverNumber = resolveWindowFocusDriver()
  const selectedFocusLabel = FOCUS_SELECTOR_LABEL_BY_KEY[windowFocusSelector]
  const selectedDriver = selectedDriverNumber == null
    ? null
    : drivers.find((d) => d.driver_number === selectedDriverNumber)
  const selectedPos = selectedDriverNumber == null ? null : getPosition(selectedDriverNumber)
  const selectedColor = selectedDriverNumber == null ? 'var(--border2)' : getTeamColor(selectedDriverNumber)

  useLayoutEffect(() => {
    const key = windowFocusSelector
    const track = selectorTrackRef.current
    const button = selectorButtonRefs.current[key]
    if (!track || !button) return
    const trackRect = track.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    setSelectorIndicator({
      left: buttonRect.left - trackRect.left,
      width: buttonRect.width,
      ready: true,
    })
  }, [windowFocusSelector])

  useLayoutEffect(() => {
    if (exitingStarred.length > 0) return

    const nextRects = new Map<number, DOMRect>()

    for (const key of starredKeys) {
      const el = starredButtonRefs.current.get(key)
      if (!el) continue
      nextRects.set(key, el.getBoundingClientRect())
    }

    for (const [key, rect] of nextRects) {
      const prevRect = prevStarredRectsRef.current.get(key)
      const el = starredButtonRefs.current.get(key)
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

    prevStarredRectsRef.current = nextRects
  }, [starredKeys.join(','), exitingStarred.length])

  useEffect(() => {
    setStatusPulsing(true)
    const timer = setTimeout(() => setStatusPulsing(false), 260)
    return () => clearTimeout(timer)
  }, [windowFocusSelector, selectedDriverNumber, selectedPos])

  return (
    <>
      <div className="animated-slide-down" style={{
        height: 32,
        background: 'transparent',
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        paddingInline: 12,
        gap: 6,
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {/* Label */}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
        }}>
          Focus
        </span>

        <div
          ref={selectorTrackRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 2,
            border: '0.5px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg3)',
            flexShrink: 0,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 2,
              left: selectorIndicator.left,
              height: 18,
              width: selectorIndicator.width,
              borderRadius: 3,
              border: '0.5px solid var(--gold)',
              background: 'rgba(201,168,76,0.16)',
              transition: 'left var(--motion-base) var(--motion-spring), width var(--motion-base) var(--motion-spring), opacity var(--motion-fast) ease',
              opacity: selectorIndicator.ready ? 1 : 0,
              pointerEvents: 'none',
            }}
          />

          {FOCUS_SELECTOR_OPTIONS.map((option) => {
            const isActive = windowFocusSelector === option.key
            return (
              <button
                key={option.key}
                ref={(el) => { selectorButtonRefs.current[option.key] = el }}
                className="interactive-chip"
                onClick={() => setWindowFocusSelector(option.key)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 18,
                  boxSizing: 'border-box',
                  minWidth: 52,
                  padding: '2px 8px',
                  borderRadius: 3,
                  border: '0.5px solid transparent',
                  background: 'transparent',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  lineHeight: 1,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--white)' : 'var(--muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <Divider />

        {/* Starred driver badges */}
        {starredDrivers.map(({ driver, exiting }) => {
          const pos = getPosition(driver.driver_number)
          const color = getTeamColor(driver.driver_number)
          const isFocused = canvasFocus === driver.driver_number
          const entering = !exiting && enteringStarred.includes(driver.driver_number)

          return (
            <div
              key={driver.driver_number}
              style={{
                display: 'flex',
                overflow: 'hidden',
                pointerEvents: exiting ? 'none' : 'auto',
              }}
            >
              <button
                ref={(el) => {
                  if (!el) {
                    starredButtonRefs.current.delete(driver.driver_number)
                    return
                  }
                  starredButtonRefs.current.set(driver.driver_number, el)
                }}
                onClick={() => {
                  if (exiting) return
                  setCanvasFocus(isFocused ? null : driver.driver_number)
                }}
                className={[
                  'interactive-chip',
                  entering ? 'animated-star-add' : '',
                  exiting ? 'animated-star-remove' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 18,
                  boxSizing: 'border-box',
                  padding: '2px 7px',
                  borderRadius: 3,
                  border: `0.5px solid ${isFocused ? color : `${color}44`}`,
                  background: isFocused ? `${color}22` : 'transparent',
                  cursor: exiting ? 'default' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              >
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: isFocused ? 'var(--white)' : 'var(--muted)',
                  textTransform: 'uppercase',
                }}>
                  {driver.name_acronym}
                </span>
                {pos != null && (
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 7,
                    color: 'var(--muted2)',
                  }}>
                    P{pos}
                  </span>
                )}
              </button>
            </div>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setPanelOpen(true)}
          className="interactive-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 18,
            boxSizing: 'border-box',
            padding: '2px 8px',
            borderRadius: 3,
            border: '0.5px solid var(--border2)',
            background: 'transparent',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            lineHeight: 1,
            letterSpacing: '0.1em',
            color: 'var(--muted)',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          + more
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Selected focus status */}
        <div
          className={statusPulsing ? 'status-pulse' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 18,
            boxSizing: 'border-box',
            padding: '2px 7px',
            borderRadius: 4,
            border: `0.5px solid ${selectedColor}`,
            background: selectedDriverNumber == null ? 'transparent' : `${selectedColor}1A`,
            flexShrink: 0,
            transition: 'border-color var(--motion-base) ease, background-color var(--motion-base) ease, color var(--motion-fast) ease',
          }}
          title="Current window focus target"
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
            }}
          >
            Selected
          </span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: selectedDriverNumber == null ? 'var(--muted2)' : 'var(--white)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedFocusLabel}
            {selectedDriver
              ? ` • ${selectedDriver.name_acronym}${selectedPos ? ` P${selectedPos}` : ''}`
              : ' • None'}
          </span>
        </div>

        {/* Count */}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.1em',
          color: 'var(--muted2)',
          flexShrink: 0,
        }}>
          {starred.length} starred
        </span>
      </div>

      {panelOpen && <DriverManagerPanel onClose={() => setPanelOpen(false)} />}
    </>
  )
}
