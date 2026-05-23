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
