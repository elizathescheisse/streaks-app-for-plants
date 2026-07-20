#!/usr/bin/env node
/**
 * Offline go/no-go gate for the fitted "true moisture" line (#172).
 *
 * Replays a real exported dataset and asks: does the fitted curve estimate a
 * held-out reading better than the straight-line interpolation the chart's
 * current raw polyline visually asserts?
 *
 * Method — leave-one-out: for every reading that has at least one reading
 * before AND after it, remove it, refit, and score each estimator's guess at
 * the removed reading's timestamp against the actual value. Neither the
 * fitted curve nor the interpolation baseline sees the held-out point, so
 * it's a fair fight between two smoothers.
 *
 *   fitted      — fitMoistureSeries without the backward sweep
 *   fitted+bw   — with the backward sweep
 *   interp      — straight line between the raw neighbor readings (the bar
 *                 to beat: exactly what today's polyline claims)
 *   replay      — the existing predictMoisture from strictly-prior events
 *                 (context only: it's past-only, so not the bar)
 *
 * PROCEED criterion: pooled MAE of the best fitted variant < pooled MAE of
 * interp, AND no individual plant regresses by > 0.2 moisture points.
 *
 * Usage:
 *   npm run validate:curve --workspace=packages/core -- "../../plant-streaks-2026-07-14 (1).json"
 */

import { readFileSync } from 'node:fs'
import { fitMoistureSeries, fittedLevelAt } from '../src/plantCurve.js'
import { computeModel, predictMoisture } from '../src/plantModel.js'
import { lookupPlant } from '../src/plantLookup.js'

const MIN_READINGS = 8       // plants with fewer can't support leave-one-out
const REGRESSION_TOL = 0.2   // max per-plant MAE regression vs interp

const path = process.argv[2]
if (!path) {
  console.error('Usage: node validate-fitted-curve.mjs <path-to-export.json>')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(path, 'utf8'))
const plants = Array.isArray(raw) ? raw : raw.plants
if (!Array.isArray(plants)) {
  console.error('Export file has no plants array')
  process.exit(1)
}

const tsOf = (e) => new Date(e.timestamp).getTime()

function withoutEvent(plant, event) {
  return { ...plant, events: plant.events.filter(e => e !== event) }
}

function eventsBefore(plant, ts) {
  return { ...plant, events: plant.events.filter(e => tsOf(e) < ts) }
}

const rows = []
let pooled = { n: 0, fitted: 0, fittedBw: 0, interp: 0, replay: 0, replayN: 0 }
const allErrors = []   // { plant, ts, actual, fittedBw } for the debugging hook

for (const plant of plants) {
  const name = plant.name || plant.species
  const careProfile = lookupPlant(plant.species)
  const readings = (plant.events ?? [])
    .filter(e => e.type === 'reading')
    .sort((a, b) => tsOf(a) - tsOf(b))
  if (readings.length < MIN_READINGS) continue

  const errs = { fitted: [], fittedBw: [], interp: [], replay: [] }

  for (let k = 1; k < readings.length - 1; k++) {
    const held = readings[k]
    const ts = tsOf(held)
    const actual = Number(held.moisture)
    const holdout = withoutEvent(plant, held)

    // Fitted variants (must cover the held-out timestamp)
    const fitNoBw = fitMoistureSeries(holdout, careProfile, { backward: false })
    const fitBw = fitMoistureSeries(holdout, careProfile, { backward: true })
    const estNoBw = fitNoBw ? fittedLevelAt(fitNoBw.segments, ts) : null
    const estBw = fitBw ? fittedLevelAt(fitBw.segments, ts) : null

    // Baseline 1: straight-line interpolation between raw neighbors
    const prev = readings[k - 1]
    const next = readings[k + 1]
    const frac = (ts - tsOf(prev)) / (tsOf(next) - tsOf(prev))
    const estInterp = Number(prev.moisture) + (Number(next.moisture) - Number(prev.moisture)) * frac

    // Fair comparison: only score points where every head-to-head estimator
    // produced a value (fitted can be null e.g. when the holdout guts a cycle).
    if (estNoBw == null || estBw == null) continue

    errs.fitted.push(Math.abs(estNoBw - actual))
    errs.fittedBw.push(Math.abs(estBw - actual))
    errs.interp.push(Math.abs(estInterp - actual))
    allErrors.push({ plant: name, ts: held.timestamp, actual, est: estBw, err: Math.abs(estBw - actual) })

    // Baseline 2 (context): past-only model replay
    const prior = eventsBefore(plant, ts)
    const model = computeModel(prior, careProfile)
    const estReplay = predictMoisture(prior, model, ts)
    if (estReplay != null) errs.replay.push(Math.abs(estReplay - actual))
  }

  if (!errs.fitted.length) continue
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const median = (a) => {
    const s = [...a].sort((x, y) => x - y)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }

  rows.push({
    name,
    n: errs.fitted.length,
    fitted: mean(errs.fitted),
    fittedBw: mean(errs.fittedBw),
    interp: mean(errs.interp),
    replay: errs.replay.length ? mean(errs.replay) : null,
    medFittedBw: median(errs.fittedBw),
    medInterp: median(errs.interp),
  })
  pooled.n += errs.fitted.length
  pooled.fitted += errs.fitted.reduce((s, v) => s + v, 0)
  pooled.fittedBw += errs.fittedBw.reduce((s, v) => s + v, 0)
  pooled.interp += errs.interp.reduce((s, v) => s + v, 0)
  pooled.replay += errs.replay.reduce((s, v) => s + v, 0)
  pooled.replayN += errs.replay.length
}

if (!rows.length) {
  console.error('No plants with enough readings to validate')
  process.exit(1)
}

// ── Report ──────────────────────────────────────────────────────────────
const fmt = (v) => v == null ? '   —' : v.toFixed(2).padStart(6)
console.log('plant                       n   fitted  fit+bw   interp   replay   med.bw  med.int')
for (const r of rows) {
  console.log(
    r.name.padEnd(25) + String(r.n).padStart(4) +
    fmt(r.fitted) + '  ' + fmt(r.fittedBw) + '  ' + fmt(r.interp) + '  ' + fmt(r.replay) +
    '  ' + fmt(r.medFittedBw) + '  ' + fmt(r.medInterp),
  )
}
const pf = pooled.fitted / pooled.n
const pbw = pooled.fittedBw / pooled.n
const pi = pooled.interp / pooled.n
const pr = pooled.replayN ? pooled.replay / pooled.replayN : null
console.log('─'.repeat(88))
console.log('POOLED'.padEnd(25) + String(pooled.n).padStart(4) + fmt(pf) + '  ' + fmt(pbw) + '  ' + fmt(pi) + '  ' + fmt(pr))

// ── Verdict ─────────────────────────────────────────────────────────────
const bestPooled = Math.min(pf, pbw)
const bestName = pbw <= pf ? 'fitted+bw' : 'fitted'
const bestKey = pbw <= pf ? 'fittedBw' : 'fitted'
const regressors = rows.filter(r => r[bestKey] > r.interp + REGRESSION_TOL)

console.log()
if (bestPooled < pi && regressors.length === 0) {
  console.log(`verdict: PROCEED — ${bestName} beats interp by ${(pi - bestPooled).toFixed(2)} pooled MAE; no plant regresses > ${REGRESSION_TOL}`)
} else {
  console.log('verdict: DO NOT SHIP')
  if (bestPooled >= pi) console.log(`  pooled MAE ${bestName} (${bestPooled.toFixed(2)}) does not beat interp (${pi.toFixed(2)})`)
  for (const r of regressors) {
    console.log(`  ${r.name} regresses: ${bestName} ${r[bestKey].toFixed(2)} vs interp ${r.interp.toFixed(2)}`)
  }
}

// Debugging hook: worst plant's 5 largest fitted+bw errors
const worst = [...rows].sort((a, b) => (b.fittedBw - b.interp) - (a.fittedBw - a.interp))[0]
console.log(`\nworst plant vs interp: ${worst.name} — 5 largest fitted+bw errors:`)
allErrors
  .filter(e => e.plant === worst.name)
  .sort((a, b) => b.err - a.err)
  .slice(0, 5)
  .forEach(e => console.log(`  ${e.ts}  actual ${e.actual}  fitted ${e.est.toFixed(2)}  err ${e.err.toFixed(2)}`))
