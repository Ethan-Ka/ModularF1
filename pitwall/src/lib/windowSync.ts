export const PITWALL_CHANNEL_NAME = 'pitwall-sync-v2'

export const WINDOW_CLIENT_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export type WindowStateScope = 'session' | 'ambient' | 'workspace' | 'driver'

export interface WindowStateSyncMessage {
  kind: 'state-sync'
  origin: string
  scope: WindowStateScope
  payload: unknown
}

export interface WidgetTransferRemoveSourceMessage {
  kind: 'widget-transfer-remove-source'
  origin: string
  sourceClientId: string
  sourceTabId: string
  widgetId: string
}

export type PitwallChannelMessage = WindowStateSyncMessage | WidgetTransferRemoveSourceMessage

export function createPitwallChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(PITWALL_CHANNEL_NAME)
}
