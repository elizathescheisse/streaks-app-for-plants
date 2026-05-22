import EdgeGlow from '../shared/components/EdgeGlow'
import Header from './Header'
import styles from './AppLayout.module.css'

export default function AppLayout({ headerProps, children }) {
  return (
    <div className={styles.app}>
      <EdgeGlow />
      <Header {...headerProps} />
      {children}
    </div>
  )
}
