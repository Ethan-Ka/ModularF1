import { usePositions } from '../../hooks/usePositions'
import { useIntervals } from '../../hooks/useIntervals'
import { useLaps } from '../../hooks/useLaps'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface LapDeltaTowerProps {
  widgetId: string
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = (seconds % 60).toFixed(3).padStart(6, '0')
    return `${m}:${s}`
  }
  return seconds.toFixed(3)
}

function formatGap(gap: number | string | null | undefined): string {
  if (gap == null) return '—'
  if (typeof gap === 'string') return gap // e.g. "+1 LAP" for lapped cars
  if (gap === 0) return 'LEADER'
  return `+${gap.toFixed(3)}`
}

function formatInterval(interval: number | string | null | undefined): string {
  if (interval == null) return '—'
  if (typeof interval === 'string') return interval
  return `+${interval.toFixed(3)}`
}

export function LapDeltaTower({ widgetId: _ }: LapDeltaTowerProps) {
  const { data: positions } = usePositions()
  const { data: intervals } = useIntervals()
  const { data: laps } = useLaps()
  const { getDriver, getTeamColor } = useDriverStore()
  const refreshFade = useRefreshFade([positions, intervals, laps])

  // Build interval map
  const intervalMap = new Map(intervals?.map((i) => [i.driver_number, i]) ?? [])

  // Build latest lap map per driver
  const lapMap = new Map<number, (typeof laps extends (infer T)[] | undefined ? T : never)>()
  if (laps) {
    for (const lap of laps) {
      const existing = lapMap.get(lap.driver_number)
      if (!existing || lap.lap_number > existing.lap_number) {
        lapMap.set(lap.driver_number, lap)
      }
    }
  }

  const rows = positions ?? []

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--mono)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 4px 40px 70px 70px 60px 50px 50px 50px',
        gap: 0,
        padding: '4px 8px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg4)',
        flexShrink: 0,
      }}>
        {['POS', '', 'DRV', 'GAP', 'INT', 'LAST', 'S1', 'S2', 'S3'].map((h, i) => (
          <span key={i} style={{
            fontSize: 7,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Data rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontSize: 9,
            color: 'var(--muted2)',
          }}>
            Waiting for data…
          </div>
        )}
        {rows.map((pos) => {
          const driver = getDriver(pos.driver_number)
          const teamColor = getTeamColor(pos.driver_number)
          const interval = intervalMap.get(pos.driver_number)
          const lap = lapMap.get(pos.driver_number)
          const isPitOut = lap?.is_pit_out_lap ?? false

          return (
            <div
              key={pos.driver_number}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 4px 40px 70px 70px 60px 50px 50px 50px',
                padding: '3px 8px',
                borderBottom: '0.5px solid var(--border)',
                alignItems: 'center',
                background: 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Position */}
              <span style={{
                fontSize: 10,
                fontWeight: 500,
                color: pos.position <= 3 ? 'var(--gold)' : 'var(--white)',
              }}>
                {pos.position}
              </span>

              {/* Team color bar */}
              <div style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                background: teamColor,
                boxShadow: `0 0 4px ${teamColor}66`,
              }} />

              {/* Driver abbr */}
              <span style={{
                fontFamily: 'var(--cond)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--white)',
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                {driver?.name_acronym ?? `#${pos.driver_number}`}
                {isPitOut && (
                  <span style={{
                    fontSize: 6,
                    padding: '1px 3px',
                    borderRadius: 2,
                    background: 'rgba(201,168,76,0.2)',
                    border: '0.5px solid rgba(201,168,76,0.5)',
                    color: 'var(--gold)',
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--mono)',
                  }}>
                    PIT
                  </span>
                )}
              </span>

              {/* Gap to leader */}
              <span style={{
                fontSize: 9,
                color: interval?.gap_to_leader === 0 ? 'var(--green)' : 'var(--white)',
                textAlign: 'right',
                paddingRight: 8,
              }}>
                {formatGap(interval?.gap_to_leader)}
              </span>

              {/* Interval */}
              <span style={{
                fontSize: 9,
                color: 'var(--muted)',
                textAlign: 'right',
                paddingRight: 8,
              }}>
                {pos.position === 1 ? '—' : formatInterval(interval?.interval)}
              </span>

              {/* Last lap */}
              <span style={{
                fontSize: 9,
                color: 'var(--white)',
                textAlign: 'right',
                paddingRight: 8,
              }}>
                {formatTime(lap?.lap_duration)}
              </span>

              {/* S1 */}
              <span style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'right', paddingRight: 4 }}>
                {formatTime(lap?.duration_sector_1)}
              </span>

              {/* S2 */}
              <span style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'right', paddingRight: 4 }}>
                {formatTime(lap?.duration_sector_2)}
              </span>

              {/* S3 */}
              <span style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'right', paddingRight: 4 }}>
                {formatTime(lap?.duration_sector_3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
