import styles from './Header.module.css'

export default function Header({ onExport, onImport, onSettings }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.leaf}>🌿</span>
        <span className={styles.name}>Plant Streaks</span>
      </div>
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
