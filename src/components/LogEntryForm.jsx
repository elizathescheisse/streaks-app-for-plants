import { useState } from 'react'
import styles from './LogEntryForm.module.css'

const HEALTH_OPTIONS = [
  { value: 'no_change',  label: 'No change'    },
  { value: 'thriving',   label: 'Thriving'     },
  { value: 'good',       label: 'Healthy'      },
  { value: 'okay',       label: 'Okay'         },
  { value: 'struggling', label: 'Struggling'   },
]

const UNIT_OPTIONS = [
  { value: 'cups',     label: 'Cups'     },
  { value: 'liters',   label: 'Liters'   },
  { value: 'freeform', label: 'Freeform' },
]

// Format a Date as the local-datetime string that <input type="datetime-local">
// expects: "YYYY-MM-DDTHH:MM".
function nowLocalInput() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// Factory — call this each time you open the form so `timestamp` defaults
// to the current moment (a static const would freeze at module load).
export function createEmptyLogForm() {
  return {
    moisture:    '',
    waterAmount: '',
    waterUnit:   'cups',
    health:      'no_change',
    notes:       '',
    timestamp:   nowLocalInput(),
  }
}

// Backwards-compat alias — gets a stale timestamp; prefer createEmptyLogForm()
export const EMPTY_LOG_FORM = createEmptyLogForm()

function describePending(form) {
  const parts = []
  if (form.moisture !== '' && form.moisture != null) parts.push('1 reading')
  if (String(form.waterAmount).trim() !== '') parts.push('1 watering')
  if (form.health !== 'no_change') parts.push('1 health change')
  if (form.notes.trim() !== '') parts.push('1 note')
  return parts.length === 0 ? 'Nothing to save yet' : `Saving: ${parts.join(' · ')}`
}

export default function LogEntryForm({ plant, form, isEdit, onChange, onSave, onCancel, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }
  const moistureInt = form.moisture === '' ? null : Number(form.moisture)
  const summary = describePending(form)
  const hasSomething = summary !== 'Nothing to save yet'

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.title}>{isEdit ? 'Edit log entry' : 'Log entry'}</h2>
          <p className={styles.sub}>
            for <span className={styles.plantName}>{plant?.name || plant?.species || 'this plant'}</span>
          </p>
        </div>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">×</button>
      </div>

      {/* ── When? ── */}
      <div className={styles.field}>
        <label className={styles.label}>When?</label>
        <div className={styles.whenRow}>
          <input
            type="datetime-local"
            className={`${styles.input} ${styles.datetimeInput}`}
            value={form.timestamp || ''}
            onChange={e => set('timestamp', e.target.value)}
          />
          <button
            type="button"
            className={styles.nowBtn}
            onClick={() => set('timestamp', nowLocalInput())}
            title="Reset to right now"
          >Now</button>
        </div>
      </div>

      {/* ── Moisture reading ── */}
      <div className={styles.field}>
        <label className={styles.label}>Did you take a moisture reading?</label>
        {form.moisture === '' ? (
          <button
            className={styles.addBtn}
            type="button"
            onClick={() => set('moisture', 5)}
          >+ Add moisture reading</button>
        ) : (
          <div className={styles.moistureBlock}>
            <div className={styles.stepper}>
              <button
                className={styles.stepBtn}
                onClick={() => set('moisture', Math.max(0, (moistureInt ?? 0) - 1))}
                type="button"
              >−</button>
              <div className={styles.stepValue}>
                <span className={styles.stepNum}>{form.moisture}</span>
                <span className={styles.stepUnit}> / 10</span>
              </div>
              <button
                className={styles.stepBtn}
                onClick={() => set('moisture', Math.min(10, (moistureInt ?? 0) + 1))}
                type="button"
              >+</button>
            </div>
            <input
              type="range" min="0" max="10" step="0.1"
              className={styles.slider}
              value={form.moisture}
              onChange={e => set('moisture', parseFloat(e.target.value))}
            />
            <button
              className={styles.clearBtn}
              type="button"
              onClick={() => set('moisture', '')}
            >Clear reading</button>
          </div>
        )}
      </div>

      {/* ── Watering ── */}
      <div className={styles.field}>
        <label className={styles.label}>Did you water?</label>
        <div className={styles.waterRow}>
          <input
            className={styles.input}
            placeholder="Amount e.g. 1, 0.5, 3/4"
            inputMode="decimal"
            value={form.waterAmount}
            onChange={e => set('waterAmount', e.target.value)}
          />
          <select
            className={styles.unitSelect}
            value={form.waterUnit}
            onChange={e => set('waterUnit', e.target.value)}
          >
            {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Health ── */}
      <div className={styles.field}>
        <label className={styles.label}>Any health changes?</label>
        <select
          className={styles.input}
          value={form.health}
          onChange={e => set('health', e.target.value)}
        >
          {HEALTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Notes ── */}
      <div className={styles.field}>
        <label className={styles.label}>Any observations?</label>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="e.g. brown spots on lower leaf, leaning toward window…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
        />
      </div>

      {/* ── Save ── */}
      <div className={styles.formActions}>
        <button
          className={styles.saveBtn}
          onClick={onSave}
          disabled={!hasSomething}
        >
          Save log entry
        </button>
        <p className={`${styles.preview} ${hasSomething ? styles.previewActive : ''}`}>{summary}</p>
      </div>

      {/* ── Delete (edit mode only) ── */}
      {isEdit && onDelete && (
        <div className={styles.deleteZone}>
          {confirmingDelete ? (
            <>
              <p className={styles.deleteConfirmText}>Delete this entry? This can't be undone.</p>
              <div className={styles.deleteConfirmActions}>
                <button
                  type="button"
                  className={styles.deleteCancelBtn}
                  onClick={() => setConfirmingDelete(false)}
                >Keep it</button>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  onClick={onDelete}
                >Yes, delete</button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className={styles.deleteEntryBtn}
              onClick={() => setConfirmingDelete(true)}
            >Delete this entry</button>
          )}
        </div>
      )}
    </div>
  )
}
