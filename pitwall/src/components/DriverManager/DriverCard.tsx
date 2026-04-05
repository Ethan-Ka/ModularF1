import { useEffect, useRef, useState } from 'react'
import type { OpenF1Driver } from '../../api/openf1'

interface DriverCardProps {
  driver: OpenF1Driver
  teamColor: string
  position: number | null
  isStarred: boolean
  onToggleStar: () => void
  onSetFocus: () => void
  isCanvasFocus: boolean
  animateIn?: boolean
  animateOut?: boolean
}

interface DriverNumberVariantStyle {
  fontSize: number
  letterSpacing: string
  transform: string
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = color.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function relativeLuma(color: string): number {
  const rgb = parseHexColor(color)
  if (!rgb) return 0.5
  const [r, g, b] = rgb.map((n) => n / 255)
  const [R, G, B] = [r, g, b].map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuma(foreground)
  const l2 = relativeLuma(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function pickAccessibleTextColor(background: string, preferred: string): string {
  if (contrastRatio(preferred, background) >= 4.5) return preferred

  const white = '#F7FAFF'
  const black = '#0B1018'
  return contrastRatio(white, background) >= contrastRatio(black, background) ? white : black
}

function countryCodeToFlagEmoji(countryCode: string | undefined): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return ''
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('')
}

function getDriverNumberVariantStyle(driverNumber: number): DriverNumberVariantStyle {
  const variant = Math.abs(driverNumber) % 5
  if (variant === 0) {
    return {
      fontSize: 12,
      letterSpacing: '0.08em',
      transform: 'translateY(0px) skewX(-8deg)',
    }
  }
  if (variant === 1) {
    return {
      fontSize: 11,
      letterSpacing: '0.06em',
      transform: 'translateY(-0.5px) scaleY(1.04)',
    }
  }
  if (variant === 2) {
    return {
      fontSize: 12,
      letterSpacing: '0.04em',
      transform: 'translateY(0px) scaleX(1.05)',
    }
  }
  if (variant === 3) {
    return {
      fontSize: 11,
      letterSpacing: '0.09em',
      transform: 'translateY(0px) skewX(6deg)',
    }
  }

  return {
    fontSize: 12,
    letterSpacing: '0.05em',
    transform: 'translateY(0px) scale(1.02)',
  }
}

export function DriverCard({
  driver,
  teamColor,
  position,
  isStarred,
  onToggleStar,
  onSetFocus,
  isCanvasFocus,
  animateIn = false,
  animateOut = false,
}: DriverCardProps) {
  const [starPopping, setStarPopping] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const prevStarredRef = useRef(isStarred)

  useEffect(() => {
    if (isStarred && !prevStarredRef.current) {
      setStarPopping(true)
      const timer = setTimeout(() => setStarPopping(false), 240)
      prevStarredRef.current = isStarred
      return () => clearTimeout(timer)
    }

    prevStarredRef.current = isStarred
  }, [isStarred])

  useEffect(() => {
    setImageFailed(false)
  }, [driver.headshot_url])

  const showPhoto = Boolean(driver.headshot_url) && !imageFailed
  const preferredNumberTextColor = driver.number_text_color
    ?? (relativeLuma(teamColor) > 0.33 ? '#0B1018' : '#F7FAFF')
  const numberTextColor = pickAccessibleTextColor('#171A22', preferredNumberTextColor)
  const defaultOutlineColor = relativeLuma(teamColor) > 0.55 ? '#AEB6C799' : '#FFFFFF8A'
  const numberOutlineColor = driver.number_outline_color ?? defaultOutlineColor
  const numberVariantStyle = getDriverNumberVariantStyle(driver.driver_number)
  const countryFlag = countryCodeToFlagEmoji(driver.country_code)
  const showLocalFlag = Boolean(driver.flag_url)
  const showNumberSvg = Boolean(driver.number_svg_url)
  const acronymTextPx = 35
  const numberSvgHeightPx = 24
  const countryBadgeSizePx = 14
  return (
    <div
      onClick={onSetFocus}
      className={[
        'interactive-card',
        animateIn ? 'animated-star-add' : '',
        animateOut ? 'animated-star-remove' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: 148,
        background: isCanvasFocus ? 'var(--bg3)' : 'var(--bg4)',
        border: isCanvasFocus
          ? '0.5px solid rgba(29,184,106,0.6)'
          : '0.5px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Team color bar */}
      <div style={{
        height: 3,
        background: teamColor,
        boxShadow: `0 0 6px ${teamColor}88`,
        transition: 'box-shadow var(--motion-base) ease, background-color var(--motion-base) ease',
      }} />

      <div style={{
        height: 112,
        borderBottom: '0.5px solid var(--border)',
        background: showPhoto
          ? `linear-gradient(180deg, ${teamColor}22 0%, rgba(0,0,0,0) 55%), var(--bg3)`
          : `linear-gradient(135deg, ${teamColor}30 0%, var(--bg3) 70%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {showPhoto ? (
          <img
            src={driver.headshot_url}
            alt={driver.full_name}
            onError={() => setImageFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              imageRendering: 'auto',
              transform: 'translateZ(0) scale(1.01)',
              filter: isCanvasFocus
                ? 'saturate(0.98) contrast(1.01) brightness(1.02)'
                : 'saturate(0.97) contrast(1.01) brightness(1.03)',
            }}
          />
        ) : (
          <span style={{
            fontFamily: 'var(--cond)',
            fontSize: 40,
            letterSpacing: '0.04em',
            color: 'var(--white)',
            opacity: 0.78,
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
            lineHeight: 1,
          }}>
            {driver.name_acronym}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 10px 8px' }}>
        {/* Position badge */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>
            {position != null ? `P${position}` : '—'}
          </span>
          {/* Star icon */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar() }}
            className={starPopping ? 'interactive-button star-pop' : 'interactive-button'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isStarred ? 'var(--gold)' : 'var(--muted2)',
              fontSize: 13,
              lineHeight: 1,
              transition: 'color var(--motion-fast) ease, transform var(--motion-fast) var(--motion-spring)',
            }}
            aria-label={isStarred ? 'Unstar driver' : 'Star driver'}
          >
            {isStarred ? '★' : '☆'}
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'var(--cond)',
            fontSize: acronymTextPx,
            fontWeight: 700,
            letterSpacing: '0.02em',
            lineHeight: 1,
            color: 'var(--white)',
          }}>
            {driver.name_acronym}
          </span>
          {showNumberSvg ? (
            <img
              src={driver.number_svg_url}
              alt={`${driver.driver_number}`}
              style={{
                marginLeft: 'auto',
                width: 'auto',
                height: numberSvgHeightPx,
                maxHeight: numberSvgHeightPx,
                maxWidth: 64,
                objectFit: 'contain',
                imageRendering: 'auto',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35)) saturate(1.02)',
              }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--driver-number, var(--mono))',
              fontSize: Math.max(16, numberVariantStyle.fontSize + 6),
              fontWeight: 700,
              color: numberTextColor,
              marginLeft: 'auto',
              letterSpacing: numberVariantStyle.letterSpacing,
              lineHeight: 1,
              textShadow: `0 0 0.6px ${numberOutlineColor}, 0 1px 2px rgba(0,0,0,0.45)`,
              transform: numberVariantStyle.transform,
              transformOrigin: 'left center',
              opacity: 0.98,
            }}>
              {driver.driver_number}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 2,
        }}>
          {showLocalFlag ? (
            <span
              style={{
                width: countryBadgeSizePx,
                height: countryBadgeSizePx,
                borderRadius: '50%',
                border: '0.5px solid rgba(255,255,255,0.15)',
                overflow: 'hidden',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={driver.flag_url}
                alt={driver.country_code ? `${driver.country_code} flag` : 'Country flag'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </span>
          ) : countryFlag ? (
            <span
              style={{
                width: countryBadgeSizePx,
                height: countryBadgeSizePx,
                borderRadius: '50%',
                border: '0.5px solid rgba(255,255,255,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                fontSize: 8,
                flexShrink: 0,
              }}
            >
              {countryFlag}
            </span>
          ) : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{driver.full_name}</span>
        </div>

      </div>

      {/* Canvas focus indicator */}
      {isCanvasFocus && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'var(--green)',
          boxShadow: '0 0 6px var(--green)',
          animation: 'fadeInUp var(--motion-fast) var(--motion-spring) both',
        }} />
      )}
    </div>
  )
}
