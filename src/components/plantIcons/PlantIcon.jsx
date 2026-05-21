// Dispatcher: returns an animated SVG icon for a known species, or null
// (so the caller can fall back to the plant's emoji). Health state is
// passed through to the underlying species component, which uses it to
// drive color / droop / tip burn via CSS custom properties.

import Monstera from './Monstera.jsx'

// Map normalized species → component. Add entries here as new icons land.
// Keys should be lowercase, trimmed.
const ICONS = {
  'monstera':            Monstera,
  'monstera deliciosa':  Monstera,
}

function normalize(species) {
  return (species ?? '').trim().toLowerCase()
}

export function hasIcon(species) {
  return Object.prototype.hasOwnProperty.call(ICONS, normalize(species))
}

export default function PlantIcon({ species, health = 'good', ariaLabel }) {
  const key = normalize(species)
  const Component = ICONS[key]
  if (!Component) return null
  return <Component health={health} ariaLabel={ariaLabel} />
}
