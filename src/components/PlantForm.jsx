import { useState } from 'react'
import styles from './PlantForm.module.css'
import SpeciesInput from './SpeciesInput.jsx'
import { lookupPlant } from '../utils/plantLookup.js'

const EMOJI_OPTIONS = [
  '🌿','🪴','🌱','🌵','🌴','🌳','🌾','🍀',
  '🌺','🌸','🌻','🌹','🪷','🎋','🍃','🌲',
]

export const EMPTY_PLANT_FORM = {
  id:      null,
  emoji:   '🌿',
  species: '',
  name:    '',
}

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

export default function PlantForm({ form, onChange, onSave, onCancel, onDelete, isEdit }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }
  const canSave = form.species.trim() || form.name.trim()
  const careProfile = lookupPlant(form.species)
  const displayName = form.name || (form.species
    ? form.species.replace(/\b\w/g, c => c.toUpperCase())
    : null)

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.title}>{isEdit ? (displayName || ‘Plant’) : ‘Add a plant’}</h2>
          {!isEdit && (
            <p className={styles.sub}>Identify your plant — log entries come later.</p>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">×</button>
      </div>

      {isEdit && careProfile && (
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
            {careProfile.light && <span className={styles.careTag}>{LIGHT_LABELS[careProfile.light]}</span>}
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
      )}

      {isEdit && <div className={styles.editDivider}><span>Edit</span></div>}

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

      {/* Plant species */}
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
  )
}
