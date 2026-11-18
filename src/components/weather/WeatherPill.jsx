// The header weather indicator (web AccountWeatherIndicator / WeatherNavButton):
// the condition's icon over the temperature, with a "!" badge when a WARNING or
// SEVERE alert is active on any of the account's sites. Tapping it opens the
// Weather screen, where the site is chosen.
//
// Which place: the one picked on the Weather screen (kept on this device per
// account), else the server's default. Refreshed every 10 minutes; a failed
// look is tried again after 15 s, 30 s, 60 s and then every 2 minutes. Nothing is
// made up: with no answer the pill shows only the icon.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchWeatherSummary } from '../../api/weather'
import { useWeatherText } from '../../i18n/weatherText'
import { ConditionIcon } from './WeatherParts'

const REFRESH_MS = 10 * 60 * 1000
const RETRY_MS = [15 * 1000, 30 * 1000, 60 * 1000, 2 * 60 * 1000]

const choiceKey = (userId) => `cnb_weather_site:${userId}`

export async function loadWeatherChoice(userId) {
  try {
    const value = await AsyncStorage.getItem(choiceKey(userId))
    return value === 'me' || /^\d+$/.test(value || '') ? value : null
  } catch {
    return null
  }
}

// Change listeners, so the pill follows a site picked on the Weather screen.
const listeners = new Set()

export async function saveWeatherChoice(userId, site) {
  try {
    if (site) await AsyncStorage.setItem(choiceKey(userId), String(site))
    else await AsyncStorage.removeItem(choiceKey(userId))
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
  listeners.forEach((listener) => listener(site ? String(site) : null))
}

function temperature(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : ''
}

export default function WeatherPill() {
  const navigation = useNavigation()
  const text = useWeatherText()
  const userId = useSelector((state) => state.auth.user?.id)
  const [site, setSite] = useState(undefined) // undefined: choice not read yet
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const failures = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (userId) loadWeatherChoice(userId).then((value) => { if (!cancelled) setSite(value) })
    const listener = (value) => setSite(value)
    listeners.add(listener)
    return () => { cancelled = true; listeners.delete(listener) }
  }, [userId])

  const load = useCallback(async () => {
    if (!userId || site === undefined) return
    clearTimeout(timer.current)
    try {
      const answer = await fetchWeatherSummary(site)
      setSummary(answer)
      failures.current = answer?.status?.available || answer?.status?.location_required ? 0 : failures.current + 1
    } catch (error) {
      // A picked site the account can no longer read: back to the default.
      if (site && [403, 404].includes(error?.response?.status)) {
        saveWeatherChoice(userId, null)
        return
      }
      failures.current += 1
    } finally {
      setLoading(false)
    }
    const wait = failures.current > 0 ? RETRY_MS[Math.min(failures.current, RETRY_MS.length) - 1] : REFRESH_MS
    timer.current = setTimeout(load, wait)
  }, [userId, site])

  useEffect(() => {
    setLoading(true)
    load()
    // Back in the foreground: look again when the last look failed.
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active' && failures.current > 0) load() })
    return () => { clearTimeout(timer.current); sub.remove() }
  }, [load])

  const current = summary?.current
  const ready = Boolean(summary?.status?.available && current)
  const alerts = summary?.alerts || []
  const severity = alerts.some((alert) => alert.severity === 'SEVERE') ? 'SEVERE'
    : alerts.some((alert) => alert.severity === 'WARNING') ? 'WARNING' : null
  const label = [text('weather.nav'), ready ? `${Math.round(current.temperature_c)}°C` : null,
    alerts.length ? text('weather.navAlerts', { count: alerts.length }) : null].filter(Boolean).join(' · ')

  return (
    <Pressable
      onPress={() => navigation.navigate('Weather', { site: summary?.site?.key || site || undefined })}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minWidth: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 3 }}
    >
      <View>
        {loading && !summary ? (
          <ActivityIndicator size="small" color="#c3dccd" />
        ) : (
          <ConditionIcon
            condition={ready ? current.condition : 'PARTLY_CLOUDY'}
            isDay={ready ? current.is_day : true}
            size={18}
            onDark
            color={ready ? undefined : '#c3dccd'}
          />
        )}
        {severity ? (
          <View style={{ position: 'absolute', right: -6, top: -5, height: 13, width: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: severity === 'SEVERE' ? '#dc2626' : '#f97316', borderWidth: 1.5, borderColor: '#083E2B' }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#ffffff', lineHeight: 10 }}>!</Text>
          </View>
        ) : null}
      </View>
      {ready ? <Text style={{ marginTop: 1, fontSize: 10, fontWeight: '800', color: '#ffffff' }}>{temperature(current.temperature_c)}</Text> : null}
    </Pressable>
  )
}