// Applies the light or dark CSS variables (nativeVars.js) for the active theme,
// so every NativeWind className (bg-white, text-graphite, border-slate-200 …)
// paints the right colour in both themes — the web's dark-theme remap.
import { View } from 'react-native'
import { vars } from 'nativewind'
import { useTheme } from './ThemeContext'
import { DARK_VARS, LIGHT_VARS } from './nativeVars'

const LIGHT_STYLE = vars(LIGHT_VARS)
const DARK_STYLE = vars(DARK_VARS)

export default function ThemeVars({ children }) {
  const { isDark } = useTheme()
  return <View style={[{ flex: 1 }, isDark ? DARK_STYLE : LIGHT_STYLE]}>{children}</View>
}