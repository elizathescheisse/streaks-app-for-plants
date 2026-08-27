import { useEffect } from 'react'
import styles from './Toast.module.css'

const DEFAULT_DURATION_MS = 5000

// Small, self-dismissing banner for passing status messages — e.g. "that
// link doesn't resolve in this browser, here's your garden instead." Not a
// modal: doesn't block interaction, doesn't need a close click, just fades
// out on its own after `duration`.
export default function Toast({ message, onDismiss, duration = DEFAULT_DURATION_MS }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div className={styles.wrap} role="status">
      <span className={styles.message}>{message}</span>
    </div>
  )
}
