// Resolves a widget's DriverContext to a concrete driver number
import { useDriverStore } from '../store/driverStore'
import { usePositions } from './usePositions'
import type { DriverContext } from '../store/workspaceStore'
import type { WindowFocusSelector } from '../store/driverStore'

export interface WidgetDriverResult {
  driverNumber: number | null
  badge: 'FOCUS' | 'POSITION' | 'PINNED' | null
  badgeLabel: string
  borderColor: string
}

function resolveSelectorDriver(
  selector: Exclude<WindowFocusSelector, 'FOCUS'>,
  canvasFocus: number | null,
  positions?: { driver_number: number; position: number }[]
): number | null {
  if (!positions) return null

  if (selector === 'P1') return positions.find((p) => p.position === 1)?.driver_number ?? null
  if (selector === 'P2') return positions.find((p) => p.position === 2)?.driver_number ?? null
  if (selector === 'P3') return positions.find((p) => p.position === 3)?.driver_number ?? null
  if (selector === 'P4') return positions.find((p) => p.position === 4)?.driver_number ?? null
  if (selector === 'P5') return positions.find((p) => p.position === 5)?.driver_number ?? null

  if (selector === 'GAP+1') {
    const focusPos = positions.find((p) => p.driver_number === canvasFocus)?.position
    if (focusPos && focusPos > 1) {
      return positions.find((p) => p.position === focusPos - 1)?.driver_number ?? null
    }
    return null
  }

  const focusPos = positions.find((p) => p.driver_number === canvasFocus)?.position
  if (focusPos) {
    return positions.find((p) => p.position === focusPos + 1)?.driver_number ?? null
  }
  return null
}

export function useWidgetDriver(context: DriverContext): WidgetDriverResult {
  const canvasFocus = useDriverStore((s) => s.canvasFocus)
  const windowFocusSelector = useDriverStore((s) => s.windowFocusSelector)
  const { data: positions } = usePositions()

  if (context === 'FOCUS') {
    const selectedDriver =
      windowFocusSelector === 'FOCUS'
        ? canvasFocus
        : resolveSelectorDriver(windowFocusSelector, canvasFocus, positions)

    return {
      driverNumber: selectedDriver,
      badge: 'FOCUS',
      badgeLabel: windowFocusSelector === 'FOCUS' ? 'FOCUS' : `FOCUS:${windowFocusSelector}`,
      borderColor: 'rgba(29,184,106,0.5)',
    }
  }

  if (context.startsWith('PINNED:')) {
    const num = parseInt(context.slice(7), 10)
    return {
      driverNumber: num,
      badge: 'PINNED',
      badgeLabel: 'PINNED',
      borderColor: 'rgba(155,89,245,0.5)',
    }
  }

  // Position-based
  if (!positions) {
    return { driverNumber: null, badge: 'POSITION', badgeLabel: context, borderColor: 'rgba(201,168,76,0.5)' }
  }

  let driverNumber: number | null = null

  if (context === 'P1') driverNumber = positions.find((p) => p.position === 1)?.driver_number ?? null
  else if (context === 'P2') driverNumber = positions.find((p) => p.position === 2)?.driver_number ?? null
  else if (context === 'P3') driverNumber = positions.find((p) => p.position === 3)?.driver_number ?? null
  else if (context === 'P4') driverNumber = positions.find((p) => p.position === 4)?.driver_number ?? null
  else if (context === 'P5') driverNumber = positions.find((p) => p.position === 5)?.driver_number ?? null
  else if (context === 'GAP+1' || context === 'GAP-1') {
    driverNumber = resolveSelectorDriver(context, canvasFocus, positions)
  }

  return {
    driverNumber,
    badge: 'POSITION',
    badgeLabel: context,
    borderColor: 'rgba(201,168,76,0.5)',
  }
}
