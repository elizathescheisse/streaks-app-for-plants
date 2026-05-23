import { useState, useRef, useEffect } from 'react'
import { PLANT_SEARCH_INDEX } from '../../../data/plantDatabase.js'
import styles from './SpeciesInput.module.css'

export default function SpeciesInput({ value, onChange, inputClassName }) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value) }, [value])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q) // propagate raw typed value immediately

    if (q.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const lower = q.toLowerCase()
    const matches = PLANT_SEARCH_INDEX.filter(entry =>
      entry.terms.some(t => t.includes(lower))
    ).slice(0, 8)

    setSuggestions(matches)
    setActiveIdx(-1)
    setOpen(matches.length > 0)
  }

  function selectEntry(entry) {
    setQuery(entry.displayName + (entry.commonNames.length ? '' : ''))
    onChange(entry.key)      // store the exact DB key
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      selectEntry(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        className={inputClassName}
        placeholder="e.g. Monstera deliciosa"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className={styles.dropdown} role="listbox">
          {suggestions.map((entry, i) => (
            <li
              key={entry.key}
              className={`${styles.item} ${i === activeIdx ? styles.itemActive : ''}`}
              onMouseDown={() => selectEntry(entry)}
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
