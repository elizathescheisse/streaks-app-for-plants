/**
 * Per-plant watering model.
 *
 * Two parameters:
 *   α (alpha) — moisture rise per unit of water  (e.g. 1.5 moisture points per cup)
 *   β (beta)  — moisture drop per day            (e.g. 0.5 points/day)
 *
 * Both are estimated per drying cycle by fitting a least-squares regression
 * line through that cycle's readings (see computeModel), then blended across
 * the most recent N cycles with exponential smoothing (γ = 0.25). Older cycles
 * outside the window are dropped so the estimate adapts to seasonal changes
 * (e.g. slower drying in winter). Cold-start defaults are used when not enough
 * data exists yet.
 */

import { lastReading, getEvents, isSignificantWatering, smoothedCurrentMoisture } from './plantSelectors.js'

const DEFAULT_ALPHA = 1.5   // moisture points per cup (generic prior)
const DEFAULT_BETA  = 0.5   // moisture points per day (generic prior)
const GAMMA         = 0.25  // EMA smoothing factor: recent obs weighted more
const BETA_WINDOW   = 6     // only use the N most recent β observations
const ALPHA_WINDOW  = 4     // only use the N most recent α observations

// A cycle's readings must span at least this long to yield a drying slope —
// below it the points are same-session probe noise, not a drying trend.
const MIN_SPAN_DAYS = 0.167  // 4h
// Hard ceiling on the learned drying rate. Most indoor plants dry at
// 0.1–0.4 points/day; nothing realistic exceeds this. Stops a single noisy
// cycle from pushing β into runaway territory.
const BETA_CEILING  = 0.7

// ─────────────────────────────────────────────────────────
// computeModel
// Splits the event timeline into drying cycles (the readings between two
// waterings) and fits a least-squares line to each cycle:
//
//   moisture = intercept − β · (days since the cycle's watering)
//
//   • slope → β (drying rate) for that cycle
//   • intercept → the post-watering peak → α = (peak − M_before) / water
//
// Fitting the whole cycle at once de-noises the unreliable moisture probe:
// one bad reading barely moves a best-fit line, whereas the old
// two-points-at-a-time method let a single outlier corrupt the slope. With
// exactly 2 readings the fit reduces to the same pairwise slope as before, so
// nothing is lost; with 1 reading a cycle yields no slope (no guessing). This
// also removes the max-peak selection heuristic that caused the #109 feedback
// loop — there's no peak to "pick," it's just the regression intercept.
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

// Ordinary least-squares fit of y = intercept + slope·x.
// Returns { slope, intercept, r2, n } or null when it can't fit — fewer than
// two points, or every point shares the same x (vertical, no slope defined).
function linearFit(points) {
  const n = points.length
  if (n < 2) return null
  let sx = 0, sy = 0
  for (const p of points) { sx += p.x; sy += p.y }
  const mx = sx / n, my = sy / n
  let sxx = 0, sxy = 0, syy = 0
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  // R²: fraction of variance explained. A flat line through flat data (syy=0)
  // is a perfect fit by convention.
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2, n }
}

export function computeModel(plant, careProfile) {
  const timeline = (plant.events ?? [])
    .filter(e => e.type === 'reading' || e.type === 'watering')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // ── Segment into drying cycles ────────────────────────────────────────
  // A cycle is opened by a watering (or the start of history) and holds every
  // reading until the next watering. `preReading` is the reading immediately
  // before the cycle's watering — the baseline the watering lifted moisture
  // from, used to derive α.
  const cycles = []
  let cur = { watering: null, preReading: null, readings: [] }
  for (const e of timeline) {
    if (e.type === 'reading') {
      cur.readings.push(e)
    } else { // watering — close the current cycle, open the next
      cycles.push(cur)
      const preReading = cur.readings.length
        ? cur.readings[cur.readings.length - 1]
        : null
      cur = { watering: e, preReading, readings: [] }
    }
  }
  cycles.push(cur)

  const betaObs  = []   // one drying slope per qualifying cycle
  const alphaObs = []   // one rise-per-water per qualifying cycle
  const betaR2s  = []   // goodness-of-fit, parallel to betaObs

  for (const cycle of cycles) {
    const originTs = cycle.watering
      ? new Date(cycle.watering.timestamp).getTime()
      : (cycle.readings.length ? new Date(cycle.readings[0].timestamp).getTime() : null)
    if (originTs == null) continue

    // Drop dry-pocket outliers: a post-watering reading cannot physically sit
    // below the pre-watering moisture (the probe landed in a dry pocket). Only
    // filter when it leaves at least one reading.
    let kept = cycle.readings
    if (cycle.preReading) {
      const base = Number(cycle.preReading.moisture)
      const filtered = kept.filter(r => Number(r.moisture) >= base)
      if (filtered.length) kept = filtered
    }

    const points = kept.map(r => ({
      x: (new Date(r.timestamp).getTime() - originTs) / 86_400_000,
      y: Number(r.moisture),
    }))
    const fit = linearFit(points)

    // ── β: drying rate = −slope, when the cycle spans a real time window ──
    // β is taken purely from the regression slope. It NEVER depends on which
    // reading we treat as the post-watering peak — that decoupling is what
    // structurally removes the #109 feedback loop.
    if (fit) {
      const span = points[points.length - 1].x - points[0].x
      const betaCycle = -fit.slope
      if (span >= MIN_SPAN_DAYS && betaCycle > 0) {
        betaObs.push(betaCycle)
        betaR2s.push(fit.r2)
      }
    }

    // ── α: moisture rise per unit water, from the post-watering peak ──
    if (cycle.watering && cycle.preReading && points.length) {
      const waterAmt = parseAmount(cycle.watering.amount)
      if (waterAmt && waterAmt > 0 && isSignificantWatering(cycle.watering, careProfile)) {
        // Conservative drying rate for back-extrapolating readings to the
        // moment of watering: β learned so far, capped at the default so a high
        // β can't over-inflate the implied peak. Not a feedback loop — β is
        // learned from regression slopes above, independent of this.
        const runningBeta = betaObs.length
          ? betaObs.reduce((s, v) => s + v, 0) / betaObs.length
          : DEFAULT_BETA
        const betaExtrap = Math.min(runningBeta, DEFAULT_BETA)
        // Peak = the highest moisture the soil reached, extrapolated back to
        // watering time. A clean drying cycle → the regression intercept (the
        // de-noised value at x=0). A rising cycle (probe in a dry pocket first,
        // a wetter spot later) → the max back-calc recovers the true peak (#98).
        const peak = (fit && fit.slope <= 0)
          ? fit.intercept
          : Math.max(...points.map(p => p.y + betaExtrap * p.x))
        const rise = peak - Number(cycle.preReading.moisture)
        if (rise > 0 && rise <= 10) alphaObs.push(rise / waterAmt)
      }
    }
  }

  // EMA over the most recent cycles (seasonal adaptation — older cycles drop
  // out of the window so the estimate tracks the current season), then cap β.
  const recentBeta  = betaObs.slice(-BETA_WINDOW)
  const recentAlpha = alphaObs.slice(-ALPHA_WINDOW)

  let beta  = null
  for (const obs of recentBeta)  { beta  = beta  == null ? obs : GAMMA * obs + (1 - GAMMA) * beta  }
  if (beta != null) beta = Math.min(beta, BETA_CEILING)
  let alpha = null
  for (const obs of recentAlpha) { alpha = alpha == null ? obs : GAMMA * obs + (1 - GAMMA) * alpha }

  // Mean goodness-of-fit across the β-contributing cycles in the window — a
  // noisy fit shouldn't read as high confidence (see getRecommendation).
  const recentR2 = betaR2s.slice(-BETA_WINDOW)
  const betaR2 = recentR2.length
    ? recentR2.reduce((s, v) => s + v, 0) / recentR2.length
    : null

  // Dominant watering unit — for displaying recommendation in the right unit
  const waterings = (plant.events ?? []).filter(e => e.type === 'watering')
  const unitCounts = {}
  for (const w of waterings) unitCounts[w.unit] = (unitCounts[w.unit] ?? 0) + 1
  const dominantUnit = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'cups'

  return {
    alpha,                              // null if not enough data yet
    beta,                               // null if not enough data yet
    alphaSamples: alphaObs.length,      // qualifying cycles, not raw pairs
    betaSamples:  betaObs.length,
    betaR2,                             // mean R² of β-contributing cycles, or null
    dominantUnit,
  }
}

// ─────────────────────────────────────────────────────────
// predictMoisture
// Extrapolates from the last reading using β (or default).
// `asOf` lets callers ask "what would the prediction have been at time T"
// (used by getResidualHistory to replay past predictions); defaults to now.
// Returns null if no readings exist.
// ─────────────────────────────────────────────────────────
export function predictMoisture(plant, model, asOf = Date.now()) {
  const reading = lastReading(plant)
  if (!reading) return null

  const beta      = model.beta ?? DEFAULT_BETA
  const daysSince = (asOf - new Date(reading.timestamp)) / 86_400_000
  // Layer 2 — use smoothed (median of last 2–3 readings in cycle) as starting
  // moisture, so a single outlier probe reading doesn't spike the prediction.
  const startMoisture = smoothedCurrentMoisture(plant) ?? reading.moisture
  return Math.max(0, Math.min(10, startMoisture - beta * daysSince))
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
export function getRecommendation(plant, model, careProfile, asOf = Date.now()) {
  const reading = lastReading(plant)
  if (!reading) return null

  const beta  = model.beta  ?? DEFAULT_BETA
  const alpha = model.alpha ?? DEFAULT_ALPHA

  const predicted = predictMoisture(plant, model, asOf)
  if (predicted === null) return null

  const hasRange = !!careProfile?.moistureRange
  const [rangeLo, rangeHi] = careProfile?.moistureRange ?? [3, 6]

  // For flood-and-dry plants use dryThreshold (the moisture level at which
  // the plant actually needs water) rather than the bottom of the range.
  const waterTarget = careProfile?.wateringStyle === 'flood-and-dry'
    ? (careProfile.dryThreshold ?? rangeLo)
    : rangeLo

  const daysUntilDry = Math.max(0, (predicted - waterTarget) / beta)
  // Layer 3 — physical cap: you can never need more water than it would take
  // to bring the plant from bone-dry (0) all the way to the target moisture.
  // This is the true upper bound regardless of what the model computed.
  const physicalCap  = rangeHi / alpha
  const modelWaterNeeded = Math.min(physicalCap, Math.max(0, (rangeHi - predicted) / alpha))

  // Per-plant water-amount override (#76, Phase 4b). α is often badly
  // mislearned (e.g. an Alocasia where the model suggests ~9 cups but the user
  // knows 2 is right), so when the user has told us their usual amount, trust
  // it over the α-derived guess — but only the *amount*; whether water is
  // needed at all still comes from the model (waterNeeded > 0).
  const override = parseAmount(plant.typicalWater?.amount)
  const usingWaterOverride = override != null && override > 0 && modelWaterNeeded > 0
  const waterNeeded = usingWaterOverride ? override : modelWaterNeeded
  const dominantUnit = usingWaterOverride
    ? (plant.typicalWater?.unit ?? model.dominantUnit)
    : model.dominantUnit

  const totalSamples = model.betaSamples + model.alphaSamples
  let confidence = totalSamples === 0 ? 'none'
    : totalSamples < 3 ? 'low'
    : totalSamples < 8 ? 'medium'
    : 'high'
  // A scattery drying fit shouldn't read as fully confident even with lots of
  // cycles — the line through the noise isn't trustworthy. Knock 'high' down a
  // notch when the mean R² across cycles is poor.
  if (confidence === 'high' && model.betaR2 != null && model.betaR2 < 0.4) {
    confidence = 'medium'
  }

  return {
    predicted:     Math.round(predicted * 10) / 10,
    daysUntilDry:  Math.round(daysUntilDry * 10) / 10,
    waterNeeded:   Math.round(waterNeeded  * 10) / 10,
    dominantUnit,
    hasRange,
    confidence,
    usingDefaults: model.beta == null,
    usingWaterOverride,
    totalSamples,
  }
}

// ─────────────────────────────────────────────────────────
// getResidualHistory
// Replays the model over a plant's history to build a "report card" of how
// well past predictions held up — the automated version of the predicted-vs-
// actual log. For each reading after the first, it rebuilds the model from
// only the events *before* that reading (so the comparison is honest — the
// model never gets to peek at the reading it's being graded on), then:
//
//   • decay points (no watering since the previous reading): records the
//     predicted moisture vs. the actual reading, and the residual
//     (actual − predicted; positive = the plant was wetter than predicted).
//   • post-water points (a watering happened since the previous reading): the
//     model can't predict the post-watering moisture, so instead of a bogus
//     residual it records what the model *recommended* watering vs. what was
//     actually given — the over/under-watering signal.
//
// Returns an array (oldest → newest); [] when there aren't two readings yet.
// ─────────────────────────────────────────────────────────
export function getResidualHistory(plant, careProfile) {
  const readings = getEvents(plant, 'reading')
  if (readings.length < 2) return []

  const allEvents = plant.events ?? []
  const out = []

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1]
    const cur  = readings[i]
    const curTs  = new Date(cur.timestamp).getTime()
    const prevTs = new Date(prev.timestamp)

    const wateringsBetween = allEvents.filter(e =>
      e.type === 'watering' &&
      new Date(e.timestamp) > prevTs &&
      new Date(e.timestamp) < new Date(cur.timestamp)
    )
    const kind = wateringsBetween.length ? 'post-water' : 'decay'

    const entry = {
      timestamp:        cur.timestamp,
      actual:           Number(cur.moisture),
      kind,
      predicted:        null,
      residual:         null,
      recommendedWater: null,
      givenWater:       null,
      unit:             null,
    }

    if (kind === 'decay') {
      // What would the model — built only from events before this reading —
      // have predicted for this moment?
      const history = { ...plant, events: allEvents.filter(e => new Date(e.timestamp) < new Date(cur.timestamp)) }
      const model = computeModel(history, careProfile)
      const predicted = predictMoisture(history, model, curTs)
      if (predicted != null) {
        entry.predicted = Math.round(predicted * 10) / 10
        entry.residual  = Math.round((entry.actual - predicted) * 10) / 10
      }
    } else {
      // Compare the model's recommendation (as of just before the watering)
      // against what was actually poured.
      const watering = wateringsBetween[wateringsBetween.length - 1]
      const wTs = new Date(watering.timestamp).getTime()
      entry.givenWater = parseAmount(watering.amount)
      const preWater = { ...plant, events: allEvents.filter(e => new Date(e.timestamp) < new Date(watering.timestamp)) }
      const model = computeModel(preWater, careProfile)
      const rec = getRecommendation(preWater, model, careProfile, wTs)
      entry.recommendedWater = rec ? rec.waterNeeded : null
      entry.unit = rec?.dominantUnit ?? watering.unit ?? 'cups'
    }

    out.push(entry)
  }

  return out
}

// ─────────────────────────────────────────────────────────
// getPredictionReliability
// Answers "should the user trust this plant's predicted moisture, or go feel
// the soil?" by grading how well recent predictions have actually held up.
// Returns one of:
//   'learning' — not enough data yet to predict (or to judge accuracy). The UI
//                already shows a "still learning" state here.
//   'shaky'    — enough data, but recent predictions have been off (large mean
//                residual) or the drying fit is scattery (low R²). Don't assert
//                a confident number — tell the user to take a fresh reading.
//   'reliable' — enough data and recent predictions have tracked reality well.
//
// Honest-by-design: a chronically-wrong plant gets flagged 'shaky' so the app
// stops showing a confident-but-wrong estimate (Phase 4a).
// ─────────────────────────────────────────────────────────
const RELIABILITY_RECENT   = 4    // judge accuracy on the last N clean decay checks
const RELIABILITY_MIN_CHECKS = 2  // need at least this many to grade at all
const SHAKY_MEAN_RESIDUAL  = 1.5  // mean |actual − predicted| above this = shaky
const SHAKY_R2             = 0.4  // mean drying-fit R² below this = shaky

export function getPredictionReliability(plant, careProfile) {
  const model = computeModel(plant, careProfile)
  const totalSamples = model.betaSamples + model.alphaSamples

  // Mirrors getRecommendation's confidence floor — below this the model is
  // still calibrating and shouldn't be graded on accuracy.
  if (model.beta == null || totalSamples < 3) return 'learning'

  const decay = getResidualHistory(plant, careProfile)
    .filter(e => e.kind === 'decay' && e.residual != null)
  const recent = decay.slice(-RELIABILITY_RECENT)

  // Not enough clean predicted-vs-actual checks to judge accuracy yet.
  if (recent.length < RELIABILITY_MIN_CHECKS) return 'learning'

  const meanAbs = recent.reduce((s, e) => s + Math.abs(e.residual), 0) / recent.length

  // Either signal of untrustworthiness is enough: predictions land far off on
  // average, or the underlying drying fit is too scattery to believe.
  if (meanAbs > SHAKY_MEAN_RESIDUAL) return 'shaky'
  if (model.betaR2 != null && model.betaR2 < SHAKY_R2) return 'shaky'

  return 'reliable'
}
