import { useEffect } from 'react'
import { useDriverStore } from './store/driverStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { createPitwallChannel, WINDOW_CLIENT_ID } from './lib/windowSync'
import { WidgetSettingsPanel } from './components/WidgetSettings/WidgetSettingsPanel'

function pickWorkspaceSyncState(state: ReturnType<typeof useWorkspaceStore.getState>) {
  return { tabs: state.tabs, activeTabId: state.activeTabId }
}

function pickDriverSyncState(state: ReturnType<typeof useDriverStore.getState>) {
  return { starred: state.starred, canvasFocus: state.canvasFocus }
}

function PanelSync() {
  useEffect(() => {
    const channel = createPitwallChannel()
    if (!channel) return

    let applyingRemoteState = false

    const post = (scope: 'workspace' | 'driver', payload: unknown) => {
      channel.postMessage({ kind: 'state-sync', origin: WINDOW_CLIENT_ID, scope, payload })
    }

    const unsubWorkspace = useWorkspaceStore.subscribe((state) => {
      if (applyingRemoteState) return
      post('workspace', pickWorkspaceSyncState(state))
    })

    const unsubDriver = useDriverStore.subscribe((state) => {
      if (applyingRemoteState) return
      post('driver', pickDriverSyncState(state))
    })

    channel.onmessage = (event) => {
      const msg = event.data as { kind?: string; origin?: string; scope?: string; payload?: unknown }
      if (!msg || typeof msg !== 'object') return
      if (msg.origin === WINDOW_CLIENT_ID) return
      if (msg.kind !== 'state-sync') return

      applyingRemoteState = true
      try {
        if (msg.scope === 'workspace' && msg.payload && typeof msg.payload === 'object') {
          useWorkspaceStore.setState((s) => ({ ...s, ...(msg.payload as object) }))
        }
        if (msg.scope === 'driver' && msg.payload && typeof msg.payload === 'object') {
          useDriverStore.setState((s) => ({ ...s, ...(msg.payload as object) }))
        }
      } finally {
        applyingRemoteState = false
      }
    }

    return () => {
      unsubWorkspace()
      unsubDriver()
      channel.close()
    }
  }, [])

  return null
}

export default function WidgetSettingsApp() {
  const widgetId = new URLSearchParams(window.location.search).get('widgetId') ?? ''

  if (!widgetId) {
    return (
      <div style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 11, padding: 16 }}>
        No widget ID.
      </div>
    )
  }

  return (
    <>
      <PanelSync />
      <WidgetSettingsPanel widgetId={widgetId} onClose={() => { void window.electronAPI?.closeCurrentWindow() }} />
    </>
  )
}
