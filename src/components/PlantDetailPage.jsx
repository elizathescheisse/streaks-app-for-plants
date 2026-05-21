import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock } from '@fortawesome/free-solid-svg-icons'
import styles from './PlantDetailPage.module.css'
import MoistureBar from './MoistureBar.jsx'
import PlantHistoryChart from './PlantHistoryChart.jsx'
import PlantPrediction from './PlantPrediction.jsx'
import { lookupPlant } from '../utils/plantLookup.js'
import {
  lastReading, lastWatering, currentHealth, logBundles, chartEvents
} from '../utils/plantSelectors.js'
import { computeModel, getRecommendation } from '../utils/plantModel.js'
import { moistureStatus } from '../utils/plantStatus.js'

const HEALTH_LABELS = { thriving: 'Thriving', good: 'Healthy', okay: 'Okay', struggling: 'Struggling' }

const LIGHT_LABELS = {
  'direct':          '☀️ Direct sun',
  'bright-indirect': '🌤 Bright indirect',
  'low-indirect':    '🌥 Low indirect',
  'low':             '🌑 Low light',
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

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
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

const CHART_WINDOWS = ['1W', '1M', '3M', 'all']

export default function PlantDetailPage({
  plants, onEdit, onLog, onQuickWater, onQuickReading, onEditLog, onDelete
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chartWindow, setChartWindow] = useState('3M')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const plant = plants.find(p => p.id === id)

  if (!plant) {
    return (
      <div className={styles.notFound}>
        <p>Plant not found.</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← Back to plants</button>
      </div>
    )
  }

  const { emoji = '🌿', species, name } = plant
  const careProfile = lookupPlant(species)
  const hasStats    = !!careProfile?.moistureRange
  const bundles     = logBundles(plant)
  const reading     = lastReading(plant)
  const watering    = lastWatering(plant)
  const health      = currentHealth(plant)
  const { readings, waterings } = chartEvents(plant)

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

  function handleDelete() {
    onDelete(plant.id)
    navigate('/')
  }

  return (
    <div className={styles.page}>
      {/* ── Top nav ── */}
      <div className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/')} type="button">
          ← Plants
        </button>
        <button className={styles.editBtn} onClick={() => onEdit(plant)} type="button">
          Edit
        </button>
      </div>

      {/* ── Plant hero ── */}
      <div className={`${styles.hero} ${styles[health]}`}>
        <div className={styles.heroEmoji}>{emoji}</div>
        <div className={styles.heroText}>
          <h1 className={styles.heroName}>{name || titleCase(species)}</h1>
          {name && species && (
            <p className={styles.heroSpecies}>{titleCase(species)}</p>
          )}
          {status && (
            <span className={`${styles.badge} ${styles[`badge_${status.cls}`]}`}>
              {status.icon && <FontAwesomeIcon icon={status.icon} className={styles.badgeIcon} />}
              {status.label}
            </span>
          )}
        </div>
      </div>

      <div className={styles.content}>

        {/* ── Quick actions ── */}
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => onQuickWater(plant)}>
            💧 Water
          </button>
          <button className={styles.actionBtn} onClick={() => onQuickReading(plant)}>
            ◎ Reading
          </button>
          <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => onLog(plant)}>
            + Log
          </button>
        </div>

        {/* ── Current status ── */}
        {(reading || watering) && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Current status</h2>
            <div className={styles.statusGrid}>
              {reading && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Moisture</span>
                  <span className={styles.statValue}>
                    {badgeMoisture != null ? `${badgeMoisture} / 10` : '—'}
                    {usePredicted && <span className={styles.statPredTag}> est.</span>}
                  </span>
                  <span className={styles.statMeta}>{relTime(reading.timestamp)}</span>
                </div>
              )}
              {watering && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Last watered</span>
                  <span className={styles.statValue}>{waterLabel(watering.unit, watering.amount)}</span>
                  <span className={styles.statMeta}>{relTime(watering.timestamp)}</span>
                </div>
              )}
            </div>
            {hasStats && badgeMoisture != null && (
              <div className={styles.statusBar}>
                <MoistureBar
                  value={badgeMoisture}
                  range={careProfile.moistureRange}
                  careProfile={careProfile}
                  isPredicted={usePredicted}
                />
              </div>
            )}
            {reading && (
              <div className={styles.predictionBlock}>
                <PlantPrediction plant={plant} careProfile={careProfile} />
              </div>
            )}
          </section>
        )}

        {/* ── History chart ── */}
        {readings.length >= 2 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Moisture history</h2>
              <div className={styles.windowToggle}>
                {CHART_WINDOWS.map(key => (
                  <button
                    key={key}
                    className={`${styles.windowBtn} ${chartWindow === key ? styles.windowBtnActive : ''}`}
                    onClick={() => setChartWindow(key)}
                    type="button"
                  >{key === 'all' ? 'All' : key}</button>
                ))}
              </div>
            </div>
            <div className={styles.chartWrap}>
              <PlantHistoryChart
                readings={readings}
                waterings={waterings}
                careProfile={careProfile}
                window={chartWindow}
                predictedMoisture={usePredicted ? rec.predicted : null}
              />
            </div>
          </section>
        )}

        {/* ── Care profile ── */}
        {careProfile && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Care guide</h2>
            <div className={styles.careGrid}>
              {careProfile.moistureRange && (
                <div className={styles.careItem}>
                  <span className={styles.careLabel}>Ideal moisture</span>
                  <span className={styles.careValue}>{careProfile.moistureRange[0]}–{careProfile.moistureRange[1]} / 10</span>
                </div>
              )}
              {careProfile.wateringStyle && (
                <div className={styles.careItem}>
                  <span className={styles.careLabel}>Watering style</span>
                  <span className={styles.careValue}>{WATERING_STYLE_LABELS[careProfile.wateringStyle] ?? careProfile.wateringStyle}</span>
                </div>
              )}
              {careProfile.light && (
                <div className={styles.careItem}>
                  <span className={styles.careLabel}>Light</span>
                  <span className={styles.careValue}>{LIGHT_LABELS[careProfile.light] ?? careProfile.light}</span>
                </div>
              )}
              {careProfile.humidity && (
                <div className={styles.careItem}>
                  <span className={styles.careLabel}>Humidity</span>
                  <span className={styles.careValue}>{HUMIDITY_LABELS[careProfile.humidity] ?? careProfile.humidity}</span>
                </div>
              )}
              {careProfile.minWaterAmount && (
                <div className={styles.careItem}>
                  <span className={styles.careLabel}>Min watering</span>
                  <span className={styles.careValue}>{careProfile.minWaterAmount.cups} cups / {careProfile.minWaterAmount.liters} L</span>
                </div>
              )}
            </div>
            {careProfile.notes && (
              <p className={styles.careNotes}>{careProfile.notes}</p>
            )}
          </section>
        )}

        {/* ── Log history ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Log history
            <span className={styles.sectionCount}>{bundles.length}</span>
          </h2>
          {bundles.length === 0 ? (
            <p className={styles.emptyHistory}>No log entries yet — tap "+ Log" to record care data.</p>
          ) : bundles.map((bundle, i) => {
            const ts       = bundle[0].timestamp
            const reading  = bundle.find(e => e.type === 'reading')
            const watering = bundle.find(e => e.type === 'watering')
            const healthEv = bundle.find(e => e.type === 'health_change')
            const note     = bundle.find(e => e.type === 'note')
            return (
              <div
                key={bundle[0].bundleId}
                className={`${styles.logEntry} ${i < bundles.length - 1 ? styles.logEntryDivider : ''}`}
              >
                <div className={styles.logTop}>
                  <span className={styles.logDate}>{fmtDate(ts)}</span>
                  <span className={styles.logTime}>{fmtTime(ts)}</span>
                  {onEditLog && (
                    <button
                      className={styles.logEditBtn}
                      onClick={() => onEditLog(plant, bundle)}
                      type="button"
                    >Edit</button>
                  )}
                </div>
                <div className={styles.logMeta}>
                  {reading  && <span className={styles.moisturePill}>◎ {reading.moisture} / 10</span>}
                  {watering && <span className={styles.waterPill}>💧 {waterLabel(watering.unit, watering.amount)}</span>}
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
        </section>

        {/* ── Danger zone ── */}
        <section className={styles.dangerZone}>
          {!deleteConfirm ? (
            <button
              className={styles.deleteBtn}
              onClick={() => setDeleteConfirm(true)}
              type="button"
            >
              Delete plant
            </button>
          ) : (
            <div className={styles.deleteConfirm}>
              <p className={styles.deleteConfirmText}>
                Delete {name || titleCase(species)}? This can't be undone.
              </p>
              <div className={styles.deleteConfirmActions}>
                <button className={styles.deleteCancelBtn} onClick={() => setDeleteConfirm(false)} type="button">
                  Cancel
                </button>
                <button className={styles.deleteConfirmBtn} onClick={handleDelete} type="button">
                  Delete
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
