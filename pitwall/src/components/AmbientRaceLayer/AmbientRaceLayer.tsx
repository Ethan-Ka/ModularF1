import { memo, useEffect, useRef, useState } from 'react'
import { useAmbientStore } from '../../store/ambientStore'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { loadSeasonAmbientPalettes, resolveCountryPalette, resolveTrackPalette } from '../../lib/ambientPalettes'
import { resolveTeamPalette } from '../../lib/teamPalette'
import { FLAG_COLORS, getTransitionDuration } from '../AmbientBar/flagStateMachine'
import { useRefreshFade } from '../../hooks/useRefreshFade'

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
    @keyframes ambientWaveBlob {
      0%   { opacity: 0;    }
      18%  { opacity: 1;    }
      50%  { opacity: 0.12; }
      72%  { opacity: 0.65; }
      100% { opacity: 0;    }
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

// Scattered radial blobs — each pulses independently.
// Durations are prime-ish (no shared factors) so blobs never re-sync.
// Negative delays drop each blob into a different mid-cycle phase immediately,
// preventing the left/right alternating pattern that even-spaced positive delays produce.
const WAVE_BLOBS: Array<{ cx: string; cy: string; rx: string; ry: string; delay: string; dur: string }> = [
  { cx: '18%', cy: '22%', rx: '38%', ry: '45%', delay: '-0.7s',  dur: '3.1s' },
  { cx: '78%', cy: '18%', rx: '32%', ry: '40%', delay: '-2.3s',  dur: '4.7s' },
  { cx: '88%', cy: '65%', rx: '42%', ry: '50%', delay: '-1.4s',  dur: '3.9s' },
  { cx: '22%', cy: '78%', rx: '35%', ry: '42%', delay: '-3.8s',  dur: '5.3s' },
  { cx: '52%', cy: '48%', rx: '48%', ry: '55%', delay: '-1.9s',  dur: '2.8s' },
  { cx: '8%',  cy: '55%', rx: '30%', ry: '38%', delay: '-0.5s',  dur: '4.3s' },
  { cx: '62%', cy: '82%', rx: '36%', ry: '44%', delay: '-3.1s',  dur: '6.1s' },
  { cx: '40%', cy: '12%', rx: '33%', ry: '39%', delay: '-2.7s',  dur: '3.5s' },
]

export const AmbientRaceLayer = memo(function AmbientRaceLayer() {
  const flagState        = useAmbientStore((s) => s.flagState)
  const leaderColorMode  = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor      = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const enabled          = useAmbientStore((s) => s.ambientLayerEnabled)
  const intensity        = useAmbientStore((s) => s.ambientLayerIntensity)
  const waveEnabled      = useAmbientStore((s) => s.ambientLayerWaveEnabled)
  const circuitName      = useSessionStore((s) => s.activeSession?.circuit_short_name ?? null)
  const countryName      = useSessionStore((s) => s.activeSession?.country_name ?? null)
  const sessionYear      = useSessionStore((s) => s.activeSession?.year ?? 2026)
  const getDriver        = useDriverStore((s) => s.getDriver)
  const pulseTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pulseBurstActive, setPulseBurstActive] = useState(false)
  const [seasonPalettes, setSeasonPalettes] = useState<Awaited<ReturnType<typeof loadSeasonAmbientPalettes>>>(null)

  useEffect(() => {
    let cancelled = false
    loadSeasonAmbientPalettes(sessionYear).then((loaded) => {
      if (!cancelled) setSeasonPalettes(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [sessionYear])

  // Keep document from flickering when intensity changes
  useEffect(() => {}, [intensity])

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

  const isActive = enabled && flagState !== 'NONE'
  const colors   = FLAG_COLORS[flagState]
  const duration = getTransitionDuration(flagState)
  const waveRefreshFade = useRefreshFade([
    flagState,
    waveEnabled,
    enabled,
    intensity,
    leaderColorMode,
    leaderColor,
  ])
  const leaderDriver = leaderDriverNumber != null ? getDriver(leaderDriverNumber) : undefined
  const leaderTeamName = leaderDriver?.team_name ?? null
  const leaderCountryCode = leaderDriver?.country_code ?? null
  const leaderCountryName = leaderDriver?.nationality ?? null
  const leaderPalette = resolveTeamPalette(leaderTeamName, leaderColor)
  const trackPalette = resolveTrackPalette(seasonPalettes, circuitName, countryName)
  const anthemCountryPalette = resolveCountryPalette(seasonPalettes, leaderCountryCode, leaderCountryName)
  const anthemPalette = anthemCountryPalette ?? resolveCountryPalette(seasonPalettes, null, countryName) ?? trackPalette
  const specialPalette = flagState === 'NATIONAL_ANTHEM'
    ? anthemPalette
    : flagState === 'WAITING_FOR_START'
      ? trackPalette
      : null
  const specialModeActive = isActive && !!specialPalette
  const anthemModeActive = flagState === 'NATIONAL_ANTHEM' && !!anthemPalette

  // Intensity scalar: at default 40 the effect is subtle; at 100 it's vivid.
  // Tint max opacity: ~6% at full intensity. Glow max: ~40% at full intensity.
  const scalar         = intensity / 100
  const tintOpacity    = isActive ? scalar * 0.06  : 0
  const glowOpacity    = isActive ? scalar * 0.40  : 0

  // Use a team palette for GREEN + leaderColorMode, else the flag color set.
  const leaderModeActive = isActive && flagState === 'GREEN' && leaderColorMode && !!leaderPalette
  const primaryBg = leaderModeActive && leaderPalette
    ? blendHex(colors.background, leaderPalette.primary, 0.2)
    : specialModeActive && specialPalette
      ? blendHex(colors.background, specialPalette.primary, anthemModeActive ? 0.5 : 0.36)
    : colors.background
  const secondaryBg = leaderModeActive && leaderPalette?.secondary
    ? blendHex(colors.background, leaderPalette.secondary, 0.2)
    : specialModeActive && specialPalette
      ? blendHex(colors.background, specialPalette.secondary, anthemModeActive ? 0.44 : 0.3)
    : null
  const glowPrimary = leaderModeActive && leaderPalette
    ? leaderPalette.primary
    : specialModeActive && specialPalette
      ? specialPalette.primary
      : colors.glow
  const glowSecondary = leaderModeActive
    ? leaderPalette?.secondary ?? null
    : specialModeActive && specialPalette
      ? specialPalette.secondary
      : null

  const wavePalette = specialModeActive && specialPalette ? specialPalette.wave : colors.waveColors
  const waveOpacityScale = flagState === 'WAITING_FOR_START' ? 0.09 : flagState === 'NATIONAL_ANTHEM' ? 0.12 : 0.18

  const tintRgb = rgbStr(primaryBg)
  const glowRgb = rgbStr(glowPrimary)

  // Pulse animation for the edge glow layer
  let pulseAnimation: string | undefined
  if (isActive && colors.pulse && pulseBurstActive) {
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
            ? `linear-gradient(90deg, ${withAlpha(primaryBg, tintOpacity)} 0%, ${withAlpha(primaryBg, tintOpacity)} 58%, ${withAlpha(secondaryBg, tintOpacity)} 100%)`
            : `rgba(${tintRgb},${tintOpacity})`,
          transition: `background ${flagState === 'RED' ? '0.2s' : duration} ease`,
        }}
      />

      {/* Layer 1.5 — flag-wave blobs: scattered radial glimmers that pulse out of phase */}
      {waveEnabled && colors.flagWave && isActive && (
        <div
          className={waveRefreshFade ? 'flag-wave-refresh-fade' : undefined}
          style={{
            position: 'absolute',
            // Expand beyond viewport so large radial blobs don't clip at edges.
            inset: '-14%',
          }}
        >
          {WAVE_BLOBS.map((b, i) => {
            const palette = wavePalette
            const blobHex = palette.length > 0 ? palette[i % palette.length] : glowPrimary
            const blobRgb = rgbStr(blobHex)
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(ellipse ${b.rx} ${b.ry} at ${b.cx} ${b.cy}, rgba(${blobRgb},${scalar * waveOpacityScale}), transparent 100%)`,
                  animation: `ambientWaveBlob ${b.dur} ease-in-out ${b.delay} infinite`,
                }}
              />
            )
          })}
        </div>
      )}

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
