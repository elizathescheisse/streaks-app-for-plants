import { useEffect, useRef } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'

// Background copy of the plant list to Firestore (users/{uid}/plants/{plantId}).
// localStorage stays the source the UI reads from, so the app works offline and
// nothing here can block it — every failure just logs to the console.
//
// Sign-in is anonymous: no account, but a stable per-browser identity. (Linking
// a Google/email account later is what will let a second device see the same
// plants.)
//
// First sync merges rather than overwrites: plants are append-only event logs,
// so for a plant present on both sides the one with MORE events wins.

const SAVE_DELAY_MS = 1000   // arbitrary: wait for a burst of edits to settle

const plain = plant => JSON.parse(JSON.stringify(plant))   // Firestore rejects `undefined`

function mergePlants(local, cloud) {
  const byId = new Map(local.map(p => [p.id, p]))
  for (const c of cloud) {
    const l = byId.get(c.id)
    if (!l || (c.events?.length ?? 0) > (l.events?.length ?? 0)) byId.set(c.id, c)
  }
  return [...byId.values()]
}

export default function usePlantCloudSync(plants, setPlants) {
  const uidRef = useRef(null)
  const readyRef = useRef(false)
  const savedRef = useRef(new Map())   // plantId → JSON last written/read
  const latest = useRef(plants)
  latest.current = plants

  // Sign in, then do the first merge
  useEffect(() => {
    let cancelled = false
    const stop = onAuthStateChanged(auth, async user => {
      if (!user) {
        try { await signInAnonymously(auth) } catch (e) { console.warn('Firebase sign-in failed', e) }
        return
      }
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'plants'))
        if (cancelled) return
        const cloud = snap.docs.map(d => d.data())
        for (const c of cloud) savedRef.current.set(c.id, JSON.stringify(c))
        uidRef.current = user.uid
        readyRef.current = true
        setPlants(local => mergePlants(local, cloud))
      } catch (e) {
        console.warn('Firebase first sync failed', e)
      }
    })
    return () => { cancelled = true; stop() }
  }, [setPlants])

  // Write changes (and deletions) after edits settle
  useEffect(() => {
    if (!readyRef.current) return
    const timer = setTimeout(async () => {
      const uid = uidRef.current
      const ids = new Set(plants.map(p => p.id))
      try {
        for (const p of plants) {
          const json = JSON.stringify(p)
          if (savedRef.current.get(p.id) === json) continue
          await setDoc(doc(db, 'users', uid, 'plants', p.id), plain(p))
          savedRef.current.set(p.id, json)
        }
        for (const id of [...savedRef.current.keys()]) {
          if (ids.has(id)) continue
          await deleteDoc(doc(db, 'users', uid, 'plants', id))
          savedRef.current.delete(id)
        }
      } catch (e) {
        console.warn('Firebase save failed', e)
      }
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [plants])
}
