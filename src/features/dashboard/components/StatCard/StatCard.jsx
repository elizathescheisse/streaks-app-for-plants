import styles from './StatCard.module.css'

export default function StatCard({ icon, value, label }) {
  return (
    <div className={styles.card} role="listitem">
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <div className={styles.body}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  )
}
