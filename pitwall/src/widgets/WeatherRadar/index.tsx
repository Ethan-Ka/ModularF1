import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface WeatherRadarProps {
  widgetId: string
}

// Circuit coordinates lookup table for major F1 circuits
const CIRCUIT_COORDS: Record<string, { lat: number; lon: number; zoom: number }> = {
  // circuit_short_name → lat/lon/zoom
  Monza: { lat: 45.62, lon: 9.29, zoom: 11 },
  Silverstone: { lat: 52.07, lon: -1.02, zoom: 11 },
  Spa: { lat: 50.43, lon: 5.97, zoom: 11 },
  Monaco: { lat: 43.73, lon: 7.42, zoom: 12 },
  Bahrain: { lat: 26.03, lon: 50.51, zoom: 12 },
  Jeddah: { lat: 21.63, lon: 39.10, zoom: 12 },
  'Baku City Circuit': { lat: 40.37, lon: 49.85, zoom: 12 },
  Baku: { lat: 40.37, lon: 49.85, zoom: 12 },
  Miami: { lat: 25.96, lon: -80.24, zoom: 12 },
  Imola: { lat: 44.34, lon: 11.71, zoom: 12 },
  Barcelona: { lat: 41.57, lon: 2.26, zoom: 12 },
  Montreal: { lat: 45.50, lon: -73.52, zoom: 12 },
  'Red Bull Ring': { lat: 47.22, lon: 14.76, zoom: 12 },
  Spielberg: { lat: 47.22, lon: 14.76, zoom: 12 },
  Hungaroring: { lat: 47.58, lon: 19.25, zoom: 12 },
  Zandvoort: { lat: 52.39, lon: 4.54, zoom: 12 },
  Singapore: { lat: 1.29, lon: 103.86, zoom: 13 },
  Suzuka: { lat: 34.84, lon: 136.54, zoom: 12 },
  Lusail: { lat: 25.49, lon: 51.45, zoom: 12 },
  Austin: { lat: 30.13, lon: -97.64, zoom: 11 },
  'Mexico City': { lat: 19.40, lon: -99.09, zoom: 12 },
  'São Paulo': { lat: -23.70, lon: -46.70, zoom: 12 },
  Interlagos: { lat: -23.70, lon: -46.70, zoom: 12 },
  'Las Vegas': { lat: 36.12, lon: -115.17, zoom: 12 },
  'Yas Marina': { lat: 24.47, lon: 54.60, zoom: 12 },
  'Abu Dhabi': { lat: 24.47, lon: 54.60, zoom: 12 },
  Melbourne: { lat: -37.85, lon: 144.97, zoom: 12 },
  Shanghai: { lat: 31.34, lon: 121.22, zoom: 12 },
  Sakhir: { lat: 26.03, lon: 50.51, zoom: 12 },
}

function buildWindyUrl(lat: number, lon: number, zoom: number): string {
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`
}

export function WeatherRadar({ widgetId: _ }: WeatherRadarProps) {
  const activeSession = useSessionStore((s) => s.activeSession)
  const circuitName = activeSession?.circuit_short_name ?? null
  const refreshFade = useRefreshFade([activeSession?.session_key, circuitName])

  const coords = circuitName ? CIRCUIT_COORDS[circuitName] : null

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
          flex: 1,
        }}>
          Weather Radar
        </span>
        {circuitName && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 7,
            letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}>
            {circuitName}
          </span>
        )}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 6,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: coords ? 'var(--green)' : 'var(--muted2)',
          padding: '1px 5px',
          border: `0.5px solid ${coords ? 'rgba(29,184,106,0.4)' : 'var(--border)'}`,
          borderRadius: 2,
        }}>
          {coords ? 'GEO-LOCKED' : 'NO COORDS'}
        </span>
      </div>

      {/* Radar content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {coords ? (
          <iframe
            src={buildWindyUrl(coords.lat, coords.lon, coords.zoom)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            title={`Weather radar — ${circuitName}`}
            loading="lazy"
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--cond)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--muted)',
            }}>
              Weather Radar
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              color: 'var(--muted2)',
              letterSpacing: '0.06em',
              lineHeight: 1.8,
              maxWidth: 200,
            }}>
              {circuitName
                ? `Circuit coordinates not found for "${circuitName}". Windy embed will load once coordinates are available.`
                : 'No active session. Select a session to load circuit weather.'
              }
            </div>
            {circuitName && (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                color: 'var(--muted2)',
                padding: '4px 8px',
                border: '0.5px solid var(--border)',
                borderRadius: 3,
                background: 'var(--bg4)',
              }}>
                Windy embed — circuit coordinates loaded from session
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
