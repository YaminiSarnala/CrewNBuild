// Equipment supply (backend app/shared/equipment_supply). The backend decides
// availability, stock, prices and who may request from whom; these calls only
// send what the supplier chose.
import { apiClient } from './client'

// ---- Equipment Supplier: inventory
export const fetchEquipmentItems = async () => (await apiClient.get('/equipment/items')).data
export const createEquipmentItem = async (payload) => (await apiClient.post('/equipment/items', payload)).data
export const updateEquipmentItem = async (id, payload) => (await apiClient.patch(`/equipment/items/${id}`, payload)).data
// Soft delete: the item is deactivated, never removed.
export const deactivateEquipmentItem = async (id) => (await apiClient.delete(`/equipment/items/${id}`)).data

// ---- Equipment Supplier: requests from Site Engineers
export const fetchSupplierEquipmentRequests = async (status) =>
  (await apiClient.get('/equipment/requests', { params: status ? { status } : {} })).data
export const acceptEquipmentRequest = async (id) => (await apiClient.post(`/equipment/requests/${id}/accept`)).data
export const rejectEquipmentRequest = async (id, decisionNote) =>
  (await apiClient.post(`/equipment/requests/${id}/reject`, { decision_note: decisionNote || null })).data
// RENT: returned. BUY: delivered.
export const completeEquipmentRequest = async (id) => (await apiClient.post(`/equipment/requests/${id}/complete`)).data

// ---- Usage the Site Engineer logs against a rental
export const fetchEquipmentUsage = async (id) => (await apiClient.get(`/equipment-requests/${id}/usage`)).data

/** The backend's own message: a string detail, or the first 422 error made readable. */
export function equipmentErrorMessage(error, fallback) {
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
