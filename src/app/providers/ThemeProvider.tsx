import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, getStoredTheme, initTheme, storeTheme, type Theme } from '../../theme/theme'

export type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isLight: boolean
  isDark: boolean
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => initTheme())

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    storeTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo<ThemeContextValue>(
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

/** Re-apply stored theme (e.g. after hydration mismatch) */
export function syncThemeFromStorage(): Theme {
  const theme = getStoredTheme()
  applyTheme(theme)
  return theme
}
