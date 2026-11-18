// Keeps one place's weather answer fresh, and recovers on its own from a
// failed fetch: port of the web components/weather/useWeatherFeed.js.
//
// A failed request, or an answer saying the provider could not be reached, is
// tried again after 15 s, 30 s, 60 s and then every 2 minutes, and at once when
// the app comes back to the foreground; a healthy answer is refreshed every 10
// minutes. The last good answer for the same place stays on screen meanwhile,
// marked as not refreshed. Nothing is ever made up.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { REFRESH_MS, cachedWeather, isUsable, needsPlace, nextLookIn, settle } from '../../screens/weather/weatherCore'

/**
 * `key` names the place (null: nothing to fetch yet); `fetcher` returns its
 * answer. `onError(error)` may return true when it dealt with the error itself.
 */
export function useWeatherFeed(key, fetcher, { onError = null } = {}) {
  const [state, setState] = useState({ answer: null, loading: Boolean(key), refreshFailed: false })
  const good = useRef(null)
  const failures = useRef(0)
  const timer = useRef(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const load = useCallback(async (force = false) => {
    if (!key) return
    clearTimeout(timer.current)
    let answer = null
    try {
      answer = await cachedWeather(key, () => fetcherRef.current(), { force })
    } catch (error) {
      if (onErrorRef.current?.(error)) return
    }
    const result = settle(good.current, answer)
    good.current = result.good
    failures.current = isUsable(answer) || needsPlace(answer) ? 0 : failures.current + 1
    setState({ answer: result.shown, loading: false, refreshFailed: result.refreshFailed })
    timer.current = setTimeout(() => load(true), nextLookIn(failures.current))
  }, [key])

  useEffect(() => {
    good.current = null
    failures.current = 0
    setState({ answer: null, loading: Boolean(key), refreshFailed: false })
    load()
    // Back in the foreground: ask again when the last try failed or the answer is old.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      const at = Date.parse(good.current?.status?.last_updated_at || '')
      if (failures.current > 0 || !Number.isFinite(at) || Date.now() - at >= REFRESH_MS) load(true)
    })
    return () => {
      clearTimeout(timer.current)
      subscription.remove()
    }
  }, [key, load])

  const retry = useCallback(() => {
    setState((value) => ({ ...value, loading: true }))
    load(true)
  }, [load])

  return { ...state, retry }
}
