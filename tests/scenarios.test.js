// Scenario tests — load real-data fixtures and assert the user-observable
// outcome. Each `describe` block corresponds to one fixture and one or more
// historical bugs. See tests/fixtures/README.md for the convention.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { smoothedCurrentMoisture } from '../src/utils/plantSelectors.js'
import { computeModel, getRecommendation } from '../src/utils/plantModel.js'
import { lookupPlant } from '../src/utils/plantLookup.js'

const here = dirname(fileURLToPath(import.meta.url))

function loadFixture(name) {
  const path = join(here, 'fixtures', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ────────────────────────────────────────────────────────────────────────
// alocasia-2026-05-20-probe-variance — issue #101
// Pre 3 → water 2c → reading 2 (dry-pocket probe) → reading 6 (good probe).
// The 2 is physically impossible (water can't make soil drier) and was
// pulling the smoothed median down to 4, which then drove a spurious
// "Water · ~3 cups" recommendation right after watering.
// ────────────────────────────────────────────────────────────────────────
describe('Alocasia — probe variance immediately after watering (#101)', () => {
  const plant = loadFixture('alocasia-2026-05-20-probe-variance.json')
  const careProfile = lookupPlant(plant.species)

  // The fixture's last event is at 2026-05-20T18:33Z. The scenario is
  // "user just took two post-watering readings" — so the model should
  // see "no time has passed" since the latest reading. Without faking
  // Date.now() the test would drift further into the future every day,
  // because predictMoisture() multiplies beta by (Date.now() − reading
  // timestamp) and would then claim the plant has dried out by ~beta·days
  // per real-world day since the fixture was written.
  const FIXTURE_NOW = new Date('2026-05-20T18:34:00.000Z')
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXTURE_NOW)
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('takes the higher post-watering reading, not the median with the dry-pocket one', () => {
    expect(smoothedCurrentMoisture(plant)).toBe(6)
  })

  it('does not recommend a full re-watering right after watering', () => {
    const model = computeModel(plant, careProfile)
    const rec   = getRecommendation(plant, model, careProfile)
    // Plant is inside its ideal range (smoothed = 6, ideal 4-7). The
    // pre-fix bug produced waterNeeded ≈ 2.8 cups — essentially recommending
    // another full watering the same day. The fix should bring this well
    // below the actual watering amount (2 cups) and ideally below ~1.5.
    expect(rec).not.toBeNull()
    expect(rec.waterNeeded).toBeLessThan(1.5)
  })
})

// ────────────────────────────────────────────────────────────────────────
// big-monstera-2026-05-22-beta-feedback-loop — issue #109
// The first triple (May 14 watering → first post-water reading 3 days later)
// has no reading within 24h of the watering, so β is seeded from a pure guess
// (~1.17/day). That inflated β then biases the max-peak selection in later
// triples toward later/lower readings, which confirm the high β. β snowballs
// to ~0.86/day and the model predicts the plant much drier than it really is.
//
// Symptom in the wild: the plant sat at 6, but the model decayed it to ~4 over
// a couple of days — the chronic "thinks it dries too fast" under-prediction.
// ────────────────────────────────────────────────────────────────────────
describe('Big Monstera — β feedback loop biases predictions low (#109)', () => {
  const plant = loadFixture('big-monstera-2026-05-22-beta-feedback-loop.json')
  const careProfile = lookupPlant(plant.species)

  // Two days after the last reading (6 on May 22 02:28Z). A Monstera that was
  // at 6 should not be modeled as having dried more than ~1 point in 2 days.
  const FIXTURE_NOW = new Date('2026-05-24T02:28:00.000Z')
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXTURE_NOW)
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('does not learn a runaway drying rate', () => {
    const model = computeModel(plant, careProfile)
    // Pre-fix β ≈ 0.86/day — far above any real indoor-plant drying rate.
    // Most houseplants dry at 0.1–0.4/day; the cap is 0.7.
    expect(model.beta).toBeLessThanOrEqual(0.7)
  })

  it('predicts in line with the plant’s real drying, not the runaway rate', () => {
    const model = computeModel(plant, careProfile)
    const rec   = getRecommendation(plant, model, careProfile)
    expect(rec).not.toBeNull()
    // Started at 6. The fixture's own consecutive readings show genuine drying
    // of ~0.6/day, so ~4.7 at two days is correct — we are NOT asserting the
    // plant stays pinned at 6. We ARE asserting the runaway β (which dragged
    // the 2-day prediction down to 4.3) is gone: predicted should clear 4.5.
    expect(rec.predicted).toBeGreaterThanOrEqual(4.5)
  })

  it('predicts the most recent reading accurately when replayed', () => {
    // Build the model from everything BEFORE the last reading, then predict at
    // that reading's timestamp — "would the model have called this reading?"
    const lastTs = '2026-05-22T02:28:00.000Z'
    const before = { ...plant, events: plant.events.filter(e => new Date(e.timestamp) < new Date(lastTs)) }
    vi.setSystemTime(new Date(lastTs))
    const model = computeModel(before, careProfile)
    const rec   = getRecommendation(before, model, careProfile)
    vi.setSystemTime(FIXTURE_NOW)
    expect(rec).not.toBeNull()
    expect(Math.abs(rec.predicted - 6)).toBeLessThanOrEqual(1)  // actual was 6
  })
})
