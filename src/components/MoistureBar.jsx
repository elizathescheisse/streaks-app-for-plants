import { useState } from 'react'
import styles from './MoistureBar.module.css'

export default function MoistureBar({ value, range, isPredicted = false }) {
  const [tooltip, setTooltip] = useState(null) // 'dot' | 'range' | null
  const [lo, hi] = range
  const pct = (v) => `${(v / 10) * 100}%`

  // Distance outside the ideal range (0 if in range)
  const dist = value < lo ? lo - value : value > hi ? value - hi : 0
  // 1 unit outside = "a little off" (yellow); more than 1 = problem (red)
  const slightlyOutside = dist > 0 && dist <= 1

  let statusLabel, dotClass
  if (dist === 0) {
    statusLabel = `In range (${lo}–${hi})`
    dotClass    = styles.dotOk
  } else if (slightlyOutside) {
    statusLabel = value < lo
      ? `A little dry — ideal is ${lo}–${hi}`
      : `A little wet — ideal is ${lo}–${hi}`
    dotClass    = styles.dotClose
  } else {
    statusLabel = value < lo
      ? `Too dry — ideal is ${lo}–${hi}`
      : `Too wet — ideal is ${lo}–${hi}`
    dotClass    = styles.dotOut
  }

  return (
    <div className={styles.wrap} onTouchStart={() => setTooltip(null)}>
      {tooltip && (
        <div className={styles.tooltip}>
          <span className={styles.tooltipValue}>
            {tooltip === 'dot'
              ? `${isPredicted ? '~' : '◎'} ${value} / 10`
              : statusLabel}
          </span>
          {tooltip === 'dot' && (
            <span className={styles.tooltipLabel}>
              {isPredicted ? 'estimated current value' : statusLabel}
            </span>
          )}
        </div>
      )}
      <div className={styles.track}>
        {/* Ideal range fill — hover/tap shows status label */}
        <div
          className={styles.rangeFill}
          style={{ left: pct(lo), width: pct(hi - lo) }}
          onMouseEnter={() => setTooltip('range')}
          onMouseLeave={() => setTooltip(null)}
          onTouchStart={e => { e.stopPropagation(); setTooltip(t => t === 'range' ? null : 'range') }}
        />
        {/* Current value dot — hover/tap shows exact moisture reading */}
        <div
          className={`${styles.dot} ${dotClass}`}
          style={{ left: pct(value) }}
          onMouseEnter={() => setTooltip('dot')}
          onMouseLeave={() => setTooltip(null)}
          onTouchStart={e => { e.stopPropagation(); setTooltip(t => t === 'dot' ? null : 'dot') }}
        />
      </div>
    </div>
  )
}
