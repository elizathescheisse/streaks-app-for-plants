import { useTheme } from '../../../../theme/useTheme.ts'
import styles from './ThemeToggle.module.css'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className={styles.themeToggle} role="radiogroup" aria-label="Color theme">
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
        onClick={() => setTheme('dark')}
      >
        <MoonIcon />
        <span>Dark</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
        onClick={() => setTheme('light')}
      >
        <SunIcon />
        <span>Light</span>
      </button>
    </div>
  )
}
