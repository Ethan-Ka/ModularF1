import { useEffect, useRef, useState } from 'react'
import { useAmbientStore } from '../../store/ambientStore'
import { useDriverStore } from '../../store/driverStore'
import { resolveTeamPalette } from '../../lib/teamPalette'
import { FLAG_COLORS, getTransitionDuration } from './flagStateMachine'

function blendHex(base: string, tint: string, ratio: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ]
  }

  try {
    const [r1, g1, b1] = parse(base)
    const [r2, g2, b2] = parse(tint)
    const r = Math.round(r1 + (r2 - r1) * ratio)
    const g = Math.round(g1 + (g2 - g1) * ratio)
    const b = Math.round(b1 + (b2 - b1) * ratio)
    return `rgb(${r},${g},${b})`
  } catch {
    return base
  }
}

function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const hex = color.trim()
  if (hex.startsWith('#')) {
    const h = hex.replace('#', '')
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return `rgba(${r},${g},${b},${a})`
    }
  }

  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${a})`
  }

  return color
}

export interface TopChromeSharedGradientLayerProps {
  transitionY: number
  tailFadePx: number
}

export function TopChromeSharedGradientLayer({ transitionY, tailFadePx }: TopChromeSharedGradientLayerProps) {
  const flagState = useAmbientStore((s) => s.flagState)
  const leaderColorMode = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const getDriver = useDriverStore((s) => s.getDriver)

  const greenHandoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leaderHandoffReady, setLeaderHandoffReady] = useState(flagState !== 'GREEN')
  const [pulseBurstActive, setPulseBurstActive] = useState(false)

  useEffect(() => {
    return () => {
      if (greenHandoffTimerRef.current) {
        clearTimeout(greenHandoffTimerRef.current)
        greenHandoffTimerRef.current = null
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (greenHandoffTimerRef.current) {
      clearTimeout(greenHandoffTimerRef.current)
      greenHandoffTimerRef.current = null
    }

    if (flagState === 'GREEN') {
      setLeaderHandoffReady(false)
      greenHandoffTimerRef.current = setTimeout(() => {
        setLeaderHandoffReady(true)
      }, 950)
      return
    }

    setLeaderHandoffReady(true)
  }, [flagState])

  useEffect(() => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = null
    }

    const entryColors = FLAG_COLORS[flagState]
    if (!entryColors.pulse) {
      setPulseBurstActive(false)
      return
    }

    if (entryColors.pulseBurstMs > 0) {
      setPulseBurstActive(true)
      pulseTimerRef.current = setTimeout(() => {
        setPulseBurstActive(false)
        pulseTimerRef.current = null
      }, entryColors.pulseBurstMs)
      return
    }

    setPulseBurstActive(true)
  }, [flagState])

  const colors = FLAG_COLORS[flagState]
  const duration = getTransitionDuration(flagState)
  const leaderTeamName = leaderDriverNumber != null ? getDriver(leaderDriverNumber)?.team_name ?? null : null
  const leaderPalette = resolveTeamPalette(leaderTeamName, leaderColor)
  const applyLeaderTint = flagState === 'GREEN' && leaderColorMode && !!leaderColor && leaderHandoffReady

  let fill: string = colors.background
  let fillSecondary: string | null = null
  if (applyLeaderTint && leaderPalette) {
    const primary = blendHex(colors.background, leaderPalette.primary, 0.2)
    const secondary = leaderPalette.secondary
      ? blendHex(colors.background, leaderPalette.secondary, 0.2)
      : null
    fill = primary
    fillSecondary = secondary
  }

  const gradientAlpha = flagState === 'NONE' ? 0.08 : flagState === 'GREEN' ? 0.42 : 0.34
  const effectiveBackground = fillSecondary
    ? `linear-gradient(90deg, ${withAlpha(fill, gradientAlpha)} 0%, ${withAlpha(fill, gradientAlpha)} 58%, ${withAlpha(fillSecondary, gradientAlpha)} 100%)`
    : withAlpha(fill, gradientAlpha)

  const pulseOpacity = pulseBurstActive ? (colors.pulseHz === 1 ? 0.18 : 0.12) : 0

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: transitionY + tailFadePx,
        pointerEvents: 'none',
        background: effectiveBackground,
        transition: `background ${duration} ease`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: withAlpha(colors.glow, pulseOpacity),
          transition: 'background 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.06) 42%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.08) 76%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: tailFadePx,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 100%)',
        }}
      />
    </div>
  )
}