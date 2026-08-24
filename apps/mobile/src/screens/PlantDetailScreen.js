import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { derivePlantCardState } from '@plant-streaks/core/plantCardState.js'
import { chartEvents, logBundles } from '@plant-streaks/core/plantSelectors.js'
import { fitMoistureSeries } from '@plant-streaks/core/plantCurve.js'
import { usePlants, getPlantById } from '../state/PlantsContext.js'
import { useTheme } from '../theme/ThemeContext.js'
import MoistureBar from '../components/MoistureBar.js'
import PlantHistoryChart from '../components/PlantHistoryChart.js'
import QuickLogModal from '../components/QuickLogModal.js'
import LogEntryModal from '../components/LogEntryModal.js'

const CHART_WINDOWS = ['1W', '1M', '3M', 'all']
const WINDOW_DAYS = { '1W': 7, '1M': 30, '3M': 90 }

// Label + bounds for a panned chart window, e.g. "Jun 21 – Jul 21".
// Mirrors windowRange() in the web PlantDetailPage.
function windowRange(windowKey, offset, oldestTs, now = Date.now()) {
  const days = WINDOW_DAYS[windowKey]
  if (!days) return { label: '', canPanBack: false }
  const ms = days * 86_400_000
  const end = now - offset * ms
  const start = end - ms
  const fmt = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return {
    label: `${fmt(start)} – ${fmt(end)}`,
    // Only offer "earlier" while there's still logged history further back.
    canPanBack: oldestTs != null && start > oldestTs,
  }
}

const HEALTH_LABELS = { thriving: 'Thriving', good: 'Healthy', okay: 'Okay', struggling: 'Struggling' }

function titleCase(s) {
  return s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s
}

function relTime(ts) {
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function waterLabel(unit, amount) {
  if (!amount) return '—'
  const n = parseFloat(amount)
  if (unit === 'cups') return `${amount} cup${n === 1 ? '' : 's'}`
  if (unit === 'liters') return `${amount} L`
  return String(amount)
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Maps a health_change value to its themed badge foreground + soft background.
function healthBadgeColors(health, colors) {
  switch (health) {
    case 'thriving':   return { fg: colors.statusThriving, bg: colors.statusThrivingSoft }
    case 'good':       return { fg: colors.statusGood, bg: colors.statusGoodSoft }
    case 'okay':       return { fg: colors.statusOkay, bg: colors.statusOkaySoft }
    case 'struggling': return { fg: colors.statusStruggling, bg: colors.statusStrugglingSoft }
    default:           return { fg: colors.textMuted, bg: colors.surfaceInset }
  }
}

export default function PlantDetailScreen({ route, navigation }) {
  const { plantId } = route.params
  const { colors } = useTheme()
  const { plants, deletePlant, addLogEntry } = usePlants()
  const [quickLog, setQuickLog] = useState(null) // 'water' | 'reading' | null
  const [logOpen, setLogOpen] = useState(false)
  const [chartWindow, setChartWindow] = useState('1M')
  // How many window-lengths back the chart is panned. 0 = the window ending now.
  const [windowOffset, setWindowOffset] = useState(0)

  const plant = getPlantById(plants, plantId)

  if (!plant) {
    // Deleted while open — bounce back home.
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgElevated }]}>
        <Text style={[styles.missing, { color: colors.textMuted }]}>Plant not found.</Text>
      </SafeAreaView>
    )
  }

  const { careProfile, hasStats, badgeMoisture, usePredicted, status, health, reading, watering, rec } =
    derivePlantCardState(plant, Date.now())
  const { readings, waterings } = chartEvents(plant)
  const bundles = logBundles(plant)
  // Fitted true-moisture line for the chart (#172). No memo needed: this
  // screen renders one plant and has no ticking re-render.
  const curve = fitMoistureSeries(plant, careProfile)

  // Chart panning bounds/label — oldest logged event caps how far back you can go.
  const oldestEventTs = [...readings, ...waterings]
    .reduce((min, e) => Math.min(min, +new Date(e.timestamp)), Infinity)
  const { label: windowRangeLabel, canPanBack } =
    windowRange(chartWindow, windowOffset, Number.isFinite(oldestEventTs) ? oldestEventTs : null)

  const name = plant.name || titleCase(plant.species)

  function confirmDelete() {
    Alert.alert('Delete plant?', `This removes ${name} and its history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deletePlant(plant.id); navigation.goBack() },
      },
    ])
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgElevated }]} edges={['top', 'left', 'right']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={10}>
          <Text style={[styles.delete, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
          <Text style={styles.bigEmoji}>{plant.emoji || '🌿'}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.species, { color: colors.textMuted }]}>
            {HEALTH_LABELS[health] ?? health}
            {plant.name && plant.species ? ` · ${titleCase(plant.species)}` : ''}
          </Text>
        </View>

        {status && (
          <View style={[styles.statusPill, { borderColor: colors.border, backgroundColor: colors.surfaceInset }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{status.label}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]} onPress={() => setQuickLog('water')}>
            <Text style={[styles.actionText, { color: colors.text }]}>💧 Water</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]} onPress={() => setQuickLog('reading')}>
            <Text style={[styles.actionText, { color: colors.text }]}>◎ Reading</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.logBtn, { backgroundColor: colors.primary }]} onPress={() => setLogOpen(true)}>
          <Text style={[styles.logBtnText, { color: colors.onPrimary }]}>+ Full log entry</Text>
        </Pressable>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current status</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Moisture</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {reading ? `${reading.moisture} / 10` : '—'}
              </Text>
              {reading && <Text style={[styles.statMeta, { color: colors.textMuted }]}>{relTime(reading.timestamp)}</Text>}
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Last watered</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {watering ? waterLabel(watering.unit, watering.amount) : '—'}
              </Text>
              {watering && <Text style={[styles.statMeta, { color: colors.textMuted }]}>{relTime(watering.timestamp)}</Text>}
            </View>
          </View>
          {hasStats && badgeMoisture != null && (
            <MoistureBar
              value={badgeMoisture}
              range={careProfile.moistureRange}
              careProfile={careProfile}
              isPredicted={usePredicted}
            />
          )}
        </View>

        {/* ── Moisture history chart ── */}
        {readings.length >= 2 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Moisture history</Text>
              <View style={styles.windowToggle}>
                {CHART_WINDOWS.map(w => (
                  <Pressable
                    key={w}
                    onPress={() => { setChartWindow(w); setWindowOffset(0) }}
                    hitSlop={6}
                    style={[
                      styles.windowBtn,
                      chartWindow === w && { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Text style={[styles.windowText, { color: chartWindow === w ? colors.primary : colors.textMuted }]}>
                      {w === 'all' ? 'All' : w}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <PlantHistoryChart
              readings={readings}
              waterings={waterings}
              careProfile={careProfile}
              window={chartWindow}
              predictedMoisture={usePredicted ? rec.predicted : null}
              fittedSegments={curve?.confident ? curve.segments : null}
              windowOffset={windowOffset}
            />
            {chartWindow !== 'all' && (
              <View style={styles.panRow}>
                <Pressable
                  onPress={() => setWindowOffset(o => o + 1)}
                  disabled={!canPanBack}
                  hitSlop={10}
                  style={[styles.panBtn, { borderColor: colors.border }, !canPanBack && styles.panBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Earlier period"
                >
                  <Text style={[styles.panBtnText, { color: colors.text }]}>‹</Text>
                </Pressable>
                <Text style={[styles.panLabel, { color: colors.textMuted }]}>
                  {windowOffset === 0 ? 'Now' : windowRangeLabel}
                </Text>
                <Pressable
                  onPress={() => setWindowOffset(o => Math.max(0, o - 1))}
                  disabled={windowOffset === 0}
                  hitSlop={10}
                  style={[styles.panBtn, { borderColor: colors.border }, windowOffset === 0 && styles.panBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Later period"
                >
                  <Text style={[styles.panBtnText, { color: colors.text }]}>›</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Log history (read-only; edit/delete tracked in #167) ── */}
        {bundles.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Log history</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>
                {bundles.length} {bundles.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            <View>
            {bundles.map((bundle, i) => {
              const ts       = bundle[0].timestamp
              const reading  = bundle.find(e => e.type === 'reading')
              const watering = bundle.find(e => e.type === 'watering')
              const healthEv = bundle.find(e => e.type === 'health_change')
              const note     = bundle.find(e => e.type === 'note')
              const badge    = healthEv ? healthBadgeColors(healthEv.health, colors) : null
              return (
                <View
                  key={bundle[0].bundleId}
                  style={[
                    styles.historyEntry,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <View style={styles.historyTop}>
                    <Text style={[styles.historyDate, { color: colors.text }]}>{fmtDate(ts)}</Text>
                    <Text style={[styles.historyTime, { color: colors.textMuted }]}>{fmtTime(ts)}</Text>
                  </View>
                  <View style={styles.historyMeta}>
                    {reading && (
                      <Text style={[styles.historyChip, { color: colors.text }]}>◎ {reading.moisture} / 10</Text>
                    )}
                    {watering && (
                      <Text style={[styles.historyChip, { color: colors.dataWater }]}>💧 {waterLabel(watering.unit, watering.amount)}</Text>
                    )}
                    {healthEv && (
                      <Text style={[styles.historyBadge, { color: badge.fg, backgroundColor: badge.bg }]}>
                        {HEALTH_LABELS[healthEv.health] ?? healthEv.health}
                      </Text>
                    )}
                  </View>
                  {note && <Text style={[styles.historyNote, { color: colors.textMuted }]}>{note.text}</Text>}
                </View>
              )
            })}
            </View>
          </View>
        )}

      </ScrollView>

      <QuickLogModal
        visible={quickLog != null}
        mode={quickLog}
        plantName={name}
        onClose={() => setQuickLog(null)}
        onSubmit={(form) => addLogEntry(plant.id, form)}
      />

      <LogEntryModal
        visible={logOpen}
        plant={plant}
        onClose={() => setLogOpen(false)}
        onSubmit={(form) => addLogEntry(plant.id, form)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  missing: { textAlign: 'center', marginTop: 40 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { fontSize: 16, fontWeight: '600' },
  delete: { fontSize: 15, fontWeight: '500' },
  body: { padding: 20, gap: 16 },
  identity: { alignItems: 'center', gap: 4 },
  bigEmoji: { fontSize: 56 },
  name: { fontSize: 24, fontWeight: '700' },
  species: { fontSize: 15 },
  statusPill: {
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: { fontSize: 14, fontWeight: '600' },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 24 },
  statItem: { gap: 2 },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statMeta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionText: { fontSize: 15, fontWeight: '500' },
  logBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  logBtnText: { fontSize: 15, fontWeight: '700' },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowToggle: { flexDirection: 'row', gap: 2 },
  windowBtn: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  windowText: { fontSize: 12, fontWeight: '600' },
  panRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },
  panBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panBtnDisabled: { opacity: 0.3 },
  panBtnText: { fontSize: 16, lineHeight: 18, fontWeight: '600' },
  panLabel: { fontSize: 12, minWidth: 128, textAlign: 'center' },
  historyCount: { fontSize: 13 },
  historyEntry: { paddingVertical: 12, gap: 6 },
  historyTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  historyDate: { fontSize: 14, fontWeight: '600' },
  historyTime: { fontSize: 12 },
  historyMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  historyChip: { fontSize: 14, fontWeight: '500' },
  historyBadge: {
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  historyNote: { fontSize: 13, lineHeight: 18 },
})
