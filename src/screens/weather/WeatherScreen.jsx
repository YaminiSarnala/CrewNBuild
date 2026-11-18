// Site Weather: port of the web pages/weather/WeatherPage.jsx, for every
// signed-in role. Opened from the header weather button ("Detailed weather" or
// a warning's "View"), with route.params.project = a project id or 'me'.
//
//   site chips        My location and every project site the account may read
//   status / location the server's status line; set or change the site location
//   active alerts     most serious first, with precautions and Acknowledge
//   observed now      temperature, condition and nine readings
//   next 24 hours     a sideways strip
//   daily forecast    7 days, or every day the server sent
//   alert history     filters and pages
//
// Everything comes from /weather. The server chooses the provider, sets every
// threshold and says when data is stale or unavailable; this screen shows what
// it is sent and never fills a gap. Alerts carry recommendations only.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import PianoLoader from '../../components/PianoLoader'
import {
  Check, Cloud, CloudRain, Droplets, Eye, Gauge, History, Info, MapPin, RefreshCw, Search, ShieldAlert, Sunrise, Sunset,
  TriangleAlert, Umbrella, Wind,
} from 'lucide-react-native'
import { Notice, SelectChip, StackScreenShell } from '../../components/builder/BuilderUi'
import { DateField } from '../../components/form'
import WeatherIcon from '../../components/weather/WeatherIcon'
import { SkeletonBlock, SkeletonRows } from '../../components/Skeleton'
import {
  acknowledgeWeatherAlert, fetchCurrentWeather, fetchDailyForecast, fetchHourlyForecast, fetchWeatherAlertHistory,
  fetchWeatherAlerts, fetchWeatherProjects, saveSiteLocation, searchSiteLocation,
} from '../../api/weather'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { formatDateTime } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import {
  MY_SITE, SEVERITY_ORDER, compass, conditionIconName, coordinates, historyParams, measure, parseCoordinates, rainAmount,
  severityColors, siteClock, siteDateTime, siteDayMonth, siteWeekday, sortAlerts,
} from './weatherCore'
import { useWeatherText } from './weatherText'

const REFRESH_MS = 10 * 60 * 1000

const errorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function WeatherScreen({ navigation, route }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const { gutter } = useResponsive()
  const [catalog, setCatalog] = useState({ projects: [], alert_types: [] })
  const [listState, setListState] = useState('loading')
  const [projectId, setProjectId] = useState(route?.params?.project ? String(route.params.project) : '')
  const [weather, setWeather] = useState({ current: null, hourly: null, daily: null, alerts: null })
  const [weatherState, setWeatherState] = useState('idle')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const loadProjects = useCallback(() => fetchWeatherProjects()
    .then((data) => {
      setCatalog(data || { projects: [] })
      setListState('ready')
      const projects = data?.projects || []
      setProjectId((current) => (current === MY_SITE || projects.some((project) => String(project.id) === String(current))
        ? current : String(projects[0]?.id || MY_SITE)))
    })
    .catch((error) => { setListState(error?.response?.status === 503 ? 'unavailable' : 'error') }), [])

  useEffect(() => { loadProjects() }, [loadProjects])

  // A warning's "View" while this screen is already open: show that site.
  const wanted = route?.params?.project
  useEffect(() => { if (wanted) setProjectId(String(wanted)) }, [wanted])

  useEffect(() => {
    if (!projectId) return undefined
    let cancelled = false
    setWeatherState((state) => (state === 'ready' ? 'refreshing' : 'loading'))
    setLoadError('')
    // The four reads share one fetch on the server (a per-site cache and lock).
    Promise.allSettled([fetchCurrentWeather(projectId), fetchHourlyForecast(projectId), fetchDailyForecast(projectId), fetchWeatherAlerts(projectId)])
      .then(([current, hourly, daily, alerts]) => {
        if (cancelled) return
        if (current.status === 'rejected') {
          setLoadError(errorMessage(current.reason, text('weather.loadFailed')))
          setWeatherState('error')
          return
        }
        setWeather({
          current: current.value,
          hourly: hourly.status === 'fulfilled' ? hourly.value : null,
          daily: daily.status === 'fulfilled' ? daily.value : null,
          alerts: alerts.status === 'fulfilled' ? alerts.value : null,
        })
        setWeatherState('ready')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reloadKey])

  // Kept current while the screen stays open.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((value) => value + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const chooseProject = (value) => {
    if (String(value) === String(projectId)) return
    setProjectId(String(value))
    setWeather({ current: null, hourly: null, daily: null, alerts: null })
  }

  const refresh = () => {
    setReloadKey((value) => value + 1)
    loadProjects()
  }
  const onRefresh = async () => {
    setRefreshing(true)
    refresh()
    await new Promise((resolve) => setTimeout(resolve, 600))
    setRefreshing(false)
  }

  const replaceAlert = (updated) => setWeather((value) => ({
    ...value,
    alerts: value.alerts ? { ...value.alerts, alerts: value.alerts.alerts.map((alert) => (alert.id === updated.id ? updated : alert)) } : value.alerts,
  }))

  const view = weather.current
  const activeAlerts = useMemo(() => sortAlerts(weather.alerts?.alerts || []), [weather.alerts])
  const project = catalog.projects?.find((row) => String(row.id) === String(projectId))
  const busy = weatherState === 'loading' || weatherState === 'refreshing'
  const sites = [
    ...(catalog.projects || []).map((row) => ({
      id: String(row.id),
      label: td(row.title),
      note: row.access && row.access !== 'member' ? text(`weather.access.${row.access}`) : '',
      alerts: row.active_alerts || 0,
    })),
    { id: MY_SITE, label: text('weather.myLocation'), note: '', alerts: catalog.personal?.active_alerts || 0 },
  ]

  return (
    <StackScreenShell
      title={text('weather.title')}
      subtitle={project ? td(project.title) : projectId === MY_SITE ? text('weather.myLocation') : text('weather.subtitle')}
      onBack={() => navigation.goBack()}
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={listState === 'ready' ? (
        <Pressable onPress={refresh} accessibilityLabel={text('weather.refresh')} style={styles.headerButton} hitSlop={6}>
          {busy ? <PianoLoader color="#ffffff" height={14} /> : <RefreshCw size={18} color="#ffffff" />}
        </Pressable>
      ) : null}
    >
      {listState === 'ready' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: gutter, paddingBottom: 2 }}>
          {sites.map((site) => {
            const on = site.id === String(projectId)
            return (
              <Pressable key={site.id} onPress={() => chooseProject(site.id)} accessibilityState={{ selected: on }} style={[styles.siteChip, on ? styles.siteChipOn : null]}>
                <MapPin size={13} color={on ? '#ffffff' : COLORS.brand[700]} />
                <Text style={[styles.siteChipText, on ? styles.siteChipTextOn : null]} numberOfLines={1}>
                  {site.label}{site.note ? ` · ${site.note}` : ''}
                </Text>
                {site.alerts ? <View style={styles.siteAlerts}><Text style={styles.siteAlertsText}>{site.alerts}</Text></View> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: gutter, gap: 12, marginTop: 12 }}>
        {listState === 'loading' ? <WeatherSkeleton /> : null}
        {listState === 'unavailable' || listState === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{listState === 'unavailable' ? text('weather.unavailable') : text('weather.loadFailed')}</Text>
            <Pressable onPress={refresh} style={[styles.outlineButton, { marginTop: 10 }]}>
              <RefreshCw size={14} color={COLORS.brand[700]} />
              <Text style={styles.outlineButtonText}>{text('weather.refresh')}</Text>
            </Pressable>
          </View>
        ) : null}

        {listState === 'ready' && projectId ? (
          <>
            {weatherState === 'loading' && !view ? <WeatherSkeleton /> : null}
            {weatherState === 'error' ? <Notice tone="error" text={td(loadError)} /> : null}
            {view ? (
              <>
                <StatusBanner status={view.status} />
                <LocationPanel projectId={projectId} view={view} onSaved={refresh} />
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <TriangleAlert size={18} color={ink('#ea580c')} />
                    <Text style={styles.cardTitle}>{text('weather.activeAlerts')}</Text>
                    {activeAlerts.length ? <View style={styles.count}><Text style={styles.countText}>{activeAlerts.length}</Text></View> : null}
                  </View>
                  {activeAlerts.length ? (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {activeAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} onAcknowledged={replaceAlert} />)}
                    </View>
                  ) : <Text style={[styles.muted, { marginTop: 6 }]}>{text('weather.noAlerts')}</Text>}
                </View>
                <CurrentConditions view={view} />
                {view.status?.available ? <HourlyForecast hours={weather.hourly?.hours} /> : null}
                {view.status?.available ? <DailyForecast days={weather.daily?.days || []} extended={Boolean(weather.daily?.extended)} /> : null}
              </>
            ) : null}
          </>
        ) : null}

        {listState === 'ready' ? (
          <AlertHistory
            projects={(catalog.projects || []).filter((row) => (row.access || 'member') === 'member')}
            alertTypes={catalog.alert_types || []}
            reloadKey={reloadKey}
          />
        ) : null}
      </View>
    </StackScreenShell>
  )
}

/** The report's outline (location, alerts, conditions, forecast) while it loads. */
function WeatherSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <SkeletonBlock height={78} />
      <SkeletonBlock height={64} />
      <SkeletonBlock height={210} />
      <SkeletonBlock height={150} />
    </View>
  )
}

function SeverityChip({ severity }) {
  const text = useWeatherText()
  const colors = severityColors(severity)
  const severe = severity === 'SEVERE'
  const Icon = severe ? ShieldAlert : severity === 'INFO' ? Info : TriangleAlert
  const fg = severe ? '#ffffff' : ink(colors.ink)
  return (
    <View style={[styles.severity, { backgroundColor: severe ? '#dc2626' : soft(colors.bg, colors.bar), borderColor: severe ? '#b91c1c' : line(colors.border, colors.bar) }]}>
      <Icon size={11} color={fg} />
      <Text style={[styles.severityText, { color: fg }]}>{text(`weather.severity.${severity}`)}</Text>
    </View>
  )
}

// ---------------------------------------------------------------- status

function StatusBanner({ status }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  if (!status || (!status.message && !status.stale)) return null
  const warm = status.available
  return (
    <View style={[styles.status, { backgroundColor: warm ? soft('#fffbeb', '#d97706') : soft('#f8fafc', '#64748b'), borderColor: warm ? line('#fde68a', '#d97706') : line('#e2e8f0', '#64748b') }]}>
      <Info size={15} color={warm ? ink('#92400e') : ink('#334155')} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {status.message ? <Text style={[styles.statusText, { color: warm ? ink('#92400e') : ink('#334155') }]}>{td(status.message)}</Text> : null}
        {!status.location_required ? (
          <Text style={styles.statusSub}>
            {status.last_updated_at ? text('weather.lastUpdated', { time: formatDateTime(status.last_updated_at) }) : text('weather.neverUpdated')}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------- location

function LocationPanel({ projectId, view, onSaved }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const location = view?.location
  const canEdit = Boolean(view?.can_edit_location)
  const personal = view?.site === 'personal'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [manual, setManual] = useState({ latitude: '', longitude: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => { setOpen(false); setResults(null); setNotice(null); setQuery('') }, [projectId])

  const search = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const data = await searchSiteLocation(projectId, query.trim())
      // The suggested place fills an empty box only, never over what is typed.
      setQuery((current) => (current.trim() ? current : (data?.query || current)))
      setResults(data?.results || [])
    } catch (error) {
      setResults([])
      setNotice({ error: true, text: errorMessage(error, text('weather.searchFailed')) })
    } finally {
      setBusy(false)
    }
  }

  const save = async (payload) => {
    setBusy(true)
    setNotice(null)
    try {
      await saveSiteLocation(projectId, payload)
      setOpen(false)
      setResults(null)
      setNotice({ text: text('weather.locationSaved') })
      onSaved()
    } catch (error) {
      setNotice({ error: true, text: errorMessage(error, text('weather.locationFailed')) })
    } finally {
      setBusy(false)
    }
  }

  const saveManual = () => {
    const parsed = parseCoordinates(manual.latitude, manual.longitude)
    if (!parsed) {
      setNotice({ error: true, text: text('weather.locationInvalid') })
      return
    }
    save({ ...parsed, location_name: manual.name.trim() || null, source: 'MANUAL' })
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && results === null) search()
  }

  return (
    <View style={styles.card}>
      <View style={styles.locationRow}>
        <View style={styles.locationIcon}><MapPin size={18} color={COLORS.brand[700]} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>{text('weather.location')}</Text>
          {location ? (
            <>
              <Text style={styles.locationName} numberOfLines={2}>{td(location.location_name || coordinates(location))}</Text>
              <Text style={styles.locationCoords} numberOfLines={1}>{coordinates(location)}</Text>
              {location.approximate ? (
                <Text style={styles.approximate}>{text(personal ? 'weather.locationApproximateMine' : 'weather.locationApproximate')}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>{text(personal ? 'weather.myLocationHint' : 'weather.locationNone')}</Text>
          )}
        </View>
      </View>
      {canEdit ? (
        <Pressable onPress={toggle} style={[styles.outlineButton, { marginTop: 10 }]} accessibilityState={{ expanded: open }}>
          <Text style={styles.outlineButtonText}>{open ? text('weather.locationClose') : location ? text('weather.locationChange') : text('weather.locationSet')}</Text>
        </Pressable>
      ) : !location ? (
        <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.locationReadOnly')}</Text>
      ) : null}
      {notice ? <Text style={[styles.locationNotice, { color: notice.error ? ink('#b91c1c') : ink('#1f6b45') }]}>{notice.text}</Text> : null}

      {open && canEdit ? (
        <View style={styles.editor}>
          <Text style={styles.label}>{text('weather.locationSearch')}</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder={text('weather.locationSearch')}
              placeholderTextColor={COLORS.slate[400]}
              returnKeyType="search"
              maxLength={120}
              style={styles.input}
            />
            <Pressable onPress={search} disabled={busy} style={[styles.primaryButton, busy ? { opacity: 0.6 } : null]}>
              <Search size={14} color="#ffffff" />
              <Text style={styles.primaryButtonText}>{text('weather.locationSearchButton')}</Text>
            </Pressable>
          </View>
          {results ? (results.length ? (
            <View style={styles.results}>
              {results.map((place) => (
                <View key={`${place.latitude},${place.longitude}`} style={styles.result}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={2}>{td(place.name)}</Text>
                    <Text style={styles.locationCoords}>{coordinates(place)}</Text>
                  </View>
                  <Pressable
                    disabled={busy}
                    onPress={() => save({ latitude: place.latitude, longitude: place.longitude, location_name: place.name, country_code: place.country_code, timezone: place.timezone, source: 'SEARCH' })}
                    style={styles.useButton}
                  >
                    <Text style={styles.outlineButtonText}>{text('weather.locationUse')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : <Text style={styles.muted}>{text('weather.locationNoResults')}</Text>) : null}

          <Text style={[styles.label, { marginTop: 14 }]}>{text('weather.locationManual')}</Text>
          <View style={styles.searchRow}>
            <TextInput value={manual.latitude} onChangeText={(value) => setManual((m) => ({ ...m, latitude: value }))} placeholder={`${text('weather.latitude')} (17.38500)`} placeholderTextColor={COLORS.slate[400]} keyboardType="numbers-and-punctuation" style={styles.input} />
            <TextInput value={manual.longitude} onChangeText={(value) => setManual((m) => ({ ...m, longitude: value }))} placeholder={`${text('weather.longitude')} (78.48670)`} placeholderTextColor={COLORS.slate[400]} keyboardType="numbers-and-punctuation" style={styles.input} />
          </View>
          <TextInput value={manual.name} onChangeText={(value) => setManual((m) => ({ ...m, name: value }))} placeholder={text('weather.locationName')} placeholderTextColor={COLORS.slate[400]} maxLength={255} style={[styles.input, { marginTop: 8, flex: 0 }]} />
          <Pressable onPress={saveManual} disabled={busy} style={[styles.primaryButton, { marginTop: 8, alignSelf: 'flex-start' }, busy ? { opacity: 0.6 } : null]}>
            <Text style={styles.primaryButtonText}>{text('weather.locationSave')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------- alerts

function AlertCard({ alert, onAcknowledged }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [openAdvice, setOpenAdvice] = useState(alert.severity === 'WARNING' || alert.severity === 'SEVERE')
  const colors = severityColors(alert.severity)
  const others = (alert.acknowledgements || []).map((row) => row.name).filter(Boolean)
  const condition = alert.weather_condition || (alert.alert_type === 'WIND' ? 'SQUALL' : alert.alert_type === 'HEAT' ? 'CLEAR' : 'RAIN')

  const acknowledge = async () => {
    setBusy(true)
    setFailed(false)
    try {
      onAcknowledged(await acknowledgeWeatherAlert(alert.id))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.alert, { backgroundColor: soft(colors.bg, colors.bar), borderColor: line(colors.border, colors.bar) }]}>
      <View style={[styles.alertBar, { backgroundColor: colors.bar }]} />
      <View style={styles.alertTop}>
        <WeatherIcon name={conditionIconName(condition)} size={22} />
        <View style={styles.alertChips}>
          <SeverityChip severity={alert.severity} />
          <View style={styles.sourceChip}>
            <Text style={styles.sourceChipText}>{alert.source === 'OFFICIAL' ? text('weather.official') : text('weather.forecastBased')}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.alertTitle}>{td(alert.title)}</Text>
      <Text style={styles.alertMessage}>{td(alert.message)}</Text>
      {alert.expected_start ? (
        <Text style={styles.alertWhen}>
          {alert.expected_end
            ? text('weather.expected', { start: siteDateTime(alert.expected_start), end: siteDateTime(alert.expected_end) })
            : text('weather.expectedFrom', { start: siteDateTime(alert.expected_start) })}
          {` (${text('weather.siteTime')})`}
        </Text>
      ) : null}
      {alert.recommendations?.length ? (
        <View style={{ marginTop: 8 }}>
          <Pressable onPress={() => setOpenAdvice((value) => !value)} accessibilityState={{ expanded: openAdvice }} hitSlop={6}>
            <Text style={styles.adviceToggle}>{text('weather.recommendations')}</Text>
          </Pressable>
          {openAdvice ? (
            <View style={{ marginTop: 4, gap: 3 }}>
              {alert.recommendations.map((advice) => (
                <Text key={advice} style={styles.advice}>{`•  ${td(advice)}`}</Text>
              ))}
              <Text style={styles.adviceNote}>{text('weather.recommendationsNote')}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {others.length ? <Text style={styles.alertWhen}>{text('weather.acknowledgedBy', { names: others.join(', ') })}</Text> : null}
      {failed ? <Text style={[styles.alertWhen, { color: ink('#b91c1c') }]}>{text('weather.ackFailed')}</Text> : null}
      {alert.status === 'ACTIVE' && alert.can_acknowledge !== false ? (alert.acknowledged ? (
        <View style={styles.acknowledged}>
          <Check size={14} color={ink('#1f6b45')} />
          <Text style={styles.acknowledgedText}>{text('weather.acknowledged')}</Text>
        </View>
      ) : (
        <Pressable onPress={acknowledge} disabled={busy} style={[styles.primaryButton, { marginTop: 10, alignSelf: 'flex-start' }, busy ? { opacity: 0.6 } : null]}>
          {busy ? <PianoLoader color="#ffffff" height={14} /> : null}
          <Text style={styles.primaryButtonText}>{text('weather.acknowledge')}</Text>
        </Pressable>
      )) : null}
    </View>
  )
}

// ---------------------------------------------------------------- current

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <View style={styles.metric}>
      <Icon size={15} color={COLORS.brand[700]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
        {sub ? <Text style={styles.metricSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  )
}

function CurrentConditions({ view }) {
  const text = useWeatherText()
  const current = view?.current
  if (!current) return null
  const condition = current.condition || 'UNKNOWN'
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{text('weather.observed')}</Text>
      <Text style={styles.observedAt}>{text('weather.observedAt', { time: siteClock(current.observed_at), zone: view.timezone || text('weather.siteTime') })}</Text>
      <View style={styles.nowHero}>
        <WeatherIcon name={conditionIconName(condition, current.is_day)} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nowTemp}>{measure(current.temperature_c, '°C')}</Text>
          <Text style={styles.nowCondition}>
            {condition === 'CLEAR' && current.is_day === false ? text('weather.clearNight') : text(`weather.condition.${condition}`)}
          </Text>
          <Text style={styles.metricSub}>{text('weather.feelsLike', { value: measure(current.feels_like_c, '°C') })}</Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <Metric icon={Droplets} label={text('weather.humidity')} value={measure(current.humidity_pct, '%')} />
        <Metric
          icon={Wind}
          label={text('weather.wind')}
          value={measure(current.wind_speed_kmh, 'km/h')}
          sub={[compass(current.wind_direction_deg), typeof current.wind_gust_kmh === 'number' ? text('weather.gusts', { value: measure(current.wind_gust_kmh, 'km/h') }) : ''].filter(Boolean).join(' · ')}
        />
        <Metric icon={Gauge} label={text('weather.pressure')} value={measure(current.pressure_hpa, 'hPa')} />
        <Metric icon={Eye} label={text('weather.visibility')} value={measure(current.visibility_km, 'km', 1)} />
        <Metric icon={Cloud} label={text('weather.cloud')} value={measure(current.cloud_cover_pct, '%')} />
        <Metric icon={CloudRain} label={text('weather.rainNow')} value={rainAmount(current.precipitation_mm)} />
        <Metric icon={Umbrella} label={text('weather.rainChance')} value={measure(current.precipitation_probability_pct, '%')} />
        <Metric icon={Sunrise} label={text('weather.sunrise')} value={siteClock(current.sunrise)} />
        <Metric icon={Sunset} label={text('weather.sunset')} value={siteClock(current.sunset)} />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------- forecasts

function HourlyForecast({ hours }) {
  const text = useWeatherText()
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{text('weather.hourly')}</Text>
        <Text style={styles.tag}>{`${text('weather.forecastLabel')} · ${text('weather.siteTime')}`}</Text>
      </View>
      {hours?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
          {hours.map((hour) => (
            <View key={hour.time} style={styles.hour}>
              <Text style={styles.hourTime}>{siteClock(hour.time)}</Text>
              <WeatherIcon name={conditionIconName(hour.condition)} size={22} />
              <Text style={styles.hourTemp}>{measure(hour.temperature_c, '°')}</Text>
              <View style={styles.inline}>
                <Umbrella size={11} color={ink('#0369a1')} />
                <Text style={styles.hourRain}>{measure(hour.precipitation_probability_pct, '%')}</Text>
              </View>
              <Text style={styles.hourSmall}>{rainAmount(hour.precipitation_mm)}</Text>
              <View style={styles.inline}>
                <Wind size={11} color={COLORS.slate[400]} />
                <Text style={styles.hourSmall}>{measure(hour.wind_speed_kmh)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.noForecast')}</Text>}
    </View>
  )
}

function DailyForecast({ days, extended }) {
  const text = useWeatherText()
  const { language, td } = useLanguage()
  const [all, setAll] = useState(false)
  const shown = all ? days : (days || []).slice(0, 7)
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{text('weather.daily')}</Text>
        {extended ? (
          <Pressable onPress={() => setAll((value) => !value)} style={styles.smallOutline}>
            <Text style={styles.outlineButtonText}>{all ? text('weather.showFewer') : text('weather.showDays', { count: days.length })}</Text>
          </Pressable>
        ) : <Text style={styles.tag}>{text('weather.forecastLabel')}</Text>}
      </View>
      {shown?.length ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          {shown.map((day, index) => (
            <View key={day.date} style={styles.day}>
              <View style={{ width: 62 }}>
                <Text style={styles.dayName}>{index === 0 ? text('weather.today') : siteWeekday(day.date, language || 'en')}</Text>
                <Text style={styles.hourSmall}>{siteDayMonth(day.date)}</Text>
              </View>
              <WeatherIcon name={conditionIconName(day.condition)} size={26} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.dayCondition} numberOfLines={1}>{text(`weather.condition.${day.condition || 'UNKNOWN'}`)}</Text>
                <Text style={styles.hourSmall} numberOfLines={1}>
                  {`${measure(day.precipitation_probability_pct, '%')} · ${rainAmount(day.precipitation_mm)} · ${measure(day.wind_speed_max_kmh, 'km/h')} ${compass(day.wind_direction_deg)}`}
                  {typeof day.wind_gust_max_kmh === 'number' ? ` · ${text('weather.gusts', { value: measure(day.wind_gust_max_kmh) })}` : ''}
                </Text>
                {day.summary ? <Text style={styles.hourSmall} numberOfLines={2}>{td(day.summary)}</Text> : null}
              </View>
              <Text style={styles.dayTemp}>
                {measure(day.temp_max_c, '°')}
                <Text style={styles.dayMin}>{` ${measure(day.temp_min_c, '°')}`}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.noForecast')}</Text>}
    </View>
  )
}

// ---------------------------------------------------------------- history

const EMPTY_FILTERS = { project_id: '', alert_type: '', severity: '', status: '', acknowledged: '', date_from: '', date_to: '' }

function AlertHistory({ projects, alertTypes, reloadKey }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ alerts: [], total: 0, page_size: 25 })
  const [state, setState] = useState('loading')
  const update = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value || '' }))
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchWeatherAlertHistory(historyParams({ ...filters, page }))
      .then((result) => { if (!cancelled) { setData(result || { alerts: [], total: 0 }); setState('ready') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [filters, page, reloadKey])

  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 25)))
  const filtered = Object.values(filters).some(Boolean)

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <History size={18} color={COLORS.brand[700]} />
        <Text style={styles.cardTitle}>{text('weather.history')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        <SelectChip
          placeholder={text('weather.allProjects')}
          value={filters.project_id}
          options={[{ value: MY_SITE, label: text('weather.myLocation') }, ...projects.map((row) => ({ value: String(row.id), label: td(row.title) }))]}
          onChange={update('project_id')}
        />
        <SelectChip placeholder={text('weather.filterType')} value={filters.alert_type} options={alertTypes.map((type) => ({ value: type.code, label: td(type.label) }))} onChange={update('alert_type')} />
        <SelectChip placeholder={text('weather.filterSeverity')} value={filters.severity} options={SEVERITY_ORDER.map((severity) => ({ value: severity, label: text(`weather.severity.${severity}`) }))} onChange={update('severity')} />
        <SelectChip placeholder={text('weather.filterStatus')} value={filters.status} options={['ACTIVE', 'RESOLVED', 'EXPIRED'].map((status) => ({ value: status, label: text(`weather.status.${status}`) }))} onChange={update('status')} />
        <SelectChip placeholder={text('weather.filterAck')} value={filters.acknowledged} options={[{ value: 'true', label: text('weather.ack.yes') }, { value: 'false', label: text('weather.ack.no') }]} onChange={update('acknowledged')} />
      </ScrollView>
      <View style={styles.dates}>
        <DateField label={text('weather.filterFrom')} value={filters.date_from} onChange={update('date_from')} max={filters.date_to || undefined} containerStyle={{ flex: 1, marginBottom: 0 }} />
        <DateField label={text('weather.filterTo')} value={filters.date_to} onChange={update('date_to')} min={filters.date_from || undefined} containerStyle={{ flex: 1, marginBottom: 0 }} />
      </View>
      {filtered ? (
        <Pressable onPress={() => { setFilters(EMPTY_FILTERS); setPage(1) }} style={[styles.smallOutline, { marginTop: 8, alignSelf: 'flex-end' }]}>
          <Text style={styles.outlineButtonText}>{text('weather.clearFilters')}</Text>
        </Pressable>
      ) : null}

      {state === 'error' ? <Text style={[styles.muted, { marginTop: 10, color: ink('#b91c1c') }]}>{text('weather.loadFailed')}</Text> : null}
      {state === 'loading' ? <SkeletonRows count={3} style={{ marginTop: 10 }} /> : null}
      {state === 'ready' ? (data.alerts?.length ? (
        <View style={styles.historyList}>
          {data.alerts.map((alert) => (
            <View key={alert.id} style={styles.historyRow}>
              <View style={styles.alertChips}>
                <SeverityChip severity={alert.severity} />
                <Text style={styles.historySite} numberOfLines={1}>{alert.site === 'personal' ? text('weather.myLocation') : td(alert.project_title || '')}</Text>
              </View>
              <Text style={styles.historyTitle} numberOfLines={2}>{td(alert.title)}</Text>
              <Text style={styles.hourSmall} numberOfLines={2}>{td(alert.message)}</Text>
              <Text style={styles.hourSmall}>
                {[
                  td(alert.type_label),
                  alert.weather_condition ? `${text('weather.condition')}: ${text(`weather.condition.${alert.weather_condition}`)}` : '',
                  text('weather.generated', { time: formatDateTime(alert.created_at) }),
                  alert.resolved_at ? text('weather.resolvedOn', { time: formatDateTime(alert.resolved_at) }) : '',
                ].filter(Boolean).join(' · ')}
              </Text>
              <View style={[styles.alertChips, { marginTop: 4 }]}>
                <Text style={[styles.pill, alert.status === 'ACTIVE' ? styles.pillOn : null]}>{text(`weather.status.${alert.status}`)}</Text>
                <Text style={[styles.pill, alert.acknowledged ? styles.pillOn : null]}>{alert.acknowledged ? text('weather.ack.yes') : text('weather.ack.no')}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : <Text style={[styles.muted, { marginTop: 10 }]}>{text('weather.historyEmpty')}</Text>) : null}

      {pages > 1 ? (
        <View style={styles.pager}>
          <Pressable disabled={page <= 1} onPress={() => setPage((value) => value - 1)} style={[styles.smallOutline, page <= 1 ? { opacity: 0.5 } : null]}>
            <Text style={styles.outlineButtonText}>{text('weather.previous')}</Text>
          </Pressable>
          <Text style={styles.muted}>{text('weather.page', { page, pages })}</Text>
          <Pressable disabled={page >= pages} onPress={() => setPage((value) => value + 1)} style={[styles.smallOutline, page >= pages ? { opacity: 0.5 } : null]}>
            <Text style={styles.outlineButtonText}>{text('weather.next')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  headerButton: { height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)' },
  siteChip: { maxWidth: 240, height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  siteChipOn: { borderColor: '#1f6b45', backgroundColor: '#1f6b45' },
  siteChipText: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
  siteChipTextOn: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  siteAlerts: { minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#ea580c', paddingHorizontal: 4 },
  siteAlertsText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  count: { borderRadius: 999, backgroundColor: c.muted, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text },
  muted: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  label: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.textFaint },
  tag: { borderRadius: 7, backgroundColor: c.muted, paddingHorizontal: 7, paddingVertical: 2, fontSize: 9.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textMuted, overflow: 'hidden' },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  statusText: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_700Bold' },
  statusSub: { marginTop: 2, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  locationIcon: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft },
  locationName: { marginTop: 2, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_700Bold', color: c.text },
  locationCoords: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  approximate: { marginTop: 4, alignSelf: 'flex-start', borderRadius: 6, backgroundColor: c.amberSoft, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.amberText, overflow: 'hidden' },
  locationNotice: { marginTop: 8, fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  editor: { marginTop: 12, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 12 },
  searchRow: { marginTop: 6, flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 11, fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text },
  primaryButton: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, backgroundColor: '#1f6b45', paddingHorizontal: 13 },
  primaryButtonText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  outlineButton: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14 },
  outlineButtonText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  smallOutline: { height: 32, justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  results: { marginTop: 8, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 11, paddingVertical: 9, marginTop: -1 },
  resultName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  useButton: { height: 34, justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: c.border, paddingHorizontal: 11 },
  alert: { overflow: 'hidden', borderRadius: 13, borderWidth: 1, paddingVertical: 11, paddingRight: 12, paddingLeft: 15 },
  alertBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  alertChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  severity: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  severityText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase' },
  sourceChip: { borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 6, paddingVertical: 2 },
  sourceChipText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textMuted },
  alertTitle: { marginTop: 8, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_700Bold', color: c.text },
  alertMessage: { marginTop: 3, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  alertWhen: { marginTop: 6, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  adviceToggle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong, textDecorationLine: 'underline' },
  advice: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  adviceNote: { marginTop: 2, fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.textFaint },
  acknowledged: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 7 },
  acknowledgedText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  observedAt: { marginTop: 3, fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.brandTextSoft },
  nowHero: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, backgroundColor: c.brandSoft, padding: 14 },
  nowTemp: { fontSize: 34, lineHeight: 38, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  nowCondition: { marginTop: 2, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  metrics: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 9 },
  metricLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  metricValue: { marginTop: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  metricSub: { marginTop: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textMuted },
  hour: { width: 74, alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingVertical: 10 },
  hourTime: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.textMuted },
  hourTemp: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  hourRain: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.skyText },
  hourSmall: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.textMuted },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 11, paddingVertical: 9 },
  dayName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  dayCondition: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  dayTemp: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  dayMin: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  dates: { marginTop: 8, flexDirection: 'row', gap: 10 },
  historyList: { marginTop: 10, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  historyRow: { gap: 3, borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 11, paddingVertical: 10, marginTop: -1 },
  historySite: { flexShrink: 1, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  historyTitle: { marginTop: 3, fontSize: 13, lineHeight: 17, fontFamily: 'Inter_700Bold', color: c.text },
  pill: { borderRadius: 6, backgroundColor: c.muted, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textMuted, overflow: 'hidden' },
  pillOn: { backgroundColor: c.brandSoft, color: c.brandTextStrong },
  pager: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
}))
