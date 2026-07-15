import { View, Text, Pressable, StyleSheet } from 'react-native'
import { derivePlantCardState } from '@plant-streaks/core/plantCardState.js'
import { useTheme } from '../theme/ThemeContext.js'
import MoistureBar from './MoistureBar.js'

const HEALTH_LABELS = { thriving: 'Thriving', good: 'Healthy', okay: 'Okay', struggling: 'Struggling' }

function titleCase(s) {
  return s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s
}

// Maps a status `cls` from core to its themed foreground + soft bg/border.
function statusColors(cls, colors) {
  switch (cls) {
    case 'struggling': return { fg: colors.statusStruggling, bg: colors.statusStrugglingSoft, border: colors.statusStrugglingBorder }
    case 'water':      return { fg: colors.statusWater, bg: colors.statusWaterSoft, border: colors.statusWaterBorder }
    case 'thriving':   return { fg: colors.statusThriving, bg: colors.statusThrivingSoft, border: colors.statusThrivingBorder }
    case 'okay':       return { fg: colors.statusOkay, bg: colors.statusOkaySoft, border: colors.statusOkayBorder }
    case 'check':      return { fg: colors.checkBadge, bg: colors.checkBadgeSoft, border: colors.checkBadgeBorder }
    default:           return { fg: colors.textMuted, bg: colors.surfaceInset, border: colors.border }
  }
}

export default function PlantCard({ plant, now, onPress, onWater, onReading }) {
  const { colors } = useTheme()
  const {
    careProfile, hasStats, badgeMoisture, usePredicted, status, health,
  } = derivePlantCardState(plant, now)

  const isUrgent = status?.cls === 'struggling'
  const s = statusColors(status?.cls, colors)
  const name = plant.name || titleCase(plant.species)

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isUrgent && { backgroundColor: colors.cardStrugglingBg, borderColor: colors.cardStrugglingBorder },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceInset }]}>
          <Text style={styles.emoji}>{plant.emoji || '🌿'}</Text>
        </View>
        <Pressable style={styles.identity} onPress={onPress} hitSlop={8}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name} <Text style={{ color: colors.textMuted }}>›</Text>
          </Text>
          <Text style={[styles.species, { color: colors.textMuted }]} numberOfLines={1}>
            {HEALTH_LABELS[health] ?? health}
            {plant.name && plant.species ? ` · ${titleCase(plant.species)}` : ''}
          </Text>
        </Pressable>
        {status && (
          <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <Text style={[styles.badgeText, { color: s.fg }]} numberOfLines={1}>{status.label}</Text>
          </View>
        )}
      </View>

      {hasStats && badgeMoisture != null && (
        <MoistureBar
          value={badgeMoisture}
          range={careProfile.moistureRange}
          careProfile={careProfile}
          isPredicted={usePredicted}
        />
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]} onPress={onWater}>
          <Text style={[styles.actionText, { color: colors.text }]}>💧 Water</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]} onPress={onReading}>
          <Text style={[styles.actionText, { color: colors.text }]}>◎ Reading</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  identity: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  species: { fontSize: 13, marginTop: 2 },
  badge: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 150,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '500' },
})
