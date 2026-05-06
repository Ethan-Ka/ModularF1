import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
// @ts-ignore
import Globe from 'react-globe.gl'
import { useSessionStore } from '../../store/sessionStore'
import { CIRCUIT_COORDS } from '../../data/circuitCoords'
import type { OpenF1Session } from '../../api/openf1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaceWeekend {
  meetingKey: number
  circuitShort: string
  countryName: string
  meetingName: string
  sessions: OpenF1Session[]
  earliestStart: number
  roundNumber: number
}

interface GlobeCalendarProps {
  weekends: RaceWeekend[]
  now: number
  imminentMeetingKey: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_META: Record<string, { label: string; color: string; order: number }> = {
  'Practice 1':        { label: 'P1', color: 'rgba(160,168,180,0.7)', order: 0 },
  'Practice 2':        { label: 'P2', color: 'rgba(160,168,180,0.7)', order: 1 },
  'Practice 3':        { label: 'P3', color: 'rgba(160,168,180,0.7)', order: 2 },
  'Sprint Qualifying': { label: 'SQ', color: 'rgba(224,144,0,0.8)',   order: 3 },
  'Sprint':            { label: 'S',  color: 'rgba(255,120,0,0.85)',  order: 4 },
  'Qualifying':        { label: 'Q',  color: 'rgba(80,140,255,0.85)', order: 5 },
  'Race':              { label: 'R',  color: 'rgba(232,19,43,0.9)',   order: 6 },
}

const CIRCUIT_FULL_NAME: Record<string, string> = {
  'Austin':        'Circuit of the Americas',
  'Bahrain':       'Bahrain International Circuit',
  'Jeddah':        'Jeddah Corniche Circuit',
  'Melbourne':     'Albert Park Circuit',
  'Suzuka':        'Suzuka Circuit',
  'Shanghai':      'Shanghai International Circuit',
  'Miami':         'Miami International Autodrome',
  'Miami Gardens': 'Miami International Autodrome',
  'Imola':         'Autodromo Enzo e Dino Ferrari',
  'Monaco':        'Circuit de Monaco',
  'Monte Carlo':   'Circuit de Monaco',
  'Montreal':      'Circuit Gilles-Villeneuve',
  'Montréal':      'Circuit Gilles-Villeneuve',
  'Barcelona':     'Circuit de Barcelona-Catalunya',
  'Spielberg':     'Red Bull Ring',
  'Silverstone':   'Silverstone Circuit',
  'Budapest':      'Hungaroring',
  'Spa':           'Circuit de Spa-Francorchamps',
  'Zandvoort':     'Circuit Zandvoort',
  'Monza':         'Autodromo Nazionale Monza',
  'Baku':          'Baku City Circuit',
  'Singapore':     'Marina Bay Street Circuit',
  'Lusail':        'Lusail International Circuit',
  'Las Vegas':     'Las Vegas Strip Circuit',
  'Mexico City':   'Autodromo Hermanos Rodriguez',
  'São Paulo':     'Autodromo Jose Carlos Pace',
  'Sao Paulo':     'Autodromo Jose Carlos Pace',
  'Abu Dhabi':     'Yas Marina Circuit',
  'Madrid':        'Circuit de Madrid',
}

// Maps circuitShort → SVG filename (without .svg) in /seasons/2026/tracks/display/
const TRACK_SVG: Record<string, string> = {
  'Austin':       'austin-1',
  'Bahrain':      'bahrain-1',
  'Jeddah':       'jeddah-1',
  'Melbourne':    'melbourne-1',
  'Suzuka':       'suzuka-1',
  'Shanghai':     'shanghai-1',
  'Miami':        'miami-1',
  'Miami Gardens': 'miami-1',
  'Imola':        'imola-1',
  'Monaco':       'monaco-1',
  'Monte Carlo':  'monaco-1',
  'Montreal':     'montreal-1',
  'Montréal':     'montreal-1',
  'Barcelona':    'catalunya-1',
  'Spielberg':    'spielberg-1',
  'Silverstone':  'silverstone-1',
  'Budapest':     'hungaroring-1',
  'Spa':          'spa-francorchamps-1',
  'Zandvoort':    'zandvoort-1',
  'Monza':        'monza-1',
  'Baku':         'baku-1',
  'Singapore':    'marina-bay-1',
  'Lusail':       'lusail-1',
  'Las Vegas':    'las-vegas-1',
  'Mexico City':  'mexico-city-1',
  'São Paulo':    'interlagos-1',
  'Sao Paulo':    'interlagos-1',
  'Abu Dhabi':    'yas-marina-1',
}

const CIRCUIT_META: Record<string, { laps: number; km: number; turns: number; drs: number }> = {
  'Austin':      { laps: 56, km: 5.513, turns: 20, drs: 2 },
  'Bahrain':     { laps: 57, km: 5.412, turns: 15, drs: 3 },
  'Jeddah':      { laps: 50, km: 6.174, turns: 27, drs: 3 },
  'Melbourne':   { laps: 58, km: 5.278, turns: 16, drs: 4 },
  'Suzuka':      { laps: 53, km: 5.807, turns: 18, drs: 1 },
  'Shanghai':    { laps: 56, km: 5.451, turns: 16, drs: 2 },
  'Miami':        { laps: 57, km: 5.412, turns: 19, drs: 3 },
  'Miami Gardens': { laps: 57, km: 5.412, turns: 19, drs: 3 },
  'Imola':        { laps: 63, km: 4.909, turns: 19, drs: 1 },
  'Monaco':       { laps: 78, km: 3.337, turns: 19, drs: 1 },
  'Monte Carlo':  { laps: 78, km: 3.337, turns: 19, drs: 1 },
  'Montreal':     { laps: 70, km: 4.361, turns: 14, drs: 2 },
  'Montréal':     { laps: 70, km: 4.361, turns: 14, drs: 2 },
  'Barcelona':   { laps: 66, km: 4.657, turns: 16, drs: 2 },
  'Spielberg':   { laps: 71, km: 4.318, turns: 10, drs: 3 },
  'Silverstone': { laps: 52, km: 5.891, turns: 18, drs: 2 },
  'Budapest':    { laps: 70, km: 4.381, turns: 14, drs: 1 },
  'Spa':         { laps: 44, km: 7.004, turns: 19, drs: 2 },
  'Zandvoort':   { laps: 72, km: 4.259, turns: 14, drs: 1 },
  'Monza':       { laps: 53, km: 5.793, turns: 11, drs: 2 },
  'Baku':        { laps: 51, km: 6.003, turns: 20, drs: 2 },
  'Singapore':   { laps: 62, km: 4.940, turns: 23, drs: 3 },
  'Lusail':      { laps: 57, km: 5.380, turns: 16, drs: 2 },
  'Las Vegas':   { laps: 50, km: 6.201, turns: 17, drs: 2 },
  'Mexico City': { laps: 71, km: 4.304, turns: 17, drs: 3 },
  'São Paulo':   { laps: 71, km: 4.309, turns: 15, drs: 3 },
  'Sao Paulo':   { laps: 71, km: 4.309, turns: 15, drs: 3 },
  'Abu Dhabi':   { laps: 58, km: 5.281, turns: 16, drs: 2 },
  'Madrid':      { laps: 55, km: 5.473, turns: 20, drs: 3 },
}

const FALLBACK_POV = { lat: 20, lng: 0, altitude: 2 }
const INITIAL_POV  = { lat: 20, lng: 10, altitude: 2 }
const FOCUSED_ALT  = 0.35
const GEOJSON_URL  = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

// ─── GlobeCalendar ────────────────────────────────────────────────────────────

export function GlobeCalendar({ weekends, now, imminentMeetingKey }: GlobeCalendarProps) {
  const { setMode } = useSessionStore()
  const globeRef    = useRef<any>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const globeReady  = useRef(false)
  // Pending circuit zoom requested before globe initialised
  const pendingCircuit = useRef<string | null>(null)
  // Tracks last active index to avoid redundant pointOfView calls on scroll
  const lastActiveIdx = useRef<number>(-1)

  const [geoJson, setGeoJson]     = useState<any>(null)
  const [globeSize, setGlobeSize] = useState({ width: 600, height: 460 })
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Fetch GeoJSON once ──
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => setGeoJson(data))
      .catch(() => {})
  }, [])

  // ── Track wrapper size ──
  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.floor(entry.contentRect.width)
      setGlobeSize({ width: w, height: Math.round(w * 0.77) })
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Derived data ──

  const nextIndex = useMemo(() =>
    weekends.findIndex(w => {
      const r = w.sessions.find(s => s.session_type === 'Race')
      return r ? new Date(r.date_end).getTime() >= now - 10 * 60_000 : false
    }),
    [weekends, now]
  )

  const arcsData = useMemo(() => {
    const arcs = []
    for (let i = 0; i < weekends.length - 1; i++) {
      const a = CIRCUIT_COORDS[weekends[i].circuitShort]
      const b = CIRCUIT_COORDS[weekends[i + 1].circuitShort]
      if (!a || !b) continue
      const raceSession = weekends[i].sessions.find(s => s.session_type === 'Race')
      const done = raceSession ? new Date(raceSession.date_end).getTime() < now - 10 * 60_000 : false
      arcs.push({
        startLat: a.lat, startLng: a.lng,
        endLat:   b.lat, endLng:   b.lng,
        color: done ? 'rgba(255,255,255,0.15)' : 'rgba(232,19,43,0.6)',
      })
    }
    return arcs
  }, [weekends, now])

  const pointsData = useMemo(() =>
    weekends.flatMap(w => {
      const coords = CIRCUIT_COORDS[w.circuitShort]
      if (!coords) return []
      const isNext = w.meetingKey === imminentMeetingKey || weekends.indexOf(w) === nextIndex
      return [{ lat: coords.lat, lng: coords.lng, size: isNext ? 0.6 : 0.3,
                color: isNext ? 'rgba(232,19,43,0.9)' : 'rgba(255,255,255,0.55)', altitude: 0.01 }]
    }),
    [weekends, nextIndex, imminentMeetingKey]
  )

  // ── Globe camera ──

  const pointTo = useCallback((circuitShort: string, durationMs = 1000) => {
    if (!globeRef.current) return
    if (!globeReady.current) {
      pendingCircuit.current = circuitShort
      return
    }
    pendingCircuit.current = null
    const coords = CIRCUIT_COORDS[circuitShort]
    globeRef.current.pointOfView(
      coords ? { lat: coords.lat, lng: coords.lng, altitude: FOCUSED_ALT } : FALLBACK_POV,
      durationMs
    )
  }, [])

  const handleGlobeReady = useCallback(() => {
    globeReady.current = true
    if (!globeRef.current) return
    const mat = globeRef.current.globeMaterial?.()
    if (mat) mat.color?.setHex(0x0a0c10)
    if (pendingCircuit.current) {
      const coords = CIRCUIT_COORDS[pendingCircuit.current]
      pendingCircuit.current = null
      globeRef.current.pointOfView(
        coords ? { lat: coords.lat, lng: coords.lng, altitude: FOCUSED_ALT } : FALLBACK_POV,
        0
      )
    } else {
      globeRef.current.pointOfView(INITIAL_POV, 0)
    }
  }, [])

  // ── Scroll → globe zoom (vertical: derives index from scrollTop math) ──
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || weekends.length === 0) return

    const onScroll = () => {
      const h = scroller.clientHeight
      if (h === 0) return
      const idx = Math.round(scroller.scrollTop / h)
      if (idx === lastActiveIdx.current) return
      lastActiveIdx.current = idx
      const weekend = weekends[idx]
      if (weekend) pointTo(weekend.circuitShort)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [weekends, pointTo])

  // ── Auto-scroll to next race on mount ──
  useEffect(() => {
    if (weekends.length === 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const target = nextIndex >= 0 ? nextIndex : 0
    // Defer until after layout so clientHeight is non-zero
    requestAnimationFrame(() => {
      if (!scroller) return
      const h = scroller.clientHeight
      if (h === 0) return
      // Use 'instant' to bypass CSS scroll-behavior: smooth on the initial jump
      scroller.scrollTo({ top: target * h, behavior: 'instant' as ScrollBehavior })
      lastActiveIdx.current = target
      const weekend = weekends[target]
      if (weekend) pointTo(weekend.circuitShort)
    })
  // Only on mount after weekends load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekends.length > 0 ? 'ready' : 'loading'])

  if (weekends.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
        Loading calendar…
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Globe ── */}
      <div ref={wrapperRef} style={{ width: '100%', height: globeSize.height, flexShrink: 0,
                                     overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}>
        {/* @ts-ignore */}
        <Globe
          ref={globeRef}
          width={globeSize.width}
          height={globeSize.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl=""
          enablePointerInteraction={false}
          showAtmosphere={false}
          showGraticules={false}
          polygonsData={geoJson?.features?.filter((d: any) => d.properties.ISO_A2 !== 'AQ') ?? []}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => 'rgba(10,12,16,0.95)'}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(255,255,255,0.12)'}
          polygonAltitude={0.004}
          polygonsTransitionDuration={0}
          arcsData={arcsData}
          arcColor="color"
          arcStroke={0.5}
          arcsTransitionDuration={0}
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="size"
          pointAltitude="altitude"
          pointResolution={10}
          pointsMerge={false}
          pointsTransitionDuration={0}
          onGlobeReady={handleGlobeReady}
        />
        {/* Edge vignette to blend globe into app background */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, transparent 45%, rgba(0,0,0,0.92) 100%)',
        }} />
      </div>

      {/* ── Vertical race sections ── */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          minHeight: 0,
        }}
      >
        {weekends.map((w, i) => {
          const raceSession   = w.sessions.find(s => s.session_type === 'Race')
          const raceEnd       = raceSession ? new Date(raceSession.date_end).getTime() : 0
          const done          = raceEnd < now - 10 * 60_000
          const isNext        = i === nextIndex
          const isImminent    = w.meetingKey === imminentMeetingKey
          const trackSvg      = TRACK_SVG[w.circuitShort]
          const trackSvgUrl   = trackSvg ? `/seasons/2026/tracks/display/${trackSvg}.svg` : null
          const meta          = CIRCUIT_META[w.circuitShort]

          const raceDate = raceSession
            ? new Date(raceSession.date_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
            : null

          const sortedSessions = [...w.sessions].sort(
            (a, b) => (SESSION_META[a.session_type]?.order ?? 99) - (SESSION_META[b.session_type]?.order ?? 99)
          )

          return (
            <div
              key={w.meetingKey}
              onClick={isImminent ? () => setMode('live') : undefined}
              style={{
                flex: '0 0 100%',
                scrollSnapAlign: 'start',
                display: 'grid',
                gridTemplateColumns: trackSvgUrl ? '1fr 140px' : '1fr',
                gap: 0,
                padding: '14px 20px 14px',
                boxSizing: 'border-box',
                alignItems: 'start',
                opacity: done && !isNext ? 0.55 : 1,
                transition: 'opacity 0.2s',
                cursor: isImminent ? 'pointer' : 'default',
                borderTop: isNext
                  ? '1px solid rgba(232,19,43,0.25)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* ── Text column ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>

                {/* Round + country */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.13em',
                    color: isNext ? 'rgba(232,19,43,0.65)' : 'rgba(255,255,255,0.22)',
                  }}>
                    R{w.roundNumber.toString().padStart(2, '0')}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.18)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {w.countryName.toUpperCase()}
                  </span>
                </div>

                {/* Circuit name */}
                <div style={{
                  fontFamily: 'var(--cond)', fontSize: 26, fontWeight: 700,
                  letterSpacing: '0.01em', lineHeight: 1,
                  color: '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {w.circuitShort}
                </div>

                {/* Full circuit name */}
                {CIRCUIT_FULL_NAME[w.circuitShort] && (
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.04em',
                    color: done ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.28)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {CIRCUIT_FULL_NAME[w.circuitShort]}
                  </div>
                )}

                {/* Session dots */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {sortedSessions.map(s => {
                    const meta   = SESSION_META[s.session_type] ?? { label: '?', color: 'rgba(120,120,120,0.5)', order: 99 }
                    const sEnd   = new Date(s.date_end).getTime()
                    const sStart = new Date(s.date_start).getTime()
                    const sDone  = sEnd < now - 10 * 60_000
                    const sActive = sStart <= now && sEnd >= now - 10 * 60_000
                    return (
                      <div key={s.session_key} title={s.session_type} style={{
                        width: 20, height: 20, borderRadius: 2,
                        background: sDone || sActive ? meta.color : 'rgba(255,255,255,0.05)',
                        border: `0.5px solid ${sDone || sActive ? 'transparent' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: sActive ? `0 0 5px ${meta.color}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: 6, fontWeight: 700, lineHeight: 1,
                          color: sDone || sActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)',
                        }}>
                          {meta.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Circuit stats */}
                {meta && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                    {[
                      { label: 'LAPS',  value: meta.laps },
                      { label: 'KM',    value: meta.km.toFixed(3) },
                      { label: 'TURNS', value: meta.turns },
                      { label: 'DRS',   value: meta.drs },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.08em',
                                       color: 'rgba(255,255,255,0.22)' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                                       color: isNext ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Race date */}
                {raceDate && (
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.05em',
                    color: 'rgba(255,255,255,0.22)',
                  }}>
                    {raceDate}
                  </div>
                )}

                {isImminent && (
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(232,19,43,0.8)',
                  }}>
                    → Go live
                  </div>
                )}
              </div>

              {/* ── Track SVG ── */}
              {trackSvgUrl && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingLeft: 12, opacity: done ? 0.25 : isNext ? 0.85 : 0.45,
                  transition: 'opacity 0.2s',
                }}>
                  <img
                    src={trackSvgUrl}
                    alt={w.circuitShort}
                    style={{ width: 130, height: 'auto', maxHeight: 110, objectFit: 'contain',
                             filter: 'brightness(0) invert(1)' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
