/**
 * Dashboard-derived care signals — simple heuristics until smarter
 * prediction-based "due today" logic exists. See TODOs below.
 */

import { currentHealth, lastReading, lastWatering, logBundles, pctTimeInRange, getEvents } from './plantSelectors.js'
import { getPlantSortPriority } from './plantStatus.js'
import { lookupPlant } from './plantLookup.js'

const HEALTH_LABELS = {
  thriving: 'Thriving',
  good: 'Healthy',
  okay: 'Okay',
  struggling: 'Struggling',
}

/** Start of local calendar day for `date` */
export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameLocalDay(isoTimestamp, day = new Date()) {
  if (!isoTimestamp) return false
  const t = new Date(isoTimestamp)
  const start = startOfDay(day)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return t >= start && t < end
}

/** True when the plant should surface in “Needs Attention” */
export function needsAttention(plant) {
  const health = currentHealth(plant)
  if (health === 'struggling' || health === 'okay') return true

  const bundles = logBundles(plant)
  if (!bundles.length) return true

  const reading = lastReading(plant)
  if (!reading) return true

  // Urgent moisture badges (water now, struggling, check settling)
  const priority = getPlantSortPriority(plant)
  if (priority <= 2) return true

  return false
}

export function getHealthLabel(health) {
  return HEALTH_LABELS[health] ?? health
}

/** Short care note for dashboard rows */
export function getCareNote(plant) {
  const bundles = logBundles(plant)
  if (!bundles.length) return 'Add your first log'

  const health = currentHealth(plant)
  if (health === 'struggling') return 'Check plant health'
  if (health === 'okay') return 'Monitor moisture'

  const reading = lastReading(plant)
  const watering = lastWatering(plant)
  if (!reading) return 'Moisture reading due'

  if (watering && reading && new Date(watering.timestamp) > new Date(reading.timestamp)) {
    return 'Check moisture after watering'
  }

  const priority = getPlantSortPriority(plant)
  if (priority <= 1) return 'Watering may be due'
  if (priority === 2) return 'Check moisture soon'

  return null
}

export function countEventsToday(plants, eventType, day = new Date()) {
  let n = 0
  for (const plant of plants) {
    for (const e of plant.events ?? []) {
      if (e.type === eventType && isSameLocalDay(e.timestamp, day)) n++
    }
  }
  return n
}

export function getDashboardMetrics(plants, day = new Date()) {
  const total = plants.length
  const needAttention = plants.filter(needsAttention).length
  const wateredToday = countEventsToday(plants, 'watering', day)
  const readingsToday = countEventsToday(plants, 'reading', day)

  // Count distinct plants that have at least one reading today
  const plantsReadToday = plants.filter(p =>
    (p.events ?? []).some(e => e.type === 'reading' && isSameLocalDay(e.timestamp, day))
  ).length
  const measuredToday = total > 0 ? `${plantsReadToday} / ${total}` : '0'

  return { total, needAttention, wateredToday, readingsToday, measuredToday }
}

// Returns garden-wide health stats for the dashboard health grid and session tracker.
// Each plant in `plants` is looked up against its species careProfile.
// Returns:
//   plants:       [{ plant, pct }] sorted worst-first — for the colored circles
//   focusPlant:   plant with the lowest pctTimeInRange (the one needing most attention)
//   readToday:    count of plants with at least one reading today
//   unreadToday:  plants that have no reading today (for the session-tracker row)
//   trackedCount: plants that have a careProfile + at least one reading ever
export function getGardenHealthStats(plants, today = new Date()) {
  const tracked = []
  let focusPlant = null
  let lowestPct = Infinity
  let readTodayCount = 0
  const unreadToday = []

  for (const plant of plants) {
    const careProfile = lookupPlant(plant.species)
    const readings = getEvents(plant, 'reading')
    const pct = pctTimeInRange(plant, careProfile)

    const hadReadingToday = readings.some(r => isSameLocalDay(r.timestamp, today))
    if (hadReadingToday) {
      readTodayCount++
    } else {
      unreadToday.push(plant)
    }

    if (pct != null) {
      tracked.push({ plant, pct })
      if (pct < lowestPct) {
        lowestPct = pct
        focusPlant = plant
      }
    }
  }

  tracked.sort((a, b) => a.pct - b.pct)

  const avgPct = tracked.length > 0
    ? Math.round(tracked.reduce((sum, { pct }) => sum + pct, 0) / tracked.length)
    : null

  const noReadingCount = plants.filter(p => getEvents(p, 'reading').length === 0).length

  return {
    plants: tracked,
    focusPlant,
    readToday: readTodayCount,
    unreadToday,
    trackedCount: tracked.length,
    avgPct,
    noReadingCount,
  }
}

export function getSummaryLine(plants) {
  const { total, needAttention } = getDashboardMetrics(plants)
  if (total === 0) return null
  if (needAttention === 0) {
    return `${total} plant${total === 1 ? '' : 's'} in your garden`
  }
  return `${needAttention} plant${needAttention === 1 ? '' : 's'} may need attention today`
}

export const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'needs-attention', label: 'Needs Attention' },
  { id: 'thriving', label: 'Thriving' },
  { id: 'okay', label: 'Okay' },
  { id: 'struggling', label: 'Struggling' },
]

export function matchesSearch(plant, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    (plant.name && plant.name.toLowerCase().includes(q)) ||
    (plant.species && plant.species.toLowerCase().includes(q)) ||
    (plant.emoji && plant.emoji.includes(query.trim()))
  )
}

export function matchesHealthFilter(plant, filterId) {
  if (filterId === 'all') return true
  if (filterId === 'needs-attention') return needsAttention(plant)
  const health = currentHealth(plant)
  if (filterId === 'thriving') return health === 'thriving' || health === 'good'
  return health === filterId
}

export function filterPlants(plants, { searchQuery, healthFilter }) {
  return plants.filter(
    p => matchesSearch(p, searchQuery) && matchesHealthFilter(p, healthFilter),
  )
}

export function partitionPlants(plants) {
  const attention = []
  const settled = []
  for (const p of plants) {
    if (needsAttention(p)) attention.push(p)
    else settled.push(p)
  }
  return { attention, settled }
}

export function getGreeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getNeedsAttentionPlants(plants) {
  return plants.filter(needsAttention)
}

/** Settled plants — not in needs-attention bucket */
export function isHealthyPlant(plant) {
  return !needsAttention(plant)
}

export function getHealthyPlants(plants) {
  return plants.filter(isHealthyPlant)
}

function sortByPriority(plants) {
  return plants.slice().sort((a, b) => getPlantSortPriority(a) - getPlantSortPriority(b))
}

export function getPrimaryNeedsAttentionPlant(plants) {
  const list = sortByPriority(getNeedsAttentionPlants(plants))
  return list[0] ?? null
}

export function getPrimaryHealthyPlant(plants) {
  const healthy = getHealthyPlants(plants)
  const ranked = healthy.slice().sort((a, b) => {
    const order = { thriving: 0, good: 1, okay: 2, struggling: 3 }
    const ha = order[currentHealth(a)] ?? 4
    const hb = order[currentHealth(b)] ?? 4
    return ha - hb
  })
  return ranked[0] ?? null
}

function relTime(ts) {
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function waterLabel(unit, amount) {
  if (!amount) return ''
  const n = parseFloat(amount)
  if (unit === 'cups') return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return String(amount)
}

/** Spotlight summary lines for overview cards */
export function getPlantSpotlightSummary(plant) {
  const bundles = logBundles(plant)
  if (!bundles.length) {
    return { primary: 'No logs yet', secondary: getCareNote(plant) }
  }

  const reading = lastReading(plant)
  const watering = lastWatering(plant)
  const secondary = getCareNote(plant)

  if (reading) {
    return {
      primary: `Moisture ${reading.moisture}/10 · ${relTime(reading.timestamp)}`,
      secondary,
    }
  }
  if (watering) {
    return {
      primary: `Last watered · ${relTime(watering.timestamp)}`,
      secondary,
    }
  }
  return { primary: 'No logs yet', secondary }
}

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function plantDisplayName(plant) {
  return plant.name || titleCase(plant.species) || 'Plant'
}

/** Recent care events across the garden, newest first */
export function getRecentActivities(plants, limit = 5) {
  const rows = []
  for (const plant of plants) {
    for (const e of plant.events ?? []) {
      rows.push({ plant, event: e, ts: new Date(e.timestamp).getTime() })
    }
  }
  rows.sort((a, b) => b.ts - a.ts)

  return rows.slice(0, limit).map(({ plant, event }) => {
    const name = plantDisplayName(plant)
    switch (event.type) {
      case 'watering':
        return {
          id: `${plant.id}-${event.bundleId}-water`,
          icon: '💧',
          text: `Watered ${name}${event.amount ? ` (${waterLabel(event.unit, event.amount)})` : ''}`,
        }
      case 'reading':
        return {
          id: `${plant.id}-${event.bundleId}-read`,
          icon: '◎',
          text: `Moisture reading for ${name} — ${event.moisture}/10`,
        }
      case 'health_change':
        return {
          id: `${plant.id}-${event.bundleId}-health`,
          icon: '🌿',
          text: `Health update for ${name} — ${getHealthLabel(event.health)}`,
        }
      case 'note':
        return {
          id: `${plant.id}-${event.bundleId}-note`,
          icon: '📝',
          text: `Note for ${name}`,
        }
      default:
        return { id: `${plant.id}-${event.bundleId}`, icon: '•', text: `Activity for ${name}` }
    }
  })
}

export const CARE_TIPS = [
  {
    text: 'Most plants prefer consistent moisture and bright, indirect light.',
    emoji: '🪴',
  },
  {
    text: 'Water when the top inch of soil feels dry — not on a fixed calendar schedule.',
    emoji: '💧',
  },
  {
    text: 'Morning light is gentler than harsh afternoon sun for most houseplants.',
    emoji: '🌤️',
  },
  {
    text: 'A quick moisture reading after watering helps your care log stay accurate.',
    emoji: '🌿',
  },
]

export function getCareTipSlide(index = 0) {
  const slides = CARE_TIPS
  return slides[((index % slides.length) + slides.length) % slides.length]
}

/** @deprecated use getCareTipSlide().text */
export function getCareTip(index = 0) {
  return getCareTipSlide(index).text
}

// Plants that need water today: not yet watered today AND model says moisture
// is at or below the healthy floor (priority ≤ 1 = "Water now" / "Water immediately").
// Plants that were watered after their last reading are excluded — their model
// is effectively paused and they don't need another watering.
export function getWateringDueToday(plants, today = new Date()) {
  return plants.filter(plant => {
    // Already watered today — skip
    const waterings = getEvents(plant, 'watering')
    if (waterings.some(w => isSameLocalDay(w.timestamp, today))) return false

    // No readings at all — no prediction basis, skip
    if (!lastReading(plant)) return false

    // Model says water now (priority 0 = struggling, priority 1 = water now)
    return getPlantSortPriority(plant) <= 1
  })
}
