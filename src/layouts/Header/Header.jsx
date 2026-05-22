import { Link } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header({ onExport, onImport, onSettings }) {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo} aria-label="Plant Streaks home">
        <span className={styles.leaf} aria-hidden="true">🌿</span>
        <span className={styles.name}>Plant Streaks</span>
      </Link>
      <nav className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onImport}>
          ↓ Import
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onExport}>
          ↑ Export
        </button>
        <button
          type="button"
          className={styles.btnIcon}
          onClick={onSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⚙️
        </button>
      </nav>
    </header>
  )
}
