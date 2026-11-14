// Merging a device's local plants with the cloud copy when signing in (#231).
//
// A plant's history is an append-only log of events, each with a unique id, so
// two copies of the same plant can be combined without losing anything: take
// the union of their events. (The first version of this picked whichever side
// had MORE events and dropped the other's — so if two devices each logged
// something since they last synced, one side's new readings silently vanished.)
//
// Plants that exist on only one side are kept as they are.
//
// For a plant on both sides, its settings (name, emoji, species, typical pour,
// max pour, tray size) come from the LOCAL copy: they have no timestamps, so
// there is no way to know which side was edited last, and what you see on the
// device in your hand is the least surprising. Judgment call, not validated —
// if editing the same plant on two devices becomes common, settings will need
// their own timestamps.
//
// Known limitation: a deleted log entry on one device comes back if the other
// still has it (a union can't tell "deleted" from "not seen yet"). Fixing that
// needs tombstones.
export function mergePlants(local, cloud) {
  const byId = new Map(local.map(p => [p.id, p]))
  for (const c of cloud) {
    const l = byId.get(c.id)
    byId.set(c.id, l ? { ...l, events: unionEvents(l.events, c.events) } : c)
  }
  return [...byId.values()]
}

// Union by event id, oldest first. Where both sides have the same event the
// local copy is kept; ties on timestamp keep local-first order.
function unionEvents(localEvents = [], cloudEvents = []) {
  const seen = new Set()
  const all = []
  for (const e of [...localEvents, ...cloudEvents]) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    all.push(e)
  }
  return all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}
