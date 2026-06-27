import styles from './StatCard.module.css'

export default function StatCard({ icon, value, label, sublabel, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`${styles.card} ${onClick ? styles.cardClickable : ''}`}
      role="listitem"
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <div className={styles.body}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      </div>
      {onClick && <span className={styles.arrow} aria-hidden="true">›</span>}
    </Tag>
  )
}
