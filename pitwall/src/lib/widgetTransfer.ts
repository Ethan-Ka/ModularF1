import type { LayoutItem } from 'react-grid-layout'
import type { WidgetConfig } from '../store/workspaceStore'

export const WIDGET_TRANSFER_MIME = 'application/x-pitwall-widget'

export interface WidgetTransferPayload {
  version: 1
  sourceClientId: string
  sourceTabId: string
  widget: WidgetConfig
  layout: Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>
}

export function serializeWidgetTransferPayload(payload: WidgetTransferPayload): string {
  return JSON.stringify(payload)
}

export function deserializeWidgetTransferPayload(raw: string): WidgetTransferPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetTransferPayload>
    if (parsed.version !== 1) return null
    if (!parsed.sourceClientId || !parsed.sourceTabId) return null
    if (!parsed.widget || !parsed.widget.id || !parsed.widget.type || !parsed.widget.driverContext) return null
    if (!parsed.layout || typeof parsed.layout.w !== 'number' || typeof parsed.layout.h !== 'number') return null

    return {
      version: 1,
      sourceClientId: parsed.sourceClientId,
      sourceTabId: parsed.sourceTabId,
      widget: parsed.widget,
      layout: {
        w: parsed.layout.w,
        h: parsed.layout.h,
        minW: parsed.layout.minW,
        minH: parsed.layout.minH,
      },
    }
  } catch {
    return null
  }
}

export function coerceWidgetTransferPayload(raw: unknown): WidgetTransferPayload | null {
  if (typeof raw === 'string') return deserializeWidgetTransferPayload(raw)
  if (!raw || typeof raw !== 'object') return null
  try {
    return deserializeWidgetTransferPayload(JSON.stringify(raw))
  } catch {
    return null
  }
}
