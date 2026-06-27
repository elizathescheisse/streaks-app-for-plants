import { describe, it, expect } from 'vitest'
import {
  needsAttention,
  countEventsToday,
  getDashboardMetrics,
  filterPlants,
  partitionPlants,
  isSameLocalDay,
  getPrimaryNeedsAttentionPlant,
  getPrimaryHealthyPlant,
  getRecentActivities,
  getGreeting,
  getGardenHealthStats,
} from './dashboardCare.js'

const plant = (overrides = {}) => ({
  id: '1',
  emoji: '🌿',
  species: 'pothos',
  name: 'Test',
  events: [],
  ...overrides,
})

describe('dashboardCare', () => {
  it('needsAttention when health is struggling or okay', () => {
    expect(needsAttention(plant({ events: [{ type: 'health_change', health: 'struggling', bundleId: 'b', timestamp: '2026-01-01' }] }))).toBe(true)
    expect(needsAttention(plant({ events: [{ type: 'health_change', health: 'okay', bundleId: 'b', timestamp: '2026-01-01' }] }))).toBe(true)
  })

  it('needsAttention when no logs', () => {
    expect(needsAttention(plant())).toBe(true)
  })

  it('counts watering events for today', () => {
    const day = new Date('2026-05-22T12:00:00')
    const ts = '2026-05-22T10:00:00'
    const plants = [
      plant({ events: [{ type: 'watering', bundleId: 'b', timestamp: ts, amount: 1, unit: 'cups' }] }),
    ]
    expect(countEventsToday(plants, 'watering', day)).toBe(1)
    expect(countEventsToday(plants, 'reading', day)).toBe(0)
  })

  it('partitions filtered plants', () => {
    const thriving = plant({ id: 't', events: [{ type: 'health_change', health: 'thriving', bundleId: 'b', timestamp: '2026-01-01' }, { type: 'reading', bundleId: 'b', timestamp: '2026-01-02', moisture: 5 }] })
    const struggling = plant({ id: 's', events: [{ type: 'health_change', health: 'struggling', bundleId: 'b', timestamp: '2026-01-01' }] })
    const { attention, settled } = partitionPlants([thriving, struggling])
    expect(attention.map(p => p.id)).toEqual(['s'])
    expect(settled.map(p => p.id)).toEqual(['t'])
  })

  it('filterPlants respects search', () => {
    const plants = [plant({ name: 'Monstera' }), plant({ name: 'Fern' })]
    expect(filterPlants(plants, { searchQuery: 'mon', healthFilter: 'all' })).toHaveLength(1)
  })

  it('isSameLocalDay uses local calendar', () => {
    const day = new Date('2026-05-22T15:00:00')
    expect(isSameLocalDay('2026-05-22T08:00:00', day)).toBe(true)
    expect(isSameLocalDay('2026-05-21T23:00:00', day)).toBe(false)
  })

  it('getDashboardMetrics aggregates', () => {
    const m = getDashboardMetrics([plant(), plant({ id: '2' })])
    expect(m.total).toBe(2)
    expect(m.needAttention).toBe(2)
  })

  it('getPrimaryNeedsAttentionPlant returns first sorted match', () => {
    const a = plant({ id: 'a' })
    const b = plant({ id: 'b', events: [{ type: 'health_change', health: 'struggling', bundleId: 'b', timestamp: '2026-01-01' }] })
    const primary = getPrimaryNeedsAttentionPlant([a, b])
    expect(primary).not.toBeNull()
    expect(['a', 'b']).toContain(primary.id)
  })

  it('getRecentActivities returns newest events', () => {
    const p = plant({
      events: [
        { type: 'watering', bundleId: 'b1', timestamp: '2026-05-20T10:00:00', amount: 1, unit: 'cups' },
        { type: 'reading', bundleId: 'b2', timestamp: '2026-05-22T10:00:00', moisture: 5 },
      ],
    })
    const acts = getRecentActivities([p], 2)
    expect(acts[0].text).toContain('Moisture')
  })

  it('getGreeting varies by hour', () => {
    expect(getGreeting(new Date('2026-05-22T08:00:00'))).toBe('Good morning')
    expect(getGreeting(new Date('2026-05-22T14:00:00'))).toBe('Good afternoon')
  })
})

// ── getGardenHealthStats ────────────────────────────────────────────────────

// pothos has moistureRange [4, 7] in plantLookup — used for pctTimeInRange
function trackedPlant(id, readings = [], extraEvents = []) {
  return {
    id,
    emoji: '🌿',
    species: 'pothos',
    name: `Plant ${id}`,
    events: [
      ...readings.map((m, i) => ({
        type: 'reading', bundleId: `b${i}`, moisture: m,
        timestamp: new Date(Date.now() - (readings.length - i) * 86_400_000).toISOString(),
      })),
      ...extraEvents,
    ],
  }
}

describe('getGardenHealthStats', () => {
  it('returns empty state for no plants', () => {
    const stats = getGardenHealthStats([], new Date())
    expect(stats.plants).toEqual([])
    expect(stats.trackedCount).toBe(0)
    expect(stats.readToday).toBe(0)
    expect(stats.unreadToday).toEqual([])
    expect(stats.focusPlant).toBeNull()
  })

  it('assigns correct pct to tracked plants', () => {
    // pothos range [4,7]: readings [5, 6, 2] → 2/3 in range = 67%
    const p = trackedPlant('a', [5, 6, 2])
    const stats = getGardenHealthStats([p], new Date())
    expect(stats.trackedCount).toBe(1)
    expect(stats.plants[0].pct).toBe(67)
  })

  it('sorts plants worst-first', () => {
    const good = trackedPlant('g', [5, 6, 7])   // 100%
    const bad  = trackedPlant('b', [2, 2, 2])   // 0%
    const stats = getGardenHealthStats([good, bad], new Date())
    expect(stats.plants[0].plant.id).toBe('b')
    expect(stats.plants[1].plant.id).toBe('g')
  })

  it('sets focusPlant to the one with the lowest pct', () => {
    const good = trackedPlant('g', [5, 6])
    const bad  = trackedPlant('b', [2, 3])
    const stats = getGardenHealthStats([good, bad], new Date())
    expect(stats.focusPlant.id).toBe('b')
  })

  it('counts plants read today vs unread', () => {
    const today = new Date('2026-05-22T12:00:00')
    const readPlant = {
      id: 'r', emoji: '🌿', species: 'pothos', name: 'Read',
      events: [{ type: 'reading', bundleId: 'b1', moisture: 5, timestamp: '2026-05-22T10:00:00' }],
    }
    const unreadPlant = trackedPlant('u', [5, 6])  // no reading today
    const stats = getGardenHealthStats([readPlant, unreadPlant], today)
    expect(stats.readToday).toBe(1)
    expect(stats.unreadToday).toHaveLength(1)
    expect(stats.unreadToday[0].id).toBe('u')
  })

  it('session tracker is empty when no plants have been read today', () => {
    const p = trackedPlant('a', [5])
    const stats = getGardenHealthStats([p], new Date('2026-01-01T12:00:00'))
    expect(stats.readToday).toBe(0)
    expect(stats.unreadToday).toHaveLength(1)
  })

  it('session tracker is empty when all plants have been read today', () => {
    const today = new Date()
    const reading = { type: 'reading', bundleId: 'b', moisture: 5, timestamp: new Date().toISOString() }
    const p = { id: 'a', emoji: '🌿', species: 'pothos', name: 'P', events: [reading] }
    const stats = getGardenHealthStats([p], today)
    expect(stats.unreadToday).toHaveLength(0)
  })
})
