import EdgeGlow from '../shared/components/EdgeGlow'
import Header from './Header'
import styles from './AppLayout.module.css'

// Outer chrome shared by every route — full-height column with the edge glow
// behind everything, the header pinned at top, and the routed content as
// children. Per-page main containers (max-width, padding) live in each page,
// not here, so the dashboard can be wider than the focus/timeline lists.
export default function AppLayout({ headerProps, children }) {
  return (
    <div className={styles.app}>
      <EdgeGlow />
      <Header {...headerProps} />
      {children}
    </div>
  )
}
