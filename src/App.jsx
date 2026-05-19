import { useState, useRef, useEffect } from 'react'
import Header from './components/Header.jsx'
import PlantCard from './components/PlantCard.jsx'
import PlantForm, { EMPTY_PLANT_FORM } from './components/PlantForm.jsx'
import LogEntryForm, { createEmptyLogForm } from './components/LogEntryForm.jsx'
import EdgeGlow from './components/EdgeGlow.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Modal from './components/Modal.jsx'
import styles from './App.module.css'
import { buildEventsFromForm } from './utils/plantSelectors.js'

const SCHEMA_VERSION = '2'
const STORAGE_KEY    = 'plant-streaks'
const SCHEMA_KEY     = 'plant-streaks-schema'

const today = new Date()
const DATE_KEY = today.toISOString().slice(0, 10)

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
function formatDay(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })
}

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

export default function App() {
  const [plants, setPlants] = useState(loadInitialPlants)

  // panel:
  //   null                                   — no panel
  //   { mode: 'identity', form }             — add/edit plant form
  //   { mode: 'log', plantId, form }         — log-entry form
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
      setPlants(ps => ps.map(p => p.id === form.id
        ? { ...p, emoji: form.emoji, species: form.species, name: form.name }
        : p
      ))
    } else {
      setPlants(ps => [...ps, {
        id: crypto.randomUUID(),
        emoji:   form.emoji,
        species: form.species,
        name:    form.name,
        events:  [],
      }])
    }
    setPanel(null)
  }

  function openAdd() {
    setPanel({ mode: 'identity', form: EMPTY_PLANT_FORM })
  }

  function editPlant(plant) {
    setPanel({
      mode: 'identity',
      form: { id: plant.id, emoji: plant.emoji, species: plant.species, name: plant.name }
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

  return (
    <div className={styles.app}>
      <EdgeGlow />

      <Header
        onExport={exportJSON}
        onImport={() => importRef.current.click()}
        onSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsModal
          plantCount={plants.length}
          onClose={() => setSettingsOpen(false)}
          onClearData={() => { setPlants([]); setPanel(null) }}
        />
      )}
      <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:'none' }} />

      <main className={styles.main}>
        <section className={styles.listCol}>
          <div className={styles.dateBlock}>
            <div className={styles.dateRow}>
              <div>
                <h1 className={styles.bigDate}>{formatDate(today)}</h1>
                <p className={styles.subDate}>{formatDay(today)}</p>
              </div>
              {plants.length > 0 && (
                <button className={styles.addBtn} onClick={openAdd}>
                  + Add Plant
                </button>
              )}
            </div>
            <p className={styles.hint}>Log your plants' health and watering for today.</p>
          </div>

          <div className={styles.plantList}>
            {plants.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🌱</div>
                <p className={styles.emptyTitle}>No plants yet</p>
                <button className={styles.emptyAddBtn} onClick={openAdd}>
                  + Add your first plant
                </button>
              </div>
            ) : plants.map(p => (
              <PlantCard
                key={p.id}
                plant={p}
                onEdit={() => editPlant(p)}
                onLog={() => openLog(p)}
                onEditLog={(bundle) => openEditLog(p, bundle)}
              />
            ))}
          </div>
        </section>
      </main>

      {/* ── Modals ── */}
      {panel?.mode === 'identity' && (
        <Modal onClose={() => setPanel(null)}>
          <PlantForm
            form={panel.form}
            onChange={updater => setPanel(p => ({ ...p, form: typeof updater === 'function' ? updater(p.form) : updater }))}
            onSave={savePlantIdentity}
            onCancel={() => setPanel(null)}
            onDelete={panel.form.id ? () => { deletePlant(panel.form.id); setPanel(null) } : undefined}
            isEdit={!!panel.form.id}
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
    </div>
  )
}
