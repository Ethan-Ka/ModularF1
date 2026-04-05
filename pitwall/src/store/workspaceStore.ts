import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutItem } from 'react-grid-layout'
import { encodeLayout, decodeLayout } from '../lib/layoutCodec'

export interface WidgetConfig {
  id: string
  type: string
  driverContext: DriverContext
  pinnedDriver?: number
  settings?: Record<string, unknown>
}

export type DriverContext = 'FOCUS' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'GAP+1' | 'GAP-1' | `PINNED:${number}`

export interface CanvasTab {
  id: string
  name: string
  layout: LayoutItem[]
  widgets: Record<string, WidgetConfig>
}

interface WorkspaceStore {
  tabs: CanvasTab[]
  activeTabId: string
  resetToDefault: () => void
  addTab: (name?: string) => void
  removeTab: (id: string) => void
  renameTab: (id: string, name: string) => void
  setActiveTab: (id: string) => void
  updateLayout: (tabId: string, layout: LayoutItem[]) => void
  addWidget: (tabId: string, widget: WidgetConfig, layoutItem: LayoutItem) => void
  removeWidget: (tabId: string, widgetId: string) => void
  updateWidgetConfig: (tabId: string, widgetId: string, config: Partial<WidgetConfig>) => void
  getActiveTab: () => CanvasTab | undefined
  exportLayout: (tabId: string) => string
  importLayout: (tabId: string, code: string) => boolean
}

function makeDefaultTab(name = 'Canvas 1'): CanvasTab {
  return {
    id: crypto.randomUUID(),
    name,
    layout: [],
    widgets: {},
  }
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => {
      const initialTab = makeDefaultTab()
      return {
        tabs: [initialTab],
        activeTabId: initialTab.id,

        resetToDefault: () => {
          const defaultTab = makeDefaultTab()
          set({ tabs: [defaultTab], activeTabId: defaultTab.id })
        },

        addTab: (name) => {
          const tab = makeDefaultTab(name ?? `Canvas ${get().tabs.length + 1}`)
          set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
        },

        removeTab: (id) => {
          const { tabs, activeTabId } = get()
          if (tabs.length === 1) return
          const next = tabs.filter((t) => t.id !== id)
          set({ tabs: next, activeTabId: activeTabId === id ? next[0].id : activeTabId })
        },

        renameTab: (id, name) =>
          set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)) })),

        setActiveTab: (id) => set({ activeTabId: id }),

        updateLayout: (tabId, layout) =>
          set((s) => ({
            tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, layout } : t)),
          })),

        addWidget: (tabId, widget, layoutItem) =>
          set((s) => ({
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    layout: [...t.layout, layoutItem],
                    widgets: { ...t.widgets, [widget.id]: widget },
                  }
                : t
            ),
          })),

        removeWidget: (tabId, widgetId) =>
          set((s) => ({
            tabs: s.tabs.map((t) => {
              if (t.id !== tabId) return t
              const { [widgetId]: _, ...rest } = t.widgets
              return { ...t, layout: t.layout.filter((l) => l.i !== widgetId), widgets: rest }
            }),
          })),

        updateWidgetConfig: (tabId, widgetId, config) =>
          set((s) => ({
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    widgets: {
                      ...t.widgets,
                      [widgetId]: { ...t.widgets[widgetId], ...config },
                    },
                  }
                : t
            ),
          })),

        getActiveTab: () => {
          const { tabs, activeTabId } = get()
          return tabs.find((t) => t.id === activeTabId) ?? tabs[0]
        },

        exportLayout: (tabId) => {
          const tab = get().tabs.find((t) => t.id === tabId)
          if (!tab) return ''
          return encodeLayout(tab)
        },

        importLayout: (tabId, code) => {
          try {
            const decoded = decodeLayout(code)
            set((s) => ({
              tabs: s.tabs.map((t) =>
                t.id === tabId ? { ...t, ...decoded } : t
              ),
            }))
            return true
          } catch {
            return false
          }
        },
      }
    },
    {
      name: 'pitwall-workspace',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Keep activeTabId valid if legacy persisted data has an empty/missing ID.
        if ((!state.activeTabId || state.activeTabId.trim() === '') && state.tabs.length > 0) {
          state.setActiveTab(state.tabs[0].id)
        }
      },
    }
  )
)
