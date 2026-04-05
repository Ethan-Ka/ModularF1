import { useWeather } from '../../hooks/useWeather'
import type { OpenF1Weather } from '../../api/openf1'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface WeatherDashboardProps {
  widgetId: string
}

type Trend = 'up' | 'down' | 'flat'

function getTrend(current: number, previous: number): Trend {
  const diff = current - previous
  if (Math.abs(diff) < 0.01) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

function TrendArrow({ trend }: { trend: Trend }) {
  if (trend === 'flat') return <span style={{ color: 'var(--muted2)', fontSize: 10 }}>—</span>
  return (
    <span style={{
      color: trend === 'up' ? 'var(--red)' : 'var(--green)',
      fontSize: 11,
      lineHeight: 1,
    }}>
      {trend === 'up' ? '↑' : '↓'}
    </span>
  )
}

interface MetricCardProps {
  label: string
  value: string
  trend: Trend
  alert?: boolean
  alertLabel?: string
}

function MetricCard({ label, value, trend, alert, alertLabel }: MetricCardProps) {
  return (
    <div style={{
      background: 'var(--bg4)',
      border: alert ? '0.5px solid rgba(224,144,0,0.4)' : '0.5px solid var(--border)',
      borderRadius: 3,
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      position: 'relative',
    }}>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 7,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--muted2)',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--cond)',
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--white)',
        }}>
          {value}
        </span>
        <TrendArrow trend={trend} />
      </div>
      {alert && alertLabel && (
        <div style={{
          fontSize: 7,
          fontFamily: 'var(--mono)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--amber)',
          padding: '1px 5px',
          border: '0.5px solid rgba(224,144,0,0.5)',
          borderRadius: 2,
          background: 'rgba(224,144,0,0.1)',
          alignSelf: 'flex-start',
        }}>
          {alertLabel}
        </div>
      )}
    </div>
  )
}

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function WeatherDashboard({ widgetId: _ }: WeatherDashboardProps) {
  const { data } = useWeather()
  const refreshFade = useRefreshFade([data])

  const latest: OpenF1Weather | undefined = data?.[data.length - 1]
  const prev: OpenF1Weather | undefined = data?.[data.length - 2]

  if (!latest) {
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
        Waiting for weather data…
      </div>
    )
  }

  const isTyreCrossover = latest.track_temperature < 18
  const windLabel = `${latest.wind_speed.toFixed(1)} ${windDirLabel(latest.wind_direction)}`

  const metrics: MetricCardProps[] = [
    {
      label: 'Air temp',
      value: `${latest.air_temperature.toFixed(1)}°C`,
      trend: prev ? getTrend(latest.air_temperature, prev.air_temperature) : 'flat',
    },
    {
      label: 'Track temp',
      value: `${latest.track_temperature.toFixed(1)}°C`,
      trend: prev ? getTrend(latest.track_temperature, prev.track_temperature) : 'flat',
      alert: isTyreCrossover,
      alertLabel: 'INTER CROSSOVER',
    },
    {
      label: 'Humidity',
      value: `${latest.humidity.toFixed(0)}%`,
      trend: prev ? getTrend(latest.humidity, prev.humidity) : 'flat',
    },
    {
      label: 'Wind',
      value: windLabel,
      trend: prev ? getTrend(latest.wind_speed, prev.wind_speed) : 'flat',
    },
    {
      label: 'Wind dir',
      value: `${latest.wind_direction}°`,
      trend: 'flat',
    },
    {
      label: 'Rainfall',
      value: `${latest.rainfall.toFixed(1)}mm`,
      trend: prev ? getTrend(latest.rainfall, prev.rainfall) : 'flat',
    },
  ]

  return (
    <div
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
      gap: 4,
      padding: 6,
      overflow: 'hidden',
    }}>
      {metrics.map((m) => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  )
}
