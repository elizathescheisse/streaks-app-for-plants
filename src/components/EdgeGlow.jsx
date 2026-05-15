import styles from './EdgeGlow.module.css'

export default function EdgeGlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={`${styles.glow} ${styles.top}`} />
      <div className={`${styles.glow} ${styles.bottom}`} />
      <div className={`${styles.glow} ${styles.left}`} />
      <div className={`${styles.glow} ${styles.right}`} />
    </div>
  )
}
