export const HELP = `# Radio Scanner

Activity monitor for team radio — shows which drivers have been on the radio recently and how active they are.

- **Driver row**: Driver code and team colour bar.
- **Radio count**: Total number of radio messages from this driver in the session.
- **Last activity**: Timestamp of the most recent transmission.
- **Relative time**: How long ago the last radio was received (e.g., "now", "30 s ago").
- **Pulse highlight**: Drivers with recent activity pulse briefly to draw attention.

Unfamiliar terms:

- *Team radio*: Voice communications between a driver and their race engineer, officially broadcast via the FIA timing feed. Includes strategy calls, car feedback, and driver queries.
- *Race engineer (RE)*: The team member who communicates with the driver during a session, relaying strategy, competitor information, and car status.

Notes: requires live mode and F1TV authentication. Not all transmissions are broadcast publicly — coverage varies by session. Use Radio Feed (Text) or Driver Radio to play audio.
`
import { useMemo } from 'react'
import { useTeamRadio } from '../../hooks/useTeamRadio'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { SmoothScrollContainer } from '../../components/SmoothScrollContainer'

interface DriverActivity {
  driverNumber: number
  count: number
  lastDate: string
  lastMs: number
}

function formatRelativeTime(ms: number, now: number): string {
  const diffS = Math.floor((now - ms) / 1000)
  if (diffS < 5) return 'now'
  if (diffS < 60) return `${diffS}s ago`
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  return `${diffH}h ago`
}

interface ScannerCardProps {
  activity: DriverActivity
  now: number
}

function ScannerCard({ activity, now }: ScannerCardProps) {
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)

  const driver = getDriver(activity.driverNumber)
  const color = getTeamColor(activity.driverNumber)
  const ageMs = now - activity.lastMs
  const isRecent = ageMs < 120_000

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 8px',
      borderBottom: '0.5px solid var(--border)',
      background: isRecent ? 'rgba(232, 100, 138, 0.05)' : 'transparent',
      position: 'relative',
    }}>
      {/* Team color bar */}
      <div style={{
        width: 3,
        height: 28,
        borderRadius: 1,
        background: color,
        flexShrink: 0,
      }} />

      {/* Active pulse ring */}
      {isRecent && (
        <div
          className="floating-pulse"
          style={{
            position: 'absolute',
            left: 5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 7,
            height: 7,
            borderRadius: '50%',
            border: '1.5px solid var(--pink)',
            opacity: 0.7,
          }}
        />
      )}

      {/* Driver abbreviation + number */}
      <div style={{ minWidth: 32 }}>
        <div style={{
          fontFamily: 'var(--cond)',
          fontSize: 14,
          fontWeight: 700,
          color: isRecent ? 'var(--white)' : 'var(--muted2)',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}>
          {driver?.name_acronym ?? `#${activity.driverNumber}`}
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}>
          {driver ? `#${driver.driver_number}` : ''}
        </div>
      </div>

      {/* Message count */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 24,
      }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 700,
          color: isRecent ? 'var(--pink)' : 'var(--muted2)',
          lineHeight: 1,
        }}>
          {activity.count}
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 6,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          msg
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Last active time */}
      <div style={{ textAlign: 'right' }}>
        {isRecent && (
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 6,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--pink)',
            marginBottom: 2,
          }}>
            active
          </div>
        )}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
          letterSpacing: '0.04em',
        }}>
          {formatRelativeTime(activity.lastMs, now)}
        </span>
      </div>
    </div>
  )
}

interface RadioScannerProps {
  widgetId: string
}

export function RadioScanner({ widgetId: _ }: RadioScannerProps) {
  const { data } = useTeamRadio()
  const mode = useSessionStore((s) => s.mode)
  const refreshFade = useRefreshFade([data])

  const now = Date.now()

  const activities = useMemo<DriverActivity[]>(() => {
    if (!data?.length) return []

    const map = new Map<number, DriverActivity>()
    for (const msg of data) {
      const existing = map.get(msg.driver_number)
      const ms = new Date(msg.date).getTime()
      if (!existing) {
        map.set(msg.driver_number, { driverNumber: msg.driver_number, count: 1, lastDate: msg.date, lastMs: ms })
      } else {
        existing.count++
        if (ms > existing.lastMs) {
          existing.lastMs = ms
          existing.lastDate = msg.date
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastMs - a.lastMs)
  }, [data])

  const activeCount = activities.filter((a) => now - a.lastMs < 120_000).length

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
          background: activeCount > 0 ? 'var(--pink)' : 'var(--muted)',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
        }}>
          Radio Scanner
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
        }}>
          {activities.length} drivers
        </span>
        {mode === 'live' && (
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
        )}
      </div>

      {/* Channel list */}
      <SmoothScrollContainer style={{ flex: 1 }}>
        {activities.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
          }}>
            {mode === 'live' ? 'Scanning for radio activity…' : 'No radio data for this session'}
          </div>
        ) : (
          activities.map((activity) => (
            <ScannerCard key={activity.driverNumber} activity={activity} now={now} />
          ))
        )}
      </SmoothScrollContainer>
    </div>
  )
}
