import { apiClient } from './client'

// The six digit check that gates sign-up. The code itself is only ever sent by
// e-mail; the API never returns it, so the screen cannot shortcut the check.

export async function sendEmailCode(email) {
  const { data } = await apiClient.post('/auth/email/send-code', { email })
  return data
}

export async function verifyEmailCode(email, code) {
  const digits = Array.isArray(code) ? code.join('') : String(code || '')
  const { data } = await apiClient.post('/auth/email/verify-code', { email, code: digits })
  return data
}