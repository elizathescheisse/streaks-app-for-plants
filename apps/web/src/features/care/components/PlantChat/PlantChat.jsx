import AiChat from '../AiChat/AiChat.jsx'
import { logBundles } from '@plant-streaks/core/plantSelectors.js'

// Send the plant's WHOLE log history, not just a recent slice — so
// questions about the past ("how was it doing in June?") are already
// answerable without any extra machinery. This is safe because even a
// heavily-logged plant is only a few hundred words of one-line summaries,
// trivial for the AI to read. HISTORY_CAP is just a sane backstop against
// a truly pathological case (years of twice-daily logging); if a plant
// ever actually hits it, that's the signal to build on-demand fetching
// (the AI asking for a specific date range mid-conversation) instead of
// raising this number further.
const HISTORY_CAP = 500

function fmtShortDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function waterLabel(unit, amount) {
  if (!amount) return null
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return String(amount)
}

// Condenses everything already known about this plant into a plain-language
// object the serverless function turns into a system prompt. Built here
// (not on the server) because the page already has all of this computed.
export function buildPlantContext({ plant, careProfile, health, reading, watering, rec, usePredicted }) {
  const recentHistory = logBundles(plant)
    .slice(0, HISTORY_CAP)
    .map(bundle => {
      const r = bundle.find(e => e.type === 'reading')
      const w = bundle.find(e => e.type === 'watering')
      const parts = [fmtShortDate(bundle[0].timestamp)]
      if (r) parts.push(`moisture ${r.moisture}/10`)
      if (w) { const wl = waterLabel(w.unit, w.amount); if (wl) parts.push(`watered ${wl}`) }
      return parts.join(' — ')
    })

  return {
    name: plant.name || null,
    species: plant.species,
    health,
    moisture: reading ? Number(reading.moisture) : null,
    moistureWhen: reading ? fmtShortDate(reading.timestamp) : null,
    idealRange: careProfile?.moistureRange ?? null,
    wateringStyle: careProfile?.wateringStyle ?? null,
    lastWatered: watering ? `${waterLabel(watering.unit, watering.amount) ?? watering.amount} on ${fmtShortDate(watering.timestamp)}` : null,
    recommendation: rec && usePredicted
      ? `~${Math.round(rec.predicted)}/10 now${rec.waterNeeded > 0 ? `, suggests ${rec.waterNeeded.toFixed(1)} ${rec.dominantUnit ?? 'cups'}` : ''}`
      : null,
    recentHistory,
  }
}

// Chat about one plant, grounded in its real logged data. Thin wrapper
// around the shared AiChat shell (message list, photo attach, dictation) —
// this file's only job is building the plant-scoped context object.
export default function PlantChat({ plant, careProfile, health, reading, watering, rec, usePredicted, hideTitle = false }) {
  const context = buildPlantContext({ plant, careProfile, health, reading, watering, rec, usePredicted })
  return (
    <AiChat
      title={hideTitle ? null : `Ask about ${plant.name || plant.species}`}
      placeholder="Ask about this plant, or paste/drop a photo…"
      context={context}
    />
  )
}
