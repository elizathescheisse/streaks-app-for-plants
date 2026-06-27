import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardHero from '../../dashboard/components/DashboardHero'
import StatCard from '../../dashboard/components/StatCard'
import DashboardPlantSpotlight from '../../dashboard/components/DashboardPlantSpotlight'
import RecentActivityCard from '../../dashboard/components/RecentActivityCard'
import CareTipCard from '../../dashboard/components/CareTipCard'
import {
  getDashboardMetrics,
  getPrimaryHealthyPlant,
  getPrimaryNeedsAttentionPlant,
  getRecentActivities,
  getGardenHealthStats,
} from '../../../utils/dashboardCare.js'
import styles from './DashboardHome.module.css'

const STAT_CARDS = [
  { key: 'total', label: 'Total Plants', icon: '🌿' },
  { key: 'needAttention', label: 'Needs Attention', icon: '👀' },
  { key: 'wateredToday', label: 'Watered Today', icon: '💧' },
  { key: 'measuredToday', label: 'Measured Today', icon: '◎' },
]

function healthColor(pct) {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'yellow'
  return 'red'
}

export default function DashboardHome({
  plants,
  today,
  openAdd,
  detailCallbacks,
}) {
  const { onLog: openLog, onQuickWater, onQuickReading } = detailCallbacks
  const navigate = useNavigate()

  const metrics = useMemo(() => getDashboardMetrics(plants, today), [plants, today])
  const attentionPlant = useMemo(() => getPrimaryNeedsAttentionPlant(plants), [plants])
  const healthyPlant = useMemo(() => getPrimaryHealthyPlant(plants), [plants])
  const activities = useMemo(() => getRecentActivities(plants, 5), [plants])
  const gardenHealth = useMemo(() => getGardenHealthStats(plants, today), [plants, today])

  // Session tracker: show when at least one plant has been read today but some haven't
  const sessionActive = gardenHealth.readToday > 0 && gardenHealth.unreadToday.length > 0

  const plantActions = (plant) => ({
    onWater: () => onQuickWater(plant),
    onReading: () => onQuickReading(plant),
    onLog: () => openLog(plant),
  })

  if (plants.length === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <DashboardHero today={today} onAddPlant={openAdd} />
          <div className={styles.emptyGarden}>
            <span className={styles.emptyIcon} aria-hidden="true">🌱</span>
            <h2 className={styles.emptyTitle}>Start your garden</h2>
            <p className={styles.emptyText}>
              Add your first plant to begin tracking watering, moisture readings, and health changes.
            </p>
            <button type="button" className={styles.emptyBtn} onClick={openAdd}>
              Add Plant
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <DashboardHero today={today} onAddPlant={openAdd} />

        <div className={styles.statsRow} role="list" aria-label="Garden summary">
          {STAT_CARDS.map(({ key, label, icon }) => (
            <StatCard
              key={key}
              icon={icon}
              value={metrics[key]}
              label={label}
            />
          ))}
        </div>

        {sessionActive && (
          <section className={styles.sessionTracker} aria-label="Reading session in progress">
            <p className={styles.sessionTitle}>Still needs a reading today</p>
            <div className={styles.sessionChips}>
              {gardenHealth.unreadToday.map(plant => (
                <button
                  key={plant.id}
                  className={styles.sessionChip}
                  onClick={() => onQuickReading(plant)}
                  title={`Log reading for ${plant.name || plant.species}`}
                  type="button"
                >
                  {plant.emoji || '🌿'} {plant.name || plant.species}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={styles.overviewGrid}>
          <DashboardPlantSpotlight
            title="Needs your attention"
            plant={attentionPlant}
            variant="attention"
            {...(attentionPlant ? plantActions(attentionPlant) : {})}
            emptyIcon="✨"
            emptyTitle="All caught up"
            emptyText="No plants need attention right now."
          />
          <DashboardPlantSpotlight
            title="All good"
            plant={healthyPlant}
            variant="good"
            {...(healthyPlant ? plantActions(healthyPlant) : {})}
            emptyIcon="🌿"
            emptyTitle="No settled plants yet"
            emptyText="As you log care, healthy plants will appear here."
          />
        </div>

        {gardenHealth.plants.length > 0 && (
          <section className={styles.healthGrid} aria-label="Garden health at a glance">
            <p className={styles.healthGridTitle}>Garden health at a glance</p>
            <p className={styles.healthGridSub}>% of readings in healthy moisture range</p>
            <div className={styles.healthCircles}>
              {gardenHealth.plants.map(({ plant, pct }) => (
                <button
                  key={plant.id}
                  className={`${styles.healthCircle} ${styles[`healthCircle_${healthColor(pct)}`]}`}
                  onClick={() => navigate(`/plant/${plant.id}`)}
                  title={`${plant.name || plant.species} — ${pct}% in range`}
                  type="button"
                >
                  <span className={styles.healthCircleEmoji}>{plant.emoji || '🌿'}</span>
                  <span className={styles.healthCirclePct}>{pct}%</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={styles.bottomGrid}>
          <RecentActivityCard activities={activities} />
          <CareTipCard />
        </div>
      </div>
    </main>
  )
}
