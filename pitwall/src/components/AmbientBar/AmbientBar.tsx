import { useEffect, useRef, useState } from 'react'
import { useAmbientStore } from '../../store/ambientStore'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { resolveTeamPalette } from '../../lib/teamPalette'
import { FLAG_COLORS, getFlagLabel, getTransitionDuration } from './flagStateMachine'
import { ToastQueue } from './ToastQueue'
import { NextRaceDisplay } from './NextRaceDisplay'

// Inject keyframe animations once
const STYLE_ID = 'ambient-bar-keyframes-v3'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes ambientPulse1hz {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    @keyframes ambientPulse05hz {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }
    @keyframes glowLinePulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

// Blend two hex colors toward a tint at a given ratio
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

// Convert hex/rgb colors into rgba with a target alpha.
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

type MsgPhase = 'idle' | 'in' | 'hold' | 'out'

type AmbientBarProps = {
  embedded?: boolean
  toolbar?: boolean
  transparentBackground?: boolean
}

export function AmbientBar({ embedded = false, toolbar = false, transparentBackground = false }: AmbientBarProps) {
  const flagState      = useAmbientStore((s) => s.flagState)
  const leaderColorMode = useAmbientStore((s) => s.leaderColorMode)
  const leaderColor    = useAmbientStore((s) => s.leaderColor)
  const leaderDriverNumber = useAmbientStore((s) => s.leaderDriverNumber)
  const toasts         = useAmbientStore((s) => s.toasts)
  const bannerMessage  = useAmbientStore((s) => s.bannerMessage)
  const appMode        = useSessionStore((s) => s.mode)
  const getDriver      = useDriverStore((s) => s.getDriver)

  // In-bar message animation state
  const [msgText, setMsgText]   = useState('')
  const [msgPhase, setMsgPhase] = useState<MsgPhase>('idle')
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const greenHandoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leaderHandoffReady, setLeaderHandoffReady] = useState(flagState !== 'GREEN')
  const [pulseBurstActive, setPulseBurstActive] = useState(false)

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
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

  // Start animation whenever a new banner message arrives
  useEffect(() => {
    if (!bannerMessage) return

    // Clear any in-flight timers from the previous message
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setMsgText(bannerMessage.text)
    setMsgPhase('in')

    timersRef.current = [
      setTimeout(() => setMsgPhase('hold'), 300),
      setTimeout(() => setMsgPhase('out'),  2300),
      setTimeout(() => { setMsgPhase('idle'); setMsgText('') }, 2900),
    ]
  }, [bannerMessage?.id]) // re-run only when a new event fires

  // GREEN should show first, then hand off to leader color to avoid mixed states.
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

  // Pulse burst behavior: pulse at entry for certain flags, then settle to solid.
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

  const colors   = FLAG_COLORS[flagState]
  const label    = getFlagLabel(flagState)
  const duration = getTransitionDuration(flagState)

  const applyLeaderTint = flagState === 'GREEN' && leaderColorMode && !!leaderColor && leaderHandoffReady
  const leaderTeamName = leaderDriverNumber != null ? getDriver(leaderDriverNumber)?.team_name ?? null : null
  const leaderPalette = resolveTeamPalette(leaderTeamName, leaderColor)
  const leaderPrimaryBlend = applyLeaderTint && leaderPalette
    ? blendHex(colors.background, leaderPalette.primary, 0.2)
    : null
  const leaderSecondaryBlend = applyLeaderTint && leaderPalette?.secondary
    ? blendHex(colors.background, leaderPalette.secondary, 0.2)
    : null

  // Background — possibly tinted by leader palette in GREEN mode
  let bgFill: string = colors.background
  if (leaderPrimaryBlend && leaderPalette) {
    if (leaderSecondaryBlend) {
      bgFill = `linear-gradient(90deg, ${leaderPrimaryBlend} 0%, ${leaderPrimaryBlend} 58%, ${leaderSecondaryBlend} 100%)`
    } else {
      bgFill = leaderPrimaryBlend
    }
  }

  // Pulse animation
  let pulseAnimation: string | undefined
  if (colors.pulse && pulseBurstActive) {
    pulseAnimation = colors.pulseHz === 1
      ? 'ambientPulse1hz 1s ease-in-out infinite'
      : 'ambientPulse05hz 2s ease-in-out infinite'
  }

  // Message text visibility
  const msgVisible = msgPhase === 'in' || msgPhase === 'hold'
  const msgOpacity = msgPhase === 'hold' ? 1 : 0
  const msgY       = msgPhase === 'in' ? '6px' : '0px'
  const compact = embedded || toolbar
  const embeddedBgAlpha = toolbar
    ? (flagState === 'GREEN' ? 0.42 : flagState === 'NONE' ? 0.05 : flagState === 'CALM' ? 0.10 : flagState === 'WAITING_FOR_START' ? 0.22 : 0.34)
    : (flagState === 'GREEN' ? 0.64 : flagState === 'NONE' ? 0.07 : flagState === 'CALM' ? 0.14 : flagState === 'WAITING_FOR_START' ? 0.32 : 0.5)

  const textColor = applyLeaderTint
    ? (leaderPalette?.secondary ?? leaderPalette?.primary ?? colors.text)
    : colors.text

  // Keep the flag swatch semantically green even when leader colors are active.
  const swatchBackground =
    colors.flagColor === 'transparent' ? 'var(--border2)' : colors.flagColor

  const compactBackground = compact
    ? (leaderPrimaryBlend
        ? (leaderSecondaryBlend
          ? `linear-gradient(90deg, ${withAlpha(leaderPrimaryBlend, embeddedBgAlpha)} 0%, ${withAlpha(leaderPrimaryBlend, embeddedBgAlpha)} 58%, ${withAlpha(leaderSecondaryBlend, embeddedBgAlpha)} 100%)`
            : withAlpha(leaderPrimaryBlend, embeddedBgAlpha))
        : withAlpha(bgFill, embeddedBgAlpha))
    : bgFill

  const hideFlagBadge = flagState === 'NONE'
  const showToolbarWordmark = toolbar && hideFlagBadge && !msgText

  return (
    <div
      style={{
        position: 'relative',
        height: toolbar ? '100%' : embedded ? 28 : 50,
        width: '100%',
        background: transparentBackground ? 'transparent' : compactBackground,
        border: undefined,
        borderRadius: toolbar ? 0 : embedded ? 4 : 0,
        transition: `background ${duration} ease, border-color ${duration} ease`,
        display: 'flex',
        alignItems: 'center',
        paddingInline: toolbar ? 14 : embedded ? 8 : 16,
        gap: compact ? 8 : 12,
        flexShrink: 0,
        animation: compact ? undefined : pulseAnimation,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Inline next-race countdown — only in live mode and non-active-race flag states */}
      {!compact && appMode === 'live' && (flagState === 'NONE' || flagState === 'CALM' || flagState === 'WAITING_FOR_START') && (
        <NextRaceDisplay />
      )}
      {!hideFlagBadge && flagState !== 'CALM' && (
        <>
          {/* Flag swatch */}
          <div style={{
            width: compact ? 18 : 24,
            height: compact ? 12 : 16,
            borderRadius: 2,
            background: swatchBackground,
            flexShrink: 0,
            boxShadow: colors.flagColor !== 'transparent' ? `0 0 8px ${colors.glow}66` : undefined,
            transition: `background ${duration} ease`,
            position: 'relative',
            zIndex: 1,
          }} />

          {/* Flag state label — fades out when a message is showing */}
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: compact ? 8 : 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: textColor,
            transition: `color ${duration} ease, opacity 0.2s ease`,
            opacity: msgVisible ? 0 : 1,
            userSelect: 'none',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
          }}>
            {label}
          </span>
        </>
      )}

      {/* In-bar animated event message */}
      {msgText && (
        <span style={{
          position: 'absolute',
          left: hideFlagBadge ? (compact ? 8 : 16) : (compact ? 36 : 52),
          fontFamily: 'var(--mono)',
          fontSize: compact ? 8 : 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: textColor,
          opacity: msgOpacity,
          transform: `translateY(${msgY})`,
          transition: `opacity ${msgPhase === 'out' ? '0.6s ease-in' : '0.3s ease-out'}, transform 0.3s ease-out`,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          maxWidth: compact ? 'calc(100% - 40px)' : 'calc(100% - 120px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          zIndex: 1,
        }}>
          {msgText}
        </span>
      )}

      {showToolbarWordmark && (
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 0,
            fontFamily: 'var(--cond)',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            color: 'var(--white)',
            opacity: 0.86,
            userSelect: 'none',
            whiteSpace: 'nowrap',
            zIndex: 1,
          }}
        >
          <span>PIT</span>
          <span style={{ color: 'var(--red)' }}>W</span>
          <span>ALL</span>
        </div>
      )}

      {/* Dev/system toast queue — only for addToast() calls, not flag events */}
      {!compact && (
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <ToastQueue toasts={toasts} />
        </div>
      )}

      {/* Bottom glow line — thicker for active states, hairline for idle */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: flagState === 'NONE' ? 1 : flagState === 'CALM' ? 1 : 1.5,
        background: (applyLeaderTint && leaderPalette)
          ? (leaderPalette.secondary
              ? `linear-gradient(90deg, transparent 0%, ${withAlpha(leaderPalette.primary, 0.52)} 26%, ${leaderPalette.primary} 42%, ${leaderPalette.secondary} 58%, ${withAlpha(leaderPalette.secondary, 0.52)} 74%, transparent 100%)`
              : `linear-gradient(90deg, transparent 0%, ${withAlpha(leaderPalette.primary, 0.52)} 30%, ${leaderPalette.primary} 50%, ${withAlpha(leaderPalette.primary, 0.52)} 70%, transparent 100%)`)
          : colors.flagColor === 'transparent'
          ? 'var(--border)'
          : `linear-gradient(90deg, transparent 0%, ${colors.glow}88 30%, ${colors.glow} 50%, ${colors.glow}88 70%, transparent 100%)`,
        transition: `background ${duration} ease, height ${duration} ease`,
        animation: !compact && colors.pulse ? 'glowLinePulse 1s ease-in-out infinite' : undefined,
        zIndex: 1,
      }} />
    </div>
  )
}
