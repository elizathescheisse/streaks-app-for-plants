import { useState } from 'react'
import styles from './MoistureBar.module.css'

export default function MoistureBar({ value, range, careProfile, isPredicted = false }) {
  const [tooltip, setTooltip] = useState(null) // 'dot' | 'threshold' | 'range' | null
  const [lo, hi] = range
  const pct = (v) => `${(v / 10) * 100}%`

  const isFloodAndDry = careProfile?.wateringStyle === 'flood-and-dry'
  const dryThreshold  = careProfile?.dryThreshold ?? lo

  // ── Flood-and-dry: dot color based on dryThreshold ───────────────────────
  // ── Consistent:    dot color based on ideal range ────────────────────────
  let statusLabel, dotClass
  if (isFloodAndDry) {
    if (value < dryThreshold - 1) {
      // Significantly below threshold — overdue, more urgent
      statusLabel = `Overdue for water (threshold: ${dryThreshold})`
      dotClass    = styles.dotOut
    } else if (value <= dryThreshold) {
      // At or just below threshold — normal watering time, not alarming
      statusLabel = `Water now — at dry threshold (${dryThreshold})`
      dotClass    = styles.dotClose
    } else if (value <= dryThreshold + 1) {
      statusLabel = `Getting dry — water soon (threshold: ${dryThreshold})`
      dotClass    = styles.dotClose
    } else {
      statusLabel = `Drying out — water at ${dryThreshold}`
      dotClass    = styles.dotOk
    }
  } else {
    const dist          = value < lo ? lo - value : value > hi ? value - hi : 0
    const slightlyOut   = dist > 0 && dist <= 1
    if (dist === 0) {
      statusLabel = `In range (${lo}–${hi})`
      dotClass    = styles.dotOk
    } else if (slightlyOut) {
      statusLabel = value < lo ? `A little dry — ideal is ${lo}–${hi}` : `A little wet — ideal is ${lo}–${hi}`
      dotClass    = styles.dotClose
    } else {
      statusLabel = value < lo ? `Too dry — ideal is ${lo}–${hi}` : `Too wet — ideal is ${lo}–${hi}`
      dotClass    = styles.dotOut
    }
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
        {isFloodAndDry ? (
          /* Flood-and-dry: single threshold tick instead of a range band */
          <div
            className={styles.thresholdTick}
            style={{ left: pct(dryThreshold) }}
            onMouseEnter={() => setTooltip('threshold')}
            onMouseLeave={() => setTooltip(null)}
            onTouchStart={e => { e.stopPropagation(); setTooltip(t => t === 'threshold' ? null : 'threshold') }}
          />
        ) : (
          /* Consistent: green ideal range band */
          <div
            className={styles.rangeFill}
            style={{ left: pct(lo), width: pct(hi - lo) }}
            onMouseEnter={() => setTooltip('range')}
            onMouseLeave={() => setTooltip(null)}
            onTouchStart={e => { e.stopPropagation(); setTooltip(t => t === 'range' ? null : 'range') }}
          />
        )}
        {/* Current value dot */}
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
