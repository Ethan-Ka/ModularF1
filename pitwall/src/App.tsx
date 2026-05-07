import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessionStore } from './store/sessionStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { useAmbientStore } from './store/ambientStore'
import { useDriverStore } from './store/driverStore'
import { useLogStore } from './store/logStore'
import { useFakeTelemetryStore } from './store/fakeTelemetryStore'
import { ApiKeyOnboarding } from './screens/ApiKeyOnboarding'
import { SeasonHub } from './screens/SeasonHub'
import { AmbientBar } from './components/AmbientBar/AmbientBar'
import { AmbientRaceLayer } from './components/AmbientRaceLayer/AmbientRaceLayer'
import { FocusStrip } from './components/DriverManager/FocusStrip'
import { CanvasTabs } from './components/Canvas/CanvasTabs'
import { Canvas } from './components/Canvas/Canvas'
import { DiagnosticLog } from './components/DiagnosticLog/DiagnosticLog'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { SeasonStandingsModal } from './components/SeasonStandings/SeasonStandingsModal'
import { ToastQueue } from './components/AmbientBar/ToastQueue'
import { TopChromeSharedGradientLayer } from './components/AmbientBar/TopChromeSharedGradientLayer'
import { TopChromeWaveLayer } from './components/AmbientBar/TopChromeWaveLayer'
import { FLAG_COLORS } from './components/AmbientBar/flagStateMachine'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useDrivers } from './hooks/useDrivers'
import { useSeasonStandings } from './hooks/useSeasonStandings'
import { useLatestSession, useSessions } from './hooks/useSession'
import { useAutoFastF1Session } from './hooks/useAutoFastF1Session'
import { useFastF1ServerStatus } from './hooks/useFastF1'
import { useNextRace } from './hooks/useNextRace'
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
import { WIDGET_REGISTRY, getMinHeightForWidget } from './widgets/registry'
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
  standingsReady: boolean
  calendarReady: boolean
}

function isWidgetPopoutWindow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('windowKind') === 'widget-popout'
  } catch {
    return false
  }
}

type StartupProgressStep = keyof StartupProgressState

function makeEmptyStartupProgress(): StartupProgressState {
  return {
    workspaceReady: false,
    sessionReady: false,
    driversReady: false,
    standingsReady: false,
    calendarReady: false,
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
    { label: 'Loading standings', ready: progress.standingsReady },
    { label: 'Loading calendar data', ready: progress.calendarReady },
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
  useFastF1ServerStatus()
  useAutoFastF1Session()
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
  const { activeSession, setActiveSession, mode, setMode, apiKey, apiRequestsEnabled } = useSessionStore()
  const standingsYear = activeSession?.year ?? new Date().getFullYear()
  const standingsQuery = useSeasonStandings(standingsYear)

  // Race proximity for pre-race ambient state — uses the same year as the active session
  const nextRaceYear = activeSession?.year ?? new Date().getFullYear()
  const { proximity: raceProximity, session: nextRaceSession } = useNextRace(nextRaceYear)
  const calendarQuery = useSessions(nextRaceYear)

  // Credential gating: advance out of onboarding, never force back into it.
  useEffect(() => {
    if (mode === 'onboarding' && apiKey) setMode('hub')
  }, [apiKey, mode, setMode])

  const { setLeader, flagState, setFlagState } = useAmbientStore()
  const { drivers, seasonYear, getTeamColor, importSeasonFromPublic } = useDriverStore()
  const positions = positionsQuery.data
  const [seasonBootstrapDone, setSeasonBootstrapDone] = useState(false)
  const seasonBootstrapAttemptRef = useRef<number | null>(null)

  // Clear ambient state when entering hub mode
  useEffect(() => {
    if (mode === 'hub' && flagState !== 'NONE') {
      setFlagState('NONE')
    }
  }, [mode, flagState, setFlagState])

  // Auto-select latest session only in live mode
  useEffect(() => {
    if (mode !== 'live') return
    if (!activeSession && latestSession?.[0]) {
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

  // Drive ambient bar state from race proximity when in live mode and no active race is running.
  // useRaceControl() handles flag states during an active race — this only covers the gap periods.
  useEffect(() => {
    if (mode !== 'live') return

    const sessionName = activeSession?.session_name ?? ''
    const isActiveRaceSession = /race/i.test(sessionName) && (() => {
      const now = new Date()
      const start = activeSession?.date_start ? new Date(activeSession.date_start) : null
      const end = activeSession?.date_end ? new Date(activeSession.date_end) : null
      return start && end && now >= start && now <= end
    })()

    // If a race is actively running, keep current flag state (raceControl drives it)
    if (isActiveRaceSession) return

    // Between sessions — drive by how close the next race is
    if (raceProximity === 'live') {
      // Race is running per schedule but not yet in raceControl — seed GREEN
      if (flagState === 'NONE' || flagState === 'CALM') {
        setFlagState('GREEN', 'Green flag')
      }
    } else if (raceProximity === 'imminent' || raceProximity === 'today') {
      if (flagState !== 'WAITING_FOR_START') {
        setFlagState('WAITING_FOR_START', nextRaceSession?.session_name ? `${nextRaceSession.session_name} starting soon` : 'Race starting soon')
      }
    } else if (raceProximity === 'weekend') {
      if (flagState !== 'CALM') {
        const circuit = nextRaceSession?.circuit_short_name ?? nextRaceSession?.country_name ?? ''
        setFlagState('CALM', circuit ? `Race weekend · ${circuit}` : 'Race weekend')
      }
    } else {
      // Upcoming (> 7 days) or no schedule data — quiet dormant state
      // Don't use NONE in live mode: ambientStore normalizes NONE → GREEN when session_name === 'Race'
      if (flagState !== 'CALM') {
        setFlagState('CALM', nextRaceSession ? `Next: ${nextRaceSession.circuit_short_name ?? nextRaceSession.country_name ?? ''}` : '')
      }
    }
  }, [mode, raceProximity, activeSession?.session_name, activeSession?.date_start, activeSession?.date_end, flagState, setFlagState, nextRaceSession?.session_name, nextRaceSession?.circuit_short_name, nextRaceSession?.country_name])

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
    const standingsReady =
      mode === 'onboarding'
      || !apiRequestsEnabled
      || !!standingsQuery.standings
      || !standingsQuery.isLoading
    const calendarReady =
      mode === 'onboarding'
      || !apiRequestsEnabled
      || !!calendarQuery.data
      || !calendarQuery.isLoading

    onStartupProgressChange({
      workspaceReady: true,
      sessionReady,
      driversReady,
      standingsReady,
      calendarReady,
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
    standingsQuery.standings,
    standingsQuery.isLoading,
    calendarQuery.data,
    calendarQuery.isLoading,
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
  if (!isWidgetPopoutWindow()) return

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

  const widgetMinH = getMinHeightForWidget(nextWidget.type)
  const minH = Math.max(payload.layout.minH ?? 2, widgetMinH)
  const h = Math.max(payload.layout.h, minH)

  workspace.addWidget(targetTabId, nextWidget, {
    i: nextWidget.id,
    x: 0,
    y: Infinity,
    w: payload.layout.w,
    h,
    minW: payload.layout.minW ?? 3,
    minH,
  })

  useWindowStore.getState().setPopoutMode(nextWidget.id)
}

function applyDockedWidgetPayload(rawPayload: unknown) {
  if (isWidgetPopoutWindow()) return

  const payloadSource = rawPayload && typeof rawPayload === 'object' && 'transferWidget' in (rawPayload as Record<string, unknown>)
    ? (rawPayload as { transferWidget?: unknown }).transferWidget
    : rawPayload

  const payload = coerceWidgetTransferPayload(payloadSource)
  if (!payload) return

  const dockGrid = rawPayload && typeof rawPayload === 'object' && 'dockGrid' in (rawPayload as Record<string, unknown>)
    ? (rawPayload as { dockGrid?: { x?: number; y?: number } }).dockGrid
    : undefined

  const dockX = typeof dockGrid?.x === 'number' && Number.isFinite(dockGrid.x)
    ? Math.max(0, Math.round(dockGrid.x))
    : 0
  const dockY = typeof dockGrid?.y === 'number' && Number.isFinite(dockGrid.y)
    ? Math.max(0, Math.round(dockGrid.y))
    : Infinity

  const workspace = useWorkspaceStore.getState()
  const targetTabId = workspace.activeTabId || workspace.tabs[0]?.id
  if (!targetTabId) return

  const widgetSettings = { ...(payload.widget.settings ?? {}) }
  if ('poppedOut' in widgetSettings) {
    delete widgetSettings.poppedOut
  }

  const nextWidget = {
    ...payload.widget,
    settings: widgetSettings,
  }

  const widgetMinH = getMinHeightForWidget(nextWidget.type)
  const minH = Math.max(payload.layout.minH ?? 2, widgetMinH)
  const h = Math.max(payload.layout.h, minH)

  const existingTab = workspace.tabs.find((tab) => tab.widgets[nextWidget.id])
  if (existingTab) {
    workspace.removeWidget(existingTab.id, nextWidget.id)
  }

  workspace.addWidget(targetTabId, nextWidget, {
    i: nextWidget.id,
    x: dockX,
    y: dockY,
    w: payload.layout.w,
    h,
    minW: payload.layout.minW ?? 3,
    minH,
  })

  workspace.setActiveTab(targetTabId)
  useWindowStore.getState().clearPopoutMode()
}

// Cross-window sync via BroadcastChannel + Electron bootstrap transfer events
function BroadcastSync() {
  useEffect(() => {
    const channel = createPitwallChannel()
    if (!channel) return

    let applyingRemoteState = false

    const postState = (scope: 'session' | 'ambient' | 'workspace' | 'driver', payload: unknown) => {
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

    const unsubscribeWorkspace = useWorkspaceStore.subscribe((state) => {
      if (applyingRemoteState) return
      postState('workspace', { tabs: state.tabs, activeTabId: state.activeTabId })
    })

    const unsubscribeBootstrap = window.electronAPI?.onWindowBootstrapWidget?.((rawPayload) => {
      applyBootstrapWidgetPayload(rawPayload)
    })

    const unsubscribeDock = window.electronAPI?.onDockWidgetIntoWorkspace?.((rawPayload) => {
      applyDockedWidgetPayload(rawPayload)
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
        if (message.scope === 'workspace' && message.payload && typeof message.payload === 'object') {
          useWorkspaceStore.setState((s) => ({ ...s, ...(message.payload as { tabs?: unknown; activeTabId?: unknown }) }))
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
      unsubscribeWorkspace()
      if (typeof unsubscribeBootstrap === 'function') unsubscribeBootstrap()
      if (typeof unsubscribeDock === 'function') unsubscribeDock()
      channel.close()
    }
  }, [])

  return null
}


function PopoutLayout() {
  const popoutWidgetId = useWindowStore((s) => s.popoutWidgetId)
  const tabs = useWorkspaceStore((s) => s.tabs)

  const tab = tabs.find((t) => popoutWidgetId && t.widgets[popoutWidgetId])
  const widget = popoutWidgetId && tab ? tab.widgets[popoutWidgetId] : undefined
  const WidgetComponent = widget ? WIDGET_REGISTRY[widget.type] : undefined

  useEffect(() => {
    if (!popoutWidgetId || widget) return
    void window.electronAPI?.closeCurrentWindow?.()
  }, [popoutWidgetId, widget])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
      padding: 0,
    }} className="animated-fade">
      <AmbientRaceLayer />
      <div style={{ flex: 1, padding: 0 }}>
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

function MainLayout({ hideCanvasWidgetAdd, demoMode = false }: { hideCanvasWidgetAdd: boolean; demoMode?: boolean }) {
  const TOP_CHROME_STACK_HEIGHT = 102
  const TOP_CHROME_TRANSITION_Y = 54
  const TOP_CHROME_TAIL_FADE_PX = 60
  const TEXT_SCRIM_TOOLBAR = 0.22
  const TEXT_SCRIM_FOCUS = 0.16
  const TEXT_SCRIM_TABS = 0.12
  const TOP_CHROME_TEXT_SHADOW = '0 1px 1px rgba(0,0,0,0.48), 0 0 6px rgba(0,0,0,0.26)'

  const { tabs, activeTabId } = useWorkspaceStore()
  const { setMode, activeSession } = useSessionStore()
  const nextRaceYear = activeSession?.year ?? new Date().getFullYear()
  const { session: nextRaceSession } = useNextRace(nextRaceYear)
  const toasts = useAmbientStore((s) => s.toasts)
  const flagState = useAmbientStore((s) => s.flagState)
  const leaderColorMode = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const getDriver = useDriverStore((s) => s.getDriver)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [standingsOpen, setStandingsOpen] = useState(false)
  const [showLiveModePrompt, setShowLiveModePrompt] = useState(false)
  const [promptPresent, setPromptPresent] = useState(false)
  const [promptClosing, setPromptClosing] = useState(false)
  const promptCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Enable fake telemetry when entering demo mode; disable on unmount
  useEffect(() => {
    if (!demoMode) return
    useFakeTelemetryStore.getState().enable()
    return () => {
      useFakeTelemetryStore.getState().disable()
    }
  }, [demoMode])

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true)
    const toggleLogPanel = () => setLogOpen((v) => !v)
    const triggerLiveModePrompt = () => setShowLiveModePrompt(true)

    window.addEventListener('pitwall-open-settings', openSettings)
    window.addEventListener('pitwall-toggle-log-panel', toggleLogPanel)
    window.addEventListener('pitwall-trigger-live-mode-prompt', triggerLiveModePrompt)

    return () => {
      window.removeEventListener('pitwall-open-settings', openSettings)
      window.removeEventListener('pitwall-toggle-log-panel', toggleLogPanel)
      window.removeEventListener('pitwall-trigger-live-mode-prompt', triggerLiveModePrompt)
    }
  }, [])

  // Drive banner presence/exit animation from showLiveModePrompt
  useEffect(() => {
    if (showLiveModePrompt) {
      if (promptCloseTimerRef.current) clearTimeout(promptCloseTimerRef.current)
      setPromptPresent(true)
      setPromptClosing(false)
    } else if (promptPresent) {
      setPromptClosing(true)
      promptCloseTimerRef.current = setTimeout(() => {
        setPromptPresent(false)
        setPromptClosing(false)
      }, 240)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLiveModePrompt])

  return (
    <div className="animated-fade" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Full-screen ambient race layer — sits behind all UI */}
      <AmbientRaceLayer />

      <div style={{ position: 'relative', flexShrink: 0, height: 102, overflow: 'hidden', zIndex: 4 }}>
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
              alignItems: 'center',
              gap: 6,
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--cond)', fontSize: 15, fontWeight: 800,
                letterSpacing: '0.04em', color: 'var(--white)',
                textTransform: 'uppercase', lineHeight: 1,
              }}>
                {nextRaceSession?.circuit_short_name ?? nextRaceSession?.country_name ?? 'Live'}
              </span>
              {nextRaceSession?.session_name && (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--muted2)',
                }}>
                  {nextRaceSession.session_name}
                </span>
              )}
            </div>
            
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
          

          {/* Back to season hub */}
          <button
            onClick={() => {
              if (demoMode) useFakeTelemetryStore.getState().disable()
              setMode('hub')
            }}
            title="Back to season overview"
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
            Season
          </button>

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

      {/* Demo mode banner */}
      {demoMode && (
        <div style={{
          background: 'rgba(255,180,0,0.06)',
          borderBottom: '0.5px solid rgba(255,180,0,0.2)',
          padding: '5px 14px',
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(255,180,0,0.6)',
          textAlign: 'center', flexShrink: 0,
        }}>
          Demo mode — telemetry widgets show simulated data
        </div>
      )}

      {/* Live mode prompt banner */}
      {promptPresent && (
        <div
          className={promptClosing ? 'live-banner-exit' : 'live-banner'}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'rgba(232,19,43,0.09)',
            borderBottom: '0.5px solid rgba(232,19,43,0.28)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingInline: 14,
            height: 42,
          }}
        >
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--red)',
            flexShrink: 0,
            animation: 'liveDotPulse 1.2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(232,19,43,0.85)',
            flex: 1,
          }}>
            Race is live{nextRaceSession?.circuit_short_name ? ` · ${nextRaceSession.circuit_short_name}` : ''}
          </span>
          <button
            onClick={() => { setMode('live'); setShowLiveModePrompt(false) }}
            className="interactive-button"
            style={{
              background: 'rgba(232,19,43,0.12)',
              border: '0.5px solid rgba(232,19,43,0.4)',
              borderRadius: 3,
              padding: '3px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(232,19,43,0.9)',
              cursor: 'pointer',
            }}
          >
            Go Live
          </button>
          <button
            onClick={() => setShowLiveModePrompt(false)}
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
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Main canvas */}
      {activeTab && <Canvas tabId={activeTab.id} hideAddWidget={hideCanvasWidgetAdd} />}

      {/* Diagnostic log panel */}
      <DiagnosticLog open={logOpen} onClose={() => setLogOpen(false)} />

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Season standings */}
      {standingsOpen && <SeasonStandingsModal onClose={() => setStandingsOpen(false)} />}

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
  const isWidgetPopoutShell = isWidgetPopoutWindow()
  const hydrated = usePersistHydrationReady()
  const [startupProgress, setStartupProgress] = useState<StartupProgressState>(makeEmptyStartupProgress)
  const [loadingPreviewActive, setLoadingPreviewActive] = useState(false)
  const [loadingPreviewProgress, setLoadingPreviewProgress] = useState<StartupProgressState>(makeEmptyStartupProgress)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)

  useSmoothScroll()

  useEffect(() => {
    if (mode === 'onboarding') {
      setStartupProgress({ workspaceReady: true, sessionReady: true, driversReady: true, standingsReady: true, calendarReady: true })
      return
    }

    // Skip the reset when data is already ready — this is a live/historical toggle,
    // not initial startup. DataLayer's progress effect will correct downward if data
    // genuinely isn't available (e.g., onboarding → live transition).
    setStartupProgress((prev) => {
      if (prev.sessionReady && prev.driversReady) return prev
      return { ...prev, sessionReady: false, driversReady: false, standingsReady: false, calendarReady: false }
    })
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
      setLoadingPreviewProgress({ workspaceReady: true, sessionReady: true, driversReady: true, standingsReady: true, calendarReady: true })
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
    standingsReady: startupProgress.standingsReady,
    calendarReady: startupProgress.calendarReady,
  }
  const startupDataReady = mergedProgress.workspaceReady && mergedProgress.sessionReady && mergedProgress.driversReady && mergedProgress.standingsReady && mergedProgress.calendarReady
  const shouldBlockStartup = mode !== 'onboarding' && mode !== 'demo' && !startupDataReady
  const showStartupSplash = useStartupSplashVisibility(shouldBlockStartup)
  const effectiveOverlayProgress = loadingPreviewActive ? loadingPreviewProgress : mergedProgress
  const shouldShowLoadingOverlay = !isWidgetPopoutShell && (loadingPreviewActive || showStartupSplash)
  const renderPopoutLayout = isWidgetPopoutShell || windowMode === 'popout'

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
      {renderPopoutLayout ? (
        <>
          <PopoutLayout />
        </>
      ) : mode === 'onboarding' ? (
        <ApiKeyOnboarding />
      ) : mode === 'hub' ? (
        <>
          <DataLayer onStartupProgressChange={setStartupProgress} />
          <SeasonHub />
        </>
      ) : mode === 'demo' ? (
        <>
          <DataLayer onStartupProgressChange={setStartupProgress} />
          <MainLayout hideCanvasWidgetAdd={false} demoMode />
        </>
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
