import { describe, it, expect } from 'vitest'
import { computeModel, predictMoisture, getRecommendation, getLastResidual, getResidualHistory, getPredictionReliability } from './plantModel.js'

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
    // Moisture dropped from 8 → 6.8 over 2 days → β = 0.6/day (under the cap)
    const m = computeModel(plant([reading(8, 2), reading(6.8, 0)]))
    expect(m.beta).toBeCloseTo(0.6, 1)
    expect(m.betaSamples).toBe(1)
    expect(m.alpha).toBeNull()   // no watering triple yet
  })

  it('caps the learned beta at the realistic ceiling (#109)', () => {
    // 8 → 5 over 2 days = 1.5/day — physically implausible for an indoor
    // plant. The cap (0.7) prevents a runaway observation from poisoning every
    // future prediction.
    const m = computeModel(plant([reading(8, 2), reading(5, 0)]))
    expect(m.beta).toBe(0.7)
  })

  it('skips beta from a triple with no reading within 24h of watering (#109)', () => {
    // read 2 → water 3c → (4 days later) read 6. The drying curve is never
    // observed, so β must NOT be learned from this triple — but α still can be.
    const m = computeModel(plant([reading(2, 5), watering(3, 4), reading(6, 0)]), CARE)
    expect(m.beta).toBeNull()
    expect(m.betaSamples).toBe(0)
    expect(m.alphaSamples).toBe(1)
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

  // ── Max-peak α estimation (#98) ─────────────────────────────────────────
  // When probe placement makes the first post-watering reading low but a
  // later in-cycle reading is higher (after accounting for drying), the
  // model should use the reading that back-calculates to the highest peak.

  it('uses a later higher reading when the first post-watering reading lands in a dry spot', () => {
    // Day 5: reading 3, Day 4: water 2 cups,
    // Day 4 (same day, dry spot): reading 4    → back-calc peak = 4 + 0.5*0 = 4
    // Day 2 (wetter spot, 2d later): reading 6 → back-calc peak = 6 + 0.5*2 = 7  ← picked
    // rise = 7 - 3 = 4 → α = 2.0
    const events = [
      reading(3, 5, 'bA'),
      watering(2, 4, 'cups', 'bB'),
      reading(4, 4 - 0.01, 'bC'),  // slightly after watering, same day
      reading(6, 2, 'bD'),
    ]
    const m = computeModel(plant(events))
    expect(m.alphaSamples).toBe(1)
    // α should be ≈ 2.0 (using day-2 reading), NOT ≈ 0.5 (using day-4 reading)
    expect(m.alpha).toBeGreaterThan(1.5)
  })

  it('still picks the first reading when readings are decreasing normally', () => {
    // Day 5: reading 3, Day 4: water 2 cups,
    // Day 4: reading 7    → back-calc peak = 7 + 0.5*0 = 7  ← picked
    // Day 2: reading 5    → back-calc peak = 5 + 0.5*2 = 6
    // rise = 7 - 3 = 4 → α = 2.0 (same as if we'd only had the first reading)
    const events = [
      reading(3, 5, 'bA'),
      watering(2, 4, 'cups', 'bB'),
      reading(7, 4 - 0.01, 'bC'),
      reading(5, 2, 'bD'),
    ]
    const m = computeModel(plant(events))
    expect(m.alphaSamples).toBe(1)
    expect(m.alpha).toBeCloseTo(2.0, 1)
  })

  it('rejects the cycle when even the best back-calc peak does not exceed the pre-watering reading', () => {
    // Pre = 5. Both post-watering readings back-calc below 5 even with drying credit.
    // Day 5: reading 5, Day 4: water 2 cups, Day 4: 4, Day 3: 3 → peaks 4 and 3.5
    // Both ≤ pre-reading (5) → skip the triple, no α observation
    const events = [
      reading(5, 5, 'bA'),
      watering(2, 4, 'cups', 'bB'),
      reading(4, 4 - 0.01, 'bC'),
      reading(3, 3, 'bD'),
    ]
    const m = computeModel(plant(events))
    expect(m.alphaSamples).toBe(0)
  })

  // ── Per-cycle regression slope (#131) ───────────────────────────────────
  // β is now the slope of a least-squares line fit through the cycle's
  // readings, not a two-points-at-a-time difference. This de-noises the probe.

  it('recovers the true drying slope from a clean linear cycle', () => {
    // Perfect line 8→7→6→5 over 6 days = 0.5/day. One drying cycle (no
    // watering), so betaSamples = 1 and the fit is exact (R² = 1).
    const m = computeModel(plant([reading(8, 6), reading(7, 4), reading(6, 2), reading(5, 0)]))
    expect(m.betaSamples).toBe(1)
    expect(m.beta).toBeCloseTo(0.5, 1)
    expect(m.betaR2).toBeCloseTo(1, 1)
  })

  it('absorbs a single outlier reading without shifting the slope (de-noising)', () => {
    // Underlying trend ≈ 0.5/day (8, 7.5, _, 6.5, 6 at days 0–4) with one
    // probe outlier (9) at the centre of the window. Least squares leaves the
    // slope at 0.5 — the old adjacent-pairwise method would have swung wildly
    // around the outlier (7.5→9 then 9→6.5). The noise shows up as a lower R².
    const m = computeModel(plant([
      reading(8, 4), reading(7.5, 3), reading(9, 2), reading(6.5, 1), reading(6, 0),
    ]))
    expect(m.betaSamples).toBe(1)
    expect(m.beta).toBeCloseTo(0.5, 1)
    expect(m.betaR2).toBeLessThan(0.7)   // the outlier is detected as scatter
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
    // β estimated at ~0.6/day (distinct from DEFAULT_BETA 0.5, under the cap);
    // readings are 4 days ago (8) and 2 days ago (6.8)
    const p = plant([reading(8, 4), reading(6.8, 2)])  // β≈0.6
    const m = computeModel(p)
    expect(m.beta).toBeCloseTo(0.6, 1)
    // Layer 2: readings are 48 h apart — outside the 24-h smoothing window.
    // Only the most recent reading (6.8, 2 days ago) is used as start.
    // predicted = 6.8 - 0.6*2 = 5.6
    const pred = predictMoisture(p, m)
    expect(pred).toBeCloseTo(5.6, 1)
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

// ── getResidualHistory ───────────────────────────────────────────────────────

describe('getResidualHistory', () => {
  it('returns [] with fewer than 2 readings', () => {
    expect(getResidualHistory(plant([]), CARE)).toEqual([])
    expect(getResidualHistory(plant([reading(6, 0)]), CARE)).toEqual([])
  })

  it('records a predicted/actual/residual for a clean decay pair', () => {
    // reading 8 (4d ago) → reading 6 (now), no watering between.
    // History before the last reading has one reading (8) → DEFAULT_BETA 0.5,
    // predicted = 8 − 0.5·4 = 6, actual 6 → residual 0.
    const hist = getResidualHistory(plant([reading(8, 4, 'bA'), reading(6, 0, 'bB')]), CARE)
    expect(hist).toHaveLength(1)
    expect(hist[0].kind).toBe('decay')
    expect(hist[0].actual).toBe(6)
    expect(hist[0].predicted).toBeCloseTo(6, 1)
    expect(hist[0].residual).toBeCloseTo(0, 1)
    expect(hist[0].recommendedWater).toBeNull()
  })

  it('records recommended-vs-given water for a post-watering reading', () => {
    // reading 5 → water 2c → reading 7. The middle watering makes this a
    // post-water point: no moisture residual, but a watering comparison.
    const hist = getResidualHistory(plant([
      reading(5, 4, 'bA'), watering(2, 2, 'cups', 'bB'), reading(7, 0, 'bC'),
    ]), CARE)
    expect(hist).toHaveLength(1)
    expect(hist[0].kind).toBe('post-water')
    expect(hist[0].predicted).toBeNull()
    expect(hist[0].residual).toBeNull()
    expect(hist[0].givenWater).toBe(2)
    expect(typeof hist[0].recommendedWater).toBe('number')  // enables over/under flag
  })

  it('returns entries oldest → newest with mixed kinds', () => {
    const hist = getResidualHistory(plant([
      reading(8, 6, 'b1'),                       // first reading (no entry)
      reading(6, 4, 'b2'),                       // decay
      watering(2, 3, 'cups', 'b3'),
      reading(7, 2, 'b4'),                       // post-water
      reading(6, 0, 'b5'),                       // decay
    ]), CARE)
    expect(hist.map(e => e.kind)).toEqual(['decay', 'post-water', 'decay'])
    expect(hist[0].timestamp).not.toBe(hist[2].timestamp)
  })
})

// ── getPredictionReliability ─────────────────────────────────────────────────

describe('getPredictionReliability', () => {
  it("is 'learning' with no/too-little data", () => {
    expect(getPredictionReliability(plant([reading(6, 0)]), CARE)).toBe('learning')
    // One drying cycle = a single sample — below the 3-sample floor.
    expect(getPredictionReliability(plant([reading(8, 4), reading(6, 0)]), CARE)).toBe('learning')
  })

  it("is 'reliable' when predictions have tracked reality across several cycles", () => {
    // Steady ~0.5/day drying across three cycles → β learned cleanly, and the
    // replayed predictions land on the actual readings (residuals ≈ 0).
    const p = plant([
      reading(8, 20, 'a1'), reading(7, 18, 'a2'),
      watering(3, 17, 'cups', 'a3'),
      reading(8, 16, 'a4'), reading(7, 14, 'a5'),
      watering(3, 13, 'cups', 'a6'),
      reading(8, 12, 'a7'), reading(7, 10, 'a8'),
    ])
    const m = computeModel(p, CARE)
    expect(m.betaSamples + m.alphaSamples).toBeGreaterThanOrEqual(3)  // past the floor
    expect(getPredictionReliability(p, CARE)).toBe('reliable')
  })

  it("is 'shaky' when there's plenty of data but predictions keep missing badly", () => {
    // The plant crashes 8 → 1 every cycle (far faster than the β cap can track),
    // so the replayed predictions are off by ~5–6 every time despite ample data.
    const p = plant([
      reading(8, 20, 'b1'), reading(1, 18, 'b2'),
      watering(3, 17, 'cups', 'b3'),
      reading(8, 16, 'b4'), reading(1, 14, 'b5'),
      watering(3, 13, 'cups', 'b6'),
      reading(8, 12, 'b7'), reading(1, 10, 'b8'),
    ])
    const m = computeModel(p, CARE)
    expect(m.betaSamples + m.alphaSamples).toBeGreaterThanOrEqual(3)
    expect(getPredictionReliability(p, CARE)).toBe('shaky')
  })
})
