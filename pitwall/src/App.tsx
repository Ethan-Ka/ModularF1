import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ToastQueue } from './components/AmbientBar/ToastQueue'
import { TopChromeSharedGradientLayer } from './components/AmbientBar/TopChromeSharedGradientLayer'
import { TopChromeWaveLayer } from './components/AmbientBar/TopChromeWaveLayer'
import { FLAG_COLORS } from './components/AmbientBar/flagStateMachine'
import { useDrivers } from './hooks/useDrivers'
import { useLatestSession } from './hooks/useSession'
import { useRaceControl } from './hooks/useRaceControl'
import { usePositions } from './hooks/usePositions'
import { useIntervals } from './hooks/useIntervals'
import { useWeather } from './hooks/useWeather'
import { useStints } from './hooks/useStints'
import { useLaps } from './hooks/useLaps'
import { createPitwallChannel, WINDOW_CLIENT_ID } from './lib/windowSync'
import { coerceWidgetTransferPayload } from './lib/widgetTransfer'
import { useWindowStore } from './store/windowStore'
import { WidgetHost } from './components/WidgetHost/WidgetHost'
import { WIDGET_REGISTRY } from './widgets/registry'
import { resolveTeamPalette } from './lib/teamPalette'
import { APP_VERSION_LABEL } from './lib/appMeta'

const STARTUP_SPLASH_SHOW_DELAY_MS = 140
const STARTUP_SPLASH_MIN_VISIBLE_MS = 900
const STARTUP_SPLASH_RELOAD_SUPPRESS_MS = 3_000
const STARTUP_SPLASH_LAST_SHOWN_KEY = 'pitwall-startup-splash-last-shown-at'
const STARTUP_OVERLAY_FADE_MS = 260

interface StartupProgressState {
  workspaceReady: boolean
  sessionReady: boolean
  driversReady: boolean
}

type StartupProgressStep = keyof StartupProgressState

function makeEmptyStartupProgress(): StartupProgressState {
  return {
    workspaceReady: false,
    sessionReady: false,
    driversReady: false,
  }
}

function blendHex(base: string, tint: string, ratio: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ]
  }

  try {
    const [r1, g1, b1] = parse(base)
    const [r2, g2, b2] = parse(tint)
    const r = Math.round(r1 + (r2 - r1) * ratio)
    const g = Math.round(g1 + (g2 - g1) * ratio)
    const b = Math.round(b1 + (b2 - b1) * ratio)
    return `rgb(${r},${g},${b})`
  } catch {
    return base
  }
}

function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim()
  if (c.startsWith('#')) {
    const h = c.slice(1)
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ]
    }
  }

  const m = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
  return null
}

function shouldSuppressStartupSplash() {
  try {
    const now = Date.now()
    const raw = window.sessionStorage.getItem(STARTUP_SPLASH_LAST_SHOWN_KEY)
    const lastShownAt = raw ? Number(raw) : 0
    window.sessionStorage.setItem(STARTUP_SPLASH_LAST_SHOWN_KEY, String(now))
    return Number.isFinite(lastShownAt) && now - lastShownAt < STARTUP_SPLASH_RELOAD_SUPPRESS_MS
  } catch {
    return false
  }
}

function usePersistHydrationReady() {
  const [hydrated, setHydrated] = useState(() => {
    const stores = [useSessionStore, useDriverStore, useWorkspaceStore, useAmbientStore]
    return stores.every((store) => store.persist.hasHydrated())
  })

  useEffect(() => {
    const stores = [useSessionStore, useDriverStore, useWorkspaceStore, useAmbientStore]
    const update = () => setHydrated(stores.every((store) => store.persist.hasHydrated()))
    const unsubscribers = stores.map((store) => store.persist.onFinishHydration(update))
    update()
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [])

  return hydrated
}

function useStartupSplashVisibility(shouldBlock: boolean) {
  const suppressOnQuickReload = useMemo(() => shouldSuppressStartupSplash(), [])
  const [visible, setVisible] = useState(false)
  const shownAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (suppressOnQuickReload) {
      setVisible(false)
      return
    }

    if (shouldBlock) {
      const showTimer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setVisible(true)
      }, STARTUP_SPLASH_SHOW_DELAY_MS)

      return () => clearTimeout(showTimer)
    }

    if (!visible) return

    const shownAt = shownAtRef.current ?? Date.now()
    const elapsed = Date.now() - shownAt
    const remaining = Math.max(0, STARTUP_SPLASH_MIN_VISIBLE_MS - elapsed)

    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, remaining)

    return () => clearTimeout(hideTimer)
  }, [shouldBlock, suppressOnQuickReload, visible])

  return visible
}

function StartupLoadingScreen({ progress, visible }: { progress: StartupProgressState; visible: boolean }) {
  const items = [
    { label: 'Loading session', ready: progress.sessionReady },
    { label: 'Loading driver data', ready: progress.driversReady },
    { label: 'Loading workspace state', ready: progress.workspaceReady },
  ]
  const readyCount = items.filter((item) => item.ready).length
  const completion = Math.round((readyCount / items.length) * 100)

  return (
    <div
      className="animated-fade"
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(900px 420px at 50% 52%, rgba(232,19,43,0.16), rgba(232,19,43,0.03) 42%, transparent 74%), var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.995)',
        transition: `opacity ${STARTUP_OVERLAY_FADE_MS}ms ease, transform ${STARTUP_OVERLAY_FADE_MS}ms var(--motion-out)`,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="animated-surface"
        style={{
          width: 'min(560px, 94vw)',
          border: '0.5px solid var(--border2)',
          borderRadius: 8,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
          padding: '30px 28px',
          boxShadow: '0 16px 44px rgba(0,0,0,0.38)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
          transition: `opacity ${STARTUP_OVERLAY_FADE_MS}ms ease, transform ${STARTUP_OVERLAY_FADE_MS}ms var(--motion-in-out)`,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1,
            marginBottom: 10,
            letterSpacing: '0.01em',
          }}
        >
          PIT<span style={{ color: 'var(--red)' }}>W</span>ALL
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
            marginBottom: 20,
          }}
        >
          Loading
        </div>

        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.08em',
            color: 'var(--muted2)',
            marginTop: -12,
            marginBottom: 16,
            textTransform: 'uppercase',
          }}
        >
          {APP_VERSION_LABEL}
        </div>

        <div
          style={{
            height: 5,
            borderRadius: 999,
            border: '0.5px solid var(--border)',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completion}%`,
              background: 'var(--red)',
              transition: 'width var(--motion-base) var(--motion-spring)',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            lineHeight: 1.8,
            textTransform: 'uppercase',
          }}
        >
          {items.map((item) => (
            <div key={item.label} style={{ color: item.ready ? 'var(--green)' : 'var(--muted)' }}>
              {item.ready ? `${item.label} - ready` : item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function relativeLuma(color: string): number {
  const rgb = parseRgb(color)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((n) => n / 255)
  const [R, G, B] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

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
interface DataLayerProps {
  onStartupProgressChange?: (progress: StartupProgressState) => void
}

function DataLayer({ onStartupProgressChange }: DataLayerProps) {
  const driversQuery = useDrivers()
  useRaceControl()
  const positionsQuery = usePositions()
  // Prime data for widgets that may not be mounted yet.
  // In live mode this prefetch path does a single fetch (no interval polling).
  useIntervals({ preload: true })
  useWeather({ preload: true })
  useStints(undefined, { preload: true })
  useLaps(undefined, { preload: true })

  const latestSessionQuery = useLatestSession()
  const latestSession = latestSessionQuery.data
  const { activeSession, setActiveSession, mode, apiRequestsEnabled } = useSessionStore()
  const { setLeader, flagState, setFlagState } = useAmbientStore()
  const { drivers, seasonYear, getTeamColor, importSeasonFromPublic } = useDriverStore()
  const positions = positionsQuery.data
  const [seasonBootstrapDone, setSeasonBootstrapDone] = useState(false)
  const seasonBootstrapAttemptRef = useRef<number | null>(null)

  // Auto-select latest session if none active
  useEffect(() => {
    if (mode !== 'onboarding' && !activeSession && latestSession?.[0]) {
      setActiveSession(latestSession[0])
    }
  }, [latestSession, activeSession, mode, setActiveSession])

  // Preload a season bundle on startup so focus chips and driver preferences are ready
  // even before the Driver Manager modal has ever been opened.
  useEffect(() => {
    if (mode === 'onboarding') return
    if (drivers.length > 0) {
      setSeasonBootstrapDone(true)
      return
    }

    const targetYear = activeSession?.year ?? seasonYear ?? latestSession?.[0]?.year ?? 2026
    if (seasonBootstrapAttemptRef.current === targetYear) return
    seasonBootstrapAttemptRef.current = targetYear

    void importSeasonFromPublic(targetYear)
      .catch(() => {
        // Best-effort startup seed; live API data will still load when available.
      })
      .finally(() => {
        setSeasonBootstrapDone(true)
      })
  }, [mode, drivers.length, activeSession?.year, seasonYear, latestSession, importSeasonFromPublic])

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

  useEffect(() => {
    if (!onStartupProgressChange) return

    const sessionReady =
      mode === 'onboarding'
      || !apiRequestsEnabled
      || !!activeSession
      || !!latestSession?.[0]
      || latestSessionQuery.isError
    const driversReady =
      mode === 'onboarding'
      || !apiRequestsEnabled
      || drivers.length > 0
      || seasonBootstrapDone
      || driversQuery.isSuccess
      || driversQuery.isError

    onStartupProgressChange({
      workspaceReady: true,
      sessionReady,
      driversReady,
    })
  }, [
    onStartupProgressChange,
    mode,
    apiRequestsEnabled,
    activeSession,
    latestSession,
    latestSessionQuery.isError,
    drivers.length,
    driversQuery.isSuccess,
    driversQuery.isError,
    seasonBootstrapDone,
  ])

  return null
}

function pickSessionSyncState(state: ReturnType<typeof useSessionStore.getState>) {
  return {
    apiKey: state.apiKey,
    mode: state.mode,
    activeSession: state.activeSession,
    apiRequestsEnabled: state.apiRequestsEnabled,
  }
}

function pickAmbientSyncState(state: ReturnType<typeof useAmbientStore.getState>) {
  return {
    flagState: state.flagState,
    previousFlagState: state.previousFlagState,
    leaderColorMode: state.leaderColorMode,
    leaderColor: state.leaderColor,
    leaderDriverNumber: state.leaderDriverNumber,
    bannerMessage: state.bannerMessage,
    ambientLayerEnabled: state.ambientLayerEnabled,
    ambientLayerIntensity: state.ambientLayerIntensity,
    ambientLayerWaveEnabled: state.ambientLayerWaveEnabled,
  }
}

function pickDriverSyncState(state: ReturnType<typeof useDriverStore.getState>) {
  return {
    starred: state.starred,
    canvasFocus: state.canvasFocus,
  }
}

function applyBootstrapWidgetPayload(rawPayload: unknown) {
  const payload = coerceWidgetTransferPayload(rawPayload)
  if (!payload) return

  const workspace = useWorkspaceStore.getState()
  const targetTabId = workspace.activeTabId || workspace.tabs[0]?.id
  if (!targetTabId) return

  useWorkspaceStore.setState((s) => ({
    ...s,
    tabs: s.tabs.map((tab) =>
      tab.id === targetTabId
        ? { ...tab, name: 'Pop-out', layout: [], widgets: {} }
        : tab
    ),
    activeTabId: targetTabId,
  }))

  const nextWidget = {
    ...payload.widget,
    settings: { ...(payload.widget.settings ?? {}), poppedOut: true },
  }

  workspace.addWidget(targetTabId, nextWidget, {
    i: nextWidget.id,
    x: 0,
    y: Infinity,
    w: payload.layout.w,
    h: payload.layout.h,
    minW: payload.layout.minW ?? 3,
    minH: payload.layout.minH ?? 2,
  })

  useWindowStore.getState().setPopoutMode(nextWidget.id)
}

// Cross-window sync via BroadcastChannel + Electron bootstrap transfer events
function BroadcastSync() {
  useEffect(() => {
    const channel = createPitwallChannel()
    if (!channel) return

    let applyingRemoteState = false

    const postState = (scope: 'session' | 'ambient' | 'driver', payload: unknown) => {
      channel.postMessage({
        kind: 'state-sync',
        origin: WINDOW_CLIENT_ID,
        scope,
        payload,
      })
    }

    const unsubscribeSession = useSessionStore.subscribe((state) => {
      if (applyingRemoteState) return
      postState('session', pickSessionSyncState(state))
    })

    const unsubscribeAmbient = useAmbientStore.subscribe((state) => {
      if (applyingRemoteState) return
      postState('ambient', pickAmbientSyncState(state))
    })

    const unsubscribeDriver = useDriverStore.subscribe((state) => {
      if (applyingRemoteState) return
      postState('driver', pickDriverSyncState(state))
    })

    const unsubscribeBootstrap = window.electronAPI?.onWindowBootstrapWidget?.((rawPayload) => {
      applyBootstrapWidgetPayload(rawPayload)
    })

    void window.electronAPI?.consumeWindowBootstrapWidget?.().then((payload) => {
      if (!payload) return
      applyBootstrapWidgetPayload(payload)
    }).catch(() => {
      // no-op: best-effort fallback for missed bootstrap push
    })

    channel.onmessage = (event) => {
      const message = event.data
      if (!message || typeof message !== 'object') return
      if (message.origin === WINDOW_CLIENT_ID) return

      if (message.kind === 'widget-transfer-remove-source') {
        if (message.sourceClientId !== WINDOW_CLIENT_ID) return
        useWorkspaceStore.getState().removeWidget(message.sourceTabId, message.widgetId)
        return
      }

      if (message.kind !== 'state-sync') return

      applyingRemoteState = true
      try {
        if (message.scope === 'session' && message.payload && typeof message.payload === 'object') {
          useSessionStore.setState((s) => ({ ...s, ...(message.payload as Partial<ReturnType<typeof pickSessionSyncState>>) }))
        }
        if (message.scope === 'ambient' && message.payload && typeof message.payload === 'object') {
          useAmbientStore.setState((s) => ({ ...s, ...(message.payload as Partial<ReturnType<typeof pickAmbientSyncState>>) }))
        }
        if (message.scope === 'driver' && message.payload && typeof message.payload === 'object') {
          useDriverStore.setState((s) => ({ ...s, ...(message.payload as Partial<ReturnType<typeof pickDriverSyncState>>) }))
        }
      } finally {
        applyingRemoteState = false
      }
    }

    postState('session', pickSessionSyncState(useSessionStore.getState()))
    postState('ambient', pickAmbientSyncState(useAmbientStore.getState()))
    postState('driver', pickDriverSyncState(useDriverStore.getState()))

    return () => {
      unsubscribeSession()
      unsubscribeAmbient()
      unsubscribeDriver()
      if (typeof unsubscribeBootstrap === 'function') unsubscribeBootstrap()
      channel.close()
    }
  }, [])

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

function PopoutLayout() {
  const popoutWidgetId = useWindowStore((s) => s.popoutWidgetId)
  const tabs = useWorkspaceStore((s) => s.tabs)

  const tab = tabs.find((t) => popoutWidgetId && t.widgets[popoutWidgetId])
  const widget = popoutWidgetId && tab ? tab.widgets[popoutWidgetId] : undefined
  const WidgetComponent = widget ? WIDGET_REGISTRY[widget.type] : undefined

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }} className="animated-fade">
      <AmbientRaceLayer />
      <div style={{ flex: 1, padding: 6 }}>
        {widget && WidgetComponent ? (
          <WidgetHost widgetId={widget.id}>
            <WidgetComponent widgetId={widget.id} />
          </WidgetHost>
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Pop-out widget unavailable
          </div>
        )}
      </div>
    </div>
  )
}

function MainLayout({ hideCanvasWidgetAdd }: { hideCanvasWidgetAdd: boolean }) {
  const TOP_CHROME_STACK_HEIGHT = 102
  const TOP_CHROME_TRANSITION_Y = 54
  const TOP_CHROME_TAIL_FADE_PX = 60
  const TEXT_SCRIM_TOOLBAR = 0.22
  const TEXT_SCRIM_FOCUS = 0.16
  const TEXT_SCRIM_TABS = 0.12
  const TOP_CHROME_TEXT_SHADOW = '0 1px 1px rgba(0,0,0,0.48), 0 0 6px rgba(0,0,0,0.26)'

  const { tabs, activeTabId } = useWorkspaceStore()
  const toasts = useAmbientStore((s) => s.toasts)
  const flagState = useAmbientStore((s) => s.flagState)
  const leaderColorMode = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const getDriver = useDriverStore((s) => s.getDriver)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessionBrowserOpen, setSessionBrowserOpen] = useState(false)
  const logEntries = useLogStore((s) => s.entries)
  const hasErrors = logEntries.some((e) => e.level === 'ERR')

  const topChromeTextTheme = useMemo(() => {
    const colors = FLAG_COLORS[flagState]
    const leaderTeamName = leaderDriverNumber != null ? getDriver(leaderDriverNumber)?.team_name ?? null : null
    const leaderPalette = resolveTeamPalette(leaderTeamName, leaderColor)

    const bgTone =
      flagState === 'GREEN' && leaderColorMode && leaderPalette
        ? blendHex(colors.background, leaderPalette.primary, 0.2)
        : colors.background

    const luma = relativeLuma(bgTone)
    const darkText = luma > 0.2

    if (darkText) {
      return {
        white: '#0D1117',
        muted: '#1F2937',
        muted2: '#374151',
      }
    }

    return {
      white: '#F3F6FA',
      muted: '#C9D1DB',
      muted2: '#9AA4B2',
    }
  }, [flagState, leaderColorMode, leaderColor, leaderDriverNumber, getDriver])

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true)
    const openSessionBrowser = () => setSessionBrowserOpen(true)
    const toggleLogPanel = () => setLogOpen((v) => !v)

    window.addEventListener('pitwall-open-settings', openSettings)
    window.addEventListener('pitwall-open-session-browser', openSessionBrowser)
    window.addEventListener('pitwall-toggle-log-panel', toggleLogPanel)

    return () => {
      window.removeEventListener('pitwall-open-settings', openSettings)
      window.removeEventListener('pitwall-open-session-browser', openSessionBrowser)
      window.removeEventListener('pitwall-toggle-log-panel', toggleLogPanel)
    }
  }, [])

  return (
    <div className="animated-fade" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Full-screen ambient race layer — sits behind all UI */}
      <AmbientRaceLayer />

      <div style={{ position: 'relative', flexShrink: 0, height: 102 }}>
        {/* Layer 1: background bars */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <div style={{ height: 42, background: 'var(--bg2)', borderBottom: '0.5px solid var(--border)' }} />
          <div style={{ height: 32, background: 'var(--bg2)', borderBottom: '0.5px solid var(--border)' }} />
          <div style={{ height: 28, background: 'var(--bg2)' }} />
        </div>

        {/* Layer 2: ambient effects */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <TopChromeSharedGradientLayer
            transitionY={TOP_CHROME_TRANSITION_Y}
            tailFadePx={TOP_CHROME_TAIL_FADE_PX}
          />
          <TopChromeWaveLayer
            transitionY={TOP_CHROME_TRANSITION_Y}
            tailFadePx={TOP_CHROME_TAIL_FADE_PX}
          />

          {/* Readability scrim to keep text legible over ambient effects */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: TOP_CHROME_STACK_HEIGHT,
              background: `linear-gradient(180deg,
                rgba(0,0,0,${TEXT_SCRIM_TOOLBAR}) 0px,
                rgba(0,0,0,${TEXT_SCRIM_TOOLBAR}) 42px,
                rgba(0,0,0,${TEXT_SCRIM_FOCUS}) 42px,
                rgba(0,0,0,${TEXT_SCRIM_FOCUS}) 74px,
                rgba(0,0,0,${TEXT_SCRIM_TABS}) 74px,
                rgba(0,0,0,${TEXT_SCRIM_TABS}) 102px
              )`,
            }}
          />
        </div>

        {/* Layer 3: toolbar/focus/tabs content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textShadow: TOP_CHROME_TEXT_SHADOW,
            ['--white' as string]: topChromeTextTheme.white,
            ['--muted' as string]: topChromeTextTheme.muted,
            ['--muted2' as string]: topChromeTextTheme.muted2,
          }}
        >
          {/* Toolbar — also serves as Electron drag region */}
          <div className="animated-slide-down" style={{
            height: 42,
            background: 'transparent',
            borderBottom: 'none',
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
            <AmbientBar toolbar transparentBackground />
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
            className="interactive-chip"
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
              className="interactive-button"
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
            className="interactive-button"
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
            className="interactive-button"
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
        </div>
      </div>

      {/* Main canvas */}
      {activeTab && <Canvas tabId={activeTab.id} hideAddWidget={hideCanvasWidgetAdd} />}

      {/* Diagnostic log panel */}
      <DiagnosticLog open={logOpen} onClose={() => setLogOpen(false)} />

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Session browser */}
      {sessionBrowserOpen && <SessionBrowserModal onClose={() => setSessionBrowserOpen(false)} />}

      {/* Global toast queue for system/dev toasts. Kept outside AmbientRaceLayer on purpose. */}
      <div
        className="animated-surface"
        style={{
          position: 'fixed',
          top: 48,
          right: 12,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <ToastQueue toasts={toasts} />
      </div>
    </div>
  )
}

export default function App() {
  const mode = useSessionStore((s) => s.mode)
  const windowMode = useWindowStore((s) => s.mode)
  const hydrated = usePersistHydrationReady()
  const [startupProgress, setStartupProgress] = useState<StartupProgressState>(makeEmptyStartupProgress)
  const [loadingPreviewActive, setLoadingPreviewActive] = useState(false)
  const [loadingPreviewProgress, setLoadingPreviewProgress] = useState<StartupProgressState>(makeEmptyStartupProgress)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)

  useEffect(() => {
    if (mode === 'onboarding') {
      setStartupProgress({ workspaceReady: true, sessionReady: true, driversReady: true })
      return
    }

    setStartupProgress((prev) => ({ ...prev, sessionReady: false, driversReady: false }))
  }, [mode])

  useEffect(() => {
    let finishTimer: ReturnType<typeof setTimeout> | null = null

    const setStepReady = (step: StartupProgressStep) => {
      setLoadingPreviewProgress((prev) => ({ ...prev, [step]: true }))
    }

    const onToggle = () => {
      setLoadingPreviewActive((prev) => {
        const next = !prev
        if (next) setLoadingPreviewProgress(makeEmptyStartupProgress())
        return next
      })
    }

    const onStart = () => {
      setLoadingPreviewProgress(makeEmptyStartupProgress())
      setLoadingPreviewActive(true)
    }

    const onAdvance = (event: Event) => {
      const detail = (event as CustomEvent<{ step?: StartupProgressStep }>).detail
      const step = detail?.step
      if (!step) return
      setStepReady(step)
    }

    const onReset = () => {
      setLoadingPreviewProgress(makeEmptyStartupProgress())
      setLoadingPreviewActive(true)
    }

    const onFinish = () => {
      setLoadingPreviewProgress({ workspaceReady: true, sessionReady: true, driversReady: true })
      if (finishTimer) {
        clearTimeout(finishTimer)
      }
      finishTimer = setTimeout(() => {
        setLoadingPreviewActive(false)
      }, 360)
    }

    window.addEventListener('pitwall-loading-preview-toggle', onToggle)
    window.addEventListener('pitwall-loading-preview-start', onStart)
    window.addEventListener('pitwall-loading-preview-advance-step', onAdvance as EventListener)
    window.addEventListener('pitwall-loading-preview-reset', onReset)
    window.addEventListener('pitwall-loading-preview-finish', onFinish)

    return () => {
      if (finishTimer) {
        clearTimeout(finishTimer)
        finishTimer = null
      }
      window.removeEventListener('pitwall-loading-preview-toggle', onToggle)
      window.removeEventListener('pitwall-loading-preview-start', onStart)
      window.removeEventListener('pitwall-loading-preview-advance-step', onAdvance as EventListener)
      window.removeEventListener('pitwall-loading-preview-reset', onReset)
      window.removeEventListener('pitwall-loading-preview-finish', onFinish)
    }
  }, [])

  const mergedProgress: StartupProgressState = {
    workspaceReady: hydrated,
    sessionReady: startupProgress.sessionReady,
    driversReady: startupProgress.driversReady,
  }
  const startupDataReady = mergedProgress.workspaceReady && mergedProgress.sessionReady && mergedProgress.driversReady
  const shouldBlockStartup = mode !== 'onboarding' && !startupDataReady
  const showStartupSplash = useStartupSplashVisibility(shouldBlockStartup)
  const effectiveOverlayProgress = loadingPreviewActive ? loadingPreviewProgress : mergedProgress
  const shouldShowLoadingOverlay = loadingPreviewActive || showStartupSplash

  useEffect(() => {
    if (shouldShowLoadingOverlay) {
      setOverlayMounted(true)
      const frame = requestAnimationFrame(() => setOverlayVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setOverlayVisible(false)
    if (!overlayMounted) return
    const timer = setTimeout(() => {
      setOverlayMounted(false)
    }, STARTUP_OVERLAY_FADE_MS)
    return () => clearTimeout(timer)
  }, [shouldShowLoadingOverlay, overlayMounted])

  return (
    <>
      <WorkspaceInit />
      <BroadcastSync />
      {windowMode === 'popout' ? (
        <>
          <DataLayer onStartupProgressChange={setStartupProgress} />
          {overlayMounted && <StartupLoadingScreen progress={effectiveOverlayProgress} visible={overlayVisible} />}
          <PopoutLayout />
        </>
      ) : mode === 'onboarding' ? (
        <ApiKeyOnboarding />
      ) : (
        <>
          <DataLayer onStartupProgressChange={setStartupProgress} />
          {overlayMounted && <StartupLoadingScreen progress={effectiveOverlayProgress} visible={overlayVisible} />}
          <MainLayout hideCanvasWidgetAdd={overlayMounted} />
        </>
      )}
    </>
  )
}
