import { createContext, useCallback, useMemo, useState } from 'react'
import { applyTheme, getStoredTheme, initTheme, storeTheme } from '../../theme/theme.js'

// Context shape:
//   theme: 'dark' | 'light'
//   setTheme(theme)
//   toggleTheme()
//   isLight: boolean
//   isDark: boolean
export const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // initTheme() reads from localStorage and applies data-theme to <html>
  // synchronously before React renders, so there's no flash of wrong theme.
  const [theme, setThemeState] = useState(() => initTheme())

  const setTheme = useCallback((next) => {
    setThemeState(next)
    storeTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isLight: theme === 'light',
      isDark: theme === 'dark',
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Re-apply stored theme (e.g. after hydration mismatch). */
export function syncThemeFromStorage() {
  const theme = getStoredTheme()
  applyTheme(theme)
  return theme
}
