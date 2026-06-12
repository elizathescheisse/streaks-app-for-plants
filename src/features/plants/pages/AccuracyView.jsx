import { useMemo, useState } from 'react'
import styles from './AccuracyView.module.css'
import { lookupPlant } from '../../../utils/plantLookup.js'
import { getResidualHistory } from '../../../utils/plantModel.js'
import PlantIcon, { hasIcon } from '../components/plantIcons/PlantIcon.jsx'
import { currentHealth } from '../../../utils/plantSelectors.js'

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function waterLabel(amount, unit) {
  if (amount == null) return '—'
  if (unit === 'liters') return `${amount} L`
  const n = Number(amount)
  return `${amount} cup${n === 1 ? '' : 's'}`
}

// Build the per-plant report card data from its residual history.
function summarize(history) {
  const decay = history.filter(e => e.kind === 'decay' && e.residual != null)
  if (decay.length === 0) {
    return { level: 'learning', text: 'Not enough clean data yet — keep logging readings.' }
  }
  const meanAbs = decay.reduce((s, e) => s + Math.abs(e.residual), 0) / decay.length
  const bias    = decay.reduce((s, e) => s + e.residual, 0) / decay.length

  if (meanAbs <= 1) {
    return { level: 'good', text: `Usually within ±1 of reality — looking good (${decay.length} checks).` }
  }
  if (bias > 0.8) {
    return { level: 'off', text: `Predicts ~${bias.toFixed(1)} too dry on average (${decay.length} checks).` }
  }
  if (bias < -0.8) {
    return { level: 'off', text: `Predicts ~${Math.abs(bias).toFixed(1)} too wet on average (${decay.length} checks).` }
  }
  return { level: 'off', text: `Off by ~${meanAbs.toFixed(1)} on average (${decay.length} checks).` }
}

// Classify a residual magnitude for the colored chip.
function residualClass(residual) {
  const a = Math.abs(residual)
  if (a <= 1) return styles.chipGood
  if (a <= 2) return styles.chipWarn
  return styles.chipBad
}

function waterVerdict(given, recommended) {
  if (given == null || recommended == null) return null
  const diff = given - recommended
  if (diff > 0.5)  return { label: 'more than suggested', cls: styles.chipWarn }
  if (diff < -0.5) return { label: 'less than suggested', cls: styles.chipWarn }
  return { label: 'about right', cls: styles.chipGood }
}

function PlantReport({ plant }) {
  const [open, setOpen] = useState(false)
  const careProfile = lookupPlant(plant.species)
  const health = currentHealth(plant)
  const history = useMemo(() => getResidualHistory(plant, careProfile), [plant, careProfile])
  const summary = summarize(history)
  const recent = [...history].reverse()  // newest first

  const { emoji = '🌿', species, name } = plant

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={styles.cardHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={`${styles.icon} ${hasIcon(species) ? styles.iconArt : ''}`}>
          {hasIcon(species)
            ? <PlantIcon species={species} health={health} ariaLabel={`${name || species}`} />
            : emoji}
        </span>
        <div className={styles.headerText}>
          <span className={styles.name}>{name || titleCase(species)}</span>
          <span className={`${styles.summary} ${styles[`summary_${summary.level}`]}`}>{summary.text}</span>
        </div>
        {history.length > 0 && (
          <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden="true">▾</span>
        )}
      </button>

      {open && history.length > 0 && (
        <ul className={styles.entries}>
          {recent.map((e, i) => (
            <li key={`${e.timestamp}-${i}`} className={styles.entry}>
              <span className={styles.entryDate}>{fmtDate(e.timestamp)}</span>
              {e.kind === 'decay' ? (
                <>
                  <span className={styles.entryBody}>
                    predicted <strong>{e.predicted}</strong> → measured <strong>{e.actual}</strong>
                  </span>
                  {e.residual != null && (
                    <span className={`${styles.chip} ${residualClass(e.residual)}`}>
                      {e.residual > 0 ? '+' : ''}{e.residual}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className={styles.entryBody}>
                    💧 gave <strong>{waterLabel(e.givenWater, e.unit)}</strong>
                    {e.recommendedWater != null && <> · suggested {waterLabel(e.recommendedWater, e.unit)}</>}
                  </span>
                  {(() => {
                    const v = waterVerdict(e.givenWater, e.recommendedWater)
                    return v ? <span className={`${styles.chip} ${v.cls}`}>{v.label}</span> : null
                  })()}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// The "Accuracy" tab — a garden-wide model report card. Buried last in the home
// tab bar; most users never open it. For data-curious users it answers "how
// good are the predictions, really?" by replaying the model over each plant's
// own history (see getResidualHistory).
export default function AccuracyView({ plants }) {
  const tracked = plants.filter(p => (p.events ?? []).some(e => e.type === 'reading'))

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Prediction accuracy</h1>
          <p className={styles.subtitle}>
            How closely each plant’s past predictions matched what you actually measured.
            Replayed from your logs — the model never sees the reading it’s being graded on.
          </p>
        </header>

        {tracked.length === 0 ? (
          <p className={styles.empty}>
            No readings logged yet. Once you’ve taken a couple of moisture readings,
            this tab will show how well the predictions are tracking.
          </p>
        ) : (
          <div className={styles.list}>
            {tracked.map(p => <PlantReport key={p.id} plant={p} />)}
          </div>
        )}
      </div>
    </main>
  )
}
