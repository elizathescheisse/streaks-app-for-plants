// Plant-specific diagnosis sentences, generated from real logged data.
// This is UI-facing text — kept separate from plantModel.js / plantSelectors.js.

import {
  pctTimeInRange,
  avgWateringInterval,
  idealWateringInterval,
  avgPourAmount,
  predictedLandingMoisture,
  getEvents,
} from './plantSelectors.js'

function plantName(plant) {
  const n = plant.name || (plant.species ? plant.species.replace(/\b\w/g, c => c.toUpperCase()) : null)
  return n || 'This plant'
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

function intervalNote(avg, ideal) {
  if (avg == null || ideal == null) return ''
  return ` (watering every ~${Math.round(avg)}d, ideal ~${Math.round(ideal)}d)`
}

export function generateInsight(plant, model, careProfile) {
  const name = plantName(plant)
  const readings = getEvents(plant, 'reading')
  const totalSamples = (model?.alphaSamples ?? 0) + (model?.betaSamples ?? 0)

  if (!model || totalSamples < 3 || readings.length < 3) {
    return 'Still gathering data — keep logging readings before and after watering to unlock specific insights.'
  }

  const range = careProfile?.moistureRange
  const lo = range?.[0]
  const hi = range?.[1]
  const pct = pctTimeInRange(plant, careProfile)
  const avgInterval = avgWateringInterval(plant)
  const idealInterval = idealWateringInterval(model, careProfile)
  const pour = avgPourAmount(plant)
  const landing = pour ? predictedLandingMoisture(plant, model, careProfile) : null

  const moistures = readings.map(r => Number(r.moisture))
  const med = median(moistures)
  const aboveCount = hi != null ? moistures.filter(m => m > hi).length : 0
  const belowCount = lo != null ? moistures.filter(m => m < lo).length : 0
  const abovePct = Math.round((aboveCount / readings.length) * 100)
  const belowPct = Math.round((belowCount / readings.length) * 100)

  // ── Severe cases (majority out of range) ─────────────────────────────────

  // Chronically thirsty: most readings below floor
  if (pct != null && pct < 50 && lo != null && med < lo) {
    if (avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.1) {
      return `${name} has been below its healthy range ${belowPct}% of the time. It dries out in ~${Math.round(idealInterval)} days, but you're watering every ~${Math.round(avgInterval)} — it's thirsty by the time you get to it.`
    }
    return `${name} has been below its healthy range ${belowPct}% of the time. Its median moisture is ${med.toFixed(1)}, below the healthy floor of ${lo}.`
  }

  // Chronically wet: most readings above ceiling
  if (pct != null && pct < 50 && hi != null && med > hi) {
    if (avgInterval != null && idealInterval != null && avgInterval < idealInterval * 0.7) {
      return `${name} has been above its healthy ceiling ${abovePct}% of the time. You're watering every ~${Math.round(avgInterval)} days, but it can sustain moisture for ~${Math.round(idealInterval)} days — it may not be drying out enough between waterings.`
    }
    return `${name} has been above its healthy ceiling ${abovePct}% of the time — median moisture is ${med.toFixed(1)}, above the ceiling of ${hi}. It's retaining moisture longer than expected.`
  }

  // ── Structural causes ────────────────────────────────────────────────────

  // Watering interval too long
  if (avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.3) {
    return `${name} dries out in ~${Math.round(idealInterval)} days based on its drying rate, but you're watering every ~${Math.round(avgInterval)}. It's spending time below range before you get to it — closing that gap should help.`
  }

  // Pour doesn't reach the healthy floor
  if (landing != null && lo != null && landing < lo) {
    const gain = (pour.amount * model.alpha).toFixed(1)
    return `Your typical pour of ${pour.amount} ${pour.unit} adds about ${gain} moisture points, but ${name} lands around ${landing.toFixed(1)} — just short of its healthy floor (${lo}). A slightly bigger pour should do it.`
  }

  // ── Doing well ───────────────────────────────────────────────────────────

  if (pct != null && pct >= 80) {
    return `${name} has been in its healthy range ${pct}% of the time — your current routine is working well.`
  }

  // ── Middle ground: diagnose direction of drift ───────────────────────────

  if (pct != null && lo != null && hi != null) {
    const note = intervalNote(avgInterval, idealInterval)

    // Mostly drifting low
    if (belowPct > abovePct && belowPct > 10) {
      const alreadyFrequent = avgInterval != null && idealInterval != null && avgInterval <= idealInterval
      if (alreadyFrequent) {
        // Timing isn't the issue — already watering more often than ideal
        return `${name} hits its healthy range ${pct}% of the time — ${belowPct}% of readings are below the floor of ${lo}${note}. You're already watering more often than the model expects, so timing isn't the cause. A bigger pour may help lift it further into range.`
      }
      return `${name} hits its healthy range ${pct}% of the time — ${belowPct}% of readings are below the floor of ${lo}${note}. It's drying out before you get to it. Watering a bit earlier should help.`
    }

    // Mostly drifting high
    if (abovePct > belowPct && abovePct > 10) {
      const alreadyInfrequent = avgInterval != null && idealInterval != null && avgInterval >= idealInterval
      if (alreadyInfrequent) {
        return `${name} hits its healthy range ${pct}% of the time — ${abovePct}% of readings are above the ceiling of ${hi}${note}. Moisture stays high after watering and takes time to drop into range — that's normal for a plant with a slow drying rate.`
      }
      return `${name} hits its healthy range ${pct}% of the time — ${abovePct}% of readings are above the ceiling of ${hi}${note}. You may be watering before it has a chance to dry down into range.`
    }

    // Balanced spread above and below
    return `${name} hits its healthy range ${pct}% of the time — readings are scattered both above (${abovePct}%) and below (${belowPct}%) the range${note}. The pattern is mixed enough that no single change stands out.`
  }

  // No range data
  return `${name} has been logged ${readings.length} time${readings.length === 1 ? '' : 's'}. Add a species so the app can show moisture range insights.`
}
