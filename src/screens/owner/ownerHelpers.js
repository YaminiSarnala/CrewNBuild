// Port of the web src/pages/owner/ownerHelpers.js — the owner-side display
// rules every owner screen shares. Nothing here talks to the API.
import { formatMoney } from '../../utils/countryConfig'
import { formatCalendarDate } from '../../utils/formatters'
import { translatorFrom } from '../../i18n/translate'

// Currency always comes from the PROJECT country, never the owner's residence.
export const money = (value, projectCountry) => formatMoney(value, projectCountry)

export const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value || 0))))

/**
 * A project's current amount: the confirmed contract value, else the awarded
 * quotation, else the stored budget. Null when none is set.
 */
export function currentProjectAmount(project) {
  const amount = project?.contract_amount ?? project?.awarded_amount ?? project?.budget
  return Number(amount) > 0 ? Number(amount) : null
}

export function isProjectCompleted(project) {
  return String(project?.status || '').toLowerCase() === 'completed' || clampPercent(project?.completion_percentage) >= 100
}

export function formatProjectDate(value, t) {
  return formatCalendarDate(value, translatorFrom(t)('cpp.notSet'))
}

const CONSTRUCTION_TYPE_KEYS = {
  CONTRACTOR: 'dash.common.builder',
  SELF_CONSTRUCTION: 'ui.owner.selfConstructionLabel',
}

const COUNTRY_KEYS = { India: 'country.india', Kuwait: 'country.kuwait' }

export function constructionTypeText(value, t) {
  const key = CONSTRUCTION_TYPE_KEYS[value]
  return key ? t(key) : value || ''
}

export function countryText(value, t) {
  const key = COUNTRY_KEYS[value]
  return key ? t(key) : value || ''
}

export function projectBuilderContext(project) {
  if ((project?.construction_type || '') === 'SELF_CONSTRUCTION') return { kind: 'self' }
  const builderName = project?.contractor?.name || project?.contractor_name || ''
  return builderName ? { kind: 'builder', name: builderName } : { kind: 'unassigned' }
}

const REQUEST_TYPE_KEYS = {
  CONTRACTOR_TO_OWNER: 'dash.common.builderRequest',
  OWNER_TO_CONTRACTOR: 'dash.common.builderRequest',
  OWNER_TO_SUPPLIER: 'dash.common.supplierRequest',
  SUPPLIER_TO_OWNER: 'dash.common.supplierRequest',
  OWNER_TO_ENGINEER: 'ui.owner.engineerRequest',
  PROPERTY_BUYER_TO_SELLER: 'ui.shared.propertyEnquiry',
}

export function requestTypeLabel(requestType, t) {
  const key = REQUEST_TYPE_KEYS[requestType]
  if (key) return t(key)
  if (!requestType) return t('dash.common.request')
  const spelled = String(requestType).replace(/_/g, ' ').toLowerCase()
  return spelled.charAt(0).toUpperCase() + spelled.slice(1)
}

export const projectTitle = (project, t) => project?.title || project?.project_title || t('dash.common.untitledProject')

const BUILDING_TYPE_KEYS = {
  RESIDENTIAL: 'dash.common.residential',
  COMMERCIAL: 'dash.common.commercial',
  VILLA: 'dash.common.villa',
  DUPLEX: 'dash.common.duplex',
}

export function buildingTypeText(value, t) {
  const key = BUILDING_TYPE_KEYS[String(value || '').toUpperCase()]
  return key ? t(key) : value || ''
}

// Both dates are required and the end may not come before the start. Returns
// the translation key of the problem, or '' when the schedule is fine.
export function projectScheduleProblem(startDate, endDate) {
  if (!startDate || !endDate) return 'dash.owner.projectForm.datesRequired'
  if (endDate < startDate) return 'dash.owner.projectForm.endBeforeStart'
  return ''
}

// The two request types that carry a House Owner <-> Builder quotation.
export const OWNER_BUILDER_REQUEST_TYPES = ['OWNER_TO_CONTRACTOR', 'CONTRACTOR_TO_OWNER']

// Which side of the request is the builder depends on who sent it.
export function builderIdOnRequest(request) {
  if (request?.request_type === 'OWNER_TO_CONTRACTOR') return request.receiver_id
  if (request?.request_type === 'CONTRACTOR_TO_OWNER') return request.sender_id
  return null
}

export function normalizeEstimateText(value) {
  return String(value || '').trim().toLowerCase()
}

export const defaultProjectImage = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80'

// The server's refusal as a sentence: a plain string, or the first validation
// message FastAPI returns as a list.
export function apiDetail(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  if (detail?.message) return detail.message
  return fallback
}
