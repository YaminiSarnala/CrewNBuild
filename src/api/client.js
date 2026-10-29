// ---------------------------------------------------------------------------
// Port of the web app's src/services/apiClient.js.
//
// Differences from web, and why:
//   - localStorage -> expo-secure-store (encrypted keychain / keystore).
//     SecureStore is async, so readStoredAuth() is async and the token is ALSO
//     mirrored into a module-level cache so the axios interceptor stays sync.
//   - window.dispatchEvent -> a tiny subscriber list (no DOM on native).
//   - The app sends Bearer tokens, never cookies. The server hands the tokens
//     out as Set-Cookie headers; they are read from there (sessionTokens).
// ---------------------------------------------------------------------------
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

export const AUTH_STORAGE_KEY = 'gharbano_auth'

// The FastAPI backend is served under /api. Everything outside /api is the web
// app itself, which answers any path with its HTML page and a 200 — so a
// missing /api does not fail, it silently returns a web page instead of data.
export const API_BASE_URL = 'https://crewnbuild.com/api'

// The app authenticates with Bearer tokens only. React Native's XHR sends and
// stores cookies by default, and the server sets session cookies on login; once
// those cookies come back without an Origin header the server's CSRF guard
// rejects the request with 403 ORIGIN_REQUIRED. So never send cookies.
const NO_COOKIES = { withCredentials: false }

// The server now hands out tokens as cookies (login/signup/refresh answer
// `{user, csrf_token}` plus Set-Cookie) but still accepts them as Bearer
// tokens. Read them from Set-Cookie, falling back to the older JSON body.
const ACCESS_COOKIE = '__Secure-octabuild-access'
const REFRESH_COOKIE = '__Secure-octabuild-refresh'
const API_ORIGIN = 'https://crewnbuild.com'

function cookieValue(setCookie, name) {
  // Android joins repeated Set-Cookie headers with ", ", so search the whole text.
  const text = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie || '')
  const match = text.match(new RegExp(`${name}=([^;,\\s]*)`))
  return match && match[1] && match[1] !== '""' ? decodeURIComponent(match[1]) : null
}

export function sessionTokens(response) {
  const data = response?.data || {}
  const setCookie = response?.headers?.['set-cookie']
  return {
    access_token: data.access_token || cookieValue(setCookie, ACCESS_COOKIE),
    refresh_token: data.refresh_token || cookieValue(setCookie, REFRESH_COOKIE),
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  ...NO_COOKIES,
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

// --- session broadcasts (replace window CustomEvents) ----------------------
const expiryListeners = new Set()
const refreshListeners = new Set()

export function onAuthExpired(listener) {
  expiryListeners.add(listener)
  return () => expiryListeners.delete(listener)
}

// Redux keeps its own copy of the tokens; this tells it about a renewed pair.
export function onAuthRefreshed(listener) {
  refreshListeners.add(listener)
  return () => refreshListeners.delete(listener)
}

function broadcast(listeners, payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload)
    } catch {
      /* a bad listener must not break the others */
    }
  })
}

async function endSession() {
  await clearStoredAuth()
  broadcast(expiryListeners)
}

// Requests that must never trigger a refresh of their own.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/signup', '/auth/logout']

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

// One refresh at a time: several screens hitting an expired token together
// must make a single /auth/refresh call, not one each.
let refreshInFlight = null

export function refreshSession() {
  if (refreshInFlight) return refreshInFlight
  const stored = cachedAuth
  if (!stored?.refreshToken) return Promise.reject(new Error('no refresh token'))

  // A bare axios call, so a failing refresh cannot pass back through the
  // interceptor below and try to refresh itself.
  refreshInFlight = axios
    .post(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: stored.refreshToken },
      {
        timeout: 30000,
        ...NO_COOKIES,
        // The server reads the refresh token only from its cookie, and a
        // cookie-carrying request must name an allowed Origin.
        headers: {
          Cookie: `${REFRESH_COOKIE}=${stored.refreshToken}`,
          Origin: API_ORIGIN,
        },
      },
    )
    .then(async (response) => {
      // Signed out or switched account while this was in flight: writing the
      // answer back would sign the old account in again.
      if (cachedAuth?.refreshToken !== stored.refreshToken) {
        const superseded = new Error('session changed during refresh')
        superseded.superseded = true
        throw superseded
      }
      const tokens = sessionTokens(response)
      const session = {
        user: response.data.user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      }
      if (!session.accessToken || !session.refreshToken) {
        throw new Error('refresh answered without tokens')
      }
      await writeStoredAuth(session)
      broadcast(refreshListeners, session)
      return session
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

// An HTML page where JSON was expected means the request missed the API
// (wrong path or prefix). Fail loudly instead of handing a string to screens.
function looksLikeHtml(response) {
  const type = String(response.headers?.['content-type'] || '')
  return type.includes('text/html') && typeof response.data === 'string'
}

apiClient.interceptors.response.use(
  (response) => {
    if (looksLikeHtml(response)) {
      const error = new Error(`Unexpected HTML from ${response.config?.url} — not an API route.`)
      error.config = response.config
      error.response = { ...response, status: 404, data: { detail: 'This feature is not available right now.' } }
      return Promise.reject(error)
    }
    return response
  },
  async (error) => {
    const request = error.config
    const status = error.response?.status
    const path = String(request?.url || '')
    const exempt = NO_REFRESH_PATHS.some((p) => path.includes(p))

    // The access token expired: refresh once and replay; sign out only if the
    // refresh itself is refused.
    if (status === 401 && request && !request._retriedAfterRefresh && !exempt) {
      request._retriedAfterRefresh = true
      try {
        const session = await refreshSession()
        request.headers = { ...request.headers, Authorization: `Bearer ${session.accessToken}` }
        return apiClient(request)
      } catch (refreshError) {
        if (!refreshError?.superseded) await endSession()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

// --- helpers ---------------------------------------------------------------

/** Port of the web `imageUrl()`: a server-relative path as an absolute URL. */
export function imageUrl(path) {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('file:') || path.startsWith('data:')) return path
  return `${API_BASE_URL}${path}`
}

/**
 * An expo-image / expo-video source for a stored path. The live server reads
 * the token for /files/ only from the Authorization header (?token= answers
 * 401), so uploaded files are requested with the header, not the query.
 */
export function imageSource(path) {
  if (!path) return null
  const uri = imageUrl(path)
  if (path.startsWith('/files/') && cachedAuth?.accessToken) {
    return { uri: `${API_BASE_URL}${path}`, headers: { Authorization: `Bearer ${cachedAuth.accessToken}` } }
  }
  return { uri }
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
  if (typeof detail?.message === 'string') return detail.message
  if (error?.message === 'Network Error') {
    return 'Cannot reach the server. Check your internet connection and try again.'
  }
  return fallbackMessage
}