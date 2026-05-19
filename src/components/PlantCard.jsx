import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faPen } from '@fortawesome/free-solid-svg-icons'
import styles from './PlantCard.module.css'
import MoistureBar from './MoistureBar.jsx'
import PlantHistoryChart from './PlantHistoryChart.jsx'
import { lookupPlant } from '../utils/plantLookup.js'
import { lastReading, lastWatering, currentHealth, logBundles, chartEvents } from '../utils/plantSelectors.js'
import { computeModel, getRecommendation } from '../utils/plantModel.js'
import PlantPrediction from './PlantPrediction.jsx'

const HEALTH_LABELS = { thriving:'Thriving', good:'Healthy', okay:'Okay', struggling:'Struggling' }

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
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  })
}

function relTime(ts) {
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

// Capitalize the first letter of each word. Used so species names entered
// in lowercase ("fiddle leaf fig") render as "Fiddle Leaf Fig" — especially
// when they appear as the plant's display name (no nickname set).
function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

// Returns a badge label + which badge color to reuse, based on where the current
// moisture reading sits relative to the plant's ideal range. The badge is action-
// oriented ("what should I do about water right now?") — see designed-out cases:
//   • very dry          → struggling color, "Water immediately"
//   • below range       → okay color,       "Water"
//   • bottom of range   → good color,       "Water soon"
//   • in / just above   → thriving color,   "Watered"
//   • well above range  → okay color,       "Overwatered"
function moistureStatus(moisture, [min, max]) {
  const val = Number(moisture)
  const w   = max - min                                  // range width
  // Thresholds blend "proportional to range width" with an absolute floor of
  // 2 moisture points — otherwise narrow ranges (e.g. fiddle leaf fig 4–5)
  // trip the alarm states on tiny dips.
  const dryBuffer = Math.max(w * 0.75, 2)                // red kicks in this far below min
  const wetBuffer = Math.max(w * 0.5,  2)                // yellow over kicks in this far above max

  if (val < min - dryBuffer)  return { label: '🚨 Water immediately', cls: 'struggling' }
  if (val < min)               return { label: '💧 Water',             cls: 'okay'       }
  if (val < min + w * 0.3)    return { label: '💧 Water soon',        cls: 'good'       }
  if (val <= max + wetBuffer) return { label: '✓ Watered',             cls: 'thriving'   }
  return                              { label: '⚠️ Overwatered',       cls: 'okay'       }
}


export default function PlantCard({ plant, onEdit, onLog, onEditLog, chartWindow }) {
  const { emoji = '🌿', species, name } = plant
  const [historyOpen, setHistoryOpen] = useState(false)
  const [infoOpen, setInfoOpen]       = useState(false)

  const careProfile  = lookupPlant(species)
  const hasStats     = !!careProfile?.moistureRange
  const bundles      = logBundles(plant)
  const reading      = lastReading(plant)
  const watering     = lastWatering(plant)
  const health       = currentHealth(plant)
  const { readings, waterings } = chartEvents(plant)
  // If the plant was watered after the last reading, the moisture level
  // is unknown — don't show a stale "Water now" recommendation.
  const wateredAfterReading =
    watering && reading && new Date(watering.timestamp) > new Date(reading.timestamp)

  // Decide whether to show the model's predicted current moisture or the raw
  // last reading. Rules:
  //   • Always use integers (moisture meter readings are whole numbers).
  //   • Only switch to predicted when the model is confident (≥3 data points)
  //     AND the predicted value has drifted ≥1 whole unit from the raw reading.
  //   • Below that threshold the raw value is still accurate enough and the
  //     model output would just be noise.
  const model      = reading && !wateredAfterReading ? computeModel(plant) : null
  const rec        = model ? getRecommendation(plant, model, careProfile) : null
  const isConfident = rec && !rec.usingDefaults && rec.confidence !== 'low'
  const rawMoisture  = reading ? Math.round(Number(reading.moisture)) : null
  const predMoisture = isConfident ? Math.round(rec.predicted) : null
  const drift        = (rawMoisture != null && predMoisture != null)
    ? Math.abs(predMoisture - rawMoisture) : 0
  const usePredicted = isConfident && drift >= 1
  const badgeMoisture = usePredicted ? predMoisture : rawMoisture

  const status = wateredAfterReading
    ? (() => {
        const minsSince = (Date.now() - new Date(watering.timestamp)) / 60_000
        const minsLeft = Math.round(Math.max(0, 60 - minsSince))
        const label = minsLeft > 0 ? `Check in ${minsLeft}m` : 'Check now'
        return { label, cls: 'check', icon: faClock }
      })()
    : (hasStats && badgeMoisture != null)
    ? moistureStatus(badgeMoisture, careProfile.moistureRange)
    : null

  return (
    <div className={styles.cardWrap}>
      <div className={`${styles.card} ${styles[health]}`}>
        <div className={styles.iconCircle}>{emoji}</div>

        <div className={styles.cardInner}>

          {/* ── Left column ── */}
          <div className={styles.cardLeft}>

            {/* Name + health-prefixed species line + edit icon */}
            <div className={styles.top}>
              <span className={styles.name}>{name || titleCase(species)}</span>
              <button
                className={styles.editIconBtn}
                onClick={onEdit}
                title="Edit plant"
                type="button"
              >
                <FontAwesomeIcon icon={faPen} />
              </button>
              <span className={styles.species}>
                {HEALTH_LABELS[health]}{name && species ? ` · ${titleCase(species)}` : ''}
              </span>
            </div>

            {/* Current state row — mobile only; wide screens show this in the right stats block */}
            {(reading || watering) && (
              <div className={`${styles.meta} ${styles.metaMobileOnly}`}>
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

            {/* Mobile-only moisture bar (when species has a known ideal range) */}
            {hasStats && badgeMoisture != null && (
              <div className={styles.mobileBar}>
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} isPredicted={usePredicted} />
              </div>
            )}

            {/* History chart — inline, only if ≥2 readings */}
            {readings.length >= 2 && (
              <div className={styles.chartInline}>
                <PlantHistoryChart readings={readings} waterings={waterings} careProfile={careProfile} window={chartWindow} />
              </div>
            )}

            {/* Prediction + watering recommendation */}
            {reading && (
              <PlantPrediction plant={plant} careProfile={careProfile} />
            )}

            <div className={styles.actions}>
              <div className={styles.actionsLeft}>
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
              </div>
              {/* Mobile-only Log button — hidden on desktop where it lives in the stats block */}
              <button className={`${styles.logBtn} ${styles.logBtnMobile}`} onClick={onLog} title="Log entry">
                + Log
              </button>
            </div>
          </div>

          {/* ── Right column: stats block — always rendered so Log button shows on desktop ── */}
          <div className={styles.statsBlock}>

            {/* Watering action badge — reuses the health badge styling */}
            {status && (
              <span className={`${styles.badge} ${styles[`badge_${status.cls}`]}`}>
                {status.icon && <FontAwesomeIcon icon={status.icon} className={styles.badgeIcon} />}
                {status.label}
              </span>
            )}

            {/* Moisture bar — uses predicted moisture when drift is significant */}
            {hasStats && badgeMoisture != null && (
              <div className={styles.statsBar}>
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} isPredicted={usePredicted} />
              </div>
            )}

            {/* Log button — right edge of card, under the badge/bar */}
            <button className={`${styles.logBtn} ${styles.logBtnDesktop}`} onClick={onLog} title="Log entry">
              + Log
            </button>
          </div>
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
                  <span className={styles.logDate}>{fmtDate(ts)}</span>
                  <span className={styles.logTime}>{fmtTime(ts)}</span>
                  {onEditLog && (
                    <button
                      className={styles.logEditBtn}
                      onClick={() => onEditLog(bundle)}
                      type="button"
                    >Edit</button>
                  )}
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
