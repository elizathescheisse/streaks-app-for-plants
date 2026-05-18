// Read-side helpers for the event-based plant model.
// Plants are { id, emoji, species, name, events: Event[] }
// Event types: 'reading' | 'watering' | 'health_change' | 'note'

export function getEvents(plant, type) {
  if (!plant?.events) return []
  return plant.events
    .filter(e => e.type === type)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

export function lastReading(plant) {
  const rs = getEvents(plant, 'reading')
  return rs.length ? rs[rs.length - 1] : null
}

export function lastWatering(plant) {
  const ws = getEvents(plant, 'watering')
  return ws.length ? ws[ws.length - 1] : null
}

export function currentHealth(plant) {
  const hs = getEvents(plant, 'health_change')
  return hs.length ? hs[hs.length - 1].health : 'good'
}

// Group all events into bundles (one bundle = one Save action).
// Returns bundles sorted newest first, by the earliest timestamp in each.
export function logBundles(plant) {
  if (!plant?.events) return []
  const map = new Map()
  for (const e of plant.events) {
    if (!map.has(e.bundleId)) map.set(e.bundleId, [])
    map.get(e.bundleId).push(e)
  }
  return [...map.values()].sort(
    (a, b) => new Date(b[0].timestamp) - new Date(a[0].timestamp)
  )
}

// Convenience: get events relevant to charting (readings + waterings)
export function chartEvents(plant) {
  if (!plant?.events) return { readings: [], waterings: [] }
  return {
    readings:  getEvents(plant, 'reading'),
    waterings: getEvents(plant, 'watering'),
  }
}

// Build the event list that a save action produces, given form input.
// Returns [] if nothing was filled in.
// `form.timestamp` is a local datetime string (YYYY-MM-DDTHH:MM) from the
// <input type="datetime-local"> field. Falls back to "now" if missing.
export function buildEventsFromForm(form, existingBundleId) {
  const timestamp = form.timestamp
    ? new Date(form.timestamp).toISOString()
    : new Date().toISOString()
  const bundleId  = existingBundleId ?? crypto.randomUUID()
  const events = []

  if (form.moisture !== '' && form.moisture != null) {
    events.push({
      id: crypto.randomUUID(),
      type: 'reading',
      timestamp, bundleId,
      moisture: Number(form.moisture),
    })
  }

  if (form.waterAmount && String(form.waterAmount).trim() !== '') {
    events.push({
      id: crypto.randomUUID(),
      type: 'watering',
      timestamp, bundleId,
      amount: String(form.waterAmount).trim(),
      unit: form.waterUnit ?? 'cups',
    })
  }

  if (form.health && form.health !== 'no_change') {
    events.push({
      id: crypto.randomUUID(),
      type: 'health_change',
      timestamp, bundleId,
      health: form.health,
    })
  }

  if (form.notes && form.notes.trim() !== '') {
    events.push({
      id: crypto.randomUUID(),
      type: 'note',
      timestamp, bundleId,
      text: form.notes.trim(),
    })
  }

  return events
}
