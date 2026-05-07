export const HELP = `# Race Control Feed

Chronological log of official race director messages — flags, safety cars, incidents, and DRS decisions.

- **Timestamp**: UTC time the message was issued.
- **Category badge**: A short tag classifying the message type: *SC* (Safety Car), *INC* (Incident), *DRS*, *INF* (general information).
- **Flag indicator**: A color-coded rectangle matching the flag shown: red, yellow, double-yellow, green, safety car orange, chequered, etc.
- **Message**: The full official race control text.

Unfamiliar terms:

- *SC*: Safety Car — deployed to neutralise the race after an incident. All cars must slow to the safety car's pace.
- *VSC*: Virtual Safety Car — a slower neutralisation than a full SC; cars maintain a target delta time without bunching behind a physical car.
- *DRS enabled / disabled*: Race control authorisation to open or close DRS zones, typically after a SC period ends.
- *Double yellow*: A caution requiring drivers to slow significantly — danger on track, be ready to stop.

Notes: messages arrive in real time from FastF1 timing data. The feed auto-scrolls to the most recent entry.
`
import { useRaceControl } from '../../hooks/useRaceControl'
import type { OpenF1RaceControl } from '../../api/openf1'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

interface RaceControlFeedProps {
  widgetId: string
}

function getFlagColor(flag: string | null): string {
  if (!flag) return 'var(--muted)'
  const f = flag.toUpperCase()
  if (f === 'RED') return 'var(--red)'
  if (f === 'YELLOW' || f === 'DOUBLE YELLOW') return '#FFD600'
  if (f === 'GREEN' || f === 'SC ENDING' || f === 'VSC ENDING') return 'var(--green)'
  if (f === 'CHEQUERED') return 'var(--white)'
  if (f === 'SC DEPLOYED') return '#FFA500'
  if (f === 'VSC DEPLOYED') return 'var(--amber)'
  return 'var(--muted)'
}

function getCategoryBadge(category: string): { label: string; color: string } | null {
  const c = category?.toUpperCase?.() ?? ''
  if (c === 'FLAG') return null // handled by flag color
  if (c === 'INCIDENT') return { label: 'INC', color: 'var(--amber)' }
  if (c === 'SAFETY_CAR' || c === 'SAFETYCAR') return { label: 'SC', color: '#FFA500' }
  if (c === 'DRS') return { label: 'DRS', color: 'var(--blue)' }
  if (c === 'OTHER') return { label: 'INF', color: 'var(--muted)' }
  return { label: c.slice(0, 3), color: 'var(--muted)' }
}

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

function FlagIcon({ flag }: { flag: string | null }) {
  const color = getFlagColor(flag)
  return (
    <div style={{
      width: 10,
      height: 8,
      borderRadius: 1,
      background: color === 'var(--muted)' ? 'var(--muted2)' : color,
      flexShrink: 0,
      opacity: 0.9,
    }} />
  )
}

function RaceControlRow({ entry }: { entry: OpenF1RaceControl }) {
  const badge = getCategoryBadge(entry.category)
  const flagColor = getFlagColor(entry.flag)
  const isFlag = !!entry.flag

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 10px',
      borderBottom: '0.5px solid var(--border)',
    }}>
      {/* Time */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--muted2)',
        letterSpacing: '0.04em',
        flexShrink: 0,
        marginTop: 1,
      }}>
        {formatTime(entry.date)}
      </span>

      {/* Flag icon or category badge */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: 16 }}>
        {isFlag
          ? <FlagIcon flag={entry.flag} />
          : badge
            ? (
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: badge.color,
                border: `0.5px solid ${badge.color}55`,
                borderRadius: 4,
                padding: '1px 5px',
                background: 'var(--bg4)',
                lineHeight: 1.2,
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 14,
              }}>
                {badge.label}
              </span>
            )
            : null
        }
      </div>

      {/* Message */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: isFlag ? flagColor : 'var(--white)',
        letterSpacing: '0.04em',
        lineHeight: 1.5,
        flex: 1,
        wordBreak: 'break-word',
      }}>
        {entry.message}
      </span>
    </div>
  )
}

export function RaceControlFeed({ widgetId: _ }: RaceControlFeedProps) {
  const { data } = useRaceControl()
  const refreshFade = useRefreshFade([data])

  const entries = data
    ? [...data].reverse().slice(0, 50)
    : []

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
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
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
        }}>
          Race Control
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
        }}>
          {entries.length} messages
        </span>
      </div>

      {/* Messages */}
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
            Waiting for race control messages…
          </div>
        ) : (
          entries.map((entry, i) => (
            <RaceControlRow key={i} entry={entry} />
          ))
        )}
      </SmoothScrollContainer>
    </div>
  )
}
