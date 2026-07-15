import { useState, useMemo } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getPlantSortPriority } from '@plant-streaks/core/plantStatus.js'
import { usePlants } from '../state/PlantsContext.js'
import { useTheme } from '../theme/ThemeContext.js'
import PlantCard from '../components/PlantCard.js'
import AddPlantModal from '../components/AddPlantModal.js'
import QuickLogModal from '../components/QuickLogModal.js'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme()
  const { plants, addPlant, addLogEntry } = usePlants()
  const [addOpen, setAddOpen] = useState(false)
  const [quickLog, setQuickLog] = useState(null) // { plant, mode } | null
  const now = Date.now()

  const sorted = useMemo(
    () => [...plants].sort((a, b) => getPlantSortPriority(a) - getPlantSortPriority(b)),
    [plants],
  )

  const header = (
    <View style={styles.headerBlock}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Your garden 🌿</Text>
      <Text style={[styles.date, { color: colors.text }]}>{formatDate(new Date(now))}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Log your plants' health and watering for today.
      </Text>
      <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddOpen(true)}>
        <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+ Add Plant</Text>
      </Pressable>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgElevated }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={sorted}
        keyExtractor={p => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No plants yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Add your first plant to start tracking watering and moisture.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PlantCard
            plant={item}
            now={now}
            onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
            onWater={() => setQuickLog({ plant: item, mode: 'water' })}
            onReading={() => setQuickLog({ plant: item, mode: 'reading' })}
          />
        )}
      />

      <AddPlantModal visible={addOpen} onClose={() => setAddOpen(false)} onAdd={addPlant} />

      <QuickLogModal
        visible={quickLog != null}
        mode={quickLog?.mode}
        plantName={quickLog?.plant?.name || quickLog?.plant?.species || ''}
        onClose={() => setQuickLog(null)}
        onSubmit={(form) => addLogEntry(quickLog.plant.id, form)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 40 },
  headerBlock: { marginBottom: 20 },
  eyebrow: { fontSize: 14, fontWeight: '600' },
  date: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  hint: { fontSize: 15, marginTop: 4 },
  addBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
})
