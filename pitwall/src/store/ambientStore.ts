import { create } from 'zustand'

export type FlagState =
  | 'GREEN'
  | 'YELLOW'
  | 'SAFETY_CAR'
  | 'VIRTUAL_SC'
  | 'RED'
  | 'FASTEST_LAP'
  | 'CHECKERED'
  | 'CALM'
  | 'NONE'

export interface ToastItem {
  id: string
  message: string
  flagState: FlagState
  timestamp: number
}

interface AmbientStore {
  flagState: FlagState
  previousFlagState: FlagState
  leaderColorMode: boolean
  leaderColor: string | null
  leaderDriverNumber: number | null
  toasts: ToastItem[]
  setFlagState: (state: FlagState, message?: string) => void
  addToast: (message: string, flagState?: FlagState) => void
  setLeaderColorMode: (enabled: boolean) => void
  setLeader: (driverNumber: number, color: string) => void
  dismissToast: (id: string) => void
  clearToasts: () => void
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

export const useAmbientStore = create<AmbientStore>()((set, get) => ({
  flagState: 'NONE',
  previousFlagState: 'NONE',
  leaderColorMode: true,
  leaderColor: null,
  leaderDriverNumber: null,
  toasts: [],

  setFlagState: (state, message) => {
    const prev = get().flagState
    if (prev === state && state !== 'FASTEST_LAP') return

    const toast = buildToast(message ?? state.replace('_', ' '), state)

    // Use updater form so flagState and toasts are read atomically from the
    // same snapshot — avoids TOCTOU if two flag events arrive in the same tick.
    set((s) => ({ flagState: state, previousFlagState: prev, toasts: [...s.toasts, toast] }))

    // Auto-dismiss fastest lap after 2.8s, then restore
    if (state === 'FASTEST_LAP') {
      setTimeout(() => {
        const current = get()
        if (current.flagState === 'FASTEST_LAP') {
          set({ flagState: current.previousFlagState })
        }
      }, 2800)
    }

    // Auto-remove toast after display time
    scheduleToastRemoval(toast.id)
  },

  addToast: (message, flagState = 'YELLOW') => {
    const toast = buildToast(message, flagState)
    set((s) => ({ toasts: [...s.toasts, toast] }))
    scheduleToastRemoval(toast.id)
  },

  setLeaderColorMode: (enabled) => set({ leaderColorMode: enabled }),

  setLeader: (driverNumber, color) => {
    if (get().leaderDriverNumber === driverNumber) return
    set({ leaderDriverNumber: driverNumber, leaderColor: color })
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))
