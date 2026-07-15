import { useCallback, useRef, useState } from 'react'
import { PLANT_DB } from '@plant-streaks/core/plantDatabase.js'
import SpeciesInput from '../../../../shared/components/SpeciesInput'
import {
  PLANT_OPTIONS,
  DEFAULT_PLANT_OPTION_ID,
  findPlantOptionId,
  getPlantOption,
} from '../../plantOptions.js'
// PLANT_OPTIONS still drives the visual carousel above; only the inline
// species <select> was replaced by the combobox below.
import styles from './AddPlantModal.module.css'

const HEALTH_OPTIONS = [
  { value: 'thriving', label: 'Thriving' },
  { value: 'good', label: 'Healthy' },
  { value: 'okay', label: 'Okay' },
  { value: 'struggling', label: 'Struggling' },
]

function displaySpeciesLabel(speciesKey) {
  if (!speciesKey?.trim()) return 'Species not set'
  return PLANT_DB[speciesKey.trim().toLowerCase()]?.displayName
    ?? speciesKey.replace(/\b\w/g, c => c.toUpperCase())
}

function summaryDisplayName(form, option) {
  if (form.name.trim()) return form.name.trim()
  return option?.name ?? displaySpeciesLabel(form.species)
}

export default function AddPlantModal({ form, onChange, onSave, onCancel }) {
  const carouselRef = useRef(null)
  const [selectedId, setSelectedId] = useState(
    () => findPlantOptionId(form.species) ?? DEFAULT_PLANT_OPTION_ID
  )

  const selectedOption = getPlantOption(selectedId)
  const matchedId = findPlantOptionId(form.species)
  const activeOption = matchedId ? getPlantOption(matchedId) : selectedOption

  const set = useCallback(
    (key, value) => onChange(f => ({ ...f, [key]: value })),
    [onChange]
  )

  const applyOption = useCallback(
    (option) => {
      setSelectedId(option.id)
      onChange(f => ({
        ...f,
        species: option.speciesKey,
        emoji: option.icon,
      }))
    },
    [onChange]
  )

  const scrollCarousel = (direction) => {
    const el = carouselRef.current
    if (!el) return
    el.scrollBy({ left: direction * 260, behavior: 'smooth' })
  }

  const canSave = form.species.trim() || form.name.trim()
  const summaryName = summaryDisplayName(form, activeOption)
  const summarySpecies = displaySpeciesLabel(form.species)

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onCancel}
        aria-label="Close add plant modal"
      >
        ×
      </button>

      <aside className={styles.left}>
        <h2 className={styles.chooseTitle}>Choose your plant</h2>
        <p className={styles.chooseSub}>
          Pick the plant you&apos;d like to add to your collection.
        </p>

        <div className={styles.preview} aria-live="polite">
          <div className={styles.previewGlow} />
          {activeOption.tag && (
            <span className={styles.previewTag}>
              <span className={styles.previewTagIcon} aria-hidden="true">★</span>
              {activeOption.tag}
            </span>
          )}
          {activeOption.image ? (
            <img
              src={activeOption.image}
              alt={`${activeOption.name} preview`}
              className={styles.previewVisual}
            />
          ) : (
            <span className={styles.previewVisual} aria-hidden="true">
              {form.emoji || activeOption.icon}
            </span>
          )}
        </div>

        <div className={styles.carouselWrap}>
          <button
            type="button"
            className={styles.carouselArrow}
            onClick={() => scrollCarousel(-1)}
            aria-label="Scroll plant options left"
          >
            ‹
          </button>
          <div className={styles.carouselScroll} ref={carouselRef}>
            {PLANT_OPTIONS.map(option => {
              const isSelected = matchedId
                ? option.id === matchedId
                : option.id === selectedId
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.optionCard} ${isSelected ? styles.optionCardSelected : ''}`}
                  onClick={() => applyOption(option)}
                  aria-pressed={isSelected}
                  aria-label={`${option.name}, ${option.speciesLabel}`}
                >
                  {isSelected && (
                    <span className={styles.optionCheck} aria-hidden="true">✓</span>
                  )}
                  <span className={styles.optionIcon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.optionName}>{option.name}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className={styles.carouselArrow}
            onClick={() => scrollCarousel(1)}
            aria-label="Scroll plant options right"
          >
            ›
          </button>
        </div>
      </aside>

      <div className={styles.right}>
        <div>
          <h2 className={styles.formTitle}>Add a plant</h2>
          <p className={styles.formSub}>
            Choose a plant, name it, and start tracking care.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Plant type / species
          </label>
          {/* Combobox: click to see the full species list, type to filter,
              or enter any free-form text for a species the database doesn't
              know. If the value matches a curated PLANT_OPTION, the emoji
              syncs so the carousel preview stays consistent. */}
          <div className={styles.speciesRow}>
            <span className={styles.speciesRowIcon} aria-hidden="true">
              {form.emoji || activeOption.icon}
            </span>
            <div className={styles.speciesField}>
              <SpeciesInput
                value={form.species}
                onChange={val => {
                  set('species', val)
                  const id = findPlantOptionId(val)
                  if (id) {
                    setSelectedId(id)
                    const opt = getPlantOption(id)
                    set('emoji', opt.icon)
                  }
                }}
                inputClassName={styles.input}
              />
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="add-plant-nickname">
            Nickname <span className={styles.optional}>(optional)</span>
          </label>
          <input
            id="add-plant-nickname"
            className={styles.input}
            placeholder="e.g. Big Monstera"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Health</span>
          <div className={styles.healthPills} role="group" aria-label="Plant health">
            {HEALTH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.pill} ${styles[`pill_${value}`]} ${form.health === value ? styles[`pillActive_${value}`] : ''}`}
                onClick={() => set('health', value)}
                aria-pressed={form.health === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.summary}>
          <p className={styles.summaryLabel}>Selected plant</p>
          <div className={styles.summaryRow}>
            <span className={styles.summaryAvatar} aria-hidden="true">
              {form.emoji || activeOption.icon}
            </span>
            <div>
              <p className={styles.summaryName}>{summaryName}</p>
              <p className={styles.summarySpecies}>{summarySpecies}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSave}
          disabled={!canSave}
        >
          Add plant
        </button>

        <p className={styles.trustNote}>
          <span className={styles.trustIcon} aria-hidden="true">🛡️</span>
          <span>
            We&apos;ll help you build a care routine and keep your plant happy.
          </span>
        </p>
      </div>
    </div>
  )
}
