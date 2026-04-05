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

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerElRef.current = node
  }, [])

  // Keep a ref to tabId so the debounced callback always sees the current tab,
  // even if the user switches tabs within the 3s debounce window.
  const tabIdRef = useRef(tabId)
  useEffect(() => { tabIdRef.current = tabId }, [tabId])

  // Migrate old RunningOrderStrip widgets from legacy default size (h=4/minH=3)
  // to compact defaults without overriding manual custom sizing.
  useEffect(() => {
    if (!tab) return
    let changed = false
    const nextLayout = tab.layout.map((item) => {
      const widget = tab.widgets[item.i]
      if (
        widget?.type === 'RunningOrderStrip'
        && item.h === 4
        && item.minH === 3
      ) {
        changed = true
        return { ...item, h: 2, minH: 1 }
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
    try {
      await window.electronAPI.openNewWindow({ transferWidget: payload })
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

  function handleAddWidget(type: string) {
    const defaults = WIDGET_DEFAULTS[type] ?? { w: 6, h: 6 }
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
      h: defaults.h,
      minW: 3,
      minH: getMinHeightForWidget(type),
    }
    addWidget(tabId, widget, layoutItem)
  }

  if (!tab) return null

  const widgetEntries = Object.values(tab.widgets)

  return (
    <div
      ref={containerRef}
      className="animated-fade"
      style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
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
        gridConfig={{ cols: 24, rowHeight: 40, margin: [4, 4] as [number, number] }}
        dragConfig={{ handle: '.widget-drag-handle' }}
        resizeConfig={{ handles: ['se'] }}
        dropConfig={{
          enabled: true,
          onDragOver: (e: DragEvent) => {
            const transferRaw = e.dataTransfer?.getData(WIDGET_TRANSFER_MIME)
            const transferPayload = deserializeWidgetTransferPayload(transferRaw ?? '')
            if (transferPayload) {
              return {
                w: transferPayload.layout.w,
                h: transferPayload.layout.h,
              }
            }

            if (!draggingType) return false
            const defaults = WIDGET_DEFAULTS[draggingType] ?? { w: 6, h: 6 }
            return { w: defaults.w, h: defaults.h }
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
            const widget: WidgetConfig = {
              ...transferPayload.widget,
              settings: {
                ...(transferPayload.widget.settings ?? {}),
              },
            }

            const minW = transferPayload.layout.minW ?? 3
            const minH = transferPayload.layout.minH ?? getMinHeightForWidget(widget.type)

            const layoutItem: LayoutItem = {
              i: widget.id,
              x: item.x,
              y: item.y,
              w: transferPayload.layout.w,
              h: transferPayload.layout.h,
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

          const type = draggingType
          setDraggingType(null)
          if (!type) return

          const defaults = WIDGET_DEFAULTS[type] ?? { w: 6, h: 6 }
          const id = crypto.randomUUID()
          const widget: WidgetConfig = { id, type, driverContext: 'FOCUS' }
          const layoutItem: LayoutItem = {
            i: id,
            x: item.x,
            y: item.y,
            w: defaults.w,
            h: defaults.h,
            minW: 3,
            minH: getMinHeightForWidget(type),
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
