import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFastF1Sessions, type FastF1SessionRow } from '../../hooks/useSession'
import { useSessionStore } from '../../store/sessionStore'
import type { OpenF1Session } from '../../api/openf1'
import { SmoothScrollContainer } from '../SmoothScrollContainer'

interface SessionBrowserModalProps {
  onClose: () => void
}

const YEARS = [2023, 2024, 2025, 2026]

const SESSION_ORDER: Record<string, number> = {
  FP1: 1,
  FP2: 2,
  FP3: 3,
  SQ: 4,
  S: 5,
  Q: 6,
  R: 7,
}

function sessionKeyFromRef(row: FastF1SessionRow): number {
  const order = SESSION_ORDER[row.ref.session] ?? 9
  return row.ref.year * 10000 + row.ref.round * 10 + order
}

function synthSessionFromRow(row: FastF1SessionRow): OpenF1Session {
  return {
    session_key: sessionKeyFromRef(row),
    session_type: row.session_name,
    session_name: row.session_name,
    circuit_short_name: row.circuit_name,
    date_start: row.date ?? '',
    date_end: row.date ?? '',
    year: row.ref.year,
    country_name: row.country,
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Tiny badge for session type (Race, Qualifying, Practice, etc.) */
function SessionTypeBadge({ type }: { type: string }) {
  // Color by session type
  const color =
    type === 'Race' ? 'var(--red)' :
    type === 'Qualifying' ? 'var(--purple)' :
    type === 'Sprint' ? 'var(--gold)' :
    type === 'Sprint Qualifying' ? 'var(--amber)' :
    'var(--muted2)'

  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: 7,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color,
      border: `0.5px solid ${color}`,
      borderRadius: 2,
      padding: '1px 4px',
      flexShrink: 0,
    }}>
      {type}
    </span>
  )
}

/** A single session row inside a circuit group */
function SessionRow({
  name,
  type,
  date,
  onSelect,
  index,
}: {
  name: string
  type: string
  date: string | null
  onSelect: () => void
  index: number
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="interactive-card stagger-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: hovered ? 'var(--bg4)' : 'transparent',
        border: 'none',
        borderBottom: '0.5px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        ['--stagger-delay' as string]: `${Math.min(index * 14, 220)}ms`,
      }}
    >
      <span style={{
        fontFamily: 'var(--body)',
        fontSize: 11,
        color: 'var(--white)',
        flex: 1,
        letterSpacing: '0.02em',
      }}>
        {name}
      </span>
      <SessionTypeBadge type={type} />
      {date && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--muted2)',
          letterSpacing: '0.06em',
          flexShrink: 0,
          minWidth: 52,
          textAlign: 'right',
        }}>
          {formatDate(date)}
        </span>
      )}
    </button>
  )
}

interface CircuitGroupRow {
  key: string
  name: string
  type: string
  date: string | null
  onSelect: () => void
}

/** Group of sessions under one circuit header */
function CircuitGroup({
  circuitName,
  country,
  rows,
}: {
  circuitName: string
  country?: string
  rows: CircuitGroupRow[]
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      {/* Circuit header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px 6px',
        borderBottom: '0.5px solid var(--border2)',
        background: 'var(--bg4)',
      }}>
        <span style={{
          fontFamily: 'var(--cond)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--white)',
          flex: 1,
        }}>
          {circuitName}
        </span>
        {country && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
          }}>
            {country}
          </span>
        )}
      </div>

      {/* Session rows */}
      {rows.map((r, index) => (
        <SessionRow
          key={r.key}
          name={r.name}
          type={r.type}
          date={r.date}
          onSelect={r.onSelect}
          index={index}
        />
      ))}
    </div>
  )
}

export function SessionBrowserModal({ onClose }: SessionBrowserModalProps) {
  const EXIT_MS = 220
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setActiveFastF1Session = useSessionStore((s) => s.setActiveFastF1Session)
  const setMode = useSessionStore((s) => s.setMode)

  const { data: fastf1Sessions, isLoading } = useFastF1Sessions(selectedYear)

  function handleRequestClose() {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      onClose()
    }, EXIT_MS)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  function handleSelectFastF1(row: FastF1SessionRow) {
    setActiveFastF1Session(row.ref)
    setActiveSession(synthSessionFromRow(row))
    setMode('hub')
    handleRequestClose()
  }

  // Build grouped map from whichever source is active
  const grouped: Map<string, CircuitGroupRow[]> = new Map()

  if (fastf1Sessions) {
    for (const row of fastf1Sessions) {
      const key = row.circuit_name
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push({
        key: `${row.ref.year}-${row.ref.round}-${row.ref.session}`,
        name: row.session_name,
        type: row.session_name,
        date: row.date,
        onSelect: () => handleSelectFastF1(row),
      })
    }
  }

  // Country label per group
  const groupCountry: Map<string, string | undefined> = new Map()
  if (fastf1Sessions) {
    for (const row of fastf1Sessions) {
      if (!groupCountry.has(row.circuit_name)) groupCountry.set(row.circuit_name, row.country)
    }
  }

  return createPortal(
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
          width: 600,
          maxHeight: 'calc(100vh - 120px)',
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
          }}>
            Session Archive
          </span>

          {/* Year tabs */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {YEARS.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className="interactive-button"
                style={{
                  padding: '3px 10px',
                  borderRadius: 3,
                  border: `0.5px solid ${selectedYear === year ? 'var(--blue)' : 'var(--border)'}`,
                  background: selectedYear === year ? 'rgba(59,130,246,0.15)' : 'transparent',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: selectedYear === year ? 'var(--blue)' : 'var(--muted2)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {year}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

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
            aria-label="Close session browser"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <SmoothScrollContainer className="scroll-fade" style={{ flex: 1 }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 160,
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--muted2)',
              letterSpacing: '0.08em',
            }}>
              Loading sessions...
            </div>
          ) : grouped.size === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 160,
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--muted2)',
              letterSpacing: '0.08em',
            }}>
              No sessions found
            </div>
          ) : (
            Array.from(grouped.entries()).map(([circuitName, rows]) => (
              <CircuitGroup
                key={circuitName}
                circuitName={circuitName}
                country={groupCountry.get(circuitName)}
                rows={rows}
              />
            ))
          )}
        </SmoothScrollContainer>
      </div>
    </div>,
    document.body
  )
}
