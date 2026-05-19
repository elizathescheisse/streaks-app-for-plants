import styles from './PlantPrediction.module.css'
import { computeModel, getRecommendation, getLastResidual } from '../utils/plantModel.js'
import { lastReading, lastWatering } from '../utils/plantSelectors.js'

function waterLabel(amount, unit) {
  if (!amount) return ''
  if (unit === 'cups')   return `${amount} cup${amount === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount}L`
  return `${amount}`
}

function daysLabel(days) {
  if (days <= 0)  return 'today'
  if (days < 1.5) return 'tomorrow'
  return `in ${Math.round(days)}d`
}

function residualLabel(residual) {
  if (Math.abs(residual) < 0.3) return null  // too small to mention
  const diff = Math.abs(Math.round(residual * 10) / 10)
  return residual > 0
    ? `Last reading was ${diff} higher than predicted`
    : `Last reading was ${diff} lower than predicted`
}

function relTime(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60_000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return 'today'
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
    const wLabel = waterLabel(watering.amount, watering.unit)
    return (
      <div className={styles.wrap}>
        <div className={styles.row}>
          <span className={styles.settling}>
            💧 {wLabel ? `${wLabel} · ` : ''}Watered {relTime(watering.timestamp)}
          </span>
        </div>
        <p className={styles.confidence}>
          Take a new reading once it soaks in
        </p>
      </div>
    )
  }

  const model    = computeModel(plant)
  const rec      = getRecommendation(plant, model, careProfile)
  const residual = getLastResidual(plant, model)
  if (!rec) return null

  const { predicted, daysUntilDry, waterNeeded, dominantUnit, hasRange, confidence, usingDefaults, totalSamples } = rec

  // ── Species default (still learning) ─────────────────────────────────────
  // When the model doesn't have enough data yet, show the species-level default
  // instead of a noisy, inaccurate personalized prediction.
  const stillLearning = usingDefaults || confidence === 'low'
  if (stillLearning) {
    const freq      = careProfile?.wateringFrequency
    const name      = careProfile?.displayName ?? null
    const nameStr   = name ? `${name} generally likes water` : 'This plant generally likes water'
    return (
      <div className={styles.wrap}>
        {freq ? (
          <p className={styles.speciesDefault}>
            {nameStr} <strong>{freq}</strong>.
          </p>
        ) : null}
        <p className={styles.confidence}>
          Log a few more readings to get a personalized recommendation.
        </p>
      </div>
    )
  }

  // ── Personalized prediction ───────────────────────────────────────────────
  // isOverdue = model predicts moisture is already *below* the dry threshold (daysUntilDry < 0).
  // daysUntilDry === 0 means "at the threshold right now" — treat as due-soon, not urgent,
  // so the color agrees with the badge which shows green/yellow when still in range.
  const isOverdue = hasRange && daysUntilDry < 0
  const isDueSoon = hasRange && daysUntilDry >= 0 && daysUntilDry <= 1
  const recClass  = isOverdue ? styles.recUrgent : isDueSoon ? styles.recSoon : styles.recNormal

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {/* Estimated current moisture */}
        <span className={styles.moisture}>
          ◎ ~{Math.round(predicted)} now
        </span>

        {/* Watering recommendation — only if we have a target range */}
        {hasRange && (
          <span className={`${styles.rec} ${recClass}`}>
            💧 Water {daysLabel(daysUntilDry)}
            {waterNeeded > 0 && ` · ${waterLabel(waterNeeded, dominantUnit)}`}
          </span>
        )}
      </div>

      <p className={styles.confidence}>
        Based on {totalSamples} data points
      </p>
    </div>
  )
}
