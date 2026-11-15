import { PLANT_DB } from './plantDatabase.js'
import { personalCareProfile } from './plantSelectors.js'

/** Returns the care profile for an exact DB key, or null if not found. */
export function lookupPlant(species) {
  if (!species) return null
  return PLANT_DB[species] ?? null
}

// Remembered per plant, for the same reason as getPredictionReliability's
// cache: screens ask for every plant's profile on every re-render, and
// downstream caches compare the profile by identity — handing back a fresh
// copy each time would defeat them. The answer only changes when the plant's
// events or species do.
const profileCache = new WeakMap()

/**
 * The care profile to judge THIS plant by: its species profile, with the
 * moisture range restated on this pot's own scale once there's enough history
 * (see personalCareProfile, #152). Use this wherever a specific plant is being
 * assessed; use lookupPlant when there's only a species (e.g. the add-plant
 * form). Returns null for an unrecognized species.
 */
export function careProfileFor(plant) {
  const species = lookupPlant(plant?.species)
  if (!species || plant === null || typeof plant !== 'object') return species
  const count = plant.events?.length ?? 0
  const hit = profileCache.get(plant)
  if (hit && hit.events === plant.events && hit.count === count && hit.species === species) return hit.value
  const value = personalCareProfile(plant, species)
  profileCache.set(plant, { events: plant.events, count, species, value })
  return value
}
