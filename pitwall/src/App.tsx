import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from './store/sessionStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { useAmbientStore } from './store/ambientStore'
import { useDriverStore } from './store/driverStore'
import { useLogStore } from './store/logStore'
import { ApiKeyOnboarding } from './screens/ApiKeyOnboarding'
import { AmbientBar } from './components/AmbientBar/AmbientBar'
import { AmbientRaceLayer } from './components/AmbientRaceLayer/AmbientRaceLayer'
import { FocusStrip } from './components/DriverManager/FocusStrip'
import { CanvasTabs } from './components/Canvas/CanvasTabs'
import { Canvas } from './components/Canvas/Canvas'
import { DiagnosticLog } from './components/DiagnosticLog/DiagnosticLog'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { SessionBrowserModal } from './components/SessionBrowser/SessionBrowserModal'
import { useDrivers } from './hooks/useDrivers'
import { useLatestSession } from './hooks/useSession'
import { useRaceControl } from './hooks/useRaceControl'
import { usePositions } from './hooks/usePositions'

// Initializes activeTabId if empty (first load)
function WorkspaceInit() {
  const { tabs, activeTabId, setActiveTab } = useWorkspaceStore()

  useEffect(() => {
    if (!activeTabId && tabs.length > 0) {
      setActiveTab(tabs[0].id)
    }
  }, []) // intentionally run only once on mount

  return null
}

// Loads session + driver data reactively
function DataLayer() {
  useDrivers()
  useRaceControl()
  usePositions()

  const { data: latestSession } = useLatestSession()
  const { activeSession, setActiveSession, mode } = useSessionStore()
  const { setLeader, flagState, setFlagState } = useAmbientStore()
  const { getTeamColor } = useDriverStore()
  const { data: positions } = usePositions()

  // Auto-select latest session if none active
  useEffect(() => {
    if (mode !== 'onboarding' && !activeSession && latestSession?.[0]) {
      setActiveSession(latestSession[0])
    }
  }, [latestSession, activeSession, mode, setActiveSession])

  // Track leader for ambient color mode
  useEffect(() => {
    if (!positions || positions.length === 0) return
    const leader = positions.find((p) => p.position === 1)
    if (leader) {
      const color = getTeamColor(leader.driver_number)
      setLeader(leader.driver_number, color)
    }
  }, [positions, getTeamColor, setLeader])

  // Live race sessions should never idle in NONE ambient state.
  useEffect(() => {
    const sessionName = activeSession?.session_name ?? ''
    const isRaceSession = /race/i.test(sessionName)
    if (mode === 'live' && isRaceSession && flagState === 'NONE') {
      setFlagState('GREEN', 'Green flag')
    }
  }, [mode, activeSession?.session_name, flagState, setFlagState])

  return null
}

// Cross-tab sync via BroadcastChannel
function BroadcastSync() {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const { setCanvasFocus } = useDriverStore()
  const { setFlagState } = useAmbientStore()

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel('pitwall-sync')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const { type, payload } = event.data ?? {}
      if (type === 'SET_FOCUS') setCanvasFocus(payload)
      if (type === 'SET_FLAG') setFlagState(payload.state, payload.message)
    }

    return () => channel.close()
  }, [setCanvasFocus, setFlagState])

  return null
}

// Session selector component (toolbar center)
function SessionSelector() {
  const { activeSession } = useSessionStore()
  const { data: sessions } = useLatestSession()

  if (!activeSession && !sessions?.length) {
    return (
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted2)',
        letterSpacing: '0.08em',
      }}>
        No session
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        color: 'var(--muted2)',
        textTransform: 'uppercase',
      }}>
        {activeSession?.circuit_short_name ?? '—'}
      </span>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        color: 'var(--muted)',
      }}>
        {activeSession?.session_name ?? '—'}
      </span>
      {activeSession?.year && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
          padding: '1px 5px',
          border: '0.5px solid var(--border)',
          borderRadius: 2,
        }}>
          {activeSession.year}
        </span>
      )}
    </div>
  )
}

function MainLayout() {
  const { tabs, activeTabId } = useWorkspaceStore()
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessionBrowserOpen, setSessionBrowserOpen] = useState(false)
  const logEntries = useLogStore((s) => s.entries)
  const hasErrors = logEntries.some((e) => e.level === 'ERR')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Full-screen ambient race layer — sits behind all UI */}
      <AmbientRaceLayer />

      {/* Toolbar — also serves as Electron drag region */}
      <div style={{
        height: 42,
        background: 'var(--bg2)',
        borderBottom: '0.5px solid var(--border)',
        position: 'relative',
        alignItems: 'center',
        paddingInline: 14,
        flexShrink: 0,
        // @ts-ignore — Electron CSS property for window dragging
        WebkitAppRegion: 'drag',
      }}>
        {/* Full-width ambient strip integrated into toolbar background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
        >
          <AmbientBar embedded toolbar />
        </div>

        {/* Toolbar foreground content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              minWidth: 260,
              maxWidth: '52vw',
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
          >
            {/* Logo hidden for now but kept in markup for later reuse */}
            <div
              aria-hidden="true"
              style={{
                display: 'none',
                fontFamily: 'var(--cond)',
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: '-0.01em',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              PIT<span style={{ color: 'var(--red)' }}>W</span>ALL
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
            onClick={() => setSessionBrowserOpen(true)}
          >
            <SessionSelector />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
          >
          {/* New window button — only shown when running inside Electron */}
          {window.electronAPI && (
            <button
              onClick={() => window.electronAPI!.openNewWindow().catch(() => {})}
              title="Open new window"
              style={{
                background: 'none',
                border: '0.5px solid var(--border)',
                borderRadius: 3,
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                cursor: 'pointer',
              }}
            >
              + Window
            </button>
          )}

          {/* LOG button */}
          <button
            onClick={() => setLogOpen((v) => !v)}
            style={{
              background: 'none',
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              padding: '4px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: hasErrors ? 'var(--red)' : 'var(--muted2)',
              cursor: 'pointer',
            }}
          >
            LOG
          </button>

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              background: 'none',
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              padding: '4px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Settings
          </button>
          </div>
        </div>
      </div>

      {/* Focus strip */}
      <FocusStrip />

      {/* Canvas tabs */}
      <CanvasTabs />

      {/* Main canvas */}
      {activeTab && <Canvas tabId={activeTab.id} />}

      {/* Diagnostic log panel */}
      <DiagnosticLog open={logOpen} onClose={() => setLogOpen(false)} />

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Session browser */}
      {sessionBrowserOpen && <SessionBrowserModal onClose={() => setSessionBrowserOpen(false)} />}
    </div>
  )
}

export default function App() {
  const mode = useSessionStore((s) => s.mode)

  return (
    <>
      <WorkspaceInit />
      <BroadcastSync />
      {mode === 'onboarding' ? (
        <ApiKeyOnboarding />
      ) : (
        <>
          <DataLayer />
          <MainLayout />
        </>
      )}
    </>
  )
}
