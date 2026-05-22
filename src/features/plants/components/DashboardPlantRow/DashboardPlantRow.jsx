import { useNavigate } from 'react-router-dom'
import { lookupPlant } from '../../../../utils/plantLookup.js'
import {
  currentHealth,
  lastReading,
  lastWatering,
  logBundles,
} from '../../../../utils/plantSelectors.js'
import { getCareNote, getHealthLabel } from '../../../../utils/dashboardCare.js'
import styles from './DashboardPlantRow.module.css'

const HEALTH_CHIP_CLASS = {
  thriving: styles.chipThriving,
  good: styles.chipThriving,
  okay: styles.chipOkay,
  struggling: styles.chipStruggling,
}

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function relTime(ts) {
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function waterLabel(unit, amount) {
  if (!amount) return '—'
  const n = parseFloat(amount)
  if (unit === 'cups') return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}

function buildLogSummary(plant) {
  const bundles = logBundles(plant)
  if (!bundles.length) return { primary: 'No logs yet', secondary: null }

  const watering = lastWatering(plant)
  const reading = lastReading(plant)
  const parts = []

  if (watering) {
    parts.push(`Last watered ${relTime(watering.timestamp)} · ${waterLabel(watering.unit, watering.amount)}`)
  }
  if (reading) {
    parts.push(`Moisture ${reading.moisture}/10 · ${relTime(reading.timestamp)}`)
  }

  if (!parts.length) return { primary: 'No logs yet', secondary: null }
  return { primary: parts[0], secondary: parts[1] ?? null }
}

export default function DashboardPlantRow({
  plant,
  emphasize = false,
  careNote: careNoteProp,
  onWater,
  onReading,
  onLog,
}) {
  const navigate = useNavigate()
  const { emoji = '🌿', species, name } = plant
  const health = currentHealth(plant)
  const careNote = careNoteProp ?? getCareNote(plant)
  const summary = buildLogSummary(plant)
  const careProfile = lookupPlant(species)
  const hasRange = !!careProfile?.moistureRange

  return (
    <article
      className={`${styles.row} ${emphasize ? styles.rowEmphasis : ''}`}
      data-health={health}
    >
      <div className={styles.left}>
        <div className={styles.avatar} aria-hidden="true">{emoji}</div>
        <div className={styles.identity}>
          <button
            type="button"
            className={styles.nameBtn}
            onClick={() => navigate(`/plant/${plant.id}`)}
          >
            {name || titleCase(species)}
          </button>
          {name && species && (
            <span className={styles.species}>{titleCase(species)}</span>
          )}
          <span className={`${styles.healthChip} ${HEALTH_CHIP_CLASS[health] ?? ''}`}>
            {getHealthLabel(health)}
          </span>
          {careNote && (
            <p className={styles.careNote}>{careNote}</p>
          )}
        </div>
      </div>

      <div className={styles.middle}>
        <p className={summary.primary === 'No logs yet' ? styles.muted : styles.summaryLine}>
          {summary.primary}
        </p>
        {summary.secondary && (
          <p className={styles.summarySecondary}>{summary.secondary}</p>
        )}
        {!hasRange && species && (
          <p className={styles.muted}>Species not in database — log freely</p>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionSecondary}
          onClick={onWater}
          aria-label={`Log watering for ${name || species}`}
        >
          💧 Water
        </button>
        <button
          type="button"
          className={`${emphasize && !lastReading(plant) ? styles.actionPrimary : styles.actionSecondary}`}
          onClick={onReading}
          aria-label={`Log moisture reading for ${name || species}`}
        >
          ◎ Reading
        </button>
        <button
          type="button"
          className={styles.actionSecondary}
          onClick={onLog}
          aria-label={`Log entry for ${name || species}`}
        >
          + Log
        </button>
        <button
          type="button"
          className={styles.actionGhost}
          onClick={() => navigate(`/plant/${plant.id}`)}
          aria-label={`View ${name || species} details`}
        >
          Details
        </button>
      </div>
    </article>
  )
}
