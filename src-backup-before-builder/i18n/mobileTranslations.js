// Strings that only the mobile app shows (a phone has no sidebar, so e.g. a
// "More" tab exists here and not on the web). translations.js stays a
// byte-identical copy of the web file so it can be re-synced by copying; these
// keys are merged on top of it in LanguageContext. Same 7 languages.
//
// Keep keys under the `mobile.` prefix so they never collide with web keys.
// Each Builder area keeps its own strings in ./mobile/<area>.js.
import dashboard from './mobile/dashboard.js'
import partners from './mobile/partners.js'
import projects from './mobile/projects.js'
import billing from './mobile/billing.js'
import account from './mobile/account.js'

const CORE = {
  en: {
    'mobile.tab.more': 'More',
  },
  ar: {
    'mobile.tab.more': 'المزيد',
  },
  te: {
    'mobile.tab.more': 'మరిన్ని',
  },
  hi: {
    'mobile.tab.more': 'और',
  },
  ta: {
    'mobile.tab.more': 'மேலும்',
  },
  kn: {
    'mobile.tab.more': 'ಇನ್ನಷ್ಟು',
  },
  ml: {
    'mobile.tab.more': 'കൂടുതൽ',
  },
}

const PARTS = [dashboard, partners, projects, billing, account]

export const MOBILE_TRANSLATIONS = Object.fromEntries(
  Object.entries(CORE).map(([code, table]) => [code, Object.assign({}, table, ...PARTS.map((part) => part[code] || {}))]),
)