import { useCallback, useEffect, useRef, useState } from 'react'
import { GridLayout, noCompactor } from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import { useWorkspaceStore } from '../../store/workspaceStore'
import type { WidgetConfig } from '../../store/workspaceStore'
import { useDraggingStore } from '../../store/draggingStore'
import { WidgetHost } from '../WidgetHost/WidgetHost'
import { WidgetPicker } from '../WidgetPicker/WidgetPicker'
import {
  deserializeWidgetTransferPayload,
  type WidgetTransferPayload,
  WIDGET_TRANSFER_MIME,
} from '../../lib/widgetTransfer'
import { createPitwallChannel, WINDOW_CLIENT_ID } from '../../lib/windowSync'
import { WIDGET_DEFAULTS, WIDGET_REGISTRY, getMinHeightForWidget } from '../../widgets/registry'


interface CanvasProps {
  tabId: string
  hideAddWidget?: boolean
}

interface ExternalDockPreview {
  x: number
  y: number
  w: number
  h: number
}

const GRID_COLS = 24
const GRID_ROW_HEIGHT = 40
const GRID_MARGIN_X = 4
const GRID_MARGIN_Y = 4

export function Canvas({ tabId, hideAddWidget = false }: CanvasProps) {
  const tabs = useWorkspaceStore((s) => s.tabs)
  const updateLayout = useWorkspaceStore((s) => s.updateLayout)
  const addWidget = useWorkspaceStore((s) => s.addWidget)
  const draggingType = useDraggingStore((s) => s.draggingType)
  const setDraggingType = useDraggingStore((s) => s.setDraggingType)

  const tab = tabs.find((t) => t.id === tabId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  // Container width for GridLayout
  const [containerWidth, setContainerWidth] = useState(1200)
  const containerElRef = useRef<HTMLDivElement | null>(null)
  const draggingWidgetIdRef = useRef<string | null>(null)
  const [externalDockPreview, setExternalDockPreview] = useState<ExternalDockPreview | null>(null)
  const [pickerDragHover, setPickerDragHover] = useState(false)

  useEffect(() => {
    if (hideAddWidget && pickerOpen) {
      setPickerOpen(false)
    }
  }, [hideAddWidget, pickerOpen])

  useEffect(() => {
    const node = containerElRef.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const [{ contentRect } = { contentRect: undefined as DOMRectReadOnly | undefined }] = entries
      const width = contentRect?.width
      if (width) setContainerWidth(width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onPickerDragHover = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean }>
      setPickerDragHover(Boolean(customEvent.detail?.active))
    }
    window.addEventListener('pitwall:picker-drag-hover', onPickerDragHover)
    return () => {
      window.removeEventListener('pitwall:picker-drag-hover', onPickerDragHover)
    }
  }, [])

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerElRef.current = node
  }, [])

  // Keep a ref to tabId so the debounced callback always sees the current tab,
  // even if the user switches tabs within the 3s debounce window.
  const tabIdRef = useRef(tabId)
  useEffect(() => { tabIdRef.current = tabId }, [tabId])

  // Apply layout migrations for legacy persisted widget sizes.
  useEffect(() => {
    if (!tab) return
    let changed = false
    const nextLayout = tab.layout.map((item) => {
      const widget = tab.widgets[item.i]
      if (!widget) return item

      // Legacy fix: RunningOrderStrip was previously placed at h=4, minH=3
      if (widget.type === 'RunningOrderStrip' && item.h === 4 && item.minH === 3) {
        changed = true
        return { ...item, h: 2, minH: 1 }
      }

      const minHeight = getMinHeightForWidget(widget.type)
      if ((item.minH ?? 0) < minHeight || item.h < minHeight) {
        changed = true
        return {
          ...item,
          minH: Math.max(item.minH ?? 0, minHeight),
          h: Math.max(item.h, minHeight),
        }
      }

      return item
    })
    if (changed) {
      updateLayout(tabId, nextLayout)
    }
  }, [tab, tabId, updateLayout])

  function handleLayoutChange(layout: Layout) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateLayout(tabIdRef.current, [...layout])
    }, 300)
  }

  function buildTransferPayloadFromWidget(widgetId: string): WidgetTransferPayload | null {
    const currentTab = useWorkspaceStore.getState().tabs.find((t) => t.id === tabIdRef.current)
    if (!currentTab) return null
    const widget = currentTab.widgets[widgetId]
    const layout = currentTab.layout.find((l) => l.i === widgetId)
    if (!widget || !layout) return null

    return {
      version: 1,
      sourceClientId: WINDOW_CLIENT_ID,
      sourceTabId: tabIdRef.current,
      widget,
      layout: {
        w: layout.w,
        h: layout.h,
        minW: layout.minW,
        minH: layout.minH,
      },
    }
  }

  async function popOutWidgetFromCurrentWindow(widgetId: string) {
    if (!window.electronAPI) return
    const payload = buildTransferPayloadFromWidget(widgetId)
    if (!payload) return
    const widgetElement = document.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]`)
    const widgetRect = widgetElement?.getBoundingClientRect()
    const popoutBounds = widgetRect
      ? {
          x: Math.round(window.screenX + widgetRect.left),
          y: Math.round(window.screenY + widgetRect.top),
          width: Math.max(280, Math.round(widgetRect.width)),
          height: Math.max(180, Math.round(widgetRect.height)),
        }
      : undefined
    try {
      await window.electronAPI.openNewWindow({
        transferWidget: payload,
        windowKind: 'widget-popout',
        popoutBounds,
      })
      useWorkspaceStore.getState().removeWidget(tabIdRef.current, widgetId)
    } catch {
      // Keep the source widget in place if the new window fails to open.
    }
  }

  useEffect(() => {
    if (!window.electronAPI?.onFocusChange) return
    return window.electronAPI.onFocusChange((focused) => {
      if (focused) return
      const draggingWidgetId = draggingWidgetIdRef.current
      if (!draggingWidgetId) return
      draggingWidgetIdRef.current = null
      void popOutWidgetFromCurrentWindow(draggingWidgetId)
    })
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onPopoutDockPreview) return

    return window.electronAPI.onPopoutDockPreview((rawPayload) => {
      const payload = rawPayload as {
        visible?: boolean
        centerX?: number
        centerY?: number
        layout?: { w?: number; h?: number }
      } | null

      if (!payload?.visible) {
        setExternalDockPreview(null)
        return
      }

      const node = containerElRef.current
      if (!node) {
        setExternalDockPreview(null)
        return
      }

      const centerX = typeof payload.centerX === 'number' ? payload.centerX : null
      const centerY = typeof payload.centerY === 'number' ? payload.centerY : null
      if (centerX == null || centerY == null) {
        setExternalDockPreview(null)
        return
      }

      const rect = node.getBoundingClientRect()
      const clientX = centerX - window.screenX
      const clientY = centerY - window.screenY
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setExternalDockPreview(null)
        return
      }

      const w = Math.max(1, Math.min(GRID_COLS, Math.round(payload.layout?.w ?? 6)))
      const h = Math.max(1, Math.round(payload.layout?.h ?? 6))
      const columnWidth = (containerWidth - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS
      if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
        setExternalDockPreview(null)
        return
      }

      const itemWidthPx = w * columnWidth + (w - 1) * GRID_MARGIN_X
      const itemHeightPx = h * GRID_ROW_HEIGHT + (h - 1) * GRID_MARGIN_Y
      const localX = clientX - rect.left
      const localY = clientY - rect.top + node.scrollTop
      const stepX = columnWidth + GRID_MARGIN_X
      const stepY = GRID_ROW_HEIGHT + GRID_MARGIN_Y

      const snappedX = Math.max(0, Math.min(GRID_COLS - w, Math.round((localX - itemWidthPx / 2) / stepX)))
      const snappedY = Math.max(0, Math.round((localY - itemHeightPx / 2) / stepY))
      setExternalDockPreview({ x: snappedX, y: snappedY, w, h })
    })
  }, [containerWidth])

  function handleAddWidget(type: string) {
    const defaults = WIDGET_DEFAULTS[type] ?? { w: 6, h: 6 }
    const minH = getMinHeightForWidget(type)
    const id = crypto.randomUUID()
    const widget: WidgetConfig = {
      id,
      type,
      driverContext: 'FOCUS',
    }
    const layoutItem: LayoutItem = {
      i: id,
      x: 0,
      y: Infinity, // places at bottom
      w: defaults.w,
      h: Math.max(defaults.h, minH),
      minW: 3,
      minH,
    }
    addWidget(tabId, widget, layoutItem)
  }

  function getDraggedWidgetType(e: DragEvent): string | null {
    if (draggingType) return draggingType
    const rawType = e.dataTransfer?.getData('text/plain')?.trim()
    if (!rawType) return null
    if (!WIDGET_DEFAULTS[rawType]) return null
    return rawType
  }

  function canAcceptWidgetDrag(dt: DataTransfer | null): boolean {
    if (draggingType) return true
    if (!dt) return false
    if (dt.types?.includes(WIDGET_TRANSFER_MIME)) return true
    const rawType = dt.getData('text/plain')?.trim()
    return Boolean(rawType && WIDGET_DEFAULTS[rawType])
  }

  if (!tab) return null

  const widgetEntries = Object.values(tab.widgets)

  return (
    <div
      ref={containerRef}
      data-canvas-dropzone="true"
      className="animated-fade"
      onDragOver={(e) => {
        if (pickerDragHover) return
        if (!canAcceptWidgetDrag(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        if (pickerDragHover) return
        if (!canAcceptWidgetDrag(e.dataTransfer)) return
        // Prevent browser default drop handling (e.g. opening dropped text).
        e.preventDefault()
      }}
      style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
        zIndex: 2,
        isolation: 'isolate',
        background: 'var(--bg)',
        border: draggingType ? '1.5px dashed rgba(232,19,43,0.3)' : 'none',
      }}
    >
      {/* Empty state */}
      {widgetEntries.length === 0 && !hideAddWidget && (
        <div style={{
          animation: 'fadeInUp var(--motion-slow) var(--motion-out) both',
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: 'var(--cond)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--muted2)',
            letterSpacing: '0.06em',
          }}>
            Drop a widget here
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Use the Add widget button to get started
          </div>
        </div>
      )}

      <GridLayout
        layout={tab.layout as Layout}
        style={{ minHeight: '100%' }}
        gridConfig={{
          cols: GRID_COLS,
          rowHeight: GRID_ROW_HEIGHT,
          margin: [GRID_MARGIN_X, GRID_MARGIN_Y] as [number, number],
          compactType: null,
          preventCollision: false,
        }}
        dragConfig={{ handle: '.widget-drag-handle' }}
        resizeConfig={{ handles: ['se'] }}
        dropConfig={{
          enabled: !pickerDragHover,
          onDragOver: (e: DragEvent) => {
            if (pickerDragHover) return false
            const transferRaw = e.dataTransfer?.getData(WIDGET_TRANSFER_MIME)
            const transferPayload = deserializeWidgetTransferPayload(transferRaw ?? '')
            if (transferPayload) {
              const minH = transferPayload.layout.minH ?? getMinHeightForWidget(transferPayload.widget.type)
              return {
                w: transferPayload.layout.w,
                h: Math.max(transferPayload.layout.h, minH),
              }
            }

            const activeType = getDraggedWidgetType(e)
            if (activeType) {
              const defaults = WIDGET_DEFAULTS[activeType] ?? { w: 6, h: 6 }
              const minH = getMinHeightForWidget(activeType)
              return { w: defaults.w, h: Math.max(defaults.h, minH) }
            }

            // Cross-window drags can hide payload data until drop; still show grid preview.
            if (e.dataTransfer?.types?.includes(WIDGET_TRANSFER_MIME)) {
              return { w: 6, h: 6 }
            }

            // Some drag contexts only expose text/plain while moving.
            if (e.dataTransfer?.types?.includes('text/plain')) {
              const rawType = e.dataTransfer.getData('text/plain')?.trim()
              if (!rawType || !WIDGET_DEFAULTS[rawType]) {
                return false
              }
              const defaults = WIDGET_DEFAULTS[rawType] ?? { w: 6, h: 6 }
              const minH = getMinHeightForWidget(rawType)
              return { w: defaults.w, h: Math.max(defaults.h, minH) }
            }

            return false
          },
        }}
        compactor={noCompactor}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        onDragStart={(_layout, _oldItem, item) => {
          draggingWidgetIdRef.current = item?.i ?? null
        }}
        onDragStop={() => {
          draggingWidgetIdRef.current = null
        }}
        onDrop={(_layout, item, e) => {
          if (!item) return

          const transferRaw = e.dataTransfer?.getData(WIDGET_TRANSFER_MIME) ?? ''
          const transferPayload = deserializeWidgetTransferPayload(transferRaw)
          if (transferPayload) {
            const transferSettings = { ...(transferPayload.widget.settings ?? {}) }
            if ('poppedOut' in transferSettings) {
              delete transferSettings.poppedOut
            }

            const widget: WidgetConfig = {
              ...transferPayload.widget,
              settings: transferSettings,
            }

            const minW = transferPayload.layout.minW ?? 3
            const minH = transferPayload.layout.minH ?? getMinHeightForWidget(widget.type)

            const layoutItem: LayoutItem = {
              i: widget.id,
              x: item.x,
              y: item.y,
              w: transferPayload.layout.w,
              h: Math.max(transferPayload.layout.h, minH),
              minW,
              minH,
            }

            if (transferPayload.sourceClientId === WINDOW_CLIENT_ID) {
              const sourceStore = useWorkspaceStore.getState()
              sourceStore.removeWidget(transferPayload.sourceTabId, transferPayload.widget.id)
            }

            addWidget(tabIdRef.current, widget, layoutItem)

            const channel = createPitwallChannel()
            if (channel) {
              channel.postMessage({
                kind: 'widget-transfer-remove-source',
                origin: WINDOW_CLIENT_ID,
                sourceClientId: transferPayload.sourceClientId,
                sourceTabId: transferPayload.sourceTabId,
                widgetId: transferPayload.widget.id,
              })
              channel.close()
            }
            return
          }

          const type = getDraggedWidgetType(e)
          setDraggingType(null)
          if (!type) return

          const defaults = WIDGET_DEFAULTS[type] ?? { w: 6, h: 6 }
          const minH = getMinHeightForWidget(type)
          const id = crypto.randomUUID()
          const widget: WidgetConfig = { id, type, driverContext: 'FOCUS' }
          const layoutItem: LayoutItem = {
            i: id,
            x: item.x,
            y: item.y,
            w: defaults.w,
            h: Math.max(defaults.h, minH),
            minW: 3,
            minH,
          }
          addWidget(tabIdRef.current, widget, layoutItem)
        }}
      >
        {widgetEntries.map((widget) => {
          const WidgetComponent = WIDGET_REGISTRY[widget.type]
          return (
            <div key={widget.id}>
              <WidgetHost widgetId={widget.id}>
                {WidgetComponent
                  ? <WidgetComponent widgetId={widget.id} />
                  : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted2)',
                    }}>
                      Unknown widget: {widget.type}
                    </div>
                  )
                }
              </WidgetHost>
            </div>
          )
        })}
      </GridLayout>

      {externalDockPreview && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: externalDockPreview.x * ((containerWidth - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS + GRID_MARGIN_X),
            top: externalDockPreview.y * (GRID_ROW_HEIGHT + GRID_MARGIN_Y) - (containerElRef.current?.scrollTop ?? 0),
            width: externalDockPreview.w * ((containerWidth - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS) + (externalDockPreview.w - 1) * GRID_MARGIN_X,
            height: externalDockPreview.h * GRID_ROW_HEIGHT + (externalDockPreview.h - 1) * GRID_MARGIN_Y,
            border: '1.5px dashed rgba(29,184,106,0.65)',
            background: 'rgba(29,184,106,0.12)',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 250,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
          }}
        />
      )}

      {/* Add widget button */}
      {!hideAddWidget && (
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="Add widget"
          className="interactive-button floating-pulse"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 320,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--red)',
            border: 'none',
            color: '#ffffff',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          +
        </button>
      )}

      {/* Widget picker panel */}
      {pickerOpen && !hideAddWidget && (
        <WidgetPicker onClose={() => setPickerOpen(false)} onAdd={handleAddWidget} />
      )}
    </div>
  )
}
