import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenF1Session } from '../api/openf1'
import type { FastF1SessionRef } from '../api/fastf1Bridge'

export type AppMode = 'live' | 'demo' | 'hub' | 'onboarding'

interface SessionStore {
  // OpenF1
  apiKey: string | null
  mode: AppMode
  activeSession: OpenF1Session | null
  apiRequestsEnabled: boolean
  onboardingComplete: boolean
  setApiKey: (key: string) => void
  clearApiKey: () => void
  setMode: (mode: AppMode) => void
  setActiveSession: (session: OpenF1Session) => void
  setApiRequestsEnabled: (enabled: boolean) => void
  toggleApiRequestsEnabled: () => void
  setOnboardingComplete: (done: boolean) => void

  // FastF1 bridge
  fastf1ServerAvailable: boolean
  activeFastF1Session: FastF1SessionRef | null
  f1tvAuthenticated: boolean
  f1tvEmail: string | null
  setFastF1ServerAvailable: (available: boolean) => void
  setActiveFastF1Session: (ref: FastF1SessionRef | null) => void
  setF1TVAuth: (authenticated: boolean, email?: string | null) => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      // OpenF1
      apiKey: null,
      mode: 'onboarding',
      activeSession: null,
      apiRequestsEnabled: true,
      onboardingComplete: false,
      setApiKey: (key) => set({ apiKey: key, mode: 'hub', onboardingComplete: true }),
      clearApiKey: () => set({ apiKey: null, mode: 'hub' }),
      setMode: (mode) => set({ mode }),
      setActiveSession: (session) => set({ activeSession: session }),
      setApiRequestsEnabled: (enabled) => set({ apiRequestsEnabled: enabled }),
      toggleApiRequestsEnabled: () => set((state) => ({ apiRequestsEnabled: !state.apiRequestsEnabled })),
      setOnboardingComplete: (done) => set({ onboardingComplete: done }),

      // FastF1 bridge
      fastf1ServerAvailable: false,
      activeFastF1Session: null,
      f1tvAuthenticated: false,
      f1tvEmail: null,
      setFastF1ServerAvailable: (available) => set({ fastf1ServerAvailable: available }),
      setActiveFastF1Session: (ref) => set({ activeFastF1Session: ref }),
      setF1TVAuth: (authenticated, email = null) => set({ f1tvAuthenticated: authenticated, f1tvEmail: email ?? null }),
    }),
    {
      name: 'pitwall-session',
      version: 3,
      migrate: (persisted: unknown, fromVersion: number) => {
        const s = persisted as Record<string, unknown>
        if (fromVersion < 1 && s.mode === 'historical') s.mode = 'hub'
        if (fromVersion < 2 && 'dataSource' in s) delete s.dataSource
        if (fromVersion < 3 && s.mode === 'demo') s.mode = 'hub'
        return s
      },
      partialize: (s) => ({
        apiKey: s.apiKey,
        mode: s.mode,
        apiRequestsEnabled: s.apiRequestsEnabled,
        onboardingComplete: s.onboardingComplete,
        activeFastF1Session: s.activeFastF1Session,
        f1tvAuthenticated: s.f1tvAuthenticated,
        f1tvEmail: s.f1tvEmail,
      }),
    }
  )
)
