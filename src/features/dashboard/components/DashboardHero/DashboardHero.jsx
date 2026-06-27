import { getGreeting } from '../../../../utils/dashboardCare.js'
import styles from './DashboardHero.module.css'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function DashboardHero({ today, onAddPlant, plantCount }) {
  const greeting = getGreeting(today)
  const countPhrase = plantCount != null
    ? `your ${plantCount} plant${plantCount === 1 ? '' : 's'}`
    : 'your plants'

  return (
    <header className={styles.hero}>
      <div className={styles.text}>
        <p className={styles.eyebrow}>{greeting} 🌿</p>
        <h1 className={`font-display ${styles.headline}`}>{formatDate(today)} · Your garden today</h1>
        <p className={styles.subtitle}>
          Here&apos;s what&apos;s happening with {countPhrase} and what might need your attention.
        </p>
      </div>
      <button type="button" className={styles.addBtn} onClick={onAddPlant}>
        + Add Plant
      </button>
    </header>
  )
}
