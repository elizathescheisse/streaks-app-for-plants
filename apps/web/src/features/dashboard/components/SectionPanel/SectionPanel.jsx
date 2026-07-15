import styles from './SectionPanel.module.css'

export default function SectionPanel({ title, children, variant = 'default', className = '' }) {
  const variantClass = variant !== 'default' ? styles[variant] : ''
  return (
    <section
      className={[styles.panel, variantClass, className].filter(Boolean).join(' ')}
    >
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.body}>{children}</div>
    </section>
  )
}
