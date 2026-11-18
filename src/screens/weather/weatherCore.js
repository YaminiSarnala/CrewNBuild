// Pure weather helpers: port of the web pages/weather/weatherHelpers.js,
// components/weather/weatherTheme.js and weatherCache.js.
//
// Forecast and alert times arrive in the SITE's own offset
// ("2026-11-09T14:00:00+05:30") and are read as text, never through the
// phone's clock, so a Kuwait site shows Kuwait time to a viewer in India. A
// value the server did not send is shown as a dash: nothing is made up, and no
// severity or threshold is decided here.

// The account's own place ("My location"), beside project ids.
export const MY_SITE = 'me'

export function weatherSiteBase(site) {
  return String(site) === MY_SITE ? '/weather/me' : `/weather/projects/${site}`
}

// ---------------------------------------------------------------- severity

export const SEVERITY_ORDER = ['INFO', 'WATCH', 'WARNING', 'SEVERE']

// [background, border, text] per severity, light theme (soft/ink tint them for dark).
export const SEVERITY_COLORS = {
  INFO: { bg: '#f0f9ff', border: '#bae6fd', ink: '#0369a1', bar: '#0ea5e9' },
  WATCH: { bg: '#fffbeb', border: '#fde68a', ink: '#92400e', bar: '#f59e0b' },
  WARNING: { bg: '#fff7ed', border: '#fdba74', ink: '#9a3412', bar: '#ea580c' },
  SEVERE: { bg: '#fef2f2', border: '#fca5a5', ink: '#b91c1c', bar: '#dc2626' },
}
export const severityColors = (severity) => SEVERITY_COLORS[severity] || SEVERITY_COLORS.INFO

// Most serious first, then the soonest.
export function sortAlerts(alerts = []) {
  return [...alerts].sort((a, b) => (
    SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity)
    || String(a.expected_start || '').localeCompare(String(b.expected_start || ''))
  ))
}

// The most serious of a list of WARNING/SEVERE alerts, for the button's badge.
export function topSeverity(warnings) {
  const severities = (warnings || []).map((warning) => warning?.severity)
  return severities.includes('SEVERE') ? 'SEVERE' : severities.includes('WARNING') ? 'WARNING' : null
}

// ---------------------------------------------------------------- times

const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "14:00" from a site-local ISO string.
export function siteClock(iso) {
  const match = ISO_PARTS.exec(String(iso || ''))
  return match && match[4] ? `${match[4]}:${match[5]}` : '—'
}

// "09 Nov, 14:00" from a site-local ISO string.
export function siteDateTime(iso) {
  const match = ISO_PARTS.exec(String(iso || ''))
  if (!match) return '—'
  const day = `${match[3]} ${MONTHS[Number(match[2]) - 1]}`
  return match[4] ? `${day}, ${match[4]}:${match[5]}` : day
}

function calendarDate(value) {
  const match = ISO_PARTS.exec(String(value || ''))
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
}

export function siteWeekday(value, locale = 'en') {
  const date = calendarDate(value)
  if (!date) return '—'
  try {
    return date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
  } catch {
    return date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
  }
}

export function siteDayMonth(value) {
  const date = calendarDate(value)
  return date ? `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}` : '—'
}

// "14:30" in the viewer's clock, for "Updated 14:30".
export function updatedAt(iso) {
  if (!iso) return null
  const moment = new Date(iso)
  if (Number.isNaN(moment.getTime())) return null
  return `${String(moment.getHours()).padStart(2, '0')}:${String(moment.getMinutes()).padStart(2, '0')}`
}

// ---------------------------------------------------------------- measures

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

// "NE" for 45°: where the wind blows from.
export function compass(degrees) {
  return typeof degrees === 'number' && Number.isFinite(degrees) ? POINTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] : ''
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// A number with its unit, or a dash when the provider did not send it.
export function measure(value, unit = '', digits = 0) {
  if (!isNumber(value)) return '—'
  const text = digits ? value.toFixed(digits) : String(Math.round(value))
  return unit ? `${text}${unit.startsWith('°') || unit === '%' ? '' : ' '}${unit}` : text
}

export function rainAmount(value) {
  if (!isNumber(value)) return '—'
  return value >= 10 ? `${Math.round(value)} mm` : `${value.toFixed(1)} mm`
}

export const temperature = (value) => (isNumber(value) ? `${Math.round(value)}°C` : '–')
export const percent = (value) => (isNumber(value) ? `${Math.round(value)}%` : '–')
export const speed = (value) => (isNumber(value) ? `${Math.round(value)} km/h` : '–')
export const rainfall = (mm) => (isNumber(mm) ? `${Math.round(mm * 10) / 10} mm` : '–')

// "Hyderabad" from "Hyderabad, Telangana".
export const shortPlace = (place) => (place || '').split(',')[0].trim()

// "17.38500, 78.48670"
export function coordinates(location) {
  if (!location || !isNumber(location.latitude) || !isNumber(location.longitude)) return ''
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

// Typed coordinates as numbers, or null when either is not a valid coordinate.
export function parseCoordinates(latitude, longitude) {
  const latText = String(latitude ?? '').trim()
  const lonText = String(longitude ?? '').trim()
  if (!latText || !lonText) return null
  const lat = Number(latText)
  const lon = Number(lonText)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { latitude: lat, longitude: lon }
}

// History filters as query parameters; the My location choice is site=personal.
export function historyParams(filters = {}) {
  const params = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || value === null || value === undefined) continue
    if (key === 'project_id' && String(value) === MY_SITE) {
      params.site = 'personal'
      continue
    }
    params[key] = value
  }
  return params
}

// ---------------------------------------------------------------- look

// What each theme the server chose looks like: its label, icon and colours.
export const THEMES = {
  STORM: { label: 'Thunderstorm', icon: 'storm', bg: '#fef2f2', border: '#fecaca', ink: '#b91c1c' },
  HEAVY_RAIN: { label: 'Heavy rain', icon: 'heavy-rain', bg: '#f0f9ff', border: '#7dd3fc', ink: '#075985' },
  DUST: { label: 'Dust', icon: 'dust', bg: '#fffbeb', border: '#fcd34d', ink: '#92400e' },
  WIND: { label: 'Windy', icon: 'wind', bg: '#f0fdfa', border: '#99f6e4', ink: '#115e59' },
  RAIN: { label: 'Rainy', icon: 'rain', bg: '#f0f9ff', border: '#bae6fd', ink: '#075985' },
  LIGHT_RAIN: { label: 'Light rain', icon: 'drizzle', bg: '#f0f9ff', border: '#e0f2fe', ink: '#0369a1' },
  HOT: { label: 'Hot', icon: 'hot', bg: '#fff7ed', border: '#fed7aa', ink: '#c2410c' },
  SUNNY: { label: 'Sunny', icon: 'sun', bg: '#fffbeb', border: '#fde68a', ink: '#b45309' },
  CLEAR_NIGHT: { label: 'Clear', icon: 'moon', bg: '#eef2ff', border: '#e0e7ff', ink: '#4338ca' },
  PARTLY_CLOUDY: { label: 'Partly cloudy', icon: 'partly', bg: '#ffffff', border: '#e2e8f0', ink: '#134127' },
  CLOUDY: { label: 'Cloudy', icon: 'cloud', bg: '#f8fafc', border: '#e2e8f0', ink: '#334155' },
  FOG: { label: 'Fog or haze', icon: 'fog', bg: '#f8fafc', border: '#e2e8f0', ink: '#334155' },
  SNOW: { label: 'Snow', icon: 'snow', bg: '#ffffff', border: '#e2e8f0', ink: '#334155' },
  UNKNOWN: { label: 'Weather', icon: 'cloud', bg: '#ffffff', border: '#e2e8f0', ink: '#134127' },
}

export const themeOf = (presentation) => THEMES[presentation?.theme] || THEMES.UNKNOWN

// The icon name for one forecast condition (the provider's code, read server-side).
const CONDITION_ICONS = {
  CLEAR: 'sun', PARTLY_CLOUDY: 'partly', CLOUDY: 'cloud', FOG: 'fog', DRIZZLE: 'drizzle', RAIN: 'rain', HEAVY_RAIN: 'heavy-rain',
  SNOW: 'snow', THUNDERSTORM: 'storm', SEVERE_THUNDERSTORM: 'storm', DUST: 'dust', SQUALL: 'wind', TORNADO: 'tornado',
}
export function conditionIconName(condition, isDay = true) {
  if (condition === 'CLEAR' && isDay === false) return 'moon'
  return CONDITION_ICONS[condition] || 'cloud'
}

// ---------------------------------------------------------------- cache

// One copy of each answer for the whole app: the header button is mounted on
// every tab, and without this each would ask the server again. A fresh answer
// is reused for `maxAgeMs`; a request under way is shared. Neither a failure
// nor an "unavailable" answer is kept, so the next look asks again.
const entries = new Map()
const usable = (value) => value?.status?.available !== false

export function cachedWeather(key, load, { maxAgeMs = 5 * 60 * 1000, force = false, keep = usable } = {}) {
  const entry = entries.get(key)
  if (!force && entry?.promise) return entry.promise
  if (!force && entry && 'value' in entry && Date.now() - entry.at < maxAgeMs) return Promise.resolve(entry.value)
  const promise = Promise.resolve()
    .then(load)
    .then((value) => {
      if (keep(value)) entries.set(key, { at: Date.now(), value })
      else entries.delete(key)
      return value
    }, (error) => {
      entries.delete(key)
      throw error
    })
  entries.set(key, { ...entry, promise })
  return promise
}

// Forget every answer whose key starts with `prefix` (all of them without one).
export function forgetWeather(prefix = '') {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key)
}

// ---------------------------------------------------------------- feed rules

export const REFRESH_MS = 10 * 60 * 1000
export const RETRY_MS = [15 * 1000, 30 * 1000, 60 * 1000, 2 * 60 * 1000]
export const KEEP_GOOD_MS = 3 * 60 * 60 * 1000

export const nextLookIn = (failures) => (failures > 0 ? RETRY_MS[Math.min(failures, RETRY_MS.length) - 1] : REFRESH_MS)
export const isUsable = (answer) => Boolean(answer?.status?.available)
// Complete without weather: no place chosen yet, so asking again soon changes nothing.
export const needsPlace = (answer) => Boolean(answer?.location_required || answer?.status?.location_required)

// What to show after an attempt: the new answer when usable; else the last good
// one for this place while recent enough; else the new answer (its own message
// says why there is no weather) or nothing.
export function settle(previousGood, answer, now = Date.now()) {
  if (isUsable(answer)) return { shown: answer, good: answer, refreshFailed: false }
  if (needsPlace(answer)) return { shown: answer, good: null, refreshFailed: false }
  const goodAt = Date.parse(previousGood?.status?.last_updated_at || '')
  if (previousGood && Number.isFinite(goodAt) && now - goodAt <= KEEP_GOOD_MS) {
    return { shown: previousGood, good: previousGood, refreshFailed: true }
  }
  return { shown: answer || null, good: null, refreshFailed: Boolean(previousGood) || !answer }
}
