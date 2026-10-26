// ---------------------------------------------------------------------------
// Port of the web src/i18n/LanguageContext.jsx.
//
// translations.js is copied from the web file — all 7 languages
// (English, العربية, తెలుగు, हिन्दी, தமிழ், ಕನ್ನಡ, മലയാളം) carry over unchanged.
//
// Changes for React Native:
//   - localStorage        -> AsyncStorage (async, so there's a `ready` flag)
//   - navigator.language  -> expo-localization-free device locale via RN's
//                            NativeModules settings, with an 'en' fallback
//   - document.dir='rtl'  -> I18nManager.forceRTL(). NOTE: on native, flipping
//                            RTL requires an app RELOAD to fully apply. We warn
//                            the user rather than silently half-applying it.
// ---------------------------------------------------------------------------
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { I18nManager, NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LANGUAGES, TRANSLATIONS } from './translations.js'
import { setActiveLanguage } from './activeLanguage'
import {
  BATCH_DELAY,
  cachedTranslation,
  fetchTranslations,
  isTranslatableText,
  loadStoredTranslations,
} from './dynamicTranslation'

const STORAGE_KEY = 'octabuild_language'
const SUPPORTED_CODES = new Set(LANGUAGES.map(({ code }) => code))
const RTL_CODES = new Set(['ar'])

const LanguageContext = createContext(null)

// Same error-message -> translation-key map as the web app.
const MESSAGE_KEYS = {
  'Unable to login. Please check your credentials.': 'error.login',
  'Invalid username/email or password': 'error.credentials',
  'Unable to create account. Please check the form.': 'error.signup',
  'Email already registered': 'error.emailRegistered',
}

function deviceLanguage() {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier
    const code = String(locale || 'en').split(/[-_]/)[0]
    return SUPPORTED_CODES.has(code) ? code : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en')
  const [ready, setReady] = useState(false)
  const [rtlReloadNeeded, setRtlReloadNeeded] = useState(false)

  // Published during render, not in an effect, so the plain formatters in
  // utils/formatters.js use the right language on this very render.
  setActiveLanguage(language)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return
        setLanguageState(SUPPORTED_CODES.has(stored) ? stored : deviceLanguage())
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageState(deviceLanguage())
          setReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setLanguage = useCallback((code) => {
    if (!SUPPORTED_CODES.has(code)) return
    setLanguageState(code)
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {})

    const shouldBeRTL = RTL_CODES.has(code)
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL)
      I18nManager.forceRTL(shouldBeRTL)
      // Layout direction only fully applies after a JS bundle reload on native.
      setRtlReloadNeeded(true)
    }
  }, [])

  const t = useCallback(
    (key, values = {}) => {
      const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key
      return Object.entries(values).reduce(
        (translatedText, [name, value]) => translatedText.split(`{${name}}`).join(String(value)),
        template,
      )
    },
    [language],
  )

  const translateMessage = useCallback(
    (message) => {
      if (!message) return ''
      const key = MESSAGE_KEYS[String(message).trim()]
      return key ? t(key) : message
    },
    [t],
  )

  // --- Text people typed -------------------------------------------------
  //
  // `t` covers the interface's own words. `td` covers the rest: a project
  // description, a company name, a person's name. Those have no key, so they
  // are translated on demand by the backend and the answers are cached.
  //
  // `td` is called during render and must return synchronously, so an unknown
  // string is queued and its *original* is returned. When the batch comes back,
  // `dynamicVersion` changes, every consumer re-renders, and the same call now
  // finds the translation in the cache.
  const [dynamicVersion, setDynamicVersion] = useState(0)
  const pendingRef = useRef(new Set())
  const timerRef = useRef(null)

  // English is what is stored, so nothing needs asking for.
  const translatesDynamicText = language !== 'en'

  // Answers saved on an earlier launch, merged in once per language.
  useEffect(() => {
    if (!translatesDynamicText) return undefined
    let cancelled = false
    loadStoredTranslations(language).then((changed) => {
      if (changed && !cancelled) setDynamicVersion((version) => version + 1)
    })
    return () => {
      cancelled = true
    }
  }, [language, translatesDynamicText])

  const flushPending = useCallback(async () => {
    timerRef.current = null
    const texts = [...pendingRef.current]
    pendingRef.current = new Set()
    if (!texts.length) return
    const changed = await fetchTranslations(language, texts)
    if (changed) setDynamicVersion((version) => version + 1)
  }, [language])

  const td = useCallback(
    (value) => {
      if (value === null || value === undefined) return ''
      const text = typeof value === 'string' ? value : String(value)
      if (!translatesDynamicText || !text.trim() || !isTranslatableText(text)) return text

      const cached = cachedTranslation(language, text)
      if (cached !== undefined) return cached

      // Queueing only touches a ref and schedules a timer, so calling this
      // during render neither updates state nor repeats work.
      pendingRef.current.add(text)
      if (timerRef.current === null) {
        timerRef.current = setTimeout(flushPending, BATCH_DELAY)
      }
      return text
    },
    // dynamicVersion is a dependency on purpose: a new `td` makes consumers re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, translatesDynamicText, flushPending, dynamicVersion],
  )

  // A language change abandons a batch queued for the previous language; those
  // strings are re-queued by the render that follows.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingRef.current = new Set()
    }
  }, [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: LANGUAGES,
      t,
      td,
      translateMessage,
      ready,
      isRTL: RTL_CODES.has(language),
      rtlReloadNeeded,
      dismissRtlNotice: () => setRtlReloadNeeded(false),
    }),
    [language, setLanguage, t, td, translateMessage, ready, rtlReloadNeeded],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
