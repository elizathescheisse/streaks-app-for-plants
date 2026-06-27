// Read-side helpers for the event-based plant model.
// Plants are { id, emoji, species, name, events: Event[] }
// Event types: 'reading' | 'watering' | 'health_change' | 'note'

export function getEvents(plant, type) {
  if (!plant?.events) return []
  return plant.events
    .filter(e => e.type === type)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

export function lastReading(plant) {
  const rs = getEvents(plant, 'reading')
  return rs.length ? rs[rs.length - 1] : null
}

export function lastWatering(plant) {
  const ws = getEvents(plant, 'watering')
  return ws.length ? ws[ws.length - 1] : null
}

export function currentHealth(plant) {
  const hs = getEvents(plant, 'health_change')
  return hs.length ? hs[hs.length - 1].health : 'good'
}

// Group all events into bundles (one bundle = one Save action).
// Returns bundles sorted newest first, by the earliest timestamp in each.
export function logBundles(plant) {
  if (!plant?.events) return []
  const map = new Map()
  for (const e of plant.events) {
    if (!map.has(e.bundleId)) map.set(e.bundleId, [])
    map.get(e.bundleId).push(e)
  }
  return [...map.values()].sort(
    (a, b) => new Date(b[0].timestamp) - new Date(a[0].timestamp)
  )
}

// Returns true if a watering event meets the species' minimum threshold.
// For flood-and-dry plants with a minWaterAmount, a tiny top-off doesn't
// count as a real watering (won't reset the badge, won't feed the α model).
// For consistent plants or unrecognized species, every watering counts.
export function isSignificantWatering(watering, careProfile) {
  const min = careProfile?.minWaterAmount
  if (!min) return true
  const amount = parseFloat(watering?.amount)
  if (!amount || isNaN(amount)) return false
  const threshold = min[watering?.unit] ?? min.cups
  return amount >= threshold
}

// Returns true when a new reading looks physically suspicious: there was a
// watering within the last 6 hours, yet the new reading is strictly below
// the moisture level recorded just before that watering.  The most likely
// explanation is probe placement — the sensor was pushed into a drier pocket
// of soil after watering.  Used to show an inline hint prompting the user to
// re-measure.
//
// `moisture`  — the new reading value (number or string)
// `timestamp` — ISO string or null (defaults to now)
export function isSuspiciousReading(plant, moisture, timestamp) {
  if (moisture === '' || moisture == null) return false
  const newMoisture = Number(moisture)
  const newTs       = timestamp ? new Date(timestamp).getTime() : Date.now()
  const WINDOW_MS   = 6 * 3_600_000   // 6 hours

  const timeline = (plant?.events ?? [])
    .filter(e => e.type === 'reading' || e.type === 'watering')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // Most recent watering within 6 h before this reading
  const recentWatering = [...timeline].reverse().find(e => {
    if (e.type !== 'watering') return false
    const wTs = new Date(e.timestamp).getTime()
    return wTs < newTs && (newTs - wTs) <= WINDOW_MS
  })
  if (!recentWatering) return false

  // Reading just before that watering
  const wateringTs      = new Date(recentWatering.timestamp).getTime()
  const preWaterReading = [...timeline].reverse().find(
    e => e.type === 'reading' && new Date(e.timestamp).getTime() < wateringTs
  )
  if (!preWaterReading) return false

  // Strictly less than — equal means "didn't water enough to move the needle,"
  // which is plausible and doesn't warrant a probe-placement warning.
  return newMoisture < Number(preWaterReading.moisture)
}

// Returns the smoothed "current" moisture for a plant — median of readings
// taken within 24 hours of the most recent reading in the current drying
// cycle (since the most recent watering).
//
// The 24-hour window is intentional: it captures same-session probe placement
// variance (measuring 2 in one spot, 6 in another) without pulling in
// genuine sequential readings from previous days (which are real dry-out
// measurements, not noise).  A reading from 3 days ago should NOT be averaged
// with today's reading.
//
// Returns null if no readings exist.
export function smoothedCurrentMoisture(plant) {
  const allReadings = getEvents(plant, 'reading')
  if (!allReadings.length) return null

  const lastWat = lastWatering(plant)

  // Pre-watering reading establishes a physical lower bound: post-watering
  // moisture cannot drop below it. Any post-watering reading that does is
  // almost certainly a probe-placement artifact (probe landed in a dry pocket
  // of soil) and should be excluded from smoothing — otherwise medianing it
  // in pulls the displayed "current moisture" artificially low.
  const preWaterReading = lastWat
    ? [...allReadings].reverse().find(r => new Date(r.timestamp) < new Date(lastWat.timestamp))
    : null
  const preWaterMoisture = preWaterReading ? Number(preWaterReading.moisture) : null

  let cycleReadings = lastWat
    ? allReadings.filter(r => new Date(r.timestamp) > new Date(lastWat.timestamp))
    : allReadings

  // Filter out impossible-low post-watering readings. Only apply if it leaves
  // at least one reading — if EVERY post-watering reading is below pre-watering
  // (e.g. an entirely bad measurement session), fall back to the raw set so
  // the user still gets some estimate rather than no prediction at all.
  if (preWaterMoisture != null) {
    const filtered = cycleReadings.filter(r => Number(r.moisture) >= preWaterMoisture)
    if (filtered.length > 0) cycleReadings = filtered
  }

  // Use the single most recent reading's timestamp as the anchor.
  const source    = cycleReadings.length ? cycleReadings : allReadings
  const lastTs    = new Date(source[source.length - 1].timestamp).getTime()
  const WINDOW_MS = 24 * 3_600_000   // 24 hours

  // Only include readings within 24 h of the most recent one.
  // This is always at least 1 reading (the anchor itself).
  const nearRecent = source.filter(r => lastTs - new Date(r.timestamp).getTime() <= WINDOW_MS)

  const vals = nearRecent
    .map(r => Number(r.moisture))
    .sort((a, b) => a - b)

  const mid = Math.floor(vals.length / 2)
  return vals.length % 2 === 0
    ? (vals[mid - 1] + vals[mid]) / 2
    : vals[mid]
}

// Convenience: get events relevant to charting (readings + waterings)
export function chartEvents(plant) {
  if (!plant?.events) return { readings: [], waterings: [] }
  return {
    readings:  getEvents(plant, 'reading'),
    waterings: getEvents(plant, 'watering'),
  }
}

// Build the event list that a save action produces, given form input.
// Returns [] if nothing was filled in.
// `form.timestamp` is a local datetime string (YYYY-MM-DDTHH:MM) from the
// <input type="datetime-local"> field. Falls back to "now" if missing.
export function buildEventsFromForm(form, existingBundleId) {
  const timestamp = form.timestamp
    ? new Date(form.timestamp).toISOString()
    : new Date().toISOString()
  const bundleId  = existingBundleId ?? crypto.randomUUID()
  const events = []

  if (form.moisture !== '' && form.moisture != null) {
    events.push({
      id: crypto.randomUUID(),
      type: 'reading',
      timestamp, bundleId,
      moisture: Number(form.moisture),
    })
  }

  if (form.waterAmount && String(form.waterAmount).trim() !== '') {
    events.push({
      id: crypto.randomUUID(),
      type: 'watering',
      timestamp, bundleId,
      amount: String(form.waterAmount).trim(),
      unit: form.waterUnit ?? 'cups',
    })
  }

  if (form.health && form.health !== 'no_change') {
    events.push({
      id: crypto.randomUUID(),
      type: 'health_change',
      timestamp, bundleId,
      health: form.health,
    })
  }

  if (form.notes && form.notes.trim() !== '') {
    events.push({
      id: crypto.randomUUID(),
      type: 'note',
      timestamp, bundleId,
      text: form.notes.trim(),
    })
  }

  return events
}

// Percentage of all readings that fell within the careProfile's healthy moisture range.
// Returns null if no careProfile.moistureRange or no readings.
export function pctTimeInRange(plant, careProfile) {
  const [lo, hi] = careProfile?.moistureRange ?? [null, null]
  if (lo == null || hi == null) return null
  const readings = getEvents(plant, 'reading')
  if (!readings.length) return null
  const inRange = readings.filter(r => {
    const m = Number(r.moisture)
    return m >= lo && m <= hi
  }).length
  return Math.round((inRange / readings.length) * 100)
}

// Average number of days between consecutive watering events.
// Returns null if fewer than 2 waterings.
export function avgWateringInterval(plant) {
  const waterings = getEvents(plant, 'watering')
  if (waterings.length < 2) return null
  let totalDays = 0
  for (let i = 1; i < waterings.length; i++) {
    totalDays += (new Date(waterings[i].timestamp) - new Date(waterings[i - 1].timestamp)) / 86_400_000
  }
  return totalDays / (waterings.length - 1)
}

// How many days the plant can sustain before dropping from the top of its
// healthy range to the floor, given the model's drying rate (beta).
// Returns null if model.beta or careProfile.moistureRange is missing.
export function idealWateringInterval(model, careProfile) {
  const beta = model?.beta
  const range = careProfile?.moistureRange
  if (!beta || !range || range[1] <= range[0]) return null
  return (range[1] - range[0]) / beta
}

// Average watering amount in the most common unit the user uses.
// Returns { amount, unit } or null if no watering amounts on record.
export function avgPourAmount(plant) {
  const waterings = getEvents(plant, 'watering').filter(w => {
    const a = parseFloat(w.amount)
    return !isNaN(a) && a > 0
  })
  if (!waterings.length) return null

  const unitCounts = {}
  for (const w of waterings) {
    const u = w.unit ?? 'cups'
    unitCounts[u] = (unitCounts[u] ?? 0) + 1
  }
  const unit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0][0]

  const vals = waterings
    .filter(w => (w.unit ?? 'cups') === unit)
    .map(w => parseFloat(w.amount))

  if (!vals.length) return null
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return { amount: Math.round(avg * 100) / 100, unit }
}

// Predicted moisture level immediately after a typical watering.
// Uses the median pre-watering moisture (moisture recorded just before each watering)
// as the starting point, adds avgPour × model.alpha, and clamps to the observed
// peak (the highest moisture ever recorded — the pot's real field capacity).
// Returns null if the model lacks alpha or there's no pour history.
export function predictedLandingMoisture(plant, model, careProfile) {
  const alpha = model?.alpha
  if (!alpha) return null
  const pour = avgPourAmount(plant)
  if (!pour) return null

  const waterings = getEvents(plant, 'watering')
  const readings = getEvents(plant, 'reading') // sorted oldest-first

  // Collect the moisture reading recorded most recently before each watering
  const preMoistures = []
  for (const w of waterings) {
    const wTs = new Date(w.timestamp).getTime()
    const before = [...readings].reverse().find(r => new Date(r.timestamp).getTime() < wTs)
    if (before) preMoistures.push(Number(before.moisture))
  }

  let base
  if (preMoistures.length) {
    const sorted = [...preMoistures].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    base = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  } else {
    base = careProfile?.moistureRange?.[0] ?? null
  }

  if (base == null) return null

  const rawLanding = base + pour.amount * alpha

  // Clamp to the observed field capacity of this specific pot
  const observedPeak = readings.length ? Math.max(...readings.map(r => Number(r.moisture))) : Infinity
  const rangeCeiling = careProfile?.moistureRange?.[1] ?? Infinity
  return Math.min(rawLanding, observedPeak, rangeCeiling)
}

// Returns the best per-plant "typical" watering amount, or null when unknown.
// Priority (most-trusted first):
//   1. explicit user override (plant.typicalWater, set in the edit form, #135)
//   2. the user's own history — median of significant past waterings in the
//      dominant unit, once there are ≥3 to median over (#64)
//   3. the species default (careProfile.minWaterAmount)
//
// Returns { amount, unit, confidence, source }:
//   confidence: 'set' | 'learned' | 'default'   source: 'override' | 'history' | 'species'
//
// This is the SEED layer for the adaptive-amount work: Phase B's outcome loop
// (learnedWaterAmount) will supersede the history-median with something that
// can correct a bad habit, not just echo it.
export function typicalWaterAmount(plant, careProfile) {
  // 1. Explicit override
  const ov = plant?.typicalWater
  const ovAmount = ov ? parseFloat(ov.amount) : NaN
  if (!isNaN(ovAmount) && ovAmount > 0) {
    return { amount: ovAmount, unit: ov.unit ?? 'cups', confidence: 'set', source: 'override' }
  }

  // 2. Learned from the user's own waterings (median is robust to one deep soak)
  const waterings = getEvents(plant, 'watering').filter(w => {
    const a = parseFloat(w.amount)
    return !isNaN(a) && a > 0 && isSignificantWatering(w, careProfile)
  })
  if (waterings.length >= 3) {
    const unitCounts = {}
    for (const w of waterings) {
      const u = w.unit ?? 'cups'
      unitCounts[u] = (unitCounts[u] ?? 0) + 1
    }
    const unit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0][0]
    const vals = waterings
      .filter(w => (w.unit ?? 'cups') === unit)
      .map(w => parseFloat(w.amount))
      .sort((a, b) => a - b)
    if (vals.length >= 3) {
      const mid = Math.floor(vals.length / 2)
      const median = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid]
      return { amount: Math.round(median * 100) / 100, unit, confidence: 'learned', source: 'history' }
    }
  }

  // 3. Species default
  const min = careProfile?.minWaterAmount
  if (min && min.cups != null) {
    return { amount: min.cups, unit: 'cups', confidence: 'default', source: 'species' }
  }

  return null
}
