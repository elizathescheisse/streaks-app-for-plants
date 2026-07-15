import { describe, it, expect } from 'vitest'
import {
  getEvents,
  lastReading,
  lastWatering,
  currentHealth,
  logBundles,
  chartEvents,
  buildEventsFromForm,
  isSuspiciousReading,
  smoothedCurrentMoisture,
  typicalWaterAmount,
  pctTimeInRange,
  avgWateringInterval,
  idealWateringInterval,
  avgPourAmount,
  predictedLandingMoisture,
} from './plantSelectors.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function ts(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
}

function tsHours(hoursAgo = 0) {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
}

function makeReading(moisture, daysAgo = 0, bundleId = 'b1') {
  return { id: `r-${daysAgo}`, type: 'reading', timestamp: ts(daysAgo), moisture, bundleId }
}

function makeWatering(amount, daysAgo = 0, unit = 'cups', bundleId = 'b1') {
  return { id: `w-${daysAgo}`, type: 'watering', timestamp: ts(daysAgo), amount, unit, bundleId }
}

function makeHealth(health, daysAgo = 0, bundleId = 'b1') {
  return { id: `h-${daysAgo}`, type: 'health_change', timestamp: ts(daysAgo), health, bundleId }
}

const emptyPlant = { id: 'p1', events: [] }

// ── getEvents ──────────────────────────────────────────────────────────────

describe('getEvents', () => {
  it('returns [] for a plant with no events', () => {
    expect(getEvents(emptyPlant, 'reading')).toEqual([])
  })

  it('returns [] for a null plant', () => {
    expect(getEvents(null, 'reading')).toEqual([])
  })

  it('filters to only the requested type', () => {
    const plant = { events: [makeReading(5, 2), makeWatering(1, 1)] }
    const readings = getEvents(plant, 'reading')
    expect(readings).toHaveLength(1)
    expect(readings[0].type).toBe('reading')
  })

  it('returns events sorted oldest first', () => {
    const plant = { events: [makeReading(7, 0), makeReading(5, 3), makeReading(6, 1)] }
    const readings = getEvents(plant, 'reading')
    expect(readings[0].moisture).toBe(5)   // 3 days ago — oldest
    expect(readings[2].moisture).toBe(7)   // today — newest
  })
})

// ── lastReading ────────────────────────────────────────────────────────────

describe('lastReading', () => {
  it('returns null for no events', () => {
    expect(lastReading(emptyPlant)).toBeNull()
  })

  it('returns the most recent reading', () => {
    const plant = { events: [makeReading(5, 3), makeReading(7, 0), makeReading(6, 1)] }
    expect(lastReading(plant).moisture).toBe(7)
  })

  it('ignores waterings', () => {
    const plant = { events: [makeWatering(2, 0), makeReading(4, 1)] }
    expect(lastReading(plant).moisture).toBe(4)
  })
})

// ── lastWatering ───────────────────────────────────────────────────────────

describe('lastWatering', () => {
  it('returns null when no waterings exist', () => {
    const plant = { events: [makeReading(5, 1)] }
    expect(lastWatering(plant)).toBeNull()
  })

  it('returns the most recent watering', () => {
    const plant = { events: [makeWatering(1, 3), makeWatering(2, 0), makeWatering(1.5, 1)] }
    expect(lastWatering(plant).amount).toBe(2)
  })
})

// ── currentHealth ──────────────────────────────────────────────────────────

describe('currentHealth', () => {
  it('defaults to "good" when no health events exist', () => {
    expect(currentHealth(emptyPlant)).toBe('good')
  })

  it('returns the most recent health value', () => {
    const plant = {
      events: [
        makeHealth('thriving', 5),
        makeHealth('struggling', 1),
        makeHealth('okay', 3),
      ]
    }
    expect(currentHealth(plant)).toBe('struggling')
  })
})

// ── logBundles ─────────────────────────────────────────────────────────────

describe('logBundles', () => {
  it('returns [] for no events', () => {
    expect(logBundles(emptyPlant)).toEqual([])
  })

  it('groups events by bundleId', () => {
    const plant = {
      events: [
        makeReading(5, 2, 'bundle-a'),
        makeWatering(1, 2, 'cups', 'bundle-a'),
        makeReading(7, 0, 'bundle-b'),
      ]
    }
    const bundles = logBundles(plant)
    expect(bundles).toHaveLength(2)
    const bundleA = bundles.find(b => b[0].bundleId === 'bundle-a')
    expect(bundleA).toHaveLength(2)
  })

  it('sorts bundles newest first', () => {
    const plant = {
      events: [
        makeReading(5, 5, 'old'),
        makeReading(7, 0, 'new'),
      ]
    }
    const bundles = logBundles(plant)
    expect(bundles[0][0].bundleId).toBe('new')
    expect(bundles[1][0].bundleId).toBe('old')
  })
})

// ── chartEvents ────────────────────────────────────────────────────────────

describe('chartEvents', () => {
  it('returns empty arrays for no events', () => {
    expect(chartEvents(emptyPlant)).toEqual({ readings: [], waterings: [] })
  })

  it('splits readings and waterings correctly', () => {
    const plant = {
      events: [
        makeReading(5, 2), makeReading(7, 0),
        makeWatering(1, 1),
        makeHealth('good', 1),   // should not appear in either list
      ]
    }
    const { readings, waterings } = chartEvents(plant)
    expect(readings).toHaveLength(2)
    expect(waterings).toHaveLength(1)
  })
})

// ── isSuspiciousReading ────────────────────────────────────────────────────

describe('isSuspiciousReading', () => {
  it('returns false for a plant with no watering history', () => {
    const plant = { events: [makeReading(3, 0)] }
    expect(isSuspiciousReading(plant, 3, null)).toBe(false)
  })

  it('returns false when moisture is empty or null', () => {
    const plant = { events: [makeReading(6, 1), makeWatering(2, 0)] }
    expect(isSuspiciousReading(plant, '',   null)).toBe(false)
    expect(isSuspiciousReading(plant, null, null)).toBe(false)
  })

  it('flags a reading lower than the pre-watering level taken within 6 hours', () => {
    // Pre-watering reading: 6.  Watered 2 hours ago.  New reading: 4 (suspicious).
    const plant = {
      events: [
        { id: 'r1', type: 'reading',  timestamp: tsHours(3), moisture: 6, bundleId: 'b1' },
        { id: 'w1', type: 'watering', timestamp: tsHours(2), amount: '2', unit: 'cups', bundleId: 'b2' },
      ]
    }
    expect(isSuspiciousReading(plant, 4, null)).toBe(true)
  })

  it('does NOT flag a reading equal to the pre-watering level', () => {
    // Equal could mean "didn't water enough to move the needle" — more plausible
    // than bad probe placement, so don't show the warning.
    const plant = {
      events: [
        { id: 'r1', type: 'reading',  timestamp: tsHours(3), moisture: 5, bundleId: 'b1' },
        { id: 'w1', type: 'watering', timestamp: tsHours(2), amount: '2', unit: 'cups', bundleId: 'b2' },
      ]
    }
    expect(isSuspiciousReading(plant, 5, null)).toBe(false)
  })

  it('does NOT flag a reading higher than the pre-watering level', () => {
    // Plant went from 4 → watered → reading is now 7. Normal.
    const plant = {
      events: [
        { id: 'r1', type: 'reading',  timestamp: tsHours(3), moisture: 4, bundleId: 'b1' },
        { id: 'w1', type: 'watering', timestamp: tsHours(2), amount: '2', unit: 'cups', bundleId: 'b2' },
      ]
    }
    expect(isSuspiciousReading(plant, 7, null)).toBe(false)
  })

  it('does NOT flag when the watering was more than 6 hours ago', () => {
    // Watered yesterday — any reading today is a genuine dry-out measurement.
    const plant = {
      events: [
        makeReading(6, 2),
        makeWatering(2, 1),   // 1 day ago = 24 h, well outside the 6-hour window
      ]
    }
    expect(isSuspiciousReading(plant, 3, null)).toBe(false)
  })

  it('does NOT flag when there is no pre-watering reading to compare against', () => {
    // Watering exists but no reading before it — nothing to compare to.
    const plant = {
      events: [
        { id: 'w1', type: 'watering', timestamp: tsHours(1), amount: '2', unit: 'cups', bundleId: 'b1' },
      ]
    }
    expect(isSuspiciousReading(plant, 3, null)).toBe(false)
  })

  it('uses the provided timestamp to evaluate the 6-hour window', () => {
    // Back-filling a log entry: "I watered 5 hours ago and checked right after."
    // The explicit timestamp for the reading is 4.5 h after the watering.
    const wateringTs = new Date(Date.now() - 5 * 3_600_000).toISOString()
    const readingTs  = new Date(Date.now() - 0.5 * 3_600_000).toISOString() // 4.5 h later
    const plant = {
      events: [
        { id: 'r1', type: 'reading',  timestamp: new Date(Date.now() - 6 * 3_600_000).toISOString(), moisture: 6, bundleId: 'b1' },
        { id: 'w1', type: 'watering', timestamp: wateringTs, amount: '2', unit: 'cups', bundleId: 'b2' },
      ]
    }
    // New reading is 3, which is < 6 (pre-watering) and within the 6-h window
    expect(isSuspiciousReading(plant, 3, readingTs)).toBe(true)
  })
})

// ── smoothedCurrentMoisture ────────────────────────────────────────────────

describe('smoothedCurrentMoisture', () => {
  it('returns null for a plant with no readings', () => {
    expect(smoothedCurrentMoisture(emptyPlant)).toBeNull()
  })

  it('returns the single reading when only one exists', () => {
    const plant = { events: [makeReading(6, 0)] }
    expect(smoothedCurrentMoisture(plant)).toBe(6)
  })

  it('returns median of same-day readings (probe placement noise)', () => {
    // Two readings taken 2 hours apart — within the 24-hour smoothing window
    const plant = {
      events: [
        { id: 'r1', type: 'reading', timestamp: tsHours(2), moisture: 2, bundleId: 'b1' },
        { id: 'r2', type: 'reading', timestamp: tsHours(0), moisture: 6, bundleId: 'b2' },
      ]
    }
    // median of [2, 6] = 4
    expect(smoothedCurrentMoisture(plant)).toBe(4)
  })

  it('returns median of three same-day readings', () => {
    const plant = {
      events: [
        { id: 'r1', type: 'reading', timestamp: tsHours(5), moisture: 3, bundleId: 'b1' },
        { id: 'r2', type: 'reading', timestamp: tsHours(3), moisture: 7, bundleId: 'b2' },
        { id: 'r3', type: 'reading', timestamp: tsHours(1), moisture: 5, bundleId: 'b3' },
      ]
    }
    // sorted [3, 5, 7], median = 5
    expect(smoothedCurrentMoisture(plant)).toBe(5)
  })

  it('ignores readings older than 24 hours — they are real dry-out measurements', () => {
    // Reading 3 days ago at 8, reading today at 3 — genuine drying, not noise
    const plant = {
      events: [
        makeReading(8, 3),
        makeReading(3, 0),
      ]
    }
    // 3 days apart → outside window; only today's reading is used
    expect(smoothedCurrentMoisture(plant)).toBe(3)
  })

  it('only uses readings since the last watering', () => {
    // Pre-watering reading at 2 (stale); watered yesterday; reading today at 7
    const plant = {
      events: [
        makeReading(2, 5),
        makeWatering(2, 1),
        makeReading(7, 0),
      ]
    }
    // Only the post-watering reading (7) is in the current cycle
    expect(smoothedCurrentMoisture(plant)).toBe(7)
  })

  it('smooths same-day readings within the current cycle, ignoring pre-watering ones', () => {
    // Watered 1 day ago; two readings today in different spots (probe variance)
    const plant = {
      events: [
        makeReading(2, 5),               // pre-watering (old cycle)
        makeWatering(2, 1),              // watered yesterday
        { id: 'r2', type: 'reading', timestamp: tsHours(3), moisture: 5, bundleId: 'b2' },
        { id: 'r3', type: 'reading', timestamp: tsHours(1), moisture: 8, bundleId: 'b3' },
      ]
    }
    // Current cycle: [5, 8]; both within 24h of most recent → median = 6.5
    expect(smoothedCurrentMoisture(plant)).toBe(6.5)
  })

  it('falls back to last reading when no readings exist after the last watering', () => {
    // Watered today; reading was logged before the watering (edge case)
    const plant = {
      events: [
        makeReading(3, 1),
        makeWatering(2, 0),
      ]
    }
    // No post-watering readings → falls back to the last available reading (3)
    expect(smoothedCurrentMoisture(plant)).toBe(3)
  })

  // ── Reject impossible-low post-watering readings (#101) ────────────────

  it('excludes a post-watering reading that is below the pre-watering baseline', () => {
    // Pre 3 → water → reading 2 (probe in dry pocket) and 6 (good probe), 5min apart
    // The 2 is physically impossible (water can't make soil drier than 3) → drop it.
    // Smoothed = median of [6] = 6, NOT median of [2, 6] = 4.
    const plant = {
      events: [
        { id: 'r0', type: 'reading',  timestamp: tsHours(28), moisture: 3, bundleId: 'b0' },
        { id: 'w1', type: 'watering', timestamp: tsHours(26), amount: '2', unit: 'cups', bundleId: 'b1' },
        { id: 'r1', type: 'reading',  timestamp: tsHours(25),     moisture: 2, bundleId: 'b2' },
        { id: 'r2', type: 'reading',  timestamp: tsHours(24.917), moisture: 6, bundleId: 'b3' },
      ],
    }
    expect(smoothedCurrentMoisture(plant)).toBe(6)
  })

  it('keeps post-watering readings equal to the pre-watering baseline', () => {
    // A post-watering reading equal to pre-watering is plausible (insufficient
    // watering or just-not-yet-soaked-in). Should be kept, not dropped.
    const plant = {
      events: [
        { id: 'r0', type: 'reading',  timestamp: tsHours(28), moisture: 4, bundleId: 'b0' },
        { id: 'w1', type: 'watering', timestamp: tsHours(26), amount: '2', unit: 'cups', bundleId: 'b1' },
        { id: 'r1', type: 'reading',  timestamp: tsHours(25), moisture: 4, bundleId: 'b2' },
        { id: 'r2', type: 'reading',  timestamp: tsHours(24), moisture: 6, bundleId: 'b3' },
      ],
    }
    // Both 4 and 6 kept → median = 5
    expect(smoothedCurrentMoisture(plant)).toBe(5)
  })

  it('falls back to the raw cycle set when EVERY post-watering reading is below pre-watering', () => {
    // Pathological case: all post-watering readings are bad. Rather than
    // returning null, fall back to using them so the user still sees something.
    const plant = {
      events: [
        { id: 'r0', type: 'reading',  timestamp: tsHours(28), moisture: 6, bundleId: 'b0' },
        { id: 'w1', type: 'watering', timestamp: tsHours(26), amount: '2', unit: 'cups', bundleId: 'b1' },
        { id: 'r1', type: 'reading',  timestamp: tsHours(25), moisture: 2, bundleId: 'b2' },
        { id: 'r2', type: 'reading',  timestamp: tsHours(24), moisture: 3, bundleId: 'b3' },
      ],
    }
    // Both 2 and 3 are below pre (6), so the filter would empty the set —
    // fall back to using them, median of [2, 3] = 2.5
    expect(smoothedCurrentMoisture(plant)).toBe(2.5)
  })

  it('does not filter when there is no pre-watering reading', () => {
    // First-ever watering with no prior reading → no baseline to compare against.
    // Should behave like the original logic.
    const plant = {
      events: [
        { id: 'w1', type: 'watering', timestamp: tsHours(26), amount: '2', unit: 'cups', bundleId: 'b1' },
        { id: 'r1', type: 'reading',  timestamp: tsHours(25), moisture: 2, bundleId: 'b2' },
        { id: 'r2', type: 'reading',  timestamp: tsHours(24), moisture: 6, bundleId: 'b3' },
      ],
    }
    // No pre-reading → no filter → median of [2, 6] = 4
    expect(smoothedCurrentMoisture(plant)).toBe(4)
  })
})

// ── buildEventsFromForm ────────────────────────────────────────────────────

describe('buildEventsFromForm', () => {
  const baseForm = {
    timestamp: '2026-05-18T10:00',
    moisture: '',
    waterAmount: '',
    waterUnit: 'cups',
    health: 'no_change',
    notes: '',
  }

  it('returns [] when form is empty', () => {
    expect(buildEventsFromForm(baseForm)).toEqual([])
  })

  it('creates a reading event when moisture is set', () => {
    const form = { ...baseForm, moisture: 6 }
    const events = buildEventsFromForm(form)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('reading')
    expect(events[0].moisture).toBe(6)
  })

  it('creates a watering event when waterAmount is set', () => {
    const form = { ...baseForm, waterAmount: '1.5' }
    const events = buildEventsFromForm(form)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('watering')
    expect(events[0].amount).toBe('1.5')
    expect(events[0].unit).toBe('cups')
  })

  it('creates a health_change event when health is not no_change', () => {
    const form = { ...baseForm, health: 'thriving' }
    const events = buildEventsFromForm(form)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('health_change')
    expect(events[0].health).toBe('thriving')
  })

  it('creates a note event when notes are filled', () => {
    const form = { ...baseForm, notes: 'new leaf sprouting' }
    const events = buildEventsFromForm(form)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('note')
    expect(events[0].text).toBe('new leaf sprouting')
  })

  it('creates multiple events and shares a bundleId', () => {
    const form = { ...baseForm, moisture: 5, waterAmount: '2', health: 'good', notes: 'looks nice' }
    const events = buildEventsFromForm(form)
    expect(events).toHaveLength(4)
    const ids = new Set(events.map(e => e.bundleId))
    expect(ids.size).toBe(1)   // all share one bundleId
  })

  it('reuses an existing bundleId when editing', () => {
    const form = { ...baseForm, moisture: 7 }
    const events = buildEventsFromForm(form, 'existing-bundle-id')
    expect(events[0].bundleId).toBe('existing-bundle-id')
  })
})

// ── pctTimeInRange ─────────────────────────────────────────────────────────

describe('pctTimeInRange', () => {
  const CARE = { moistureRange: [4, 7] }

  it('returns null when no careProfile', () => {
    const plant = { events: [makeReading(5, 0)] }
    expect(pctTimeInRange(plant, null)).toBeNull()
  })

  it('returns null when careProfile has no moistureRange', () => {
    const plant = { events: [makeReading(5, 0)] }
    expect(pctTimeInRange(plant, {})).toBeNull()
  })

  it('returns null when no readings', () => {
    expect(pctTimeInRange(emptyPlant, CARE)).toBeNull()
  })

  it('returns 100 when all readings are in range', () => {
    const plant = { events: [makeReading(4, 3), makeReading(6, 2), makeReading(7, 1)] }
    expect(pctTimeInRange(plant, CARE)).toBe(100)
  })

  it('returns 0 when no readings are in range', () => {
    const plant = { events: [makeReading(2, 2), makeReading(9, 1)] }
    expect(pctTimeInRange(plant, CARE)).toBe(0)
  })

  it('calculates the correct percentage for mixed readings', () => {
    // 3 in range out of 4 total = 75%
    const plant = { events: [makeReading(4, 4), makeReading(5, 3), makeReading(7, 2), makeReading(2, 1)] }
    expect(pctTimeInRange(plant, CARE)).toBe(75)
  })

  it('includes boundary values (lo and hi) as in-range', () => {
    const plant = { events: [makeReading(4, 2), makeReading(7, 1)] }
    expect(pctTimeInRange(plant, CARE)).toBe(100)
  })
})

describe('typicalWaterAmount', () => {
  const CARE = { moistureRange: [4, 7], minWaterAmount: { cups: 2, liters: 0.5 } }

  it('prefers the explicit override over everything else', () => {
    const plant = {
      typicalWater: { amount: '3', unit: 'cups' },
      events: [makeWatering('1', 6), makeWatering('1', 4), makeWatering('1', 2)],
    }
    const t = typicalWaterAmount(plant, CARE)
    expect(t).toEqual({ amount: 3, unit: 'cups', confidence: 'set', source: 'override' })
  })

  it('learns the median of past waterings once there are ≥3', () => {
    const plant = { events: [makeWatering('2', 6), makeWatering('4', 4), makeWatering('2', 2)] }
    const t = typicalWaterAmount(plant, CARE)
    expect(t.source).toBe('history')
    expect(t.confidence).toBe('learned')
    expect(t.amount).toBe(2)        // median of [2,2,4]
    expect(t.unit).toBe('cups')
  })

  it('falls back to the species default below 3 waterings', () => {
    const plant = { events: [makeWatering('5', 2)] }
    const t = typicalWaterAmount(plant, CARE)
    expect(t).toEqual({ amount: 2, unit: 'cups', confidence: 'default', source: 'species' })
  })

  it('returns null when there is nothing to go on', () => {
    expect(typicalWaterAmount({ events: [] }, {})).toBeNull()
  })
})

// ── pctTimeInRange ────────────────────────────────────────────────────────────

describe('pctTimeInRange', () => {
  const CARE = { moistureRange: [4, 8] }

  it('returns null with no careProfile', () => {
    expect(pctTimeInRange({ events: [makeReading(5)] }, null)).toBeNull()
  })

  it('returns null with careProfile but no moistureRange', () => {
    expect(pctTimeInRange({ events: [makeReading(5)] }, {})).toBeNull()
  })

  it('returns null with no readings', () => {
    expect(pctTimeInRange({ events: [] }, CARE)).toBeNull()
  })

  it('returns 100 when all readings are in range', () => {
    const plant = { events: [makeReading(5), makeReading(6), makeReading(7)] }
    expect(pctTimeInRange(plant, CARE)).toBe(100)
  })

  it('returns 0 when no readings are in range', () => {
    const plant = { events: [makeReading(2), makeReading(3)] }
    expect(pctTimeInRange(plant, CARE)).toBe(0)
  })

  it('rounds to nearest integer for mixed readings', () => {
    const plant = { events: [makeReading(5), makeReading(3), makeReading(6), makeReading(2)] }
    expect(pctTimeInRange(plant, CARE)).toBe(50)
  })

  it('counts boundary values as in range', () => {
    const plant = { events: [makeReading(4), makeReading(8)] }
    expect(pctTimeInRange(plant, CARE)).toBe(100)
  })
})

// ── avgWateringInterval ───────────────────────────────────────────────────────

describe('avgWateringInterval', () => {
  it('returns null with no waterings', () => {
    expect(avgWateringInterval({ events: [] })).toBeNull()
  })

  it('returns null with only one watering', () => {
    expect(avgWateringInterval({ events: [makeWatering(1, 3)] })).toBeNull()
  })

  it('returns the gap in days between two waterings', () => {
    const plant = { events: [makeWatering(1, 7), makeWatering(1, 0)] }
    const interval = avgWateringInterval(plant)
    expect(interval).toBeCloseTo(7, 0)
  })

  it('averages multiple gaps', () => {
    // waterings at 12, 6, and 0 days ago → gaps of 6 and 6 → avg 6
    const plant = { events: [makeWatering(1, 12), makeWatering(1, 6), makeWatering(1, 0)] }
    const interval = avgWateringInterval(plant)
    expect(interval).toBeCloseTo(6, 0)
  })
})

// ── idealWateringInterval ─────────────────────────────────────────────────────

describe('idealWateringInterval', () => {
  const CARE = { moistureRange: [4, 8] }

  it('returns null with no model.beta', () => {
    expect(idealWateringInterval({}, CARE)).toBeNull()
  })

  it('returns null with no careProfile', () => {
    expect(idealWateringInterval({ beta: 1 }, null)).toBeNull()
  })

  it('divides range width by beta', () => {
    // range width = 8 - 4 = 4; beta = 2 → 2 days
    expect(idealWateringInterval({ beta: 2 }, CARE)).toBeCloseTo(2)
  })

  it('returns null when range[1] <= range[0]', () => {
    expect(idealWateringInterval({ beta: 1 }, { moistureRange: [5, 5] })).toBeNull()
  })
})

// ── avgPourAmount ─────────────────────────────────────────────────────────────

describe('avgPourAmount', () => {
  it('returns null with no waterings', () => {
    expect(avgPourAmount({ events: [] })).toBeNull()
  })

  it('returns null when all waterings lack amounts', () => {
    const plant = { events: [{ type: 'watering', timestamp: ts(1), bundleId: 'b', amount: '' }] }
    expect(avgPourAmount(plant)).toBeNull()
  })

  it('averages pour amounts in cups', () => {
    const plant = { events: [makeWatering(2, 3), makeWatering(4, 1)] }
    const result = avgPourAmount(plant)
    expect(result.amount).toBeCloseTo(3)
    expect(result.unit).toBe('cups')
  })

  it('uses the dominant unit when mixed', () => {
    const liters = { id: 'w3', type: 'watering', timestamp: ts(5), amount: '0.5', unit: 'liters', bundleId: 'b' }
    const plant = { events: [makeWatering(2, 3), makeWatering(2, 1), liters] }
    const result = avgPourAmount(plant)
    expect(result.unit).toBe('cups')
  })
})

// ── predictedLandingMoisture ──────────────────────────────────────────────────

describe('predictedLandingMoisture', () => {
  const CARE = { moistureRange: [4, 8] }

  it('returns null with no model.alpha', () => {
    expect(predictedLandingMoisture({ events: [] }, {}, CARE)).toBeNull()
  })

  it('returns null with no pour data', () => {
    const plant = { events: [makeReading(3, 1), makeWatering(0, 0)] }
    expect(predictedLandingMoisture(plant, { alpha: 2 }, CARE)).toBeNull()
  })

  it('uses pre-watering reading as base and adds pour × alpha', () => {
    // reading at 3 moisture before watering; pour 2 cups; alpha 2 → lands at 7
    const plant = {
      events: [
        makeReading(3, 2, 'b1'),          // pre-watering reading
        makeWatering(2, 1, 'cups', 'b2'), // watering
        makeReading(7, 0, 'b3'),          // post-watering (not used as base)
      ],
    }
    const result = predictedLandingMoisture(plant, { alpha: 2 }, CARE)
    expect(result).toBeCloseTo(7, 0)
  })

  it('clamps to careProfile.moistureRange[1] as upper bound', () => {
    // base 3 + 5 cups × 2 alpha = 13 → clamped to range ceiling 8
    const plant = {
      events: [makeReading(3, 2, 'b1'), makeWatering(5, 1, 'cups', 'b2'), makeReading(8, 0, 'b3')],
    }
    const result = predictedLandingMoisture(plant, { alpha: 2 }, CARE)
    expect(result).toBeLessThanOrEqual(8)
  })
})
