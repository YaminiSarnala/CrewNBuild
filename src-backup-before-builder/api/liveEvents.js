// Port of web services/liveEvents.js — the one live "something changed"
// connection for the signed-in user (GET /events/ws as a websocket).
//
// The server sends only {"event": "requests_changed"} — no data — and every
// listener reloads through its existing REST loader, so the REST API stays the
// only source of truth. If the socket is down, pull-to-refresh and the timed
// re-reads keep working exactly as before.
//
// Mobile differences, and why:
//   - The web authenticates the socket with its HttpOnly session cookie. The
//     app holds a Bearer token instead, so it is sent both as an Authorization
//     header (React Native's WebSocket accepts headers) and as ?token=, the
//     same query parameter the app already uses for /files/ URLs.
//   - window focus -> AppState: returning to the app reconnects at once and
//     tells listeners once, to catch up on anything missed in the background.
import { AppState } from 'react-native'
import { getCachedAuth, onAuthExpired, websocketUrl } from './client'

const PING_MS = 25000
const MAX_BACKOFF_MS = 30000
const RELEASE_GRACE_MS = 1500

const listeners = new Set()
let holders = 0
let socket = null
let pingTimer = null
let retryTimer = null
let releaseTimer = null
let backoff = 1000
let everOpened = false
let appStateSubscription = null

function emit(eventName) {
  listeners.forEach((listener) => {
    try {
      listener(eventName)
    } catch {
      // one listener failing must not stop the others
    }
  })
}

function clearTimers() {
  clearInterval(pingTimer)
  clearTimeout(retryTimer)
  pingTimer = null
  retryTimer = null
}

function close() {
  clearTimers()
  const current = socket
  socket = null
  everOpened = false
  backoff = 1000
  if (current) {
    current.onclose = null
    current.onerror = null
    current.onmessage = null
    try { current.close() } catch { /* already closed */ }
  }
}

function scheduleReconnect() {
  if (holders <= 0 || retryTimer) return
  const delay = backoff
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  retryTimer = setTimeout(() => {
    retryTimer = null
    open()
  }, delay)
}

function socketAddress(token) {
  const base = websocketUrl('/events/ws')
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

function open() {
  if (holders <= 0 || socket) return
  const token = getCachedAuth()?.accessToken
  // Signed out: nothing to connect as. A later sign-in remounts the tabs.
  if (!token) return
  let next
  try {
    next = new WebSocket(socketAddress(token), undefined, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    scheduleReconnect()
    return
  }
  socket = next
  next.onopen = () => {
    const reconnected = everOpened
    everOpened = true
    backoff = 1000
    clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      if (next.readyState === WebSocket.OPEN) next.send(JSON.stringify({ event: 'ping' }))
    }, PING_MS)
    // Hints sent while we were disconnected are gone; reload once instead.
    if (reconnected) emit('requests_changed')
  }
  next.onmessage = (message) => {
    let payload = null
    try {
      payload = JSON.parse(message.data)
    } catch {
      return
    }
    if (payload?.event === 'requests_changed') emit('requests_changed')
  }
  next.onclose = () => {
    if (socket !== next) return
    socket = null
    clearInterval(pingTimer)
    pingTimer = null
    scheduleReconnect()
  }
  next.onerror = () => {
    // onclose follows and schedules the retry.
  }
}

function onAppStateChange(state) {
  if (state !== 'active' || holders <= 0) return
  // Back in the foreground: reconnect now and catch up once.
  clearTimeout(retryTimer)
  retryTimer = null
  backoff = 1000
  if (!socket) open()
  emit('requests_changed')
}

export function retainLiveEvents() {
  clearTimeout(releaseTimer)
  releaseTimer = null
  holders += 1
  if (!appStateSubscription) appStateSubscription = AppState.addEventListener('change', onAppStateChange)
  open()
}

export function releaseLiveEvents() {
  holders = Math.max(0, holders - 1)
  if (holders > 0) return
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    if (holders === 0) {
      close()
      appStateSubscription?.remove()
      appStateSubscription = null
    }
  }, RELEASE_GRACE_MS)
}

export function subscribeLiveEvents(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The session ended: stop at once rather than reconnecting with a dead token.
onAuthExpired(() => close())