# streaks_app_for_plants — Claude Instructions

## Project Overview
A plant care tracking app with streak-based motivation. Users log moisture readings and watering events; the app learns each plant's individual α/β model to predict when to water next.

## Tech Stack
- React 18 + Vite
- CSS Modules (no Tailwind, no component library)
- `localStorage` for persistence (no backend)
- `gh` CLI available for GitHub operations

## Data Model
Plants are stored as event logs — never mutate history, only append:
```js
{
  id: uuid,
  emoji, species, name,
  events: [
    { type: 'reading',      bundleId, timestamp, moisture },
    { type: 'watering',     bundleId, timestamp, amount, unit },
    { type: 'health_change',bundleId, timestamp, health },
    { type: 'note',         bundleId, timestamp, text },
  ]
}
```

Key selectors live in `src/utils/plantSelectors.js`:
- `lastReading(plant)` — most recent moisture reading event
- `lastWatering(plant)` — most recent watering event
- `currentHealth(plant)` — derived from most recent health_change event
- `logBundles(plant)` — groups events by bundleId for display
- `chartEvents(plant)` — splits events into `{ readings, waterings }` for the chart
- `buildEventsFromForm(form)` — converts log form state into new events array

## Prediction Model
- **α** = moisture rise per unit water (learned from reading → watering → reading triples)
- **β** = moisture decay per day (learned from consecutive readings with no watering between)
- `totalSamples = alphaSamples + betaSamples` — counts model observations, NOT raw log entries
- Low confidence = `totalSamples < 3`; uses species defaults from `plantLookup.js` as fallback

## Display Conventions
- `titleCase(s)` in `PlantCard.jsx` — applied at render time only, never stored. Species is always stored lowercase for `lookupPlant()` compatibility.
- Species name is shown in italic below the nickname; if no nickname, species is shown as the main name (title-cased).
- Health badge colors are translucent (not solid) — see `.badge_thriving`, `.badge_good`, etc. in `PlantCard.module.css`.

## CSS Conventions
- All styles via CSS Modules — no global class names except design tokens in `src/index.css`
- Design tokens: `--bg-surface`, `--bg-surface-raised`, `--bg-modal`, `--brand-primary`, `--brand-bright`, `--text-primary`, `--text-secondary`, `--text-muted`, `--status-thriving/good/okay/struggling`, `--data-water`, `--border-default`, `--border-focus`, `--radius-sm/md/lg/pill`
- Modal backgrounds use `var(--bg-modal)` (`#0e1a0c`) — darker than surface
- Responsive breakpoint: `640px` (mobile below, wide above)
- `.statsBlock` (right column) renders whenever `reading || watering` exists; moisture bar inside it only renders when `hasStats && reading`
- `.metaMobileOnly` — same stats shown inline on mobile, hidden on wide screens

## Key Components
- `PlantCard.jsx` — main card; inline history chart, expandable info/history panels, delete confirmation modal
- `LogEntryForm.jsx` — log moisture + watering + health + notes; timestamp defaults to now via `createEmptyLogForm()` factory (not a static const — avoids stale timestamps)
- `PlantForm.jsx` — add/edit plant identity (emoji, species, nickname)
- `PlantHistoryChart.jsx` — SVG chart of moisture over time with watering annotations and ideal range band
- `PlantPrediction.jsx` — shows next watering prediction and model confidence
- `MoistureBar.jsx` — horizontal bar showing current moisture vs ideal range
- `Modal.jsx` — generic modal wrapper used for forms and confirmations

## GitHub Workflow

### PRs — Always check issues first
Before creating any PR, always:
1. Run `gh issue list --state open` to fetch all open issues
2. Check whether the changes in the PR relate to any open issue
3. If yes, include `closes #N` (or `relates to #N` if not fully resolved) in the PR description body so GitHub auto-closes it on merge
4. Never skip this step even if you think there are no related issues — always check

### Issue labels in use
- `bug` — something is broken
- `enhancement` — new feature or improvement
- `model` — prediction algorithm / data science
- `ux` — UI and interaction design
- `data` — logging, data capture, data model
- `someday` — good idea, low priority, revisit later
- `needs-discussion` — unclear, think it through before building

### Filing issues
When a good idea comes up in conversation but we're not building it now, file a GitHub issue rather than letting it get lost. Include:
- What the feature is and why it would help
- Any technical notes or constraints discussed
- A note if it's low priority / someday
