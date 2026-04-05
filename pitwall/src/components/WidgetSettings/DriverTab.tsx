import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DriverContext } from '../../store/workspaceStore'
import { useDriverStore } from '../../store/driverStore'
import { usePositions } from '../../hooks/usePositions'
import { DriverManagerPanel } from '../DriverManager/DriverManagerPanel'

interface DriverTabProps {
  value: DriverContext
  onChange: (ctx: DriverContext) => void
  widgetId: string
}

function ContextChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="interactive-chip"
      style={{
        padding: '4px 10px',
        borderRadius: 3,
        border: `0.5px solid ${active ? color : `${color}55`}`,
        background: active ? `${color}22` : 'transparent',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: active ? color : `${color}99`,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: '100%',
      height: 1,
      background: 'var(--border)',
      marginBlock: 8,
    }} />
  )
}

export function DriverTab({ value, onChange }: DriverTabProps) {
  const STAR_EXIT_MS = 320
  const STAR_ENTER_MS = 380
  const { drivers, starred, getTeamColor } = useDriverStore()
  const { data: positions } = usePositions()
  const [panelOpen, setPanelOpen] = useState(false)
  const prevStarredRef = useRef(starred)
  const [exitingStarred, setExitingStarred] = useState<number[]>([])
  const [displayOrder, setDisplayOrder] = useState<number[]>(starred)
  const [enteringStarred, setEnteringStarred] = useState<number[]>([])
  const starredItemRefs = useRef(new Map<number, HTMLDivElement>())
  const prevStarredItemRectsRef = useRef(new Map<number, DOMRect>())

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

  const renderedStarredNumbers = useMemo(() => displayOrder, [displayOrder])
  const starredLayoutKeys = useMemo(() => displayOrder, [displayOrder])

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

  function getPos(driverNumber: number): number | null {
    return positions?.find((p) => p.driver_number === driverNumber)?.position ?? null
  }

  useLayoutEffect(() => {
    if (exitingStarred.length > 0) return

    const nextRects = new Map<number, DOMRect>()

    for (const key of starredLayoutKeys) {
      const el = starredItemRefs.current.get(key)
      if (!el) continue
      nextRects.set(key, el.getBoundingClientRect())
    }

    for (const [key, rect] of nextRects) {
      const prevRect = prevStarredItemRectsRef.current.get(key)
      const el = starredItemRefs.current.get(key)
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

    prevStarredItemRectsRef.current = nextRects
  }, [starredLayoutKeys.join(','), exitingStarred.length])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 6,
        }}>
          Driver target
        </div>

        {/* FOCUS chip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <ContextChip
            label="Focus"
            color="var(--green)"
            active={value === 'FOCUS'}
            onClick={() => onChange('FOCUS')}
          />
        </div>

        <Divider />

        {/* Position chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map((p) => (
            <ContextChip
              key={p}
              label={p}
              color="var(--gold)"
              active={value === p}
              onClick={() => onChange(p)}
            />
          ))}
          <ContextChip
            label="GAP+1"
            color="var(--gold)"
            active={value === 'GAP+1'}
            onClick={() => onChange('GAP+1')}
          />
          <ContextChip
            label="GAP−1"
            color="var(--gold)"
            active={value === 'GAP-1'}
            onClick={() => onChange('GAP-1')}
          />
        </div>

        <Divider />

        {/* Starred driver badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {starredDrivers.map(({ driver, exiting }) => {
            const color = getTeamColor(driver.driver_number)
            const pinnedCtx: DriverContext = `PINNED:${driver.driver_number}`
            const isActive = value === pinnedCtx
            const pos = getPos(driver.driver_number)
            const entering = !exiting && enteringStarred.includes(driver.driver_number)

            return (
              <div
                key={driver.driver_number}
                ref={(el) => {
                  if (!el) {
                    starredItemRefs.current.delete(driver.driver_number)
                    return
                  }
                  starredItemRefs.current.set(driver.driver_number, el)
                }}
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  pointerEvents: exiting ? 'none' : 'auto',
                }}
              >
                <button
                  onClick={() => {
                    if (exiting) return
                    onChange(pinnedCtx)
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
                    padding: '4px 8px',
                    borderRadius: 3,
                    border: `0.5px solid ${isActive ? color : `${color}44`}`,
                    background: isActive ? `${color}22` : 'transparent',
                    cursor: exiting ? 'default' : 'pointer',
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
                    textTransform: 'uppercase',
                    color: isActive ? 'var(--white)' : 'var(--muted)',
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

          <button
            onClick={() => setPanelOpen(true)}
            className="interactive-button"
            style={{
              padding: '4px 8px',
              borderRadius: 3,
              border: '0.5px solid var(--border2)',
              background: 'transparent',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            + more
          </button>
        </div>

        {/* Current selection display */}
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: 'var(--bg)',
          borderRadius: 3,
          border: '0.5px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--muted2)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Current: {value}
          </span>
        </div>
      </div>

      {panelOpen && <DriverManagerPanel onClose={() => setPanelOpen(false)} />}
    </>
  )
}
