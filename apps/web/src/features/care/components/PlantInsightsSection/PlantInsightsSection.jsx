import styles from './PlantInsightsSection.module.css'
import { generateInsight } from '@plant-streaks/core/plantInsights.js'
import {
  pctTimeInRange,
  avgWateringInterval,
  idealWateringInterval,
  avgPourAmount,
  predictedLandingMoisture,
  typicalWaterAmount,
  getEvents,
} from '@plant-streaks/core/plantSelectors.js'

// Watering style/light/humidity consolidated in from the old sidebar Care
// guide card (#201) — static per-species reference info that reads better
// as rows here than as its own tabbed card competing with the AI chat for
// space. The card's "Recommended pour" row was dropped again shortly after
// (#205): once real watering history exists, it was near-duplicate of
// "Typical pour" below (median-of-significant-waterings vs. average of all
// waterings — usually close enough to read as the same fact stated twice).
// A pour that's too small to reach the healthy range is still surfaced —
// via generateInsight()'s case 4 ("your typical pour... lands just short of
// its healthy floor"), which uses this same avgPourAmount/predictedLanding
// data, so no signal was actually lost.
//
// Brought "Recommended pour" back in a narrower form for a brand-new plant
// (#206): it now only shows in the window before Typical Pour has enough
// data to compute (species default, learned override, etc.), and
// disappears the moment Typical Pour takes over — so the two can never be
// visible at once, which is what made them redundant before.
const LIGHT_LABELS = {
  'direct':          '☀️ Direct sun',
  'bright-indirect': '🌤 Bright indirect',
  'low-indirect':    '🌥 Low indirect',
  'low':             '🌑 Low light',
}
const HUMIDITY_LABELS = {
  'high':   '💧 High humidity',
  'medium': '🌢 Medium humidity',
  'low':    '🏜 Low humidity',
}
const WATERING_STYLE_LABELS = {
  'flood-and-dry': '🌊 Flood & dry out',
  'consistent':    '🪣 Consistent moisture',
}

function barColor(pct) {
  if (pct >= 80) return styles.barGreen
  if (pct >= 50) return styles.barYellow
  return styles.barRed
}

function roundDays(days) {
  return days < 1.5 ? '1' : String(Math.round(days))
}

export default function PlantInsightsSection({ plant, model, rec, careProfile }) {
  const range = careProfile?.moistureRange
  const readings = getEvents(plant, 'reading')

  // The computed/personalized rows below need real logged history; the
  // static care-facts rows further down (watering style/light/humidity)
  // don't — they should still show for a brand-new plant with no readings
  // yet, unlike before when nothing in this section would render until
  // 3+ readings existed.
  const hasComputedInsights = !!range && readings.length >= 3

  let pct, avgInterval, idealInterval, pour, landing, insight
  let intervalLong, pourShort, daysUntilDry, showRunway
  if (hasComputedInsights) {
    pct = pctTimeInRange(plant, careProfile)
    avgInterval = avgWateringInterval(plant)
    idealInterval = idealWateringInterval(model, careProfile)
    pour = avgPourAmount(plant)
    landing = model && pour ? predictedLandingMoisture(plant, model, careProfile) : null
    insight = generateInsight(plant, model, careProfile)

    intervalLong = avgInterval != null && idealInterval != null && avgInterval > idealInterval * 1.3
    pourShort = landing != null && range && landing < range[0]

    daysUntilDry = rec?.daysUntilDry
    showRunway = daysUntilDry != null && daysUntilDry > 0
  }

  const showTypicalPour = landing != null && !!pour

  // Bridge to Typical Pour — same override → learned-history → species-
  // default chain as before, but only surfaced while Typical Pour can't
  // compute yet (no watering history logged).
  const recommended = (!showTypicalPour && careProfile) ? typicalWaterAmount(plant, careProfile) : null
  const isFloodAndDry = careProfile?.wateringStyle === 'flood-and-dry'
  const soakText = !showTypicalPour && isFloodAndDry && (!recommended || recommended.source === 'species')
  const recommendedLabel = recommended
    ? (recommended.unit === 'liters'
        ? `~${recommended.amount} L`
        : `~${recommended.amount} cup${recommended.amount === 1 ? '' : 's'}`)
    : null

  const hasCareFacts = !!careProfile && (
    careProfile.wateringStyle || careProfile.light || careProfile.humidity || recommended || soakText
  )

  if (!hasComputedInsights && !hasCareFacts && !careProfile?.notes) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Insights</h2>

      {hasComputedInsights && (
        <>
          {pct != null && (
            <div className={styles.inRangeRow}>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${barColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.barLabel}>{pct}% of readings in healthy range</span>
            </div>
          )}

          <div className={styles.statGrid}>
            {avgInterval != null && idealInterval != null && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Watering interval</span>
                <span className={styles.statValue}>
                  every ~{roundDays(avgInterval)}d
                  <span className={styles.statSep}>·</span>
                  ideal ~{roundDays(idealInterval)}d
                  <span className={intervalLong ? styles.iconWarn : styles.iconOk}>
                    {intervalLong ? '⚠' : '✓'}
                  </span>
                </span>
              </div>
            )}

            {showTypicalPour && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Typical pour</span>
                <span className={styles.statValue}>
                  {pour.amount} {pour.unit} → ~{landing.toFixed(1)} after watering
                  <span className={pourShort ? styles.iconWarn : styles.iconOk}>
                    {pourShort ? '⚠' : '✓'}
                  </span>
                </span>
              </div>
            )}

            {showRunway && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Water needed in</span>
                <span className={styles.statValue}>~{roundDays(daysUntilDry)} day{daysUntilDry >= 1.5 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <p className={styles.insightText}>{insight}</p>
        </>
      )}

      {hasCareFacts && (
        <div className={styles.statGrid}>
          {careProfile.wateringStyle && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Watering style</span>
              <span className={styles.statValue}>
                {WATERING_STYLE_LABELS[careProfile.wateringStyle] ?? careProfile.wateringStyle}
                {careProfile.wateringFrequency && (
                  <>
                    <span className={styles.statSep}>·</span>
                    {careProfile.wateringFrequency}
                  </>
                )}
              </span>
            </div>
          )}

          {careProfile.light && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Light</span>
              <span className={styles.statValue}>{LIGHT_LABELS[careProfile.light] ?? careProfile.light}</span>
            </div>
          )}

          {careProfile.humidity && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Humidity</span>
              <span className={styles.statValue}>{HUMIDITY_LABELS[careProfile.humidity] ?? careProfile.humidity}</span>
            </div>
          )}

          {(recommended || soakText) && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Recommended pour</span>
              <span className={styles.statValue}>
                {soakText ? 'Soak until water drains out' : recommendedLabel}
                {recommended?.source === 'history' && (
                  <>
                    <span className={styles.statSep}>·</span>
                    learned from your waterings
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {careProfile?.notes && (
        <p className={styles.careNote}>{careProfile.notes}</p>
      )}
    </section>
  )
}
