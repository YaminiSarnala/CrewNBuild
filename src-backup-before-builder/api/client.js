// ---------------------------------------------------------------------------
// Port of the web app's src/services/apiClient.js.
//
// Differences from web, and why:
//   - localStorage -> expo-secure-store (encrypted keychain / keystore).
//     SecureStore is async, so readStoredAuth() is async and the token is ALSO
//     mirrored into a module-level cache so the axios interceptor stays sync.
//   - window.dispatchEvent -> a tiny subscriber list (no DOM on native).
//   - baseURL default -> EXPO_PUBLIC_API_BASE_URL, because "localhost" on a
//     phone means the phone itself, never your PC.
// The endpoint paths and the Bearer-token scheme are unchanged.
// ---------------------------------------------------------------------------
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

export const AUTH_STORAGE_KEY = 'gharbano_auth'

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://crewnbuild.com/api'
console.log('API BASE URL:', API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// --- token cache -----------------------------------------------------------
// Kept in memory so request interceptors remain synchronous.
let cachedAuth = null

export function getCachedAuth() {
  return cachedAuth
}

export async function readStoredAuth() {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY)
    cachedAuth = raw ? JSON.parse(raw) : null
    return cachedAuth
  } catch {
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY).catch(() => {})
    cachedAuth = null
    return null
  }
}

export async function writeStoredAuth(authPayload) {
  cachedAuth = authPayload
  try {
    await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(authPayload))
  } catch {
    /* keychain unavailable — in-memory cache still works for this session */
  }
}

export async function clearStoredAuth() {
  cachedAuth = null
  try {
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY)
  } catch {
    /* noop */
  }
}

// --- session-expiry broadcast (replaces window CustomEvent) ----------------
const expiryListeners = new Set()

export function onAuthExpired(listener) {
  expiryListeners.add(listener)
  return () => expiryListeners.delete(listener)
}

function broadcastAuthExpired() {
  expiryListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      /* a bad listener must not break the others */
    }
  })
}

// --- interceptors ----------------------------------------------------------
apiClient.interceptors.request.use((config) => {
  if (cachedAuth?.accessToken) {
    config.headers.Authorization = `Bearer ${cachedAuth.accessToken}`
  }
  // Let axios set the multipart boundary itself for FormData bodies.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearStoredAuth()
      broadcastAuthExpired()
    }
    return Promise.reject(error)
  },
)

// --- helpers ---------------------------------------------------------------

/**
 * Port of the web `imageUrl()`. Turns a server-relative path into an absolute
 * URL, appending the access token for /files/ routes exactly as the web does.
 */
export function imageUrl(path) {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('file:') || path.startsWith('data:')) return path
  const base = `${API_BASE_URL}${path}`
  if (path.startsWith('/files/') && cachedAuth?.accessToken) {
    const joiner = base.includes('?') ? '&' : '?'
    return `${base}${joiner}token=${encodeURIComponent(cachedAuth.accessToken)}`
  }
  return base
}

/** Port of the web `websocketUrl()` — used by the chat screen. */
export function websocketUrl(path) {
  return `${API_BASE_URL.replace(/^http/, 'ws')}${path}`
}

/** Normalises FastAPI error shapes (string detail OR pydantic error array). */
export function apiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail)) return detail[0]?.msg || fallbackMessage
  if (typeof detail === 'string') return detail
  if (error?.message === 'Network Error') {
    return `Cannot reach the server at ${API_BASE_URL}. Check that the backend is running and that EXPO_PUBLIC_API_BASE_URL points at your PC's LAN IP.`
  }
  return fallbackMessage
}
