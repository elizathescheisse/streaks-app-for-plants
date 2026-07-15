import styles from './PlantInsightsSection.module.css'
import { generateInsight } from '@plant-streaks/core/plantInsights.js'
import {
  pctTimeInRange,
  avgWateringInterval,
  idealWateringInterval,
  avgPourAmount,
  predictedLandingMoisture,
  getEvents,
} from '@plant-streaks/core/plantSelectors.js'

function barColor(pct) {
  if (pct >= 80) return styles.barGreen
  if (pct >= 50) return styles.barYellow
  return styles.barRed
}

function roundDays(days) {
  return days < 1.5 ? '1' : String(Math.round(days))
}

export default function PlantInsightsSection({ plant, model, rec, careProfile }) {
  const range = careProfile?.moistureRange
  if (!range) return null

  const readings = getEvents(plant, 'reading')
  if (readings.length < 3) return null

  const pct = pctTimeInRange(plant, careProfile)
  const avgInterval = avgWateringInterval(plant)
  const idealInterval = idealWateringInterval(model, careProfile)
  const pour = avgPourAmount(plant)
  const landing = model && pour ? predictedLandingMoisture(plant, model, careProfile) : null
  const insight = generateInsight(plant, model, careProfile)

  const intervalLong = avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.3
  const pourShort = landing != null && range && landing < range[0]

  const daysUntilDry = rec?.daysUntilDry
  const showRunway = daysUntilDry != null && daysUntilDry > 0

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Insights</h2>

      {pct != null && (
        <div className={styles.inRangeRow}>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${barColor(pct)}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.barLabel}>{pct}% of readings in healthy range</span>
        </div>
      )}

      <div className={styles.statGrid}>
        {avgInterval != null && idealInterval != null && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Watering interval</span>
            <span className={styles.statValue}>
              every ~{roundDays(avgInterval)}d
              <span className={styles.statSep}>·</span>
              ideal ~{roundDays(idealInterval)}d
              <span className={intervalLong ? styles.iconWarn : styles.iconOk}>
                {intervalLong ? '⚠' : '✓'}
              </span>
            </span>
          </div>
        )}

        {landing != null && pour && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Typical pour</span>
            <span className={styles.statValue}>
              {pour.amount} {pour.unit} → ~{landing.toFixed(1)} after watering
              <span className={pourShort ? styles.iconWarn : styles.iconOk}>
                {pourShort ? '⚠' : '✓'}
              </span>
            </span>
          </div>
        )}

        {showRunway && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Water needed in</span>
            <span className={styles.statValue}>~{roundDays(daysUntilDry)} day{daysUntilDry >= 1.5 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <p className={styles.insightText}>{insight}</p>
    </section>
  )
}
