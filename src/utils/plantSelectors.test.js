import { describe, it, expect } from 'vitest'
import {
  getEvents,
  lastReading,
  lastWatering,
  currentHealth,
  logBundles,
  chartEvents,
  buildEventsFromForm,
} from './plantSelectors.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function ts(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
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
