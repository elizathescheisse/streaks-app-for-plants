import { useState, useRef, useEffect } from 'react'
import styles from './PlantHistoryChart.module.css'

const WINDOWS = [
  { key: '1W',  label: '1W',  days: 7   },
  { key: '1M',  label: '1M',  days: 30  },
  { key: '3M',  label: '3M',  days: 90  },
  { key: 'all', label: 'All', days: Infinity },
]

// SVG vertical layout (fixed pixel heights)
const PAD_X    = 16
const TOP_ZONE = 26
const BOT_ZONE = 30
const PLOT_H   = 60
const SVG_H    = TOP_ZONE + PLOT_H + BOT_ZONE
const PLOT_TOP = TOP_ZONE
const PLOT_BOT = TOP_ZONE + PLOT_H

function mToY(moisture) {
  return PLOT_TOP + (1 - moisture / 10) * PLOT_H
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
// Tooltip uses date + time so two events on the same day stay distinguishable.
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

// Color a dot based on whether the moisture reading is within the ideal range.
// Returns a CSS color string (uses design tokens where possible).
// Falls back to the existing blue if no range is known for this species.
function dotColor(moisture, careProfile) {
  const range = careProfile?.moistureRange
  if (!range || range[0] == null) return 'rgba(140,204,235,0.9)'
  const [lo, hi] = range
  const val = Number(moisture)

  if (careProfile?.wateringStyle === 'flood-and-dry') {
    const dry = careProfile.dryThreshold ?? lo
    if (val < dry)        return 'var(--status-struggling)'  // below threshold — red
    if (val <= dry + 1)   return 'var(--status-okay)'        // at/near threshold — yellow
    return                       'var(--status-thriving)'    // drying out, healthy — green
  }

  if (val >= lo && val <= hi) return 'var(--status-thriving)'   // in range — green
  const dist = val < lo ? lo - val : val - hi
  if (dist <= 1) return 'var(--status-okay)'                    // slightly outside — yellow
  return 'var(--status-struggling)'                             // far outside — red
}

function waterAbbr(unit, amount) {
  if (!amount || String(amount).trim() === '') return null
  if (unit === 'cups')   return `${amount}c`
  if (unit === 'liters') return `${amount}L`
  return String(amount).slice(0, 6)
}

// Clip a fitted segment ({ startTs, endTs, startLevel, endLevel }) to the
// visible time range, interpolating the levels at the clamped ends. The fit
// runs over the plant's full history once, so the line stays identical as the
// user flips 1W/1M/3M/All — only the visible slice changes. Returns null when
// the segment doesn't overlap the range.
function clipSegment(seg, rangeMin, rangeMax) {
  const start = Math.max(seg.startTs, rangeMin)
  const end = Math.min(seg.endTs, rangeMax)
  if (start >= end) return null
  const levelAt = (t) =>
    seg.startLevel + (seg.endLevel - seg.startLevel) * (t - seg.startTs) / (seg.endTs - seg.startTs)
  return { startTs: start, endTs: end, startLevel: levelAt(start), endLevel: levelAt(end) }
}

// `fittedSegments` (from fitMoistureSeries, passed only when the model is
// confident) replaces the connect-the-dots trend line with the model's best
// guess of true moisture — dashed, because it's estimated, not measured. The
// raw dots always stay: where the line and a dot disagree, the disagreement
// itself is information (probably a probe artifact).
// `windowOffset` pans the visible window into the past: 0 = the window ending
// now (the default everywhere), 1 = the window before that, and so on. Only
// the detail page exposes controls for it; cards stay pinned to the present.
export default function PlantHistoryChart({ readings, waterings, careProfile, window: win = '1M', predictedMoisture = null, fittedSegments = null, windowOffset = 0 }) {
  const containerRef = useRef(null)
  const [svgWidth, setSvgWidth] = useState(400)
  // tooltip: { kind: 'reading' | 'watering', event, x, y } | null
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setSvgWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Filter by window. 'All' spans everything and can't be panned; the sized
  // windows slide `windowOffset` window-lengths into the past, so offset 0 is
  // "the last N days" (unchanged behaviour) and offset 1 is the N days before
  // that. Panned windows are bounded at BOTH ends; the current window keeps its
  // open right edge so a fresh reading always lands at the axis end.
  const nowTs = Date.now()
  const windowDays = WINDOWS.find(w => w.key === win)?.days ?? Infinity
  const canPan = windowDays !== Infinity
  const offset = canPan ? Math.max(0, windowOffset) : 0
  const isCurrentWindow = offset === 0
  const winMs = windowDays * 86_400_000
  const windowEndTs = canPan ? nowTs - offset * winMs : null
  const cutoff = canPan ? new Date(windowEndTs - winMs) : null
  const endCutoff = canPan && !isCurrentWindow ? new Date(windowEndTs) : null

  const inWindow = (ts) => {
    const t = +new Date(ts)
    if (cutoff && t < +cutoff) return false
    if (endCutoff && t > +endCutoff) return false
    return true
  }

  const visibleReadings = (readings ?? [])
    .filter(r => inWindow(r.timestamp))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const visibleWaterings = (waterings ?? [])
    .filter(w => inWindow(w.timestamp))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const n = visibleReadings.length
  const usableW = svgWidth - PAD_X * 2

  // Time-based x-axis: spans from the start of the selected window to latest event.
  // Anchoring to the window cutoff (not just the earliest data point) means all plants
  // share the same time scale — a plant with only 1 week of data viewed in 3M shows
  // its data on the right, with empty space on the left, rather than stretching to fill.
  const allTimestamps = [
    ...visibleReadings.map(r => +new Date(r.timestamp)),
    ...visibleWaterings.map(w => +new Date(w.timestamp)),
  ]
  const windowStart = cutoff ? +cutoff : (allTimestamps.length ? Math.min(...allTimestamps) : 0)
  const tMin   = allTimestamps.length ? Math.min(windowStart, Math.min(...allTimestamps)) : windowStart
  const tMax   = allTimestamps.length ? Math.max(...allTimestamps) : 1
  // The "now" projection only makes sense in the window that actually contains
  // now — panned back in time there is no "today" to project to.
  const showEstimate = predictedMoisture != null && isCurrentWindow
  // When showing an estimated "now" dot, extend the axis to the current time
  // so the predicted point sits at the right edge rather than on top of the last reading.
  // Panned windows anchor to the window's own end instead, so consecutive
  // windows line up and stepping back doesn't rescale the axis unpredictably.
  const tMaxFull = showEstimate ? Math.max(tMax, nowTs)
    : !isCurrentWindow ? Math.max(tMax, windowEndTs)
    : tMax
  const tSpan  = tMaxFull - tMin || 1

  function xAt(ts) {
    return PAD_X + ((+new Date(ts) - tMin) / tSpan) * usableW
  }

  // Ideal range / dry threshold
  const isFloodAndDry   = careProfile?.wateringStyle === 'flood-and-dry'
  const [rLo, rHi]      = careProfile?.moistureRange ?? [null, null]
  const rangeY1         = rHi != null ? mToY(rHi) : null
  const rangeY2         = rLo != null ? mToY(rLo) : null
  const dryThreshold    = careProfile?.dryThreshold ?? rLo
  const thresholdY      = dryThreshold != null ? mToY(dryThreshold) : null

  // Build per-date groups so same-day readings share one centered label
  const dateMap = new Map()
  visibleReadings.forEach(r => {
    const key = fmtDate(r.timestamp)
    const x   = xAt(r.timestamp)
    if (!dateMap.has(key)) dateMap.set(key, { key, minX: x, maxX: x })
    else {
      const g = dateMap.get(key)
      g.minX = Math.min(g.minX, x)
      g.maxX = Math.max(g.maxX, x)
    }
  })
  // Unique dates sorted left→right, each with a center x for the group
  const uniqueDates = [...dateMap.values()]
    .sort((a, b) => a.minX - b.minX)
    .map(g => ({ dateStr: g.key, x: (g.minX + g.maxX) / 2 }))

  // Sample up to 6 unique dates (evenly spaced), then drop any that are
  // truly too close to render even staggered (min 18px gap).
  // Labels that are close but renderable get a row=1 bump so they stagger down.
  const MAX_LABELS   = 6
  const DROP_SPACING = 18   // drop if closer than this even with stagger
  const STAGGER_AT   = 56   // stagger (bump to lower row) if closer than this (~label width + gap)
  const nd = uniqueDates.length
  let sampled
  if (nd <= MAX_LABELS) {
    sampled = uniqueDates
  } else {
    const picked = new Set([0, nd - 1])
    for (let i = 1; i < MAX_LABELS - 1; i++) {
      picked.add(Math.round(i * (nd - 1) / (MAX_LABELS - 1)))
    }
    sampled = [...picked].sort((a, b) => a - b).map(i => uniqueDates[i])
  }
  // Build labels, dropping only truly colliding ones, staggering the rest
  const dateLabels = []
  let lastLabelX = -Infinity
  for (const l of sampled) {
    const gap = l.x - lastLabelX
    if (gap < DROP_SPACING) continue
    const row = gap < STAGGER_AT ? 1 : 0
    dateLabels.push({ ...l, row })
    lastLabelX = l.x
  }

  const polyPoints = visibleReadings
    .map(r => `${xAt(r.timestamp)},${mToY(r.moisture)}`)
    .join(' ')

  // Fitted-line segments clipped to the visible window. One dashed polyline
  // per drying cycle; the gap at each watering's vertical IS the jump.
  const visibleFitted = (fittedSegments ?? [])
    .map(s => clipSegment(s, tMin, tMaxFull))
    .filter(Boolean)

  return (
    <div className={styles.wrap} ref={containerRef} onTouchStart={() => setTooltip(null)}>
      {n < 2 ? (
        <p className={styles.empty}>Not enough readings for this range</p>
      ) : (
        <div className={styles.svgWrap}>
        {tooltip && (
          <div
            className={styles.tooltip}
            style={{
              left: Math.min(Math.max(tooltip.x, 48), svgWidth - 48),
              top: tooltip.y - 8,
            }}
          >
            <span className={styles.tooltipMoisture}>
              {tooltip.kind === 'watering'
                ? `💧 ${tooltip.event.amount} ${tooltip.event.unit}`
                : tooltip.kind === 'estimated'
                ? `◎ ~${Math.round(predictedMoisture)} (estimated)`
                : `◎ ${tooltip.event.moisture} / 10`}
            </span>
            {tooltip.kind !== 'estimated' && (
              <span className={styles.tooltipDate}>{fmtDateTime(tooltip.event.timestamp)}</span>
            )}
          </div>
        )}
        <svg width={svgWidth} height={SVG_H} className={styles.svg}>

          {/* Flood-and-dry: single dashed threshold line */}
          {isFloodAndDry && thresholdY != null && (
            <line x1={PAD_X} y1={thresholdY} x2={svgWidth - PAD_X} y2={thresholdY}
              stroke="rgba(245,212,0,0.5)" strokeWidth="1" strokeDasharray="4,3"/>
          )}

          {/* Consistent: ideal moisture range band */}
          {!isFloodAndDry && rangeY1 != null && (
            <>
              <rect
                x={PAD_X} y={rangeY1}
                width={usableW} height={rangeY2 - rangeY1}
                fill="rgba(56,178,71,0.12)"
              />
              <line x1={PAD_X} y1={rangeY1} x2={svgWidth - PAD_X} y2={rangeY1}
                stroke="rgba(56,178,71,0.35)" strokeWidth="0.75" strokeDasharray="4,3"/>
              <line x1={PAD_X} y1={rangeY2} x2={svgWidth - PAD_X} y2={rangeY2}
                stroke="rgba(56,178,71,0.35)" strokeWidth="0.75" strokeDasharray="4,3"/>
            </>
          )}

          {/* Moisture trend line: the fitted true-moisture estimate (dashed —
              it's the model's belief, not a measurement) when the model has
              earned confidence, else the raw connect-the-dots polyline. */}
          {visibleFitted.length > 0 ? (
            visibleFitted.map((s, i) => (
              <polyline
                key={`fit-${i}`}
                points={`${xAt(s.startTs)},${mToY(s.startLevel)} ${xAt(s.endTs)},${mToY(s.endLevel)}`}
                fill="none"
                stroke="rgba(140,204,235,0.65)"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                strokeLinecap="round"
              />
            ))
          ) : (
            <polyline
              points={polyPoints}
              fill="none"
              stroke="rgba(140,204,235,0.65)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Reading dots — colored by range, grow on hover/tap to show tooltip */}
          {visibleReadings.map((r, i) => {
            const x = xAt(r.timestamp)
            const y = mToY(r.moisture)
            const fill = dotColor(r.moisture, careProfile)
            const isHovered = tooltip?.event?.id === r.id
            return (
              <circle
                key={r.id}
                cx={x} cy={y}
                r={isHovered ? 5.5 : 4}
                fill={fill}
                opacity="0.9"
                style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                onMouseEnter={() => setTooltip({ kind: 'reading', event: r, x, y })}
                onMouseLeave={() => setTooltip(null)}
                onTouchStart={e => {
                  e.stopPropagation()
                  setTooltip(t => t?.event?.id === r.id ? null : { kind: 'reading', event: r, x, y })
                }}
              />
            )
          })}

          {/* Estimated "now" projection — dashed line + hollow dot */}
          {showEstimate && visibleReadings.length >= 1 && (() => {
            const lastR  = visibleReadings[visibleReadings.length - 1]
            const estX   = xAt(nowTs)
            const estY   = mToY(Math.min(10, Math.max(0, predictedMoisture)))
            const lastX  = xAt(lastR.timestamp)
            const lastY  = mToY(lastR.moisture)
            const estColor = dotColor(predictedMoisture, careProfile)
            const isHovered = tooltip?.kind === 'estimated'
            return (
              <g key="est">
                {/* Dashed continuation from last reading to now */}
                <line
                  x1={lastX} y1={lastY} x2={estX} y2={estY}
                  stroke="rgba(140,204,235,0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  strokeLinecap="round"
                />
                {/* Solid dot — matches MoistureBar's estimated dot style */}
                <circle
                  cx={estX} cy={estY}
                  r={isHovered ? 5.5 : 4}
                  fill={estColor}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={() => setTooltip({ kind: 'estimated', x: estX, y: estY })}
                  onMouseLeave={() => setTooltip(null)}
                  onTouchStart={e => {
                    e.stopPropagation()
                    setTooltip(t => t?.kind === 'estimated' ? null : { kind: 'estimated', x: estX, y: estY })
                  }}
                />
                {/* Dashed ring — same visual as MoistureBar's dotPredicted ::after */}
                <circle
                  cx={estX} cy={estY}
                  r={isHovered ? 9 : 7.5}
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="3,2.5"
                  style={{ pointerEvents: 'none' }}
                />
                {/* "Today" date label — centered on the estimated dot */}
                <text
                  x={estX} y={PLOT_BOT + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                  fill="rgba(150,180,150,0.55)"
                >today</text>
              </g>
            )
          })()}

          {/* Watering annotations — hover to see exact amount + timestamp */}
          {visibleWaterings.map(w => {
            const x = xAt(w.timestamp)
            const label = waterAbbr(w.unit, w.amount)
            if (!label) return null
            const tipY = PLOT_TOP - 8                          // anchor tooltip near the label
            return (
              <g
                key={w.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({ kind: 'watering', event: w, x, y: tipY })}
                onMouseLeave={() => setTooltip(null)}
                onTouchStart={e => {
                  e.stopPropagation()
                  setTooltip(t => t?.event?.id === w.id ? null : { kind: 'watering', event: w, x, y: tipY })
                }}
              >
                <line
                  x1={x} y1={PLOT_TOP - 4}
                  x2={x} y2={PLOT_BOT}
                  stroke="rgba(140,204,235,0.25)"
                  strokeWidth="0.75"
                  strokeDasharray="2,2"
                />
                <text
                  x={x} y={PLOT_TOP - 6}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="Inter, sans-serif"
                  fill="rgba(140,204,235,0.85)"
                >💧{label}</text>
                {/* transparent hit area widens the hover target */}
                <rect
                  x={x - 14} y={PLOT_TOP - 16}
                  width={28} height={20}
                  fill="transparent"
                />
              </g>
            )
          })}

          {/* Date labels along the bottom — stagger down when labels are close */}
          {dateLabels.map((l, i) => {
            const anchor = i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'
            const y = PLOT_BOT + 14 + (l.row ?? 0) * 11
            return (
              <text
                key={`dl-${l.dateStr}`}
                x={l.x} y={y}
                textAnchor={anchor}
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fill="rgba(150,180,150,0.55)"
              >{l.dateStr}</text>
            )
          })}

          {/* Y-axis moisture labels */}
          {[0, 5, 10].map(v => (
            <text
              key={`yl-${v}`}
              x={PAD_X - 4}
              y={mToY(v) + 3}
              textAnchor="end"
              fontSize="8"
              fontFamily="Inter, sans-serif"
              fill="rgba(150,180,150,0.4)"
            >{v}</text>
          ))}

        </svg>
        </div>
      )}
    </div>
  )
}
