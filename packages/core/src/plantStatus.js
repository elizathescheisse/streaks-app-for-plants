/**
 * Shared plant status logic.
 *
 * Extracted from PlantCard so App.jsx can use the same urgency signal
 * to sort the plant list without duplicating the computation.
 */

import { lookupPlant } from './plantLookup.js'
import { lastReading, lastWatering } from './plantSelectors.js'
import { computeModel, getRecommendation, getPredictionReliability } from './plantModel.js'

function waterLabel(unit, amount) {
  if (!amount) return '—'
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}

// Returns { label, cls } describing the current watering status of a plant,
// given a moisture value and care profile.
//   cls values: 'struggling' | 'water' | 'check' | 'thriving' | 'okay'
export function moistureStatus(moisture, careProfile, waterNeeded, waterUnit) {
  const val = Number(moisture)
  const [min, max] = careProfile?.moistureRange ?? [3, 6]

  const water = waterNeeded > 0
    ? ` · ${waterLabel(waterUnit, waterNeeded)}`
    : ''

  if (careProfile?.wateringStyle === 'flood-and-dry') {
    const dry = careProfile.dryThreshold ?? min
    // Badge fires strictly below the dry threshold — anywhere in [dry, max+1] is normal cycle
    if (val < dry)          return { label: `💧 Water${water}`,  cls: 'water'    }
    if (val <= max + 1)     return { label: '🌿 Drying out',     cls: 'thriving' }
    return                         { label: '⚠️ Overwatered',    cls: 'okay'     }
  }

  const w         = max - min
  const dryBuffer = Math.max(w * 0.75, 2)
  const wetBuffer = Math.max(w * 0.5,  2)

  if (val < min - dryBuffer)  return { label: `🚨 Water immediately${water}`, cls: 'struggling' }
  if (val < min)               return { label: `💧 Water${water}`,             cls: 'water'      }
  if (val <= max + wetBuffer) return { label: '✓ Watered',                     cls: 'thriving'   }
  return                              { label: '⚠️ Overwatered',               cls: 'okay'       }
}

// Post-watering "settling" badge — the moisture number is unknown until the
// water soaks in, so show a check-back timer instead of a (stale) status.
// Returns { label, cls: 'check' } or null when the badge shouldn't show.
//
// Two cases share this window:
//  - watered after the last reading → the old reading is stale; keep showing
//    "Check now" until a fresh reading is logged, however long that takes.
//  - watered with no readings ever (issue #173) → same timer, but drop the
//    badge once the settle window (8h) has long passed — a plant that never
//    gets readings shouldn't nag "Check now" forever.
const CHECK_SETTLE_MINS = 60
const CHECK_EXPIRY_MINS = 8 * 60

export function wateringCheckStatus(watering, reading, now = Date.now()) {
  if (!watering) return null
  if (reading && new Date(reading.timestamp) >= new Date(watering.timestamp)) return null
  const minsSince = (now - new Date(watering.timestamp)) / 60_000
  if (!reading && minsSince > CHECK_EXPIRY_MINS) return null
  const minsLeft = Math.round(Math.max(0, CHECK_SETTLE_MINS - minsSince))
  return { label: minsLeft > 0 ? `Check in ${minsLeft}m` : 'Check now', cls: 'check' }
}

// Priority order for sorting — lower number = shown first.
const STATUS_PRIORITY = {
  struggling: 0,  // Water immediately
  water:      1,  // Water now
  check:      2,  // Check in Xm — recently watered, settling
  thriving:   3,  // Watered / Drying out — all good
  okay:       4,  // Overwatered
}
const NO_STATUS_PRIORITY = 6  // No readings yet

// Returns a sort priority (0 = most urgent) for a plant.
export function getPlantSortPriority(plant) {
  const careProfile = lookupPlant(plant.species)
  const reading     = lastReading(plant)
  const watering    = lastWatering(plant)

  if (wateringCheckStatus(watering, reading)) {
    // Within the "check" bucket, rank by urgency: less settling time left
    // sorts first, so "Check now" appears above "Check in 3m". minsLeft
    // ranges 0–60; normalize to a fraction so this never crosses into the
    // next priority tier (STATUS_PRIORITY.thriving = 3).
    const minsSince = (Date.now() - new Date(watering.timestamp)) / 60_000
    const minsLeft  = Math.max(0, 60 - minsSince)
    return STATUS_PRIORITY.check + minsLeft / 60
  }

  if (!reading) return NO_STATUS_PRIORITY

  if (!careProfile?.moistureRange) return NO_STATUS_PRIORITY

  const model       = computeModel(plant, careProfile)
  const rec         = getRecommendation(plant, model, careProfile)
  const isConfident = rec && !rec.usingDefaults && rec.confidence !== 'low'
  const shaky       = model ? getPredictionReliability(plant, careProfile) === 'shaky' : false
  const rawMoisture = Math.round(Number(reading.moisture))
  const predMoisture = isConfident ? Math.round(rec.predicted) : null
  // Same freshness rule as PlantCard/PlantDetailPage: a reading taken today,
  // or a watering within the last 8 hours, is fresh — use the raw value, not
  // the model's projection. Otherwise the sort priority can diverge from the
  // badge actually shown (a stale-but-"thriving" prediction masking a fresh
  // "water immediately" reading).
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const readingIsToday = new Date(reading.timestamp) >= todayStart
  const WATER_SETTLE_MS = 8 * 60 * 60 * 1000
  const wateredVeryRecently = !readingIsToday && watering
    ? (Date.now() - new Date(watering.timestamp).getTime()) < WATER_SETTLE_MS
    : false
  const usePredicted = isConfident && !shaky && !readingIsToday && !wateredVeryRecently
  const badgeMoisture = usePredicted ? predMoisture : rawMoisture

  const { cls } = moistureStatus(badgeMoisture, careProfile, rec?.waterNeeded, rec?.dominantUnit)
  return STATUS_PRIORITY[cls] ?? NO_STATUS_PRIORITY
}
