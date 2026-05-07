export const HELP = `# Radio Feed (Text)

Scrolling transcript of team radio messages for all drivers, in chronological order.

- **Timestamp**: UTC time the radio message was received.
- **Driver chip**: Team-colour badge showing the driver's three-letter code.
- **Message text**: Decoded text of the radio transmission.

Unfamiliar terms:

- *Team radio*: Voice communication between driver and race engineer during a session. The FIA releases selected recordings via the official timing feed.
- *Race engineer (RE)*: The team member who talks to the driver — strategy updates, competitor gaps, and technical feedback all come through the RE.

Notes: radio text is transcribed from audio by OpenF1 — transcription accuracy varies and some messages may be incomplete or missing. The feed is read-only and does not support audio playback. Messages are shown for all drivers; use the Radio Scanner widget to see activity levels at a glance.
`
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTeamRadio } from '../../hooks/useTeamRadio'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import type { OpenF1TeamRadio } from '../../api/openf1'
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

function DriverChip({ driverNumber }: { driverNumber: number }) {
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const driver = getDriver(driverNumber)
  const color = getTeamColor(driverNumber)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{
        width: 3,
        height: 16,
        background: color,
        borderRadius: 1,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--white)',
        letterSpacing: '0.06em',
        minWidth: 24,
      }}>
        {driver?.name_acronym ?? `#${driverNumber}`}
      </span>
    </div>
  )
}

interface RadioRowProps {
  entry: OpenF1TeamRadio
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
        width: 46,
      }}>
        {formatTime(entry.date)}
      </span>

      <DriverChip driverNumber={entry.driver_number} />

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

interface RadioFeedTextProps {
  widgetId: string
}

export function RadioFeedText({ widgetId: _ }: RadioFeedTextProps) {
  const { data } = useTeamRadio()
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

  const entries = data ? [...data].reverse() : []

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
      {/* Header */}
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
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--pink)',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
        }}>
          Radio Feed
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
        }}>
          {entries.length} messages
        </span>
        {playingUrl && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--pink)',
            marginLeft: 'auto',
            letterSpacing: '0.08em',
          }}>
            ▶ playing
          </span>
        )}
      </div>

      {/* Feed */}
      <SmoothScrollContainer style={{ flex: 1 }}>
        {entries.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
          }}>
            Waiting for radio messages…
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
