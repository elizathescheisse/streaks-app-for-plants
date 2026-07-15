import AsyncStorage from '@react-native-async-storage/async-storage'

// Mirrors apps/web/src/app/App.jsx's schema-versioned localStorage pattern.
// Keeping all reads/writes behind this one module (not scattered
// AsyncStorage calls in components) is what lets a future backend
// (Supabase/Firebase) swap in later without touching call sites.
const SCHEMA_VERSION = '2'
const STORAGE_KEY = 'plant-streaks'
const SCHEMA_KEY = 'plant-streaks-schema'

export async function loadPlants() {
  const ver = await AsyncStorage.getItem(SCHEMA_KEY)
  if (ver !== SCHEMA_VERSION) {
    await AsyncStorage.removeItem(STORAGE_KEY)
    await AsyncStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION)
    return []
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function savePlants(plants) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plants))
}
