/**
 * Fitted "true moisture" curve — the chart's best guess of what the soil
 * actually did over time, as opposed to what the noisy probe happened to read.
 *
 * The idea (GPS-in-a-tunnel): we know how moisture *behaves* — it drains at
 * roughly β points/day between waterings and jumps by roughly α·amount at each
 * watering — and we have noisy glimpses of it (the readings). This module
 * combines the two: per drying cycle it fits a straight decay line through ALL
 * of that cycle's readings, weighting each reading by how well it agrees with
 * the trend, then chains the cycles together so what physics expects from each
 * pour and what later readings reveal both inform every stretch of the line.
 *
 * Deliberate divergence from computeModel / smoothedCurrentMoisture: those
 * DISCARD post-watering readings below the pre-watering level (dry-pocket
 * artifacts) because a single bad anchor would corrupt α or the displayed
 * "current" value. Here every reading keeps a vote — an off-trend reading's
 * vote shrinks smoothly (see IRLS_K) so it tugs the line a little instead of
 * dragging it. A 4 → 1 → 4 stretch fits as "steady ~4 with a slight dip", not
 * a spike to 1. (Issue #172.)
 */

import { getEvents, typicalWaterAmount } from './plantSelectors.js'
import {
  computeModel, segmentCycles, linearFit, weightedLinearFit, parseAmount,
  getPredictionReliability, DEFAULT_ALPHA, DEFAULT_BETA, BETA_CEILING,
} from './plantModel.js'

// How fast an off-trend reading loses its vote: a reading 1.5 pts off the
// trend counts about half; 3 pts off counts ~20%. Never zero — every reading
// stays evidence.
const IRLS_K = 1.5
// A cycle's own slope needs this many readings of evidence to outvote the
// plant's overall learned drying rate (few points → lean on what we know).
const SLOPE_PRIOR_N = 2
// The physics expectation for a cycle's starting level ("previous level +
// α·amount poured") counts like this many clean readings when blended with
// what the readings say — so the first post-watering reading informs the
// start level but can't single-handedly set it.
const LEVEL_PRIOR_W = 2
// Hindsight weight: what the NEXT cycle's level implies about this cycle's
// end counts like one clean reading. This is how a later good reading can
// vouch for (or against) an earlier noisy stretch.
const BACKWARD_W = 1
// Same confidence floor as getRecommendation's 'low' tier.
const MIN_SAMPLES = 3

const DAY_MS = 86_400_000

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const tsOf = (e) => new Date(e.timestamp).getTime()

// ─────────────────────────────────────────────────────────
// fitMoistureSeries(plant, careProfile, { backward = true })
//
// Returns { confident, segments } or null when there are fewer than 2
// readings (nothing to fit).
//
//   segments: [{ startTs, endTs, startLevel, endLevel }]
//     — ms-epoch timestamps, levels clamped 0–10, sorted by time,
//       contiguous in time but level-discontinuous at waterings (the jump).
//     The series never extends past the last reading: the existing
//     "estimated now" projection owns the last-reading → now stretch.
//
//   confident: whether the model has earned the right to draw this line
//     (same signals that gate the estimated-now dot, minus its recency
//     conditions — recency matters for a *now* estimate, not history).
//     Callers show the fitted line only when true.
// ─────────────────────────────────────────────────────────
export function fitMoistureSeries(plant, careProfile, { backward = true } = {}) {
  const allReadings = getEvents(plant, 'reading')
  if (allReadings.length < 2) return null
  const lastReadingTs = tsOf(allReadings[allReadings.length - 1])

  const model = computeModel(plant, careProfile)
  const betaG = model.beta ?? DEFAULT_BETA
  const alpha = model.alpha ?? DEFAULT_ALPHA
  const typicalAmt = typicalWaterAmount(plant, careProfile)?.amount ?? 0

  // ── Per-cycle robust fit: slope + level evidence ──────────────────────
  const infos = []
  for (const cycle of segmentCycles(plant)) {
    const originTs = cycle.watering
      ? tsOf(cycle.watering)
      : (cycle.readings.length ? tsOf(cycle.readings[0]) : null)
    if (originTs == null) continue // empty leading cycle — nothing anchors it

    const points = cycle.readings.map(r => ({
      x: (tsOf(r) - originTs) / DAY_MS,
      y: Number(r.moisture),
    }))

    // Plain fit first, then one reweighting pass: each reading's vote shrinks
    // with its distance from the first fit (Cauchy weights), and the line is
    // refit. One pass is enough — iterating to convergence buys little here
    // and makes the behavior harder to reason about.
    let weights = points.map(() => 1)
    let fit = linearFit(points)
    if (fit) {
      weights = points.map(p => {
        const resid = p.y - (fit.intercept + fit.slope * p.x)
        return 1 / (1 + (resid / IRLS_K) ** 2)
      })
      fit = weightedLinearFit(points, weights) ?? fit
    }

    // Cycle slope, shrunk toward the plant's overall drying rate: with n
    // readings of evidence vs SLOPE_PRIOR_N votes for βg. Rising or absent
    // fits fall back to βg via the clamp / null branch.
    const betaI = fit
      ? clamp(
          (points.length * -fit.slope + SLOPE_PRIOR_N * betaG) / (points.length + SLOPE_PRIOR_N),
          0, BETA_CEILING,
        )
      : betaG

    // Level evidence: back-project every reading to the cycle start along the
    // slope and take the weighted mean. W is the total evidence mass — how
    // many "clean readings' worth" of observation this cycle carries.
    let levelObs = null
    let W = 0
    if (points.length) {
      let sw = 0, swv = 0
      for (let i = 0; i < points.length; i++) {
        sw += weights[i]
        swv += weights[i] * (points[i].y + betaI * points[i].x)
      }
      levelObs = swv / sw
      W = sw
    }

    // Water amount for the jump prior. Unparseable pours fall back to the
    // plant's typical amount so the chain doesn't break on a sloppy log entry.
    const amt = cycle.watering
      ? (parseAmount(cycle.watering.amount) ?? typicalAmt)
      : 0

    infos.push({ originTs, betaI, levelObs, W, amt, hasWatering: !!cycle.watering, level: null })
  }
  if (!infos.length) return null

  // Each cycle runs to the next cycle's origin (the next watering moment);
  // the final stretch runs to the last reading. Nothing extends past the last
  // reading — trailing cycles that start after it are dropped below.
  for (let i = 0; i < infos.length; i++) {
    const naturalEnd = i + 1 < infos.length ? infos[i + 1].originTs : lastReadingTs
    infos[i].endTs = Math.min(naturalEnd, lastReadingTs)
    infos[i].durDays = Math.max(0, (infos[i].endTs - infos[i].originTs) / DAY_MS)
  }

  // ── Forward pass: chain cycles with the physics prior ─────────────────
  // Walk oldest → newest carrying the fitted level at each cycle's end. The
  // next cycle's starting level is a blend of "previous end + α·amount"
  // (weight LEVEL_PRIOR_W) and what its own readings say (weight W).
  let prevEnd = null
  for (const info of infos) {
    const prior = (info.hasWatering && prevEnd != null)
      ? clamp(prevEnd + alpha * info.amt, 0, 10)
      : null
    info.prior = prior

    if (info.levelObs == null && prior == null) {
      // Un-anchorable (e.g. history starts with a watering, no readings yet in
      // this cycle) — no level, and nothing to carry forward.
      prevEnd = null
      continue
    }
    info.level = blend([
      [info.W, info.levelObs],
      [LEVEL_PRIOR_W, prior],
    ])
    prevEnd = clamp(info.level - info.betaI * info.durDays, 0, 10)
  }

  // ── One backward sweep: hindsight ─────────────────────────────────────
  // A later cycle's fitted level implies what this cycle must have ended at
  // (undo the jump: next level − α·amount), hence what it started at (climb
  // back up the slope). Re-blend that in with weight BACKWARD_W. One sweep,
  // newest → oldest; deliberately not iterated to a fixed point.
  if (backward) {
    for (let i = infos.length - 2; i >= 0; i--) {
      const next = infos[i + 1]
      if (infos[i].level == null || next.level == null || !next.hasWatering) continue
      const endBack = clamp(next.level - alpha * next.amt, 0, 10)
      const levelBack = clamp(endBack + infos[i].betaI * infos[i].durDays, 0, 10)
      infos[i].level = blend([
        [infos[i].W, infos[i].levelObs],
        [LEVEL_PRIOR_W, infos[i].prior],
        [BACKWARD_W, levelBack],
      ])
    }
  }

  // ── Emit segments ─────────────────────────────────────────────────────
  const segments = []
  for (const info of infos) {
    if (info.level == null) continue
    if (info.originTs >= lastReadingTs) continue // nothing past the last reading
    if (info.endTs <= info.originTs) continue    // zero-length (back-to-back waterings)
    segments.push({
      startTs: info.originTs,
      endTs: info.endTs,
      startLevel: clamp(info.level, 0, 10),
      endLevel: clamp(info.level - info.betaI * info.durDays, 0, 10),
    })
  }
  if (!segments.length) return null

  const confident =
    model.beta != null &&
    model.betaSamples + model.alphaSamples >= MIN_SAMPLES &&
    getPredictionReliability(plant, careProfile) !== 'shaky'

  return { confident, segments }
}

// Weighted mean of [weight, value] pairs, skipping null values.
// Returns null when nothing contributes.
function blend(pairs) {
  let sw = 0, sv = 0
  for (const [w, v] of pairs) {
    if (v == null || w <= 0) continue
    sw += w
    sv += w * v
  }
  return sw > 0 ? sv / sw : null
}

// ─────────────────────────────────────────────────────────
// fittedLevelAt(segments, ts)
// The fitted line's value at a timestamp — linear interpolation inside the
// segment containing ts, null outside every segment. At a watering boundary
// (shared by two segments) the PRE-watering segment wins, matching how the
// jump is drawn.
// ─────────────────────────────────────────────────────────
export function fittedLevelAt(segments, ts) {
  if (!segments?.length) return null
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime()
  const seg = segments.find(s => t >= s.startTs && t <= s.endTs)
  if (!seg) return null
  const frac = (t - seg.startTs) / (seg.endTs - seg.startTs)
  return seg.startLevel + (seg.endLevel - seg.startLevel) * frac
}
