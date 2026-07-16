import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText, G } from 'react-native-svg'
import { useTheme } from '../theme/ThemeContext.js'

// Port of the web PlantHistoryChart (hand-rolled SVG → react-native-svg).
// Same geometry/scaling math; two platform swaps:
//   • ResizeObserver → onLayout for the container width
//   • hover tooltips → tap-a-dot tooltips (tap again or tap elsewhere to hide)
const WINDOWS = [
  { key: '1W', days: 7 },
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: 'all', days: Infinity },
]

const PAD_X = 16
const TOP_ZONE = 26
const BOT_ZONE = 30
const PLOT_H = 60
const SVG_H = TOP_ZONE + PLOT_H + BOT_ZONE
const PLOT_TOP = TOP_ZONE
const PLOT_BOT = TOP_ZONE + PLOT_H

function mToY(moisture) {
  return PLOT_TOP + (1 - moisture / 10) * PLOT_H
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function waterAbbr(unit, amount) {
  if (!amount || String(amount).trim() === '') return null
  if (unit === 'cups') return `${amount}c`
  if (unit === 'liters') return `${amount}L`
  return String(amount).slice(0, 6)
}

export default function PlantHistoryChart({ readings, waterings, careProfile, window: win = '1M', predictedMoisture = null }) {
  const { colors } = useTheme()
  const [svgWidth, setSvgWidth] = useState(0)
  // tooltip: { kind: 'reading' | 'watering' | 'estimated', event?, x, y } | null
  const [tooltip, setTooltip] = useState(null)

  // Dot color by distance from the healthy range — same logic as web.
  function dotColor(moisture, profile) {
    const range = profile?.moistureRange
    if (!range || range[0] == null) return colors.chartMoistureDotDefault
    const [lo, hi] = range
    const val = Number(moisture)
    if (profile?.wateringStyle === 'flood-and-dry') {
      const dry = profile.dryThreshold ?? lo
      if (val < dry) return colors.statusStruggling
      if (val <= dry + 1) return colors.statusOkay
      return colors.statusThriving
    }
    if (val >= lo && val <= hi) return colors.statusThriving
    const dist = val < lo ? lo - val : val - hi
    if (dist <= 1) return colors.statusOkay
    return colors.statusStruggling
  }

  // Filter by window
  const windowDays = WINDOWS.find(w => w.key === win)?.days ?? Infinity
  const cutoff = windowDays === Infinity ? null : new Date(Date.now() - windowDays * 86_400_000)

  const visibleReadings = (readings ?? [])
    .filter(r => !cutoff || new Date(r.timestamp) >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const visibleWaterings = (waterings ?? [])
    .filter(w => !cutoff || new Date(w.timestamp) >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const n = visibleReadings.length
  const usableW = svgWidth - PAD_X * 2

  // Time-based x-axis anchored to the window start — all plants share the
  // same time scale (sparse data sits right, with empty space left).
  const allTimestamps = [
    ...visibleReadings.map(r => +new Date(r.timestamp)),
    ...visibleWaterings.map(w => +new Date(w.timestamp)),
  ]
  const nowTs = Date.now()
  const windowStart = cutoff ? +cutoff : (allTimestamps.length ? Math.min(...allTimestamps) : 0)
  const tMin = allTimestamps.length ? Math.min(windowStart, Math.min(...allTimestamps)) : windowStart
  const tMax = allTimestamps.length ? Math.max(...allTimestamps) : 1
  const tMaxFull = predictedMoisture != null ? Math.max(tMax, nowTs) : tMax
  const tSpan = tMaxFull - tMin || 1

  function xAt(ts) {
    return PAD_X + ((+new Date(ts) - tMin) / tSpan) * usableW
  }

  const isFloodAndDry = careProfile?.wateringStyle === 'flood-and-dry'
  const [rLo, rHi] = careProfile?.moistureRange ?? [null, null]
  const rangeY1 = rHi != null ? mToY(rHi) : null
  const rangeY2 = rLo != null ? mToY(rLo) : null
  const dryThreshold = careProfile?.dryThreshold ?? rLo
  const thresholdY = dryThreshold != null ? mToY(dryThreshold) : null

  // Group same-day readings so they share one centered date label
  const dateMap = new Map()
  visibleReadings.forEach(r => {
    const key = fmtDate(r.timestamp)
    const x = xAt(r.timestamp)
    if (!dateMap.has(key)) dateMap.set(key, { key, minX: x, maxX: x })
    else {
      const g = dateMap.get(key)
      g.minX = Math.min(g.minX, x)
      g.maxX = Math.max(g.maxX, x)
    }
  })
  const uniqueDates = [...dateMap.values()]
    .sort((a, b) => a.minX - b.minX)
    .map(g => ({ dateStr: g.key, x: (g.minX + g.maxX) / 2 }))

  // Sample up to 6 labels; drop true collisions, stagger near-collisions.
  const MAX_LABELS = 6
  const DROP_SPACING = 18
  const STAGGER_AT = 56
  const nd = uniqueDates.length
  let sampled
  if (nd <= MAX_LABELS) {
    sampled = uniqueDates
  } else {
    const picked = new Set([0, nd - 1])
    for (let i = 1; i < MAX_LABELS - 1; i++) {
      picked.add(Math.round(i * (nd - 1) / (MAX_LABELS - 1)))
    }
    sampled = [...picked].sort((a, b) => a - b).map(i => uniqueDates[i])
  }
  const dateLabels = []
  let lastLabelX = -Infinity
  for (const l of sampled) {
    const gap = l.x - lastLabelX
    if (gap < DROP_SPACING) continue
    dateLabels.push({ ...l, row: gap < STAGGER_AT ? 1 : 0 })
    lastLabelX = l.x
  }

  const polyPoints = visibleReadings
    .map(r => `${xAt(r.timestamp)},${mToY(r.moisture)}`)
    .join(' ')

  const toggleTooltip = (next) => {
    setTooltip(t => {
      if (!t) return next
      const same = t.kind === next.kind && t.event?.id === next.event?.id
      return same ? null : next
    })
  }

  return (
    <View
      style={styles.wrap}
      onLayout={e => setSvgWidth(e.nativeEvent.layout.width)}
    >
      {n < 2 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Not enough readings for this range
        </Text>
      ) : svgWidth > 0 && (
        <View>
          {tooltip && (
            <View
              style={[
                styles.tooltip,
                { backgroundColor: colors.surface2, borderColor: colors.border },
                {
                  left: Math.min(Math.max(tooltip.x - 48, 0), svgWidth - 96),
                  top: Math.max(tooltip.y - 44, 0),
                },
              ]}
              pointerEvents="none"
            >
              <Text style={[styles.tooltipValue, { color: colors.text }]}>
                {tooltip.kind === 'watering'
                  ? `💧 ${tooltip.event.amount} ${tooltip.event.unit}`
                  : tooltip.kind === 'estimated'
                  ? `◎ ~${Math.round(predictedMoisture)} (estimated)`
                  : `◎ ${tooltip.event.moisture} / 10`}
              </Text>
              {tooltip.kind !== 'estimated' && (
                <Text style={[styles.tooltipDate, { color: colors.textMuted }]}>
                  {fmtDateTime(tooltip.event.timestamp)}
                </Text>
              )}
            </View>
          )}

          <Svg width={svgWidth} height={SVG_H}>
            {/* Flood-and-dry: dashed threshold line */}
            {isFloodAndDry && thresholdY != null && (
              <Line
                x1={PAD_X} y1={thresholdY} x2={svgWidth - PAD_X} y2={thresholdY}
                stroke={colors.chartWaterLine} strokeWidth={1} strokeDasharray="4,3"
              />
            )}

            {/* Consistent: ideal range band */}
            {!isFloodAndDry && rangeY1 != null && (
              <G>
                <Rect
                  x={PAD_X} y={rangeY1}
                  width={usableW} height={rangeY2 - rangeY1}
                  fill={colors.chartIdealFill}
                />
                <Line x1={PAD_X} y1={rangeY1} x2={svgWidth - PAD_X} y2={rangeY1}
                  stroke={colors.chartIdealLine} strokeWidth={0.75} strokeDasharray="4,3" />
                <Line x1={PAD_X} y1={rangeY2} x2={svgWidth - PAD_X} y2={rangeY2}
                  stroke={colors.chartIdealLine} strokeWidth={0.75} strokeDasharray="4,3" />
              </G>
            )}

            {/* Moisture trend line */}
            <Polyline
              points={polyPoints}
              fill="none"
              stroke={colors.chartMoistureLine}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Reading dots — tap to toggle tooltip */}
            {visibleReadings.map(r => {
              const x = xAt(r.timestamp)
              const y = mToY(r.moisture)
              const isActive = tooltip?.event?.id === r.id
              return (
                <G key={r.id}>
                  <Circle
                    cx={x} cy={y}
                    r={isActive ? 5.5 : 4}
                    fill={dotColor(r.moisture, careProfile)}
                    opacity={0.9}
                  />
                  {/* invisible larger hit target */}
                  <Circle
                    cx={x} cy={y} r={12}
                    fill="transparent"
                    onPress={() => toggleTooltip({ kind: 'reading', event: r, x, y })}
                  />
                </G>
              )
            })}

            {/* Estimated "now" projection */}
            {predictedMoisture != null && visibleReadings.length >= 1 && (() => {
              const lastR = visibleReadings[visibleReadings.length - 1]
              const estX = xAt(nowTs)
              const estY = mToY(Math.min(10, Math.max(0, predictedMoisture)))
              const isActive = tooltip?.kind === 'estimated'
              return (
                <G key="est">
                  <Line
                    x1={xAt(lastR.timestamp)} y1={mToY(lastR.moisture)}
                    x2={estX} y2={estY}
                    stroke={colors.chartMoistureLineFaint}
                    strokeWidth={1.5}
                    strokeDasharray="3,3"
                    strokeLinecap="round"
                  />
                  <Circle
                    cx={estX} cy={estY}
                    r={isActive ? 5.5 : 4}
                    fill={dotColor(predictedMoisture, careProfile)}
                  />
                  <Circle
                    cx={estX} cy={estY}
                    r={isActive ? 9 : 7.5}
                    fill="none"
                    stroke={colors.chartEstimatedRing}
                    strokeWidth={1.5}
                    strokeDasharray="3,2.5"
                  />
                  <Circle
                    cx={estX} cy={estY} r={14}
                    fill="transparent"
                    onPress={() => toggleTooltip({ kind: 'estimated', x: estX, y: estY })}
                  />
                  <SvgText
                    x={estX} y={PLOT_BOT + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={colors.chartAxisLabel}
                  >today</SvgText>
                </G>
              )
            })()}

            {/* Watering annotations */}
            {visibleWaterings.map(w => {
              const x = xAt(w.timestamp)
              const label = waterAbbr(w.unit, w.amount)
              if (!label) return null
              return (
                <G key={w.id}>
                  <Line
                    x1={x} y1={PLOT_TOP - 4} x2={x} y2={PLOT_BOT}
                    stroke={colors.chartMoistureLineMuted}
                    strokeWidth={0.75}
                    strokeDasharray="2,2"
                  />
                  <SvgText
                    x={x} y={PLOT_TOP - 6}
                    textAnchor="middle"
                    fontSize={8.5}
                    fill={colors.chartWaterLabel}
                  >💧{label}</SvgText>
                  <Rect
                    x={x - 14} y={PLOT_TOP - 16}
                    width={28} height={20}
                    fill="transparent"
                    onPress={() => toggleTooltip({ kind: 'watering', event: w, x, y: PLOT_TOP - 8 })}
                  />
                </G>
              )
            })}

            {/* Date labels */}
            {dateLabels.map((l, i) => (
              <SvgText
                key={`dl-${l.dateStr}`}
                x={l.x}
                y={PLOT_BOT + 14 + (l.row ?? 0) * 11}
                textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'}
                fontSize={9}
                fill={colors.chartAxisLabel}
              >{l.dateStr}</SvgText>
            ))}

            {/* Y-axis labels */}
            {[0, 5, 10].map(v => (
              <SvgText
                key={`yl-${v}`}
                x={PAD_X - 4}
                y={mToY(v) + 3}
                textAnchor="end"
                fontSize={8}
                fill={colors.chartAxisLabelFaint}
              >{v}</SvgText>
            ))}
          </Svg>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  tooltip: {
    position: 'absolute',
    zIndex: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
  },
  tooltipValue: { fontSize: 12, fontWeight: '600' },
  tooltipDate: { fontSize: 10, marginTop: 1 },
})
