// Read-only labour and equipment for a project's site day — the same calls the
// web Site Activity makes for a builder (web services/labor.js and
// services/equipment.js). A builder reads these; only the request's own site
// engineer records attendance or rental hours, so nothing here writes.
import { apiClient } from './client'

export const fetchProjectLaborRequests = async (projectId) =>
  (await apiClient.get(`/projects/${projectId}/labor-requests`)).data

export const fetchLaborDailyRecords = async (requestId) =>
  (await apiClient.get(`/labor-requests/${requestId}/daily-records`)).data

export const fetchProjectEquipmentRequests = async (projectId) =>
  (await apiClient.get(`/projects/${projectId}/equipment-requests`)).data

export const fetchEquipmentUsage = async (requestId) =>
  (await apiClient.get(`/equipment-requests/${requestId}/usage`)).data



// Writes by the request's own Site Engineer (web services/labor.js, equipment.js).
// The server checks the same rules: own request, ACCEPTED, inside its period,
// not in the future.
export const saveLaborDailyRecord = async (requestId, workDate, payload) =>
  (await apiClient.put(`/labor-requests/${requestId}/daily-records/${workDate}`, payload)).data

export const saveEquipmentUsage = async (requestId, usageDate, payload) =>
  (await apiClient.put(`/equipment-requests/${requestId}/usage/${usageDate}`, payload)).data

/** An API error as one line (web laborErrorMessage / equipmentErrorMessage). */
export function supplyErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const message = String(first?.msg || '').replace(/^Value error, /, '')
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : ''
    return field && field !== 'body' ? `${String(field).replace(/_/g, ' ')}: ${message}` : message
  }
  return fallback
}

// "hour" / "day" / "week" / "month" in the selected language (web ratePer).
const RATE_PER_KEYS = { HOUR: 'equipment.per.hour', DAY: 'equipment.per.day', WEEK: 'equipment.per.week', MONTH: 'equipment.per.month' }
export const ratePer = (unit, t) => (RATE_PER_KEYS[unit] ? t(RATE_PER_KEYS[unit]) : String(unit || '').toLowerCase())