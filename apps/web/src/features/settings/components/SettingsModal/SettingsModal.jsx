import { useState } from 'react'
import ThemeToggle from '../ThemeToggle'
import styles from './SettingsModal.module.css'

export default function SettingsModal({ onClose, onClearData, onExport, onImport, cloud, plantCount }) {
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
            <p className={styles.sectionLabel}>APPEARANCE</p>
            <ThemeToggle />
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>SYNC ACROSS DEVICES</p>
            {cloud.user ? (
              <>
                <p className={styles.helpText}>
                  Signed in as {cloud.user.email ?? cloud.user.name}. Your plants are backed up and will appear on any device you sign in on.
                </p>
                <button className={styles.secondaryBtn} onClick={cloud.signOut}>Sign out</button>
                <p className={styles.helpText}>Signing out keeps your plants on this device and stops syncing.</p>
              </>
            ) : (
              <>
                <p className={styles.helpText}>
                  Your plants are saved only on this device. Sign in with Google to back them up and use them on other devices — entirely optional.
                </p>
                <button className={styles.secondaryBtn} onClick={cloud.signInWithGoogle}>Sign in with Google</button>
              </>
            )}
            {cloud.error && <p className={styles.errorText}>{cloud.error}</p>}
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>DATA</p>

            <div className={styles.buttonRow}>
              <button className={styles.secondaryBtn} onClick={onImport}>↓ Import</button>
              <button className={styles.secondaryBtn} onClick={onExport}>↑ Export</button>
            </div>

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
