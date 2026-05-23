# Design system audit — UX ideation branch

## Existing style approach

- **Stack:** React 18 + Vite, **CSS Modules** per component (no Tailwind, no styled-components).
- **Global tokens:** `src/index.css` defines `:root` CSS custom properties (`--bg-*`, `--text-*`, `--brand-*`, etc.).
- **Layout:** Desktop-first; breakpoint `640px` / `900px` in various modules.
- **Glow:** `EdgeGlow.jsx` — fixed decorative radial gradients (dark-green only today).
- **Modals:** Shared `Modal.jsx` + bespoke `SettingsModal` (top-right panel).
- **Settings:** `Header` gear → `SettingsModal` (data clear only); no theme toggle yet.
- **Fonts:** Inter via Google Fonts in `index.html`.

## Main files touched (this change)

| Area | Files |
|------|--------|
| Tokens & globals | `src/theme/tokens.css`, `src/index.css` |
| Theme state | `src/theme/theme.ts`, `ThemeProvider.tsx`, `useTheme.ts` |
| App shell | `src/main.jsx` |
| Settings UI | `SettingsModal.jsx`, `SettingsModal.module.css` |
| Shell / list | `App.module.css`, `Header.module.css`, `EdgeGlow.module.css` |
| Modals | `Modal.module.css`, `QuickLogModal.module.css`, `PlantForm.module.css`, `LogEntryForm.module.css` |
| Cards / detail | `PlantCard.module.css`, `PlantDetailPage.module.css` |

## Theme strategy

1. **`data-theme` on `<html>`** — values `dark` | `light`; default `dark`.
2. **Central tokens** in `src/theme/tokens.css` — semantic `--color-*`, spacing, typography, shadows.
3. **Legacy aliases** — existing `--bg-surface`, `--brand-primary`, etc. map to new tokens so CSS Modules need minimal renames.
4. **`ThemeProvider`** — React context; persists to `localStorage` key `plant-streaks-theme`.
5. **Synchronous `initTheme()`** in `main.jsx` before render to avoid flash of wrong theme.
6. **No new dependencies** — inline SVG sun/moon icons in Settings.

## Risky areas

- **Hardcoded `rgba()` in modules** — many remain; light mode may look slightly uneven until migrated. High-traffic surfaces updated first.
- **`PlantHistoryChart.jsx`** — inline SVG/chart colors may stay dark-tuned until a follow-up.
- **Health badge colors** — use `--status-*` tokens; some modules still use one-off rgba tints.
- **Edge glow** — toned down in light mode via `--glow-*` tokens; still decorative only.

## Out of scope (intentional)

- Full visual redesign, layout changes, or business-logic refactors.
- Lucide / new UI libraries.
- Figma sync.
