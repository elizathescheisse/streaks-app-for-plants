import styles from './PlantPrediction.module.css'
import { computeModel, getRecommendation, getLastResidual } from '../utils/plantModel.js'
import { lastReading } from '../utils/plantSelectors.js'

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

export default function PlantPrediction({ plant, careProfile }) {
  const reading = lastReading(plant)
  if (!reading) return null

  const model   = computeModel(plant)
  const rec     = getRecommendation(plant, model, careProfile)
  const residual = getLastResidual(plant, model)
  if (!rec) return null

  const { predicted, daysUntilDry, waterNeeded, dominantUnit, hasRange, confidence, usingDefaults, totalSamples } = rec

  const isOverdue = hasRange && daysUntilDry <= 0
  const isDueSoon = hasRange && daysUntilDry > 0 && daysUntilDry <= 1

  const recClass = isOverdue ? styles.recUrgent : isDueSoon ? styles.recSoon : styles.recNormal

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {/* Estimated current moisture */}
        <span className={styles.moisture}>
          ◎ ~{predicted} now
        </span>

        {/* Watering recommendation — only if we have a target range */}
        {hasRange && (
          <span className={`${styles.rec} ${recClass}`}>
            💧 Water {daysLabel(daysUntilDry)}
            {waterNeeded > 0 && ` · ${waterLabel(waterNeeded, dominantUnit)}`}
          </span>
        )}
      </div>

      {/* Residual feedback — shown when last prediction was off */}
      {residual && residualLabel(residual.residual) && (
        <p className={styles.residual}>
          {residualLabel(residual.residual)} · updating model
        </p>
      )}

      {/* Confidence / learning status */}
      <p className={styles.confidence}>
        {usingDefaults
          ? 'Using defaults — log readings + waterings to personalize'
          : confidence === 'low'
          ? `Still learning · ${totalSamples} data point${totalSamples !== 1 ? 's' : ''}`
          : `Based on ${totalSamples} data points`
        }
      </p>
    </div>
  )
}
