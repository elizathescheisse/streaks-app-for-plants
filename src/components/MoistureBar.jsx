import styles from './MoistureBar.module.css'

export default function MoistureBar({ value, range }) {
  const [lo, hi] = range
  const inRange = value >= lo && value <= hi
  const pct = (v) => `${(v / 10) * 100}%`

  let statusLabel, statusClass
  if (value < lo) {
    statusLabel = `Too dry — ideal is ${lo}–${hi}`
    statusClass = styles.dry
  } else if (value > hi) {
    statusLabel = `Too wet — ideal is ${lo}–${hi}`
    statusClass = styles.wet
  } else {
    statusLabel = `In range (${lo}–${hi})`
    statusClass = styles.ok
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
          className={`${styles.dot} ${inRange ? styles.dotOk : styles.dotOut}`}
          style={{ left: pct(value) }}
        />
      </div>
      <span className={`${styles.label} ${statusClass}`}>{statusLabel}</span>
    </div>
  )
}
