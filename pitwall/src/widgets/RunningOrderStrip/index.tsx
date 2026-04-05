import { usePositions } from '../../hooks/usePositions'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface RunningOrderStripProps {
  widgetId: string
}

export function RunningOrderStrip({ widgetId: _ }: RunningOrderStripProps) {
  const { data: positions } = usePositions()
  const { getDriver, getTeamColor, getTeamLogo } = useDriverStore()
  const refreshFade = useRefreshFade([positions])

  const sorted = positions ?? []

  if (sorted.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--muted2)',
      }}>
        Waiting for position data…
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
      alignItems: 'center',
      gap: 8,
      padding: '1px 2px',
      overflow: 'hidden',
    }}>
      {sorted.map((pos) => {
        const driver = getDriver(pos.driver_number)
        const color = getTeamColor(pos.driver_number)
        const teamLogo = getTeamLogo(pos.driver_number)

        return (
        <div
          key={pos.driver_number}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flex: 1,
          }}
        >
          {/* Team logo with color fallback */}
          {teamLogo ? (
            <img
              src={teamLogo}
              alt={driver?.team_name ?? 'Team logo'}
              style={{
                width: 12,
                height: 12,
                objectFit: 'contain',
                borderRadius: 2,
                background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid var(--border)',
                padding: 1,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 4px ${color}88`,
              flexShrink: 0,
            }} />
          )}
          {/* Driver abbr */}
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 6,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            lineHeight: 1,
          }}>
            {driver?.name_acronym ?? `${pos.driver_number}`}
          </span>
        </div>
        )
      })}
    </div>
  )
}
