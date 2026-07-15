import styles from './ViewTabs.module.css'

// Pill-shaped segmented tab bar. Visual language matches the existing
// .seg/.segActive controls (e.g. PlantForm) so this doesn't introduce
// a new look. Used at the top of HomePage to switch between Focus,
// Timeline, and Dashboard views.
//
// Props:
//   tabs:    [{ key, label }, ...]
//   value:   current active key
//   onChange: (key) => void
//   ariaLabel: string (defaults to "View")
export default function ViewTabs({ tabs, value, onChange, ariaLabel = 'View' }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
      {tabs.map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
