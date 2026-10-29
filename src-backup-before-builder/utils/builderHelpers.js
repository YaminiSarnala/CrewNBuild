// Pure helpers for the Builder (CONTRACTOR) screens. Ports of the web's
//   pages/contractor/contractorHelpers.js
//   pages/contractor/supplierAssignment.js
//   utils/projectProgress.js
//   utils/requestTimes.js
// No React and no network. Every rule matches the web so the two apps show the
// same thing for the same server payload.
// Text-producing helpers take an optional `t` (as the web contractorHelpers.js
// does) and fall back to the active language; strings come from the web keys.
import { formatMoney } from './countryConfig'
import { translatorFrom } from '../i18n/LanguageContext'

// ---------------------------------------------------------------------------
// Money, dates, labels
// ---------------------------------------------------------------------------

/** Money in the project's currency; '—' for nothing. */
export function money(value, country) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount === 0) return '—'
  return formatMoney(amount, country)
}

/** Today as a calendar date ("YYYY-MM-DD") on this device. */
export function todayCalendarDate(now = new Date()) {
  const pad = (number) => String(number).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const isCalendarDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))

/** "12 Oct 2026" for a calendar date or ISO timestamp; `fallback` (default "Not set", translated) otherwise. */
export function formatDisplayDate(value, fallback, t) {
  if (fallback === undefined) fallback = translatorFrom(t)('dash.common.notSet')
  if (!value) return fallback
  const text = String(value)
  let date
  if (isCalendarDate(text.slice(0, 10)) && text.length <= 10) {
    const [y, m, d] = text.split('-').map(Number)
    date = new Date(y, m - 1, d)
  } else {
    date = new Date(text)
  }
  if (Number.isNaN(date.getTime())) return text.split(',')[0] || fallback
  try {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return todayCalendarDate(date)
  }
}

// Display label for a stored building type code; the code itself is never changed.
const BUILDING_TYPE_KEYS = {
  RESIDENTIAL: 'dash.common.residential',
  COMMERCIAL: 'dash.common.commercial',
  VILLA: 'dash.common.villa',
  DUPLEX: 'dash.common.duplex',
}
export function buildingTypeText(value, t) {
  const key = BUILDING_TYPE_KEYS[String(value || '').toUpperCase()]
  return key ? translatorFrom(t)(key) : (value || '')
}

// Display label for a stored project status code; unknown codes are shown as stored.
const PROJECT_STATUS_KEYS = {
  pending: 'ui.status.pending',
  accepted: 'ui.status.accepted',
  rejected: 'ui.status.rejected',
  completed: 'ui.status.completed',
  active: 'ui.status.active',
  in_progress: 'ui.status.inProgress',
  closed: 'ui.status.closed',
  open: 'ui.status.open',
}
export function projectStatusText(status, t) {
  const key = PROJECT_STATUS_KEYS[String(status || '').toLowerCase()]
  return key ? translatorFrom(t)(key) : (status || '')
}

// Display label for a request board category (categorizeRequest's ids).
const REQUEST_STATUS_KEYS = {
  pending: 'ui.status.pending',
  accepted: 'ui.status.accepted',
  rejected: 'ui.status.rejected',
  withdrawn: 'ui.shared.statusWithdrawn',
  sent: 'dash.contractor.status.proposalSent',
}
export function requestStatusText(status, t) {
  const key = REQUEST_STATUS_KEYS[String(status || '').toLowerCase()]
  return key ? translatorFrom(t)(key) : (status || '')
}

/**
 * An API error as one line of text. FastAPI's 422 `detail` is a list of
 * objects; the subscription endpoints answer `{detail: {code, message}}`.
 */
export function apiErrorText(error, fallback, t) {
  const translateText = translatorFrom(t)
  if (fallback === undefined) fallback = translateText('mobile.projects.tryAgain')
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const text = detail.map((item) => (typeof item === 'string' ? item : item?.msg)).filter(Boolean).join(' ')
    if (text) return text
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message
  if (error?.message === 'Network Error') return translateText('mobile.projects.networkError')
  return fallback
}

/** A response that may be a bare list or a list under a known key. */
export function asList(data, ...keys) {
  if (Array.isArray(data)) return data
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return []
}

// ---------------------------------------------------------------------------
// Project progress (web utils/projectProgress.js)
// ---------------------------------------------------------------------------

export function completionPercent(project) {
  const value = project?.completion_percentage
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null
}

export const formatPercent = (value) => `${Number.isInteger(value) ? value : Number(value).toFixed(1)}%`

export function completionText(project, t) {
  const percent = completionPercent(project)
  return percent === null ? translatorFrom(t)('progress.notAvailable') : formatPercent(percent)
}

export function averageCompletion(projects) {
  const known = (projects || []).map(completionPercent).filter((value) => value !== null)
  if (!known.length) return null
  return Math.round((known.reduce((sum, value) => sum + value, 0) / known.length) * 10) / 10
}

export function scheduleWidth(project) {
  if (project?.schedule_status === 'end_date_passed') return 100
  if (project?.schedule_status !== 'in_progress') return 0
  const number = Number(project.schedule_progress_percentage)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0
}

export function averageSchedule(projects) {
  const known = (projects || [])
    .filter((project) => ['in_progress', 'end_date_passed'].includes(project?.schedule_status))
    .map(scheduleWidth)
  if (!known.length) return null
  return Math.round((known.reduce((sum, value) => sum + value, 0) / known.length) * 10) / 10
}

export function scheduleText(project, t) {
  const translateText = translatorFrom(t)
  switch (project?.schedule_status) {
    case 'in_progress':
      return translateText('progress.scheduleDays', { elapsed: project.schedule_elapsed_days, total: project.schedule_total_days, percent: formatPercent(project.schedule_progress_percentage) })
    case 'end_date_passed':
      return translateText('progress.scheduleEnded', { total: project.schedule_total_days })
    case 'not_started':
      return translateText('progress.scheduleNotStarted')
    case 'dates_invalid':
      return translateText('progress.scheduleInvalid')
    case 'dates_missing':
      return translateText('progress.scheduleNoDates')
    default:
      return ''
  }
}

/** The card's progress line: completion once measurable, else elapsed schedule once work started. */
export function progressLabel(project, t) {
  if (completionPercent(project) !== null) return completionText(project, t)
  if (project?.work_started !== true) return translatorFrom(t)('progress.scheduleNotStarted')
  return ['in_progress', 'end_date_passed'].includes(project?.schedule_status) ? formatPercent(scheduleWidth(project)) : ''
}

// ---------------------------------------------------------------------------
// Project categories (web contractorHelpers.groupProjectsByCategory)
// ---------------------------------------------------------------------------

// `labelKey`/`emptyKey` as on the web (contractorConstants.projectCategoryTabs);
// `label`/`empty` stay readable for existing callers and translate on read.
const categoryTab = (id, labelKey, emptyKey) => ({
  id,
  labelKey,
  emptyKey,
  get label() { return translatorFrom()(labelKey) },
  get empty() { return translatorFrom()(emptyKey) },
})
export const PROJECT_CATEGORY_TABS = [
  categoryTab('current', 'dash.contractor.currentProjects', 'dash.contractor.noAssignedProjects'),
  categoryTab('previous', 'dash.contractor.previousProjects', 'dash.contractor.noPreviousProjects'),
  categoryTab('upcoming', 'dash.contractor.upcomingProjects', 'dash.contractor.noUpcomingProjects'),
]

export function projectIsCompleted(project) {
  return String(project?.status || '').toLowerCase() === 'completed'
    || Number(project?.completion_percentage || 0) >= 100
}

export function projectHasAssignedEngineer(project) {
  const assignedEngineer = project?.assigned_engineer
  return Boolean(assignedEngineer && (assignedEngineer.user_id || assignedEngineer.id))
}

/** Exactly one of 'current' | 'previous' | 'upcoming'. */
export function projectCategory(project, now = Date.now()) {
  if (projectIsCompleted(project)) return 'previous'
  if (project?.end_date && String(project.end_date).slice(0, 10) < todayCalendarDate(new Date(now))) return 'previous'
  return projectHasAssignedEngineer(project) ? 'current' : 'upcoming'
}

export function groupProjectsByCategory(projectList, now = Date.now()) {
  const groups = { current: [], previous: [], upcoming: [] }
  ;(Array.isArray(projectList) ? projectList : []).forEach((project) => {
    groups[projectCategory(project, now)].push(project)
  })
  return groups
}

/** The dashboard's building categories (web ContractorAnalyticsSection). */
const BUILDING_CATEGORIES = [
  { id: 'renovation', labelKey: 'site.projects.cat.renovation', match: /RENOVAT|REPAIR|REMODEL/ },
  { id: 'interior', labelKey: 'opt.category.interior', match: /INTERIOR/ },
  { id: 'commercial', labelKey: 'dash.common.commercial', match: /COMMERC|OFFICE|SHOP|RETAIL|MALL|WAREHOUSE|INDUSTR/ },
  { id: 'residential', labelKey: 'dash.common.residential', match: /RESIDEN|VILLA|DUPLEX|HOUSE|APARTMENT|FLAT|BUNGALOW|HOME/ },
]

export function buildingCategoryCounts(projects = [], t) {
  const translateText = translatorFrom(t)
  const counts = [...BUILDING_CATEGORIES, { id: 'others', labelKey: 'dash.common.other' }]
    .map((row) => ({ ...row, label: translateText(row.labelKey), count: 0 }))
  projects.forEach((project) => {
    const text = `${project.construction_type || ''} ${project.building_type || ''}`.toUpperCase()
    const found = BUILDING_CATEGORIES.find((item) => item.match.test(text))
    const row = counts.find((item) => item.id === (found ? found.id : 'others'))
    row.count += 1
  })
  // Display order as on the web: Residential, Commercial, Renovation, Interior, Others.
  const order = ['residential', 'commercial', 'renovation', 'interior', 'others']
  return order.map((id) => counts.find((row) => row.id === id))
}

// ---------------------------------------------------------------------------
// Requests (web contractorHelpers + contractorRequestViews)
// ---------------------------------------------------------------------------

export const OWNER_REQUEST_TYPES = ['CONTRACTOR_TO_OWNER', 'OWNER_TO_CONTRACTOR']
export const SUPPLIER_REQUEST_TYPES = ['CONTRACTOR_TO_SUPPLIER', 'SUPPLIER_TO_CONTRACTOR']

const REQUEST_STATUS_PRIORITY = { accepted: 0, pending: 1, rejected: 2, withdrawn: 3 }
const sameId = (left, right) => left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right)

export function requestTypesForClient(client) {
  return client?.client_type === 'SUPPLIER' ? SUPPLIER_REQUEST_TYPES : OWNER_REQUEST_TYPES
}

/** The stored request between this builder and a lead, matched by id (never by title). */
export function findClientRequest(requestList, client, requestTypes) {
  const types = requestTypes?.length ? requestTypes : requestTypesForClient(client)
  const counterpartyId = client?.owner_id ?? client?.user_id
  const matches = (Array.isArray(requestList) ? requestList : []).filter((request) => {
    if (!types.includes(request.request_type)) return false
    if (!sameId(request.sender_id, counterpartyId) && !sameId(request.receiver_id, counterpartyId)) return false
    if (client?.project_id) return sameId(request.project_id, client.project_id)
    return true
  })
  if (!matches.length) return undefined
  return [...matches].sort(
    (left, right) => (REQUEST_STATUS_PRIORITY[left.status] ?? 3) - (REQUEST_STATUS_PRIORITY[right.status] ?? 3),
  )[0]
}

/** 'accepted' | 'rejected' | 'withdrawn' | 'sent' | 'pending' | 'none' */
export function clientRequestState(requestList, client, requestTypes) {
  const matchedRequest = findClientRequest(requestList, client, requestTypes)
  if (matchedRequest?.status === 'accepted') return 'accepted'
  if (matchedRequest?.status === 'rejected') return 'rejected'
  if (matchedRequest?.status === 'withdrawn') return 'withdrawn'
  if (matchedRequest?.status === 'pending') return matchedRequest.is_sender ? 'sent' : 'pending'
  return 'none'
}

/** How the request board files a request: pending | accepted | sent | rejected | withdrawn. */
export function categorizeRequest(request) {
  const status = String(request?.status || 'pending').toLowerCase()
  if (status === 'accepted') return 'accepted'
  if (status === 'rejected') return 'rejected'
  if (status === 'withdrawn') return 'withdrawn'
  if (request?.is_sender && status === 'pending') return 'sent'
  return 'pending'
}

export function timestampMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value < 1e11 ? value * 1000 : value
  }
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

/** The `count` newest requests by created_at (instant, not text). */
export function newestRequests(requests, count = 3) {
  return (Array.isArray(requests) ? requests : [])
    .map((request, index) => ({ request, index, at: timestampMs(request?.created_at_iso || request?.created_at) }))
    .sort((a, b) => {
      if (a.at === null && b.at === null) return a.index - b.index
      if (a.at === null) return 1
      if (b.at === null) return -1
      return b.at - a.at || a.index - b.index
    })
    .slice(0, count)
    .map((entry) => entry.request)
}

/** "5 minutes ago" / "3 hours ago" / "2 days ago" (web time.* keys), or the date. */
export function relativeAge(value, now = Date.now(), t) {
  const at = timestampMs(value)
  if (at === null) return ''
  const translateText = translatorFrom(t)
  const diff = Math.max(0, now - at)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return translateText('time.justNow')
  if (minutes < 60) return translateText(minutes === 1 ? 'time.minuteAgo' : 'time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return translateText(hours === 1 ? 'time.hourAgo' : 'time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return translateText(days === 1 ? 'time.dayAgo' : 'time.daysAgo', { count: days })
  return formatDisplayDate(new Date(at).toISOString(), '')
}

// ---------------------------------------------------------------------------
// Supplier assignment (web supplierAssignment.js)
// ---------------------------------------------------------------------------

export function takenProjectIdsFor({ supplier, projectList = [], contractorSuppliers = [] }) {
  const supplierId = String(supplier?.user_id || supplier?.id || '')
  const current = contractorSuppliers.find((item) => String(item.user_id || item.id) === supplierId) || supplier
  return new Set([
    ...(current?.assigned_projects || []).map((assignment) => String(assignment.project_id)),
    ...projectList
      .filter((project) => (project.assigned_suppliers || []).some((item) => String(item.user_id) === supplierId))
      .map((project) => String(project.id)),
  ])
}

export const SITE_ENGINEER_CATEGORY = 'Site Engineer'

export const SUPPLIER_CATEGORY_ORDER = ['Material Supplier', 'Labor Supplier', 'Equipment Supplier']

// ---------------------------------------------------------------------------
// Builder profile (web contractorHelpers)
// ---------------------------------------------------------------------------

export const PORTFOLIO_MAX_PROJECTS = 4
export const PORTFOLIO_MAX_IMAGES = 6

export function normalizePortfolioProjects(projects) {
  let list = projects
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { list = [] }
  }
  return (Array.isArray(list) ? list : [])
    .map((project) => ({
      title: String(project?.title || '').trim(),
      location: String(project?.location || '').trim(),
      description: String(project?.description || '').trim(),
      images: (Array.isArray(project?.images) ? project.images : [])
        .map((image) => String(image || '').trim())
        .filter((image, index, all) => /^\/files\/\d+$/.test(image) && all.indexOf(image) === index)
        .slice(0, PORTFOLIO_MAX_IMAGES),
    }))
    .filter((project) => project.title || project.location || project.description)
    .slice(0, PORTFOLIO_MAX_PROJECTS)
}

export function profileListString(value) {
  if (Array.isArray(value)) return value.join(', ')
  return String(value || '')
}

export const splitEditableList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)