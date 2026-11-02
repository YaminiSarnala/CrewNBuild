import { apiClient, sessionTokens } from './client'

// Port of the web services/phoneVerification.js: the WhatsApp check of an
// Indian mobile number. Only an Indian deployment turns it on; elsewhere the
// config says `enabled: false` (or the route does not exist yet) and the
// screens keep e-mail and password. The code is sent by WhatsApp and never
// returned by the API, except in the development preview (`dev_otp`).

const digitsOf = (code) => (Array.isArray(code) ? code.join('') : String(code || ''))

// { enabled, login, dial_code, digits }
export async function readPhoneVerificationConfig() {
  const { data } = await apiClient.get('/auth/phone/config')
  return data
}

// Sign-up: a code to a number that has no account yet.
export async function sendPhoneCode(phone) {
  const { data } = await apiClient.post('/auth/phone/send-code', { phone })
  return data
}

// A correct sign-up code answers { verification_token }, which /auth/signup
// must present with the same number.
export async function verifyPhoneCode(phone, code) {
  const { data } = await apiClient.post('/auth/phone/verify-code', { phone, code: digitsOf(code) })
  return data
}

// Sign-in: a code sent only to a number that belongs to exactly one account
// allowed to sign in (404 not registered, 403 not allowed, 409 ambiguous).
export async function sendPhoneLoginCode(phone) {
  const { data } = await apiClient.post('/auth/phone/login/send-code', { phone })
  return data
}

// A correct LOGIN code answers exactly like /auth/login.
export async function loginWithPhoneCode({ phone, code }) {
  const response = await apiClient.post('/auth/phone/login/verify-code', { phone, code: digitsOf(code) })
  return { ...response.data, ...sessionTokens(response) }
}
