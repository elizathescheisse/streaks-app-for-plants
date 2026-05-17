import styles from './PlantForm.module.css'
import SpeciesInput from './SpeciesInput.jsx'

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

export default function PlantForm({ form, onChange, onSave, onCancel, isEdit }) {
  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }
  const canSave = form.species.trim() || form.name.trim()

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.title}>{isEdit ? 'Edit plant' : 'Add a plant'}</h2>
          <p className={styles.sub}>
            {isEdit ? 'Update this plant’s identity.' : 'Identify your plant — log entries come later.'}
          </p>
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
    </div>
  )
}
