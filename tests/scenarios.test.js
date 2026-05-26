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
