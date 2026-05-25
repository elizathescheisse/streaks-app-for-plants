import { useContext } from 'react'
import { ThemeContext } from '../app/providers/ThemeProvider.jsx'

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
