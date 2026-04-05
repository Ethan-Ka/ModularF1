import { create } from 'zustand'

type WindowMode = 'main' | 'popout'

interface WindowStore {
  mode: WindowMode
  popoutWidgetId: string | null
  setPopoutMode: (widgetId: string) => void
  clearPopoutMode: () => void
}

export const useWindowStore = create<WindowStore>()((set) => ({
  mode: 'main',
  popoutWidgetId: null,
  setPopoutMode: (widgetId) => set({ mode: 'popout', popoutWidgetId: widgetId }),
  clearPopoutMode: () => set({ mode: 'main', popoutWidgetId: null }),
}))
