import { PLANT_DB } from '../data/plantDatabase.js'

/** Returns the care profile for an exact DB key, or null if not found. */
export function lookupPlant(species) {
  if (!species) return null
  return PLANT_DB[species] ?? null
}
