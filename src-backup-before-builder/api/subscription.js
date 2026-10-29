// Port of web src/subscription/api.js — Builder subscriptions, portfolio and
// cost corrections. Same endpoints, same payloads. No amount is ever sent: the
// backend prices every plan and coupon itself, and every answer is the server's
// verified state.
//
// Mobile differences, and why:
//   - Razorpay Standard Checkout is a browser script; this app has no Razorpay
//     SDK, so a live-gateway payment is completed on the web Plan & billing page
//     (see BuilderSubscriptionScreen). The server's local "mock" gateway is
//     fully supported here.
//   - CSV downloads are fetched as text and handed to the native share sheet
//     instead of a browser download.
import { apiClient, API_BASE_URL } from './client'

export async function fetchSubscriptionPlans() {
  return (await apiClient.get('/subscriptions/plans')).data
}

export async function fetchMySubscription() {
  return (await apiClient.get('/subscriptions/me')).data
}

/** Body of POST /subscriptions/orders: identifiers and an optional coupon CODE — never an amount. */
export function orderRequestBody(planCode, durationCode, couponCode = null) {
  const body = { plan_code: planCode, duration_code: durationCode }
  const code = String(couponCode || '').trim()
  if (code) body.coupon_code = code
  return body
}

export async function createSubscriptionOrder(planCode, durationCode, couponCode = null) {
  return (await apiClient.post('/subscriptions/orders', orderRequestBody(planCode, durationCode, couponCode))).data
}

// The server's price with a coupon (original, discount, payable). Reserves nothing.
export async function validateSubscriptionCoupon(code, planCode = null, durationCode = null) {
  const body = planCode ? { code, plan_code: planCode, duration_code: durationCode } : { code }
  return (await apiClient.post('/subscriptions/coupons/validate', body)).data
}

export async function verifySubscriptionPayment({ subscriptionPaymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  return (await apiClient.post('/subscriptions/verify', {
    subscription_payment_id: subscriptionPaymentId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  })).data
}

export async function reportSubscriptionFailure({ subscriptionPaymentId, razorpayPaymentId, code, description }) {
  return (await apiClient.post('/subscriptions/failures', {
    subscription_payment_id: subscriptionPaymentId,
    razorpay_payment_id: razorpayPaymentId || null,
    code: code || null,
    description: description ? String(description).slice(0, 255) : null,
  })).data
}

// Only answers while the backend has no Razorpay TEST keys (local mock).
export async function simulateSubscriptionCheckout(subscriptionPaymentId, outcome) {
  return (await apiClient.post('/subscriptions/mock/checkout', { subscription_payment_id: subscriptionPaymentId, outcome })).data
}

export async function fetchBuilderPortfolio() {
  return (await apiClient.get('/builder/portfolio')).data
}

export async function fetchCostAdjustments(registerId) {
  return (await apiClient.get(`/cost-tool/registers/${registerId}/builder-adjustments`)).data
}

export async function saveCostAdjustment(registerId, { fieldName, adjustedValue, reason }) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/builder-adjustments`, {
    field_name: fieldName,
    adjusted_value: Number(adjustedValue),
    reason,
  })).data
}

/** The CSV text of a report (the server enforces the plan; a refusal throws). */
async function fetchCsvText(path) {
  const response = await apiClient.get(path, { responseType: 'text', transformResponse: (data) => data })
  return typeof response.data === 'string' ? response.data : String(response.data ?? '')
}

export const fetchProjectSummaryCsv = (projectId) => fetchCsvText(`/projects/${projectId}/summary.csv`)
export const fetchPortfolioExportCsv = () => fetchCsvText('/builder/portfolio/export.csv')

/**
 * A refused CSV request arrives as text; read its JSON so the caller can tell an
 * expired or missing plan (detail.code) from any other failure.
 */
export function normalizeCsvError(error) {
  const data = error?.response?.data
  if (typeof data === 'string') {
    try { error.response.data = JSON.parse(data) } catch { /* not JSON: keep as is */ }
  }
  return error
}

/**
 * The web app's address, for handing a live Razorpay payment to the web Plan &
 * billing page. EXPO_PUBLIC_WEB_BASE_URL wins; otherwise the API base without
 * its trailing /api (https://crewnbuild.com/api -> https://crewnbuild.com).
 */
export const WEB_BASE_URL = (
  process.env.EXPO_PUBLIC_WEB_BASE_URL || String(API_BASE_URL || '').replace(/\/api\/?$/, '')
).replace(/\/+$/, '')

export const WEB_SUBSCRIPTION_URL = `${WEB_BASE_URL}/contractor/subscription`