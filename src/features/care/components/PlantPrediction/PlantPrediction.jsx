import styles from './PlantPrediction.module.css'
import { computeModel, getRecommendation } from '../../../../utils/plantModel.js'
import { lastReading, lastWatering } from '../../../../utils/plantSelectors.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDroplet } from '@fortawesome/free-solid-svg-icons'

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

  const wateringStyleLabel = careProfile?.wateringStyle === 'flood-and-dry'
    ? '🌊 Flood & dry out'
    : careProfile?.wateringStyle === 'consistent'
    ? <><FontAwesomeIcon icon={faDroplet} style={{ marginRight: '5px', fontSize: '8px', opacity: 0.8 }} />Consistent moisture</>
    : null

  const wateringFrequency = careProfile?.wateringFrequency ?? null

  // ── Species default (still learning) ─────────────────────────────────────
  // When the model doesn't have enough data yet, show the species-level default
  // instead of a noisy, inaccurate personalized prediction.
  const stillLearning = usingDefaults || confidence === 'low'
  if (stillLearning) {
    return (
      <div className={styles.wrap}>
        {wateringStyleLabel && (
          <span className={styles.wateringStyle}>{wateringStyleLabel}</span>
        )}
        {wateringFrequency && (
          <span className={styles.wateringFrequency}>{wateringFrequency}</span>
        )}
        <div className={styles.progressRow}>
          {[0, 1, 2].map(i => (
            <span key={i} className={i < totalSamples ? styles.dotFilled : styles.dotEmpty} />
          ))}
          <span className={styles.progressLabel}>
            {totalSamples === 0
              ? 'Log a reading before and after watering to unlock predictions'
              : 'Still learning — keep logging readings'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {wateringStyleLabel && (
        <span className={styles.wateringStyle}>{wateringStyleLabel}</span>
      )}
      {wateringFrequency && (
        <span className={styles.wateringFrequency}>{wateringFrequency}</span>
      )}
      <span className={styles.moistureRaw}>
        ◎ {Math.round(Number(reading.moisture))} ({relTime(reading.timestamp)})
      </span>
      <span className={styles.moistureEst}>
        ◎ {Math.round(predicted)} (estimated now)
      </span>
    </div>
  )
}
