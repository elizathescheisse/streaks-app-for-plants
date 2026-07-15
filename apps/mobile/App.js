import { useEffect, useState, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  FlatList,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'

import { loadPlants, savePlants } from './src/storage/plantStorage.js'
import { currentHealth } from '@plant-streaks/core/plantSelectors.js'

// Phase 1 checkpoint: prove the whole pipeline works end to end —
// data loads from AsyncStorage, a plant can be added, it persists,
// and @plant-streaks/core (the shared prediction/selector logic) runs
// unmodified inside React Native. No styling polish yet — that's Phase 3.

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  // Fallback for environments where Hermes doesn't expose crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PlantStreaksApp />
    </SafeAreaProvider>
  )
}

function PlantStreaksApp() {
  const [plants, setPlants] = useState(null) // null = still loading
  const [nameInput, setNameInput] = useState('')
  const [speciesInput, setSpeciesInput] = useState('')

  useEffect(() => {
    loadPlants().then(setPlants)
  }, [])

  useEffect(() => {
    if (plants !== null) savePlants(plants)
  }, [plants])

  const addPlant = useCallback(() => {
    if (!speciesInput.trim()) return
    const newPlant = {
      id: randomId(),
      emoji: '🌿',
      species: speciesInput.trim().toLowerCase(),
      name: nameInput.trim(),
      events: [],
    }
    setPlants(prev => [...(prev ?? []), newPlant])
    setNameInput('')
    setSpeciesInput('')
  }, [nameInput, speciesInput])

  if (plants === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Plant Streaks</Text>
      <Text style={styles.subtitle}>Phase 1 smoke test — {plants.length} plant{plants.length === 1 ? '' : 's'} saved</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nickname (optional)"
          value={nameInput}
          onChangeText={setNameInput}
        />
        <TextInput
          style={styles.input}
          placeholder="Species (e.g. pothos)"
          value={speciesInput}
          onChangeText={setSpeciesInput}
        />
        <Pressable style={styles.button} onPress={addPlant}>
          <Text style={styles.buttonText}>+ Add Plant</Text>
        </Pressable>
      </View>

      <FlatList
        data={plants}
        keyExtractor={p => p.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No plants yet — add one above.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>{item.emoji}</Text>
            <View>
              <Text style={styles.rowName}>{item.name || item.species}</Text>
              <Text style={styles.rowMeta}>{item.species} · {currentHealth(item)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1a0c',
  },
  loading: {
    color: '#e5f2e0',
    textAlign: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e5f2e0',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subtitle: {
    color: '#8fae86',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  form: {
    paddingHorizontal: 20,
    gap: 8,
  },
  input: {
    backgroundColor: '#16261280',
    borderColor: '#2f4a28',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5f2e0',
  },
  button: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#0e1a0c',
    fontWeight: '700',
  },
  list: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  empty: {
    color: '#8fae86',
    textAlign: 'center',
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomColor: '#2f4a28',
    borderBottomWidth: 1,
  },
  rowEmoji: {
    fontSize: 24,
  },
  rowName: {
    color: '#e5f2e0',
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    color: '#8fae86',
    fontSize: 13,
  },
})
