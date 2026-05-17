import { useState } from 'react'
import styles from './PlantCard.module.css'
import MoistureBar from './MoistureBar.jsx'
import PlantHistoryChart from './PlantHistoryChart.jsx'
import { lookupPlant } from '../utils/plantLookup.js'
import { lastReading, lastWatering, currentHealth, logBundles, chartEvents } from '../utils/plantSelectors.js'

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

function formatTime(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function relTime(ts) {
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function PlantCard({ plant, onEdit, onDelete, onLog }) {
  const { emoji = '🌿', species, name } = plant
  const [historyOpen, setHistoryOpen] = useState(false)
  const [infoOpen, setInfoOpen]       = useState(false)

  const careProfile = lookupPlant(species)
  const hasStats    = !!careProfile?.moistureRange
  const bundles     = logBundles(plant)
  const reading     = lastReading(plant)
  const watering    = lastWatering(plant)
  const health      = currentHealth(plant)
  const { readings, waterings } = chartEvents(plant)

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

            {/* Current state row — only shown if there's any data, mobile when stats block present */}
            {(reading || watering) && (
              <div className={`${styles.meta} ${hasStats ? styles.metaMobileOnly : ''}`}>
                {watering && (
                  <span className={styles.water}>
                    💧 {waterLabel(watering.unit, watering.amount)} · {relTime(watering.timestamp)}
                  </span>
                )}
                {reading && (
                  <span className={styles.moisture}>
                    ◎ {reading.moisture} / 10 · {relTime(reading.timestamp)}
                  </span>
                )}
              </div>
            )}

            {/* Mobile-only moisture bar */}
            {hasStats && reading && (
              <div className={styles.mobileBar}>
                <MoistureBar value={Number(reading.moisture)} range={careProfile.moistureRange} />
              </div>
            )}

            {/* History chart — inline above actions, only if ≥2 readings */}
            {readings.length >= 2 && (
              <div className={styles.chartInline}>
                <PlantHistoryChart readings={readings} waterings={waterings} careProfile={careProfile} />
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.logBtn} onClick={onLog} title="Log entry">
                + Log
              </button>
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
                title="View history"
              >{historyOpen ? '▲' : '▼'} History ({bundles.length})</button>
              <button className={styles.editBtn} onClick={onEdit}>Edit</button>
              <button className={styles.deleteBtn} onClick={onDelete} title="Remove plant">×</button>
            </div>
          </div>

          {/* ── Right column: stats block ── */}
          {hasStats && reading && (
            <div className={styles.statsBlock}>
              {watering && (
                <span className={styles.statWater}>💧 {waterLabel(watering.unit, watering.amount)}</span>
              )}
              <span className={styles.statMoisture}>◎ {reading.moisture} / 10</span>
              <div className={styles.statsBar}>
                <MoistureBar value={Number(reading.moisture)} range={careProfile.moistureRange} />
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

      {/* ── History panel: log bundles ── */}
      {historyOpen && (
        <div className={styles.historySection}>
          {bundles.length === 0 ? (
            <p className={styles.emptyHistory}>No log entries yet — tap "+ Log" to record care data.</p>
          ) : bundles.map((bundle, i) => {
            const ts = bundle[0].timestamp
            const reading  = bundle.find(e => e.type === 'reading')
            const watering = bundle.find(e => e.type === 'watering')
            const healthEv = bundle.find(e => e.type === 'health_change')
            const note     = bundle.find(e => e.type === 'note')
            return (
              <div key={bundle[0].bundleId} className={`${styles.logEntry} ${i < bundles.length - 1 ? styles.logEntryDivider : ''}`}>
                <div className={styles.logTop}>
                  <span className={styles.logDate}>{formatTime(ts)}</span>
                </div>
                <div className={styles.logMeta}>
                  {reading && <span className={styles.moisture}>◎ {reading.moisture} / 10</span>}
                  {watering && <span className={styles.water}>💧 {waterLabel(watering.unit, watering.amount)}</span>}
                  {healthEv && (
                    <span className={`${styles.badge} ${styles[`badge_${healthEv.health}`]}`}>
                      {HEALTH_LABELS[healthEv.health]}
                    </span>
                  )}
                </div>
                {careProfile?.moistureRange && reading && (
                  <div className={styles.logBar}>
                    <MoistureBar value={Number(reading.moisture)} range={careProfile.moistureRange} />
                  </div>
                )}
                {note && <p className={styles.logNotes}>{note.text}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
