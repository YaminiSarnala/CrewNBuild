// Port of the web hooks/useLiveRefresh.js.
import { useEffect, useRef, useState } from 'react'
import { releaseLiveEvents, retainLiveEvents, subscribeLiveEvents } from '../api/liveEvents'

// Hints that arrive close together become ONE reload, this long after the last.
const DEBOUNCE_MS = 300

/** Keeps the shared live-events socket open while the calling component is mounted. */
export function useLiveEventsConnection(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    retainLiveEvents()
    return () => releaseLiveEvents()
  }, [enabled])
}

/**
 * Runs `reload` -- an existing loader -- when a live hint arrives, debounced.
 * Always calls the latest `reload`, so it needs no memoising.
 */
export function useLiveRefresh(reload) {
  const latest = useRef(reload)
  latest.current = reload
  useEffect(() => {
    let timer = null
    const unsubscribe = subscribeLiveEvents(() => {
      clearTimeout(timer)
      timer = setTimeout(() => { latest.current?.() }, DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])
}

/** A number that goes up on each live hint, for effects with no reload function. */
export function useLiveVersion() {
  const [version, setVersion] = useState(0)
  useLiveRefresh(() => setVersion((value) => value + 1))
  return version
}
