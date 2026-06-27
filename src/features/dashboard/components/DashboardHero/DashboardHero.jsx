import { getGreeting } from '../../../../utils/dashboardCare.js'
import styles from './DashboardHero.module.css'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function DashboardHero({ today, onAddPlant, plantCount }) {
  const greeting = getGreeting(today)
  const countLabel = plantCount != null
    ? `Your ${plantCount} plant${plantCount === 1 ? '' : 's'}`
    : 'Your garden'

  return (
    <header className={styles.hero}>
      <div className={styles.text}>
        <p className={styles.eyebrow}>{greeting} 🌿</p>
        <p className={`font-display-date ${styles.date}`}>{formatDate(today)}</p>
        <h1 className={`font-display ${styles.headline}`}>{countLabel}</h1>
        <p className={styles.subtitle}>
          Here&apos;s what&apos;s happening and what might need your attention.
        </p>
      </div>
      <button type="button" className={styles.addBtn} onClick={onAddPlant}>
        + Add Plant
      </button>
    </header>
  )
}
