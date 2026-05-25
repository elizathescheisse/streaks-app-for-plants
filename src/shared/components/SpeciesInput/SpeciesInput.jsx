import { useState, useRef, useEffect, useMemo } from 'react'
import { PLANT_SEARCH_INDEX } from '../../../data/plantDatabase.js'
import styles from './SpeciesInput.module.css'

const MAX_RESULTS = 12

// Combobox-style species picker: behaves both as a dropdown (focus or click
// the chevron to see the curated species list) and as a typeahead (start
// typing to filter). Free-form text is also accepted so users can enter
// species the database doesn't know about.
//
// onChange is called with either:
//   - the canonical DB key (e.g. "monstera deliciosa") when a suggestion
//     is selected, so lookupPlant() can find the care profile
//   - the raw typed string when the user is freely entering a custom species
export default function SpeciesInput({ value, onChange, inputClassName }) {
  const [query, setQuery] = useState(value)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()
  const inputRef = useRef()

  // Sync external value changes (e.g. carousel pick, form reset)
  useEffect(() => { setQuery(value) }, [value])

  // Recompute suggestions on every query change. Empty query shows the
  // full curated list (capped); any query filters by matching terms.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return PLANT_SEARCH_INDEX.slice(0, MAX_RESULTS)
    return PLANT_SEARCH_INDEX
      .filter(entry => entry.terms.some(t => t.includes(q)))
      .slice(0, MAX_RESULTS)
  }, [query])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q)              // propagate the typed value (allows custom species)
    setActiveIdx(-1)
    setOpen(true)
  }

  function selectEntry(entry) {
    setQuery(entry.displayName)
    onChange(entry.key)      // store the canonical DB key
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && activeIdx >= 0) {
      e.preventDefault()
      selectEntry(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  function toggleOpen() {
    setOpen(o => !o)
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside the wrap
  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        ref={inputRef}
        className={`${inputClassName ?? ''} ${styles.input}`}
        placeholder="Pick a species or type your own…"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="species-suggestions"
      />
      <button
        type="button"
        className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        onClick={toggleOpen}
        tabIndex={-1}
        aria-label={open ? 'Hide species list' : 'Show species list'}
      >
        ▾
      </button>
      {open && suggestions.length > 0 && (
        <ul id="species-suggestions" className={styles.dropdown} role="listbox">
          {suggestions.map((entry, i) => (
            <li
              key={entry.key}
              className={`${styles.item} ${i === activeIdx ? styles.itemActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectEntry(entry) }}
              role="option"
              aria-selected={i === activeIdx}
            >
              <span className={styles.itemMain}>{entry.displayName}</span>
              {entry.commonNames.length > 0 && (
                <span className={styles.itemSub}>{entry.commonNames.join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
