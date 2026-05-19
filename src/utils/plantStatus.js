/**
 * Shared plant status logic.
 *
 * Extracted from PlantCard so App.jsx can use the same urgency signal
 * to sort the plant list without duplicating the computation.
 */

import { lookupPlant } from './plantLookup.js'
import { lastReading, lastWatering } from './plantSelectors.js'
import { computeModel, getRecommendation } from './plantModel.js'

function waterLabel(unit, amount) {
  if (!amount) return '—'
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}

// Returns { label, cls } describing the current watering status of a plant,
// given a moisture value and care profile.
//   cls values: 'struggling' | 'water' | 'good' | 'check' | 'thriving' | 'okay'
export function moistureStatus(moisture, careProfile, waterNeeded, waterUnit) {
  const val = Number(moisture)
  const [min, max] = careProfile?.moistureRange ?? [3, 6]

  const water = waterNeeded > 0
    ? ` · ${waterLabel(waterUnit, waterNeeded)}`
    : ''

  if (careProfile?.wateringStyle === 'flood-and-dry') {
    const dry       = careProfile.dryThreshold ?? min
    const wetBuffer = Math.max((max - min) * 0.5, 2)
    if (val < dry)              return { label: `💧 Water${water}`,  cls: 'water'    }
    if (val <= dry + 1)         return { label: '💧 Water soon',     cls: 'good'     }
    if (val <= max + wetBuffer) return { label: '🌿 Drying out',     cls: 'thriving' }
    return                             { label: '⚠️ Overwatered',    cls: 'okay'     }
  }

  const w         = max - min
  const dryBuffer = Math.max(w * 0.75, 2)
  const wetBuffer = Math.max(w * 0.5,  2)

  if (val < min - dryBuffer)  return { label: `🚨 Water immediately${water}`, cls: 'struggling' }
  if (val < min)               return { label: `💧 Water${water}`,             cls: 'water'      }
  if (val < min + w * 0.3)    return { label: '💧 Water soon',                 cls: 'good'       }
  if (val <= max + wetBuffer) return { label: '✓ Watered',                     cls: 'thriving'   }
  return                              { label: '⚠️ Overwatered',               cls: 'okay'       }
}

// Priority order for sorting — lower number = shown first.
const STATUS_PRIORITY = {
  struggling: 0,  // Water immediately
  water:      1,  // Water / Water soon (flood-and-dry)
  good:       2,  // Water soon (consistent)
  check:      3,  // Check in Xm — recently watered, settling
  thriving:   4,  // Watered / Drying out — all good
  okay:       5,  // Overwatered
}
const NO_STATUS_PRIORITY = 6  // No readings yet

// Returns a sort priority (0 = most urgent) for a plant.
export function getPlantSortPriority(plant) {
  const careProfile = lookupPlant(plant.species)
  const reading     = lastReading(plant)
  const watering    = lastWatering(plant)

  if (!reading) return NO_STATUS_PRIORITY

  const wateredAfterReading =
    watering && new Date(watering.timestamp) > new Date(reading.timestamp)

  if (wateredAfterReading) return STATUS_PRIORITY.check

  if (!careProfile?.moistureRange) return NO_STATUS_PRIORITY

  const model       = computeModel(plant, careProfile)
  const rec         = getRecommendation(plant, model, careProfile)
  const isConfident = rec && !rec.usingDefaults && rec.confidence !== 'low'
  const rawMoisture = Math.round(Number(reading.moisture))
  const predMoisture = isConfident ? Math.round(rec.predicted) : null
  const drift       = predMoisture != null ? Math.abs(predMoisture - rawMoisture) : 0
  const badgeMoisture = (isConfident && drift >= 1) ? predMoisture : rawMoisture

  const { cls } = moistureStatus(badgeMoisture, careProfile, rec?.waterNeeded, rec?.dominantUnit)
  return STATUS_PRIORITY[cls] ?? NO_STATUS_PRIORITY
}
