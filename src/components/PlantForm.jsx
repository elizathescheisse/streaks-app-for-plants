import { useState } from 'react'
import styles from './PlantForm.module.css'
import SpeciesInput from './SpeciesInput.jsx'
import MoistureBar from './MoistureBar.jsx'
import { lookupPlant } from '../utils/plantLookup.js'
import { logBundles } from '../utils/plantSelectors.js'

const EMOJI_OPTIONS = [
  '🌿','🪴','🌱','🌵','🌴','🌳','🌾','🍀',
  '🌺','🌸','🌻','🌹','🪷','🎋','🍃','🌲',
]

export const EMPTY_PLANT_FORM = {
  id:      null,
  emoji:   '🌿',
  species: '',
  name:    '',
  health:  null,
}

const HEALTH_OPTIONS = [
  { value: 'thriving',   label: '🌟 Thriving'   },
  { value: 'good',       label: '✓ Healthy'     },
  { value: 'okay',       label: '~ Okay'        },
  { value: 'struggling', label: '⚠ Struggling'  },
]

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
const HEALTH_LABELS = {
  thriving: 'Thriving', good: 'Healthy', okay: 'Okay', struggling: 'Struggling',
}

function waterLabel(unit, amount) {
  if (!amount) return '—'
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return amount
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const HISTORY_WINDOWS = [
  { key: '1W',  label: '1W',  days: 7   },
  { key: '1M',  label: '1M',  days: 30  },
  { key: '3M',  label: '3M',  days: 90  },
  { key: 'all', label: 'All', days: null },
]

export default function PlantForm({ form, onChange, onSave, onCancel, onDelete, isEdit, plant, onEditLog }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [activeTab, setActiveTab] = useState('edit')
  const [historyWindow, setHistoryWindow] = useState('all')

  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }
  const canSave = form.species.trim() || form.name.trim()
  const careProfile = lookupPlant(form.species)
  const displayName = form.name || (form.species
    ? form.species.replace(/\b\w/g, c => c.toUpperCase())
    : null)
  const allBundles = plant ? logBundles(plant) : []

  const windowDays = HISTORY_WINDOWS.find(w => w.key === historyWindow)?.days
  const cutoff = windowDays ? Date.now() - windowDays * 86_400_000 : null
  const bundles = cutoff
    ? allBundles.filter(b => new Date(b[0].timestamp) >= cutoff)
    : allBundles

  return (
    <div className={styles.panel}>

      {/* ── Header ── */}
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.title}>{isEdit ? (displayName || 'Plant') : 'Add a plant'}</h2>
          {!isEdit && (
            <p className={styles.sub}>Identify your plant — log entries come later.</p>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">×</button>
      </div>

      {/* ── Tab bar (edit mode only) ── */}
      {isEdit && (
        <div className={styles.tabBar}>
          {[['edit', 'Edit'], ['history', 'History'], ['info', 'Info']].map(([id, label]) => (
            <button
              key={id}
              className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(id)}
              type="button"
            >{label}</button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════
          EDIT TAB (also the only view when adding)
          ══════════════════════════════════════════ */}
      {(!isEdit || activeTab === 'edit') && (
        <div className={styles.tabContent}>

          {/* Emoji picker */}
          <div className={styles.field}>
            <label className={styles.label}>PLANT ICON</label>
            <div className={styles.emojiGrid}>
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  className={`${styles.emojiBtn} ${form.emoji === e ? styles.emojiBtnActive : ''}`}
                  onClick={() => set('emoji', e)}
                  type="button"
                >
                  {e}
                </button>
              ))}
              <input
                className={styles.emojiCustom}
                maxLength={4}
                placeholder="✏️"
                value={EMOJI_OPTIONS.includes(form.emoji) ? '' : form.emoji}
                onChange={e => {
                  const val = [...e.target.value].filter(c => /\p{Emoji}/u.test(c)).join('')
                  if (val) set('emoji', val)
                }}
                title="Type a custom emoji"
              />
            </div>
            <div className={styles.emojiPreview}>
              Selected: <span className={styles.emojiPreviewGlyph}>{form.emoji}</span>
            </div>
          </div>

          {/* Species */}
          <div className={styles.field}>
            <label className={styles.label}>PLANT TYPE / SPECIES</label>
            <SpeciesInput
              value={form.species}
              onChange={val => set('species', val)}
              inputClassName={styles.input}
            />
          </div>

          {/* Nickname */}
          <div className={styles.field}>
            <label className={styles.label}>
              NICKNAME <span className={styles.optional}>(optional)</span>
            </label>
            <input
              className={styles.input}
              placeholder="e.g. Big Monstera"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Health — only shown when editing an existing plant */}
          {isEdit && (
            <div className={styles.field}>
              <label className={styles.label}>HEALTH</label>
              <div className={styles.healthPills}>
                {HEALTH_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pill} ${styles[`pill_${value}`]} ${form.health === value ? styles[`pillActive_${value}`] : ''}`}
                    onClick={() => set('health', value)}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={onSave} disabled={!canSave}>
              {isEdit ? 'Save changes' : 'Add plant'}
            </button>
          </div>

          {isEdit && onDelete && (
            <div className={styles.deleteZone}>
              {confirmingDelete ? (
                <>
                  <p className={styles.deleteConfirmText}>Delete this plant and all its history? This can't be undone.</p>
                  <div className={styles.deleteConfirmActions}>
                    <button className={styles.deleteCancelBtn} type="button" onClick={() => setConfirmingDelete(false)}>Keep it</button>
                    <button className={styles.deleteConfirmBtn} type="button" onClick={onDelete}>Yes, delete</button>
                  </div>
                </>
              ) : (
                <button className={styles.deleteEntryBtn} type="button" onClick={() => setConfirmingDelete(true)}>
                  Delete this plant
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          HISTORY TAB
          ══════════════════════════════════════════ */}
      {isEdit && activeTab === 'history' && (
        <div className={styles.tabContent}>

          {/* Date range toggle */}
          <div className={styles.historyWindowRow}>
            {HISTORY_WINDOWS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`${styles.historyWindowBtn} ${historyWindow === key ? styles.historyWindowBtnActive : ''}`}
                onClick={() => setHistoryWindow(key)}
              >{label}</button>
            ))}
            <span className={styles.historyCount}>
              {bundles.length} {bundles.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {bundles.length === 0 ? (
            <p className={styles.emptyHistory}>
              {allBundles.length === 0
                ? 'No log entries yet — tap "+ Log" on the card to record care data.'
                : 'No entries in this period.'}
            </p>
          ) : bundles.map((bundle, i) => {
            const ts       = bundle[0].timestamp
            const reading  = bundle.find(e => e.type === 'reading')
            const watering = bundle.find(e => e.type === 'watering')
            const healthEv = bundle.find(e => e.type === 'health_change')
            const note     = bundle.find(e => e.type === 'note')
            return (
              <div
                key={bundle[0].bundleId}
                className={`${styles.historyEntry} ${i < bundles.length - 1 ? styles.historyEntryDivider : ''}`}
              >
                <div className={styles.historyTop}>
                  <span className={styles.historyDate}>{fmtDate(ts)}</span>
                  <span className={styles.historyTime}>{fmtTime(ts)}</span>
                  {onEditLog && (
                    <button
                      className={styles.historyEditBtn}
                      onClick={() => onEditLog(bundle)}
                      type="button"
                    >Edit</button>
                  )}
                </div>
                <div className={styles.historyMeta}>
                  {reading  && <span className={styles.historyMoisture}>◎ {reading.moisture} / 10</span>}
                  {watering && <span className={styles.historyWater}>💧 {waterLabel(watering.unit, watering.amount)}</span>}
                  {healthEv && (
                    <span className={`${styles.historyBadge} ${styles[`historyBadge_${healthEv.health}`]}`}>
                      {HEALTH_LABELS[healthEv.health]}
                    </span>
                  )}
                </div>
                {careProfile?.moistureRange && reading && (
                  <div className={styles.historyBar}>
                    <MoistureBar value={Number(reading.moisture)} range={careProfile.moistureRange} />
                  </div>
                )}
                {note && <p className={styles.historyNotes}>{note.text}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          INFO TAB
          ══════════════════════════════════════════ */}
      {isEdit && activeTab === 'info' && (
        <div className={styles.tabContent}>
          {careProfile ? (
            <div className={styles.careInfo}>
              <div className={styles.careWatering}>
                <span className={styles.careWateringTitle}>
                  {WATERING_STYLE_LABELS[careProfile.wateringStyle]}
                  {careProfile.wateringFrequency && (
                    <strong className={styles.careFreq}> · {careProfile.wateringFrequency}</strong>
                  )}
                </span>
                {careProfile.wateringNote && (
                  <p className={styles.careNote}>{careProfile.wateringNote}</p>
                )}
              </div>
              <div className={styles.careRow}>
                {careProfile.light    && <span className={styles.careTag}>{LIGHT_LABELS[careProfile.light]}</span>}
                {careProfile.humidity && <span className={styles.careTag}>{HUMIDITY_LABELS[careProfile.humidity]}</span>}
              </div>
              {careProfile.tips?.length > 0 && (
                <div className={styles.careTips}>
                  <p className={styles.careTipsLabel}>TIPS</p>
                  <ul className={styles.careTipsList}>
                    {careProfile.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.emptyHistory}>
              No care information on file for this species.
              {form.species && ' Try updating the species name on the Edit tab — it may be listed under a different name.'}
            </p>
          )}
        </div>
      )}

    </div>
  )
}
