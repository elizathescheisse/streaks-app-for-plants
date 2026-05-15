import styles from './Header.module.css'

export default function Header({ onExport, onImport }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.leaf}>🌿</span>
        <span className={styles.name}>Plant Streaks</span>
      </div>
      <nav className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onImport}>
          ↑ Import JSON
        </button>
        <button className={styles.btnPrimary} onClick={onExport}>
          ↓ Export JSON
        </button>
      </nav>
    </header>
  )
}
