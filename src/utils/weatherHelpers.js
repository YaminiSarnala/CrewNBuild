// Display helpers for the Weather screen (web pages/weather/weatherHelpers.js,
// with the severity colours as plain values for React Native).
//
// Forecast and alert times arrive from the server as ISO strings in the SITE's
// own offset ("2026-11-09T14:00:00+05:30"). They are read as text here, never
// through the browser's clock, so a Kuwait site shows Kuwait time to a viewer in
// India. A value the server did not send is shown as a dash: nothing is made up.
// Every alert threshold lives on the server; nothing here decides a severity.

export const SEVERITY_ORDER = ['INFO', 'WATCH', 'WARNING', 'SEVERE']

// Light colours of each severity (tint.js gives the dark ones): [background, text, border].
export const SEVERITY_TONES = {
  INFO: ['#f0f9ff', '#0369a1', '#bae6fd'],
  WATCH: ['#fffbeb', '#92400e', '#fde68a'],
  WARNING: ['#fff7ed', '#9a3412', '#fdba74'],
  SEVERE: ['#dc2626', '#ffffff', '#b91c1c'],
}

export function severityTone(severity) {
  return SEVERITY_TONES[severity] || SEVERITY_TONES.INFO
}

export function highestSeverity(alerts = []) {
  return alerts.reduce((best, alert) => (
    SEVERITY_ORDER.indexOf(alert?.severity) > SEVERITY_ORDER.indexOf(best) ? alert.severity : best
  ), null)
}

// Most serious first, then the soonest.
export function sortAlerts(alerts = []) {
  return [...alerts].sort((a, b) => (
    SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity)
    || String(a.expected_start || '').localeCompare(String(b.expected_start || ''))
  ))
}

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

// The calendar date of a "YYYY-MM-DD" (or ISO) string, without moving it into the browser's zone.
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

// Whether a forecast day is the site's today (its first day).
export function isFirstDay(days, index) {
  return index === 0 && Boolean(days?.[0])
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function compass(degrees) {
  if (typeof degrees !== 'number' || Number.isNaN(degrees)) return ''
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
}

// A number with its unit, or a dash when the provider did not send it.
export function measure(value, unit = '', digits = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  const text = digits ? value.toFixed(digits) : String(Math.round(value))
  return unit ? `${text}${unit.startsWith('°') || unit === '%' ? '' : ' '}${unit}` : text
}

export function rainAmount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value >= 10 ? `${Math.round(value)} mm` : `${value.toFixed(1)} mm`
}

// The query string of the history filters, without the empty ones.
// The account's own place ("My location"), as a site id beside project ids.
export const MY_SITE = 'me'

// The API path of a site's weather.
export function weatherSiteBase(site) {
  return String(site) === MY_SITE ? '/weather/me' : `/weather/projects/${site}`
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

// Active alerts across the projects and the own place of a /weather/projects
// answer: how many, and the most serious.
export function alertSummary(data) {
  const sites = [...(data?.projects || []), ...(data?.personal ? [data.personal] : [])]
  const count = sites.reduce((sum, site) => sum + Number(site.active_alerts || 0), 0)
  const severity = sites.reduce((best, site) => (
    SEVERITY_ORDER.indexOf(site.highest_severity) > SEVERITY_ORDER.indexOf(best) ? site.highest_severity : best
  ), null)
  return { count, severity }
}

// "17.38500, 78.48670"
export function coordinates(location) {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return ''
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

// Validates typed coordinates; answers numbers, or null when either is not a valid coordinate.
export function parseCoordinates(latitude, longitude) {
  const lat = Number(String(latitude ?? '').trim())
  const lon = Number(String(longitude ?? '').trim())
  if (String(latitude ?? '').trim() === '' || String(longitude ?? '').trim() === '') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { latitude: lat, longitude: lon }
}