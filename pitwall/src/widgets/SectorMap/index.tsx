export const HELP = `# Sector Map

Detailed circuit diagram with a live track outline and driver position dots overlaid. Sector timing cards for the focused driver are shown at the bottom.

- **Track outline**: SVG polyline of the circuit derived from FastF1 coordinate data, aligned with the circuit image.
- **Driver dots**: Coloured dots representing each driver's current on-track position, labelled with their three-letter code.
- **Sector cards**: S1 / S2 / S3 split times for the most recent lap of the focused driver. Personal bests are highlighted in green.

Unfamiliar terms:

- *Sector*: One of three official timing segments the lap is divided into for split time measurement (S1, S2, S3).
- *Track position*: Mapped from raw x/y metric coordinates (FastF1) through a shared normaliser that keeps positions consistent across all track map widgets.

Notes: circuit map data is loaded from static circuit assets bundled with the app. If a circuit is not yet in the asset library, the widget will fall back to an empty state. Live driver positions require an active FastF1 session.
`
import { useMemo, useRef, useEffect, useState } from 'react'
import { useLaps } from '../../hooks/useLaps'
import { useWidgetDriver } from '../../hooks/useWidgetDriver'
import { useWidgetConfig } from '../../hooks/useWidgetConfig'
import { useDriverStore } from '../../store/driverStore'
import { useSessionStore } from '../../store/sessionStore'
import { useRefreshFade } from '../../hooks/useRefreshFade'
import { useLocation } from '../../hooks/useLocation'
import { useCircuitMap } from '../../hooks/useCircuitMap'
import { useFakeTelemetryStore } from '../../store/fakeTelemetryStore'
import { useTrackDetailAsset } from '../../hooks/useTrackDetailAsset'
import { MELBOURNE_CIRCUIT_MAP } from '../../data/melbourneCircuitMap'
import { makeNormalizer, bboxFromPoints } from '../../lib/trackNormalizer'
import { formatTime } from '../widgetUtils'
import type { FastF1SessionRef } from '../../api/fastf1Bridge'

export function SectorMap({ widgetId }: { widgetId: string }) {
  const config = useWidgetConfig(widgetId)
  const { driverNumber, badgeLabel } = useWidgetDriver(config?.driverContext ?? 'FOCUS')
  const getDriver = useDriverStore((s) => s.getDriver)
  const getTeamColor = useDriverStore((s) => s.getTeamColor)
  const mode = useSessionStore((s) => s.mode)
  const fakeEnabled = useFakeTelemetryStore((s) => s.enabled)

  const activeSession = useSessionStore((s) => s.activeSession)
  const fakeNoSession = fakeEnabled && !activeSession
  const assetYear = activeSession?.year ?? (fakeNoSession ? 2026 : null)
  const assetRound = activeSession != null ? null : (fakeNoSession ? 1 : null)
  const assetCircuit = assetRound == null ? (activeSession?.circuit_short_name ?? null) : null

  const detailAsset = useTrackDetailAsset(assetYear, assetRound, assetCircuit)
  const detailedImageUrl = detailAsset?.url ?? null
  const detailRotation = detailAsset?.detailRotation ?? 0

  const [imgAspect, setImgAspect] = useState<number | null>(null)
  useEffect(() => { setImgAspect(null) }, [detailedImageUrl])

  const { data: laps } = useLaps(driverNumber ?? undefined, {
    refetchIntervalMs: mode === 'live' ? 60_000 : 15_000,
  })
  const refreshFade = useRefreshFade([driverNumber, laps])

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 300, height: 260 })
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width: Math.max(120, width), height: Math.max(100, height) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { data: driverPositions, trackPoints } = useLocation()
  const { data: circuitMap } = useCircuitMap(null)

  const fakeFallbackRef: FastF1SessionRef | null =
    fakeEnabled ? { year: activeSession?.year ?? 2026, round: 1, session: 'R' } : null
  const { data: fallbackCircuitMap } = useCircuitMap(fakeFallbackRef)
  const effectiveCircuitMap = fakeEnabled
    ? (circuitMap ?? fallbackCircuitMap ?? MELBOURNE_CIRCUIT_MAP)
    : null

  const timedLaps = useMemo(
    () =>
      [...(laps ?? [])]
        .sort((a, b) => b.lap_number - a.lap_number)
        .filter((lap) => lap.lap_duration != null),
    [laps],
  )

  const lastLap = timedLaps[0] ?? null

  const bestS1 = useMemo(
    () => Math.min(...timedLaps.map((l) => l.duration_sector_1 ?? Number.POSITIVE_INFINITY)),
    [timedLaps],
  )
  const bestS2 = useMemo(
    () => Math.min(...timedLaps.map((l) => l.duration_sector_2 ?? Number.POSITIVE_INFINITY)),
    [timedLaps],
  )
  const bestS3 = useMemo(
    () => Math.min(...timedLaps.map((l) => l.duration_sector_3 ?? Number.POSITIVE_INFINITY)),
    [timedLaps],
  )

  const bbox = useMemo(() => {
    if (effectiveCircuitMap) return effectiveCircuitMap.bbox
    if (trackPoints.length > 3) return bboxFromPoints(trackPoints)
    return null
  }, [effectiveCircuitMap, trackPoints])

  // Letterbox bounds: where the image actually renders within the container under objectFit:contain
  const imageBounds = useMemo(() => {
    if (imgAspect == null) return null
    const containerAspect = size.width / size.height
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number
    if (imgAspect > containerAspect) {
      renderedW = size.width
      renderedH = size.width / imgAspect
      offsetX = 0
      offsetY = (size.height - renderedH) / 2
    } else {
      renderedH = size.height
      renderedW = size.height * imgAspect
      offsetX = (size.width - renderedW) / 2
      offsetY = 0
    }
    return { offsetX, offsetY, renderedW, renderedH }
  }, [imgAspect, size])

  // Normalizer uses rendered image dimensions so dots map onto image area, not full container
  const normalizer = useMemo(() => {
    if (!bbox) return null
    const w = imageBounds?.renderedW ?? size.width
    const h = imageBounds?.renderedH ?? size.height
    return makeNormalizer(bbox, w, h, 5)
  }, [bbox, imageBounds, size])

  const dots = useMemo(() => {
    if (!normalizer || !driverPositions) return []
    const visible = driverNumber != null
      ? driverPositions.filter((dp) => dp.driverNumber === driverNumber)
      : driverPositions
    return visible.map((dp) => {
      const { svgX, svgY } = normalizer.toSVG(dp.x, dp.y)
      const driver = getDriver(dp.driverNumber)
      return {
        driverNumber: dp.driverNumber,
        abbr: driver?.name_acronym ?? `${dp.driverNumber}`,
        color: getTeamColor(dp.driverNumber),
        svgX,
        svgY,
      }
    })
  }, [driverPositions, driverNumber, normalizer, getDriver, getTeamColor])

  // --- Track polyline logic (mirrors FullTrackMap) ---
  const trackPolyline = useMemo(() => {
    if (!normalizer) return ''
    if (!effectiveCircuitMap && trackPoints.length < 50) return ''
    const pts = effectiveCircuitMap
      ? effectiveCircuitMap.x.map((x, i) => normalizer.toSVG(x, effectiveCircuitMap.y[i]))
      : trackPoints.map((p) => normalizer.toSVG(p.x, p.y))
    return pts.map((p) => `${p.svgX.toFixed(1)},${p.svgY.toFixed(1)}`).join(' ')
  }, [effectiveCircuitMap, trackPoints, normalizer])

  const driver = driverNumber != null ? getDriver(driverNumber) : null
  const teamColor = driverNumber != null ? getTeamColor(driverNumber) : 'var(--muted2)'
  const acronym = driver?.name_acronym ?? (driverNumber != null ? `#${driverNumber}` : null)

  const s1 = lastLap?.duration_sector_1 ?? null
  const s2 = lastLap?.duration_sector_2 ?? null
  const s3 = lastLap?.duration_sector_3 ?? null

  const s1Best = s1 != null && s1 <= bestS1 + 0.0005
  const s2Best = s2 != null && s2 <= bestS2 + 0.0005
  const s3Best = s3 != null && s3 <= bestS3 + 0.0005

  const hasSectorData = s1 != null || s2 != null || s3 != null

  // SVG-space rotation to align the FastF1 coordinate data with the circuit image.
  // Applied as an SVG transform="rotate(angle, cx, cy)" inside each SVG so it operates
  // in coordinate space — not CSS layout space. This correctly repositions both the
  // track polyline and driver dots relative to the image without disturbing the letterbox
  // geometry that objectFit:contain computes from the image's natural dimensions.
  const svgW = imageBounds?.renderedW ?? size.width
  const svgH = imageBounds?.renderedH ?? size.height
  const svgCx = (svgW / 2).toFixed(1)
  const svgCy = (svgH / 2).toFixed(1)
  const svgRotate = detailRotation !== 0
    ? `rotate(${detailRotation}, ${svgCx}, ${svgCy})`
    : undefined

  return (
    <div
      ref={containerRef}
      className={refreshFade ? 'data-refresh-fade' : undefined}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {detailedImageUrl ? (
          <img
            src={detailedImageUrl}
            alt="Circuit layout"
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setImgAspect(img.naturalWidth / img.naturalHeight)
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--muted2)',
            }}
          >
            No circuit image
          </div>
        )}

        {/* Track polyline SVG — rotated in coordinate space to align with circuit image */}
        {trackPolyline.length > 0 && (
          <svg
            width={svgW}
            height={svgH}
            style={{
              position: 'absolute',
              top: imageBounds?.offsetY ?? 0,
              left: imageBounds?.offsetX ?? 0,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <g transform={svgRotate}>
              <polyline
                points={trackPolyline}
                fill="none"
                stroke="var(--border2)"
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={trackPolyline}
                fill="none"
                stroke="var(--border3)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        )}

        {/* Driver dots SVG — same coordinate-space rotation keeps dots on track */}
        {dots.length > 0 && (
          <svg
            width={svgW}
            height={svgH}
            style={{
              position: 'absolute',
              top: imageBounds?.offsetY ?? 0,
              left: imageBounds?.offsetX ?? 0,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <g transform={svgRotate}>
            {dots.map((d) => (
              <g key={d.driverNumber}>
                <circle
                  cx={d.svgX}
                  cy={d.svgY}
                  r={5}
                  fill={d.color}
                  style={{ filter: `drop-shadow(0 0 3px ${d.color}99)` }}
                />
                <text
                  x={d.svgX}
                  y={d.svgY - 8}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize={7}
                  fill={`${d.color}cc`}
                  letterSpacing="0.06em"
                >
                  {d.abbr}
                </text>
              </g>
            ))}
            </g>
          </svg>
        )}
      </div>

      {/* Driver acronym badge — stays fixed outside the SVG layers */}
      {driverNumber != null && acronym != null && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 3,
              height: 14,
              borderRadius: 2,
              background: teamColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--white)',
              background: 'rgba(0,0,0,0.65)',
              padding: '2px 5px',
              borderRadius: 3,
              border: '0.5px solid var(--border)',
            }}
          >
            {acronym}
          </span>
          {badgeLabel && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 7,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                background: 'rgba(0,0,0,0.55)',
                padding: '2px 4px',
                borderRadius: 3,
              }}
            >
              {badgeLabel}
            </span>
          )}
        </div>
      )}

      {/* Sector time cards — outside the rotation wrapper so they stay fixed at the bottom */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        right: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 5,
        zIndex: 1,
      }}>
        {driverNumber == null ? (
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(0,0,0,0.6)',
            border: '0.5px solid var(--border)',
            borderRadius: 4,
            padding: '6px 8px',
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--muted2)',
            textAlign: 'center',
          }}>
            Focus a driver to see sector data
          </div>
        ) : hasSectorData ? (
          <>
            <SectorCard label="S1" value={s1} isBest={s1Best} />
            <SectorCard label="S2" value={s2} isBest={s2Best} />
            <SectorCard label="S3" value={s3} isBest={s3Best} />
          </>
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(0,0,0,0.6)',
            border: '0.5px solid var(--border)',
            borderRadius: 4,
            padding: '6px 8px',
            fontFamily: 'var(--mono)',
            fontSize: 8,
            color: 'var(--muted2)',
            textAlign: 'center',
          }}>
            Waiting for sector data…
          </div>
        )}
      </div>
    </div>
  )
}

function SectorCard({
  label,
  value,
  isBest,
}: {
  label: string
  value: number | null
  isBest: boolean
}) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.7)',
        border: `0.5px solid ${isBest ? 'rgba(29,184,106,0.5)' : 'var(--border)'}`,
        borderRadius: 4,
        padding: '5px 7px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 7,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 16,
          lineHeight: 1,
          color: isBest ? 'var(--green)' : 'var(--white)',
          fontWeight: 700,
        }}
      >
        {formatTime(value)}
      </div>
    </div>
  )
}
