import styles from './MoistureBar.module.css'

export default function MoistureBar({ value, range }) {
  const [lo, hi] = range
  const pct = (v) => `${(v / 10) * 100}%`

  // Distance outside the ideal range (0 if in range)
  const dist = value < lo ? lo - value : value > hi ? value - hi : 0
  // 1 unit outside = "a little off" (yellow); more than 1 = problem (red)
  const slightlyOutside = dist > 0 && dist <= 1

  let statusLabel, statusClass, dotClass
  if (dist === 0) {
    statusLabel = `In range (${lo}–${hi})`
    statusClass = styles.ok
    dotClass    = styles.dotOk
  } else if (slightlyOutside) {
    statusLabel = value < lo
      ? `A little dry — ideal is ${lo}–${hi}`
      : `A little wet — ideal is ${lo}–${hi}`
    statusClass = styles.close
    dotClass    = styles.dotClose
  } else {
    statusLabel = value < lo
      ? `Too dry — ideal is ${lo}–${hi}`
      : `Too wet — ideal is ${lo}–${hi}`
    statusClass = value < lo ? styles.dry : styles.wet
    dotClass    = styles.dotOut
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        {/* Ideal range fill */}
        <div
          className={styles.rangeFill}
          style={{ left: pct(lo), width: pct(hi - lo) }}
        />
        {/* Current value dot */}
        <div
          className={`${styles.dot} ${dotClass}`}
          style={{ left: pct(value) }}
        />
      </div>
      <span className={`${styles.label} ${statusClass}`}>{statusLabel}</span>
    </div>
  )
}
