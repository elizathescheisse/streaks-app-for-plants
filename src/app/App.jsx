import { useState, useRef, useEffect } from 'react'
import AppLayout from '../layouts/AppLayout.jsx'
import AppRoutes from './routes.jsx'
import PlantForm from '../features/plants/components/PlantForm'
import AddPlantModal from '../features/plants/components/AddPlantModal'
import { buildDefaultAddPlantForm } from '../features/plants/plantOptions.js'
import LogEntryForm, { createEmptyLogForm } from '../features/logs/components/LogEntry'
import QuickLogModal from '../features/logs/components/QuickLogModal'
import SettingsModal from '../features/settings/components/SettingsModal'
import Modal from '../shared/components/Modal'
import { buildEventsFromForm, currentHealth } from '../utils/plantSelectors.js'

const SCHEMA_VERSION = '2'
const STORAGE_KEY    = 'plant-streaks'
const SCHEMA_KEY     = 'plant-streaks-schema'

const today = new Date()
const DATE_KEY = today.toISOString().slice(0, 10)

// One-time schema reset — clears any old-format data on first load
function loadInitialPlants() {
  const ver = localStorage.getItem(SCHEMA_KEY)
  if (ver !== SCHEMA_VERSION) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION)
    return []
  }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [] }
  catch { return [] }
}

// Top-level app: owns plant data, the active panel/modal, and every handler
// that mutates plant state. The visible routes (home / plant detail) live
// in AppRoutes; per-page UI state (cardView, chartWindow, searchQuery, etc.)
// lives in those page components, not here.
export default function App() {
  const [plants, setPlants] = useState(loadInitialPlants)

  // panel:
  //   null                                   — no panel
  //   { mode: 'identity', form }             — add/edit plant form
  //   { mode: 'log', plantId, form }         — log-entry form
  //   { mode: 'quickLog', plantId, type }    — one-tap water/reading
  const [panel, setPanel] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const importRef = useRef()

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plants))
  }, [plants])

  // ── Plant identity (add/edit) ───────────────────────────
  function savePlantIdentity() {
    const form = panel.form
    const canSave = form.species.trim() || form.name.trim()
    if (!canSave) return

    if (form.id) {
      setPlants(ps => ps.map(p => {
        if (p.id !== form.id) return p
        const updated = { ...p, emoji: form.emoji, species: form.species, name: form.name }
        // Append a health_change event only if health actually changed
        if (form.health && form.health !== currentHealth(p)) {
          updated.events = [...p.events, {
            id:        crypto.randomUUID(),
            type:      'health_change',
            timestamp: new Date().toISOString(),
            bundleId:  crypto.randomUUID(),
            health:    form.health,
          }]
        }
        return updated
      }))
    } else {
      const initialEvents = []
      if (form.health) {
        initialEvents.push({
          id:        crypto.randomUUID(),
          type:      'health_change',
          timestamp: new Date().toISOString(),
          bundleId:  crypto.randomUUID(),
          health:    form.health,
        })
      }
      setPlants(ps => [...ps, {
        id:      crypto.randomUUID(),
        emoji:   form.emoji,
        species: form.species,
        name:    form.name,
        events:  initialEvents,
      }])
    }
    setPanel(null)
  }

  function openAdd() {
    setPanel({ mode: 'identity', form: buildDefaultAddPlantForm() })
  }

  function editPlant(plant) {
    setPanel({
      mode: 'identity',
      form: { id: plant.id, emoji: plant.emoji, species: plant.species, name: plant.name, health: currentHealth(plant) }
    })
  }

  function deletePlant(id) {
    setPlants(ps => ps.filter(p => p.id !== id))
    if (panel?.form?.id === id || panel?.plantId === id) setPanel(null)
  }

  // ── Log entry ───────────────────────────────────────────
  function openLog(plant) {
    setPanel({ mode: 'log', plantId: plant.id, form: createEmptyLogForm() })
  }

  function openEditLog(plant, bundle) {
    // Convert bundle events back into form shape for pre-filling
    const ts      = bundle[0].timestamp
    const reading = bundle.find(e => e.type === 'reading')
    const watering = bundle.find(e => e.type === 'watering')
    const healthEv = bundle.find(e => e.type === 'health_change')
    const note     = bundle.find(e => e.type === 'note')
    const d = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    const localTs = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    setPanel({
      mode: 'log',
      plantId: plant.id,
      editBundleId: bundle[0].bundleId,
      form: {
        timestamp:   localTs,
        moisture:    reading?.moisture  ?? '',
        waterAmount: watering?.amount   ?? '',
        waterUnit:   watering?.unit     ?? 'cups',
        health:      healthEv?.health   ?? 'no_change',
        notes:       note?.text         ?? '',
      }
    })
  }

  function saveLogEntry() {
    const { plantId, form, editBundleId } = panel
    const newEvents = buildEventsFromForm(form, editBundleId)
    if (newEvents.length === 0) { setPanel(null); return }

    setPlants(ps => ps.map(p => {
      if (p.id !== plantId) return p
      const filtered = editBundleId
        ? (p.events ?? []).filter(e => e.bundleId !== editBundleId)
        : (p.events ?? [])
      return { ...p, events: [...filtered, ...newEvents] }
    }))
    setPanel(null)
  }

  function deleteLogBundle() {
    const { plantId, editBundleId } = panel
    if (!editBundleId) return
    setPlants(ps => ps.map(p => {
      if (p.id !== plantId) return p
      return { ...p, events: (p.events ?? []).filter(e => e.bundleId !== editBundleId) }
    }))
    setPanel(null)
  }

  // ── Quick log ───────────────────────────────────────────
  function openQuickLog(plant, type) {
    setPanel({ mode: 'quickLog', plantId: plant.id, quickType: type })
  }

  function saveQuickLog(events) {
    const { plantId } = panel
    setPlants(ps => ps.map(p =>
      p.id !== plantId ? p : { ...p, events: [...(p.events ?? []), ...events] }
    ))
    setPanel(null)
  }

  // ── Export ──────────────────────────────────────────────
  function exportJSON() {
    const data = { schemaVersion: SCHEMA_VERSION, date: DATE_KEY, plants }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plant-streaks-${DATE_KEY}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ──────────────────────────────────────────────
  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!Array.isArray(data.plants)) return
        // Only accept v2 (event-based) files for now.
        if (data.schemaVersion !== SCHEMA_VERSION) {
          alert('This file is from an older version of the app. Please re-export.')
          return
        }
        setPlants(data.plants)
      } catch { /* invalid file */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Shared callbacks used by both the list and detail page
  const detailCallbacks = {
    onEdit:         editPlant,
    onLog:          openLog,
    onQuickWater:   (p) => openQuickLog(p, 'water'),
    onQuickReading: (p) => openQuickLog(p, 'reading'),
    onEditLog:      openEditLog,
  }

  return (
    <AppLayout
      headerProps={{
        onExport: exportJSON,
        onImport: () => importRef.current.click(),
        onSettings: () => setSettingsOpen(true),
      }}
    >
      {settingsOpen && (
        <SettingsModal
          plantCount={plants.length}
          onClose={() => setSettingsOpen(false)}
          onClearData={() => { setPlants([]); setPanel(null) }}
        />
      )}
      <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:'none' }} />

      <AppRoutes
        plants={plants}
        today={today}
        openAdd={openAdd}
        detailCallbacks={detailCallbacks}
      />

      {/* ── Modals ── */}
      {panel?.mode === 'identity' && (
        <Modal
          onClose={() => setPanel(null)}
          variant={panel.form.id ? 'default' : 'wide'}
        >
          {panel.form.id ? (
            <PlantForm
              form={panel.form}
              onChange={updater => setPanel(p => ({ ...p, form: typeof updater === 'function' ? updater(p.form) : updater }))}
              onSave={savePlantIdentity}
              onCancel={() => setPanel(null)}
              onDelete={() => { deletePlant(panel.form.id); setPanel(null) }}
              isEdit
              plant={plants.find(p => p.id === panel.form.id)}
              onEditLog={(bundle) => {
                const p = plants.find(p => p.id === panel.form.id)
                if (p) openEditLog(p, bundle)
              }}
            />
          ) : (
            <AddPlantModal
              form={panel.form}
              onChange={updater => setPanel(p => ({ ...p, form: typeof updater === 'function' ? updater(p.form) : updater }))}
              onSave={savePlantIdentity}
              onCancel={() => setPanel(null)}
            />
          )}
        </Modal>
      )}

      {panel?.mode === 'quickLog' && (
        <Modal onClose={() => setPanel(null)}>
          <QuickLogModal
            type={panel.quickType}
            plant={plants.find(p => p.id === panel.plantId)}
            onSave={saveQuickLog}
            onCancel={() => setPanel(null)}
          />
        </Modal>
      )}

      {panel?.mode === 'log' && (
        <Modal onClose={() => setPanel(null)}>
          <LogEntryForm
            plant={plants.find(p => p.id === panel.plantId)}
            form={panel.form}
            isEdit={!!panel.editBundleId}
            onChange={updater => setPanel(p => ({ ...p, form: typeof updater === 'function' ? updater(p.form) : updater }))}
            onSave={saveLogEntry}
            onCancel={() => setPanel(null)}
            onDelete={panel.editBundleId ? deleteLogBundle : undefined}
          />
        </Modal>
      )}
    </AppLayout>
  )
}
