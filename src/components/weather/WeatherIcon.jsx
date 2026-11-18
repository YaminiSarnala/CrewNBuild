// The weather icons: one lucide icon per condition or theme, in the web's
// colours (amber sun, sky rain, violet storm...), tinted for the dark theme.
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudRainWind, CloudSnow, CloudSun, Haze, Moon, Sun,
  Thermometer, Tornado, Wind,
} from 'lucide-react-native'
import { ink } from '../../theme/tint'

const ICONS = {
  sun: [Sun, '#f59e0b'],
  moon: [Moon, '#818cf8'],
  partly: [CloudSun, '#f59e0b'],
  cloud: [Cloud, '#64748b'],
  fog: [CloudFog, '#64748b'],
  drizzle: [CloudDrizzle, '#0284c7'],
  rain: [CloudRain, '#0284c7'],
  'heavy-rain': [CloudRainWind, '#0369a1'],
  snow: [CloudSnow, '#64748b'],
  storm: [CloudLightning, '#7c3aed'],
  tornado: [Tornado, '#dc2626'],
  dust: [Haze, '#b45309'],
  wind: [Wind, '#0f766e'],
  hot: [Thermometer, '#ea580c'],
}

/** `name`: an icon name from weatherCore (themeOf(...).icon or conditionIconName). */
export default function WeatherIcon({ name, size = 20, color }) {
  const [Icon, tone] = ICONS[name] || ICONS.cloud
  return <Icon size={size} color={color || ink(tone)} />
}
