import { describe, it, expect } from 'vitest'
import { wateringCheckStatus, moistureStatus } from './plantStatus.js'

const FLOOD_AND_DRY = { wateringStyle: 'flood-and-dry', moistureRange: [3, 7], dryThreshold: 3 }
const CONSISTENT     = { wateringStyle: 'consistent',    moistureRange: [4, 7] }

const NOW = new Date('2026-07-15T12:00:00').getTime()
const iso = (ms) => new Date(ms).toISOString()
const mins = (n) => n * 60 * 1000
const hours = (n) => n * 60 * 60 * 1000

function watering(timestamp) {
  return { type: 'watering', bundleId: `w${timestamp}`, timestamp, amount: 1, unit: 'cups' }
}
function reading(timestamp) {
  return { type: 'reading', bundleId: `r${timestamp}`, timestamp, moisture: 5 }
}

describe('wateringCheckStatus', () => {
  it('returns null with no watering', () => {
    expect(wateringCheckStatus(null, null, NOW)).toBeNull()
    expect(wateringCheckStatus(null, reading(iso(NOW - hours(2))), NOW)).toBeNull()
  })

  it('returns null when a reading was taken after the watering', () => {
    const w = watering(iso(NOW - hours(2)))
    const r = reading(iso(NOW - hours(1)))
    expect(wateringCheckStatus(w, r, NOW)).toBeNull()
  })

  it('returns null when reading and watering share a timestamp (same log bundle)', () => {
    // Logging moisture + watering together: the reading was taken pre-pour,
    // but historically this counted as "fresh" — preserve that behavior.
    const ts = iso(NOW - hours(1))
    expect(wateringCheckStatus(watering(ts), reading(ts), NOW)).toBeNull()
  })

  it('shows "Check in Xm" during the settle hour when watered after the last reading', () => {
    const w = watering(iso(NOW - mins(20)))
    const r = reading(iso(NOW - hours(3)))
    const s = wateringCheckStatus(w, r, NOW)
    expect(s.cls).toBe('check')
    expect(s.label).toBe('Check in 40m')
  })

  it('shows "Check now" after the settle hour, indefinitely, when a stale reading exists', () => {
    const r = reading(iso(NOW - hours(50)))
    // 2 hours after watering
    expect(wateringCheckStatus(watering(iso(NOW - hours(2))), r, NOW).label).toBe('Check now')
    // 2 days after watering — still nagging until a fresh reading replaces it
    expect(wateringCheckStatus(watering(iso(NOW - hours(48))), r, NOW).label).toBe('Check now')
  })

  // The fix for "I watered all 3 plants but only one shows the timer":
  // plants with no readings ever still get the settle timer.
  it('shows the timer for a plant with no readings at all', () => {
    const s = wateringCheckStatus(watering(iso(NOW - mins(5))), null, NOW)
    expect(s.cls).toBe('check')
    expect(s.label).toBe('Check in 55m')
  })

  it('shows "Check now" between 1h and 8h for a no-readings plant', () => {
    const s = wateringCheckStatus(watering(iso(NOW - hours(3))), null, NOW)
    expect(s.label).toBe('Check now')
  })

  it('drops the badge after 8h for a no-readings plant (no permanent nag)', () => {
    expect(wateringCheckStatus(watering(iso(NOW - hours(9))), null, NOW)).toBeNull()
  })
})

// The flood-and-dry branch's dry-threshold comparison is inclusive (<=), not
// strictly-below (<) — matching what MoistureBar already tells the user
// ("Water now — at dry threshold"). Before this fix the badge and the bar
// disagreed right at the threshold value: the bar said "water now" a full
// point before the card's badge caught up. This is exactly the kind of
// boundary decision that regresses silently if untested.
describe('moistureStatus — flood-and-dry dry-threshold boundary', () => {
  it('fires "Water" exactly AT the dry threshold, not just below it', () => {
    expect(moistureStatus(3, FLOOD_AND_DRY).cls).toBe('water')
  })
  it('still fires "Water" below the threshold', () => {
    expect(moistureStatus(2, FLOOD_AND_DRY).cls).toBe('water')
  })
  it('does not fire "Water" one point above the threshold', () => {
    const s = moistureStatus(4, FLOOD_AND_DRY)
    expect(s.cls).not.toBe('water')
    expect(s.cls).toBe('thriving')   // "Drying out" — normal cycle
  })
  it('flags overwatered above range + 1', () => {
    expect(moistureStatus(9, FLOOD_AND_DRY).cls).toBe('okay')
  })
})

describe('moistureStatus — consistent-moisture style (unaffected by the boundary fix)', () => {
  it('fires "Water" below the range minimum', () => {
    expect(moistureStatus(3, CONSISTENT).cls).toBe('water')
  })
  it('is "Watered" inside the ideal range', () => {
    expect(moistureStatus(5, CONSISTENT).cls).toBe('thriving')
  })
})
