// Port of the web src/theme/ThemeContext.jsx.
//
// The app opens in the light theme; dark is used only when the person chose it
// (saved), exactly as on the web -- never just because the phone is in dark
// mode. Two things follow the theme, both switched during render so the very
// next paint already uses them:
//   - every stylesheet made with createStyles (palette.js colours);
//   - COLORS used in code (icon tints, placeholders), through applyColorTheme.
// Screens read COLORS while rendering, so a change remounts the navigator
// (RootNavigator keys it on `theme` and keeps the navigation state).
import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { applyColorTheme } from './tokens'
import { setStyleTheme } from './createStyles'

// A new key: the earlier build saved the phone's own dark-mode setting under
// 'octabuild_theme' as if it were a choice. Only a choice made here counts.
export const THEME_STORAGE_KEY = 'octabuild_theme_choice'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const applied = useRef(null)

  // Applied while rendering (not in an effect), so the first paint after a
  // change already reads the new colours.
  if (applied.current !== theme) {
    applyColorTheme(theme === 'dark')
    setStyleTheme(theme)
    applied.current = theme
  }

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => { if (!cancelled && stored === 'dark') setThemeState('dark') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const value = useMemo(() => {
    const setTheme = (next) => {
      const resolved = next === 'dark' ? 'dark' : 'light'
      setThemeState(resolved)
      AsyncStorage.setItem(THEME_STORAGE_KEY, resolved).catch(() => {})
    }
    return {
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }
  }, [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider')
  return context
}
