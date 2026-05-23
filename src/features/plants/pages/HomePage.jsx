import { useState } from 'react'
import ViewTabs from '../../../shared/components/ViewTabs'
import PlantListView from './PlantListView.jsx'
import styles from './HomePage.module.css'

const TABS = [
  { key: 'focus',     label: 'Focus'     },
  { key: 'timeline',  label: 'Timeline'  },
  { key: 'dashboard', label: 'Dashboard' },
]

// Tab orchestrator for the home route. Renders the ViewTabs at the top,
// then either PlantListView (Focus or Timeline) or the Dashboard placeholder
// (Phase 6 will replace the placeholder with the real DashboardHome).
//
// - Focus    → PlantListView with cardView='compact'
// - Timeline → PlantListView with cardView='chart'
// - Dashboard → placeholder until Phase 6
//
// The two list-flavored tabs intentionally share PlantListView so the date
// header, search, and add-plant button all work identically — they just
// render their cards differently.
export default function HomePage({ plants, today, openAdd, detailCallbacks }) {
  const [viewMode, setViewMode] = useState('focus')

  return (
    <>
      <div className={styles.tabBarWrap}>
        <ViewTabs
          tabs={TABS}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Home view"
        />
      </div>

      {viewMode === 'dashboard' ? (
        <main className={styles.dashPlaceholder}>
          <div className={styles.placeholderCard}>
            <span className={styles.placeholderIcon} aria-hidden="true">📊</span>
            <h2 className={styles.placeholderTitle}>Dashboard coming soon</h2>
            <p className={styles.placeholderText}>
              A garden overview with stat cards, plant spotlights, and care tips —
              landing in the next phase of this restructure.
            </p>
          </div>
        </main>
      ) : (
        <PlantListView
          plants={plants}
          today={today}
          openAdd={openAdd}
          detailCallbacks={detailCallbacks}
          cardView={viewMode === 'timeline' ? 'chart' : 'compact'}
        />
      )}
    </>
  )
}
