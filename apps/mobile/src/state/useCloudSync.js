import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { mergePlants } from '@plant-streaks/core/plantMerge.js'

// Optional cloud sync for the phone app — the mirror of the web app's
// apps/web/src/shared/firebase/usePlantCloudSync.js. Plants always live on the
// phone (AsyncStorage); only after signing in with Google are they also copied
// to Firestore (users/{uid}/plants/{plantId}) and kept live in both directions.
// Every cloud update goes through mergePlants (union of events), so a log made
// on the web or another device is added, never overwritten. Every failure just
// sets a message — nothing here can block the app.
//
// Same known limitation as web: a deleted log entry/plant can come back from a
// device that still has it (needs tombstones, #252).

const SAVE_DELAY_MS = 1000   // arbitrary: wait for a burst of edits to settle

const plain = plant => JSON.parse(JSON.stringify(plant))   // Firestore rejects `undefined`

export default function useCloudSync(plants, setPlants, loaded) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const uidRef = useRef(null)
  const readyRef = useRef(false)
  const savedRef = useRef(new Map())   // plantId → JSON last written/read
  const unsubRef = useRef(null)

  // Wait until local plants are loaded from storage before listening, so the
  // first cloud snapshot merges into real data instead of an empty list.
  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    const stop = onAuthStateChanged(auth, u => {
      unsubRef.current?.(); unsubRef.current = null
      readyRef.current = false
      uidRef.current = null
      savedRef.current = new Map()
      setUser(u ? { email: u.email, name: u.displayName } : null)
      if (!u) return

      unsubRef.current = onSnapshot(
        collection(db, 'users', u.uid, 'plants'),
        snap => {
          if (cancelled) return
          const cloud = snap.docs.map(d => d.data())
          for (const c of cloud) savedRef.current.set(c.id, JSON.stringify(c))
          uidRef.current = u.uid
          readyRef.current = true
          setPlants(local => mergePlants(local ?? [], cloud))
        },
        e => {
          console.warn('Firebase sync failed', e)
          setError('Could not reach the cloud — your plants are still saved on this phone.')
        },
      )
    })
    return () => { cancelled = true; unsubRef.current?.(); stop() }
  }, [loaded, setPlants])

  // Write changes (and deletions) after edits settle
  useEffect(() => {
    if (!readyRef.current || plants === null) return
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

  // Google hands the screen an ID token; Firebase turns it into a signed-in user.
  const signInWithGoogleIdToken = useCallback(async idToken => {
    setError(null)
    try {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
    } catch (e) {
      console.warn('Google sign-in failed', e)
      setError("Sign-in didn't work. Please try again.")
    }
  }, [])

  const signOutOfCloud = useCallback(() => signOut(auth).catch(e => console.warn('Sign-out failed', e)), [])

  return { user, error, setError, signInWithGoogleIdToken, signOut: signOutOfCloud }
}
