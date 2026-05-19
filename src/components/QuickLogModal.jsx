import { useState } from 'react'
import styles from './QuickLogModal.module.css'
import { lastWatering, isSignificantWatering } from '../utils/plantSelectors.js'
import { lookupPlant } from '../utils/plantLookup.js'

function titleCase(s) {
  if (!s) return s
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export default function QuickLogModal({ type, plant, onSave, onCancel }) {
  const careProfile = lookupPlant(plant?.species)
  const lastWater   = lastWatering(plant)

  // ── Water defaults ───────────────────────────────────────
  const defaultUnit   = lastWater?.unit ?? 'cups'
  const defaultAmount = lastWater?.amount ?? ''
  const [amount, setAmount] = useState(defaultAmount)
  const [unit,   setUnit]   = useState(defaultUnit)

  // ── Reading defaults ─────────────────────────────────────
  const [min, max] = careProfile?.moistureRange ?? [3, 7]
  const defaultMoisture = Math.round((min + max) / 2)
  const [moisture, setMoisture] = useState(defaultMoisture)

  const plantLabel = plant?.name || titleCase(plant?.species) || 'plant'

  function handleSave() {
    const timestamp = new Date().toISOString()
    const bundleId  = crypto.randomUUID()

    if (type === 'water') {
      const trimmed = String(amount).trim()
      if (!trimmed) return
      onSave([{
        id: crypto.randomUUID(),
        type: 'watering',
        timestamp,
        bundleId,
        amount: trimmed,
        unit,
      }])
    } else {
      onSave([{
        id: crypto.randomUUID(),
        type: 'reading',
        timestamp,
        bundleId,
        moisture: Number(moisture),
      }])
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {type === 'water' ? '💧 Log watering' : '◎ Log reading'}
          </h2>
          <p className={styles.sub}>{plantLabel}</p>
        </div>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">×</button>
      </div>

      {type === 'water' ? (
        <div className={styles.field}>
          <label className={styles.label}>HOW MUCH?</label>
          <div className={styles.amountRow}>
            <input
              className={styles.amountInput}
              type="number"
              min="0"
              step="0.25"
              placeholder="e.g. 2"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
            />
            <div className={styles.unitToggle}>
              {['cups', 'liters'].map(u => (
                <button
                  key={u}
                  type="button"
                  className={`${styles.unitBtn} ${unit === u ? styles.unitBtnActive : ''}`}
                  onClick={() => setUnit(u)}
                >{u === 'cups' ? 'cups' : 'L'}</button>
              ))}
            </div>
          </div>
          {careProfile?.minWaterAmount && String(amount).trim() && !isSignificantWatering({ amount, unit }, careProfile) && (
            <p className={styles.minWaterHint}>
              For a flood-and-dry plant, consider watering more thoroughly
              (at least {unit === 'liters' ? `${careProfile.minWaterAmount.liters} L` : `${careProfile.minWaterAmount.cups} cups`}).
            </p>
          )}
        </div>
      ) : (
        <div className={styles.field}>
          <label className={styles.label}>MOISTURE LEVEL (0 – 10)</label>
          <div className={styles.moistureRow}>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={moisture}
              className={styles.slider}
              style={{ '--val': `${moisture * 10}%` }}
              onChange={e => setMoisture(Number(e.target.value))}
            />
            <span className={styles.moistureValue}>{moisture}</span>
          </div>
          {careProfile?.moistureRange && (
            <p className={styles.rangeHint}>
              Ideal range: {min} – {max}
            </p>
          )}
        </div>
      )}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={type === 'water' && !String(amount).trim()}
      >
        Save
      </button>
    </div>
  )
}
