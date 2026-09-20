// Plant-specific diagnosis sentences, generated from real logged data.
// This is UI-facing text — kept separate from plantModel.js / plantSelectors.js.

import {
  pctTimeInRange,
  avgWateringInterval,
  wateringIntervalAdvice,
  avgPourAmount,
  predictedLandingMoisture,
  getEvents,
} from './plantSelectors.js'
import { learnedWaterAmount } from './plantModel.js'

function plantName(plant) {
  const n = plant.name || (plant.species ? plant.species.replace(/\b\w/g, c => c.toUpperCase()) : null)
  return n || 'This plant'
}

export function generateInsight(plant, model, careProfile) {
  const name = plantName(plant)
  const readings = getEvents(plant, 'reading')
  const totalSamples = (model?.alphaSamples ?? 0) + (model?.betaSamples ?? 0)

  // 1. Not enough data yet
  if (!model || totalSamples < 3 || readings.length < 3) {
    return 'Still gathering data — keep logging readings before and after watering to unlock specific insights.'
  }

  const range = careProfile?.moistureRange
  const lo = range?.[0]
  const hi = range?.[1]
  const pct = pctTimeInRange(plant, careProfile)
  const avgInterval = avgWateringInterval(plant)
  const advice = wateringIntervalAdvice(plant, model, careProfile)
  const idealInterval = advice?.basis === 'model' ? advice.days : null
  const pour = avgPourAmount(plant)
  const landing = pour ? predictedLandingMoisture(plant, model, careProfile) : null

  // 2. Chronically too dry: <50% in range AND median below floor
  if (pct != null && pct < 50 && lo != null) {
    const sorted = readings.map(r => Number(r.moisture)).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

    if (median < lo) {
      if (avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.1) {
        return `${name} has been below its healthy range ${100 - pct}% of the time. It's ready for water about every ~${Math.round(idealInterval)} days, but you're watering every ~${Math.round(avgInterval)} — it's thirsty by the time you get to it.`
      }
      return `${name} has been below its healthy range ${100 - pct}% of the time. Its median moisture is ${median.toFixed(1)}, below the healthy floor of ${lo}.`
    }
  }

  // 3. Watering interval significantly longer than ideal (>30% beyond)
  if (avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.3) {
    return `${name} needs water about every ~${Math.round(idealInterval)} days based on how it's been behaving, but you're watering every ~${Math.round(avgInterval)}. Closing that gap should keep it in range more consistently.`
  }

  // 4. Typical pour doesn't lift the plant into its healthy range
  //    Skipped when the plant's own history says bigger pours don't raise its
  //    reading — advice to "pour more" would be wrong; the interval is the lever.
  const pourHelps = learnedWaterAmount(plant, careProfile).pourSizeMatters !== false
  if (!pourHelps && landing != null && lo != null && landing < lo && model.beta) {
    const test = advice?.basis === 'experiment'
      ? ` Worth a test: try every ~${Math.round(advice.days)} days for a few waterings and see whether more readings land in range.`
      : ''
    return `Watering ${name} more doesn't seem to raise its reading (it tops out around ${landing.toFixed(1)}, below the healthy floor of ${lo}), so extra water likely just drains out. It dries about ${model.beta.toFixed(1)} points a day, so watering a bit more often — not more per pour — is the lever.${test}`
  }
  if (pourHelps && landing != null && lo != null && landing < lo) {
    const gain = (pour.amount * model.alpha).toFixed(1)
    return `Your typical pour of ${pour.amount} ${pour.unit} adds about ${gain} moisture points, but ${name} lands around ${landing.toFixed(1)} — just short of its healthy floor (${lo}). A slightly bigger pour should do it.`
  }

  // 5. Doing well — no sentence needed here; the in-range donut in Current
  // status already communicates this directly.
  if (pct != null && pct >= 80) {
    return null
  }

  // 6. Fallback
  const pctStr = pct != null ? `${pct}% of the time` : 'some of the time'
  return `${name} has been in its healthy moisture range ${pctStr}. Keep logging to unlock more specific insights.`
}
