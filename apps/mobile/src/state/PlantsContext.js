import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadPlants, savePlants } from '../storage/plantStorage.js'
import { currentHealth, buildEventsFromForm } from '@plant-streaks/core/plantSelectors.js'
import { scheduleReMeasureReminder } from '../notifications.js'

// Owns the plants array + persistence + mutators — the RN equivalent of the
// web App.jsx state owner. Screens consume it via usePlants() so navigation
// doesn't have to thread callbacks through route params.
const PlantsContext = createContext(null)

export function PlantsProvider({ children }) {
  const [plants, setPlants] = useState(null) // null = still loading from storage
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadPlants().then(p => { setPlants(p); setLoaded(true) })
  }, [])

  useEffect(() => {
    if (plants !== null) savePlants(plants)
  }, [plants])

  const addPlant = useCallback(({ emoji = '🌿', species, name = '', health }) => {
    const events = []
    if (health) {
      events.push({
        id: crypto.randomUUID(),
        type: 'health_change',
        timestamp: new Date().toISOString(),
        bundleId: crypto.randomUUID(),
        health,
      })
    }
    const newPlant = {
      id: crypto.randomUUID(),
      emoji,
      species: species.trim().toLowerCase(),
      name: name.trim(),
      events,
    }
    setPlants(prev => [...(prev ?? []), newPlant])
    return newPlant.id
  }, [])

  const deletePlant = useCallback((id) => {
    setPlants(prev => (prev ?? []).filter(p => p.id !== id))
  }, [])

  // Append a log bundle (reading/watering/health/note) built from a form.
  const addLogEntry = useCallback((plantId, form) => {
    const newEvents = buildEventsFromForm(form)
    if (newEvents.length === 0) return

    let wateredPlantName = null
    setPlants(prev => (prev ?? []).map(p => {
      if (p.id !== plantId) return p
      if (newEvents.some(e => e.type === 'watering')) {
        wateredPlantName = p.name || p.species
      }
      return { ...p, events: [...(p.events ?? []), ...newEvents] }
    }))

    // Fire-and-forget: if this log included a watering, schedule the
    // "re-measure in an hour" reminder. Fails soft if permission is denied.
    if (wateredPlantName) {
      scheduleReMeasureReminder(wateredPlantName).catch(() => {})
    }
  }, [])

  // Quick shortcuts used by the card action buttons.
  const quickWater = useCallback((plantId, amount, unit = 'cups') => {
    addLogEntry(plantId, { waterAmount: String(amount), waterUnit: unit })
  }, [addLogEntry])

  const quickReading = useCallback((plantId, moisture) => {
    addLogEntry(plantId, { moisture })
  }, [addLogEntry])

  const value = {
    plants: plants ?? [],
    loaded,
    addPlant,
    deletePlant,
    addLogEntry,
    quickWater,
    quickReading,
  }

  return <PlantsContext.Provider value={value}>{children}</PlantsContext.Provider>
}

export function usePlants() {
  const ctx = useContext(PlantsContext)
  if (!ctx) throw new Error('usePlants must be used within a PlantsProvider')
  return ctx
}

export function getPlantById(plants, id) {
  return plants.find(p => p.id === id) ?? null
}

export { currentHealth }
