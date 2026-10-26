/**
 * Display translation of text that people typed.
 *
 * The interface's own words -- labels, buttons, statuses -- come from the key
 * table in `translations.js`, which holds seven hand-written strings per key.
 * That cannot reach a project description someone entered this morning: it has
 * no key, so there is nothing to look up. This module covers only that case, by
 * asking the backend, which asks a machine translator and caches the answer.
 *
 * Three rules shape everything here:
 *
 *   1. The stored value never changes. `td()` returns a string to paint; the
 *      database keeps exactly what was typed.
 *   2. Every miss costs money and sends text to a third party. So answers are
 *      cached in memory and in AsyncStorage, whole batches go in one request,
 *      and anything without a word in it never leaves the browser.
 *   3. It must never blank the screen. Until a translation arrives -- or if it
 *      never does -- `td()` returns the original text. A page renders the same
 *      as it always did, then the translated strings replace themselves.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { MAX_TEXTS_PER_REQUEST, translateTexts } from '../api/translation'

const STORAGE_PREFIX = 'octabuild_dynamic_translations_'
// A bound on what is kept per language, so a long-lived session cannot grow the
// stored cache without limit or trip the storage quota.
const MAX_STORED_ENTRIES = 3000
// Collect strings rendered in the same tick into one request. A dashboard paints
// dozens of names and titles at once; this makes that one call, not dozens.
const BATCH_DELAY_MS = 50

// language -> Map(sourceText -> translatedText)
const memoryCache = new Map()
// Set once the backend reports no provider key, so a deployment without
// translation configured does not fire a request per screen forever.
let providerUnavailable = false

// A failed batch caches nothing, so the next render finds the same strings
// missing and asks again -- and a signed-out session or an unreachable backend
// fails every time, turning each re-render into another request. Failures are
// therefore remembered for a cooldown, during which those strings render as
// stored and are not retried.
const RETRY_COOLDOWN_MS = 60_000
const failedUntil = new Map()

function isCoolingDown(language, text) {
  const until = failedUntil.get(`${language}\u0000${text}`)
  if (until === undefined) return false
  if (Date.now() >= until) {
    failedUntil.delete(`${language}\u0000${text}`)
    return false
  }
  return true
}

function markFailed(language, texts) {
  const until = Date.now() + RETRY_COOLDOWN_MS
  for (const text of texts) failedUntil.set(`${language}\u0000${text}`, until)
}

function cacheFor(language) {
  let cache = memoryCache.get(language)
  if (!cache) {
    cache = new Map()
    memoryCache.set(language, cache)
  }
  return cache
}

// AsyncStorage cannot be read during render the way the web reads
// localStorage, so the stored answers are loaded once per language and merged
// in. Resolves true when that added anything, the caller's cue to re-render.
const loadedLanguages = new Set()
export async function loadStoredTranslations(language) {
  if (loadedLanguages.has(language)) return false
  loadedLanguages.add(language)
  try {
    const stored = JSON.parse((await AsyncStorage.getItem(`${STORAGE_PREFIX}${language}`)) || 'null')
    if (!stored || typeof stored !== 'object') return false
    const cache = cacheFor(language)
    let changed = false
    for (const [source, translated] of Object.entries(stored)) {
      if (typeof translated === 'string' && !cache.has(source)) {
        cache.set(source, translated)
        changed = true
      }
    }
    return changed
  } catch {
    // A damaged or unavailable store is simply an empty cache. Translation is
    // an optimisation over showing the original, never a requirement to render.
    return false
  }
}

function persist(language) {
  const cache = cacheFor(language)
  try {
    // Keep the most recent entries when over the bound; Map preserves insertion
    // order, so the oldest are the ones dropped.
    const entries = [...cache.entries()]
    const kept = entries.length > MAX_STORED_ENTRIES ? entries.slice(-MAX_STORED_ENTRIES) : entries
    AsyncStorage.setItem(`${STORAGE_PREFIX}${language}`, JSON.stringify(Object.fromEntries(kept))).catch(() => {})
  } catch {
    // Quota exceeded or storage blocked: the in-memory cache still works for
    // this session, so there is nothing to recover from and nothing to report.
  }
}

/**
 * Whether a string is worth sending.
 *
 * Something with no letter in it -- "42,00,000", "75%", "-", "3" -- has nothing
 * to translate. Sending it would spend money to get the same string back, and
 * risks getting a different one.
 */
export function isTranslatableText(text) {
  // Not `/\p{L}/u`: Hermes reads `\p` there as a plain "p", so "Yamini" read
  // as having no letter and was never translated. A character is a letter when
  // it has distinct upper and lower case, or sits in the scripts that have no
  // case (Indic, Arabic, CJK).
  for (const char of String(text)) {
    if (char.toLowerCase() !== char.toUpperCase()) return true
    if (/[\u0600-\u06FF\u0900-\u0DFF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(char)) return true
  }
  return false
}

export function cachedTranslation(language, text) {
  const cached = cacheFor(language).get(text)
  if (cached !== undefined) return cached
  // Treat a recent failure as "this is the string to show", so the caller
  // renders the stored text instead of queueing another doomed request.
  return isCoolingDown(language, text) ? text : undefined
}

/**
 * Translate a batch and store the answers.
 *
 * Returns true when at least one new translation arrived, which is the caller's
 * signal to re-render. A failure returns false and leaves the cache untouched,
 * so the originals stay on screen and the strings can be retried later.
 */
export async function fetchTranslations(language, texts) {
  if (providerUnavailable || !texts.length) return false

  const cache = cacheFor(language)
  let changed = false

  for (let index = 0; index < texts.length; index += MAX_TEXTS_PER_REQUEST) {
    const slice = texts.slice(index, index + MAX_TEXTS_PER_REQUEST)
    let answer
    try {
      answer = await translateTexts(slice, language)
    } catch {
      // Offline, signed out, or the backend is down. The originals are already
      // on screen; hold these strings back for a while so a re-render does not
      // immediately ask again.
      markFailed(language, texts.slice(index))
      return changed
    }
    if (!answer.configured) {
      providerUnavailable = true
      return changed
    }
    // Anything the backend did not answer for must not be asked again on the
    // very next render either.
    const missing = slice.filter((text) => !(text in answer.translations))
    if (missing.length) markFailed(language, missing)
    for (const [source, translated] of Object.entries(answer.translations)) {
      if (typeof translated === 'string' && cache.get(source) !== translated) {
        cache.set(source, translated)
        changed = true
      }
    }
  }

  if (changed) persist(language)
  return changed
}

export const BATCH_DELAY = BATCH_DELAY_MS

/** Forget everything cached. Used when a different account signs in. */
export function clearDynamicTranslations() {
  for (const language of memoryCache.keys()) {
    try {
      AsyncStorage.removeItem(`${STORAGE_PREFIX}${language}`).catch(() => {})
    } catch {
      // Nothing to do: the in-memory clear below is what matters.
    }
  }
  memoryCache.clear()
  loadedLanguages.clear()
  failedUntil.clear()
  providerUnavailable = false
}
