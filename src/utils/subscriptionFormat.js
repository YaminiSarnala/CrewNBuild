// Pure helpers for the Builder subscription screens. Ports of the web's
//   subscription/subscriptionFormat.js
//   subscription/subscriptionOffers.js
//   subscription/planComparison.js
// with the web's translation keys (subscription.*): names and messages are
// translated via translatorFrom(t) / translate(). No React, no network: every decision is
// made from the server's answer (GET /subscriptions/me and /subscriptions/plans),
// and every paid endpoint is still checked on the server.

import { translate, translatorFrom } from '../i18n/LanguageContext'

export const IN_FORCE = ['ACTIVE', 'GRACE']
export const TRIAL = 'TRIAL'

// Translation keys, as the web helpers name them.
export const planNameKey = (code) => `subscription.plan.${code || 'FREE'}`
export const durationKey = (code) => `subscription.duration.${code}`
export const statusKey = (status) => `subscription.status.${status || 'NONE'}`
export const featureKey = (feature) => `subscription.feature.${feature}`
export const paymentStatusKey = (status) => `subscription.payment.${status}`

/** An object whose values are read through translate() at access time (active language). */
function translatedMap(keys) {
  const map = {}
  Object.entries(keys).forEach(([code, key]) => {
    Object.defineProperty(map, code, { get: () => translate(key), enumerable: true })
  })
  return map
}

const codesToKeys = (codes, toKey) => Object.fromEntries(codes.map((code) => [code, toKey(code)]))

export const PLAN_NAMES = translatedMap(codesToKeys(['FREE', 'PROFESSIONAL', 'BUSINESS'], planNameKey))
export const DURATION_NAMES = translatedMap(codesToKeys(['MONTHLY', 'SIX_MONTHS', 'ANNUAL'], durationKey))
export const STATUS_NAMES = translatedMap(codesToKeys(['ACTIVE', 'GRACE', 'EXPIRED', 'NONE', 'TRIAL'], statusKey))
export const PAYMENT_STATUS_NAMES = translatedMap(codesToKeys(['CREATED', 'FAILED', 'PAID', 'REFUNDED', 'DISPUTED'], paymentStatusKey))
export const FEATURE_NAMES = translatedMap(codesToKeys([
  'builder_calendar', 'builder_photos', 'builder_billing', 'bill_adjustments', 'portfolio_dashboard',
  'project_summary_export', 'advanced_cost_summary', 'consolidated_export', 'premium_badge',
], featureKey))

// What the Free card lists (web FREE_FEATURE_KEYS).
export const FREE_FEATURE_KEYS = [
  'subscription.feature.core',
  'subscription.feature.engineerNotifications',
  'subscription.feature.freeMonth',
]
/** The Free card's lines, translated (pass `t` from useLanguage). */
export const freeFeatureLines = (t) => FREE_FEATURE_KEYS.map((key) => translatorFrom(t)(key))
export const FREE_FEATURES = []
FREE_FEATURE_KEYS.forEach((key, index) => {
  Object.defineProperty(FREE_FEATURES, index, { get: () => translate(key), enumerable: true })
})

const offerKey = (id, field) => `subscription.offer.${id}.${field}`
function offer(id, fields) {
  const value = { id, ...fields }
  ;['name', 'access', 'audience'].forEach((field) => {
    Object.defineProperty(value, field, { get: () => translate(offerKey(id, field)), enumerable: true })
  })
  return value
}

// The three paid builder offers, mapped onto the existing API identifiers (web
// subscriptionOffers.js). Plus is the Premium (BUSINESS) tier billed monthly; the
// server prices each (plan_code, duration_code) and grants plan_code's features.
// name / access / audience read the active language (keys subscription.offer.<id>.*).
export const OFFERS = [
  offer('PRO_MONTHLY', { planCode: 'PROFESSIONAL', durationCode: 'MONTHLY', months: 1, badge: 'PRO' }),
  offer('PREMIUM_MONTHLY', { planCode: 'BUSINESS', durationCode: 'MONTHLY', months: 1, badge: 'PREMIUM' }),
  offer('PREMIUM_ANNUAL', { planCode: 'BUSINESS', durationCode: 'ANNUAL', months: 12, badge: 'PREMIUM' }),
]

export const offerById = (id) => OFFERS.find((item) => item.id === id) || null

// The mark each plan card shows: PRO on Pro, PLUS on Plus, PREMIUM on Premium,
// none on Free. Card display only; a subscriber's badge is still the server's.
export const CARD_BADGES = { PRO_MONTHLY: 'PRO', PREMIUM_MONTHLY: 'PLUS', PREMIUM_ANNUAL: 'PREMIUM' }

const FEATURE_ORDER = ['builder_calendar', 'builder_photos', 'builder_billing', 'bill_adjustments', 'portfolio_dashboard', 'project_summary_export', 'advanced_cost_summary', 'consolidated_export']

export function findOffer(planCode, durationCode) {
  return OFFERS.find((item) => item.planCode === planCode && item.durationCode === durationCode) || null
}

/** The display name's key: the offer's own name, or the tier's for a period bought otherwise. */
export function offerNameKey(planCode, durationCode) {
  const found = findOffer(planCode, durationCode)
  return found ? offerKey(found.id, 'name') : planNameKey(planCode)
}

/** The display name, translated (pass `t` from useLanguage). */
export function offerName(planCode, durationCode, t) {
  return translatorFrom(t)(offerNameKey(planCode, durationCode))
}

/** The key's translation, or `fallback` when no table has the key (an unknown server code). */
function named(t, key, fallback) {
  const text = translatorFrom(t)(key)
  return text === key ? fallback : text
}

export const durationName = (code, t) => (code ? named(t, durationKey(code), code) : '—')
export const statusName = (status, t) => named(t, statusKey(status), status)
export const paymentStatusName = (status, t) => (status ? named(t, paymentStatusKey(status), status) : '—')

export function offerPlan(catalogue, offer) {
  return (catalogue?.plans || []).find((plan) => plan.code === offer.planCode) || null
}

/** The server's price for this offer in paise, or null when it is not configured. */
export function offerPrice(catalogue, offer) {
  const value = offerPlan(catalogue, offer)?.prices?.[offer.durationCode]
  return value === undefined || value === null ? null : value
}

/** The translation keys an offer card lists: the features its tier ADDS over the tier below, then its mark. */
export function offerFeatureKeys(catalogue, offer) {
  const plan = offerPlan(catalogue, offer)
  if (!plan) return []
  const lower = (catalogue.plans || []).filter((other) => other.rank < plan.rank).sort((a, b) => b.rank - a.rank)[0]
  const inherited = new Set(lower?.features || [])
  const keys = FEATURE_ORDER
    .filter((feature) => (plan.features || []).includes(feature) && !inherited.has(feature))
    .map(featureKey)
  if ((plan.features || []).includes('premium_badge') && plan.badge) keys.push(`subscription.feature.badge.${plan.badge}`)
  return keys
}

/** The same lines, translated (pass `t` from useLanguage). */
export function offerFeatureLines(catalogue, offer, t) {
  const translateKey = translatorFrom(t)
  return offerFeatureKeys(catalogue, offer).map((key) => translateKey(key))
}

/** Premium Annual against twelve Premium (Plus) monthly payments, from the server's prices. */
export function annualSaving(catalogue) {
  const monthly = offerPrice(catalogue, offerById('PREMIUM_MONTHLY'))
  const annual = offerPrice(catalogue, offerById('PREMIUM_ANNUAL'))
  if (!monthly || !annual) return null
  const full = monthly * 12
  const saving = full - annual
  return saving > 0 ? { saving, full, percent: Math.round((saving * 100) / full) } : null
}

/**
 * The limit lines a plan shows, from the server's plan `limits` (null =
 * unlimited) and its features: locations, leads per location, live-camera
 * quality and the calendar rule. Each is { key, values } for `t` (web planLimitLines).
 */
export function planLimitLines(catalogue, planCode) {
  const plan = (catalogue?.plans || []).find((item) => item.code === planCode)
  if (!plan) return []
  const limits = plan.limits || {}
  const lines = []
  if ('max_locations' in limits) {
    lines.push(limits.max_locations === null
      ? { key: 'subscription.limit.locationsUnlimited', values: {} }
      : limits.max_locations === 1
        ? { key: 'subscription.limit.locationsOne', values: {} }
        : { key: 'subscription.limit.locations', values: { count: limits.max_locations } })
  }
  if ('max_leads_per_location' in limits) {
    lines.push(limits.max_leads_per_location === null
      ? { key: 'subscription.limit.leadsUnlimited', values: {} }
      : { key: 'subscription.limit.leads', values: { count: limits.max_leads_per_location } })
  }
  lines.push({ key: (plan.features || []).includes('hd_video') ? 'subscription.limit.hdVideo' : 'subscription.limit.sdOnly', values: {} })
  lines.push({ key: 'subscription.limit.noCalendarEditing', values: {} })
  return lines
}

/** What each plan card lists: locations, leads per location and camera quality. */
export function planCardLines(catalogue, planCode) {
  return planLimitLines(catalogue, planCode).filter((line) => line.key !== 'subscription.limit.noCalendarEditing')
}

/** A paid card's lines: exactly its plan's limit lines, like the Free card. */
export function offerCardLines(catalogue, offer) {
  return offerPlan(catalogue, offer) ? planCardLines(catalogue, offer.planCode) : []
}

/** The server's coupon figures for this offer, or null. */
export function quoteForOffer(quote, planCode, durationCode) {
  if (!quote) return null
  const quotes = Array.isArray(quote.quotes) ? quote.quotes : [quote]
  return quotes.find((item) => item.plan_code === planCode && item.duration_code === durationCode) || null
}

export const quoteMatchesOffer = (quote, planCode, durationCode) => Boolean(quoteForOffer(quote, planCode, durationCode))

/** Paise as rupees: ₹1,499 (or ₹1,499.50). */
export function formatRupees(paise) {
  if (paise === null || paise === undefined) return '—'
  const rupees = Number(paise) / 100
  if (!Number.isFinite(rupees)) return '—'
  const whole = Number.isInteger(rupees)
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** The badge shows only for a plan the server says is in force and premium. */
export function isPremium(status) {
  return Boolean(status && status.is_premium && IN_FORCE.includes(status.status))
}

/**
 * The signed-in builder's own mark (web activeBadge): the offer in force mapped
 * through CARD_BADGES, so Plus shows PLUS although the server's tier badge
 * (shared by Plus and Premium) is PREMIUM. Null when no plan is in force.
 */
export function activeBadge(status) {
  if (!isPremium(status) || !status.badge) return null
  const found = findOffer(status.plan_code, status.current_period?.duration_code)
  return found ? CARD_BADGES[found.id] : status.badge
}

export function hasFeature(status, feature) {
  return Boolean(status && (IN_FORCE.includes(status.status) || status.status === TRIAL) && (status.features || []).includes(feature))
}

/** 'FREE' unless a known paid plan is in force. */
export function currentTier(status) {
  if (status && IN_FORCE.includes(status.status) && ['FREE', 'PROFESSIONAL', 'BUSINESS'].includes(status.plan_code)) return status.plan_code
  return 'FREE'
}

export function freeAccessDaysLeft(status, now = Date.now()) {
  if (!status || status.status !== TRIAL || !status.free_access_until) return null
  const end = Date.parse(status.free_access_until)
  return Number.isFinite(end) && end > now ? Math.ceil((end - now) / (24 * 60 * 60 * 1000)) : null
}

export function freeAccessEnded(status) {
  return Boolean(status && status.status === 'NONE' && status.free_access_until)
}

/** { kind: 'trial', days } | { kind: 'freeExpired' } | { kind: 'planExpired' } | null */
export function dashboardBanner(status, now = Date.now()) {
  if (!status || status.region_supported === false) return null
  const days = freeAccessDaysLeft(status, now)
  if (days !== null) return { kind: 'trial', days }
  if (freeAccessEnded(status)) return { kind: 'freeExpired' }
  if (status.status === 'EXPIRED') return { kind: 'planExpired' }
  return null
}

/** 'renew' | 'choose' | 'blocked' | 'unavailable' | 'free' */
export function planAction(planCode, status, priceForDuration) {
  if (planCode === 'FREE') return 'free'
  if (status && status.region_supported === false) return 'unavailable'
  if (priceForDuration === null || priceForDuration === undefined) return 'unavailable'
  const inForce = status && IN_FORCE.includes(status.status)
  if (inForce && status.plan_code === planCode) return 'renew'
  if (inForce) return 'blocked'
  return 'choose'
}

/** A 403 from a paid endpoint, read into what the locked notice should say. */
export function lockedReason(error) {
  const detail = error?.response?.data?.detail
  if (!detail || typeof detail !== 'object') return null
  if (detail.code === 'SUBSCRIPTION_EXPIRED') return { kind: 'expired', requiredPlan: detail.required_plan || 'PROFESSIONAL' }
  if (detail.code === 'FREE_ACCESS_EXPIRED') return { kind: 'freeExpired', requiredPlan: detail.required_plan || 'PROFESSIONAL' }
  if (detail.code === 'PLAN_UPGRADE_REQUIRED') return { kind: 'upgrade', requiredPlan: detail.required_plan || 'BUSINESS' }
  if (detail.code === 'SUBSCRIPTION_REQUIRED') return { kind: 'required', requiredPlan: detail.required_plan || 'PROFESSIONAL' }
  return null
}

export function lockedMessage(reason, t) {
  const translateKey = translatorFrom(t)
  if (reason?.kind === 'expired') return translateKey('subscription.locked.expired')
  if (reason?.kind === 'freeExpired') return translateKey('subscription.locked.freeExpired')
  return translateKey('subscription.locked.required', { plan: translateKey(planNameKey(reason?.requiredPlan || 'PROFESSIONAL')) })
}

export function isEndingSoon(status, days = 7, now = Date.now()) {
  if (!status || status.status !== 'ACTIVE' || !status.coverage_end) return false
  if ((status.queued_periods || []).length) return false
  const end = Date.parse(status.coverage_end)
  return Number.isFinite(end) && end - now <= days * 24 * 60 * 60 * 1000 && end > now
}

/** Milliseconds until what is in force ends, for a timed refresh. */
export function msUntilChange(status, now = Date.now()) {
  if (!status) return null
  const edge = status.status === 'GRACE' ? status.grace_until : status.status === 'ACTIVE' ? status.coverage_end
    : status.status === TRIAL ? status.free_access_until : null
  const at = edge ? Date.parse(edge) : NaN
  return Number.isFinite(at) && at > now ? at - now : null
}

export function formatPlanDate(isoUtc) {
  if (!isoUtc) return '—'
  const value = new Date(isoUtc)
  if (Number.isNaN(value.getTime())) return '—'
  try {
    return value.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value.toISOString().slice(0, 10)
  }
}

export function subscriptionErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail && typeof detail === 'object' && detail.message) return detail.message
  if (typeof detail === 'string') return detail
  return fallback
}
