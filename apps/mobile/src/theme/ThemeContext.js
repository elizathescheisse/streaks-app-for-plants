import { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { palettes, space, radius, fontSize, fontWeight } from './tokens.js'

// RN equivalent of the web's theme.js: the web writes a data-theme attribute
// on <html> and lets CSS variables resolve; here there's no DOM, so the
// active palette lives in React context and styled components read it via
// useTheme(). Persisted to AsyncStorage under the same key shape as web.
const THEME_STORAGE_KEY = 'plant-streaks-theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() // 'light' | 'dark' | null
  // null = user hasn't overridden; follow the system scheme (default dark,
  // matching the web app's default).
  const [override, setOverride] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark') setOverride(stored)
      setLoaded(true)
    })
  }, [])

  const mode = override ?? (systemScheme === 'light' ? 'light' : 'dark')

  const setMode = async (next) => {
    setOverride(next)
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const value = {
    mode,
    setMode,
    colors: palettes[mode],
    space,
    radius,
    fontSize,
    fontWeight,
    loaded,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
