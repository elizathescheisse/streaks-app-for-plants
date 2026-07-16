import { View, Text } from 'react-native'
import { useTheme } from '../theme/ThemeContext.js'

// Port of apps/web MoistureBar. Touch-first: the web's hover tooltips are
// replaced by an always-visible numbers row below the track (current value
// left, ideal range / dry threshold right) — no hover on a phone means
// hidden numbers are just invisible. Renders the ideal range band (or a
// threshold tick for flood-and-dry plants) plus the current-value dot,
// colored by how far the value sits from healthy.
export default function MoistureBar({ value, range, careProfile, isPredicted = false }) {
  const { colors } = useTheme()
  const [lo, hi] = range
  const pct = (v) => `${Math.max(0, Math.min(100, (v / 10) * 100))}%`

  const isFloodAndDry = careProfile?.wateringStyle === 'flood-and-dry'
  const dryThreshold = careProfile?.dryThreshold ?? lo

  // Dot color mirrors the web's dotOk / dotClose / dotOut logic.
  let dotColor
  if (isFloodAndDry) {
    if (value < dryThreshold - 1) dotColor = colors.statusStruggling
    else if (value <= dryThreshold + 1) dotColor = colors.statusOkay
    else dotColor = colors.primaryHover
  } else {
    const dist = value < lo ? lo - value : value > hi ? value - hi : 0
    if (dist === 0) dotColor = colors.primaryHover
    else if (dist <= 1) dotColor = colors.statusOkay
    else dotColor = colors.statusStruggling
  }

  return (
    <View style={{ width: '100%', marginTop: 6 }}>
      <View
        style={{
          position: 'relative',
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.moistureTrack,
        }}
      >
        {isFloodAndDry ? (
          <View
            style={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              width: 2,
              marginLeft: -1,
              left: pct(dryThreshold),
              borderRadius: 1,
              backgroundColor: 'rgba(245, 212, 0, 0.7)',
            }}
          />
        ) : (
          <View
            style={{
              position: 'absolute',
              top: 0,
              height: '100%',
              left: pct(lo),
              width: pct(hi - lo),
              borderRadius: 3,
              backgroundColor: colors.moistureIdeal,
              borderWidth: 1,
              borderColor: colors.moistureIdealBorder,
            }}
          />
        )}
        {/* Current-value dot */}
        <View
          style={{
            position: 'absolute',
            top: 3,
            marginTop: -5,
            marginLeft: -5,
            left: pct(value),
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dotColor,
          }}
        >
          {/* Dashed ring = model estimate, not a fresh reading */}
          {isPredicted && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderRadius: 9,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: 'rgba(255, 255, 255, 0.55)',
              }}
            />
          )}
        </View>
      </View>

      {/* Numbers row — hover isn't a thing on touch, so the values the web
          hides in tooltips are always visible here. "~" marks an estimate. */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 5,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: dotColor }}>
          {isPredicted ? '~' : ''}{value} / 10
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>
          {isFloodAndDry ? `water at ${dryThreshold}` : `ideal ${lo}–${hi}`}
        </Text>
      </View>
    </View>
  )
}
