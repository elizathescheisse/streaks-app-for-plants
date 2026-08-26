import styles from './InRangeDonut.module.css'

function tier(pct) {
  if (pct >= 80) return 'Thriving'
  if (pct >= 50) return 'Okay'
  return 'Struggling'
}

// Donut chart showing what % of a plant's logged readings fell inside its
// healthy moisture range, with the % printed in the center — no plant
// emoji, so it looks identical wherever it's used (Current status, the
// dashboard's garden-health grid, etc.) regardless of whether that plant
// has a custom icon elsewhere. Ring color/fill match the same green/
// yellow/red status tiers used across the app.
export default function InRangeDonut({ pct, size = 52, strokeWidth = 4 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)
  const t = tier(pct)

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className={styles[`fill${t}`]}
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth / 2}
        />
        <circle
          className={`${styles.track} ${styles[`track${t}`]}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className={`${styles.ring} ${styles[`ring${t}`]}`}
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
