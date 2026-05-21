// Dispatcher: returns an animated SVG icon component for a known species,
// or null (so the caller can fall back to the plant's emoji). Health state
// is passed through to the species component.

import Monstera from './Monstera.jsx'

// Lowercase, trimmed species → component
const ICONS = {
  'monstera':           Monstera,
  'monstera deliciosa': Monstera,
}

function normalize(species) {
  return (species ?? '').trim().toLowerCase()
}

export function hasIcon(species) {
  return Object.prototype.hasOwnProperty.call(ICONS, normalize(species))
}

export default function PlantIcon({ species, health = 'good', ariaLabel }) {
  const Component = ICONS[normalize(species)]
  if (!Component) return null
  return <Component health={health} ariaLabel={ariaLabel} />
}
