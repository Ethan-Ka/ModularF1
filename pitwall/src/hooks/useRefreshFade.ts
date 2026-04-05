import { useEffect, useRef, useState } from 'react'
import type { DependencyList } from 'react'

/**
 * Returns true briefly whenever dependencies change (after initial mount).
 * Useful for applying a transient CSS class for data refresh animations.
 */
export function useRefreshFade(deps: DependencyList, durationMs = 260): boolean {
  const [active, setActive] = useState(false)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    setActive(false)
    const frame = window.requestAnimationFrame(() => setActive(true))
    const timeout = window.setTimeout(() => setActive(false), durationMs)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, deps)

  return active
}
