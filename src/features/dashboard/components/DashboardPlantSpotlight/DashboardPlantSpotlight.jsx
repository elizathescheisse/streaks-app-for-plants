import { useNavigate } from 'react-router-dom'
import {
  currentHealth,
  lastReading,
  logBundles,
} from '../../../../utils/plantSelectors.js'
import {
  getCareNote,
  getHealthLabel,
  getPlantSpotlightSummary,
} from '../../../../utils/dashboardCare.js'
import SectionPanel from '../SectionPanel'
import styles from './DashboardPlantSpotlight.module.css'

const CHIP_CLASS = {
  thriving: styles.chipThriving,
  good: styles.chipThriving,
  okay: styles.chipOkay,
  struggling: styles.chipStruggling,
}

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export default function DashboardPlantSpotlight({
  title,
  plant,
  variant,
  onWater,
  onReading,
  onLog,
  emptyIcon = '🌱',
  emptyTitle,
  emptyText,
}) {
  const navigate = useNavigate()

  if (!plant) {
    return (
      <SectionPanel title={title}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">{emptyIcon}</span>
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyText}>{emptyText}</p>
        </div>
      </SectionPanel>
    )
  }

  const { emoji = '🌿', species, name } = plant
  const health = currentHealth(plant)
  const summary = getPlantSpotlightSummary(plant)
  const careNote = getCareNote(plant)
  const hasLogs = logBundles(plant).length > 0
  const highlightReading = variant === 'attention' && !lastReading(plant)

  return (
    <SectionPanel title={title}>
      <div className={styles.spotlight}>
        <div className={styles.avatar} aria-hidden="true">{emoji}</div>
        <div className={styles.info}>
          <p className={styles.nickname}>{name || titleCase(species)}</p>
          {name && species && (
            <p className={styles.species}>{titleCase(species)}</p>
          )}
          <div className={styles.metaRow}>
            <span className={`${styles.chip} ${CHIP_CLASS[health] ?? ''}`}>
              {getHealthLabel(health)}
            </span>
          </div>
          <div className={styles.statusBlock}>
            <p className={styles.statusPrimary}>{summary.primary}</p>
            {(summary.secondary || careNote) && (
              <p className={styles.statusSecondary}>
                {summary.secondary || careNote}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onWater}
          aria-label={`Log watering for ${name || species}`}
        >
          <span className={styles.btnIcon} aria-hidden="true">💧</span>
          Water
        </button>
        <button
          type="button"
          className={`${styles.btnSecondary} ${highlightReading ? styles.btnHighlight : ''}`}
          onClick={onReading}
          aria-label={`Log moisture reading for ${name || species}`}
        >
          <span className={styles.btnIcon} aria-hidden="true">◎</span>
          Reading
        </button>
        {variant === 'attention' ? (
          <button
            type="button"
            className={styles.btnLog}
            onClick={onLog}
            aria-label={`Log entry for ${name || species}`}
          >
            + Log
          </button>
        ) : (
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => navigate(`/plant/${plant.id}`)}
            aria-label={`View details for ${name || species}`}
          >
            Details
          </button>
        )}
      </div>

      {!hasLogs && variant === 'attention' && (
        <p className={styles.footerNote}>Start logging to unlock moisture insights.</p>
      )}
    </SectionPanel>
  )
}
