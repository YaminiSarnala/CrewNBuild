import { apiClient } from './client'

// Password recovery. The API answers the same way whether or not an address has
// an account, so nothing here reveals who is registered.

export async function sendResetCode(email) {
  const { data } = await apiClient.post('/auth/password/forgot', { email })
  return data
}

export async function verifyResetCode(email, code) {
  const digits = Array.isArray(code) ? code.join('') : String(code || '')
  const { data } = await apiClient.post('/auth/password/verify-code', { email, code: digits })
  return data
}

export async function resetPassword(email, password) {
  const { data } = await apiClient.post('/auth/password/reset', { email, password })
  return data
}