// Shared card/detail display derivation — the "what moisture number and
// status badge should this plant show right now" logic.
//
// This was originally inlined in the web PlantCard, and a near-copy in
// plantStatus.js's getPlantSortPriority drifted out of sync once (the
// freshness rules diverged and urgent plants stopped sorting to the top).
// Centralizing it here keeps web, mobile, and the sort priority reading
// from one source. Pure — no React, no DOM.

import { lookupPlant } from './plantLookup.js'
import { lastReading, lastWatering, currentHealth } from './plantSelectors.js'
import { computeModel, getRecommendation, getPredictionReliability } from './plantModel.js'
import { moistureStatus } from './plantStatus.js'

const WATER_SETTLE_MS = 8 * 60 * 60 * 1000

// Returns everything a card/detail view needs to render the moisture badge:
//   { careProfile, hasStats, reading, watering, health, wateredAfterReading,
//     badgeMoisture, usePredicted, status: { label, cls } | null,
//     rec, model }
// `now` is passed in (not read from Date.now internally) so callers with a
// ticking clock render consistently and tests are deterministic.
export function derivePlantCardState(plant, now = Date.now()) {
  const careProfile = lookupPlant(plant.species)
  const hasStats = !!careProfile?.moistureRange
  const reading = lastReading(plant)
  const watering = lastWatering(plant)
  const health = currentHealth(plant)

  const wateredAfterReading =
    watering && reading && new Date(watering.timestamp) > new Date(reading.timestamp)

  const model = reading && !wateredAfterReading ? computeModel(plant, careProfile) : null
  const rec = model ? getRecommendation(plant, model, careProfile) : null
  const isConfident = rec && !rec.usingDefaults && rec.confidence !== 'low'
  const shaky = model ? getPredictionReliability(plant, careProfile) === 'shaky' : false

  const rawMoisture = reading ? Math.round(Number(reading.moisture)) : null
  const predMoisture = isConfident ? Math.round(rec.predicted) : null

  // Estimated indicator shows only when genuinely extrapolating:
  //  1. reading taken today → fresh, no estimate
  //  2. no reading today but watered within 8h → still equilibrating
  //  3. otherwise → estimate (if confident and not shaky)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const readingIsToday = reading ? new Date(reading.timestamp) >= todayStart : false
  const wateredVeryRecently = !readingIsToday && watering
    ? now - new Date(watering.timestamp).getTime() < WATER_SETTLE_MS
    : false

  const usePredicted = Boolean(isConfident && !shaky && !readingIsToday && !wateredVeryRecently)
  const badgeMoisture = usePredicted ? predMoisture : rawMoisture

  let status = null
  if (wateredAfterReading) {
    const minsSince = (now - new Date(watering.timestamp)) / 60_000
    const minsLeft = Math.round(Math.max(0, 60 - minsSince))
    status = { label: minsLeft > 0 ? `Check in ${minsLeft}m` : 'Check now', cls: 'check' }
  } else if (hasStats && badgeMoisture != null) {
    status = moistureStatus(badgeMoisture, careProfile, rec?.waterNeeded, rec?.dominantUnit)
  }

  return {
    careProfile,
    hasStats,
    reading,
    watering,
    health,
    wateredAfterReading: Boolean(wateredAfterReading),
    badgeMoisture,
    usePredicted,
    status,
    rec,
    model,
  }
}
