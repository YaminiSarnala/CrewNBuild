// "Coming soon" for modules that are not live yet (see src/config/modules.js):
//   • useComingSoon().show('technician') — centred popup over the current screen
//   • <ComingSoonPanel feature="siteEngineer" /> — inline, inside a tab
//   • <ComingSoonRoleScreen /> — whole app for a Supplier / Site Engineer account
import { createContext, useCallback, useContext, useState } from 'react'
import { View, Text, Pressable, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Rocket, Clock, LogOut } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { SOON_COPY } from '../config/modules'
import { logoutUser } from '../store/authSlice'
import { COLORS } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

const BRAND = '#1a5038'

const ComingSoonContext = createContext({ show: () => {} })

export function ComingSoonProvider({ children }) {
  const [feature, setFeature] = useState(null)
  const show = useCallback((key) => setFeature(key), [])
  return (
    <ComingSoonContext.Provider value={{ show }}>
      {children}
      <ComingSoonDialog feature={feature} onClose={() => setFeature(null)} />
    </ComingSoonContext.Provider>
  )
}

export const useComingSoon = () => useContext(ComingSoonContext)

function useCopy(feature) {
  const { t } = useLanguage()
  const copy = SOON_COPY[feature] || {}
  return {
    title: copy.titleKey ? t(copy.titleKey) : t('soon.generic.title'),
    body: copy.bodyKey ? t(copy.bodyKey) : t('soon.generic.body'),
    t,
  }
}

/** Small "Soon" tag for cards and tabs. */
export function SoonTag({ style }) {
  const { t } = useLanguage()
  return (
    <View style={[styles.tag, style]}>
      <Text style={styles.tagText}>{t('soon.tag')}</Text>
    </View>
  )
}

function Badge({ t }) {
  return (
    <View style={styles.pill}>
      <Clock size={12} color={BRAND} strokeWidth={2.6} />
      <Text style={styles.pillText}>{t('soon.badge')}</Text>
    </View>
  )
}

function ComingSoonDialog({ feature, onClose }) {
  const { title, body, t } = useCopy(feature)
  return (
    <Modal visible={!!feature} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <Rocket size={30} color="#ffffff" strokeWidth={2.2} />
            </View>
          </View>
          <Badge t={t} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Text style={styles.note}>{t('soon.note')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>{t('soon.ok')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Inline version for a tab whose content is not live yet. */
export function ComingSoonPanel({ feature, style }) {
  const { title, body, t } = useCopy(feature)
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.iconRing}>
        <View style={styles.iconCircle}>
          <Rocket size={30} color="#ffffff" strokeWidth={2.2} />
        </View>
      </View>
      <Badge t={t} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Text style={styles.note}>{t('soon.note')}</Text>
    </View>
  )
}

/** Full screen for a signed-in role whose module is not live. */
export function ComingSoonRoleScreen() {
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const role = String(user?.role || '').toUpperCase()
  const { title, body, t } = useCopy(role)
  const [leaving, setLeaving] = useState(false)
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 62 }} contentFit="contain" />
      <View style={[styles.panel, styles.screenCard]}>
        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <Rocket size={30} color="#ffffff" strokeWidth={2.2} />
          </View>
        </View>
        <Badge t={t} />
        {!!user?.name && <Text style={styles.hello}>{t('soon.hello', { name: user.name })}</Text>}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.note}>{t('soon.roleNote')}</Text>
      </View>
      <Pressable
        onPress={() => { setLeaving(true); dispatch(logoutUser()) }}
        disabled={leaving}
        accessibilityRole="button"
        style={[styles.logout, leaving && { opacity: 0.6 }]}
      >
        <LogOut size={16} color={COLORS.rose?.[600] || '#e11d48'} />
        <Text style={styles.logoutText}>{t('soon.logout')}</Text>
      </Pressable>
    </View>
  )
}

const styles = createStyles((c) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  card: {
    width: '100%', maxWidth: 380, alignItems: 'center', borderRadius: 24, backgroundColor: c.card,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  panel: {
    alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card,
    paddingHorizontal: 24, paddingVertical: 28,
  },
  iconRing: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoftStrong },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND },
  pill: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999,
    backgroundColor: c.brandSoft, borderWidth: 1, borderColor: c.brandBorderSoft, paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: c.brandTextStrong },
  hello: { marginTop: 14, fontSize: 13, fontWeight: '700', color: c.textMuted },
  title: { marginTop: 10, textAlign: 'center', fontSize: 19, lineHeight: 25, fontWeight: '800', color: c.text },
  body: { marginTop: 8, textAlign: 'center', fontSize: 13.5, lineHeight: 20, color: c.textSecondary },
  note: { marginTop: 12, textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: c.textFaint },
  button: { marginTop: 20, alignSelf: 'stretch', height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: BRAND },
  buttonText: { fontSize: 14.5, fontWeight: '800', color: '#ffffff' },
  tag: { borderRadius: 999, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 7, paddingVertical: 1.5 },
  tagText: { fontSize: 9.5, fontWeight: '800', color: '#92400e', letterSpacing: 0.4 },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: c.canvas },
  screenCard: { width: '100%', maxWidth: 440 },
  logout: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.card, paddingHorizontal: 22, paddingVertical: 12,
  },
  logoutText: { fontSize: 14, fontWeight: '800', color: c.text },
}))
