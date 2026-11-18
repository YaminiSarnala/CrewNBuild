// Pieces the Weather screen and the header weather pill share (web
// pages/weather/WeatherPage.jsx ConditionIcon / SeverityChip).
import { View, Text } from 'react-native'
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudRainWind, CloudSnow, CloudSun, Haze, Info, Moon,
  ShieldAlert, Sun, Tornado, TriangleAlert, Wind,
} from 'lucide-react-native'
import { ink, line, soft } from '../../theme/tint'
import { severityTone } from '../../utils/weatherHelpers'
import { useWeatherText } from '../../i18n/weatherText'

const CONDITION_ICONS = {
  CLEAR: Sun, PARTLY_CLOUDY: CloudSun, CLOUDY: Cloud, FOG: CloudFog, DRIZZLE: CloudDrizzle, RAIN: CloudRain,
  HEAVY_RAIN: CloudRainWind, SNOW: CloudSnow, THUNDERSTORM: CloudLightning, SEVERE_THUNDERSTORM: CloudLightning,
  DUST: Haze, SQUALL: Wind, TORNADO: Tornado,
}

function conditionColor(condition, isDay) {
  if (condition === 'SEVERE_THUNDERSTORM' || condition === 'TORNADO') return '#dc2626'
  if (condition === 'THUNDERSTORM') return '#7c3aed'
  if (condition === 'CLEAR') return isDay === false ? '#818cf8' : '#f59e0b'
  if (condition === 'PARTLY_CLOUDY') return '#f59e0b'
  if (condition === 'RAIN' || condition === 'HEAVY_RAIN' || condition === 'DRIZZLE') return '#0284c7'
  if (condition === 'DUST') return '#b45309'
  return '#64748b'
}

// Lighter shades for the dark green header.
function onDarkColor(condition, isDay) {
  if (condition === 'SEVERE_THUNDERSTORM' || condition === 'TORNADO') return '#fca5a5'
  if (condition === 'THUNDERSTORM') return '#c4b5fd'
  if (condition === 'CLEAR') return isDay === false ? '#c7d2fe' : '#fbbf24'
  if (condition === 'PARTLY_CLOUDY') return '#fbbf24'
  if (condition === 'RAIN' || condition === 'HEAVY_RAIN' || condition === 'DRIZZLE') return '#7dd3fc'
  if (condition === 'DUST') return '#fcd34d'
  return '#e2e8f0'
}

/** The condition's icon in its colour; a clear night shows the moon. `onDark`: on the green header. */
export function ConditionIcon({ condition, isDay = true, size = 24, color, onDark = false }) {
  const Icon = condition === 'CLEAR' && isDay === false ? Moon : (CONDITION_ICONS[condition] || Cloud)
  return <Icon size={size} color={color || (onDark ? onDarkColor(condition, isDay) : ink(conditionColor(condition, isDay)))} />
}

export function SeverityChip({ severity }) {
  const text = useWeatherText()
  const [bg, fg, border] = severityTone(severity)
  const Icon = severity === 'SEVERE' ? ShieldAlert : severity === 'INFO' ? Info : TriangleAlert
  const solid = severity === 'SEVERE'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: solid ? bg : soft(bg, fg), borderColor: solid ? border : line(border, fg) }}>
      <Icon size={11} color={solid ? fg : ink(fg)} />
      <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4, color: solid ? fg : ink(fg) }}>
        {text(`weather.severity.${severity}`)}
      </Text>
    </View>
  )
}