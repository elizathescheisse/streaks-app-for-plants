import { useState } from 'react'
import ThemeToggle from '../ThemeToggle/ThemeToggle.jsx'
import styles from './SettingsModal.module.css'

export default function SettingsModal({ onClose, onClearData, plantCount }) {
  const [confirming, setConfirming] = useState(false)

  function handleClear() {
    onClearData()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.header}>
          <span className={styles.title} id="settings-title">Settings</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="appearance-heading">
            <p className={styles.sectionLabel} id="appearance-heading">APPEARANCE</p>
            <p className={styles.sectionDesc}>
              Choose how Plant Streaks looks on this device.
            </p>
            <ThemeToggle />
          </section>

          <section className={styles.section} aria-labelledby="data-heading">
            <p className={styles.sectionLabel} id="data-heading">DATA</p>

            {!confirming ? (
              <button type="button" className={styles.dangerBtn} onClick={() => setConfirming(true)}>
                🗑 Clear all data
              </button>
            ) : (
              <div className={styles.confirmBlock}>
                <p className={styles.confirmText}>
                  This will permanently delete all {plantCount} plant{plantCount !== 1 ? 's' : ''} and their history. This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button type="button" className={styles.confirmBtn} onClick={handleClear}>
                    Yes, delete everything
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.brand} aria-label="Plant Streaks">
            <span className={styles.brandLeaf} aria-hidden="true">🌿</span>
            <span className={styles.brandName}>Plant Streaks</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
