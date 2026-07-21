import { describe, it, expect } from 'vitest'
import { fitMoistureSeries, fittedLevelAt } from './plantCurve.js'

// Fixed clock so day arithmetic is deterministic.
const T0 = new Date('2026-07-01T12:00:00').getTime()
const DAY = 86_400_000
const at = (days) => new Date(T0 + days * DAY).toISOString()

function reading(moisture, days) {
  return { type: 'reading', bundleId: `r${days}`, timestamp: at(days), moisture }
}
function watering(amount, days, unit = 'cups') {
  return { type: 'watering', bundleId: `w${days}`, timestamp: at(days), amount: String(amount), unit }
}
function plant(events) {
  return { id: 'p1', emoji: '🌿', species: 'pothos', name: 'Test', events }
}

describe('fitMoistureSeries', () => {
  // The motivating case from #172: readings 4 → 1 → 4 on consecutive days.
  // The plant was probably ~4 the whole time; the 1 hit a dry pocket. The
  // fitted line should sit near 4 with only a slight dip — the outlier keeps
  // a (small) vote, it isn't discarded and it doesn't drag the line to 1.
  it('keeps the line near 4 through a 4 → 1 → 4 stretch', () => {
    const events = [watering(2, 0), reading(4, 1), reading(1, 2), reading(4, 3)]
    const { segments } = fitMoistureSeries(plant(events))
    const atOutlier = fittedLevelAt(segments, T0 + 2 * DAY)
    expect(atOutlier).toBeGreaterThanOrEqual(3)
    expect(atOutlier).toBeLessThan(4)

    // ...but it DOES inform: without the 1, the line sits strictly higher.
    const clean = [watering(2, 0), reading(4, 1), reading(4, 3)]
    const { segments: cleanSegs } = fitMoistureSeries(plant(clean))
    expect(atOutlier).toBeLessThan(fittedLevelAt(cleanSegs, T0 + 2 * DAY))
  })

  // A post-watering dry-pocket reading (below the pre-watering level, which is
  // physically impossible) must not anchor the segment start — but unlike
  // computeModel, it still gets a vote and pulls the level down slightly.
  it('does not anchor to a dry-pocket post-watering reading', () => {
    const events = [
      reading(3, -0.5),
      watering(2, 0),
      reading(2, 0.05),  // probe hit a dry pocket right after watering
      reading(6, 0.1),
      reading(5.5, 1),
    ]
    const { segments } = fitMoistureSeries(plant(events))
    const post = segments[segments.length - 1]
    expect(post.startLevel).toBeGreaterThan(5)   // near the credible 6, not the 2

    // Strictly below the fit with the dry-pocket reading removed — it informed.
    const clean = [reading(3, -0.5), watering(2, 0), reading(6, 0.1), reading(5.5, 1)]
    const { segments: cleanSegs } = fitMoistureSeries(plant(clean))
    expect(post.startLevel).toBeLessThan(cleanSegs[cleanSegs.length - 1].startLevel)
  })

  it('jumps up at a watering: contiguous in time, discontinuous in level', () => {
    const events = [
      reading(8, 0), reading(7, 1), reading(6, 2),
      watering(2, 2.5),
      reading(8, 3), reading(7, 4),
    ]
    const { segments } = fitMoistureSeries(plant(events))
    expect(segments).toHaveLength(2)
    expect(segments[0].endTs).toBe(segments[1].startTs)          // same watering moment
    expect(segments[1].startLevel).toBeGreaterThan(segments[0].endLevel) // the jump
    for (const s of segments) {
      expect(s.startLevel).toBeGreaterThanOrEqual(s.endLevel)    // drying, never rising
    }
  })

  // A single post-watering reading far below what physics expects lands the
  // start level strictly BETWEEN the reading and the physics prior — neither
  // fully trusted.
  it('blends a lone low post-watering reading with the physics prior', () => {
    const events = [
      reading(4, 0), reading(3.5, 1), reading(3, 2),
      watering(2, 2.5),
      reading(2, 3),
    ]
    const { segments } = fitMoistureSeries(plant(events))
    const post = segments[segments.length - 1]
    // Reading back-projects to ~2.25; full physics prior is ~5.75.
    expect(post.startLevel).toBeGreaterThan(2.5)
    expect(post.startLevel).toBeLessThan(5.5)
  })

  it('later readings inform earlier stretches (backward sweep)', () => {
    const events = [
      reading(4, 0), reading(3.5, 1), reading(3, 2),
      watering(2, 2.5),
      reading(2, 3),
    ]
    const withBw = fitMoistureSeries(plant(events), undefined, { backward: true })
    const withoutBw = fitMoistureSeries(plant(events), undefined, { backward: false })
    // The suspiciously low post-water reading implies the pre-water stretch
    // was drier than its own readings suggested — hindsight pulls it down.
    expect(withBw.segments[0].startLevel).toBeLessThan(withoutBw.segments[0].startLevel)
  })

  it('returns null for empty and single-reading plants', () => {
    expect(fitMoistureSeries(plant([]))).toBeNull()
    expect(fitMoistureSeries(plant([reading(5, 0)]))).toBeNull()
    expect(fitMoistureSeries(plant([watering(2, 0), reading(5, 1)]))).toBeNull()
  })

  it('fits a single segment when there are readings but no waterings', () => {
    const { segments } = fitMoistureSeries(plant([reading(5, 0), reading(4, 1), reading(3, 2)]))
    expect(segments).toHaveLength(1)
    expect(segments[0].startTs).toBe(T0)
    expect(segments[0].endTs).toBe(T0 + 2 * DAY)
    expect(segments[0].startLevel).toBeGreaterThan(segments[0].endLevel)
  })

  it('survives an unparseable watering amount', () => {
    const events = [
      reading(5, 0), reading(4, 1),
      watering('a splash', 1.5),
      reading(6, 2), reading(5, 3),
    ]
    const result = fitMoistureSeries(plant(events))
    expect(result.segments.length).toBeGreaterThanOrEqual(2)
    for (const s of result.segments) {
      expect(Number.isFinite(s.startLevel)).toBe(true)
      expect(Number.isFinite(s.endLevel)).toBe(true)
    }
  })

  // A watering logged with no readings before the next watering — the line
  // should chain straight through it on physics alone.
  it('chains through a reading-less middle cycle', () => {
    const events = [
      reading(6, 0), reading(5, 1),
      watering(1, 1.5),                 // no readings in this cycle
      watering(1, 3),
      reading(7, 4), reading(6, 5),
    ]
    const { segments } = fitMoistureSeries(plant(events))
    expect(segments).toHaveLength(3)
    const middle = segments[1]
    expect(middle.startTs).toBe(T0 + 1.5 * DAY)
    expect(middle.endTs).toBe(T0 + 3 * DAY)
    expect(Number.isFinite(middle.startLevel)).toBe(true)
  })

  it('never extends past the last reading', () => {
    const events = [
      reading(6, 0), reading(5, 1), reading(4, 2),
      watering(2, 3), // watered after the last reading — nothing to draw there
    ]
    const { segments } = fitMoistureSeries(plant(events))
    const lastSeg = segments[segments.length - 1]
    expect(lastSeg.endTs).toBe(T0 + 2 * DAY)
  })

  it('reports confident: false for a sparse plant', () => {
    const events = [watering(2, 0), reading(4, 1), reading(1, 2), reading(4, 3)]
    expect(fitMoistureSeries(plant(events)).confident).toBe(false)
  })

  it('reports confident: true for a plant with rich, consistent history', () => {
    const events = []
    let t = 0
    for (let i = 0; i < 6; i++) {
      events.push(watering(2, t))
      events.push(reading(7, t + 1 / 24))
      events.push(reading(4, t + 5))
      t += 6
    }
    expect(fitMoistureSeries(plant(events)).confident).toBe(true)
  })
})

describe('fittedLevelAt', () => {
  const segs = [{ startTs: 0, endTs: 10, startLevel: 5, endLevel: 3 }]

  it('interpolates inside a segment', () => {
    expect(fittedLevelAt(segs, 5)).toBeCloseTo(4)
  })
  it('returns exact levels at segment boundaries', () => {
    expect(fittedLevelAt(segs, 0)).toBe(5)
    expect(fittedLevelAt(segs, 10)).toBe(3)
  })
  it('returns null outside all segments and for empty input', () => {
    expect(fittedLevelAt(segs, -1)).toBeNull()
    expect(fittedLevelAt(segs, 11)).toBeNull()
    expect(fittedLevelAt([], 5)).toBeNull()
    expect(fittedLevelAt(null, 5)).toBeNull()
  })
})
