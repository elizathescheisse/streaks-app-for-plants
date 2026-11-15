import { describe, it, expect } from 'vitest'
import { mergePlants } from './plantMerge.js'

const ev = (id, type, minute, extra = {}) => ({
  id, type, bundleId: `b-${id}`,
  timestamp: new Date(Date.UTC(2026, 10, 14, 12, minute)).toISOString(), ...extra,
})
const reading = (id, minute, moisture = 5) => ev(id, 'reading', minute, { moisture })
const watering = (id, minute) => ev(id, 'watering', minute, { amount: '2', unit: 'cups' })
const plant = (id, events, extra = {}) => ({ id, emoji: '🌿', species: 'pothos', name: 'P', events, ...extra })
const ids = p => p.events.map(e => e.id)

describe('mergePlants — two devices both logged since the last sync', () => {
  // Real situation: the live site and localhost are signed into the same account.
  // Each logged something the other hasn't seen yet. Nothing may be lost.
  const shared = [reading('r1', 0), watering('w1', 1)]
  const local = plant('p1', [...shared, reading('rLocal', 30)])                     // 3 events — today's reading
  const cloud = plant('p1', [...shared, reading('rCloud', 20), watering('wCloud', 21)]) // 4 events

  it('keeps events from BOTH sides (the side with more events must not win outright)', () => {
    const [merged] = mergePlants([local], [cloud])
    expect(ids(merged)).toEqual(expect.arrayContaining(['r1', 'w1', 'rLocal', 'rCloud', 'wCloud']))
    expect(merged.events).toHaveLength(5)
  })
})

describe('mergePlants — everything else', () => {
  it('returns the local plants unchanged when there is no cloud copy', () => {
    const local = [plant('p1', [reading('r1', 0)])]
    expect(mergePlants(local, [])).toEqual(local)
  })

  it('adds plants that exist only in the cloud (e.g. first sign-in on a new device)', () => {
    const merged = mergePlants([], [plant('p1', [reading('r1', 0)]), plant('p2', [])])
    expect(merged.map(p => p.id)).toEqual(['p1', 'p2'])
  })

  it('keeps plants that exist only locally', () => {
    const merged = mergePlants([plant('p1', [reading('r1', 0)])], [plant('p2', [])])
    expect(merged.map(p => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('does not duplicate events both sides already have', () => {
    const shared = [reading('r1', 0), watering('w1', 1)]
    const [merged] = mergePlants([plant('p1', shared)], [plant('p1', shared)])
    expect(ids(merged)).toEqual(['r1', 'w1'])
  })

  it('orders the merged events oldest-first', () => {
    const local = plant('p1', [reading('late', 50), reading('early', 5)])
    const cloud = plant('p1', [reading('middle', 25)])
    expect(ids(mergePlants([local], [cloud])[0])).toEqual(['early', 'middle', 'late'])
  })

  it("keeps the local plant's settings, and takes only the events from the cloud", () => {
    const local = plant('p1', [reading('r1', 0)], { name: 'Local name', maxPour: { amount: '2', unit: 'cups' } })
    const cloud = plant('p1', [reading('r2', 5)], { name: 'Cloud name', maxPour: { amount: '9', unit: 'cups' } })
    const [merged] = mergePlants([local], [cloud])
    expect(merged.name).toBe('Local name')
    expect(merged.maxPour).toEqual({ amount: '2', unit: 'cups' })
    expect(ids(merged)).toEqual(['r1', 'r2'])
  })

  it('handles plants with a missing events list', () => {
    const local = { id: 'p1', species: 'pothos', name: 'P' }
    const cloud = plant('p1', [reading('r1', 0)])
    expect(ids(mergePlants([local], [cloud])[0])).toEqual(['r1'])
    expect(ids(mergePlants([cloud], [local])[0])).toEqual(['r1'])
  })

  it('is the same result whichever device syncs first (events-wise)', () => {
    const a = plant('p1', [reading('r1', 0), reading('rA', 30)])
    const b = plant('p1', [reading('r1', 0), reading('rB', 20), watering('wB', 21)])
    expect(ids(mergePlants([a], [b])[0])).toEqual(ids(mergePlants([b], [a])[0]))
  })

  it('does not mutate its inputs', () => {
    const local = [plant('p1', [reading('r1', 0)])]
    const cloud = [plant('p1', [reading('r2', 5)])]
    const before = JSON.stringify([local, cloud])
    mergePlants(local, cloud)
    expect(JSON.stringify([local, cloud])).toBe(before)
  })
})

describe('mergePlants — nothing new to learn (live listeners must not loop)', () => {
  // The cloud and other tabs now push updates live. If a merge that changes
  // nothing still returned a fresh array, every update would trigger a save,
  // which triggers another update, forever. "No news" must return the SAME array.
  it('returns the very same array when the other side has nothing new', () => {
    const local = [plant('p1', [reading('r1', 0), watering('w1', 1)])]
    const cloud = [plant('p1', [reading('r1', 0)])]
    expect(mergePlants(local, cloud)).toBe(local)
  })

  it('returns the same array when the other side is empty', () => {
    const local = [plant('p1', [reading('r1', 0)])]
    expect(mergePlants(local, [])).toBe(local)
  })

  it('still returns a new array when the other side has one new event', () => {
    const local = [plant('p1', [reading('r1', 0)])]
    const cloud = [plant('p1', [reading('r1', 0), watering('w2', 5)])]
    const merged = mergePlants(local, cloud)
    expect(merged).not.toBe(local)
    expect(ids(merged[0])).toEqual(['r1', 'w2'])
  })

  it('still returns a new array when the other side has a plant we lack', () => {
    const local = [plant('p1', [reading('r1', 0)])]
    expect(mergePlants(local, [plant('p2', [])])).toHaveLength(2)
  })

  it('keeps unchanged plants as the same objects when only another plant changed', () => {
    const p1 = plant('p1', [reading('r1', 0)])
    const p2 = plant('p2', [reading('r2', 0)])
    const merged = mergePlants([p1, p2], [plant('p2', [reading('r2', 0), watering('w', 9)])])
    expect(merged[0]).toBe(p1)
  })
})
