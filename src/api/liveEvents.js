// Port of the web services/liveEvents.js: the one live "something changed"
// connection for the signed-in user (/events/ws), separate from the chat socket.
//
// The server sends only {"event": "requests_changed"} -- no data -- and whoever
// listens reloads through its own REST loader, so the REST API stays the only
// source of truth. If this socket is down, screens still refresh on focus and
// pull-to-refresh exactly as before.
//
//   retainLiveEvents() / releaseLiveEvents()   kept open while signed in
//   subscribeLiveEvents(listener)              called on every hint
// Reconnects after a drop with backoff (1 s doubling to 30 s), reading the
// current access token each time, and after a reconnect tells listeners once
// so they catch up on anything missed.
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

function open() {
  if (holders <= 0 || socket) return
  const token = getCachedAuth()?.accessToken
  if (!token) return
  let next
  try {
    next = new WebSocket(websocketUrl(`/events/ws?token=${encodeURIComponent(token)}`))
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
    // Hints sent while disconnected are gone; reload once instead.
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

export function retainLiveEvents() {
  clearTimeout(releaseTimer)
  releaseTimer = null
  holders += 1
  open()
}

export function releaseLiveEvents() {
  holders = Math.max(0, holders - 1)
  if (holders > 0) return
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    if (holders === 0) close()
  }, RELEASE_GRACE_MS)
}

/** The app came back to the foreground: reconnect now rather than after the backoff. */
export function wakeLiveEvents() {
  if (holders <= 0 || socket) return
  clearTimeout(retryTimer)
  retryTimer = null
  backoff = 1000
  open()
}

export function subscribeLiveEvents(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The session ended: stop at once rather than reconnecting with a dead token.
onAuthExpired(() => close())
