import { memo, useEffect } from 'react'
import { useAmbientStore } from '../../store/ambientStore'
import { useDriverStore } from '../../store/driverStore'
import { resolveTeamPalette } from '../../lib/teamPalette'
import { FLAG_COLORS, getTransitionDuration } from '../AmbientBar/flagStateMachine'

// Inject keyframe animations for the edge glow layer (once per page load)
const STYLE_ID = 'ambient-race-layer-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes ambientLayerPulse1hz {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
    @keyframes ambientLayerPulse05hz {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
  `
  document.head.appendChild(style)
}

// Parse a hex color into [r, g, b] integers
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (h.length !== 6) return null
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

// Build "r,g,b" string from a hex color, with a fallback
function rgbStr(hex: string, fallback = '255,255,255'): string {
  const parsed = hexToRgb(hex)
  return parsed ? `${parsed[0]},${parsed[1]},${parsed[2]}` : fallback
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

export const AmbientRaceLayer = memo(function AmbientRaceLayer() {
  const flagState        = useAmbientStore((s) => s.flagState)
  const leaderColorMode  = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor      = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const enabled          = useAmbientStore((s) => s.ambientLayerEnabled)
  const intensity        = useAmbientStore((s) => s.ambientLayerIntensity)
  const getDriver        = useDriverStore((s) => s.getDriver)

  // Keep document from flickering when intensity changes
  useEffect(() => {}, [intensity])

  const isActive = enabled && flagState !== 'NONE'
  const colors   = FLAG_COLORS[flagState]
  const duration = getTransitionDuration(flagState)
  const leaderTeamName = leaderDriverNumber != null ? getDriver(leaderDriverNumber)?.team_name ?? null : null
  const leaderPalette = resolveTeamPalette(leaderTeamName, leaderColor)

  // Intensity scalar: at default 40 the effect is subtle; at 100 it's vivid.
  // Tint max opacity: ~6% at full intensity. Glow max: ~40% at full intensity.
  const scalar         = intensity / 100
  const tintOpacity    = isActive ? scalar * 0.06  : 0
  const glowOpacity    = isActive ? scalar * 0.40  : 0

  // Use a team palette for GREEN + leaderColorMode, else the flag color set.
  const leaderModeActive = isActive && flagState === 'GREEN' && leaderColorMode && !!leaderPalette
  const primaryBg = leaderModeActive && leaderPalette
    ? blendHex(colors.background, leaderPalette.primary, 0.2)
    : colors.background
  const secondaryBg = leaderModeActive && leaderPalette?.secondary
    ? blendHex(colors.background, leaderPalette.secondary, 0.2)
    : null
  const glowPrimary = leaderModeActive && leaderPalette ? leaderPalette.primary : colors.glow
  const glowSecondary = leaderModeActive ? leaderPalette?.secondary ?? null : null

  const tintRgb = rgbStr(primaryBg)
  const glowRgb = rgbStr(glowPrimary)

  // Pulse animation for the edge glow layer
  let pulseAnimation: string | undefined
  if (isActive && colors.pulse) {
    pulseAnimation = colors.pulseHz === 1
      ? 'ambientLayerPulse1hz 1s ease-in-out infinite'
      : 'ambientLayerPulse05hz 2s ease-in-out infinite'
  }

  // Spread / blur parameters — tuned to look natural at typical 1080p+ screens
  const insetBlur   = 120
  const insetSpread = 20
  const edgeGlow    = `inset 0 0 ${insetBlur}px ${insetSpread}px rgba(${glowRgb},${glowOpacity})`

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        // Transitions: RED is fast (200ms), everything else uses flagStateMachine timing
        transition: `opacity ${flagState === 'RED' ? '0.2s' : duration} ease`,
      }}
    >
      {/* Layer 1 — very subtle background tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: secondaryBg
            ? `linear-gradient(120deg, ${withAlpha(primaryBg, tintOpacity)} 0%, ${withAlpha(primaryBg, tintOpacity)} 58%, ${withAlpha(secondaryBg, tintOpacity)} 100%)`
            : `rgba(${tintRgb},${tintOpacity})`,
          transition: `background ${flagState === 'RED' ? '0.2s' : duration} ease`,
        }}
      />

      {/* Layer 2 — screen-edge inset glow (animated when pulse is active) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: glowSecondary
            ? `inset 0 0 ${insetBlur}px ${insetSpread}px rgba(${rgbStr(glowPrimary)},${glowOpacity}), inset 0 0 ${Math.round(insetBlur * 0.85)}px ${Math.round(insetSpread * 0.7)}px rgba(${rgbStr(glowSecondary)},${Math.min(glowOpacity, 0.26)})`
            : edgeGlow,
          transition: `box-shadow ${flagState === 'RED' ? '0.2s' : duration} ease`,
          animation: pulseAnimation,
        }}
      />
    </div>
  )
})
