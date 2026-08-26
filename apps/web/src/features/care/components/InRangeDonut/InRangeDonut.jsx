import styles from './InRangeDonut.module.css'

function ringClass(pct) {
  if (pct >= 80) return styles.ringGreen
  if (pct >= 50) return styles.ringYellow
  return styles.ringRed
}

// Donut chart showing what % of a plant's logged readings fell inside its
// healthy moisture range, with the % printed in the center. Same green/
// yellow/red thresholds as the old horizontal bar it replaced.
export default function InRangeDonut({ pct, size = 52, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className={ringClass(pct)}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={styles.pctLabel}>{pct}%</span>
    </div>
  )
}
