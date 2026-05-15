import { useState, useRef, useEffect } from 'react'
import styles from './PlantHistoryChart.module.css'

const WINDOWS = [
  { key: '1W',  label: '1W',  days: 7   },
  { key: '1M',  label: '1M',  days: 30  },
  { key: '3M',  label: '3M',  days: 90  },
  { key: 'all', label: 'All', days: Infinity },
]

// Health dot colors (raw values since SVG fill can't use CSS vars)
const HEALTH_COLORS = {
  thriving:  '#40d961',
  good:      '#8cd966',
  okay:      '#e0c740',
  struggling:'#e56147',
}

// SVG vertical layout (fixed pixel heights)
const PAD_X    = 16   // left/right padding inside SVG
const TOP_ZONE = 26   // space above plot for watering labels
const BOT_ZONE = 20   // space below plot for date labels
const PLOT_H   = 60   // height of the moisture plot area
const SVG_H    = TOP_ZONE + PLOT_H + BOT_ZONE  // 106
const PLOT_TOP = TOP_ZONE
const PLOT_BOT = TOP_ZONE + PLOT_H

function mToY(moisture) {
  return PLOT_TOP + (1 - moisture / 10) * PLOT_H
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function waterAbbr(unit, amount) {
  if (!amount || String(amount).trim() === '') return null
  if (unit === 'cups')   return `${amount}c`
  if (unit === 'liters') return `${amount}L`
  return String(amount).slice(0, 6) // truncate freeform
}

export default function PlantHistoryChart({ logs, careProfile }) {
  const [win, setWin] = useState('1M')
  const containerRef = useRef(null)
  const [svgWidth, setSvgWidth] = useState(400)

  // Measure container so we can calculate exact pixel positions
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

  // Filter and sort logs by selected window
  const windowDays = WINDOWS.find(w => w.key === win)?.days ?? Infinity
  const cutoff = windowDays === Infinity ? null
    : new Date(Date.now() - windowDays * 86_400_000)

  const visible = [...logs]
    .filter(e => !cutoff || new Date(e.timestamp) >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const n = visible.length
  const usableW = svgWidth - PAD_X * 2

  function xAt(i) {
    if (n <= 1) return svgWidth / 2
    return PAD_X + (i / (n - 1)) * usableW
  }

  // Ideal range
  const [rLo, rHi] = careProfile?.moistureRange ?? [null, null]
  const rangeY1 = rHi != null ? mToY(rHi) : null  // higher moisture = lower Y
  const rangeY2 = rLo != null ? mToY(rLo) : null

  // Date labels: show at most 6 (first, last, and evenly spaced between)
  const maxLabels = 6
  const labelSet = new Set()
  if (n <= maxLabels) {
    for (let i = 0; i < n; i++) labelSet.add(i)
  } else {
    labelSet.add(0)
    labelSet.add(n - 1)
    for (let i = 1; i < maxLabels - 1; i++) labelSet.add(Math.round(i * (n - 1) / (maxLabels - 1)))
  }

  // Polyline points string
  const polyPoints = visible.map((e, i) => `${xAt(i)},${mToY(e.moisture)}`).join(' ')

  return (
    <div className={styles.wrap} ref={containerRef}>
      {/* Time range toggle */}
      <div className={styles.toggle}>
        {WINDOWS.map(w => (
          <button
            key={w.key}
            className={`${styles.toggleBtn} ${win === w.key ? styles.toggleBtnActive : ''}`}
            onClick={() => setWin(w.key)}
          >{w.label}</button>
        ))}
      </div>

      {n < 2 ? (
        <p className={styles.empty}>Not enough data for this range</p>
      ) : (
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

          {/* Per-entry: dot + watering annotation */}
          {visible.map((entry, i) => {
            const x  = xAt(i)
            const y  = mToY(entry.moisture)
            const wLabel = waterAbbr(entry.waterUnit, entry.waterAmount)

            return (
              <g key={entry.id}>
                {/* Watering tick + label above the plot */}
                {wLabel && (
                  <>
                    <line
                      x1={x} y1={PLOT_TOP - 4}
                      x2={x} y2={y - 5}
                      stroke="rgba(140,204,235,0.3)"
                      strokeWidth="0.75"
                    />
                    <text
                      x={x} y={PLOT_TOP - 6}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontFamily="Inter, sans-serif"
                      fill="rgba(140,204,235,0.8)"
                    >💧{wLabel}</text>
                  </>
                )}

                {/* Health-colored dot */}
                <circle
                  cx={x} cy={y} r="3.5"
                  fill={HEALTH_COLORS[entry.health] ?? '#8cd966'}
                  opacity="0.9"
                />
              </g>
            )
          })}

          {/* Date labels */}
          {visible.map((entry, i) => {
            if (!labelSet.has(i)) return null
            const x = xAt(i)
            const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
            return (
              <text
                key={`dl-${entry.id}`}
                x={x} y={PLOT_BOT + 14}
                textAnchor={anchor}
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fill="rgba(150,180,150,0.55)"
              >{fmtDate(entry.date)}</text>
            )
          })}

          {/* Y-axis moisture labels (0, 5, 10) */}
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
      )}
    </div>
  )
}
