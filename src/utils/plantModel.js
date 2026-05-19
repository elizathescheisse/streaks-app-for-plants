/**
 * Per-plant watering model.
 *
 * Two parameters:
 *   α (alpha) — moisture rise per unit of water  (e.g. 1.5 moisture points per cup)
 *   β (beta)  — moisture drop per day            (e.g. 0.5 points/day)
 *
 * Both are estimated from the most recent N observations using exponential
 * smoothing (γ = 0.25). Older observations outside the window are dropped so
 * the estimate adapts to seasonal changes (e.g. slower drying in winter).
 * Cold-start defaults are used when not enough data exists yet.
 */

import { lastReading, getEvents } from './plantSelectors.js'

const DEFAULT_ALPHA = 1.5   // moisture points per cup (generic prior)
const DEFAULT_BETA  = 0.5   // moisture points per day (generic prior)
const GAMMA         = 0.25  // EMA smoothing factor: recent obs weighted more
const BETA_WINDOW   = 6     // only use the N most recent β observations
const ALPHA_WINDOW  = 4     // only use the N most recent α observations

// ─────────────────────────────────────────────────────────
// computeModel
// Walks the event timeline and estimates α and β.
//
// β sources: any two consecutive readings with no watering between them
//   β_obs = (M_t1 − M_t2) / days_between
//
// α sources: reading → watering → next reading (no extra watering in between)
//   M_peak ≈ M_next_reading + β * days_since_watering  (Option B back-calc)
//   α_obs = (M_peak − M_before) / water_amount
// ─────────────────────────────────────────────────────────
// Parse a user-entered water amount string to a number.
// Handles decimals ('1.5'), integers ('2'), and fractions ('3/4', '1/3').
// Returns null if the value is empty or unparseable.
function parseAmount(s) {
  if (!s) return null
  const str = String(s).trim()
  if (str.includes('/')) {
    const [n, d] = str.split('/').map(Number)
    return d ? n / d : null
  }
  const v = parseFloat(str)
  return isNaN(v) ? null : v
}

export function computeModel(plant) {
  const timeline = (plant.events ?? [])
    .filter(e => e.type === 'reading' || e.type === 'watering')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const betaObs  = []
  const alphaObs = []

  for (let i = 0; i < timeline.length; i++) {
    const e = timeline[i]
    if (e.type !== 'reading') continue

    // ── β source 1: consecutive readings with no watering in between ──
    // (cleanest signal — directly measures drying rate)
    if (i + 1 < timeline.length && timeline[i + 1].type === 'reading') {
      const next = timeline[i + 1]
      const days = (new Date(next.timestamp) - new Date(e.timestamp)) / 86_400_000
      if (days >= 0.167) {                       // at least 4 hours apart
        const drop = e.moisture - next.moisture
        if (drop > 0) betaObs.push(drop / days)
      }
    }

    // ── α + β source 2: reading → watering → reading triple ──
    // This is the natural workflow (read, water, check days later).
    // Gives α directly; also gives β using the current α estimate to
    // back-calculate the moisture peak. Both parameters are extractable
    // from the same triple — they refine each other over time.
    if (i + 1 < timeline.length && timeline[i + 1].type === 'watering') {
      const watering = timeline[i + 1]
      const waterAmt = parseAmount(watering.amount)
      if (!waterAmt || waterAmt <= 0) continue

      // Find next reading after the watering; abort if another watering appears first
      let afterIdx = -1
      for (let j = i + 2; j < timeline.length; j++) {
        if (timeline[j].type === 'watering') break
        if (timeline[j].type === 'reading') { afterIdx = j; break }
      }
      if (afterIdx === -1) continue

      const afterReading    = timeline[afterIdx]
      const daysAfterWater  =
        (new Date(afterReading.timestamp) - new Date(watering.timestamp)) / 86_400_000

      // Running estimates so far (or defaults if nothing yet)
      const runningBeta  = betaObs.length
        ? betaObs.reduce((s, v) => s + v, 0)  / betaObs.length
        : DEFAULT_BETA
      const runningAlpha = alphaObs.length
        ? alphaObs.reduce((s, v) => s + v, 0) / alphaObs.length
        : DEFAULT_ALPHA

      // ── α: back-calc M_peak from β, then compute moisture rise per unit water ──
      const MpeakForAlpha = afterReading.moisture + runningBeta * daysAfterWater
      const rise = MpeakForAlpha - e.moisture
      if (rise > 0 && rise <= 10) {
        alphaObs.push(rise / waterAmt)
      }

      // ── β: forward-calc M_peak from α, then compute drying rate ──
      const MpeakForBeta = e.moisture + runningAlpha * waterAmt
      const drop = MpeakForBeta - afterReading.moisture
      if (drop > 0 && daysAfterWater > 0 && drop / daysAfterWater < 5) {
        betaObs.push(drop / daysAfterWater)
      }
    }
  }

  // Apply EMA over a rolling window of the most recent N observations.
  // Older samples (outside the window) are discarded so the estimate adapts
  // to seasonal drift — e.g. slower drying in winter — without anchoring
  // to stale summer data. Total sample counts are preserved for confidence.
  const recentBeta  = betaObs.slice(-BETA_WINDOW)
  const recentAlpha = alphaObs.slice(-ALPHA_WINDOW)

  let beta  = null
  for (const obs of recentBeta)  { beta  = beta  == null ? obs : GAMMA * obs + (1 - GAMMA) * beta  }
  let alpha = null
  for (const obs of recentAlpha) { alpha = alpha == null ? obs : GAMMA * obs + (1 - GAMMA) * alpha }

  // Dominant watering unit — for displaying recommendation in the right unit
  const waterings = (plant.events ?? []).filter(e => e.type === 'watering')
  const unitCounts = {}
  for (const w of waterings) unitCounts[w.unit] = (unitCounts[w.unit] ?? 0) + 1
  const dominantUnit = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'cups'

  return {
    alpha,                              // null if not enough data yet
    beta,                               // null if not enough data yet
    alphaSamples: alphaObs.length,
    betaSamples:  betaObs.length,
    dominantUnit,
  }
}

// ─────────────────────────────────────────────────────────
// predictMoisture
// Extrapolates from the last reading using β (or default).
// Returns null if no readings exist.
// ─────────────────────────────────────────────────────────
export function predictMoisture(plant, model) {
  const reading = lastReading(plant)
  if (!reading) return null

  const beta      = model.beta ?? DEFAULT_BETA
  const daysSince = (Date.now() - new Date(reading.timestamp)) / 86_400_000
  return Math.max(0, Math.min(10, reading.moisture - beta * daysSince))
}

// ─────────────────────────────────────────────────────────
// getLastResidual
// Checks how accurate the last prediction was, if we have
// two consecutive readings with no watering between them.
// Returns { predicted, actual, residual } or null.
// ─────────────────────────────────────────────────────────
export function getLastResidual(plant, model) {
  const readings = getEvents(plant, 'reading')
  if (readings.length < 2) return null

  const prev = readings[readings.length - 2]
  const last = readings[readings.length - 1]

  // If there was a watering between the two readings, skip (prediction not clean)
  const wateringBetween = (plant.events ?? []).some(e =>
    e.type === 'watering' &&
    new Date(e.timestamp) > new Date(prev.timestamp) &&
    new Date(e.timestamp) < new Date(last.timestamp)
  )
  if (wateringBetween) return null

  const beta      = model.beta ?? DEFAULT_BETA
  const days      = (new Date(last.timestamp) - new Date(prev.timestamp)) / 86_400_000
  const predicted = Math.max(0, prev.moisture - beta * days)
  const residual  = last.moisture - predicted  // positive = wetter than expected

  return { predicted: Math.round(predicted * 10) / 10, actual: last.moisture, residual }
}

// ─────────────────────────────────────────────────────────
// getRecommendation
// Full recommendation object — powers the PlantPrediction UI.
// ─────────────────────────────────────────────────────────
export function getRecommendation(plant, model, careProfile) {
  const reading = lastReading(plant)
  if (!reading) return null

  const beta  = model.beta  ?? DEFAULT_BETA
  const alpha = model.alpha ?? DEFAULT_ALPHA

  const predicted = predictMoisture(plant, model)
  if (predicted === null) return null

  const hasRange = !!careProfile?.moistureRange
  const [rangeLo, rangeHi] = careProfile?.moistureRange ?? [3, 6]

  const daysUntilDry = Math.max(0, (predicted - rangeLo) / beta)
  const waterNeeded  = Math.max(0, (rangeHi - predicted) / alpha)

  const totalSamples = model.betaSamples + model.alphaSamples
  const confidence = totalSamples === 0 ? 'none'
    : totalSamples < 3 ? 'low'
    : totalSamples < 8 ? 'medium'
    : 'high'

  return {
    predicted:     Math.round(predicted * 10) / 10,
    daysUntilDry:  Math.round(daysUntilDry * 10) / 10,
    waterNeeded:   Math.round(waterNeeded  * 10) / 10,
    dominantUnit:  model.dominantUnit,
    hasRange,
    confidence,
    usingDefaults: model.beta == null,
    totalSamples,
  }
}
