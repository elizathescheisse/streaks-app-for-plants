import { useEffect, useState } from 'react'

// How often to check whether the calendar day has changed. Matches the
// dashboard's own once-a-minute tick; an arbitrary choice, not tuned.
const CHECK_MS = 60_000

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// "Today" as a Date that stays correct in a tab left open for days. It used to
// be a constant set once when the page loaded, so after midnight every
// "measured today / watered today / needs a reading today" figure — and the big
// date heading — still described yesterday: readings logged after midnight
// didn't count as today's, and every plant looked unmeasured.
//
// Returns the same Date object until the day actually changes, so anything
// memoized on it isn't recomputed every minute. Also re-checks when the tab
// becomes visible or regains focus, since a laptop that slept overnight may
// have had its timers paused.
export default function useToday() {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setToday(prev => {
      const now = new Date()
      return sameDay(prev, now) ? prev : now
    })
    const id = setInterval(refresh, CHECK_MS)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
