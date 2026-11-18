// The Site Engineer's labour and equipment requests (web services/labor.js and
// services/equipment.js, engineer side). Reads of a project's requests, daily
// records and usage are in ./siteResources.js. The backend is the authority for
// availability, prices and who may request from whom.
import { apiClient } from './client'

export const LABOR_SUPPLIER_CATEGORY = 'Labor Supplier'
export const EQUIPMENT_SUPPLIER_CATEGORY = 'Equipment Supplier'

// ---- Labour ----
export const fetchLaborTrades = async () => (await apiClient.get('/labor/trades')).data
export const fetchProjectLaborSupplierServices = async (projectId, supplierId) =>
  (await apiClient.get(`/projects/${projectId}/labor-suppliers/${supplierId}/services`)).data
export const createLaborRequest = async (projectId, payload) => (await apiClient.post(`/projects/${projectId}/labor-requests`, payload)).data
export const cancelLaborRequest = async (id) => (await apiClient.post(`/labor-requests/${id}/cancel`)).data
export const completeLaborRequest = async (id) => (await apiClient.post(`/labor-requests/${id}/complete`)).data

// ---- Equipment ----
export const fetchProjectEquipmentItems = async (projectId, supplierId, range) => (
  await apiClient.get(`/projects/${projectId}/equipment-suppliers/${supplierId}/items`, {
    params: range?.start && range?.end ? { start_date: range.start, end_date: range.end } : {},
  })
).data
export const createEquipmentRequest = async (projectId, payload) => (await apiClient.post(`/projects/${projectId}/equipment-requests`, payload)).data
export const cancelEquipmentRequest = async (id) => (await apiClient.post(`/equipment-requests/${id}/cancel`)).data

// rate_unit -> the item field holding that rate (mirrors the backend's RATE_COLUMNS).
export const RATE_UNITS = [
  { unit: 'HOUR', field: 'hourly_rate', labelKey: 'equipment.unit.hour', perKey: 'equipment.per.hour' },
  { unit: 'DAY', field: 'daily_rate', labelKey: 'equipment.unit.day', perKey: 'equipment.per.day' },
  { unit: 'WEEK', field: 'weekly_rate', labelKey: 'equipment.unit.week', perKey: 'equipment.per.week' },
  { unit: 'MONTH', field: 'monthly_rate', labelKey: 'equipment.unit.month', perKey: 'equipment.per.month' },
]
const MODE_KEYS = { RENT: 'equipment.mode.rent', BUY: 'equipment.mode.buy', RENT_BUY: 'equipment.mode.rentBuy' }
export const modeLabel = (mode, t) => (MODE_KEYS[mode] ? t(MODE_KEYS[mode]) : mode)
export const conditionLabel = (condition, t) => t(condition === 'USED' ? 'equipment.condition.used' : 'equipment.condition.new')
export const kindLabel = (kind, t) => t(kind === 'RENT' ? 'equipment.kind.rent' : 'equipment.kind.buy')
export const allowsRent = (item) => item?.mode === 'RENT' || item?.mode === 'RENT_BUY'
export const allowsBuy = (item) => item?.mode === 'BUY' || item?.mode === 'RENT_BUY'
// Units this item can actually be rented by: only those with a rate.
export const rentableUnits = (item) => RATE_UNITS.filter((rate) => item?.[rate.field] != null)

// Today in the phone's own calendar, as the YYYY-MM-DD the API takes.
export function localIsoDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}