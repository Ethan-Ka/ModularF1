export const HELP = `# Overtake Replay

Chronological log of position changes detected during the session — every time a driver moves forward in the order.

- **Timestamp**: When the position change was detected.
- **Gaining driver**: The driver who moved up — shown with team colour bar and three-letter code.
- **+N**: Number of positions gained in one move.
- **New position**: The position the driver moved into (P1 = lead).
- **Loser**: The driver who lost position (when identifiable from the data).

Unfamiliar terms:

- *Position change*: A detected shift in race order. This can be caused by an on-track overtake, a pit stop sequence, a retirement, or a penalty.
- *Gap*: The time difference to the car ahead at the moment of the position change, when available.

Notes: position changes are inferred from timing data deltas — they include pit-stop-induced swaps, not only on-track overtakes. Very rapid multi-car swaps (e.g., a safety car restart) may generate multiple entries at the same timestamp.
`
import { useMemo, useRef, useEffect, useState } from 'react'
import { usePositions } from '../../hooks/usePositions'
import { useIntervalHistory } from '../../hooks/useIntervals'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useFastF1Results } from '../../hooks/useFastF1'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { EmptyState } from '../widgetUtils'

interface OvertakeReplayProps {
  widgetId: string
}

interface OvertakeEvent {
  id: string
  timestamp: string
  gainerNumber: number
  loserNumber: number | null
  newPosition: number
  oldPosition: number
}

function TeamBar({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

function PositionBadge({ pos }: { pos: number }) {
  const isTop3 = pos <= 3
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: isTop3 ? 'var(--gold)' : 'var(--muted)',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      P{pos}
    </span>
  )
}

function GainBadge({ gain }: { gain: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        color: 'var(--green)',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      +{gain}
    </span>
  )
}

function OvertakeRow({
  event,
  getDriver,
  getTeamColor,
}: {
  event: OvertakeEvent
  getDriver: (n: number) => { name_acronym?: string } | undefined
  getTeamColor: (n: number) => string
}) {
  const gainerDriver = getDriver(event.gainerNumber)
  const gainerCode = gainerDriver?.name_acronym ?? `#${event.gainerNumber}`
  const gainerColor = getTeamColor(event.gainerNumber)

  const loserDriver = event.loserNumber != null ? getDriver(event.loserNumber) : null
  const loserCode =
    event.loserNumber != null
      ? loserDriver?.name_acronym ?? `#${event.loserNumber}`
      : null
  const loserColor =
    event.loserNumber != null ? getTeamColor(event.loserNumber) : 'var(--muted2)'

  const gain = event.oldPosition - event.newPosition

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        height: 28,
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {/* Timestamp */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          color: 'var(--muted2)',
          letterSpacing: '0.04em',
          width: 44,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {event.timestamp}
      </span>

      {/* Gainer */}
      <TeamBar color={gainerColor} />
      <span
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--white)',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}
      >
        {gainerCode}
      </span>

      {/* New position badge */}
      <PositionBadge pos={event.newPosition} />

      {/* Gain arrow */}
      <GainBadge gain={gain} />

      {/* Separator */}
      {loserCode != null ? (
        <>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              color: 'var(--muted2)',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            passed
          </span>

          {/* Loser */}
          <TeamBar color={loserColor} />
          <span
            style={{
              fontFamily: 'var(--cond)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {loserCode}
          </span>
        </>
      ) : (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            color: 'var(--muted2)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          P{event.newPosition}
        </span>
      )}
    </div>
  )
}

export function OvertakeReplay({ widgetId: _ }: OvertakeReplayProps) {
  const mode = useSessionStore((s) => s.mode)
  const activeFastF1Session = useSessionStore((s) => s.activeFastF1Session)

  const { data: positions } = usePositions()
  // useIntervalHistory is consumed to ensure the hook is registered for the query
  // cache — intervals data informs session context even if not directly used here
  useIntervalHistory()

  const { data: fastF1Results } = useFastF1Results(
    mode === 'hub' ? activeFastF1Session : null,
  )

  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const refreshFade = useRefreshFade([positions])

  const prevPositionsRef = useRef<Map<number, number>>(new Map())
  const [overtakes, setOvertakes] = useState<OvertakeEvent[]>([])

  useEffect(() => {
    // In FastF1 mode positions are static final results — diffing would produce
    // spurious overtake events when the snapshot first loads from an empty map.
    if (mode === 'hub') return
    if (!positions?.length) return

    const current = new Map(positions.map((p) => [p.driver_number, p.position]))
    const prev = prevPositionsRef.current

    if (prev.size > 0) {
      const newOvertakes: OvertakeEvent[] = []

      for (const [driverNum, newPos] of current) {
        const oldPos = prev.get(driverNum)
        if (oldPos != null && newPos < oldPos) {
          // Driver moved forward — find who occupied the new position before
          const passed = [...prev.entries()].find(
            ([d, p]) => p === newPos && d !== driverNum,
          )?.[0]

          newOvertakes.push({
            id: `${driverNum}-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            gainerNumber: driverNum,
            loserNumber: passed ?? null,
            newPosition: newPos,
            oldPosition: oldPos,
          })
        }
      }

      if (newOvertakes.length > 0) {
        // Newest events at the top; cap list at 50 entries
        setOvertakes((prev) => [...newOvertakes.reverse(), ...prev].slice(0, 50))
      }
    }

    prevPositionsRef.current = current
  }, [positions, mode])

  // Stable driver lookups derived from current overtakes list
  const rows = useMemo(() => overtakes, [overtakes])

  // FastF1 mode: show grid → finish position change table
  if (mode === 'hub') {
    const gridRows = (fastF1Results ?? [])
      .filter((r) => r.Position != null && r.GridPosition != null)
      .sort((a, b) => (a.Position ?? 99) - (b.Position ?? 99))

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '4px 10px',
            borderBottom: '0.5px solid var(--border)',
            background: 'var(--bg4)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted2)' }}>
            Grid → Finish
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--amber)', background: 'rgba(224,144,0,0.12)', border: '0.5px solid rgba(224,144,0,0.3)', borderRadius: 2, padding: '1px 4px' }}>
            HIST
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {gridRows.length === 0 ? (
            <EmptyState message="No results available" subMessage="Requires a FastF1 race session" />
          ) : (
            gridRows.map((r) => {
              const driverNum = parseInt(r.DriverNumber, 10)
              const driver = getDriver(driverNum)
              const color = getTeamColor(driverNum)
              const finish = r.Position ?? 99
              const grid = r.GridPosition ?? 99
              const delta = grid - finish // positive = gained positions
              return (
                <div
                  key={r.DriverNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 10px',
                    height: 28,
                    borderBottom: '0.5px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: finish <= 3 ? 'var(--gold)' : 'var(--muted)', width: 20, flexShrink: 0 }}>
                    P{finish}
                  </span>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--cond)', fontSize: 12, fontWeight: 700, color: 'var(--white)', letterSpacing: '0.02em', flex: 1, minWidth: 0 }}>
                    {driver?.name_acronym ?? `#${r.DriverNumber}`}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', flexShrink: 0 }}>
                    from P{grid}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--muted2)', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
                    {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '—'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

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
      <div
        style={{
          padding: '4px 10px',
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg4)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
          }}
        >
          Overtake Feed
        </span>
        {rows.length > 0 && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 7,
              color: 'var(--muted2)',
              background: 'var(--bg3)',
              border: '0.5px solid var(--border2)',
              borderRadius: 3,
              padding: '1px 5px',
              letterSpacing: '0.04em',
            }}
          >
            {rows.length}
          </span>
        )}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {rows.length === 0 ? (
          <EmptyState
            message="No overtakes detected yet"
            subMessage="Position changes appear here live"
          />
        ) : (
          rows.map((event) => (
            <OvertakeRow
              key={event.id}
              event={event}
              getDriver={getDriver}
              getTeamColor={getTeamColor}
            />
          ))
        )}
      </div>
    </div>
  )
}
