import { useState } from 'react'
import styles from './PlantCard.module.css'
import MoistureBar from './MoistureBar.jsx'
import PlantHistoryChart from './PlantHistoryChart.jsx'
import { lookupPlant } from '../utils/plantLookup.js'

const HEALTH_LABELS = { thriving:'Thriving', good:'Good', okay:'Okay', struggling:'Struggling' }

const LIGHT_LABELS = {
  'direct':         '☀️ Direct sun',
  'bright-indirect':'🌤 Bright indirect',
  'low-indirect':   '🌥 Low indirect',
  'low':            '🌑 Low light',
}
const HUMIDITY_LABELS = {
  'high':   '💧 High humidity',
  'medium': '🌢 Medium humidity',
  'low':    '🏜 Low humidity',
}
const WATERING_STYLE_LABELS = {
  'flood-and-dry': '🌊 Flood & dry out',
  'consistent':    '🪣 Consistent moisture',
}

function waterLabel(unit, amount) {
  if (!amount) return '—'
  if (unit === 'cups')   return `${amount} cup${amount === '1' ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}

function formatLogDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function PlantCard({ plant, onEdit, onDelete }) {
  const { name, species, emoji = '🌿', waterUnit, waterAmount, moisture, health, notes, logs = [] } = plant
  const [historyOpen, setHistoryOpen] = useState(false)
  const [infoOpen, setInfoOpen]       = useState(false)

  const careProfile = lookupPlant(species)
  const hasStats    = !!careProfile?.moistureRange
  const reversedLogs = [...logs].reverse()

  return (
    <div className={styles.cardWrap}>
      <div className={`${styles.card} ${styles[health]}`}>
        <div className={styles.iconCircle}>{emoji}</div>

        <div className={styles.cardInner}>

          {/* ── Left column ── */}
          <div className={styles.cardLeft}>

            {/* Name / species / badge */}
            <div className={styles.top}>
              <span className={styles.name}>{name || species}</span>
              {name && species && <span className={styles.species}>{species}</span>}
              <span className={`${styles.badge} ${styles[`badge_${health}`]}`}>
                {HEALTH_LABELS[health]}
              </span>
            </div>

            {/* Water + moisture row:
                - always visible when there's no care profile (no right column)
                - on mobile only when there IS a right column (hidden on wide via CSS) */}
            <div className={`${styles.meta} ${hasStats ? styles.metaMobileOnly : ''}`}>
              <span className={styles.water}>💧 {waterLabel(waterUnit, waterAmount)}</span>
              <span className={styles.moisture}>◎ {moisture} / 10 moisture</span>
            </div>

            {/* Mobile-only bar when care profile exists */}
            {hasStats && (
              <div className={styles.mobileBar}>
                <MoistureBar value={Number(moisture)} range={careProfile.moistureRange} />
              </div>
            )}

            {/* History chart — inline, above notes */}
            {logs.length >= 2 && (
              <div className={styles.chartInline}>
                <PlantHistoryChart logs={logs} careProfile={careProfile} />
              </div>
            )}

            {notes && <p className={styles.notes}>{notes}</p>}

            <div className={styles.actions}>
              {careProfile && (
                <button
                  className={`${styles.historyBtn} ${infoOpen ? styles.historyBtnActive : ''}`}
                  onClick={() => { setInfoOpen(o => !o); setHistoryOpen(false) }}
                  title="Plant care info"
                >{infoOpen ? '▲' : '▼'} Info</button>
              )}
              <button
                className={`${styles.historyBtn} ${historyOpen ? styles.historyBtnActive : ''}`}
                onClick={() => { setHistoryOpen(o => !o); setInfoOpen(false) }}
                title="View care history"
              >{historyOpen ? '▲' : '▼'} Log ({logs.length})</button>
              <button className={styles.editBtn} onClick={onEdit}>Edit</button>
              <button className={styles.deleteBtn} onClick={onDelete} title="Remove plant">×</button>
            </div>
          </div>

          {/* ── Right column: stats block (wide screens only, only when care profile) ── */}
          {hasStats && (
            <div className={styles.statsBlock}>
              <span className={styles.statWater}>💧 {waterLabel(waterUnit, waterAmount)}</span>
              <span className={styles.statMoisture}>◎ {moisture} / 10</span>
              <div className={styles.statsBar}>
                <MoistureBar value={Number(moisture)} range={careProfile.moistureRange} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Info panel ── */}
      {infoOpen && careProfile && (
        <div className={styles.historySection}>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>{WATERING_STYLE_LABELS[careProfile.wateringStyle]}</span>
              <p className={styles.infoNote}>{careProfile.wateringNote}</p>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>{LIGHT_LABELS[careProfile.light]}</span>
              <p className={styles.infoNote}>{careProfile.lightNote}</p>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>{HUMIDITY_LABELS[careProfile.humidity]}</span>
              <p className={styles.infoNote}>{careProfile.humidityNote}</p>
            </div>
          </div>
          {careProfile.tips?.length > 0 && (
            <div className={styles.tipsSection}>
              <p className={styles.tipsLabel}>TIPS</p>
              <ul className={styles.tipsList}>
                {careProfile.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Log history panel ── */}
      {historyOpen && (
        <div className={styles.historySection}>
          {reversedLogs.length === 0 ? (
            <p className={styles.emptyHistory}>No log entries yet — save care data to start tracking.</p>
          ) : reversedLogs.map((entry, i) => (
            <div key={entry.id} className={`${styles.logEntry} ${i < reversedLogs.length - 1 ? styles.logEntryDivider : ''}`}>
              <div className={styles.logTop}>
                <span className={styles.logDate}>{formatLogDate(entry.date)}</span>
                <span className={`${styles.badge} ${styles[`badge_${entry.health}`]}`}>
                  {HEALTH_LABELS[entry.health]}
                </span>
              </div>
              <div className={styles.logMeta}>
                <span className={styles.water}>💧 {waterLabel(entry.waterUnit, entry.waterAmount)}</span>
                <span className={styles.moisture}>◎ {entry.moisture} / 10</span>
              </div>
              {careProfile?.moistureRange && (
                <div className={styles.logBar}>
                  <MoistureBar value={Number(entry.moisture)} range={careProfile.moistureRange} />
                </div>
              )}
              {entry.notes && <p className={styles.logNotes}>{entry.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
