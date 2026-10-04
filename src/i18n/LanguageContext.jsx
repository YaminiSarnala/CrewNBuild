// ---------------------------------------------------------------------------
// Port of the web src/i18n/LanguageContext.jsx.
//
// translations.js is byte-identical to the web file — all 7 languages
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
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { I18nManager, NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LANGUAGES, TRANSLATIONS } from './translations.js'

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

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: LANGUAGES,
      t,
      translateMessage,
      ready,
      isRTL: RTL_CODES.has(language),
      rtlReloadNeeded,
      dismissRtlNotice: () => setRtlReloadNeeded(false),
    }),
    [language, setLanguage, t, translateMessage, ready, rtlReloadNeeded],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
