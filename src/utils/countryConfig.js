// Centralized per-country configuration for projects.
//
// The PROJECT country controls the project's local configuration: currency,
// languages, and the payment providers available for it. Customer residence
// never determines any of these. Payment providers are preparation only — no
// real integration (e.g. KNET) is wired up yet.

export const COUNTRY_CONFIG = {
  India: {
    label: 'India',
    currency: { code: 'INR', symbol: '₹', locale: 'en-IN' },
    languages: ['en', 'hi', 'te', 'ta', 'kn', 'ml'],
    defaultLanguage: 'en',
    rtl: false,
    paymentProviders: [
      { id: 'inr-bank', label: 'INR Bank Transfer / UPI', code: 'INR', available: false },
    ],
  },
  Kuwait: {
    label: 'Kuwait',
    currency: { code: 'KWD', symbol: 'KD', locale: 'en-KW' },
    languages: ['en', 'ar'],
    defaultLanguage: 'en',
    rtl: 'ar',
    paymentProviders: [
      { id: 'kwd-knet', label: 'KWD — KNET (not integrated)', code: 'KWD', available: false },
    ],
  },
}

// Possible project compliance/eligibility statuses (Phase 2 prep). The system
// never auto-declares a customer legally eligible; projects start at
// "Pending Verification".
export const PROJECT_COMPLIANCE_STATUSES = [
  'Pending Verification',
  'Eligible',
  'Additional Documents Required',
  'Review Required',
]

export function countryConfig(country) {
  return COUNTRY_CONFIG[country] || COUNTRY_CONFIG.India
}

export function countryCurrency(country) {
  return countryConfig(country).currency
}

export function countryPaymentProviders(country) {
  return countryConfig(country).paymentProviders
}

export function formatMoney(value, country) {
  const { symbol, locale } = countryCurrency(country)
  const numericValue = Number(value || 0)
  return `${symbol}${numericValue.toLocaleString(locale)}`
}

export function currencyCode(country) {
  return countryCurrency(country).code
}

// The signed-in account's country. The API names it country_of_residence (the
// web reads only that); `country` is kept as a fallback for older sessions.
export function userCountry(user) {
  return user?.country_of_residence || user?.country || 'India'
}

// A project's own country decides its currency, falling back to the owner's.
export function projectCountry(project, user) {
  return project?.project_country || userCountry(user)
}
