// Port of web hooks/useLiveRefresh.js.
import { useEffect, useRef, useState } from 'react'
import { retainLiveEvents, releaseLiveEvents, subscribeLiveEvents } from '../api/liveEvents'

// Hints that arrive close together (a quotation, then a counter-offer, then an
// assignment) become ONE reload, this long after the last of them.
const DEBOUNCE_MS = 300

/** Keeps the shared live-events socket open while the calling component is mounted. */
export function useLiveEventsConnection() {
  useEffect(() => {
    retainLiveEvents()
    return () => releaseLiveEvents()
  }, [])
}

/**
 * Runs `reload` — an existing loader — when a live "requests_changed" hint
 * arrives, debounced. Always calls the latest `reload`. Nothing happens when
 * the socket is down.
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

/** A number that goes up (debounced) on each live hint, for effect dependencies. */
export function useLiveVersion() {
  const [version, setVersion] = useState(0)
  useLiveRefresh(() => setVersion((value) => value + 1))
  return version
}