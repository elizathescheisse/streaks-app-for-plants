// Theme: 'dark' | 'light'. Stored in localStorage and applied to <html>
// via a data-theme attribute so all CSS variable lookups in themes.css
// pick up the right block.

export const THEME_STORAGE_KEY = 'plant-streaks-theme'

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* private browsing / blocked storage — fall through to default */
  }
  return 'dark'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
}

/** Call before React render to avoid a brief flash of the wrong theme. */
export function initTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)
  return theme
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}
