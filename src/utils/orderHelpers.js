// Material orders as a buyer reads them (web components/shop/OrdersPanel.jsx):
// one checkout is several /material-requests rows sharing a request code.

// Pending covers everything still in flight; previous is the finished history.
export const TAB_STATUSES = {
  pending: ['PENDING', 'ACCEPTED'],
  previous: ['FULFILLED', 'REJECTED'],
}

export function groupOrders(rows) {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = row.request_code || `row-${row.id}`
    const order = grouped.get(key) || {
      code: key,
      supplierId: row.supplier_id,
      supplier: row.supplier_name,
      project: row.project_name,
      placedAt: row.created_at,
      items: [],
      total: 0,
    }
    order.items.push(row)
    order.total += Number(row.price || 0) * Number(row.quantity || 0)
    grouped.set(key, order)
  })
  return [...grouped.values()].sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt)))
}

export function orderStatus(items) {
  const states = items.map((item) => item.status)
  if (states.every((state) => state === 'REJECTED')) return 'REJECTED'
  if (states.some((state) => state === 'PENDING')) return 'PENDING'
  if (states.every((state) => state === 'FULFILLED')) return 'FULFILLED'
  return 'ACCEPTED'
}

// The order reference the supplier's notification already quotes ("#1A2B3C4D").
export const displayCode = (code) => `#${String(code || '').replace(/^row-/, '').slice(0, 8).toUpperCase()}`

// A listing's price after its discount.
export function discountedPrice(price, discountPercentage) {
  const base = Number(price || 0)
  const discount = Number(discountPercentage || 0)
  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(base * 100) / 100
  return Math.round((base - (base * discount) / 100) * 100) / 100
}

// The cheapest offer after discount.
export function bestOffer(offers = []) {
  return offers.reduce(
    (best, offer) => (!best || discountedPrice(offer.price, offer.discount_percentage) < discountedPrice(best.price, best.discount_percentage) ? offer : best),
    null,
  )
}