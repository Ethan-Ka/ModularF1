import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSessionStore } from './sessionStore'
import { useDriverStore } from './driverStore'

export type FlagState =
  | 'GREEN'
  | 'YELLOW'
  | 'SAFETY_CAR'
  | 'VIRTUAL_SC'
  | 'RED'
  | 'FASTEST_LAP'
  | 'CHECKERED'
  | 'WAITING_FOR_START'
  | 'NATIONAL_ANTHEM'
  | 'CALM'
  | 'NONE'

export interface ToastItem {
  id: string
  message: string
  flagState: FlagState
  timestamp: number
}

// Banner message fired by flag events — animates in-bar rather than as a pill toast
export interface BannerMessage {
  text: string
  id: string // fresh UUID per event so the same text re-triggers the animation
}

interface AmbientStore {
  flagState: FlagState
  previousFlagState: FlagState
  leaderColorMode: boolean
  leaderColor: string | null
  leaderDriverNumber: number | null
  toasts: ToastItem[]
  bannerMessage: BannerMessage | null
  ambientLayerEnabled: boolean
  ambientLayerIntensity: number
  ambientLayerWaveEnabled: boolean
  setFlagState: (state: FlagState, message?: string) => void
  addToast: (message: string, flagState?: FlagState) => void
  setLeaderColorMode: (enabled: boolean) => void
  setLeader: (driverNumber: number, color: string) => void
  dismissToast: (id: string) => void
  clearToasts: () => void
  setAmbientLayerEnabled: (enabled: boolean) => void
  setAmbientLayerIntensity: (intensity: number) => void
  setAmbientLayerWaveEnabled: (enabled: boolean) => void
}

const AMBIENT_INTENSITY_PRESETS = [25, 50, 75, 100] as const

function toAmbientIntensityPreset(intensity: number): (typeof AMBIENT_INTENSITY_PRESETS)[number] {
  return AMBIENT_INTENSITY_PRESETS.reduce((closest, preset) => {
    return Math.abs(preset - intensity) < Math.abs(closest - intensity) ? preset : closest
  }, AMBIENT_INTENSITY_PRESETS[0])
}

function buildToast(message: string, flagState: FlagState): ToastItem {
  return {
    id: crypto.randomUUID(),
    message,
    flagState,
    timestamp: Date.now(),
  }
}

function scheduleToastRemoval(toastId: string) {
  setTimeout(() => {
    useAmbientStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) }))
  }, 4200) // 300ms in + 2000ms hold + 600ms out + buffer
}

function isLiveRaceSession(): boolean {
  const { mode, activeSession } = useSessionStore.getState()
  if (mode !== 'live') return false
  const sessionName = activeSession?.session_name ?? ''
  return /race/i.test(sessionName)
}

function getLeaderAcronym(driverNumber: number | null): string | null {
  if (driverNumber == null) return null
  const driver = useDriverStore.getState().getDriver(driverNumber)
  if (!driver) return null
  const acronym = (driver as any).name_acronym as string | undefined
  const broadcast = (driver as any).broadcast_name as string | undefined
  if (acronym && acronym.trim().length > 0) return acronym.trim().toUpperCase()
  if (broadcast && broadcast.trim().length > 0) return broadcast.trim().slice(0, 3).toUpperCase()
  return String(driverNumber)
}

function buildGreenLeaderMessage(leaderDriverNumber: number | null): string {
  const leaderAcronym = getLeaderAcronym(leaderDriverNumber)
  return leaderAcronym ? `Green flag - ${leaderAcronym} leads` : 'Green flag - racing'
}

function buildCheckeredWinnerMessage(leaderDriverNumber: number | null): string {
  const leaderAcronym = getLeaderAcronym(leaderDriverNumber)
  return leaderAcronym ? `${leaderAcronym} win` : 'Chequered flag'
}

export const useAmbientStore = create<AmbientStore>()(
  persist(
    (set, get) => ({
      flagState: 'NONE',
      previousFlagState: 'NONE',
      leaderColorMode: true,
      leaderColor: null,
      leaderDriverNumber: null,
      toasts: [],
      bannerMessage: null,
      ambientLayerEnabled: true,
      ambientLayerIntensity: 75,
      ambientLayerWaveEnabled: true,

      setFlagState: (state, message) => {
        const normalizedState: FlagState = state === 'NONE' && isLiveRaceSession() ? 'GREEN' : state
        const prev = get().flagState

        const resolvedText =
          normalizedState === 'GREEN'
            ? buildGreenLeaderMessage(get().leaderDriverNumber)
            : normalizedState === 'CHECKERED'
              ? buildCheckeredWinnerMessage(get().leaderDriverNumber)
              : (message ?? normalizedState.replace(/_/g, ' '))

        const currentBannerText = get().bannerMessage?.text ?? ''
        if (prev === normalizedState && normalizedState !== 'FASTEST_LAP' && currentBannerText === resolvedText) return

        const previousForRestore: FlagState =
          normalizedState === 'FASTEST_LAP' && prev === 'NONE' && isLiveRaceSession() ? 'GREEN' : prev

        const bannerMessage: BannerMessage = {
          text: resolvedText,
          id: crypto.randomUUID(),
        }

        // Race events animate in the banner — not as pill toasts
        set((s) => ({ flagState: normalizedState, previousFlagState: previousForRestore, bannerMessage }))

        // Auto-dismiss fastest lap after 2.8s, then restore
        if (normalizedState === 'FASTEST_LAP') {
          setTimeout(() => {
            const current = get()
            if (current.flagState === 'FASTEST_LAP') {
              const restoreState: FlagState =
                current.previousFlagState === 'NONE' && isLiveRaceSession()
                  ? 'GREEN'
                  : current.previousFlagState
              set({ flagState: restoreState })
            }
          }, 2800)
        }
      },

      addToast: (message, flagState = 'YELLOW') => {
        const toast = buildToast(message, flagState)
        set((s) => ({ toasts: [...s.toasts, toast] }))
        scheduleToastRemoval(toast.id)
      },

      setLeaderColorMode: (enabled) => set({ leaderColorMode: enabled }),

      setLeader: (driverNumber, color) => {
        const current = get()
        if (current.leaderDriverNumber === driverNumber && current.leaderColor === color) return
        set({ leaderDriverNumber: driverNumber, leaderColor: color })

        const next = get()
        if (next.flagState === 'GREEN' && next.leaderColorMode) {
          set({
            bannerMessage: {
              text: buildGreenLeaderMessage(driverNumber),
              id: crypto.randomUUID(),
            },
          })
        }
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      clearToasts: () => set({ toasts: [] }),

      setAmbientLayerEnabled: (enabled) => set({ ambientLayerEnabled: enabled }),
      setAmbientLayerIntensity: (intensity) =>
        set({ ambientLayerIntensity: toAmbientIntensityPreset(intensity) }),
      setAmbientLayerWaveEnabled: (enabled) => set({ ambientLayerWaveEnabled: enabled }),
    }),
    {
      name: 'pitwall-ambient',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const normalized = toAmbientIntensityPreset(state.ambientLayerIntensity)
        if (state.ambientLayerIntensity !== normalized) {
          state.setAmbientLayerIntensity(normalized)
        }
      },
      partialize: (s) => ({
        leaderColorMode: s.leaderColorMode,
        ambientLayerEnabled: s.ambientLayerEnabled,
        ambientLayerIntensity: s.ambientLayerIntensity,
        ambientLayerWaveEnabled: s.ambientLayerWaveEnabled,
      }),
    }
  )
)
