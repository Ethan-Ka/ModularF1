import { type ComponentType, useEffect, useMemo, useState } from 'react'
import { AmbientRaceLayer } from './components/AmbientRaceLayer/AmbientRaceLayer'
import { WidgetHost } from './components/WidgetHost/WidgetHost'
import { useAmbientStore } from './store/ambientStore'
import { useDriverStore } from './store/driverStore'
import { useFocusEditorStore } from './store/focusEditorStore'
import { useSessionStore } from './store/sessionStore'
import { useWindowStore } from './store/windowStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { createPitwallChannel, WINDOW_CLIENT_ID } from './lib/windowSync'
import { coerceWidgetTransferPayload } from './lib/widgetTransfer'
import { resolveLazyWidget } from './widgets/lazyRegistry'
import { getMinHeightForWidget } from './widgets/registry'

function isWidgetPopoutWindow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('windowKind') === 'widget-popout'
  } catch {
    return false
  }
}

function getWidgetTypeHintFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const widgetType = params.get('widgetType')
    return widgetType && widgetType.trim().length > 0 ? widgetType : null
  } catch {
    return null
  }
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
    windowFocusSelector: state.windowFocusSelector,
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

  // Start loading the widget module immediately to reduce blank popout time.
  void resolveLazyWidget(nextWidget.type)

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

function PopoutSync() {
  useEffect(() => {
    const unsubscribeReset = window.electronAPI?.onWindowResetPopoutState?.(() => {
      const workspace = useWorkspaceStore.getState()
      const targetTabId = workspace.activeTabId || workspace.tabs[0]?.id
      if (targetTabId) {
        useWorkspaceStore.setState((s) => ({
          ...s,
          tabs: s.tabs.map((tab) =>
            tab.id === targetTabId
              ? { ...tab, name: 'Pop-out', layout: [], widgets: {} }
              : tab
          ),
          activeTabId: targetTabId,
        }))
      }

      useWindowStore.getState().clearPopoutMode()
    })

    return () => {
      if (typeof unsubscribeReset === 'function') unsubscribeReset()
    }
  }, [])

  useEffect(() => {
    const widgetTypeHint = getWidgetTypeHintFromUrl()
    if (!widgetTypeHint) return
    void resolveLazyWidget(widgetTypeHint)
  }, [])

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

    const unsubscribeFocusEditor = useFocusEditorStore.subscribe((state, prevState) => {
      if (applyingRemoteState) return
      const { editingWidgetId } = state
      if (!editingWidgetId || editingWidgetId === prevState.editingWidgetId) return

      const workspace = useWorkspaceStore.getState()
      let widgetTabId: string | undefined
      let driverContext: import('./store/workspaceStore').DriverContext | undefined
      for (const tab of workspace.tabs) {
        const widget = tab.widgets[editingWidgetId]
        if (widget) {
          widgetTabId = tab.id
          driverContext = widget.driverContext
          break
        }
      }
      if (!widgetTabId || driverContext === undefined) return

      channel.postMessage({
        kind: 'popout-widget-focus-request',
        origin: WINDOW_CLIENT_ID,
        widgetId: editingWidgetId,
        tabId: widgetTabId,
        driverContext,
      })
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

      if (message.kind === 'popout-widget-context-update') {
        const workspace = useWorkspaceStore.getState()
        for (const tab of workspace.tabs) {
          if (tab.widgets[message.widgetId]) {
            workspace.updateWidgetConfig(tab.id, message.widgetId, { driverContext: message.driverContext })
            break
          }
        }
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
      unsubscribeFocusEditor()
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
  const [WidgetComponent, setWidgetComponent] = useState<ComponentType<{ widgetId: string }> | null>(null)
  const [isResolvingWidget, setIsResolvingWidget] = useState(false)

  const tab = tabs.find((t) => popoutWidgetId && t.widgets[popoutWidgetId])
  const widget = popoutWidgetId && tab ? tab.widgets[popoutWidgetId] : undefined

  useEffect(() => {
    let active = true

    if (!widget) {
      setWidgetComponent(null)
      setIsResolvingWidget(false)
      return () => {
        active = false
      }
    }

    setIsResolvingWidget(true)
    void resolveLazyWidget(widget.type).then((resolved) => {
      if (!active) return
      setWidgetComponent(() => resolved ?? null)
      setIsResolvingWidget(false)
    })

    return () => {
      active = false
    }
  }, [widget?.id, widget?.type])

  useEffect(() => {
    if (!popoutWidgetId || widget) return
    void window.electronAPI?.closeCurrentWindow?.()
  }, [popoutWidgetId, widget])

  const statusLabel = useMemo(() => {
    if (isResolvingWidget) return 'Loading widget...'
    return 'Pop-out widget unavailable'
  }, [isResolvingWidget])

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
            {statusLabel}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PopoutApp() {
  return (
    <>
      <PopoutSync />
      <PopoutLayout />
    </>
  )
}