import styles from './PlantForm.module.css'
import SpeciesInput from './SpeciesInput.jsx'

const HEALTH_OPTIONS = [
  { value: 'struggling', label: 'Struggling' },
  { value: 'okay',       label: 'Okay'       },
  { value: 'good',       label: 'Good'       },
  { value: 'thriving',   label: 'Thriving'   },
]

const UNIT_OPTIONS = [
  { value: 'freeform', label: 'Freeform' },
  { value: 'cups',     label: 'Cups'     },
  { value: 'liters',   label: 'Liters'   },
]

const EMOJI_OPTIONS = [
  '🌿','🪴','🌱','🌵','🌴','🌳','🌾','🍀',
  '🌺','🌸','🌻','🌹','🪷','🎋','🍃','🌲',
]

export default function PlantForm({ form, onChange, onSave, onCancel, isEdit }) {
  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }

  const moistureInt = Number(form.moisture)
  const canSave = form.species.trim() || form.name.trim()

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.title}>{isEdit ? 'Edit Plant' : 'Add Plant'}</h2>
          <p className={styles.sub}>Record today's care for this plant.</p>
        </div>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">×</button>
      </div>

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

      {/* Nickname — optional */}
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

      {/* Watering */}
      <div className={styles.field}>
        <label className={styles.label}>WATERING</label>
        <div className={styles.segmented}>
          {UNIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.seg} ${form.waterUnit === opt.value ? styles.segActive : ''}`}
              onClick={() => set('waterUnit', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          className={styles.input}
          placeholder={
            form.waterUnit === 'freeform' ? 'How much did you water?' :
            form.waterUnit === 'cups'     ? 'Amount in cups'  : 'Amount in liters'
          }
          value={form.waterAmount}
          onChange={e => set('waterAmount', e.target.value)}
        />
      </div>

      {/* Soil moisture */}
      <div className={styles.field}>
        <label className={styles.label}>SOIL MOISTURE  (0 – 10)</label>
        <div className={styles.stepper}>
          <button
            className={styles.stepBtn}
            onClick={() => set('moisture', Math.max(0, moistureInt - 1))}
          >−</button>
          <div className={styles.stepValue}>
            <span className={styles.stepNum}>{form.moisture}</span>
            <span className={styles.stepUnit}> / 10</span>
          </div>
          <button
            className={styles.stepBtn}
            onClick={() => set('moisture', Math.min(10, moistureInt + 1))}
          >+</button>
        </div>
        <input
          type="range" min="0" max="10" step="0.1"
          className={styles.slider}
          value={form.moisture}
          onChange={e => set('moisture', parseFloat(e.target.value))}
        />
      </div>

      {/* Plant health */}
      <div className={styles.field}>
        <label className={styles.label}>PLANT HEALTH</label>
        <div className={styles.healthPills}>
          {HEALTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.pill} ${styles[`pill_${opt.value}`]} ${form.health === opt.value ? styles[`pillActive_${opt.value}`] : ''}`}
              onClick={() => set('health', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className={styles.field}>
        <label className={styles.label}>NOTES</label>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Any observations about this plant today…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave} disabled={!form.species.trim() && !form.name.trim()}>
          {isEdit ? 'Update Plant' : 'Save Plant'}
        </button>
      </div>
    </div>
  )
}
