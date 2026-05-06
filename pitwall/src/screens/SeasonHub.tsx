import { useMemo, useRef, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSessions } from '../hooks/useSession'
import { useSessionStore } from '../store/sessionStore'
import { useNextRace } from '../hooks/useNextRace'
import { SeasonStandingsModal, SeasonStandingsPanel } from '../components/SeasonStandings/SeasonStandingsModal'
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel'
import { DriverManagerPanel } from '../components/DriverManager/DriverManagerPanel'
import { DiagnosticLog } from '../components/DiagnosticLog/DiagnosticLog'
import { useLogStore } from '../store/logStore'
import type { OpenF1Session } from '../api/openf1'

const YEAR = new Date().getFullYear()

const SESSION_META: Record<string, { label: string; color: string; order: number }> = {
  'Practice 1':        { label: 'P1', color: 'rgba(160,168,180,0.7)', order: 0 },
  'Practice 2':        { label: 'P2', color: 'rgba(160,168,180,0.7)', order: 1 },
  'Practice 3':        { label: 'P3', color: 'rgba(160,168,180,0.7)', order: 2 },
  'Sprint Qualifying': { label: 'SQ', color: 'rgba(224,144,0,0.8)',   order: 3 },
  'Sprint':            { label: 'S',  color: 'rgba(255,120,0,0.85)',  order: 4 },
  'Qualifying':        { label: 'Q',  color: 'rgba(80,140,255,0.85)', order: 5 },
  'Race':              { label: 'R',  color: 'rgba(232,19,43,0.9)',   order: 6 },
}

interface RaceWeekend {
  meetingKey: number
  circuitShort: string
  countryName: string
  meetingName: string
  sessions: OpenF1Session[]
  earliestStart: number
  roundNumber: number
}

interface HeadlineItem {
  title: string
  link: string
  pubDate: string
  description: string
  source?: string
  image?: string
}

interface HeadlineCard extends HeadlineItem {
  imageUrl: string
}

function groupIntoWeekends(sessions: OpenF1Session[]): RaceWeekend[] {
  const map = new Map<number, OpenF1Session[]>()
  for (const s of sessions) {
    const key = s.meeting_key ?? 0
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  const weekends: RaceWeekend[] = []
  let round = 0
  for (const [meetingKey, wSessions] of map) {
    if (!meetingKey) continue
    const sorted = [...wSessions].sort(
      (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    )
    if (!sorted.some(s => s.session_type === 'Race')) continue
    round++
    weekends.push({
      meetingKey,
      circuitShort: sorted[0].circuit_short_name ?? '???',
      countryName: sorted[0].country_name ?? '',
      meetingName: sorted[0].session_name?.split(' ')[0] ?? sorted[0].country_name ?? '',
      sessions: sorted,
      earliestStart: new Date(sorted[0].date_start).getTime(),
      roundNumber: round,
    })
  }
  return weekends.sort((a, b) => a.earliestStart - b.earliestStart)
}

function countryFlag(countryName: string): string {
  const map: Record<string, string> = {
    'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺',
    'Japan': '🇯🇵', 'China': '🇨🇳', 'United States': '🇺🇸',
    'Italy': '🇮🇹', 'Monaco': '🇲🇨', 'Canada': '🇨🇦',
    'Spain': '🇪🇸', 'Austria': '🇦🇹', 'United Kingdom': '🇬🇧',
    'Hungary': '🇭🇺', 'Belgium': '🇧🇪', 'Netherlands': '🇳🇱',
    'Azerbaijan': '🇦🇿', 'Singapore': '🇸🇬', 'Mexico': '🇲🇽',
    'Brazil': '🇧🇷', 'Las Vegas': '🇺🇸', 'Qatar': '🇶🇦',
    'Abu Dhabi': '🇦🇪', 'Miami': '🇺🇸', 'Emilia Romagna': '🇮🇹',
    'São Paulo': '🇧🇷',
  }
  for (const [k, v] of Object.entries(map)) {
    if (countryName.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '🏁'
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  Bahrain: 'BH',
  'Saudi Arabia': 'SA',
  Australia: 'AU',
  Japan: 'JP',
  China: 'CN',
  'United States': 'US',
  Miami: 'US',
  'Las Vegas': 'US',
  Italy: 'IT',
  'Emilia Romagna': 'IT',
  Monaco: 'MC',
  Canada: 'CA',
  Spain: 'ES',
  Austria: 'AT',
  'United Kingdom': 'GB',
  Hungary: 'HU',
  Belgium: 'BE',
  Netherlands: 'NL',
  Azerbaijan: 'AZ',
  Singapore: 'SG',
  Mexico: 'MX',
  Brazil: 'BR',
  'São Paulo': 'BR',
  Qatar: 'QA',
  'Abu Dhabi': 'AE',
}

function countryCodeFromName(countryName: string): string | null {
  const lower = countryName.toLowerCase()
  for (const [name, code] of Object.entries(COUNTRY_CODE_BY_NAME)) {
    if (lower.includes(name.toLowerCase())) return code
  }
  return null
}

function countryFlagImageUrl(countryName: string): string | null {
  const code = countryCodeFromName(countryName)
  if (!code) return null
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}

function relativeTime(pubDate: string): string {
  if (!pubDate) return ''
  const date = new Date(pubDate)
  if (isNaN(date.getTime())) return ''
  const diff = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function headlineTimestamp(pubDate: string): number {
  if (!pubDate) return 0
  const time = new Date(pubDate).getTime()
  return Number.isNaN(time) ? 0 : time
}

function extractHeadlineImage(desc: string): string | null {
  if (!desc) return null
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] ?? null
}

function headlineTopicKey(title: string): string {
  const stop = new Set([
    'the', 'a', 'an', 'to', 'of', 'and', 'for', 'in', 'with', 'on', 'at', 'from',
    'after', 'before', 'as', 'by', 'is', 'are', 'was', 'were', 'be', 'it',
  ])
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stop.has(w))
  return words.slice(0, 4).join('-') || title.toLowerCase().slice(0, 18)
}

function headlineSourceUrl(link?: string): string {
  if (!link) return ''
  try {
    const url = new URL(link)
    const host = url.hostname.replace(/^www\./, '')
    const seg = url.pathname.split('/').filter(Boolean)[0]
    return seg ? `${host}/${seg}` : host
  } catch {
    return ''
  }
}

function headlineImageProxy(url?: string): string {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  return `http://127.0.0.1:7822/headlines/image?url=${encodeURIComponent(url)}`
}

// ─── Country outlines ─────────────────────────────────────────────────────────

const COUNTRY_PATHS: Record<string, string> = {
  bahrain: 'M42 20 L60 18 L65 38 L55 55 L38 52 L33 34 Z',
  'saudi arabia': 'M10 10 L62 8 L74 22 L78 42 L68 55 L50 65 L24 60 L8 48 L6 28 Z',
  australia: 'M10 28 L15 12 L35 5 L62 3 L78 12 L84 30 L82 50 L68 65 L48 68 L30 62 L15 48 Z',
  japan: 'M48 20 L58 14 L64 28 L57 44 L45 50 L38 42 L36 30 L42 22 Z',
  china: 'M20 10 L65 5 L82 18 L78 35 L68 48 L58 55 L40 60 L22 52 L12 38 L15 22 Z',
  'united states': 'M6 20 L8 8 L25 5 L62 5 L78 12 L88 25 L85 42 L78 48 L62 52 L42 52 L25 48 L12 38 Z',
  miami: 'M6 20 L8 8 L25 5 L62 5 L78 12 L88 25 L85 42 L78 48 L62 52 L42 52 L25 48 L12 38 Z',
  'las vegas': 'M6 20 L8 8 L25 5 L62 5 L78 12 L88 25 L85 42 L78 48 L62 52 L42 52 L25 48 L12 38 Z',
  italy: 'M25 5 L55 8 L62 25 L58 42 L68 52 L72 62 L65 68 L58 58 L54 42 L48 28 L38 22 L25 12 Z',
  'emilia romagna': 'M25 5 L55 8 L62 25 L58 42 L68 52 L72 62 L65 68 L58 58 L54 42 L48 28 L38 22 L25 12 Z',
  monaco: 'M30 25 L70 22 L72 52 L55 62 L28 55 Z',
  canada: 'M5 5 L85 5 L88 22 L75 30 L62 28 L48 35 L35 30 L18 38 L8 32 Z',
  spain: 'M8 22 L15 5 L62 5 L80 12 L82 30 L72 42 L52 48 L28 45 L8 38 Z',
  austria: 'M15 25 L62 20 L75 30 L72 48 L55 55 L28 52 L12 40 Z',
  'united kingdom': 'M45 5 L58 2 L64 15 L60 30 L50 40 L38 36 L32 22 L38 10 Z',
  hungary: 'M12 28 L65 22 L72 35 L68 50 L45 58 L18 52 L10 40 Z',
  belgium: 'M15 18 L62 15 L68 32 L62 48 L35 52 L12 42 Z',
  netherlands: 'M20 8 L62 5 L68 22 L62 38 L35 42 L18 35 Z',
  azerbaijan: 'M10 28 L55 22 L65 32 L62 45 L42 52 L15 48 Z',
  singapore: 'M38 32 L62 30 L64 50 L45 56 L36 46 Z',
  mexico: 'M8 15 L55 10 L78 22 L75 38 L60 52 L45 65 L25 68 L12 55 L5 38 Z',
  brazil: 'M15 5 L68 5 L75 18 L72 35 L62 55 L48 68 L35 65 L22 55 L12 40 L10 22 Z',
  'são paulo': 'M15 5 L68 5 L75 18 L72 35 L62 55 L48 68 L35 65 L22 55 L12 40 L10 22 Z',
  qatar: 'M38 12 L60 10 L65 28 L58 50 L42 54 L30 38 L32 20 Z',
  'abu dhabi': 'M8 20 L45 15 L65 22 L72 38 L60 50 L38 55 L15 48 Z',
}

function getCountryPath(countryName: string): string | null {
  const lower = countryName.toLowerCase()
  for (const [key, path] of Object.entries(COUNTRY_PATHS)) {
    if (lower.includes(key)) return path
  }
  return null
}

// ─── Road Calendar ────────────────────────────────────────────────────────────

const ROAD_W = 600   // canvas width in px
const STEP = 290     // vertical spacing per race node
const PAD_Y = 80     // top and bottom padding
const CARD_W = 210   // race card width
const NODE_GAP = 22  // gap between node dot and card edge

const LX = 245   // left node x; left card starts at 245 - 22 - 210 = 13 > 0 ✓
const RX = 345   // right node x; right card ends at 345 + 22 + 210 = 577 < 600 ✓

function RoadCalendar({ weekends, now, imminentMeetingKey }: { weekends: RaceWeekend[]; now: number; imminentMeetingKey: number | null }) {
  const { setMode } = useSessionStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const nextIndex = useMemo(() =>
    weekends.findIndex(w => {
      const r = w.sessions.find(s => s.session_type === 'Race')
      return r ? new Date(r.date_end).getTime() >= now - 10 * 60_000 : false
    }),
    [weekends, now]
  )

  const totalH = weekends.length * STEP + PAD_Y * 2

  // race[0] at bottom, race[N-1] at top
  const nodes = useMemo(() =>
    weekends.map((_, i) => ({
      x: i % 2 === 0 ? LX : RX,
      y: totalH - PAD_Y - i * STEP,
    })),
    [weekends, totalH]
  )

  // Cubic bezier S-curves: control points go straight up from each node
  const pathD = useMemo(() => {
    if (nodes.length === 0) return ''
    return nodes.reduce((d, pos, i) => {
      if (i === 0) return `M ${pos.x.toFixed(1)} ${pos.y.toFixed(1)}`
      const prev = nodes[i - 1]
      const cp1y = (prev.y - STEP * 0.48).toFixed(1)
      const cp2y = (pos.y + STEP * 0.48).toFixed(1)
      return `${d} C ${prev.x.toFixed(1)} ${cp1y}, ${pos.x.toFixed(1)} ${cp2y}, ${pos.x.toFixed(1)} ${pos.y.toFixed(1)}`
    }, '')
  }, [nodes])

  // Scroll so next race appears ~40% from the top of the visible area
  useEffect(() => {
    if (nextIndex < 0 || !scrollRef.current) return
    const pos = nodes[nextIndex]
    if (!pos) return
    const target = pos.y - scrollRef.current.clientHeight * 0.4
    scrollRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [nextIndex, nodes])

  if (weekends.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.18)',
      }}>
        Loading calendar…
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ position: 'relative', width: ROAD_W, height: totalH, margin: '0 auto' }}>

        {/* ── SVG layer: road + connectors + nodes ── */}
        <svg
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          width={ROAD_W}
          height={totalH}
          viewBox={`0 0 ${ROAD_W} ${totalH}`}
        >
          {/* Trail base glow */}
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" strokeLinecap="round" />
          {/* Trail dashes */}
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 16" />

          {/* per-node: connector + dot */}
          {nodes.map((pos, i) => {
            const w = weekends[i]
            const raceSession = w.sessions.find(s => s.session_type === 'Race')
            const raceEnd = raceSession ? new Date(raceSession.date_end).getTime() : 0
            const done = raceEnd < now - 10 * 60_000
            const isNext = i === nextIndex
            const isImminent = w.meetingKey === imminentMeetingKey
            const cardLeft = i % 2 === 0
            const cx2 = cardLeft ? pos.x - NODE_GAP : pos.x + NODE_GAP
            const outline = getCountryPath(w.countryName)

            return (
              <g key={w.meetingKey}>
                {isNext && (
                  <circle cx={pos.x} cy={pos.y} r={22} fill={isImminent ? 'rgba(232,19,43,0.12)' : 'rgba(232,19,43,0.07)'} />
                )}
                {isNext && isImminent && (
                  <circle cx={pos.x} cy={pos.y} r={15} fill="none"
                    stroke="rgba(232,19,43,0.5)" strokeWidth="1.5"
                    style={{ animation: 'liveDotPulse 1.4s ease-in-out infinite' }} />
                )}
                {/* connector to card */}
                <line
                  x1={cardLeft ? pos.x - 5 : pos.x + 5} y1={pos.y}
                  x2={cx2} y2={pos.y}
                  stroke={isNext ? (isImminent ? 'rgba(232,19,43,0.5)' : 'rgba(232,19,43,0.3)') : 'rgba(255,255,255,0.07)'}
                  strokeWidth={isImminent ? 1.5 : 1}
                />
                {/* outer ring for next */}
                {isNext && (
                  <circle cx={pos.x} cy={pos.y} r={10} fill="none"
                    stroke={isImminent ? 'rgba(232,19,43,0.7)' : 'rgba(232,19,43,0.35)'} strokeWidth="1.5" />
                )}
                {/* country outline — rendered before dot so dot sits on top
                CHANGE THIS TO BE THE TRACK
                 */}
                {outline && (
                  <g transform={`translate(${pos.x - 100}, ${pos.y - 70}) scale(2)`} opacity={done ? 0.06 : isNext ? 0.22 : 0.12}>
                    <path d={outline} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                  </g>
                )}
                {/* node dot */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={isNext ? 7 : 4}
                  fill={isNext ? '#e8132b' : done ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.3)'}
                />
              </g>
            )
          })}
        </svg>

        {/* ── DOM layer: race cards ── */}
        {nodes.map((pos, i) => {
          const w = weekends[i]
          const raceSession = w.sessions.find(s => s.session_type === 'Race')
          const raceEnd = raceSession ? new Date(raceSession.date_end).getTime() : 0
          const done = raceEnd < now - 10 * 60_000
          const isNext = i === nextIndex
          const isImminent = w.meetingKey === imminentMeetingKey
          const cardLeft = i % 2 === 0
          const outline = getCountryPath(w.countryName)

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
                position: 'absolute',
                top: Math.min(
                  Math.max(pos.y)
                ),
                ...(cardLeft
                  ? { right: ROAD_W - pos.x + NODE_GAP }
                  : { left: pos.x + NODE_GAP }),
                width: CARD_W,
                background: isNext && isImminent
                  ? 'rgba(232,19,43,0.12)'
                  : isNext
                  ? 'rgba(232,19,43,0.05)'
                  : done
                  ? 'rgba(0,0,0,0.2)'
                  : 'rgba(255,255,255,0.025)',
                border: isNext && isImminent
                  ? '1px solid rgba(232,19,43,0.6)'
                  : isNext
                  ? '0.5px solid rgba(232,19,43,0.28)'
                  : done
                  ? '0.5px solid rgba(255,255,255,0.04)'
                  : '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 6,
                padding: '14px 18px 13px',
                opacity: done && !isNext ? 0.52 : 1,
                transition: 'opacity 0.2s, border-color 0.2s',
                cursor: isImminent ? 'pointer' : 'default',
                overflow: 'hidden',
              }}
            >
              {/* Round label */}
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.13em',
                color: isNext ? 'rgba(232,19,43,0.65)' : 'rgba(255,255,255,0.18)',
                marginBottom: 4,
              }}>
                R{w.roundNumber.toString().padStart(2, '0')}
              </div>

              {/* Flag + location */}
              <div style={{
                fontFamily: 'var(--cond)',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.01em',
                lineHeight: 1.15,
                marginBottom: 6,
                color: done ? 'rgba(255,255,255,0.4)' : isNext ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
              }}>
                
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.circuitShort}
                </span>
              </div>

              {/* Session dots */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                {sortedSessions.map(s => {
                  const meta = SESSION_META[s.session_type] ?? { label: '?', color: 'rgba(120,120,120,0.5)', order: 99 }
                  const sEnd = new Date(s.date_end).getTime()
                  const sStart = new Date(s.date_start).getTime()
                  const sDone = sEnd < now - 10 * 60_000
                  const sActive = sStart <= now && sEnd >= now - 10 * 60_000
                  return (
                    <div
                      key={s.session_key}
                      title={s.session_type}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 2,
                        background: sDone || sActive ? meta.color : 'rgba(255,255,255,0.05)',
                        border: `0.5px solid ${sDone || sActive ? 'transparent' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: sActive ? `0 0 5px ${meta.color}` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 6,
                        fontWeight: 700,
                        color: sDone || sActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)',
                        lineHeight: 1,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {raceDate && (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.05em',
                  color: 'rgba(255,255,255,0.22)',
                }}>
                  {raceDate}
                </div>
              )}

              {isImminent && (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 7,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(232,19,43,0.75)',
                  marginTop: 5,
                }}>
                  → Go live
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Headlines Feed ───────────────────────────────────────────────────────────

function HeadlinesFeed() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['f1-headlines'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:7822/headlines')
      if (!res.ok) throw new Error('unavailable')
      const json = await res.json()
      return json.items as HeadlineItem[]
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const cards = useMemo<HeadlineCard[]>(() => {
    if (!data) return []
    const fallback = '/branding/pitwall-monogram-256.png'
    const sorted = [...data].sort(
      (a, b) => headlineTimestamp(b.pubDate) - headlineTimestamp(a.pubDate)
    )
    const seen = new Set<string>()
    const out: HeadlineCard[] = []
    for (const item of sorted) {
      const topic = headlineTopicKey(item.title)
      if (seen.has(topic)) continue
      seen.add(topic)
      const rawImage = item.image || extractHeadlineImage(item.description)
      out.push({
        ...item,
        imageUrl: headlineImageProxy(rawImage) || fallback,
      })
      if (out.length >= 10) break
    }
    return out
  }, [data])

  return (
    <div style={{ marginBottom: 14, position: 'relative', zIndex: 5 }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.28)',
        marginBottom: 10,
      }}>
        F1 Headlines
      </div>

      {isLoading && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
          Fetching…
        </div>
      )}
      {isError && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, lineHeight: 1.6, color: 'rgba(255,255,255,0.15)' }}>
          Start the Pitwall bridge to enable headlines.
        </div>
      )}
      <div style={{
        background: 'rgba(0,0,0,0.10)',
        border: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: 4,
        paddingBottom: 0,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'grid', gap: 10, height: 260, overflowY: 'auto', paddingRight: 6 }}>
          {cards.map((item, i) => {
            const cardStyle: React.CSSProperties = {
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: 10,
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.025)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              textDecoration: 'none',
            }

          const image = (
            <div style={{
              width: 64,
              height: 48,
              borderRadius: 4,
              overflow: 'hidden',
              background: 'linear-gradient(140deg, rgba(232,19,43,0.22), rgba(12,14,18,0.6))',
              border: '0.5px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                onError={event => {
                  event.currentTarget.src = '/branding/pitwall-monogram-256.png'
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.9,
                }}
              />
            </div>
          )

          const sourceUrl = headlineSourceUrl(item.link)
          const content = (
            <div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.78)',
                marginBottom: 3,
              }}>
                {item.title}
              </div>
              {item.description && (
                <div style={{
                  maxHeight: 32,
                  overflowY: 'auto',
                  paddingRight: 6,
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  lineHeight: 1.45,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 4,
                }}>
                  {item.description.replace(/<[^>]+>/g, '').trim()}
                </div>
              )}
              {(item.pubDate || sourceUrl || item.source) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.05em',
                  color: 'rgba(255,255,255,0.22)',
                }}>
                  {item.pubDate && <span>{relativeTime(item.pubDate)}</span>}
                  {sourceUrl && (
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{sourceUrl}</span>
                  )}
                  {!sourceUrl && item.source && (
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{item.source}</span>
                  )}
                </div>
              )}
            </div>
          )

            if (item.link) {
              return (
                <a key={i} href={item.link} target="_blank" rel="noreferrer" style={cardStyle}>
                  {image}
                  {content}
                </a>
              )
            }

            return (
              <div key={i} style={cardStyle}>
                {image}
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ChampionshipStandingsSection() {
  return (
    <div style={{ paddingTop: 8, position: 'relative', zIndex: 1 }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 8,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.28)',
        marginBottom: 12,
      }}>
        Championship Standings
      </div>
      <SeasonStandingsPanel />
    </div>
  )
}

// ─── Next Race Card ───────────────────────────────────────────────────────────

function NextRaceCard() {
  const { session: nextRace, proximity, msToStart } = useNextRace(YEAR)
  const { setMode } = useSessionStore()

  if (!nextRace) return null

  const raceStart = new Date(nextRace.date_start)
  const isLive = proximity === 'live'
  const isImminent = proximity === 'live' || proximity === 'imminent'
  const flagUrl = countryFlagImageUrl(nextRace.country_name ?? '')

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Starting now'
    const totalMin = Math.floor(ms / 60_000)
    const d = Math.floor(totalMin / (60 * 24))
    const h = Math.floor((totalMin % (60 * 24)) / 60)
    const m = totalMin % 60
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div
      onClick={isImminent ? () => setMode('live') : undefined}
      style={{
        padding: '14px 18px',
        background: isImminent ? 'rgba(232,19,43,0.09)' : 'rgba(255,255,255,0.03)',
        border: isImminent ? '1px solid rgba(232,19,43,0.45)' : '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        marginBottom: 18,
        cursor: isImminent ? 'pointer' : 'default',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: isLive ? 'rgba(232,19,43,0.6)' : 'rgba(255,255,255,0.28)',
          marginBottom: 5,
        }}>
          {isLive ? 'Race live now' : 'Next race'}
        </div>
        <div style={{
          fontFamily: 'var(--cond)',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '0.02em',
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1,
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span
            style={{

              height: 24,
              border: '0.5px solid rgba(255,255,255,0.18)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", var(--cond)',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {flagUrl ? (
              <img
                src={flagUrl}
                alt={nextRace.country_name ? `${nextRace.country_name} flag` : 'Country flag'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              countryFlag(nextRace.country_name ?? '')
            )}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextRace.circuit_short_name ?? nextRace.country_name}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'rgba(255,255,255,0.32)',
          letterSpacing: '0.06em',
        }}>
          {raceStart.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {raceStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {isLive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--red)',
              animation: 'liveDotPulse 1.2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9,
              color: 'rgba(232,19,43,0.8)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Live</span>
          </div>
        ) : (
          <div style={{
            fontFamily: 'var(--cond)',
            fontSize: 28,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
            marginBottom: 8,
          }}>
            {formatCountdown(msToStart)}
          </div>
        )}

        {isImminent && (
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(232,19,43,0.75)',
            marginTop: 4,
          }}>
            {isLive ? 'Click to enter' : 'Starting soon'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  background: 'none',
  border: '0.5px solid var(--border)',
  borderRadius: 3,
  padding: '4px 10px',
  fontFamily: 'var(--mono)',
  fontSize: 8,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted2)',
  cursor: 'pointer',
}

export function SeasonHub() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [standingsOpen, setStandingsOpen] = useState(false)
  const [driverPickerOpen, setDriverPickerOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { setMode } = useSessionStore()
  const logEntries = useLogStore((s) => s.entries)
  const hasErrors = logEntries.some((e) => e.level === 'ERR')
  const { session: nextRaceSession, proximity } = useNextRace(YEAR)
  const imminentMeetingKey = (proximity === 'live' || proximity === 'imminent')
    ? (nextRaceSession?.meeting_key ?? null)
    : null

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { data: sessions } = useSessions(YEAR)

  const weekends = useMemo(() => {
    if (!sessions) return []
    return groupIntoWeekends(sessions)
  }, [sessions])

  const completedRaces = weekends.filter(w => {
    const r = w.sessions.find(s => s.session_type === 'Race')
    return r && new Date(r.date_end).getTime() < now - 10 * 60_000
  }).length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 42,
        display: 'flex',
        alignItems: 'center',
        paddingInline: 18,
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg2)',
        flexShrink: 0,
        // @ts-ignore
        WebkitAppRegion: 'drag',
        gap: 12,
      }}>
        <div style={{
          fontFamily: 'var(--cond)',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          userSelect: 'none',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
        }}>
          PIT<span style={{ color: 'var(--red)' }}>W</span>ALL
        </div>

        {weekends.length > 0 && (
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.22)',
            textTransform: 'uppercase',
          }}>
            {YEAR} · {completedRaces}/{weekends.length} races
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
        }}>
          <button
            onClick={() => setStandingsOpen(true)}
            title={`${YEAR} Championship Standings`}
            style={navBtn}
          >
            Standings
          </button>
          <button
            onClick={() => setDriverPickerOpen(true)}
            title="Open driver picker"
            style={navBtn}
          >
            Drivers
          </button>
          <button
            onClick={() => setLogOpen((v) => !v)}
            title="Open diagnostic log"
            style={{ ...navBtn, color: hasErrors ? 'var(--red)' : 'var(--muted2)' }}
          >
            Log
          </button>
          <button onClick={() => setMode('demo')} style={navBtn}>Canvas</button>
          <button onClick={() => setSettingsOpen(true)} style={{ ...navBtn, color: 'var(--muted)' }}>Settings</button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left column: Road Calendar */}
        <div style={{
          width: 600,
          flexShrink: 0,
          borderRight: '0.5px solid rgba(255,255,255,0.055)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '13px 20px 10px',
            flexShrink: 0,
            borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.22)',
            }}>
              Race Calendar
            </span>
          </div>
          <RoadCalendar weekends={weekends} now={now} imminentMeetingKey={imminentMeetingKey} />
        </div>

        {/* Right column: Next Race + Headlines + Standings */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 24px 48px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.07) transparent',
        }}>
          <NextRaceCard />
          <HeadlinesFeed />
          <ChampionshipStandingsSection />
        </div>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {standingsOpen && <SeasonStandingsModal onClose={() => setStandingsOpen(false)} />}
      {driverPickerOpen && <DriverManagerPanel onClose={() => setDriverPickerOpen(false)} />}
      <DiagnosticLog open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  )
}
