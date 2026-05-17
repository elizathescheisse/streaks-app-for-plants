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

function waterAbbr(unit, amount) {
  if (!amount || String(amount).trim() === '') return null
  if (unit === 'cups')   return `${amount}c`
  if (unit === 'liters') return `${amount}L`
  return String(amount).slice(0, 6)
}

export default function PlantHistoryChart({ readings, waterings, careProfile }) {
  const [win, setWin] = useState('1M')
  const containerRef = useRef(null)
  const [svgWidth, setSvgWidth] = useState(400)

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

  // Sample up to 6 reading dates for labels
  const maxLabels = 6
  const labelSet = new Set()
  if (n <= maxLabels) {
    for (let i = 0; i < n; i++) labelSet.add(i)
  } else {
    labelSet.add(0)
    labelSet.add(n - 1)
    for (let i = 1; i < maxLabels - 1; i++) labelSet.add(Math.round(i * (n - 1) / (maxLabels - 1)))
  }

  const polyPoints = visibleReadings
    .map(r => `${xAt(r.timestamp)},${mToY(r.moisture)}`)
    .join(' ')

  return (
    <div className={styles.wrap} ref={containerRef}>
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
        <p className={styles.empty}>Not enough readings for this range</p>
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

          {/* Reading dots */}
          {visibleReadings.map((r, i) => {
            const x = xAt(r.timestamp)
            const y = mToY(r.moisture)
            return (
              <circle
                key={r.id}
                cx={x} cy={y} r="3.5"
                fill="rgba(140,204,235,0.9)"
                opacity="0.9"
              />
            )
          })}

          {/* Watering annotations */}
          {visibleWaterings.map(w => {
            const x = xAt(w.timestamp)
            const label = waterAbbr(w.unit, w.amount)
            if (!label) return null
            return (
              <g key={w.id}>
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
              </g>
            )
          })}

          {/* Date labels along the bottom (anchored to readings) */}
          {visibleReadings.map((r, i) => {
            if (!labelSet.has(i)) return null
            const x = xAt(r.timestamp)
            const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
            return (
              <text
                key={`dl-${r.id}`}
                x={x} y={PLOT_BOT + 14}
                textAnchor={anchor}
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fill="rgba(150,180,150,0.55)"
              >{fmtDate(r.timestamp)}</text>
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
      )}
    </div>
  )
}
