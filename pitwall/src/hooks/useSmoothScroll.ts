import { useEffect } from 'react'

// EASE=0.18 closes ~90% of the gap in ~12 frames (~200ms at 60fps) vs 25+ frames at 0.09.
// This keeps the animation feeling smooth without occupying the main thread for long.
const EASE = 0.18
const FACTOR = 0.82

interface ScrollState {
  target: number
  current: number
  rafId: number | null
}

const scrollMap = new WeakMap<Element, ScrollState>()

function getScrollableAncestor(el: Element | null): Element | null {
  while (el && el !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el
    }
    el = el.parentElement
  }
  return null
}

function hasScrollSnap(el: Element): boolean {
  const snap = window.getComputedStyle(el).getPropertyValue('scroll-snap-type')
  return snap !== '' && snap !== 'none'
}

function isGlobeCanvas(el: Element): boolean {
  // Three.js renders to a <canvas>; intercept its wheel events and the globe breaks
  return el.tagName === 'CANVAS'
}

function normaliseDelta(e: WheelEvent): number {
  // DOM_DELTA_LINE = 1, DOM_DELTA_PAGE = 2
  if (e.deltaMode === 1) return e.deltaY * 20
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight
  return e.deltaY
}

function animateScroll(el: Element): void {
  const state = scrollMap.get(el)
  if (!state) return

  const diff = state.target - state.current
  if (Math.abs(diff) < 1.5) {
    el.scrollTop = state.target
    state.current = state.target
    state.rafId = null
    return
  }

  state.current += diff * EASE
  el.scrollTop = state.current
  state.rafId = requestAnimationFrame(() => animateScroll(el))
}

export function useSmoothScroll(): void {
  useEffect(() => {
    function onWheel(e: WheelEvent): void {
      const target = e.target as Element | null
      if (!target) return
      if (isGlobeCanvas(target)) return

      const scrollable = getScrollableAncestor(target)
      if (!scrollable) return
      if (hasScrollSnap(scrollable)) return

      e.preventDefault()

      let state = scrollMap.get(scrollable)
      if (!state) {
        state = { target: scrollable.scrollTop, current: scrollable.scrollTop, rafId: null }
        scrollMap.set(scrollable, state)
      }

      const maxScroll = scrollable.scrollHeight - scrollable.clientHeight
      state.target = Math.max(0, Math.min(maxScroll, state.target + normaliseDelta(e) * FACTOR))

      if (state.rafId === null) {
        state.current = scrollable.scrollTop
        state.rafId = requestAnimationFrame(() => animateScroll(scrollable))
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}
