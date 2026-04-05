import { useAmbientStore } from '../../store/ambientStore'
import { FLAG_COLORS } from './flagStateMachine'

const STYLE_ID = 'ambient-top-chrome-wave-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes ambientTopChromeWaveBlob {
      0%   { opacity: 0;    }
      18%  { opacity: 1;    }
      50%  { opacity: 0.12; }
      72%  { opacity: 0.65; }
      100% { opacity: 0;    }
    }
  `
  document.head.appendChild(style)
}

const WAVE_BLOBS: Array<{ cx: string; cy: string; rx: string; ry: string; delay: string; dur: string }> = [
  { cx: '8%',  cy: '50%', rx: '26%', ry: '90%', delay: '-0.7s', dur: '3.1s' },
  { cx: '24%', cy: '50%', rx: '24%', ry: '86%', delay: '-2.3s', dur: '4.7s' },
  { cx: '40%', cy: '50%', rx: '28%', ry: '92%', delay: '-1.4s', dur: '3.9s' },
  { cx: '56%', cy: '50%', rx: '26%', ry: '90%', delay: '-3.8s', dur: '5.3s' },
  { cx: '72%', cy: '50%', rx: '24%', ry: '86%', delay: '-1.9s', dur: '2.8s' },
  { cx: '88%', cy: '50%', rx: '28%', ry: '92%', delay: '-0.5s', dur: '4.3s' },
]

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

export interface TopChromeWaveLayerProps {
  transitionY: number
  tailFadePx: number
}

export function TopChromeWaveLayer({ transitionY, tailFadePx }: TopChromeWaveLayerProps) {
  const flagState = useAmbientStore((s) => s.flagState)
  const waveEnabled = useAmbientStore((s) => s.ambientLayerWaveEnabled)

  const colors = FLAG_COLORS[flagState]
  if (!waveEnabled || !colors.flagWave || colors.waveColors.length === 0) return null

  const waveSpeedScale = colors.waveSpeed > 0 ? colors.waveSpeed / 2.4 : 1

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: transitionY + tailFadePx,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        // Fade the wave layer out before it reaches the canvas region.
        maskImage: `linear-gradient(180deg, black 0px, black ${transitionY}px, transparent ${transitionY + tailFadePx}px)`,
        WebkitMaskImage: `linear-gradient(180deg, black 0px, black ${transitionY}px, transparent ${transitionY + tailFadePx}px)`,
      }}
    >
      {WAVE_BLOBS.map((blob, i) => {
        const blobColor = colors.waveColors[i % colors.waveColors.length]
        const dur = Number.parseFloat(blob.dur) * waveSpeedScale
        return (
          <div
            key={`${blob.cx}-${blob.cy}-${i}`}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse ${blob.rx} ${blob.ry} at ${blob.cx} ${blob.cy}, ${withAlpha(blobColor, 0.055)} 0%, transparent 100%)`,
              animation: `ambientTopChromeWaveBlob ${dur}s ease-in-out ${blob.delay} infinite`,
            }}
          />
        )
      })}
    </div>
  )
}