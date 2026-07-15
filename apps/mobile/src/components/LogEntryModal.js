import { useState, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { lookupPlant } from '@plant-streaks/core/plantLookup.js'
import { isSignificantWatering, isSuspiciousReading } from '@plant-streaks/core/plantSelectors.js'
import { useTheme } from '../theme/ThemeContext.js'

const HEALTH_OPTIONS = [
  { value: 'no_change', label: 'No change' },
  { value: 'thriving', label: 'Thriving' },
  { value: 'good', label: 'Healthy' },
  { value: 'okay', label: 'Okay' },
  { value: 'struggling', label: 'Struggling' },
]

const UNIT_OPTIONS = ['cups', 'liters', 'freeform']

function emptyForm() {
  return { moisture: '', waterAmount: '', waterUnit: 'cups', health: 'no_change', notes: '' }
}

// Full log form (moisture + water + health + notes), the mobile port of the
// web LogEntry. Timestamp defaults to now — backdating/editing past entries
// is deferred (needs a native date picker). Opened from PlantDetail "+ Log".
export default function LogEntryModal({ visible, plant, onClose, onSubmit }) {
  const { colors } = useTheme()
  const [form, setForm] = useState(emptyForm)
  const careProfile = lookupPlant(plant?.species)

  useEffect(() => {
    if (visible) setForm(emptyForm())
  }, [visible])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const moistureInt = form.moisture === '' ? null : Number(form.moisture)

  const pending = []
  if (form.moisture !== '') pending.push('reading')
  if (String(form.waterAmount).trim() !== '') pending.push('watering')
  if (form.health !== 'no_change') pending.push('health')
  if (form.notes.trim() !== '') pending.push('note')
  const hasSomething = pending.length > 0

  const suspicious = isSuspiciousReading(plant, form.moisture, null)
  const weakWater =
    careProfile?.minWaterAmount &&
    String(form.waterAmount).trim() !== '' &&
    !isSignificantWatering({ amount: form.waterAmount, unit: form.waterUnit }, careProfile)

  function handleSave() {
    if (!hasSomething) return
    onSubmit({ ...form })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.overlayScrim }]} onPress={onClose}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.title, { color: colors.text }]}>Log entry</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                for {plant?.name || plant?.species || 'this plant'}
              </Text>

              {/* Moisture */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Moisture reading</Text>
              {form.moisture === '' ? (
                <Pressable
                  style={[styles.addBtn, { borderColor: colors.border }]}
                  onPress={() => set('moisture', 5)}
                >
                  <Text style={[styles.addBtnText, { color: colors.primary }]}>+ Add moisture reading</Text>
                </Pressable>
              ) : (
                <View style={styles.stepperRow}>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}
                    onPress={() => set('moisture', Math.max(0, (moistureInt ?? 0) - 1))}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.stepValue, { color: colors.text }]}>{form.moisture} / 10</Text>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}
                    onPress={() => set('moisture', Math.min(10, (moistureInt ?? 0) + 1))}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
                  </Pressable>
                  <Pressable style={styles.clearBtn} onPress={() => set('moisture', '')}>
                    <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
                  </Pressable>
                </View>
              )}
              {suspicious && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  📍 Lower than before you watered — probe placement can cause this. Try a few spots, use the highest.
                </Text>
              )}

              {/* Watering */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Watering</Text>
              <View style={styles.waterRow}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: colors.surfaceInset, borderColor: colors.border, color: colors.text }]}
                  placeholder="Amount e.g. 1, 0.5"
                  placeholderTextColor={colors.textSoft}
                  keyboardType="decimal-pad"
                  value={form.waterAmount}
                  onChangeText={v => set('waterAmount', v)}
                />
              </View>
              <View style={styles.unitRow}>
                {UNIT_OPTIONS.map(u => (
                  <Pressable
                    key={u}
                    onPress={() => set('waterUnit', u)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      form.waterUnit === u && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: form.waterUnit === u ? colors.primary : colors.textMuted }]}>
                      {u[0].toUpperCase() + u.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {weakWater && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  For a flood-and-dry plant, consider watering more thoroughly.
                </Text>
              )}

              {/* Health */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Health change</Text>
              <View style={styles.healthWrap}>
                {HEALTH_OPTIONS.map(o => (
                  <Pressable
                    key={o.value}
                    onPress={() => set('health', o.value)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      form.health === o.value && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: form.health === o.value ? colors.primary : colors.textMuted }]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Notes */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.surfaceInset, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. brown spots on lower leaf…"
                placeholderTextColor={colors.textSoft}
                multiline
                value={form.notes}
                onChangeText={v => set('notes', v)}
              />

              <View style={styles.actions}>
                <Pressable style={[styles.btn, { backgroundColor: colors.surfaceMuted }]} onPress={onClose}>
                  <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: hasSomething ? colors.primary : colors.surfaceMuted }]}
                  onPress={handleSave}
                  disabled={!hasSomething}
                >
                  <Text style={[styles.btnText, { color: hasSomething ? colors.onPrimary : colors.textMuted }]}>
                    Save log
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, marginBottom: 8 },
  label: { fontSize: 13, marginTop: 16, marginBottom: 6, fontWeight: '600' },
  addBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 22, fontWeight: '700' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  clearBtn: { marginLeft: 'auto', padding: 8 },
  clearText: { fontSize: 13 },
  waterRow: { flexDirection: 'row', gap: 8 },
  unitRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  healthWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '500' },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
})
