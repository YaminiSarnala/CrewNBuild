// Port of web subscription/useBuilderSubscription.js.
//
// The builder's subscription as the SERVER reports it (GET /subscriptions/me).
// Re-read on mount, when the app returns to the foreground (the web's window
// 'focus'), after any purchase (announceSubscriptionChange — the web's
// SUBSCRIPTION_CHANGED_EVENT) and at the moment the plan in force is due to end.
// Nothing is cached for authorization: the backend decides every paid feature.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { fetchMySubscription } from '../api/subscription'
import { msUntilChange } from '../utils/subscriptionFormat'

const MAX_TIMER_MS = 2 ** 31 - 1

const changeListeners = new Set()

/** Every mounted subscription hook re-reads the server's status. */
export function announceSubscriptionChange() {
  changeListeners.forEach((listener) => {
    try { listener() } catch { /* one bad listener must not stop the rest */ }
  })
}

export default function useBuilderSubscription({ enabled = true } = {}) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  // The server has no subscriptions API at all (404): plans are not offered
  // there, so nothing about plans is shown and nothing is reported as an error.
  const [unavailable, setUnavailable] = useState(false)
  const latest = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled) return null
    const call = ++latest.current
    setLoading(true)
    try {
      const next = await fetchMySubscription()
            if (call === latest.current) { setStatus(next); setError(null); setUnavailable(false) }
      return next
    } catch (failure) {
      if (call === latest.current) {
        if (failure?.response?.status === 404) {
          setUnavailable(true)
          setStatus(null)
          setError(null)
        } else {
          setError(failure)
        }
      }
      return null
    } finally {
      if (call === latest.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined
    const onChange = () => { refresh() }
    changeListeners.add(onChange)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      changeListeners.delete(onChange)
      subscription?.remove?.()
    }
  }, [enabled, refresh])

  useEffect(() => {
    const wait = msUntilChange(status)
    if (wait === null) return undefined
    const timer = setTimeout(() => refresh(), Math.min(wait + 1000, MAX_TIMER_MS))
    return () => clearTimeout(timer)
  }, [status, refresh])

  return { status, loading, error, unavailable, refresh }}
