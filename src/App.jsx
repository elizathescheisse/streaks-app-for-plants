import { useState, useRef, useEffect } from 'react'
import Header from './components/Header.jsx'
import PlantCard from './components/PlantCard.jsx'
import PlantForm from './components/PlantForm.jsx'
import EdgeGlow from './components/EdgeGlow.jsx'
import styles from './App.module.css'

const today = new Date()
const DATE_KEY = today.toISOString().slice(0, 10)

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
function formatDay(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })
}

const EMPTY_FORM = {
  id: null,
  emoji: '🌿',
  species: '',
  name: '',
  waterUnit: 'freeform',
  waterAmount: '',
  moisture: 5,
  health: 'good',
  notes: '',
  logs: [],
}

export default function App() {
  const [plants, setPlants] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plant-streaks')) ?? [] }
    catch { return [] }
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [panelOpen, setPanelOpen] = useState(true)
  const importRef = useRef()

  // Persist plants to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('plant-streaks', JSON.stringify(plants))
  }, [plants])

  // ── CRUD ─────────────────────────────────────────────────
  function saveForm() {
    const canSave = form.species.trim() || form.name.trim()
    if (!canSave) return

    const CARE_FIELDS = ['waterUnit', 'waterAmount', 'moisture', 'health', 'notes']

    if (form.id) {
      // Editing existing plant — only add a log if care data changed
      setPlants(ps => ps.map(p => {
        if (p.id !== form.id) return p
        const lastLog = p.logs?.[p.logs.length - 1]
        const careChanged = !lastLog || CARE_FIELDS.some(k => String(form[k]) !== String(lastLog[k]))
        const newLogs = careChanged
          ? [...(p.logs ?? []), {
              id: crypto.randomUUID(),
              date: DATE_KEY,
              timestamp: new Date().toISOString(),
              waterUnit: form.waterUnit,
              waterAmount: form.waterAmount,
              moisture: form.moisture,
              health: form.health,
              notes: form.notes,
            }]
          : (p.logs ?? [])
        return { ...form, logs: newLogs }
      }))
    } else {
      // New plant always gets its first log entry
      setPlants(ps => [...ps, {
        ...form,
        id: crypto.randomUUID(),
        logs: [{
          id: crypto.randomUUID(),
          date: DATE_KEY,
          timestamp: new Date().toISOString(),
          waterUnit: form.waterUnit,
          waterAmount: form.waterAmount,
          moisture: form.moisture,
          health: form.health,
          notes: form.notes,
        }],
      }])
    }
    setForm(EMPTY_FORM)
    setPanelOpen(false)
  }

  function editPlant(plant) {
    setForm({ ...plant })
    setPanelOpen(true)
  }

  function deletePlant(id) {
    setPlants(ps => ps.filter(p => p.id !== id))
    if (form.id === id) { setForm(EMPTY_FORM); setPanelOpen(false) }
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setPanelOpen(true)
  }

  // ── Export ────────────────────────────────────────────────
  function exportJSON() {
    const data = { date: DATE_KEY, plants }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plant-streaks-${DATE_KEY}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ────────────────────────────────────────────────
  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!Array.isArray(data.plants)) return
        // Migrate old-format plants (no logs) by bootstrapping a log entry
        // from the plant's own data, dated to the export file's date if present.
        const fileDate = data.date ?? '2026-05-14'
        const migrated = data.plants.map(p => {
          if (Array.isArray(p.logs) && p.logs.length > 0) return p
          const entry = {
            id: crypto.randomUUID(),
            date: fileDate,
            timestamp: `${fileDate}T00:00:00.000Z`,
            waterUnit: p.waterUnit ?? 'freeform',
            waterAmount: p.waterAmount ?? '',
            moisture: p.moisture ?? 5,
            health: p.health ?? 'good',
            notes: p.notes ?? '',
          }
          return { ...p, logs: [entry] }
        })
        setPlants(migrated)
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
      />
      <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:'none' }} />

      <main className={styles.main}>
        {/* ── Left: plant list ── */}
        <section className={styles.listCol}>
          <div className={styles.dateBlock}>
            <h1 className={styles.bigDate}>{formatDate(today)}</h1>
            <p className={styles.subDate}>{formatDay(today)}</p>
            <p className={styles.hint}>Log your plants' health and watering for today.</p>
          </div>

          <div className={styles.plantList}>
            {plants.length === 0 && (
              <p className={styles.emptyMsg}>No plants yet — add your first one →</p>
            )}
            {plants.map(p => (
              <PlantCard
                key={p.id}
                plant={p}
                onEdit={() => editPlant(p)}
                onDelete={() => deletePlant(p.id)}
              />
            ))}
            <button className={styles.addGhost} onClick={openAdd}>
              + Add a plant
            </button>
          </div>
        </section>

        {/* ── Right: form panel ── */}
        <div className={styles.divider} />

        <section className={`${styles.formCol} ${panelOpen ? styles.formColOpen : ''}`}>
          <PlantForm
            form={form}
            onChange={setForm}
            onSave={saveForm}
            onCancel={() => { setForm(EMPTY_FORM); setPanelOpen(false) }}
            isEdit={!!form.id}
          />
        </section>
      </main>
    </div>
  )
}
