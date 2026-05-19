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
const BOT_ZONE = 20
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
function dotColor(moisture, range) {
  if (!range || range[0] == null) return 'rgba(140,204,235,0.9)'
  const [lo, hi] = range
  const val = Number(moisture)
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

export default function PlantHistoryChart({ readings, waterings, careProfile, window: win = '1M' }) {
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

  // Filter by window
  const windowDays = WINDOWS.find(w => w.key === win)?.days ?? Infinity
  const cutoff = windowDays === Infinity ? null
    : new Date(Date.now() - windowDays * 86_400_000)

  const visibleReadings = (readings ?? [])
    .filter(r => !cutoff || new Date(r.timestamp) >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const visibleWaterings = (waterings ?? [])
    .filter(w => !cutoff || new Date(w.timestamp) >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const n = visibleReadings.length
  const usableW = svgWidth - PAD_X * 2

  // Time-based x-axis: spans from earliest visible event to latest
  const allTimestamps = [
    ...visibleReadings.map(r => +new Date(r.timestamp)),
    ...visibleWaterings.map(w => +new Date(w.timestamp)),
  ]
  const tMin = allTimestamps.length ? Math.min(...allTimestamps) : 0
  const tMax = allTimestamps.length ? Math.max(...allTimestamps) : 1
  const tSpan = tMax - tMin || 1

  function xAt(ts) {
    return PAD_X + ((+new Date(ts) - tMin) / tSpan) * usableW
  }

  // Ideal range
  const [rLo, rHi] = careProfile?.moistureRange ?? [null, null]
  const rangeY1 = rHi != null ? mToY(rHi) : null
  const rangeY2 = rLo != null ? mToY(rLo) : null

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
  // still too close together after sampling (min 38px gap)
  const MAX_LABELS  = 6
  const MIN_SPACING = 38
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
  const dateLabels = []
  let lastLabelX = -Infinity
  for (const l of sampled) {
    if (l.x - lastLabelX >= MIN_SPACING) { dateLabels.push(l); lastLabelX = l.x }
  }

  const polyPoints = visibleReadings
    .map(r => `${xAt(r.timestamp)},${mToY(r.moisture)}`)
    .join(' ')

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
                : `◎ ${tooltip.event.moisture} / 10`}
            </span>
            <span className={styles.tooltipDate}>{fmtDateTime(tooltip.event.timestamp)}</span>
          </div>
        )}
        <svg width={svgWidth} height={SVG_H} className={styles.svg}>

          {/* Ideal moisture range band */}
          {rangeY1 != null && (
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

          {/* Moisture trend line */}
          <polyline
            points={polyPoints}
            fill="none"
            stroke="rgba(140,204,235,0.65)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Reading dots — colored by range, grow on hover/tap to show tooltip */}
          {visibleReadings.map((r, i) => {
            const x = xAt(r.timestamp)
            const y = mToY(r.moisture)
            const fill = dotColor(r.moisture, careProfile?.moistureRange)
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

          {/* Date labels along the bottom — one per unique date, centered on same-day groups */}
          {dateLabels.map((l, i) => {
            const anchor = i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'
            return (
              <text
                key={`dl-${l.dateStr}`}
                x={l.x} y={PLOT_BOT + 14}
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
