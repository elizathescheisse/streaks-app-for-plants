import { describe, it, expect } from 'vitest'
import { derivePlantCardState } from './plantCardState.js'

// pothos has moistureRange [4, 7] in the plant DB.
function reading(moisture, timestamp) {
  return { type: 'reading', bundleId: `r${timestamp}`, timestamp, moisture }
}
function watering(amount, timestamp) {
  return { type: 'watering', bundleId: `w${timestamp}`, timestamp, amount, unit: 'cups' }
}
function plant(events) {
  return { id: 'p1', emoji: '🌿', species: 'pothos', name: 'Test', events }
}

const NOW = new Date('2026-07-15T12:00:00').getTime()
const iso = (ms) => new Date(ms).toISOString()

describe('derivePlantCardState', () => {
  it('returns no status and null moisture for a plant with no readings', () => {
    const s = derivePlantCardState(plant([]), NOW)
    expect(s.reading).toBeNull()
    expect(s.badgeMoisture).toBeNull()
    expect(s.status).toBeNull()
  })

  it('uses the raw reading (not an estimate) when the reading was taken today', () => {
    // Reading a few hours ago today → fresh, no estimate.
    const s = derivePlantCardState(
      plant([reading(5, iso(NOW - 3 * 60 * 60 * 1000))]),
      NOW,
    )
    expect(s.usePredicted).toBe(false)
    expect(s.badgeMoisture).toBe(5)
  })

  it('shows a "Check in Xm" status right after watering', () => {
    // Watered 20 min ago, after the last reading → settling window.
    const s = derivePlantCardState(
      plant([
        reading(3, iso(NOW - 2 * 60 * 60 * 1000)),
        watering(2, iso(NOW - 20 * 60 * 1000)),
      ]),
      NOW,
    )
    expect(s.wateredAfterReading).toBe(true)
    expect(s.status.cls).toBe('check')
    expect(s.status.label).toMatch(/Check in \d+m/)
  })

  it('shows the check timer for a plant watered before its first-ever reading', () => {
    // Watered 10 min ago, no readings logged yet → still show the settle
    // timer so the user knows to come back (and log that first reading).
    const s = derivePlantCardState(
      plant([watering(2, iso(NOW - 10 * 60 * 1000))]),
      NOW,
    )
    expect(s.reading).toBeNull()
    expect(s.status.cls).toBe('check')
    expect(s.status.label).toMatch(/Check in \d+m/)
  })

  it('does not estimate when watered within the last 8 hours (still equilibrating)', () => {
    // Reading yesterday, watered 4h ago (no reading since) → wateredAfterReading
    // path actually applies here, so status is the check badge, not an estimate.
    const s = derivePlantCardState(
      plant([
        reading(3, iso(NOW - 30 * 60 * 60 * 1000)),
        watering(2, iso(NOW - 4 * 60 * 60 * 1000)),
      ]),
      NOW,
    )
    expect(s.usePredicted).toBe(false)
  })

  it('derives a moisture status for a stale-but-confident plant', () => {
    // Enough clean history for a confident model, last reading a few days old.
    const events = []
    // build 6 drying cycles so the model has data
    let t = NOW - 40 * 24 * 60 * 60 * 1000
    for (let i = 0; i < 6; i++) {
      events.push(watering(2, iso(t)))
      events.push(reading(7, iso(t + 60 * 60 * 1000)))
      events.push(reading(4, iso(t + 5 * 24 * 60 * 60 * 1000)))
      t += 6 * 24 * 60 * 60 * 1000
    }
    const s = derivePlantCardState(plant(events), NOW)
    expect(s.hasStats).toBe(true)
    // status should be one of the known classes
    expect(['struggling', 'water', 'thriving', 'okay', 'check']).toContain(s.status.cls)
  })
})
