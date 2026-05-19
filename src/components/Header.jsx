import styles from './Header.module.css'

const WINDOWS = [
  { key: '1W',  label: '1W'  },
  { key: '1M',  label: '1M'  },
  { key: '3M',  label: '3M'  },
  { key: 'all', label: 'All' },
]

export default function Header({ onExport, onImport, onSettings, chartWindow, onChartWindowChange }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.leaf}>🌿</span>
        <span className={styles.name}>Plant Streaks</span>
      </div>

      {onChartWindowChange && (
        <div className={styles.chartToggle}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              className={`${styles.toggleBtn} ${chartWindow === w.key ? styles.toggleBtnActive : ''}`}
              onClick={() => onChartWindowChange(w.key)}
            >{w.label}</button>
          ))}
        </div>
      )}

      <nav className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onImport}>
          ↓ Import
        </button>
        <button className={styles.btnSecondary} onClick={onExport}>
          ↑ Export
        </button>
        <button className={styles.btnIcon} onClick={onSettings} title="Settings">
          ⚙️
        </button>
      </nav>
    </header>
  )
}
