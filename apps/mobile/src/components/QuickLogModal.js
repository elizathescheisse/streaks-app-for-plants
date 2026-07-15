import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeContext.js'

// One-field quick logger for the card's Water / Reading buttons.
// mode: 'water' | 'reading'. Builds a form the core buildEventsFromForm
// understands (via the context's addLogEntry).
export default function QuickLogModal({ visible, mode, plantName, onClose, onSubmit }) {
  const { colors } = useTheme()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (visible) setValue('')
  }, [visible])

  const isWater = mode === 'water'
  const title = isWater ? `Water ${plantName}` : `Log reading for ${plantName}`
  const label = isWater ? 'Amount (cups)' : 'Moisture (0–10)'
  const canSave = value.trim().length > 0

  function handleSave() {
    if (!canSave) return
    onSubmit(isWater
      ? { waterAmount: value.trim(), waterUnit: 'cups' }
      : { moisture: value.trim() })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.overlayScrim }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceInset, borderColor: colors.border, color: colors.text }]}
            placeholder={isWater ? '2' : '5'}
            placeholderTextColor={colors.textSoft}
            keyboardType="decimal-pad"
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View style={styles.actions}>
            <Pressable style={[styles.btn, { backgroundColor: colors.surfaceMuted }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: canSave ? colors.primary : colors.surfaceMuted }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={[styles.btnText, { color: canSave ? colors.onPrimary : colors.textMuted }]}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, marginTop: 4 },
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
