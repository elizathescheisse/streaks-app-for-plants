import { useState } from 'react'
import ViewTabs from '../../../shared/components/ViewTabs'
import PlantListView from './PlantListView.jsx'
import DashboardHome from './DashboardHome.jsx'
import AccuracyView from './AccuracyView.jsx'
import styles from './HomePage.module.css'

const TABS = [
  { key: 'focus',     label: 'Focus'     },
  { key: 'timeline',  label: 'Timeline'  },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'accuracy',  label: 'Accuracy'  },
]

// Tab orchestrator for the home route. Renders the ViewTabs at the top, then
// the active view.
//
// - Focus     → PlantListView with cardView='compact'
// - Timeline  → PlantListView with cardView='chart'
// - Dashboard → DashboardHome (garden overview)
// - Accuracy  → AccuracyView (prediction report card; buried last, for the
//   data-curious — most users never open it)
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
        <DashboardHome
          plants={plants}
          today={today}
          openAdd={openAdd}
          detailCallbacks={detailCallbacks}
        />
      ) : viewMode === 'accuracy' ? (
        <AccuracyView plants={plants} />
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
