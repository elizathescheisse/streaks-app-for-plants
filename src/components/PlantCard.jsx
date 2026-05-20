import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock } from '@fortawesome/free-solid-svg-icons'
import styles from './PlantCard.module.css'
import MoistureBar from './MoistureBar.jsx'
import PlantHistoryChart from './PlantHistoryChart.jsx'
import { lookupPlant } from '../utils/plantLookup.js'
import { lastReading, lastWatering, currentHealth, logBundles, chartEvents } from '../utils/plantSelectors.js'
import { computeModel, getRecommendation } from '../utils/plantModel.js'
import { moistureStatus } from '../utils/plantStatus.js'
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


export default function PlantCard({ plant, onEdit, onLog, onQuickWater, onQuickReading, onEditLog, cardView = 'chart' }) {
  const { emoji = '🌿', species, name } = plant
  const [historyOpen, setHistoryOpen] = useState(false)
  const isCompact = cardView === 'compact'

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
  const model      = reading && !wateredAfterReading ? computeModel(plant, careProfile) : null
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
    ? moistureStatus(badgeMoisture, careProfile, rec?.waterNeeded, rec?.dominantUnit)
    : null

  return (
    <div className={styles.cardWrap}>
      <div className={`${styles.card} ${styles[health]} ${isCompact && status ? styles[`cardStatus_${status.cls}`] : ''}`}>
        <div className={styles.iconCircle}>{emoji}</div>

        <div className={styles.cardInner}>

          {/* ── Left column ── */}
          <div className={styles.cardLeft}>

            {/* Name + health-prefixed species line */}
            <div className={styles.top}>
              <button className={styles.nameBtn} onClick={onEdit} type="button">
                {name || titleCase(species)}<span className={styles.nameBtnChevron}>›</span>
              </button>
              {!isCompact && (
                <span className={styles.species}>
                  {HEALTH_LABELS[health]}{name && species ? ` · ${titleCase(species)}` : ''}
                </span>
              )}
              {/* In compact mode the badge lives here (top-right), in chart mode it's in statsBlock */}
              {isCompact && status && (
                <span className={`${styles.badge} ${styles[`badge_${status.cls}`]} ${styles.badgeInline}`}>
                  {status.icon && <FontAwesomeIcon icon={status.icon} className={styles.badgeIcon} />}
                  {status.label}
                </span>
              )}
            </div>

            {/* ── CHART MODE only: mobile stat rows + chart + prediction-mobile ── */}
            {!isCompact && (reading || watering) && (
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

            {!isCompact && hasStats && badgeMoisture != null && (
              <div className={styles.mobileBar}>
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} careProfile={careProfile} isPredicted={usePredicted} />
              </div>
            )}

            {!isCompact && readings.length >= 2 && (
              <div className={styles.chartInline}>
                <PlantHistoryChart
                  readings={readings}
                  waterings={waterings}
                  careProfile={careProfile}

                  predictedMoisture={usePredicted ? rec.predicted : null}
                />
              </div>
            )}

            {!isCompact && reading && (
              <div className={styles.predMobile}>
                <PlantPrediction plant={plant} careProfile={careProfile} />
              </div>
            )}

            {/* ── COMPACT MODE only: bar + prediction full-width ── */}
            {isCompact && hasStats && badgeMoisture != null && (
              <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} careProfile={careProfile} isPredicted={usePredicted} />
            )}

            {/* ── Actions row ── */}
            <div className={styles.actions}>
              <div className={styles.actionsLeft}>
                {!isCompact && (
                  <button
                    className={`${styles.historyBtn} ${historyOpen ? styles.historyBtnActive : ''}`}
                    onClick={() => setHistoryOpen(o => !o)}
                    title="View history"
                  >{historyOpen ? '▲' : '▼'} History ({bundles.length})</button>
                )}
              </div>
              {/* Compact: two quick-log buttons. Chart: single Log button (mobile only; desktop is in statsBlock) */}
              {isCompact ? (
                <div className={styles.quickLogBtns}>
                  <button className={styles.quickLogBtn} onClick={onQuickWater}   title="Log watering">💧 Water</button>
                  <button className={styles.quickLogBtn} onClick={onQuickReading} title="Log reading">◎ Reading</button>
                </div>
              ) : (
                <button
                  className={`${styles.logBtn} ${styles.logBtnMobile}`}
                  onClick={onLog}
                  title="Log entry"
                >+ Log</button>
              )}
            </div>
          </div>

          {/* ── Right column: stats block — chart mode only ── */}
          {!isCompact && (
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
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} careProfile={careProfile} isPredicted={usePredicted} />
              </div>
            )}

            {/* Prediction strip — desktop only (mobile version lives in cardLeft) */}
            {reading && (
              <div className={styles.predDesktop}>
                <PlantPrediction plant={plant} careProfile={careProfile} />
              </div>
            )}

            {/* Log button — right edge of card, under the badge/bar */}
            <button className={`${styles.logBtn} ${styles.logBtnDesktop}`} onClick={onLog} title="Log entry">
              + Log
            </button>
          </div>
          )}
        </div>
      </div>

      {/* ── History panel: log bundles ── */}
      {historyOpen && !isCompact && (
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
                    <MoistureBar value={Number(reading.moisture)} range={careProfile.moistureRange} careProfile={careProfile} />
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
