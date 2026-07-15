import { useState } from 'react'
import PlantCard from '../components/PlantCard'
import { getPlantSortPriority } from '@plant-streaks/core/plantStatus.js'
import styles from './PlantListView.module.css'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// Date header + search + chart-window toggle + list of PlantCards. Drives
// both the Focus tab (cardView='compact') and the Timeline tab
// (cardView='chart'). The view-switch dropdown that used to live here has
// moved up into HomePage's ViewTabs.
//
// Props:
//   plants, today, openAdd, detailCallbacks — forwarded from App via HomePage
//   cardView: 'compact' | 'chart' — set by HomePage based on the active tab
export default function PlantListView({ plants, today, openAdd, detailCallbacks, cardView }) {
  const [chartWindow, setChartWindow] = useState('1M')
  const [searchQuery, setSearchQuery] = useState('')

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

              {/* Chart window toggle — only meaningful in Timeline view */}
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
