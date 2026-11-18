// Labour supply (backend app/shared/labor_supply). The backend is the
// authority for every rule -- the trade list, worker capacity, and who may
// request from whom; these calls only send what the supplier chose.
import { apiClient } from './client'

// The trades the backend accepts (never kept in the app).
export const fetchLabourTrades = async () => (await apiClient.get('/labor/trades')).data

// ---- Labour Supplier: services (one per trade)
export const fetchLabourServices = async () => (await apiClient.get('/labor/services')).data
export const createLabourService = async (payload) => (await apiClient.post('/labor/services', payload)).data
export const updateLabourService = async (id, payload) => (await apiClient.patch(`/labor/services/${id}`, payload)).data

// ---- Labour Supplier: requests from Site Engineers
export const fetchSupplierLabourRequests = async (status) =>
  (await apiClient.get('/labor/requests', { params: status ? { status } : {} })).data
// payload: { workers_allocated, decision_note }
export const acceptLabourRequest = async (id, payload) => (await apiClient.post(`/labor/requests/${id}/accept`, payload)).data
export const rejectLabourRequest = async (id, decisionNote) =>
  (await apiClient.post(`/labor/requests/${id}/reject`, { decision_note: decisionNote || null })).data

// ---- The Site Engineer's daily attendance on an assignment (read-only here)
export const fetchSupplierLabourDailyRecords = async (id) => (await apiClient.get(`/labor/requests/${id}/daily-records`)).data

/** The backend's own message, readable: a string detail, or the first 422 field error. */
export function labourErrorMessage(error, fallback) {
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
