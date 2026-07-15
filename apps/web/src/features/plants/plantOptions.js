import { PLANT_DB } from '@plant-streaks/core/plantDatabase.js'

/**
 * Curated add-plant picker options. `speciesKey` must match PLANT_DB keys when possible
 * so lookupPlant() and SpeciesInput autocomplete stay in sync.
 * `image` is optional — wire local assets later without changing component APIs.
 */
export const PLANT_OPTIONS = [
  {
    id: 'monstera',
    name: 'Monstera',
    speciesKey: 'monstera deliciosa',
    icon: '🌿',
    tag: 'Popular pick',
  },
  {
    id: 'snake-plant',
    name: 'Snake Plant',
    speciesKey: 'snake plant',
    icon: '🪴',
  },
  {
    id: 'bird-of-paradise',
    name: 'Bird of Paradise',
    speciesKey: 'bird of paradise',
    icon: '🌺',
  },
  {
    id: 'aloe',
    name: 'Aloe Vera',
    speciesKey: 'aloe vera',
    icon: '🌵',
  },
  {
    id: 'succulent',
    name: 'Succulent',
    speciesKey: 'succulent',
    icon: '🪴',
  },
  {
    id: 'palm',
    name: 'Palm',
    speciesKey: 'parlor palm',
    icon: '🌴',
  },
  {
    id: 'fern',
    name: 'Fern',
    speciesKey: 'boston fern',
    icon: '🌱',
  },
  {
    id: 'fiddle',
    name: 'Fiddle Leaf Fig',
    speciesKey: 'fiddle leaf fig',
    icon: '🌿',
  },
  {
    id: 'pothos',
    name: 'Pothos',
    speciesKey: 'pothos',
    icon: '🍃',
  },
].map(option => ({
  ...option,
  speciesLabel: PLANT_DB[option.speciesKey]?.displayName ?? option.name,
  image: option.image ?? undefined,
}))

export const DEFAULT_PLANT_OPTION_ID = PLANT_OPTIONS[0].id

export function getPlantOption(id) {
  return PLANT_OPTIONS.find(o => o.id === id) ?? PLANT_OPTIONS[0]
}

export function findPlantOptionId(species) {
  if (!species?.trim()) return null
  const key = species.trim().toLowerCase()
  const match = PLANT_OPTIONS.find(
    o => o.speciesKey === key || o.speciesLabel.toLowerCase() === key
  )
  return match?.id ?? null
}

export function buildDefaultAddPlantForm() {
  const option = getPlantOption(DEFAULT_PLANT_OPTION_ID)
  return {
    id: null,
    emoji: option.icon,
    species: option.speciesKey,
    name: '',
    health: null,
    typicalWaterAmount: '',
    typicalWaterUnit:   'cups',
  }
}
