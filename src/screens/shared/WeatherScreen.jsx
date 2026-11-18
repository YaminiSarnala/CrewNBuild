// Site Weather (web pages/weather/WeatherPage.jsx): current conditions, forecasts
// and weather alerts for the account's own place ("My location") and the project
// sites it may read. Opened from the weather pill in the dashboard header.
//
// Everything comes from /weather (api/weather.js). The server chooses the
// provider, sets every threshold and says when data is stale or unavailable;
// this screen shows what it is sent and never fills a gap. Alerts carry
// recommendations only: nothing here changes a schedule or an assignment.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSelector } from 'react-redux'
import {
  AlertTriangle, Check, Cloud, CloudRain, Droplets, Eye, Gauge, History, Info, MapPin, RefreshCw, Search, Sunrise,
  Sunset, Umbrella, Wind,
} from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useWeatherText } from '../../i18n/weatherText'
import { createStyles } from '../../theme/createStyles'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { ActionButton, LabeledInput, Section, SelectChip, StackScreenShell } from '../../components/builder/BuilderUi'
import { ConditionIcon, SeverityChip } from '../../components/weather/WeatherParts'
import { saveWeatherChoice } from '../../components/weather/WeatherPill'
import {
  acknowledgeWeatherAlert, fetchCurrentWeather, fetchDailyForecast, fetchHourlyForecast, fetchWeatherAlertHistory,
  fetchWeatherAlerts, fetchWeatherProjects, saveSiteLocation, searchSiteLocation,
} from '../../api/weather'
import { formatDateTime } from '../../utils/formatters'
import {
  MY_SITE, SEVERITY_ORDER, compass, coordinates, historyParams, measure, parseCoordinates, rainAmount, severityTone,
  siteClock, siteDateTime, siteDayMonth, siteWeekday, sortAlerts,
} from '../../utils/weatherHelpers'

const REFRESH_MS = 10 * 60 * 1000

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

function CardTitle({ icon: Icon, iconColor, title, right }) {
  return (
    <View style={styles.cardHead}>
      {Icon ? <Icon size={18} color={ink(iconColor || '#126b45')} /> : null}
      <Text style={styles.cardTitle}>{title}</Text>
      {right}
    </View>
  )
}

function Tag({ children, tone = 'slate' }) {
  const [bg, fg] = tone === 'brand' ? ['#ecfdf5', '#047857'] : tone === 'amber' ? ['#fffbeb', '#b45309'] : ['#f1f5f9', '#475569']
  return (
    <View style={[styles.tag, { backgroundColor: soft(bg, fg) }]}>
      <Text style={[styles.tagText, { color: ink(fg) }]}>{children}</Text>
    </View>
  )
}

// ----------------------------------------------------------------- status

function StatusBanner({ status }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  if (!status || (!status.message && !status.stale)) return null
  const [bg, fg, border] = status.available ? ['#fffbeb', '#92400e', '#fde68a'] : ['#f8fafc', '#334155', '#e2e8f0']
  return (
    <View style={[styles.banner, { backgroundColor: soft(bg, fg), borderColor: line(border, fg) }]}>
      <Info size={15} color={ink(fg)} />
      <Text style={[styles.bannerText, { color: ink(fg) }]}>
        {[status.message ? td(status.message) : '',
          !status.location_required ? (status.last_updated_at ? text('weather.lastUpdated', { time: formatDateTime(status.last_updated_at) }) : text('weather.neverUpdated')) : '',
        ].filter(Boolean).join(' · ')}
      </Text>
    </View>
  )
}

// ----------------------------------------------------------------- location

function LocationPanel({ site, view, onSaved }) {
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

  useEffect(() => { setOpen(false); setResults(null); setNotice(null); setQuery('') }, [site])

  const search = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const data = await searchSiteLocation(site, query.trim())
      // The suggested place fills an empty box only, never over what is being typed.
      setQuery((current) => (current.trim() ? current : (data.query || current)))
      setResults(data.results || [])
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
      await saveSiteLocation(site, payload)
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
    if (!parsed) { setNotice({ error: true, text: text('weather.locationInvalid') }); return }
    save({ ...parsed, location_name: manual.name.trim() || null, source: 'MANUAL' })
  }

  const toggleEditor = () => {
    const next = !open
    setOpen(next)
    if (next && results === null) search()
  }

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.locationIcon}><MapPin size={18} color={ink('#126b45')} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>{text('weather.location')}</Text>
          {location ? (
            <>
              <Text style={styles.strong} numberOfLines={1}>{td(location.location_name || coordinates(location))}</Text>
              <Text style={styles.muted} numberOfLines={1}>{coordinates(location)}</Text>
              {location.approximate ? <Tag tone="amber">{text(personal ? 'weather.locationApproximateMine' : 'weather.locationApproximate')}</Tag> : null}
            </>
          ) : (
            <Text style={styles.mutedBold}>{text(personal ? 'weather.myLocationHint' : 'weather.locationNone')}</Text>
          )}
        </View>
      </View>
      {canEdit ? (
        <ActionButton
          small
          tone="outline"
          label={open ? text('weather.locationClose') : location ? text('weather.locationChange') : text('weather.locationSet')}
          onPress={toggleEditor}
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
        />
      ) : !location ? (
        <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.locationReadOnly')}</Text>
      ) : null}
      {notice ? <Text style={[styles.notice, { color: ink(notice.error ? '#b91c1c' : '#047857') }]}>{notice.text}</Text> : null}
      {open && canEdit ? (
        <View style={styles.editor}>
          <Text style={styles.label}>{text('weather.locationSearch')}</Text>
          <View style={[styles.row, { marginTop: 4 }]}>
            <View style={{ flex: 1 }}>
              <LabeledInput value={query} maxLength={120} onChangeText={setQuery} placeholder={text('weather.locationSearch')} onSubmitEditing={search} returnKeyType="search" />
            </View>
            <ActionButton small icon={Search} label={text('weather.locationSearchButton')} busy={busy && !results} disabled={busy} onPress={search} />
          </View>
          {results ? (results.length ? (
            <View style={styles.results}>
              {results.map((place) => (
                <View key={`${place.latitude},${place.longitude}`} style={styles.resultRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.strongSmall} numberOfLines={1}>{td(place.name)}</Text>
                    <Text style={styles.muted}>{coordinates(place)}</Text>
                  </View>
                  <ActionButton
                    small
                    tone="outline"
                    label={text('weather.locationUse')}
                    disabled={busy}
                    onPress={() => save({ latitude: place.latitude, longitude: place.longitude, location_name: place.name, country_code: place.country_code, timezone: place.timezone, source: 'SEARCH' })}
                  />
                </View>
              ))}
            </View>
          ) : <Text style={[styles.muted, { marginTop: 6 }]}>{text('weather.locationNoResults')}</Text>) : null}

          <Text style={[styles.label, { marginTop: 14 }]}>{text('weather.locationManual')}</Text>
          <View style={[styles.row, { marginTop: 4 }]}>
            <View style={{ flex: 1 }}>
              <LabeledInput label={text('weather.latitude')} keyboardType="numbers-and-punctuation" value={manual.latitude} placeholder="17.38500" onChangeText={(value) => setManual((current) => ({ ...current, latitude: value }))} />
            </View>
            <View style={{ flex: 1 }}>
              <LabeledInput label={text('weather.longitude')} keyboardType="numbers-and-punctuation" value={manual.longitude} placeholder="78.48670" onChangeText={(value) => setManual((current) => ({ ...current, longitude: value }))} />
            </View>
          </View>
          <LabeledInput label={text('weather.locationName')} maxLength={255} value={manual.name} onChangeText={(value) => setManual((current) => ({ ...current, name: value }))} />
          <ActionButton small label={text('weather.locationSave')} disabled={busy} onPress={saveManual} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </View>
      ) : null}
    </Card>
  )
}

// ----------------------------------------------------------------- alerts

function AlertCard({ alert, onAcknowledged }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [openAdvice, setOpenAdvice] = useState(alert.severity === 'WARNING' || alert.severity === 'SEVERE')
  const [bg, fg, border] = severityTone(alert.severity)
  const bar = alert.severity === 'SEVERE' ? '#dc2626' : fg
  const tint = alert.severity === 'SEVERE' ? '#dc2626' : fg
  const others = (alert.acknowledgements || []).map((row) => row.name).filter(Boolean)

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
    <View style={[styles.alert, { borderColor: line(alert.severity === 'SEVERE' ? '#fca5a5' : border, tint), backgroundColor: soft(alert.severity === 'SEVERE' ? '#fef2f2' : bg, tint) }]}>
      <View style={[styles.alertBar, { backgroundColor: bar }]} />
      <View style={styles.row}>
        <ConditionIcon condition={alert.weather_condition || (alert.alert_type === 'WIND' ? 'SQUALL' : alert.alert_type === 'HEAT' ? 'CLEAR' : 'RAIN')} size={22} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.wrapRow}>
            <SeverityChip severity={alert.severity} />
            <Tag>{alert.source === 'OFFICIAL' ? text('weather.official') : text('weather.forecastBased')}</Tag>
          </View>
          <Text style={[styles.strong, { marginTop: 4 }]}>{td(alert.title)}</Text>
          <Text style={styles.body}>{td(alert.message)}</Text>
          {alert.expected_start ? (
            <Text style={styles.muted}>
              {`${alert.expected_end
                ? text('weather.expected', { start: siteDateTime(alert.expected_start), end: siteDateTime(alert.expected_end) })
                : text('weather.expectedFrom', { start: siteDateTime(alert.expected_start) })} (${text('weather.siteTime')})`}
            </Text>
          ) : null}
          {alert.recommendations?.length ? (
            <View style={{ marginTop: 6 }}>
              <Pressable onPress={() => setOpenAdvice((value) => !value)} accessibilityRole="button">
                <Text style={styles.link}>{text('weather.recommendations')}</Text>
              </Pressable>
              {openAdvice ? (
                <>
                  {alert.recommendations.map((advice) => <Text key={advice} style={styles.body}>{`• ${td(advice)}`}</Text>)}
                  <Text style={styles.tiny}>{text('weather.recommendationsNote')}</Text>
                </>
              ) : null}
            </View>
          ) : null}
          {others.length ? <Text style={styles.muted}>{text('weather.acknowledgedBy', { names: others.join(', ') })}</Text> : null}
          {failed ? <Text style={[styles.notice, { color: ink('#b91c1c') }]}>{text('weather.ackFailed')}</Text> : null}
          {alert.status === 'ACTIVE' && alert.can_acknowledge !== false ? (alert.acknowledged ? (
            <View style={[styles.row, { marginTop: 8, gap: 4 }]}>
              <Check size={14} color={ink('#047857')} />
              <Text style={[styles.strongSmall, { color: ink('#047857') }]}>{text('weather.acknowledged')}</Text>
            </View>
          ) : (
            <ActionButton small label={text('weather.acknowledge')} busy={busy} onPress={acknowledge} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          )) : null}
        </View>
      </View>
    </View>
  )
}

// ----------------------------------------------------------------- current

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <View style={styles.metric}>
      <Icon size={15} color={ink('#126b45')} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>{value}{sub ? <Text style={styles.metricSub}>{` ${sub}`}</Text> : null}</Text>
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
    <Card>
      <CardTitle title={text('weather.observed')} right={<Tag tone="brand">{text('weather.observedAt', { time: siteClock(current.observed_at), zone: view.timezone || text('weather.siteTime') })}</Tag>} />
      <View style={styles.now}>
        <ConditionIcon condition={condition} isDay={current.is_day} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.temp}>{measure(current.temperature_c, '°C')}</Text>
          <Text style={styles.conditionText}>{condition === 'CLEAR' && current.is_day === false ? text('weather.clearNight') : text(`weather.condition.${condition}`)}</Text>
          <Text style={styles.muted}>{text('weather.feelsLike', { value: measure(current.feels_like_c, '°C') })}</Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <Metric icon={Droplets} label={text('weather.humidity')} value={measure(current.humidity_pct, '%')} />
        <Metric icon={Wind} label={text('weather.wind')} value={measure(current.wind_speed_kmh, 'km/h')}
          sub={[compass(current.wind_direction_deg), typeof current.wind_gust_kmh === 'number' ? text('weather.gusts', { value: measure(current.wind_gust_kmh, 'km/h') }) : ''].filter(Boolean).join(' · ')} />
        <Metric icon={Gauge} label={text('weather.pressure')} value={measure(current.pressure_hpa, 'hPa')} />
        <Metric icon={Eye} label={text('weather.visibility')} value={measure(current.visibility_km, 'km', 1)} />
        <Metric icon={Cloud} label={text('weather.cloud')} value={measure(current.cloud_cover_pct, '%')} />
        <Metric icon={CloudRain} label={text('weather.rainNow')} value={rainAmount(current.precipitation_mm)} />
        <Metric icon={Umbrella} label={text('weather.rainChance')} value={measure(current.precipitation_probability_pct, '%')} />
        <Metric icon={Sunrise} label={text('weather.sunrise')} value={siteClock(current.sunrise)} />
        <Metric icon={Sunset} label={text('weather.sunset')} value={siteClock(current.sunset)} />
      </View>
    </Card>
  )
}

// ----------------------------------------------------------------- forecasts

function HourlyForecast({ hours }) {
  const text = useWeatherText()
  return (
    <Card>
      <CardTitle title={text('weather.hourly')} right={<Tag>{`${text('weather.forecastLabel')} · ${text('weather.siteTime')}`}</Tag>} />
      {hours?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
          {hours.map((hour) => (
            <View key={hour.time} style={styles.hour}>
              <Text style={styles.metricLabel}>{siteClock(hour.time)}</Text>
              <ConditionIcon condition={hour.condition} size={22} />
              <Text style={styles.strong}>{measure(hour.temperature_c, '°')}</Text>
              <View style={[styles.row, { gap: 2 }]}><Umbrella size={11} color={ink('#0369a1')} /><Text style={styles.rain}>{measure(hour.precipitation_probability_pct, '%')}</Text></View>
              <Text style={styles.tiny}>{rainAmount(hour.precipitation_mm)}</Text>
              <View style={[styles.row, { gap: 2 }]}><Wind size={11} color={COLORS.slate[500]} /><Text style={styles.tiny}>{measure(hour.wind_speed_kmh)}</Text></View>
            </View>
          ))}
        </ScrollView>
      ) : <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.noForecast')}</Text>}
    </Card>
  )
}

function DailyForecast({ days, extended }) {
  const text = useWeatherText()
  const { language, td } = useLanguage()
  const [all, setAll] = useState(false)
  const shown = all ? days : (days || []).slice(0, 7)
  return (
    <Card>
      <CardTitle title={text('weather.daily')} right={<Tag>{text('weather.forecastLabel')}</Tag>} />
      {extended ? (
        <ActionButton small tone="outline" label={all ? text('weather.showFewer') : text('weather.showDays', { count: days.length })} onPress={() => setAll((value) => !value)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      ) : null}
      {shown?.length ? (
        <View style={styles.days}>
          {shown.map((day, index) => (
            <View key={day.date} style={styles.day}>
              <Text style={styles.strongSmall}>{index === 0 ? text('weather.today') : siteWeekday(day.date, language || 'en')}</Text>
              <Text style={styles.tiny}>{siteDayMonth(day.date)}</Text>
              <View style={[styles.row, { marginTop: 2 }]}>
                <ConditionIcon condition={day.condition} size={24} />
                <Text style={styles.strong}>{measure(day.temp_max_c, '°')}<Text style={styles.metricSub}>{` ${measure(day.temp_min_c, '°')}`}</Text></Text>
              </View>
              <Text style={styles.conditionSmall} numberOfLines={1}>{day.condition ? text(`weather.condition.${day.condition}`) : text('weather.condition.UNKNOWN')}</Text>
              <View style={[styles.row, { gap: 3 }]}><Umbrella size={11} color={ink('#0369a1')} /><Text style={styles.rain}>{`${measure(day.precipitation_probability_pct, '%')} · ${rainAmount(day.precipitation_mm)}`}</Text></View>
              <View style={[styles.row, { gap: 3 }]}>
                <Wind size={11} color={COLORS.slate[500]} />
                <Text style={styles.tiny} numberOfLines={2}>{`${measure(day.wind_speed_max_kmh, 'km/h')} ${compass(day.wind_direction_deg)}${typeof day.wind_gust_max_kmh === 'number' ? ` · ${text('weather.gusts', { value: measure(day.wind_gust_max_kmh) })}` : ''}`}</Text>
              </View>
              {day.summary ? <Text style={styles.tiny} numberOfLines={2}>{td(day.summary)}</Text> : null}
            </View>
          ))}
        </View>
      ) : <Text style={[styles.muted, { marginTop: 8 }]}>{text('weather.noForecast')}</Text>}
    </Card>
  )
}

// ----------------------------------------------------------------- history

const EMPTY_FILTERS = { project_id: '', alert_type: '', severity: '', status: '', acknowledged: '', date_from: '', date_to: '' }
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function AlertHistory({ projects, alertTypes, reloadKey }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dates, setDates] = useState({ date_from: '', date_to: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ alerts: [], total: 0, page_size: 25 })
  const [state, setState] = useState('loading')
  const update = (key) => (value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }
  // A typed date counts once it is a whole YYYY-MM-DD (or empty).
  const updateDate = (key) => (value) => {
    setDates((current) => ({ ...current, [key]: value }))
    if (!value || DATE_PATTERN.test(value)) update(key)(value)
  }

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchWeatherAlertHistory(historyParams({ ...filters, page }))
      .then((result) => { if (!cancelled) { setData(result); setState('ready') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [filters, page, reloadKey])

  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 25)))
  const options = (rows) => rows.map(([value, label]) => ({ value: String(value), label }))

  return (
    <Card>
      <CardTitle icon={History} title={text('weather.history')} />
      <View style={[styles.wrapRow, { marginTop: 10 }]}>
        <SelectChip placeholder={text('weather.allProjects')} value={filters.project_id} onChange={update('project_id')}
          options={options([[MY_SITE, text('weather.myLocation')], ...projects.map((project) => [project.id, td(project.title)])])} />
        <SelectChip placeholder={text('weather.filterType')} value={filters.alert_type} onChange={update('alert_type')}
          options={options(alertTypes.map((type) => [type.code, td(type.label)]))} />
        <SelectChip placeholder={text('weather.filterSeverity')} value={filters.severity} onChange={update('severity')}
          options={options(SEVERITY_ORDER.map((severity) => [severity, text(`weather.severity.${severity}`)]))} />
        <SelectChip placeholder={text('weather.filterStatus')} value={filters.status} onChange={update('status')}
          options={options(['ACTIVE', 'RESOLVED', 'EXPIRED'].map((status) => [status, text(`weather.status.${status}`)]))} />
        <SelectChip placeholder={text('weather.filterAck')} value={filters.acknowledged} onChange={update('acknowledged')}
          options={options([['true', text('weather.ack.yes')], ['false', text('weather.ack.no')]])} />
      </View>
      <View style={[styles.row, { marginTop: 6 }]}>
        <View style={{ flex: 1 }}><LabeledInput label={text('weather.filterFrom')} placeholder="YYYY-MM-DD" maxLength={10} value={dates.date_from} onChangeText={updateDate('date_from')} /></View>
        <View style={{ flex: 1 }}><LabeledInput label={text('weather.filterTo')} placeholder="YYYY-MM-DD" maxLength={10} value={dates.date_to} onChangeText={updateDate('date_to')} /></View>
      </View>
      <ActionButton small tone="outline" label={text('weather.clearFilters')} onPress={() => { setFilters(EMPTY_FILTERS); setDates({ date_from: '', date_to: '' }); setPage(1) }} style={{ marginTop: 6, alignSelf: 'flex-end' }} />

      {state === 'error' ? <Text style={[styles.notice, { color: ink('#b91c1c') }]}>{text('weather.loadFailed')}</Text> : null}
      {state !== 'error' ? (data.alerts?.length ? (
        <View style={styles.results}>
          {data.alerts.map((alert) => (
            <View key={alert.id} style={styles.historyRow}>
              <View style={styles.wrapRow}>
                <SeverityChip severity={alert.severity} />
                <Text style={styles.siteName}>{alert.site === 'personal' ? text('weather.myLocation') : td(alert.project_title || '')}</Text>
                <Text style={styles.muted}>{td(alert.type_label)}</Text>
                {alert.source === 'OFFICIAL' ? <Text style={styles.tiny}>{text('weather.official')}</Text> : null}
              </View>
              <Text style={[styles.strongSmall, { marginTop: 3 }]} numberOfLines={1}>{td(alert.title)}</Text>
              <Text style={styles.body} numberOfLines={2}>{td(alert.message)}</Text>
              <Text style={styles.muted}>
                {[
                  alert.weather_condition ? `${text('weather.condition')}: ${text(`weather.condition.${alert.weather_condition}`)}` : null,
                  alert.expected_start ? (alert.expected_end
                    ? text('weather.expected', { start: siteDateTime(alert.expected_start), end: siteDateTime(alert.expected_end) })
                    : text('weather.expectedFrom', { start: siteDateTime(alert.expected_start) })) : null,
                  text('weather.generated', { time: formatDateTime(alert.created_at) }),
                  alert.resolved_at ? text('weather.resolvedOn', { time: formatDateTime(alert.resolved_at) }) : null,
                ].filter(Boolean).join(' · ')}
              </Text>
              <View style={[styles.wrapRow, { marginTop: 4 }]}>
                <Tag tone={alert.status === 'ACTIVE' ? 'brand' : 'slate'}>{text(`weather.status.${alert.status}`)}</Tag>
                <Tag tone={alert.acknowledged ? 'brand' : 'slate'}>{alert.acknowledged ? text('weather.ack.yes') : text('weather.ack.no')}</Tag>
              </View>
            </View>
          ))}
        </View>
      ) : <Text style={[styles.muted, { marginTop: 8 }]}>{state === 'ready' ? text('weather.historyEmpty') : text('weather.loading')}</Text>) : null}
      {pages > 1 ? (
        <View style={[styles.row, { marginTop: 8, justifyContent: 'flex-end' }]}>
          <ActionButton small tone="outline" label={text('weather.previous')} disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
          <Text style={styles.muted}>{text('weather.page', { page, pages })}</Text>
          <ActionButton small tone="outline" label={text('weather.next')} disabled={page >= pages} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}
    </Card>
  )
}

// ----------------------------------------------------------------- screen

export default function WeatherScreen({ navigation, route }) {
  const text = useWeatherText()
  const { td } = useLanguage()
  const userId = useSelector((state) => state.auth.user?.id)
  const [catalog, setCatalog] = useState({ projects: [], alert_types: [] })
  const [listState, setListState] = useState('loading')
  const [site, setSite] = useState(route?.params?.site ? String(route.params.site) : '')
  const [weather, setWeather] = useState({ current: null, hourly: null, daily: null, alerts: null })
  const [weatherState, setWeatherState] = useState('idle')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadProjects = useCallback(() => fetchWeatherProjects()
    .then((data) => {
      setCatalog(data)
      setListState('ready')
      setSite((current) => (current === MY_SITE || (data.projects || []).some((project) => String(project.id) === String(current))
        ? current : String(data.projects?.[0]?.id || MY_SITE)))
    })
    .catch((error) => { setListState(error?.response?.status === 503 ? 'unavailable' : 'error') }), [])

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    if (!site) return undefined
    let cancelled = false
    setWeatherState((state) => (state === 'ready' ? 'refreshing' : 'loading'))
    setLoadError('')
    // The four reads share one fetch on the server (a per-site cache and lock).
    Promise.allSettled([fetchCurrentWeather(site), fetchHourlyForecast(site), fetchDailyForecast(site), fetchWeatherAlerts(site)])
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
  }, [site, reloadKey])

  // Kept current while the screen stays open.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((value) => value + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const chooseSite = (value) => {
    if (!value || String(value) === String(site)) return
    setSite(String(value))
    setWeather({ current: null, hourly: null, daily: null, alerts: null })
    // The header pill follows the site chosen here.
    if (userId) saveWeatherChoice(userId, String(value))
  }

  const refresh = () => { setReloadKey((value) => value + 1); loadProjects() }

  const replaceAlert = (updated) => setWeather((value) => ({
    ...value,
    alerts: value.alerts ? { ...value.alerts, alerts: value.alerts.alerts.map((alert) => (alert.id === updated.id ? updated : alert)) } : value.alerts,
  }))

  const view = weather.current
  const activeAlerts = useMemo(() => sortAlerts(weather.alerts?.alerts || []), [weather.alerts])
  const project = (catalog.projects || []).find((row) => String(row.id) === String(site))
  const siteOptions = [
    ...(catalog.projects || []).map((row) => ({
      value: String(row.id),
      label: `${td(row.title)}${row.access && row.access !== 'member' ? ` · ${text(`weather.access.${row.access}`)}` : ''}${row.active_alerts ? ` (${row.active_alerts})` : ''}`,
    })),
    { value: MY_SITE, label: `${text('weather.myLocation')}${catalog.personal?.active_alerts ? ` (${catalog.personal.active_alerts})` : ''}` },
  ]

  return (
    <StackScreenShell
      title={text('weather.title')}
      subtitle={project ? td(project.title) : site === MY_SITE ? text('weather.myLocation') : text('weather.subtitle')}
      onBack={() => navigation.goBack()}
      refreshing={weatherState === 'refreshing'}
      onRefresh={refresh}
      right={(
        <Pressable onPress={refresh} accessibilityLabel={text('weather.refresh')} style={{ padding: 8 }}>
          <RefreshCw size={18} color="#ffffff" />
        </Pressable>
      )}
    >
      <Section style={{ gap: 12 }}>
        {listState === 'ready' ? (
          <View style={styles.siteRow}>
            <Text style={styles.label}>{text('weather.site')}</Text>
            {/* SelectChip lists an empty "any" row first; choosing it keeps the current site. */}
            <SelectChip placeholder={text('weather.project')} icon={MapPin} value={site} options={siteOptions} onChange={chooseSite} />
          </View>
        ) : null}

        {listState === 'loading' ? <Text style={styles.mutedBold}>{text('weather.loading')}</Text> : null}
        {listState === 'unavailable' || listState === 'error' ? (
          <Card style={{ alignItems: 'center' }}>
            <ConditionIcon condition="PARTLY_CLOUDY" size={30} />
            <Text style={[styles.strong, { marginTop: 6, textAlign: 'center' }]}>{text(listState === 'unavailable' ? 'weather.unavailable' : 'weather.loadFailed')}</Text>
            {listState === 'unavailable' ? <Text style={[styles.muted, { textAlign: 'center' }]}>{text('weather.loadFailed')}</Text> : null}
          </Card>
        ) : null}

        {listState === 'ready' && site ? (
          <>
            {weatherState === 'loading' && !view ? <Text style={styles.mutedBold}>{text('weather.loading')}</Text> : null}
            {weatherState === 'error' ? (
              <View style={[styles.banner, { backgroundColor: soft('#fef2f2', '#b91c1c'), borderColor: line('#fecaca', '#b91c1c') }]}>
                <Text style={[styles.bannerText, { color: ink('#b91c1c') }]}>{td(loadError)}</Text>
              </View>
            ) : null}
            {view ? (
              <>
                <StatusBanner status={view.status} />
                <LocationPanel site={site} view={view} onSaved={refresh} />
                <Card>
                  <CardTitle
                    icon={AlertTriangle}
                    iconColor="#ea580c"
                    title={text('weather.activeAlerts')}
                    right={activeAlerts.length ? <Tag>{String(activeAlerts.length)}</Tag> : null}
                  />
                  {activeAlerts.length ? (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {activeAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} onAcknowledged={replaceAlert} />)}
                    </View>
                  ) : <Text style={[styles.muted, { marginTop: 6 }]}>{text('weather.noAlerts')}</Text>}
                </Card>
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
      </Section>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { flexShrink: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrapRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  strong: { fontSize: 14, fontWeight: '800', color: c.text },
  strongSmall: { fontSize: 12.5, fontWeight: '800', color: c.text },
  body: { marginTop: 2, fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: c.textSecondary },
  muted: { marginTop: 2, fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  mutedBold: { fontSize: 13, fontWeight: '700', color: c.textMuted },
  tiny: { fontSize: 10.5, fontWeight: '600', color: c.textMuted },
  link: { fontSize: 12, fontWeight: '800', color: c.brandText },
  notice: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  siteRow: { gap: 6 },
  locationIcon: { height: 38, width: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoft },
  editor: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: 12 },
  results: { marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  alert: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, paddingLeft: 14, paddingRight: 10, paddingVertical: 10 },
  alertBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  now: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, backgroundColor: c.brandSoft, padding: 14 },
  temp: { fontFamily: 'Manrope_800ExtraBold', fontSize: 34, color: c.text },
  conditionText: { marginTop: 2, fontSize: 14, fontWeight: '800', color: c.brandTextStrong },
  conditionSmall: { fontSize: 11, fontWeight: '700', color: c.brandTextStrong },
  metrics: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8 },
  metricLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, color: c.textMuted },
  metricValue: { fontSize: 13.5, fontWeight: '800', color: c.text },
  metricSub: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  hour: { width: 78, alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 6, paddingVertical: 9 },
  rain: { fontSize: 11, fontWeight: '700', color: ink('#0369a1') },
  days: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: { width: '48%', flexGrow: 1, gap: 3, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, padding: 10 },
  historyRow: { borderBottomWidth: 1, borderBottomColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 9 },
  siteName: { fontSize: 11.5, fontWeight: '800', color: c.brandTextStrong },
}))