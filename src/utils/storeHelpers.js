// The Store pieces a Site Engineer uses — from the web
// pages/store-manager/storeHelpers.js (same names, same rules).

export const STOCK_STATE_KEYS = {
  IN_STOCK: 'store.stock.inStock',
  LOW_STOCK: 'store.stock.lowStock',
  OUT_OF_STOCK: 'store.stock.outOfStock',
}

export function matchesSearch(item, query) {
  const text = String(query || '').trim().toLowerCase()
  if (!text) return true
  // A store product's size (variant) and a supplier listing's (size) are searched too.
  return [item.name, item.brand, item.category, item.subcategory, item.variant, item.size].some((value) => String(value || '').toLowerCase().includes(text))
}

// Requests' three filters, each reading the stored status only.
export const REQUEST_FILTERS = [
  { id: 'ALL', label: 'store.filter.all', match: () => true },
  { id: 'PENDING', label: 'store.filter.pending', match: (request) => request.status === 'PENDING' },
  { id: 'APPROVED', label: 'store.filter.approved', match: (request) => ['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED'].includes(request.status) },
]

export function requestFilterCounts(requests) {
  return Object.fromEntries(REQUEST_FILTERS.map((filter) => [filter.id, requests.filter(filter.match).length]))
}

export function filterRequests(requests, filterId) {
  const filter = REQUEST_FILTERS.find((item) => item.id === filterId) || REQUEST_FILTERS[0]
  return requests.filter(filter.match)
}

// A store request's Request ID: its UUID (public_request_id).
export const requestRef = (request) => request?.public_request_id || ''

// A purchase's Purchase ID: the whole stored code as the server writes it.
export const purchaseRef = (purchase) => purchase?.purchase_id || purchase?.reference_code || ''

// Search by the complete Request ID, any letter case, with or without a leading #.
export function searchRequests(requests, query) {
  const text = String(query || '').trim().replace(/^#+/, '').trim().toLowerCase()
  if (!text) return requests
  return requests.filter((request) => requestRef(request).toLowerCase() === text)
}

export const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2))) }