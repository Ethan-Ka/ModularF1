export const HELP = `# Driver Radio

Per-driver team radio feed — shows only messages from the focused or pinned driver, with audio playback.

- **Driver context**: Uses the same Focus/Pinned/Position selector as other driver widgets.
- **Play button**: Tap to hear a transmission; tap again to stop.
- **Timestamp**: UTC time of each transmission.
- **Live badge**: Shown when actively receiving data from the timing feed.

Requires live mode and F1TV authentication.
`
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTeamRadio } from '../../hooks/useTeamRadio'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import type { LiveTeamRadio } from '../../api/liveTimingBridge'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  } catch {
    return '—'
  }
}

function PlayIcon() {
  return (
    <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
      <polygon points="0,0 8,4.5 0,9" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
      <rect x="0" y="0" width="3" height="9" />
      <rect x="5" y="0" width="3" height="9" />
    </svg>
  )
}

interface RadioRowProps {
  entry: LiveTeamRadio
  isPlaying: boolean
  onToggle: (url: string) => void
}

function RadioRow({ entry, isPlaying, onToggle }: RadioRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 8px',
      borderBottom: '0.5px solid var(--border)',
      background: isPlaying ? 'rgba(232, 100, 138, 0.07)' : 'transparent',
    }}>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--muted2)',
        letterSpacing: '0.04em',
        flexShrink: 0,
        width: 52,
      }}>
        {formatTime(entry.date)}
      </span>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => onToggle(entry.recording_url)}
        style={{
          background: isPlaying ? 'var(--pink)' : 'rgba(255,255,255,0.07)',
          border: 'none',
          borderRadius: 3,
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isPlaying ? '#fff' : 'var(--muted2)',
          flexShrink: 0,
          transition: 'background 140ms ease, color 140ms ease',
        }}
        title={isPlaying ? 'Pause' : 'Play radio message'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  )
}

export function DriverRadio({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const mode = useSessionStore((s) => s.mode)
  const f1tvAuthenticated = useSessionStore((s) => s.f1tvAuthenticated)

  const { data } = useTeamRadio(driverNumber ?? undefined)
  const refreshFade = useRefreshFade([data])

  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingUrl(null)
  }, [])

  const togglePlay = useCallback((url: string) => {
    if (playingUrl === url) {
      stopAudio()
      return
    }
    stopAudio()
    const audio = new Audio(url)
    audio.addEventListener('ended', stopAudio)
    audio.addEventListener('error', stopAudio)
    audioRef.current = audio
    audio.play().catch(stopAudio)
    setPlayingUrl(url)
  }, [playingUrl, stopAudio])

  useEffect(() => () => stopAudio(), [stopAudio])

  const driver = driverNumber ? getDriver(driverNumber) : null
  const color = driverNumber ? getTeamColor(driverNumber) : 'var(--muted)'
  const entries = data ? [...data].reverse() : []
  const isLiveAndAuth = mode === 'live' && f1tvAuthenticated

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '4px 8px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg4)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 3,
          height: 14,
          background: color,
          borderRadius: 1,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--cond)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--white)',
          letterSpacing: '0.04em',
        }}>
          {driver?.name_acronym ?? (driverNumber ? `#${driverNumber}` : 'No Driver')}
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
        }}>
          {entries.length} msg
        </span>

        {playingUrl ? (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--pink)',
            letterSpacing: '0.08em',
          }}>
            ▶ playing
          </span>
        ) : isLiveAndAuth ? (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 6,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pink)',
            border: '0.5px solid rgba(232, 100, 138, 0.4)',
            borderRadius: 2,
            padding: '1px 4px',
          }}>
            live
          </span>
        ) : null}
      </div>

      <SmoothScrollContainer style={{ flex: 1 }}>
        {!isLiveAndAuth ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
            textAlign: 'center',
            padding: '0 16px',
          }}>
            {mode !== 'live' ? 'Live mode required' : 'F1TV login required'}
          </div>
        ) : !driverNumber ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
          }}>
            No driver selected
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
          }}>
            No radio yet
          </div>
        ) : (
          entries.map((entry, i) => (
            <RadioRow
              key={`${entry.driver_number}-${entry.date}-${i}`}
              entry={entry}
              isPlaying={playingUrl === entry.recording_url}
              onToggle={togglePlay}
            />
          ))
        )}
      </SmoothScrollContainer>
    </div>
  )
}
