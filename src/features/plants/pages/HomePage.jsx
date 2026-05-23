import { useState } from 'react'
import PlantCard from '../components/PlantCard'
import { getPlantSortPriority } from '../../../utils/plantStatus.js'
import styles from './HomePage.module.css'

// 2×2 grid icon used for the view-switcher button.
function GridIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="4" height="4" rx="0.5"/>
      <rect x="6" y="0" width="4" height="4" rx="0.5"/>
      <rect x="0" y="6" width="4" height="4" rx="0.5"/>
      <rect x="6" y="6" width="4" height="4" rx="0.5"/>
    </svg>
  )
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// The "/" route: date header, search/view controls, and the plant list.
// All home-only state (cardView, chartWindow, viewMenuOpen, searchQuery)
// lives here, not in App — App stays focused on global plant data and
// modal/panel orchestration. Phase 5 will wrap this view in a tab bar
// alongside Dashboard, so keep all the list controls local.
export default function HomePage({ plants, today, openAdd, detailCallbacks }) {
  const [chartWindow, setChartWindow]   = useState('1M')
  const [cardView, setCardView]         = useState('compact') // 'chart' | 'compact'
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')

  return (
    <main className={styles.main}>
      <section className={styles.listCol}>
        <div className={styles.dateBlock}>
          <div className={styles.dateRow}>
            <h1 className={styles.bigDate}>{formatDate(today)}</h1>
            {plants.length > 0 && (
              <button className={styles.addBtn} onClick={openAdd}>
                + Add Plant
              </button>
            )}
          </div>
          <p className={styles.hint}>Log your plants' health and watering for today.</p>
          {plants.length > 0 && (
            <div className={styles.controlRow}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search plants…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />

              {/* Chart window toggle — only shown in chart view */}
              {cardView === 'chart' && (
                <div className={styles.chartToggle}>
                  {['1W','1M','3M','all'].map(key => (
                    <button
                      key={key}
                      className={`${styles.toggleBtn} ${chartWindow === key ? styles.toggleBtnActive : ''}`}
                      onClick={() => setChartWindow(key)}
                    >{key === 'all' ? 'All' : key}</button>
                  ))}
                </div>
              )}

              {/* View-switcher: grid icon + dropdown — always rightmost so it doesn't shift */}
              <div className={styles.viewSwitcher}>
                <button
                  className={`${styles.viewSwitcherBtn} ${viewMenuOpen ? styles.viewSwitcherBtnOpen : ''}`}
                  onClick={() => setViewMenuOpen(o => !o)}
                  title="Switch card view"
                  type="button"
                >
                  <GridIcon />
                </button>
                {viewMenuOpen && (
                  <>
                    <div className={styles.viewMenuBackdrop} onClick={() => setViewMenuOpen(false)} />
                    <div className={styles.viewMenu}>
                      {[
                        { key: 'chart',   label: 'Timeline' },
                        { key: 'compact', label: 'Focus'    },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`${styles.viewMenuItem} ${cardView === key ? styles.viewMenuItemActive : ''}`}
                          onClick={() => { setCardView(key); setViewMenuOpen(false) }}
                          type="button"
                        >{label}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`${styles.plantList} ${cardView === 'compact' ? styles.plantListCompact : ''}`}>
          {plants.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🌱</div>
              <p className={styles.emptyTitle}>No plants yet</p>
              <button className={styles.emptyAddBtn} onClick={openAdd}>
                + Add your first plant
              </button>
            </div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase()
            const filtered = (q
              ? plants.filter(p =>
                  (p.name    && p.name.toLowerCase().includes(q)) ||
                  (p.species && p.species.toLowerCase().includes(q)) ||
                  (p.emoji   && p.emoji.includes(searchQuery.trim()))
                )
              : plants
            ).slice().sort((a, b) => getPlantSortPriority(a) - getPlantSortPriority(b))
            if (filtered.length === 0) return (
              <p className={styles.noResults}>No plants match "{searchQuery.trim()}"</p>
            )
            return filtered.map(p => (
              <PlantCard
                key={p.id}
                plant={p}
                onEdit={() => detailCallbacks.onEdit(p)}
                onLog={() => detailCallbacks.onLog(p)}
                onQuickWater={() => detailCallbacks.onQuickWater(p)}
                onQuickReading={() => detailCallbacks.onQuickReading(p)}
                onEditLog={(bundle) => detailCallbacks.onEditLog(p, bundle)}
                chartWindow={chartWindow}
                cardView={cardView}
              />
            ))
          })()}
        </div>
      </section>
    </main>
  )
}
