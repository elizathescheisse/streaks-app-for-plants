import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardHero from '../../dashboard/components/DashboardHero'
import StatCard from '../../dashboard/components/StatCard'
import DashboardPlantSpotlight from '../../dashboard/components/DashboardPlantSpotlight'
import RecentActivityCard from '../../dashboard/components/RecentActivityCard'
import CareTipCard from '../../dashboard/components/CareTipCard'
import GardenChat from '../../care/components/GardenChat/GardenChat.jsx'
import InRangeDonut from '../../care/components/InRangeDonut/InRangeDonut.jsx'
import {
  getDashboardMetrics,
  getPrimaryHealthyPlant,
  getPrimaryNeedsAttentionPlant,
  getRecentActivities,
  getGardenHealthStats,
  getWateringDueToday,
  getWateringCheckQueue,
} from '@plant-streaks/core/dashboardCare.js'
import styles from './DashboardHome.module.css'

function plantName(plant) {
  return plant.name || (plant.species
    ? plant.species[0].toUpperCase() + plant.species.slice(1)
    : '?')
}

export default function DashboardHome({
  plants,
  today,
  openAdd,
  detailCallbacks,
}) {
  const { onLog: openLog, onQuickWater, onQuickReading } = detailCallbacks
  const navigate = useNavigate()

  const attentionRef = useRef(null)
  const sessionRef   = useRef(null)
  const wateringDueRef = useRef(null)

  const metrics      = useMemo(() => getDashboardMetrics(plants, today), [plants, today])
  const attentionPlant = useMemo(() => getPrimaryNeedsAttentionPlant(plants), [plants])
  const healthyPlant = useMemo(() => getPrimaryHealthyPlant(plants), [plants])
  const activities   = useMemo(() => getRecentActivities(plants, 5), [plants])
  const gardenHealth  = useMemo(() => getGardenHealthStats(plants, today), [plants, today])
  const wateringDue   = useMemo(() => getWateringDueToday(plants, today), [plants, today])
  const checkQueue    = useMemo(() => getWateringCheckQueue(plants, today), [plants, today])

  // Show whenever any plant hasn't been read today — not just mid-session
  const showSessionTracker = gardenHealth.unreadToday.length > 0
  const sessionInProgress  = gardenHealth.readToday > 0

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const plantActions = (plant) => ({
    onWater:   () => onQuickWater(plant),
    onReading: () => onQuickReading(plant),
    onLog:     () => openLog(plant),
  })

  const hasWateringSection = wateringDue.length > 0 || checkQueue.ready.length > 0 || checkQueue.waiting.length > 0

  // Which stat cards get click handlers
  const statCardActions = {
    needAttention: metrics.needAttention > 0 ? () => scrollTo(attentionRef) : undefined,
    measuredToday: showSessionTracker        ? () => scrollTo(sessionRef)   : undefined,
    wateredToday:  hasWateringSection        ? () => scrollTo(wateringDueRef) : undefined,
  }

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

  const gardenHealthSublabel = gardenHealth.noReadingCount > 0
    ? `${gardenHealth.noReadingCount} plant${gardenHealth.noReadingCount === 1 ? '' : 's'} without any readings`
    : undefined

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <DashboardHero today={today} onAddPlant={openAdd} plantCount={plants.length} />

        <div className={styles.statsRow} role="list" aria-label="Garden summary">
          <StatCard
            icon="🌿"
            value={gardenHealth.avgPct != null ? `${gardenHealth.avgPct}%` : '—'}
            label="Garden Health"
            sublabel={gardenHealthSublabel}
          />
          {[
            { key: 'needAttention', label: 'Needs Attention', icon: '👀' },
            { key: 'wateredToday', label: 'Watered Today',   icon: '💧' },
            { key: 'measuredToday', label: 'Measured Today', icon: '◎' },
          ].map(({ key, label, icon }) => (
            <StatCard
              key={key}
              icon={icon}
              value={metrics[key]}
              label={label}
              onClick={statCardActions[key]}
            />
          ))}
        </div>

        {showSessionTracker && (
          <section ref={sessionRef} className={styles.sessionTracker} aria-label="Plants needing a reading">
            <p className={styles.sessionTitle}>
              {sessionInProgress
                ? `Still needs a reading today · ${gardenHealth.unreadToday.length} left`
                : 'Which plants need a reading today'}
            </p>
            <div className={styles.sessionChips}>
              {gardenHealth.unreadToday.map(plant => (
                <button
                  key={plant.id}
                  className={styles.sessionChip}
                  onClick={() => onQuickReading(plant)}
                  title={`Log reading for ${plantName(plant)}`}
                  type="button"
                >
                  {plant.emoji || '🌿'} {plantName(plant)}
                </button>
              ))}
            </div>
          </section>
        )}

        {hasWateringSection && (
          <section ref={wateringDueRef} className={styles.sessionTracker} aria-label="Watering and post-watering checks">
            {wateringDue.length > 0 && (
              <div className={styles.sessionGroup}>
                <p className={styles.sessionSubtitle}>
                  Need water · {wateringDue.length} {wateringDue.length === 1 ? 'plant' : 'plants'}
                </p>
                <div className={styles.sessionChips}>
                  {wateringDue.map(plant => (
                    <button
                      key={plant.id}
                      className={`${styles.sessionChip} ${styles.sessionChipWater}`}
                      onClick={() => onQuickWater(plant)}
                      title={`Water ${plantName(plant)}`}
                      type="button"
                    >
                      💧 {plantName(plant)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {checkQueue.ready.length > 0 && (
              <div className={styles.sessionGroup}>
                <p className={styles.sessionSubtitle}>
                  Ready to check · {checkQueue.ready.length} {checkQueue.ready.length === 1 ? 'plant' : 'plants'}
                </p>
                <div className={styles.sessionChips}>
                  {checkQueue.ready.map(plant => (
                    <button
                      key={plant.id}
                      className={styles.sessionChip}
                      onClick={() => onQuickReading(plant)}
                      title={`Log reading for ${plantName(plant)}`}
                      type="button"
                    >
                      ◎ {plantName(plant)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {checkQueue.waiting.length > 0 && (
              <div className={styles.sessionGroup}>
                <p className={styles.sessionSubtitle}>
                  Still settling · {checkQueue.waiting.length} {checkQueue.waiting.length === 1 ? 'plant' : 'plants'}
                </p>
                <div className={styles.sessionChips}>
                  {checkQueue.waiting.map(({ plant, minsLeft }) => (
                    <span
                      key={plant.id}
                      className={`${styles.sessionChip} ${styles.sessionChipSettling}`}
                      title={`${plantName(plant)} — check in ${minsLeft}m`}
                    >
                      {plantName(plant)} · {minsLeft}m
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <div ref={attentionRef} className={styles.overviewGrid}>
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
            <p className={styles.healthGridSub}>% of readings in healthy moisture range — tap to open</p>
            <div className={styles.healthCircles}>
              {gardenHealth.plants.map(({ plant, pct }) => (
                <button
                  key={plant.id}
                  className={styles.healthPlantBtn}
                  onClick={() => navigate(`/plant/${plant.id}`)}
                  title={`${plantName(plant)} — ${pct}% in range`}
                  type="button"
                >
                  <InRangeDonut pct={pct} />
                  <span className={styles.healthCircleName}>{plantName(plant)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={styles.bottomGrid}>
          <RecentActivityCard activities={activities} />
          <CareTipCard />
        </div>

        <GardenChat plants={plants} />
      </div>
    </main>
  )
}
