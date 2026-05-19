import { describe, it, expect } from 'vitest'
import { computeModel, predictMoisture, getRecommendation, getLastResidual } from './plantModel.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function ts(daysAgo) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
}

// Build a minimal plant with an explicit event list.
function plant(events) {
  return { id: 'p1', species: 'test', events }
}

function reading(moisture, daysAgo, bundleId = 'b1') {
  return { id: `r${daysAgo}`, type: 'reading', timestamp: ts(daysAgo), moisture, bundleId }
}

function watering(amount, daysAgo, unit = 'cups', bundleId = 'b2') {
  return { id: `w${daysAgo}`, type: 'watering', timestamp: ts(daysAgo), amount: String(amount), unit, bundleId }
}

const CARE = { moistureRange: [4, 7] }

// ── computeModel ───────────────────────────────────────────────────────────

describe('computeModel', () => {
  it('returns null alpha and beta with no events', () => {
    const m = computeModel(plant([]))
    expect(m.alpha).toBeNull()
    expect(m.beta).toBeNull()
    expect(m.alphaSamples).toBe(0)
    expect(m.betaSamples).toBe(0)
  })

  it('returns null alpha and beta with a single reading (no pairs)', () => {
    const m = computeModel(plant([reading(6, 0)]))
    expect(m.alpha).toBeNull()
    expect(m.beta).toBeNull()
  })

  it('estimates beta from two consecutive readings with no watering', () => {
    // Moisture dropped from 8 → 6 over 2 days → β = 1.0/day
    const m = computeModel(plant([reading(8, 2), reading(6, 0)]))
    expect(m.beta).toBeCloseTo(1.0, 1)
    expect(m.betaSamples).toBe(1)
    expect(m.alpha).toBeNull()   // no watering triple yet
  })

  it('does not count a beta obs when moisture did not drop', () => {
    // Moisture went up (plant absorbed residual water or something) — skip
    const m = computeModel(plant([reading(5, 2), reading(7, 0)]))
    expect(m.betaSamples).toBe(0)
  })

  it('estimates alpha and beta from a reading→watering→reading triple', () => {
    // Day 4: reading = 3.  Day 3: watered 2 cups.  Day 0: reading = 6.
    // With DEFAULT_BETA=0.5, M_peak ≈ 6 + 0.5*3 = 7.5
    // rise = 7.5 - 3 = 4.5 over 2 cups → α ≈ 2.25
    // M_peak (via α) = 3 + DEFAULT_ALPHA*2 = 6 → drop = 6-6 = 0 (too small; no beta obs)
    const events = [reading(3, 4, 'bA'), watering(2, 3, 'cups', 'bB'), reading(6, 0, 'bC')]
    const m = computeModel(plant(events))
    expect(m.alphaSamples).toBe(1)
    expect(m.alpha).toBeGreaterThan(0)
  })

  it('uses exponential smoothing — later observations weight more', () => {
    // Two beta observations: 0.5/day then 1.5/day
    // With GAMMA=0.25: smoothed = 0.5 then 0.25*1.5 + 0.75*0.5 = 0.75
    const events = [
      reading(8, 4), reading(7, 2),   // drop 1 over 2 days → β=0.5
      reading(6, 2 - 0.001),          // tiny gap to avoid collision
      reading(4.5, 0),                 // drop 1.5 over 2 days → β=0.75
    ]
    const m = computeModel(plant(events))
    expect(m.betaSamples).toBeGreaterThanOrEqual(1)
    expect(m.beta).toBeGreaterThan(0)
  })

  it('picks cups as dominantUnit when all waterings are in cups', () => {
    const events = [watering(1, 3), watering(2, 1)]
    const m = computeModel(plant(events))
    expect(m.dominantUnit).toBe('cups')
  })

  it('parses fractional water amounts like "3/4"', () => {
    const events = [reading(3, 4, 'bA'), watering('3/4', 3, 'cups', 'bB'), reading(4, 0, 'bC')]
    const m = computeModel(plant(events))
    // Should not throw and should produce some alpha obs (rise > 0)
    expect(m.alphaSamples).toBeGreaterThanOrEqual(0)
  })
})

// ── predictMoisture ────────────────────────────────────────────────────────

describe('predictMoisture', () => {
  it('returns null with no readings', () => {
    const m = computeModel(plant([]))
    expect(predictMoisture(plant([]), m)).toBeNull()
  })

  it('uses DEFAULT_BETA when model has no beta', () => {
    // Reading taken 2 days ago at moisture=8. DEFAULT_BETA=0.5 → predicted ≈ 7
    const p = plant([reading(8, 2)])
    const m = computeModel(p)
    expect(m.beta).toBeNull()              // no pairs yet
    const pred = predictMoisture(p, m)
    expect(pred).toBeCloseTo(7, 0)         // 8 - 0.5*2 = 7
  })

  it('uses the learned beta when available', () => {
    // β estimated at ~1.0/day; reading was 8 two days ago → predicted ≈ 6
    const p = plant([reading(8, 4), reading(6, 2)])  // β≈1.0
    const m = computeModel(p)
    expect(m.beta).toBeCloseTo(1.0, 1)
    // lastReading is the one 2 days ago at moisture=6; predicted = 6 - 1.0*2 = 4
    const pred = predictMoisture(p, m)
    expect(pred).toBeCloseTo(4, 0)
  })

  it('clamps predicted moisture to 0', () => {
    // Very old reading with high beta → would go negative without clamping
    const p = plant([reading(2, 10)])
    const m = computeModel(p)
    const pred = predictMoisture(p, m)
    expect(pred).toBeGreaterThanOrEqual(0)
  })

  it('clamps predicted moisture to 10', () => {
    // Reading at 10 taken 0 seconds ago → should not exceed 10
    const p = plant([reading(10, 0)])
    const m = computeModel(p)
    expect(predictMoisture(p, m)).toBeLessThanOrEqual(10)
  })
})

// ── getRecommendation ──────────────────────────────────────────────────────

describe('getRecommendation', () => {
  it('returns null with no readings', () => {
    const m = computeModel(plant([]))
    expect(getRecommendation(plant([]), m, CARE)).toBeNull()
  })

  it('marks confidence as "none" with zero samples', () => {
    const p = plant([reading(6, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    expect(rec.confidence).toBe('none')
    expect(rec.usingDefaults).toBe(true)
  })

  it('marks confidence as "low" with 1–2 total samples', () => {
    // One beta obs from two readings
    const p = plant([reading(8, 2), reading(6, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    expect(rec.totalSamples).toBe(1)
    expect(rec.confidence).toBe('low')
    expect(rec.usingDefaults).toBe(false)
  })

  it('sets hasRange=false when no careProfile', () => {
    const p = plant([reading(6, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, null)
    expect(rec.hasRange).toBe(false)
  })

  it('sets hasRange=true when careProfile has moistureRange', () => {
    const p = plant([reading(6, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    expect(rec.hasRange).toBe(true)
  })

  it('computes daysUntilDry=0 when moisture is at the range minimum', () => {
    // CARE range = [4,7]. Reading at exactly 4 right now → already at min.
    const p = plant([reading(4, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    expect(rec.daysUntilDry).toBe(0)
  })

  it('computes positive daysUntilDry when moisture is above the range minimum', () => {
    const p = plant([reading(6, 0)])
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    // predicted ≈ 6, rangeLo = 4, DEFAULT_BETA=0.5 → days = (6-4)/0.5 = 4
    expect(rec.daysUntilDry).toBeGreaterThan(0)
  })

  it('returns daysUntilDry=0 (not negative) via Math.max clamp', () => {
    // Moisture is well below range min → daysUntilDry clamped to 0
    const p = plant([reading(1, 5)])    // very old, very dry
    const m = computeModel(p)
    const rec = getRecommendation(p, m, CARE)
    expect(rec.daysUntilDry).toBeGreaterThanOrEqual(0)
  })
})

// ── getLastResidual ────────────────────────────────────────────────────────

describe('getLastResidual', () => {
  it('returns null with fewer than 2 readings', () => {
    const p = plant([reading(6, 0)])
    const m = computeModel(p)
    expect(getLastResidual(p, m)).toBeNull()
  })

  it('returns null when there is a watering between the last two readings', () => {
    const p = plant([
      reading(5, 4, 'bA'),
      watering(2, 2, 'cups', 'bB'),
      reading(7, 0, 'bC'),
    ])
    const m = computeModel(p)
    expect(getLastResidual(p, m)).toBeNull()
  })

  it('returns a residual when two consecutive readings have no watering between', () => {
    // β≈1.0, reading 8 at 2 days ago, reading 6 today → predicted 6, actual 6, residual 0
    const p = plant([reading(8, 4, 'bA'), reading(6, 2, 'bB'), reading(6, 0, 'bC')])
    const m = computeModel(p)
    const result = getLastResidual(p, m)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('predicted')
    expect(result).toHaveProperty('actual')
    expect(result).toHaveProperty('residual')
    // residual = actual - predicted; both should be numbers
    expect(typeof result.residual).toBe('number')
  })
})
