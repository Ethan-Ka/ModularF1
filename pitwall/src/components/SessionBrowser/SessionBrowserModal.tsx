import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSessions } from '../../hooks/useSession'
import { useSessionStore } from '../../store/sessionStore'
import type { OpenF1Session } from '../../api/openf1'

interface SessionBrowserModalProps {
  onClose: () => void
}

const YEARS = [2023, 2024, 2025]

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
  session,
  onSelect,
  index,
}: {
  session: OpenF1Session
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
        {session.session_name}
      </span>
      <SessionTypeBadge type={session.session_type} />
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted2)',
        letterSpacing: '0.06em',
        flexShrink: 0,
        minWidth: 52,
        textAlign: 'right',
      }}>
        {formatDate(session.date_start)}
      </span>
    </button>
  )
}

/** Group of sessions under one circuit header */
function CircuitGroup({
  circuitName,
  sessions,
  onSelect,
}: {
  circuitName: string
  sessions: OpenF1Session[]
  onSelect: (s: OpenF1Session) => void
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
        {sessions[0]?.country_name && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
          }}>
            {sessions[0].country_name}
          </span>
        )}
      </div>

      {/* Session rows */}
      {sessions.map((s, index) => (
        <SessionRow
          key={s.session_key}
          session={s}
          onSelect={() => onSelect(s)}
          index={index}
        />
      ))}
    </div>
  )
}

export function SessionBrowserModal({ onClose }: SessionBrowserModalProps) {
  const EXIT_MS = 220
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: sessions, isLoading } = useSessions(selectedYear)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)

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

  function handleSelect(session: OpenF1Session) {
    setActiveSession(session)
    handleRequestClose()
  }

  // Group sessions by circuit_short_name, preserving order of first appearance
  const grouped: Map<string, OpenF1Session[]> = new Map()
  if (sessions) {
    for (const s of sessions) {
      const key = s.circuit_short_name ?? 'Unknown'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(s)
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
        <div className="scroll-fade" style={{ overflowY: 'auto', flex: 1 }}>
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
            Array.from(grouped.entries()).map(([circuitName, groupSessions]) => (
              <CircuitGroup
                key={circuitName}
                circuitName={circuitName}
                sessions={groupSessions}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
