import { useEffect, useRef, useState } from 'react'
import { useLogStore, type LogLevel, type LogEntry } from '../../store/logStore'
import { useAmbientStore, type FlagState } from '../../store/ambientStore'
import { useSessionStore } from '../../store/sessionStore'
import { useNextRace } from '../../hooks/useNextRace'

const ALL_LEVELS: LogLevel[] = ['ERR', 'WARN', 'INFO', 'DBG']

const LEVEL_COLORS: Record<LogLevel, string> = {
  ERR: 'var(--red)',
  WARN: 'var(--amber, #f59e0b)',
  INFO: 'var(--blue, #3b82f6)',
  DBG: 'var(--muted2)',
}

interface DiagnosticLogProps {
  open: boolean
  onClose: () => void
}

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: 7,
      letterSpacing: '0.1em',
      color: LEVEL_COLORS[level],
      flexShrink: 0,
      width: 32,
      display: 'inline-block',
    }}>
      {level}
    </span>
  )
}

function LogRow({ entry, index }: { entry: LogEntry; index: number }) {
  return (
    <div className="stagger-item" style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      padding: '3px 12px',
      borderBottom: '0.5px solid var(--border)',
      minHeight: 22,
      ['--stagger-delay' as string]: `${Math.min(index * 8, 160)}ms`,
    }}>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted2)',
        flexShrink: 0,
        width: 90,
      }}>
        {entry.timestamp}
      </span>
      <LevelBadge level={entry.level} />
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {entry.message}
      </span>
      {entry.source && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
          flexShrink: 0,
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {entry.source}
        </span>
      )}
    </div>
  )
}

// ─── DEV Panel ───────────────────────────────────────────────────────────────

const FLAG_STATES: FlagState[] = [
  'NONE',
  'CALM',
  'WAITING_FOR_START',
  'NATIONAL_ANTHEM',
  'GREEN',
  'YELLOW',
  'SAFETY_CAR',
  'VIRTUAL_SC',
  'RED',
  'FASTEST_LAP',
  'CHECKERED',
]

function flagButtonColor(flag: FlagState): string {
  switch (flag) {
    case 'RED':       return 'var(--red)'
    case 'YELLOW':
    case 'VIRTUAL_SC':
    case 'SAFETY_CAR': return 'var(--amber)'
    case 'GREEN':     return 'var(--green)'
    case 'FASTEST_LAP': return 'var(--purple)'
    default:          return 'var(--muted2)'
  }
}

function DevPanel() {
  const mode = useSessionStore((s) => s.mode)
  const setMode = useSessionStore((s) => s.setMode)
  const activeSession = useSessionStore((s) => s.activeSession)
  const ambientLayerEnabled   = useAmbientStore((s) => s.ambientLayerEnabled)
  const ambientLayerIntensity = useAmbientStore((s) => s.ambientLayerIntensity)
  const { proximity, session: nextRace, msToStart } = useNextRace(activeSession?.year ?? new Date().getFullYear())

  return (
    <div style={{
      borderTop: '0.5px solid var(--border2)',
      background: 'var(--bg)',
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
    }}>
      {/* Row 1: Ambient flag simulator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
          width: 52,
        }}>
          Ambient
        </span>
        {FLAG_STATES.map((flag) => {
          const color = flagButtonColor(flag)
          return (
            <button
              key={flag}
              onClick={() => useAmbientStore.getState().setFlagState(flag)}
              style={{
                padding: '1px 6px',
                borderRadius: 2,
                border: `0.5px solid ${color}`,
                background: 'transparent',
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
            >
              {flag}
            </button>
          )
        })}
      </div>

      {/* Row 2: App state */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
          width: 52,
        }}>
          State
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.06em',
        }}>
          mode: <span style={{ color: 'var(--muted)' }}>{mode}</span>
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.06em',
        }}>
          session: <span style={{ color: 'var(--muted)' }}>{activeSession?.session_key ?? 'none'}</span>
        </span>
      </div>

      {/* Row 3: Ambient layer controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
          width: 52,
        }}>
          Ambient Layer
        </span>

        {/* ON / OFF toggle */}
        {(['ON', 'OFF'] as const).map((label) => {
          const active = label === 'ON' ? ambientLayerEnabled : !ambientLayerEnabled
          const color  = active ? 'var(--green, #00C850)' : 'var(--muted2)'
          return (
            <button
              key={label}
              onClick={() => useAmbientStore.getState().setAmbientLayerEnabled(label === 'ON')}
              style={{
                padding: '1px 6px',
                borderRadius: 2,
                border: `0.5px solid ${color}`,
                background: active ? 'rgba(0,200,80,0.08)' : 'transparent',
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color,
                cursor: 'pointer',
                transition: 'background 0.1s, border-color 0.1s, color 0.1s',
              }}
            >
              {label}
            </button>
          )
        })}

        {/* Divider */}
        <span style={{ color: 'var(--muted2)', fontSize: 7, fontFamily: 'var(--mono)' }}>|</span>

        {/* Intensity presets */}
        {([25, 50, 75, 100] as const).map((pct) => {
          const active = ambientLayerIntensity === pct
          const color  = active ? 'var(--white)' : 'var(--muted2)'
          return (
            <button
              key={pct}
              onClick={() => useAmbientStore.getState().setAmbientLayerIntensity(pct)}
              style={{
                padding: '1px 6px',
                borderRadius: 2,
                border: `0.5px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                background: active ? 'var(--bg4)' : 'transparent',
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.08em',
                color,
                cursor: 'pointer',
                transition: 'background 0.1s, border-color 0.1s, color 0.1s',
              }}
            >
              {pct}%
            </button>
          )
        })}

        {/* Current intensity readout */}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.06em',
          marginLeft: 4,
        }}>
          {ambientLayerIntensity}%
        </span>
      </div>

      {/* Row 4: Live mode trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
          width: 52,
        }}>
          Mode
        </span>
        {(['historical', 'live'] as const).map((m) => {
          const active = mode === m
          const color = active ? 'var(--white)' : 'var(--muted2)'
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '1px 6px',
                borderRadius: 2,
                border: `0.5px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                background: active ? 'var(--bg4)' : 'transparent',
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color,
                cursor: 'pointer',
              }}
            >
              {m}
            </button>
          )
        })}
        {nextRace && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--muted2)',
            letterSpacing: '0.06em',
            marginLeft: 4,
          }}>
            next: <span style={{ color: 'var(--muted)' }}>
              {nextRace.circuit_short_name ?? nextRace.country_name} · {proximity}
              {proximity === 'imminent' ? ` · ${Math.floor(msToStart / 60000)}m` : ''}
            </span>
          </span>
        )}
      </div>

      {/* Row 5: Notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          flexShrink: 0,
          width: 52,
        }}>
          Notifs
        </span>
        <button
          onClick={() => useAmbientStore.getState().addToast('Test toast from dev panel', 'GREEN')}
          style={{
            padding: '1px 6px',
            borderRadius: 2,
            border: '0.5px solid var(--border2)',
            background: 'transparent',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          Fire toast
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('pitwall-trigger-live-mode-prompt'))}
          style={{
            padding: '1px 6px',
            borderRadius: 2,
            border: '0.5px solid rgba(232,19,43,0.4)',
            background: 'transparent',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(232,19,43,0.75)',
            cursor: 'pointer',
          }}
        >
          Fire prompt
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DiagnosticLog({ open, onClose }: DiagnosticLogProps) {
  const EXIT_MS = 220
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)
  const [activeFilters, setActiveFilters] = useState<Set<LogLevel>>(new Set(ALL_LEVELS))
  const [devOpen, setDevOpen] = useState(false)
  const [isPresent, setIsPresent] = useState(open)
  const [isClosing, setIsClosing] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      setIsPresent(true)
      setIsClosing(false)
      return
    }

    if (!isPresent) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsPresent(false)
      setIsClosing(false)
    }, EXIT_MS)
  }, [open, isPresent])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [entries, open])

  if (!isPresent) return null

  function toggleFilter(level: LogLevel) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pitwall-log.json'
    a.click()
  }

  const filtered = entries.filter((e) => activeFilters.has(e.level))

  return (
    <div className={isClosing ? 'animated-slide-down-exit' : 'animated-slide-down'} style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: devOpen ? 420 : 240,
      background: 'var(--bg3)',
      borderTop: '0.5px solid var(--border2)',
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      transition: 'height 0.15s ease',
    }}>
      {/* Header bar */}
      <div style={{
        height: 28,
        background: 'var(--bg4)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        paddingInline: 12,
        gap: 8,
        flexShrink: 0,
      }}>
        {/* Title */}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          flexShrink: 0,
          marginRight: 4,
        }}>
          Diagnostic Log
        </span>

        {/* Level filter buttons */}
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => toggleFilter(level)}
            className="interactive-button"
            style={{
              background: activeFilters.has(level) ? `${LEVEL_COLORS[level]}22` : 'transparent',
              border: `0.5px solid ${activeFilters.has(level) ? LEVEL_COLORS[level] : 'var(--border)'}`,
              borderRadius: 2,
              padding: '1px 6px',
              fontFamily: 'var(--mono)',
              fontSize: 7,
              letterSpacing: '0.1em',
              color: activeFilters.has(level) ? LEVEL_COLORS[level] : 'var(--muted2)',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {level}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* DEV toggle */}
        <button
          onClick={() => setDevOpen((v) => !v)}
          className="interactive-button"
          style={{
            background: devOpen ? 'rgba(139,92,246,0.15)' : 'none',
            border: `0.5px solid ${devOpen ? 'var(--purple)' : 'var(--border)'}`,
            borderRadius: 2,
            padding: '1px 8px',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: devOpen ? 'var(--purple)' : 'var(--muted2)',
            cursor: 'pointer',
            transition: 'all 0.1s',
          }}
        >
          DEV
        </button>

        {/* Export JSON */}
        <button
          onClick={exportJson}
          className="interactive-button"
          style={{
            background: 'none',
            border: '0.5px solid var(--border)',
            borderRadius: 2,
            padding: '1px 8px',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
            cursor: 'pointer',
          }}
        >
          Export JSON
        </button>

        {/* Clear */}
        <button
          onClick={clear}
          className="interactive-button"
          style={{
            background: 'none',
            border: '0.5px solid var(--border)',
            borderRadius: 2,
            padding: '1px 8px',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="interactive-button"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted2)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '0 2px',
          }}
          aria-label="Close diagnostic log"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
          }}>
            No log entries
          </div>
        ) : (
          filtered.map((entry, index) => <LogRow key={entry.id} entry={entry} index={index} />)
        )}
      </div>

      {/* DEV controls panel */}
      {devOpen && <DevPanel />}
    </div>
  )
}
