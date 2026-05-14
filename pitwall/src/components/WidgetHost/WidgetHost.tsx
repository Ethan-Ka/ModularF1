import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useShallow } from 'zustand/react/shallow'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { WIDGET_MANIFEST } from '../../widgets/manifest'
import Markdown from '../Markdown/Markdown'
import { WidgetSettingsPanel } from '../WidgetSettings/WidgetSettingsPanel'
import { useDriverStore } from '../../store/driverStore'
import { WidgetErrorBoundary } from '../ErrorBoundary/WidgetErrorBoundary'
import { useAmbientStore } from '../../store/ambientStore'
import { FLAG_COLORS } from '../AmbientBar/flagStateMachine'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { WINDOW_CLIENT_ID } from '../../lib/windowSync'
import { useFocusEditorStore } from '../../store/focusEditorStore'

// Maps driverContext type to a human-readable widget type label
function widgetTypeLabel(type: string): string {
  const map: Record<string, string> = {
    LapDeltaTower: 'Lap Delta',
    RunningOrderStrip: 'Running Order',
    RaceControlFeed: 'Race Control',
    WeatherDashboard: 'Weather',
    TyreIntelligence: 'Tyre Intel',
    FullTrackMap: 'Track Map',
    WeatherRadar: 'Weather Radar',
  }
  return map[type] ?? type
}

interface WidgetHostProps {
  widgetId: string
  children: React.ReactNode
}

export function WidgetHost({ widgetId, children }: WidgetHostProps) {
    function handleContextMenu(e: React.MouseEvent) {
      e.preventDefault()
      setContextMenuPos({ x: e.clientX, y: e.clientY })
    }

    function handleRemove() {
      if (isPoppedOut) {
        void dockWidgetBackToWorkspace()
        setContextMenuPos(null)
        return
      }
      if (tabId && config) {
        removeWidget(tabId, widgetId)
      }
      setContextMenuPos(null)
    }

    function buildTransferPayload() {
      if (!tabId || !config) return null
      return {
        version: 1 as const,
        sourceClientId: WINDOW_CLIENT_ID,
        sourceTabId: tabId,
        widget: config,
        layout: {
          w: layoutItem?.w ?? 6,
          h: layoutItem?.h ?? 6,
          minW: layoutItem?.minW,
          minH: layoutItem?.minH,
        },
      }
    }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpBtnRef = useRef<HTMLButtonElement>(null)
  const helpPopoverRef = useRef<HTMLDivElement>(null)
  const [helpContent, setHelpContent] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editingWidgetId = useFocusEditorStore((s) => s.editingWidgetId)
  const setEditingWidgetId = useFocusEditorStore((s) => s.setEditingWidgetId)

  const { tabId, config, layoutItem } = useWorkspaceStore(
    useShallow((s) => {
      for (const tab of s.tabs) {
        const widgetConfig = tab.widgets[widgetId]
        if (widgetConfig) {
          return {
            tabId: tab.id,
            config: widgetConfig,
            layoutItem: tab.layout.find((item) => item.i === widgetId),
          }
        }
      }

      return {
        tabId: undefined,
        config: undefined,
        layoutItem: undefined,
      }
    })
  )
  const removeWidget = useWorkspaceStore((s) => s.removeWidget)

  const { badge, badgeLabel, borderColor, driverNumber } = useWidgetDriver(
    config?.driverContext ?? 'FOCUS'
  )
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)

  const driver = driverNumber != null ? getDriver(driverNumber) : undefined
  const teamColor = driverNumber != null ? getTeamColor(driverNumber) : undefined
  const flagState = useAmbientStore((s) => s.flagState)
  const ambientLayerEnabled = useAmbientStore((s) => s.ambientLayerEnabled)
  const ambientLayerIntensity = useAmbientStore((s) => s.ambientLayerIntensity)
  const isPoppedOut = Boolean(config?.settings && (config.settings as Record<string, unknown>).poppedOut)
  const focusRefresh = useRefreshFade([config?.driverContext, driverNumber])

  // Badge styles
  const badgeColor =
    badge === 'FOCUS' ? 'var(--green)'
    : badge === 'PINNED' ? 'var(--purple)'
    : 'var(--gold)'

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuPos) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenuPos])

  // Close help popover on outside click
  useEffect(() => {
    if (!helpOpen) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (
        helpPopoverRef.current && helpPopoverRef.current.contains(target)
      ) return
      if (helpBtnRef.current && helpBtnRef.current.contains(target)) return
      setHelpOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [helpOpen])

  useEffect(() => {
    if (!helpOpen) {
      setHelpContent(null)
    }
  }, [helpOpen])

  // Helper to load help content dynamically from widget's index.tsx HELP export
  async function loadHelpContent() {
    const entry = WIDGET_MANIFEST.find((e) => e.type === config?.type)
    if (!entry) return setHelpContent(null)
    try {
      // Try to import HELP from the widget's index.tsx
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ `../../widgets/${config.type}/index.tsx`)
      const exported = mod?.HELP
      if (exported && typeof exported === 'string') {
        setHelpContent(exported)
        return
      }
    } catch {
      // ignore
    }
    setHelpContent(entry.description ?? null)
  }

  function buildPopoutBounds() {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return undefined
    const width = Math.max(280, Math.round(rect.width))
    const height = Math.max(180, Math.round(rect.height))
    return {
      x: Math.round(window.screenX + rect.left),
      y: Math.round(window.screenY + rect.top),
      width,
      height,
    }
  }

  async function popOutWidget() {
    const payload = buildTransferPayload()
    if (!payload || !tabId || !window.electronAPI) return
    try {
      await window.electronAPI.openNewWindow({
        transferWidget: payload,
        windowKind: 'widget-popout',
        popoutBounds: buildPopoutBounds(),
      })
      removeWidget(tabId, widgetId)
      setContextMenuPos(null)
    } catch {
      // no-op: keep widget in place if opening a new window fails
    }
  }

  function openSettingsWindow() {
    setSettingsOpen(true)
  }

  async function dockWidgetBackToWorkspace() {
    if (!isPoppedOut || !window.electronAPI?.dockWidgetToMainWorkspace) return
    const payload = buildTransferPayload()
    if (!payload) return

    try {
      const docked = await window.electronAPI.dockWidgetToMainWorkspace(payload)
      if (!docked) return
      await window.electronAPI.closeCurrentWindow?.()
    } catch {
      // no-op: keep window open if docking fails
    }
  }

  if (!config) return null

  const isFocusEditingTarget = editingWidgetId === widgetId

  return (
    <>
      <div
        ref={rootRef}
        data-widget-id={widgetId}
        onClick={() => setEditingWidgetId(widgetId)}
        className="animated-scale-in"
        style={{
          animationDuration: '110ms',
          width: '100%',
          height: '100%',
          background: 'var(--bg3)',
          border: isFocusEditingTarget
            ? `0.75px solid ${teamColor ?? 'var(--green)'}`
            : `0.5px dashed ${borderColor}`,
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: isFocusEditingTarget ? '0 0 0 1px rgba(0,0,0,0.25) inset' : 'none',
        }}
        onContextMenu={handleContextMenu}
      >
        {isPoppedOut && ambientLayerEnabled && flagState !== 'NONE' && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(140% 110% at 50% -18%, ${FLAG_COLORS[flagState].glow}1a 0%, transparent 62%)`,
              opacity: Math.min(0.24, (ambientLayerIntensity / 100) * 0.26),
              transition: 'opacity 0.25s ease, background 0.25s ease',
              zIndex: 0,
            }}
          />
        )}

        {/* Chrome header */}
        <div
          className="widget-drag-handle"
          onClick={isPoppedOut ? () => setEditingWidgetId(widgetId) : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingInline: 8,
            height: 22,
            borderBottom: `0.5px solid ${isPoppedOut && isFocusEditingTarget ? (teamColor ?? 'var(--green)') : 'var(--border)'}`,
            background: 'var(--bg4)',
            flexShrink: 0,
            gap: 6,
            cursor: isPoppedOut ? 'pointer' : 'grab',
            WebkitAppRegion: 'no-drag',
            position: 'relative',
            zIndex: 1,
          }}
        >

          {/* Driver badge — clicking opens Driver tab in settings */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); if (isPoppedOut) { void openSettingsWindow() } else { setSettingsOpen(true) } }}
            className="interactive-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 6px',
              borderRadius: 2,
              border: `0.5px dashed ${badgeColor}55`,
              background: `${badgeColor}11`,
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            }}
          >
            {teamColor && (
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: teamColor,
                flexShrink: 0,
              }} />
            )}
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: badgeColor,
            }}>
              {driver ? driver.name_acronym : badgeLabel}
            </span>
          </div>

          {/* Widget type label */}
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted2)',
              flex: 1,
            }}
          >
            {widgetTypeLabel(config.type)}
          </span>

          {/* Help icon — placed immediately to the right of the name */}
          {(() => {
            const entry = WIDGET_MANIFEST.find((e) => e.type === config.type)
            const desc = entry?.description
            return (
              <button
                ref={helpBtnRef}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!helpOpen) await loadHelpContent();
                  setHelpOpen((v) => !v)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="interactive-button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted2)',
                  cursor: 'pointer',
                  padding: '0 6px',
                  fontSize: 12,
                  lineHeight: 1,
                  transition: 'color 0.12s',
                  WebkitAppRegion: 'no-drag',
                }}
                aria-label={desc ? `Help: ${desc}` : 'Widget help'}
                title={desc}
              >
                ℹ
              </button>
            )
          })()}

          {/* Gear icon → settings */}
          <button
            onClick={(e) => { e.stopPropagation(); if (isPoppedOut) { void openSettingsWindow() } else { setSettingsOpen(true) } }}
            onMouseDown={(e) => e.stopPropagation()}
            className="interactive-button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted2)',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 10,
              lineHeight: 1,
              transition: 'color 0.12s',
              WebkitAppRegion: 'no-drag',
            }}
            aria-label="Widget settings"
          >
            ⚙
          </button>

          {/* Pop out button */}
          {!isPoppedOut && window.electronAPI && (
            <button
              onClick={(e) => { e.stopPropagation(); void popOutWidget() }}
              onMouseDown={(e) => e.stopPropagation()}
              className="interactive-button"
              title="Pop out widget"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted2)',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: 10,
                lineHeight: 1,
                transition: 'color 0.12s',
                WebkitAppRegion: 'no-drag',
              }}
              aria-label="Pop out widget"
            >
              ↗
            </button>
          )}

          {/* Drag grip — only in popout mode; click stopped so it doesn't trigger header onClick */}
          {isPoppedOut && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title="Drag to move window"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '0 4px',
                cursor: 'move',
                WebkitAppRegion: 'drag',
                flexShrink: 0,
                opacity: 0.4,
              }}
            >
              {[0, 1].map((row) => (
                <div key={row} style={{ display: 'flex', gap: 2 }}>
                  <div style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--muted)' }} />
                  <div style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--muted)' }} />
                </div>
              ))}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleRemove() }}
            onMouseDown={(e) => e.stopPropagation()}
            className="interactive-button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted2)',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 12,
              lineHeight: 1,
              transition: 'color 0.12s',
              WebkitAppRegion: 'no-drag',
            }}
            aria-label={isPoppedOut ? 'Dock widget back to workspace' : 'Remove widget'}
          >
            ×
          </button>
        </div>

        {/* Widget content */}
        <div
          className={focusRefresh ? 'data-refresh-fade' : undefined}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}
        >
          <WidgetErrorBoundary widgetId={widgetId} widgetType={config.type}>
            {children}
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* Context menu — portalled to body to escape transform stacking context */}
      {helpOpen && (() => {
        const entry = WIDGET_MANIFEST.find((e) => e.type === config.type)
        const rect = helpBtnRef.current?.getBoundingClientRect()
        const desc = helpContent ?? entry?.description
        if (!rect || !desc) return null

        // Popup dimensions (should match style below)
        const POPUP_MIN_WIDTH = 220
        const POPUP_PADDING_X = 20 // 10px left/right
        const POPUP_PADDING_Y = 16 // 8px top/bottom
        const POPUP_HEIGHT_ESTIMATE = 260 // estimate, could be improved
        const popupWidth = POPUP_MIN_WIDTH + POPUP_PADDING_X
        const popupHeight = POPUP_HEIGHT_ESTIMATE

        // Viewport dimensions (popout or main window)
        // This ensures the popup is always visible within the current window, even when popped out
        const vw = window.innerWidth
        const vh = window.innerHeight

        // Default position: below button
        let left = Math.round(rect.left)
        let top = Math.round(rect.bottom + 8)

        // Adjust horizontally if offscreen (clamp to window bounds)
        if (left + popupWidth > vw - 8) {
          left = Math.max(8, vw - popupWidth)
        }
        if (left < 8) left = 8

        // Adjust vertically if offscreen (try above button as last resort)
        if (top + popupHeight > vh - 8) {
          // Try to show above the button
          const aboveTop = Math.round(rect.top - popupHeight - 8)
          if (aboveTop > 8) {
            top = aboveTop
          } else {
            // Clamp to bottom edge
            top = Math.max(8, vh - popupHeight)
          }
        }

        // If the popup would still be clipped (e.g. window is too small), clamp to top
        if (top < 8) top = 8
        // If the popup would still be clipped horizontally, clamp to left
        if (left < 8) left = 8

        // NOTE: This logic ensures the help popup is always visible and not clipped by widget or window bounds, including in popout mode.

        return createPortal(
          <div
            ref={helpPopoverRef}
            className="animated-scale-in"
            role="dialog"
            aria-label="Widget help"
            style={{
              position: 'fixed',
              left,
              top,
              background: 'var(--bg4)',
              border: '0.5px solid var(--border2)',
              borderRadius: 6,
              padding: '8px 10px',
              zIndex: 650,
              minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              color: 'var(--white)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.02em',
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: 'calc(100vh - 16px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--muted2)', fontSize: 10 }}>{entry?.label}</div>
            <div style={{ whiteSpace: 'normal', color: 'var(--white)', fontSize: 11 }}>
              <Markdown source={desc} />
            </div>
          </div>,
          document.body
        )
      })()}

      {contextMenuPos && createPortal(
        <div
          ref={menuRef}
          className="animated-scale-in"
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            background: 'var(--bg4)',
            border: '0.5px solid var(--border2)',
            borderRadius: 4,
            padding: '4px 0',
            zIndex: 500,
            minWidth: 160,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <ContextMenuItem onClick={() => { if (isPoppedOut) { void openSettingsWindow() } else { setSettingsOpen(true) } ; setContextMenuPos(null) }}>
            Settings
          </ContextMenuItem>
          {window.electronAPI && (
            <ContextMenuItem onClick={() => { void popOutWidget() }}>
              Pop out widget
            </ContextMenuItem>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <ContextMenuItem onClick={handleRemove} danger>
            Remove widget
          </ContextMenuItem>
        </div>,
        document.body
      )}

      {/* Settings panel — portalled to body to escape transform stacking context */}
      {settingsOpen && createPortal(
        <WidgetSettingsPanel widgetId={widgetId} onClose={() => setSettingsOpen(false)} />,
        document.body
      )}
    </>
  )
}


function ContextMenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '5px 12px',
        background: hovered ? (danger ? 'rgba(232,19,43,0.1)' : 'var(--bg3)') : 'transparent',
        border: 'none',
        textAlign: 'left',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        color: danger ? 'var(--red)' : 'var(--white)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  )
}
