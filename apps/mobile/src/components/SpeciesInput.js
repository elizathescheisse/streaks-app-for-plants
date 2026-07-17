import { useState, useMemo, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { PLANT_SEARCH_INDEX } from '@plant-streaks/core/plantDatabase.js'
import { useTheme } from '../theme/ThemeContext.js'

const MAX_RESULTS = 8

// Mobile twin of the web SpeciesInput: a species picker that behaves as a
// dropdown (tap the field to see the curated list) and a typeahead (type to
// filter). Free-form text is accepted too, so users can enter species the
// database doesn't know about.
//
// onChange is called with either the canonical DB key (when a suggestion is
// tapped, so lookupPlant() can find the care profile) or the raw typed string
// (custom species). The visible text is tracked internally so a tapped
// suggestion can show its nicely-cased displayName while the stored value
// stays the lowercase key.
export default function SpeciesInput({ value, onChange, inputStyle }) {
  const { colors } = useTheme()
  const [query, setQuery] = useState(value ?? '')
  const [open, setOpen] = useState(false)

  // Sync external resets (e.g. the form clearing after save).
  useEffect(() => { setQuery(value ?? '') }, [value])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return PLANT_SEARCH_INDEX.slice(0, MAX_RESULTS)
    return PLANT_SEARCH_INDEX
      .filter(entry => entry.terms.some(t => t.includes(q)))
      .slice(0, MAX_RESULTS)
  }, [query])

  function handleChangeText(text) {
    setQuery(text)
    onChange(text)          // propagate typed value (allows custom species)
    setOpen(true)
  }

  function selectEntry(entry) {
    setQuery(entry.displayName)
    onChange(entry.key)     // store the canonical lowercase DB key
    setOpen(false)
  }

  return (
    <View>
      <View>
        <TextInput
          style={[inputStyle, { paddingRight: 34 }]}
          placeholder="Pick a species or type your own…"
          placeholderTextColor={colors.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setOpen(true)}
        />
        <Pressable
          style={styles.chevron}
          onPress={() => setOpen(o => !o)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide species list' : 'Show species list'}
        >
          <Text style={[styles.chevronText, { color: colors.textMuted }, open && styles.chevronOpen]}>▾</Text>
        </Pressable>
      </View>

      {open && suggestions.length > 0 && (
        <ScrollView
          style={[styles.dropdown, { backgroundColor: colors.surfaceInset, borderColor: colors.border }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {suggestions.map((entry, i) => (
            <Pressable
              key={entry.key}
              onPress={() => selectEntry(entry)}
              style={({ pressed }) => [
                styles.item,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Text style={[styles.itemMain, { color: colors.text }]}>{entry.displayName}</Text>
              {entry.commonNames.length > 0 && (
                <Text style={[styles.itemSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {entry.commonNames.join(', ')}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chevron: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  chevronText: { fontSize: 14 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 220,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemMain: { fontSize: 15, fontWeight: '500' },
  itemSub: { fontSize: 12, marginTop: 2 },
})
