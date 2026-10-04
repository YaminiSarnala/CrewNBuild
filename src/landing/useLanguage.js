/**
 * Language access for the OCTABUILD landing page.
 *
 * Port of the web src/components/landing/octabuild/useLanguage.js. The reference
 * project kept its own two-language state; this app already has a language
 * provider, so this adapter delegates to it rather than running a second,
 * competing copy. The returned shape is unchanged, so every ported landing
 * component works without edits.
 *
 * The landing copy exists in English and Arabic only; any other application
 * language falls back to English, which is what the web does too.
 */
import { useLanguage as useApplicationLanguage } from '../i18n/LanguageContext'
import { translations } from './content'

export function useLanguage() {
  const { language, setLanguage } = useApplicationLanguage()
  const text = translations[language] || translations.en
  return { language, setLanguage, text, isArabic: text.direction === 'rtl' }
}