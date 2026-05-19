import styles from './PlantPrediction.module.css'
import { computeModel, getRecommendation } from '../utils/plantModel.js'
import { lastReading, lastWatering } from '../utils/plantSelectors.js'

function relTime(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60_000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export default function PlantPrediction({ plant, careProfile }) {
  const reading  = lastReading(plant)
  const watering = lastWatering(plant)
  if (!reading) return null

  // If the most recent logged event is a watering (after the last reading),
  // the model can't estimate current moisture — it has no idea how much
  // the water raised the level. Show a settling state instead of a stale
  // "Water today" recommendation.
  const wateredAfterReading =
    watering && new Date(watering.timestamp) > new Date(reading.timestamp)

  if (wateredAfterReading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.row}>
          <span className={styles.settling}>
            💧 Watered {relTime(watering.timestamp)}
          </span>
        </div>
        <p className={styles.confidence}>
          Take a new reading once it soaks in
        </p>
      </div>
    )
  }

  const model = computeModel(plant)
  const rec   = getRecommendation(plant, model, careProfile)
  if (!rec) return null

  const { predicted, totalSamples, usingDefaults, confidence } = rec

  // ── Species default (still learning) ─────────────────────────────────────
  // When the model doesn't have enough data yet, show the species-level default
  // instead of a noisy, inaccurate personalized prediction.
  const stillLearning = usingDefaults || confidence === 'low'
  if (stillLearning) {
    return (
      <div className={styles.wrap}>
        <div className={styles.progressRow}>
          {[0, 1, 2].map(i => (
            <span key={i} className={i < totalSamples ? styles.dotFilled : styles.dotEmpty} />
          ))}
          <span className={styles.progressLabel}>
            {totalSamples === 0
              ? 'Log paired readings to unlock predictions'
              : totalSamples === 1
              ? '1 of 3 observations collected'
              : '2 of 3 observations collected'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.moistureRaw}>
        ◎ {Math.round(Number(reading.moisture))} ({relTime(reading.timestamp)})
      </span>
      <span className={styles.moistureEst}>
        ◎ {Math.round(predicted)} (estimated now)
      </span>
    </div>
  )
}
