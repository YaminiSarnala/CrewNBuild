// The header weather button on every dashboard: port of the web
// AccountWeatherIndicator + WeatherIndicator.
//
// The button shows the condition's icon over the temperature (as the web shows
// it on phones), with a red or orange "!" when a WARNING / SEVERE alert is
// active. Tapping it opens the weather report in a sheet: the place, any
// warnings, the temperature and readings, the next hours, the place picker and
// "Detailed weather" (the Weather screen).
//
// Which place: the one this account picked here (kept on the phone per
// account); else the server's default -- the project the account works on,
// or its own place. /weather/summary refuses a site the account may not read,
// and the choice then falls back to the default.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import PianoLoader from '../PianoLoader'
import { useSelector } from 'react-redux'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Check, ChevronDown, ChevronRight, CloudRain, CloudSun, Droplets, MapPin, RefreshCw, Search, Thermometer, Umbrella, Wind } from 'lucide-react-native'
import { SheetModal } from '../builder/BuilderUi'
import { useLanguage } from '../../i18n/LanguageContext'
import { fetchWeatherProjects, fetchWeatherSummary, saveSiteLocation, searchSiteLocation } from '../../api/weather'
import {
  cachedWeather, compass, conditionIconName, forgetWeather, percent, rainfall, severityColors, shortPlace, speed, temperature,
  themeOf, topSeverity, updatedAt, siteClock,
} from '../../screens/weather/weatherCore'
import { useWeatherText } from '../../screens/weather/weatherText'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import WeatherIcon from './WeatherIcon'
import { useWeatherFeed } from './useWeatherFeed'

const choiceKey = (userId) => `cnb_weather_site:${userId}`
const validChoice = (value) => (value === 'me' || /^\d+$/.test(value || '') ? value : null)

async function saveChoice(userId, site) {
  try {
    if (site) await AsyncStorage.setItem(choiceKey(userId), site)
    else await AsyncStorage.removeItem(choiceKey(userId))
  } catch {
    // Storage refused: the choice lasts while the app is open.
  }
}

export default function WeatherButton() {
  const text = useWeatherText()
  const { td } = useLanguage()
  const navigation = useNavigation()
  const userId = useSelector((state) => state.auth?.user?.id)
  // undefined: the saved choice is still being read.
  const [site, setSite] = useState(undefined)
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    let live = true
    setSite(undefined)
    AsyncStorage.getItem(choiceKey(userId))
      .then((value) => { if (live) setSite(validChoice(value)) })
      .catch(() => { if (live) setSite(null) })
    return () => { live = false }
  }, [userId])

  const feed = useWeatherFeed(
    userId && site !== undefined ? `summary:${userId}:${site || 'default'}` : null,
    () => fetchWeatherSummary(site),
    {
      // A picked site the account can no longer read: back to the default.
      onError: (error) => {
        if (!site || ![403, 404].includes(error?.response?.status)) return false
        saveChoice(userId, null)
        setSite(null)
        return true
      },
    },
  )

  const pick = (next) => {
    saveChoice(userId, next)
    forgetWeather(`summary:${userId}:`)
    if (next === site) feed.retry()
    else setSite(next)
    setChanging(false)
  }

  const summary = feed.answer
  const chosen = summary?.site
  const loading = (feed.loading || site === undefined) && !summary
  const locationRequired = Boolean(summary?.status?.location_required)
  const ready = Boolean(summary?.status?.available) && !locationRequired
  const state = loading ? 'loading' : !summary ? 'unavailable' : locationRequired ? 'idle' : ready ? 'ready' : 'unavailable'
  const warnings = (summary?.alerts || []).map((alert) => ({
    ...alert,
    where: alert.site === 'personal' ? text('weather.myLocation') : alert.site_label,
    project: alert.project_id || 'me',
  }))
  const severity = topSeverity(warnings)
  const theme = ready ? themeOf(summary.presentation) : themeOf({ theme: 'PARTLY_CLOUDY' })
  const current = summary?.current || {}
  const place = summary?.location?.location_name || chosen?.label || ''
  const controlsOpen = changing || state === 'idle'

  const goWeather = (project) => {
    setOpen(false)
    navigation.navigate('Weather', project ? { project: String(project) } : undefined)
  }

  const badge = severity === 'SEVERE' ? '#dc2626' : severity === 'WARNING' ? '#f97316' : null
  const buttonLabel = ready
    ? [shortPlace(place), temperature(current.temperature_c), td(theme.label)].filter(Boolean).join(', ')
    : text('wx.weather')

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={buttonLabel} style={styles.button}>
        <View>
          {/* Always the weather icon (cloud and sun), so it never looks like the
              light / dark toggle beside it; the report shows the real condition. */}
          {loading ? <ActivityIndicator size="small" color="#c3dccd" /> : <CloudSun size={17} color="#e6f2ea" />}
          {badge ? <View style={[styles.badge, { backgroundColor: badge }]}><Text style={styles.badgeText}>!</Text></View> : null}
        </View>
        {!loading ? <Text style={styles.temp} numberOfLines={1}>{ready ? temperature(current.temperature_c) : '–'}</Text> : null}
      </Pressable>

      <SheetModal
        visible={open}
        tall
        title={place ? td(place) : text('wx.weather')}
        subtitle={chosen?.key === 'me' ? text('weather.myLocation') : chosen?.label && chosen.label !== place ? td(chosen.label) : undefined}
        onClose={() => setOpen(false)}
        footer={(
          <Pressable onPress={() => goWeather(chosen?.key)} style={styles.details} accessibilityRole="button">
            <Text style={styles.detailsText}>{text('wx.details')}</Text>
            <ChevronRight size={15} color="#ffffff" />
          </Pressable>
        )}
      >
        {warnings.length ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {warnings.slice(0, 2).map((warning, index) => {
              const colors = severityColors(warning.severity)
              return (
                <View key={`${warning.title}-${index}`} style={[styles.warning, { backgroundColor: soft(colors.bg, colors.bar), borderColor: line(colors.border, colors.bar) }]}>
                  <View style={[styles.warningBar, { backgroundColor: colors.bar }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.warningTitle, { color: ink(colors.ink) }]} numberOfLines={2}>{td(warning.title)}</Text>
                    {warning.where ? <Text style={styles.warningWhere} numberOfLines={1}>{td(shortPlace(warning.where))}</Text> : null}
                    {index === 1 && warnings.length > 2 ? <Text style={styles.warningWhere}>{text('wx.more', { count: warnings.length - 2 })}</Text> : null}
                  </View>
                  <Pressable onPress={() => goWeather(warning.project)} style={styles.warningView} hitSlop={6}>
                    <Text style={[styles.warningViewText, { color: ink(colors.ink) }]}>{text('wx.view')}</Text>
                    <ChevronRight size={13} color={ink(colors.ink)} />
                  </Pressable>
                </View>
              )
            })}
          </View>
        ) : null}

        {state === 'ready' ? (
          <View>
            <View style={[styles.hero, { backgroundColor: soft(theme.bg, theme.ink), borderColor: line(theme.border, theme.ink) }]}>
              <WeatherIcon name={theme.icon} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroTemp}>{temperature(current.temperature_c)}</Text>
                <Text style={[styles.heroLabel, { color: ink(theme.ink) }]}>{td(theme.label)}</Text>
              </View>
            </View>
            <View style={styles.readings}>
              <Reading icon={Thermometer} label={text('wx.feelsLike')} value={temperature(current.feels_like_c)} />
              <Reading
                icon={Thermometer}
                label={text('wx.minMax')}
                value={typeof summary.today?.temp_min_c === 'number' && typeof summary.today?.temp_max_c === 'number'
                  ? `${temperature(summary.today.temp_min_c)} / ${temperature(summary.today.temp_max_c)}` : '–'}
              />
              <Reading icon={Droplets} label={text('wx.humidity')} value={percent(current.humidity_pct)} />
              <Reading icon={Wind} label={text('wx.wind')} value={[speed(current.wind_speed_kmh), compass(current.wind_direction_deg)].filter(Boolean).join(' ')} />
              <Reading icon={Umbrella} label={text('wx.rainChance')} value={percent(summary.today?.precipitation_probability_pct ?? current.precipitation_probability_pct)} />
              <Reading icon={CloudRain} label={text('wx.rainToday')} value={rainfall(summary.today?.precipitation_mm)} />
            </View>
            {(summary.next_hours || []).length ? (
              <>
                <Text style={styles.caption}>{text('wx.nextHours')}</Text>
                <View style={styles.hours}>
                  {summary.next_hours.slice(0, 6).map((hour) => (
                    <View key={hour.time} style={styles.hour}>
                      <Text style={styles.hourTime}>{siteClock(hour.time)}</Text>
                      <WeatherIcon name={conditionIconName(hour.condition)} size={15} />
                      <Text style={styles.hourTemp}>{temperature(hour.temperature_c)}</Text>
                      <Text style={styles.hourRain}>{percent(hour.precipitation_probability_pct)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <View style={styles.updatedRow}>
              <Text style={styles.updated}>
                {updatedAt(summary.status?.last_updated_at) ? `${text('wx.updated')} ${updatedAt(summary.status.last_updated_at)}` : ''}
                {summary.status?.stale || feed.refreshFailed ? ` · ${text('wx.stale')}` : ''}
              </Text>
              {summary.status?.stale || feed.refreshFailed ? (
                <Pressable onPress={feed.retry} style={styles.smallRetry} accessibilityLabel={text('weather.refresh')}>
                  <RefreshCw size={13} color={COLORS.brand[700]} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : state === 'loading' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.brand[700]} />
            <Text style={styles.muted}>{text('wx.loading')}</Text>
          </View>
        ) : state === 'idle' ? (
          <Text style={styles.needsPlace}>{text('wx.choosePlace')}</Text>
        ) : (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableText}>{summary?.status?.message ? td(summary.status.message) : text('wx.unavailable')}</Text>
            <Text style={styles.muted}>{text('wx.retryAuto')}</Text>
            <Pressable onPress={feed.retry} disabled={feed.loading} style={[styles.retry, feed.loading ? { opacity: 0.6 } : null]}>
              <RefreshCw size={14} color={COLORS.brand[700]} />
              <Text style={styles.retryText}>{text('wx.tryAgain')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.controls}>
          {controlsOpen ? (
            <SitePicker userId={userId} current={chosen?.key ?? site} onPick={pick} />
          ) : (
            <Pressable onPress={() => setChanging(true)} style={styles.change} accessibilityRole="button">
              <MapPin size={14} color={COLORS.brand[700]} />
              <Text style={styles.changeText}>{text('wx.changeLocation')}</Text>
              <ChevronDown size={14} color={COLORS.brand[700]} />
            </Pressable>
          )}
        </View>
      </SheetModal>
    </>
  )
}

function Reading({ icon: Icon, label, value }) {
  return (
    <View style={styles.reading}>
      <Icon size={14} color={COLORS.brand[700]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.readingLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.readingValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

/** The sites this account may read, plus a place search that sets "My location". */
function SitePicker({ userId, current, onPick }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [catalog, setCatalog] = useState(null)

  useEffect(() => {
    let live = true
    cachedWeather(`projects:${userId}`, fetchWeatherProjects)
      .then((data) => { if (live) setCatalog(data) })
      .catch(() => { if (live) setCatalog({ projects: [] }) })
    return () => { live = false }
  }, [userId])

  const rows = [
    { key: 'me', title: text('weather.myLocation'), note: catalog?.personal?.location?.location_name || text('wx.notSet') },
    ...(catalog?.projects || []).map((project) => ({
      key: String(project.id),
      title: td(project.title),
      note: [
        project.location?.location_name || project.city,
        project.access && String(project.access).toUpperCase() !== 'MEMBER' ? text('wx.readOnly') : null,
      ].filter(Boolean).join(' · '),
    })),
  ]

  return (
    <View>
      <Text style={styles.caption}>{text('wx.showFor')}</Text>
      {!catalog ? (
        <Text style={styles.muted}>{text('weather.loading')}</Text>
      ) : (
        <View style={{ gap: 6, marginTop: 4 }}>
          {rows.map((row) => {
            const on = String(current) === row.key
            return (
              <Pressable key={row.key} onPress={() => onPick(row.key)} accessibilityState={{ selected: on }} style={[styles.siteRow, on ? styles.siteRowOn : null]}>
                <MapPin size={14} color={COLORS.brand[700]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.siteTitle} numberOfLines={1}>{row.title}</Text>
                  {row.note ? <Text style={styles.siteNote} numberOfLines={1}>{td(row.note)}</Text> : null}
                </View>
                {on ? <Check size={16} color={COLORS.brand[700]} /> : null}
              </Pressable>
            )
          })}
        </View>
      )}
      <Text style={[styles.caption, { marginTop: 12 }]}>{text('wx.setMine')}</Text>
      <PlaceSearch
        search={async (query) => (await searchSiteLocation('me', query)).results}
        onChoose={async (row) => {
          await saveSiteLocation('me', {
            latitude: row.latitude,
            longitude: row.longitude,
            location_name: (row.name || '').slice(0, 255),
            country_code: row.country_code || null,
            timezone: row.timezone || null,
            source: 'SEARCH',
          })
          forgetWeather(`projects:${userId}`)
          onPick('me')
        }}
      />
    </View>
  )
}

export function PlaceSearch({ search, onChoose }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (query.trim().length < 2) return
    setBusy(true)
    try {
      setResults((await search(query.trim())) || [])
    } catch {
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  const choose = async (row) => {
    setBusy(true)
    try {
      await onChoose(row)
    } catch {
      // The search stays open so another place can be tried.
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ marginTop: 4, gap: 6 }}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder={text('wx.searchPlace')}
          placeholderTextColor={COLORS.slate[400]}
          returnKeyType="search"
          maxLength={120}
          style={styles.searchInput}
        />
        <Pressable onPress={submit} disabled={busy} style={[styles.searchButton, busy ? { opacity: 0.6 } : null]} accessibilityRole="button">
          {busy ? <PianoLoader color="#ffffff" height={14} /> : <Search size={14} color="#ffffff" />}
          <Text style={styles.searchButtonText}>{text('wx.search')}</Text>
        </Pressable>
      </View>
      {results ? (results.length ? (
        <View style={styles.results}>
          {results.slice(0, 6).map((row) => (
            <Pressable key={`${row.latitude},${row.longitude}`} onPress={() => choose(row)} disabled={busy} style={styles.result}>
              <Text style={styles.resultText} numberOfLines={2}>{td(row.name)}</Text>
            </Pressable>
          ))}
        </View>
      ) : <Text style={styles.muted}>{text('wx.noPlaces')}</Text>) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  button: { minWidth: 38, alignItems: 'center', justifyContent: 'center', gap: 1, marginTop: 7},
  temp: { fontSize: 10, lineHeight: 12, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  badge: { position: 'absolute', top: -6, right: -8, height: 14, width: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1.5, borderColor: '#134127' },
  badgeText: { fontSize: 9, lineHeight: 11, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  details: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, backgroundColor: '#1f6b45' },
  detailsText: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', borderRadius: 12, borderWidth: 1, paddingVertical: 9, paddingRight: 10, paddingLeft: 14 },
  warningBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  warningTitle: { fontSize: 13, lineHeight: 17, fontFamily: 'Inter_700Bold' },
  warningWhere: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  warningView: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  warningViewText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  heroTemp: { fontSize: 28, lineHeight: 32, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  heroLabel: { marginTop: 2, fontSize: 13, fontFamily: 'Inter_700Bold' },
  readings: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reading: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8 },
  readingLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  readingValue: { marginTop: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  caption: { marginTop: 12, fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.textFaint },
  hours: { marginTop: 6, flexDirection: 'row', gap: 5 },
  hour: { flex: 1, alignItems: 'center', gap: 3, borderRadius: 10, backgroundColor: c.subtle, paddingVertical: 7 },
  hourTime: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.textMuted },
  hourTemp: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text },
  hourRain: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.skyText },
  updatedRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  updated: { flex: 1, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.textFaint },
  smallRetry: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  muted: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  needsPlace: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_700Bold', color: c.text },
  unavailable: { gap: 4, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 12 },
  unavailableText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', color: c.text },
  retry: { marginTop: 6, alignSelf: 'flex-start', height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  retryText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  controls: { marginTop: 14, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 4 },
  change: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
  changeText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 9 },
  siteRowOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  siteTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  siteNote: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text },
  searchButton: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, backgroundColor: '#134127', paddingHorizontal: 12 },
  searchButtonText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  results: { overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  result: { borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 12, paddingVertical: 10, marginTop: -1 },
  resultText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
}))
