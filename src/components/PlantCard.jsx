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


export default function PlantCard({ plant, onEdit, onLog, onQuickWater, onQuickReading, onEditLog, expanded, onExpand }) {
  const { emoji = '🌿', species, name } = plant

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
      <div className={`${styles.card} ${styles[health]} ${status ? styles[`cardStatus_${status.cls}`] : ''}`}>
        <div className={styles.iconCircle}>{emoji}</div>

        <div className={styles.cardInner}>

          {/* ── Left column ── */}
          <div className={styles.cardLeft}>

            {/* Name + health/species line + badge */}
            <div className={styles.top}>
              <button className={styles.nameBtn} onClick={onEdit} type="button">
                {name || titleCase(species)}<span className={styles.nameBtnChevron}>›</span>
              </button>
              <span className={styles.species}>
                {HEALTH_LABELS[health]}{name && species ? ` · ${titleCase(species)}` : ''}
              </span>
              {status && (
                <span className={`${styles.badge} ${styles[`badge_${status.cls}`]} ${styles.badgeInline}`}>
                  {status.icon && <FontAwesomeIcon icon={status.icon} className={styles.badgeIcon} />}
                  {status.label}
                </span>
              )}
            </div>

            {/* Mobile: last water + reading stats */}
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

            {/* Mobile: moisture bar */}
            {hasStats && badgeMoisture != null && (
              <div className={styles.mobileBar}>
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} careProfile={careProfile} isPredicted={usePredicted} />
              </div>
            )}

            {/* Mobile: prediction */}
            {reading && (
              <div className={styles.predMobile}>
                <PlantPrediction plant={plant} careProfile={careProfile} />
              </div>
            )}

            {/* ── Actions row ── */}
            <div className={styles.actions}>
              <div className={styles.actionsLeft}>
                <button
                  className={`${styles.historyBtn} ${expanded ? styles.historyBtnActive : ''}`}
                  onClick={onExpand}
                  type="button"
                  title="Toggle timeline"
                >
                  {expanded ? '▲' : '▼'} Timeline
                </button>
                <button className={`${styles.logBtn} ${styles.logBtnMobile}`} onClick={onLog} title="Log entry">+ Log</button>
              </div>
              <div className={styles.quickLogBtns}>
                <button className={`${styles.quickLogBtn} ${styles.quickLogBtnIcon}`} onClick={onQuickWater}   title="Log watering">💧</button>
                <button className={`${styles.quickLogBtn} ${styles.quickLogBtnIcon}`} onClick={onQuickReading} title="Log reading">◎</button>
              </div>
            </div>
          </div>

          {/* ── Right column: stats block (desktop only) ── */}
          <div className={styles.statsBlock}>
            {status && (
              <span className={`${styles.badge} ${styles[`badge_${status.cls}`]}`}>
                {status.icon && <FontAwesomeIcon icon={status.icon} className={styles.badgeIcon} />}
                {status.label}
              </span>
            )}
            {hasStats && badgeMoisture != null && (
              <div className={styles.statsBar}>
                <MoistureBar value={badgeMoisture} range={careProfile.moistureRange} careProfile={careProfile} isPredicted={usePredicted} />
              </div>
            )}
            {reading && (
              <div className={styles.predDesktop}>
                <PlantPrediction plant={plant} careProfile={careProfile} />
              </div>
            )}
            <button className={`${styles.logBtn} ${styles.logBtnDesktop}`} onClick={onLog} title="Log entry">
              + Log
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded section: timeline chart + history ── */}
      {expanded && (
        <div className={styles.historySection}>

          {/* Chart — fixed 1M window */}
          {readings.length >= 2 && (
            <div className={styles.chartExpanded}>
              <PlantHistoryChart
                readings={readings}
                waterings={waterings}
                careProfile={careProfile}
                window="1M"
                predictedMoisture={usePredicted ? rec.predicted : null}
              />
            </div>
          )}

          {/* Log bundles */}
          {bundles.length === 0 ? (
            <p className={styles.emptyHistory}>No log entries yet — tap "💧 Water" or "◎ Reading" to start.</p>
          ) : bundles.map((bundle, i) => {
            const ts = bundle[0].timestamp
            const readingEv  = bundle.find(e => e.type === 'reading')
            const wateringEv = bundle.find(e => e.type === 'watering')
            const healthEv   = bundle.find(e => e.type === 'health_change')
            const note       = bundle.find(e => e.type === 'note')
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
                  {readingEv  && <span className={styles.moisture}>◎ {readingEv.moisture} / 10</span>}
                  {wateringEv && <span className={styles.water}>💧 {waterLabel(wateringEv.unit, wateringEv.amount)}</span>}
                  {healthEv && (
                    <span className={`${styles.badge} ${styles[`badge_${healthEv.health}`]}`}>
                      {HEALTH_LABELS[healthEv.health]}
                    </span>
                  )}
                </div>
                {careProfile?.moistureRange && readingEv && (
                  <div className={styles.logBar}>
                    <MoistureBar value={Number(readingEv.moisture)} range={careProfile.moistureRange} careProfile={careProfile} />
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
