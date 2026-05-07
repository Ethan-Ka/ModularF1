import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from 'react'

const EASE = 0.18
const FACTOR = 0.82
const STOP = 1.5

export interface SmoothScrollHandle {
  scrollToBottom(): void
  scrollTo(y: number): void
  getScrollTop(): number
}

interface Props {
  children: ReactNode
  className?: string
  // style props for the outer clip container (flex, height, min-height, etc. — not padding)
  style?: CSSProperties
  // padding and spacing go here to avoid affecting getMax() calculations
  innerStyle?: CSSProperties
}

export const SmoothScrollContainer = forwardRef<SmoothScrollHandle, Props>(
  function SmoothScrollContainer({ children, className, style, innerStyle }, ref) {
    const outerRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    const state = useRef({ target: 0, current: 0, rafId: null as number | null })

    function getMax(): number {
      const o = outerRef.current, i = innerRef.current
      if (!o || !i) return 0
      return Math.max(0, i.scrollHeight - o.clientHeight)
    }

    function applyTransform(y: number): void {
      if (innerRef.current) innerRef.current.style.transform = `translateY(${-y}px)`
    }

    function tick(): void {
      const s = state.current
      const diff = s.target - s.current
      if (Math.abs(diff) < STOP) {
        s.current = s.target
        applyTransform(s.target)
        s.rafId = null
        return
      }
      s.current += diff * EASE
      applyTransform(s.current)
      s.rafId = requestAnimationFrame(tick)
    }

    function startTick(): void {
      if (state.current.rafId === null) {
        state.current.rafId = requestAnimationFrame(tick)
      }
    }

    useImperativeHandle(ref, () => ({
      // Instant jump — for programmatic "scroll to bottom on new data" patterns
      scrollToBottom() {
        const max = getMax()
        state.current.target = max
        state.current.current = max
        applyTransform(max)
      },
      scrollTo(y: number) {
        state.current.target = Math.max(0, Math.min(getMax(), y))
        startTick()
      },
      getScrollTop(): number {
        return state.current.current
      },
    }), [])

    useEffect(() => {
      const outer = outerRef.current
      if (!outer) return

      function onWheel(e: WheelEvent): void {
        const raw = e.deltaMode === 1 ? e.deltaY * 20
          : e.deltaMode === 2 ? e.deltaY * outer!.clientHeight
          : e.deltaY
        const s = state.current
        const max = getMax()
        e.preventDefault()
        e.stopPropagation()
        if ((raw < 0 && s.target <= 0) || (raw > 0 && s.target >= max)) return
        s.target = Math.max(0, Math.min(max, s.target + raw * FACTOR))
        startTick()
      }

      function onKeyDown(e: KeyboardEvent): void {
        const s = state.current
        const max = getMax()
        const h = outer.clientHeight
        let delta = 0
        switch (e.key) {
          case 'ArrowDown': delta = 40; break
          case 'ArrowUp': delta = -40; break
          case 'PageDown': case ' ': delta = h * 0.9; break
          case 'PageUp': delta = -(h * 0.9); break
          case 'Home': s.target = 0; startTick(); e.preventDefault(); return
          case 'End': s.target = max; startTick(); e.preventDefault(); return
          default: return
        }
        e.preventDefault()
        s.target = Math.max(0, Math.min(max, s.target + delta))
        startTick()
      }

      outer.addEventListener('wheel', onWheel, { passive: false })
      outer.addEventListener('keydown', onKeyDown)
      return () => {
        outer.removeEventListener('wheel', onWheel)
        outer.removeEventListener('keydown', onKeyDown)
      }
    }, [])

    useEffect(() => {
      const inner = innerRef.current, outer = outerRef.current
      if (!inner || !outer) return
      const ro = new ResizeObserver(() => {
        const max = getMax()
        const s = state.current
        if (s.target > max) s.target = max
        if (s.current > max) {
          s.current = max
          applyTransform(max)
        }
      })
      ro.observe(inner)
      ro.observe(outer)
      return () => ro.disconnect()
    }, [])

    return (
      <div
        ref={outerRef}
        className={className}
        style={{ ...style, overflow: 'hidden' }}
        tabIndex={-1}
        onPointerDown={() => outerRef.current?.focus({ preventScroll: true })}
      >
        <div
          ref={innerRef}
          style={{ ...innerStyle, willChange: 'transform', minHeight: '100%' }}
        >
          {children}
        </div>
      </div>
    )
  }
)
