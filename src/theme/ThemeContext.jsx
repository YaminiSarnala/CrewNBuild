// Port of the web src/theme/ThemeContext.jsx.
// localStorage -> AsyncStorage; document.documentElement.classList -> NativeWind
// colorScheme API, which drives `dark:` variants on native.
import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance } from 'react-native'
import { colorScheme as nativewindColorScheme } from 'nativewind'

export const THEME_STORAGE_KEY = 'octabuild_theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => Appearance.getColorScheme() || 'light')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return
        if (stored === 'dark' || stored === 'light') setTheme(stored)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    nativewindColorScheme.set(theme)
    if (loaded) AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch(() => {})
  }, [theme, loaded])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider')
  return context
}
