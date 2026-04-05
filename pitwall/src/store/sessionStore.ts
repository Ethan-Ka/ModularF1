import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenF1Session } from '../api/openf1'

type AppMode = 'live' | 'historical' | 'onboarding'

interface SessionStore {
  apiKey: string | null
  mode: AppMode
  activeSession: OpenF1Session | null
  apiRequestsEnabled: boolean
  setApiKey: (key: string) => void
  clearApiKey: () => void
  setMode: (mode: AppMode) => void
  setActiveSession: (session: OpenF1Session) => void
  setApiRequestsEnabled: (enabled: boolean) => void
  toggleApiRequestsEnabled: () => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      apiKey: null,
      mode: 'onboarding',
      activeSession: null,
      apiRequestsEnabled: true,
      setApiKey: (key) => set({ apiKey: key, mode: 'live' }),
      clearApiKey: () => set({ apiKey: null, mode: 'historical' }),
      setMode: (mode) => set({ mode }),
      setActiveSession: (session) => set({ activeSession: session }),
      setApiRequestsEnabled: (enabled) => set({ apiRequestsEnabled: enabled }),
      toggleApiRequestsEnabled: () => set((state) => ({ apiRequestsEnabled: !state.apiRequestsEnabled })),
    }),
    {
      name: 'pitwall-session',
      partialize: (s) => ({ apiKey: s.apiKey, mode: s.mode }),
    }
  )
)
