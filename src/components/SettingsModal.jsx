import { useState } from 'react'
import styles from './SettingsModal.module.css'

export default function SettingsModal({ onClose, onClearData, plantCount }) {
  const [confirming, setConfirming] = useState(false)

  function handleClear() {
    onClearData()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>DATA</p>

            {!confirming ? (
              <button className={styles.dangerBtn} onClick={() => setConfirming(true)}>
                🗑 Clear all data
              </button>
            ) : (
              <div className={styles.confirmBlock}>
                <p className={styles.confirmText}>
                  This will permanently delete all {plantCount} plant{plantCount !== 1 ? 's' : ''} and their history. This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button className={styles.confirmBtn} onClick={handleClear}>
                    Yes, delete everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
