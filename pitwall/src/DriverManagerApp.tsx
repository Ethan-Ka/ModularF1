import { useEffect } from 'react'
import { useAmbientStore } from './store/ambientStore'
import { useDriverStore } from './store/driverStore'
import { useSessionStore } from './store/sessionStore'
import { createPitwallChannel, WINDOW_CLIENT_ID } from './lib/windowSync'
import { DriverManagerPanel } from './components/DriverManager/DriverManagerPanel'

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
  return { starred: state.starred, canvasFocus: state.canvasFocus }
}

function PanelSync() {
  useEffect(() => {
    const channel = createPitwallChannel()
    if (!channel) return

    let applyingRemoteState = false

    const post = (scope: 'session' | 'ambient' | 'driver', payload: unknown) => {
      channel.postMessage({ kind: 'state-sync', origin: WINDOW_CLIENT_ID, scope, payload })
    }

    const unsubSession = useSessionStore.subscribe((state) => {
      if (applyingRemoteState) return
      post('session', pickSessionSyncState(state))
    })

    const unsubAmbient = useAmbientStore.subscribe((state) => {
      if (applyingRemoteState) return
      post('ambient', pickAmbientSyncState(state))
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
        if (msg.scope === 'session' && msg.payload && typeof msg.payload === 'object') {
          useSessionStore.setState((s) => ({ ...s, ...(msg.payload as object) }))
        }
        if (msg.scope === 'ambient' && msg.payload && typeof msg.payload === 'object') {
          useAmbientStore.setState((s) => ({ ...s, ...(msg.payload as object) }))
        }
        if (msg.scope === 'driver' && msg.payload && typeof msg.payload === 'object') {
          useDriverStore.setState((s) => ({ ...s, ...(msg.payload as object) }))
        }
      } finally {
        applyingRemoteState = false
      }
    }

    post('session', pickSessionSyncState(useSessionStore.getState()))
    post('ambient', pickAmbientSyncState(useAmbientStore.getState()))
    post('driver', pickDriverSyncState(useDriverStore.getState()))

    return () => {
      unsubSession()
      unsubAmbient()
      unsubDriver()
      channel.close()
    }
  }, [])

  return null
}

export default function DriverManagerApp() {
  return (
    <>
      <PanelSync />
      <DriverManagerPanel onClose={() => { void window.electronAPI?.closeCurrentWindow() }} />
    </>
  )
}
