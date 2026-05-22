import SectionPanel from '../SectionPanel'
import styles from './RecentActivityCard.module.css'

export default function RecentActivityCard({ activities }) {
  return (
    <SectionPanel title="Recent activity">
      {activities.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">📋</span>
          <p className={styles.emptyText}>
            No recent logs yet. Your activity will appear here as you care for your plants.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {activities.map(item => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.itemText}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  )
}
