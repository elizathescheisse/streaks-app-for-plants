import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'

// Optional cloud sync. Plants always live in localStorage (the UI reads from
// there, so the app works offline and with no account). Only after the user
// chooses "Sign in with Google" are plants also copied to Firestore
// (users/{uid}/plants/{plantId}). Signed out = nothing leaves the device.
// Signing out keeps the local copy; it just stops syncing.
//
// First sync after sign-in merges rather than overwrites: plants are append-only
// event logs, so for a plant present on both sides the one with MORE events wins.
// Every failure just logs to the console — nothing here can block the app.

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
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const uidRef = useRef(null)
  const readyRef = useRef(false)
  const savedRef = useRef(new Map())   // plantId → JSON last written/read

  useEffect(() => {
    let cancelled = false
    const stop = onAuthStateChanged(auth, async u => {
      readyRef.current = false
      uidRef.current = null
      savedRef.current = new Map()

      // Earlier builds signed everyone in anonymously; that's no longer used.
      if (u?.isAnonymous) { signOut(auth).catch(() => {}); return }
      setUser(u ? { email: u.email, name: u.displayName } : null)
      if (!u) return

      try {
        const snap = await getDocs(collection(db, 'users', u.uid, 'plants'))
        if (cancelled) return
        const cloud = snap.docs.map(d => d.data())
        for (const c of cloud) savedRef.current.set(c.id, JSON.stringify(c))
        uidRef.current = u.uid
        readyRef.current = true
        setPlants(local => mergePlants(local, cloud))
      } catch (e) {
        console.warn('Firebase first sync failed', e)
        setError('Could not reach the cloud — your plants are still saved on this device.')
      }
    })
    return () => { cancelled = true; stop() }
  }, [setPlants])

  // Write changes (and deletions) after edits settle
  useEffect(() => {
    if (!readyRef.current) return
    const timer = setTimeout(async () => {
      const uid = uidRef.current
      if (!uid) return
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

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return
      console.warn('Google sign-in failed', e)
      setError('Sign-in didn\'t work. Please try again.')
    }
  }, [])

  const signOutOfCloud = useCallback(() => signOut(auth).catch(e => console.warn('Sign-out failed', e)), [])

  return { user, error, signInWithGoogle, signOut: signOutOfCloud }
}
