# streaks_app_for_plants — Claude Instructions

## HUMAN.md reminders

At the start of each session, read `HUMAN.md`. During the conversation, if a reminder in it is directly relevant to what we're currently doing, append it quietly at the bottom of your response under a `---` divider. Only surface a reminder when it genuinely applies — not on every response.

## Loose threads

Never leave a discussed idea, problem, or decision unresolved without capturing it. Specifically:
- If a discussion reaches a natural "do you want me to file a GitHub issue?" moment and the conversation moves on before confirming, **file the issue anyway** — don't wait for confirmation. An extra issue is easier to close than a lost idea is to recover.
- If multiple topics are in flight and one gets dropped when the user pivots to something new, flag the unresolved thread at the bottom of the next response before it gets lost.
- At the end of a session, if anything was discussed but not captured in a GitHub issue or committed code, call it out explicitly.

## Shorthand commands

- **`gh <description>`** — means "file a GitHub issue: <description>". Create the issue immediately without asking for confirmation. Use good judgment on labels, detail, and whether it relates to any open issues.

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

## Figma Design File

**URL:** https://www.figma.com/design/XKgfjKDKC56bvT6lasIbSH/streaks_app_for_plants?node-id=0-1&m=dev
**File key:** `XKgfjKDKC56bvT6lasIbSH`

One page: `🌿 Cover`. Frames on that page:
- `Cover` — title card
- `Desktop – Plant Streaks` — 1440px wide desktop layout
- `Home – Today's Log` — 390px mobile layout
- `Log Entry Modal` — log form
- `Add Plant Modal` — add/edit plant form
- `Settings Modal` — settings dialog

### Figma sync snapshots
When making Figma updates, save a PNG screenshot of each modified frame to `figma-snapshots/` with the naming convention:
```
figma-snapshots/YYYY-MM-DD-<frame-slug>-pr<N>.png
```
Example: `figma-snapshots/2026-05-17-desktop-pr28.png`

This lets us later detect what you changed manually in Figma since the last sync: take a fresh screenshot and compare visually against the saved snapshot. Always note in the filename which PR the code was at when the snapshot was taken.

### Required: visual screenshot check after every Figma edit
After any `use_figma` call that modifies the canvas, always:
1. Call `get_screenshot` on the modified frame
2. Download the PNG with `curl` into `temporary_screenshots/` (gitignored) and `Read` it inline to visually inspect it
3. Check specifically for: black/empty areas, overlapping elements, collapsed frames (zero height), content clipped outside frame bounds, background glow rectangles not covering full frame height
4. Fix any issues found before saving snapshots or reporting done

Do NOT save snapshots or declare work complete based on tool return values alone — only after passing a visual check.

### Figma responsive awareness — pre-flight checklist

Before creating or editing anything in a Figma frame, determine which elements
would actually be visible at that frame's screen width:

1. Check the frame width (desktop = 1440px, mobile = 390px)
2. Read the relevant CSS module files to find breakpoint rules (`@media (max-width: 639px)` / `@media (min-width: 640px)`)
3. Identify every class with `display: none` at that breakpoint
4. Do NOT draw those elements in the Figma frame

Key rules for this project's 640px breakpoint:
- **Desktop frame (1440px):** `.metaMobileOnly` is hidden — do not draw the inline water/moisture stats row in the left column. `.statsBlock` IS visible.
- **Mobile frame (390px):** `.statsBlock` is hidden — do not draw the right-side stats block. `.mobileBar` and `.metaMobileOnly` ARE visible.
- When in doubt, read `src/components/PlantCard.module.css` before building.

This is a pre-flight check, not an afterthought — run it before writing any `use_figma` code.

### Known Figma gotchas for this file
- **Glow backgrounds**: `Desktop – Plant Streaks` has `_glow_top/bottom/left/right` rectangles. When resizing the frame, resize these too to match the new frame dimensions (top/bottom cover 40% of frame height; left/right cover 33% of frame width)
- **Auto-layout height collapse**: After `resize(w, h)`, always explicitly set `primaryAxisSizingMode = 'AUTO'` on the group if you want height to hug content — `resize()` freezes sizing modes to FIXED
- **Chart strips**: The SVG-like chart elements (rotated line segments, dots) must live in regular frames, not auto-layout frames, since rotation breaks auto-layout

## Testing

Run `npm test` in these situations — not mechanically on every change, but as a safety check when it matters:

1. **After editing `plantModel.js` or `plantSelectors.js`** — these are the files the tests cover. Run before committing.
2. **After editing the test files themselves** — make sure no test is accidentally broken or vacuously passing.
3. **Before opening a PR** — final sanity check regardless of what changed. Cheap insurance.

Skip running tests for pure CSS changes, JSX layout tweaks, or new components that don't touch model/selector logic — tests can't catch those anyway.

If a test fails unexpectedly: fix the code (not the test) unless the test itself is wrong. A failing test on a "safe" change is a signal something unexpected broke.

---

## GitHub Workflow

### When to nudge about a PR
If a conversation has produced meaningful committed work on a branch and no PR exists yet, proactively suggest opening one. Specifically: after 2+ commits on a non-main branch, or when the user says something like "ok that looks good" / "let's move on" / "what's next" — check whether there's an open branch with unpushed or un-PR'd commits and remind the user. Don't wait to be asked. A good prompt is: "We have N commits on `branch-name` — want me to open a PR?"

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

### Staying in sync with main
Proactively pull from origin/main whenever there's any reason to think remote might be ahead of local — don't wait to be asked. This includes: the user mentioning a merge, asking about PRs, starting a new coding task, or any gap in conversation where merges could have happened. When in doubt, just check:
```
git checkout main && git pull
git branch -vv   # delete any local branches whose PRs have merged
```
Never start a new branch or commit new work on a stale local main.

**After creating or updating a PR**: at the start of the very next response, silently check if it merged with `gh pr view <N> --json state -q .state` before doing anything else. If merged: pull main and delete the branch immediately. Don't wait for the user to mention it.

### Branch cleanup
Delete local branches as soon as their PR merges — proactively, without being asked. Run `git branch -vv` to spot stale ones (shown as `[origin/...: gone]`). Delete with `git branch -d <name>`.

### Filing issues
When a good idea comes up in conversation but we're not building it now, file a GitHub issue rather than letting it get lost. Include:
- What the feature is and why it would help
- Any technical notes or constraints discussed
- A note if it's low priority / someday
