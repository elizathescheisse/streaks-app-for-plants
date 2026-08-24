import { useState, useRef, useEffect } from 'react'
import styles from './PlantChat.module.css'
import { logBundles } from '@plant-streaks/core/plantSelectors.js'

// Send the plant's WHOLE log history, not just a recent slice — so
// questions about the past ("how was it doing in June?") are already
// answerable without any extra machinery. This is safe because even a
// heavily-logged plant is only a few hundred words of one-line summaries,
// trivial for the AI to read. HISTORY_CAP is just a sane backstop against
// a truly pathological case (years of twice-daily logging); if a plant
// ever actually hits it, that's the signal to build on-demand fetching
// (the AI asking for a specific date range mid-conversation) instead of
// raising this number further.
const HISTORY_CAP = 500

function fmtShortDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function waterLabel(unit, amount) {
  if (!amount) return null
  const n = parseFloat(amount)
  if (unit === 'cups')   return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return String(amount)
}

// Condenses everything already known about this plant into a plain-language
// object the serverless function turns into a system prompt. Built here
// (not on the server) because the page already has all of this computed.
function buildPlantContext({ plant, careProfile, health, reading, watering, rec, usePredicted }) {
  const recentHistory = logBundles(plant)
    .slice(0, HISTORY_CAP)
    .map(bundle => {
      const r = bundle.find(e => e.type === 'reading')
      const w = bundle.find(e => e.type === 'watering')
      const parts = [fmtShortDate(bundle[0].timestamp)]
      if (r) parts.push(`moisture ${r.moisture}/10`)
      if (w) { const wl = waterLabel(w.unit, w.amount); if (wl) parts.push(`watered ${wl}`) }
      return parts.join(' — ')
    })

  return {
    name: plant.name || null,
    species: plant.species,
    health,
    moisture: reading ? Number(reading.moisture) : null,
    moistureWhen: reading ? fmtShortDate(reading.timestamp) : null,
    idealRange: careProfile?.moistureRange ?? null,
    wateringStyle: careProfile?.wateringStyle ?? null,
    lastWatered: watering ? `${waterLabel(watering.unit, watering.amount) ?? watering.amount} on ${fmtShortDate(watering.timestamp)}` : null,
    recommendation: rec && usePredicted
      ? `~${Math.round(rec.predicted)}/10 now${rec.waterNeeded > 0 ? `, suggests ${rec.waterNeeded.toFixed(1)} ${rec.dominantUnit ?? 'cups'}` : ''}`
      : null,
    recentHistory,
  }
}

// Chat about one plant, grounded in its real logged data. Stateless on the
// server — history lives only in this component's state, so it resets on
// page refresh. No accounts yet; see /api/chat.js for the auth note.
export default function PlantChat({ plant, careProfile, health, reading, watering, rec, usePredicted }) {
  const [messages, setMessages] = useState([])   // [{ role: 'user'|'assistant', content }]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setDraft('')
    setError(null)
    setSending(true)

    try {
      const plantContext = buildPlantContext({ plant, careProfile, health, reading, watering, rec, usePredicted })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantContext, messages: nextMessages }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'The AI service is unavailable right now.')
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Ask about {plant.name || plant.species}</h2>

      {messages.length > 0 && (
        <div className={styles.list} ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {m.content}
            </div>
          ))}
          {sending && <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleTyping}`}>…</div>}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask a question about this ${plant.species}…`}
          rows={1}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={send}
          disabled={sending || !draft.trim()}
          type="button"
        >Send</button>
      </div>
    </section>
  )
}
