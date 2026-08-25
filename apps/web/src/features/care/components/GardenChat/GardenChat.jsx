import AiChat from '../AiChat/AiChat.jsx'
import { derivePlantCardState } from '@plant-streaks/core/plantCardState.js'

function plantName(plant) {
  return plant.name || (plant.species ? plant.species[0].toUpperCase() + plant.species.slice(1) : '?')
}

// Condenses every plant into one summary line each — current status only,
// NOT full log history per plant (unlike PlantChat, which sends one plant's
// whole history). A garden of even a handful of well-logged plants would
// balloon the prompt fast if each carried its full history; current status
// is the right level of detail for garden-wide questions ("which plants
// need water", "how's my garden doing"). Arbitrary scope call, not
// validated against a real large garden — if a "what happened to X last
// month" question inside the garden chat turns out to be common, that's
// the signal to let it pull one plant's fuller history in on request.
export function buildGardenContext(plants) {
  const now = Date.now()
  return {
    garden: true,
    plantCount: plants.length,
    plants: plants.map(plant => {
      const { careProfile, badgeMoisture, usePredicted, status, health } = derivePlantCardState(plant, now)
      return {
        name: plantName(plant),
        species: plant.species,
        health,
        moisture: badgeMoisture,
        moistureIsEstimate: usePredicted,
        idealRange: careProfile?.moistureRange ?? null,
        status: status?.label ?? null,
      }
    }),
  }
}

// Chat about the whole garden at once — "which plants need water today",
// "why does my fern keep struggling compared to the others". Thin wrapper
// around the same shared AiChat shell PlantChat uses (message list, photo
// attach, dictation) — differs only in building a garden-wide context
// instead of one plant's.
export default function GardenChat({ plants }) {
  const context = buildGardenContext(plants)
  return (
    <AiChat
      title="Ask about your garden"
      placeholder="Ask about your whole garden, or paste/drop a photo…"
      context={context}
    />
  )
}
