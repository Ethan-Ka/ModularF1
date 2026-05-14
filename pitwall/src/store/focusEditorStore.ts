import { create } from 'zustand'
import type { DriverContext } from './workspaceStore'

export interface RemoteWidgetEdit {
  widgetId: string
  tabId: string
  driverContext: DriverContext
}

interface FocusEditorStore {
  editingWidgetId: string | null
  setEditingWidgetId: (widgetId: string | null) => void
  remoteWidgetEdit: RemoteWidgetEdit | null
  setRemoteWidgetEdit: (edit: RemoteWidgetEdit | null) => void
}

export const useFocusEditorStore = create<FocusEditorStore>()((set) => ({
  editingWidgetId: null,
  setEditingWidgetId: (widgetId) => set({ editingWidgetId: widgetId }),
  remoteWidgetEdit: null,
  setRemoteWidgetEdit: (edit) => set({ remoteWidgetEdit: edit }),
}))
