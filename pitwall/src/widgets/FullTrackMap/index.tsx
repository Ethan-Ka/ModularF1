import { useRef, useEffect, useMemo, useState } from 'react'
import { usePositions } from '../../hooks/usePositions'
import { useIntervals } from '../../hooks/useIntervals'
import { useDriverStore } from '../../store/driverStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'

interface FullTrackMapProps {
  widgetId: string
}

interface DriverDot {
  driverNumber: number
  abbr: string
  color: string
  cx: number
  cy: number
  gapToLeader: number | null
}

// Simple oval track path — a placeholder closed bezier
function buildTrackPath(cx: number, cy: number, rx: number, ry: number): string {
  // Approximate circuit shape with a squircle-like closed bezier
  const k = 0.55 // bezier control point factor
  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + rx * k} ${cy - ry}, ${cx + rx} ${cy - ry * k}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ry * k}, ${cx + rx * k} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - rx * k} ${cy + ry}, ${cx - rx} ${cy + ry * k}, ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ry * k}, ${cx - rx * k} ${cy - ry}, ${cx} ${cy - ry}`,
    'Z',
  ].join(' ')
}

// Map gap_to_leader (seconds) to a 0–1 progress around the track
// Leader is at 0, 90s behind ≈ full lap behind
function gapToAngle(gap: number | null, totalGap: number): number {
  if (gap === null) return 0
  // Simple heuristic: spread drivers based on normalized gap
  return (gap / Math.max(totalGap, 1)) * (Math.PI * 2)
}

export function FullTrackMap({ widgetId: _ }: FullTrackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 300, height: 240 })
  const [hoveredDriver, setHoveredDriver] = useState<number | null>(null)

  const { data: positions } = usePositions()
  const { data: intervals } = useIntervals()
  const { getDriver, getTeamColor } = useDriverStore()
  const refreshFade = useRefreshFade([positions, intervals])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width: Math.max(120, width), height: Math.max(100, height) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const intervalMap = new Map(intervals?.map((i) => [i.driver_number, i]) ?? [])

  const maxGap = intervals
    ? Math.max(...intervals.map((i) => i.gap_to_leader ?? 0), 90)
    : 90

  const cx = size.width / 2
  const cy = size.height / 2
  const rx = size.width * 0.38
  const ry = size.height * 0.36
  const trackPath = buildTrackPath(cx, cy, rx, ry)

  // Place drivers around the track ellipse based on position/gap
  const sorted = positions ? [...positions].sort((a, b) => a.position - b.position) : []

  const dots: DriverDot[] = sorted.map((pos) => {
    const interval = intervalMap.get(pos.driver_number)
    const gap = interval?.gap_to_leader ?? null
    const angle = gapToAngle(gap, maxGap)
    // Start at top of oval (−π/2), go clockwise
    const theta = -Math.PI / 2 + angle
    return {
      driverNumber: pos.driver_number,
      abbr: getDriver(pos.driver_number)?.name_acronym ?? `${pos.driver_number}`,
      color: getTeamColor(pos.driver_number),
      cx: cx + rx * Math.cos(theta),
      cy: cy + ry * Math.sin(theta),
      gapToLeader: gap,
    }
  })

  // Battle proximity: pairs within 1s of each other.
  // Memoized so the O(n²) scan does not run on every render tick caused by
  // the 2s intervals poll or 3s positions poll.
  const battlePairs = useMemo(() => {
    const pairs = new Set<number>()
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const gi = dots[i].gapToLeader ?? 0
        const gj = dots[j].gapToLeader ?? 0
        if (Math.abs(gi - gj) < 1) {
          pairs.add(dots[i].driverNumber)
          pairs.add(dots[j].driverNumber)
        }
      }
    }
    return pairs
  // dots is recomputed from positions+intervals so using it as the dep is correct
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, intervals])

  return (
    <div
      ref={containerRef}
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <svg
        width={size.width}
        height={size.height}
        style={{ display: 'block' }}
      >
        {/* Track outline — outer */}
        <path
          d={buildTrackPath(cx, cy, rx + 8, ry + 6)}
          fill="none"
          stroke="var(--border2)"
          strokeWidth={10}
        />
        {/* Track outline — inner line */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border3)"
          strokeWidth={2}
        />

        {/* Battle proximity rings */}
        {dots.filter((d) => battlePairs.has(d.driverNumber)).map((d) => (
          <circle
            key={`battle-${d.driverNumber}`}
            cx={d.cx}
            cy={d.cy}
            r={10}
            fill="none"
            stroke="var(--amber)"
            strokeWidth={0.8}
            strokeDasharray="3 2"
            opacity={0.7}
          />
        ))}

        {/* Driver dots */}
        {dots.map((d) => {
          const isHovered = hoveredDriver === d.driverNumber
          return (
            <g key={d.driverNumber}>
              <circle
                cx={d.cx}
                cy={d.cy}
                r={isHovered ? 8 : 5}
                fill={d.color}
                style={{
                  filter: `drop-shadow(0 0 4px ${d.color}99)`,
                  cursor: 'pointer',
                  transition: 'r 0.15s',
                }}
                onMouseEnter={() => setHoveredDriver(d.driverNumber)}
                onMouseLeave={() => setHoveredDriver(null)}
              />
              {isHovered && (
                <text
                  x={d.cx}
                  y={d.cy - 12}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize={8}
                  fill="var(--white)"
                  letterSpacing="0.06em"
                >
                  {d.abbr}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* No data overlay */}
      {sorted.length === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--muted2)',
        }}>
          Waiting for position data…
        </div>
      )}
    </div>
  )
}
