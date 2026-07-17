import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeContext.js'
import BottomSheet from './BottomSheet.js'
import SpeciesInput from './SpeciesInput.js'

const EMOJI_CHOICES = ['🌿', '🌱', '🪴', '🌵', '🌴', '🌳', '🌸', '🍃']

// Minimal add-plant form. The web version has a species search index +
// health picker + typical-water fields; this covers the essentials for
// Phase 2 (emoji, species, nickname). Richer fields come later.
export default function AddPlantModal({ visible, onClose, onAdd }) {
  const { colors } = useTheme()
  const [emoji, setEmoji] = useState('🌿')
  const [species, setSpecies] = useState('')
  const [name, setName] = useState('')

  const canSave = species.trim().length > 0

  function reset() {
    setEmoji('🌿')
    setSpecies('')
    setName('')
  }

  function handleSave() {
    if (!canSave) return
    onAdd({ emoji, species, name })
    reset()
    onClose()
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Add a plant</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>Icon</Text>
          <View style={styles.emojiRow}>
            {EMOJI_CHOICES.map(e => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  styles.emojiBtn,
                  { borderColor: colors.border },
                  emoji === e && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>Species</Text>
          <SpeciesInput
            value={species}
            onChange={setSpecies}
            inputStyle={[styles.input, { backgroundColor: colors.surfaceInset, borderColor: colors.border, color: colors.text }]}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Nickname (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceInset, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. Back Fern"
            placeholderTextColor={colors.textSoft}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.btn, { backgroundColor: colors.surfaceMuted }]} onPress={handleClose}>
              <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: canSave ? colors.primary : colors.surfaceMuted }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={[styles.btnText, { color: canSave ? colors.onPrimary : colors.textMuted }]}>Add Plant</Text>
            </Pressable>
          </View>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, marginTop: 8 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
})
