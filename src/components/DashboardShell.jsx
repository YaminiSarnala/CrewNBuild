// Shared chrome for the four role dashboards: greeting header with the user's
// name and role, a notification bell wired to GET /notifications, pull-to-
// refresh, and consistent loading / error / empty states.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bell, LogOut, Globe, MessageCircle, Moon, Sun } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import { useNotifications } from '../notifications/NotificationsContext'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUser } from '../store/authSlice'
import { useLanguage } from '../i18n/LanguageContext'
import { imageSource } from '../api/client'
import { useResponsive } from '../hooks/useResponsive'
import { ContentWrap } from './Responsive'
import { SHADOW, COLORS } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

/**
 * Small async-data hook so every dashboard panel handles loading/error/refresh
 * the same way instead of each screen re-inventing it.
 */
export function useAsyncData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    try {
      setError('')
      const result = await loader()
      setData(result)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not load this yet.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run, setData }
}

// Set by screens whose scroll content already carries the side gutter, so a
// Panel inside them does not add a second one.
const InsetContext = createContext(false)
export function InsetArea({ children }) {
  return <InsetContext.Provider value>{children}</InsetContext.Provider>
}

export function Panel({ title, action, children, style }) {
  const { gutter } = useResponsive()
  const inset = useContext(InsetContext)
  return (
    <View
      style={[styles.view, SHADOW.card, { marginHorizontal: inset ? 0 : gutter }, style]}
    >
      <View style={styles.view2}>
        <Text style={[styles.text, { fontSize: 16, letterSpacing: -0.4 }]}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  )
}

export function PanelState({ loading, error, empty, emptyText, children }) {
  if (loading) {
    return (
      <View style={styles.view3}>
        <ActivityIndicator color={COLORS.brand[800]} />
      </View>
    )
  }
  if (error) {
    return (
      <Text style={[styles.text2, { fontSize: 13, lineHeight: 19 }]}>
        {error}
      </Text>
    )
  }
  if (empty) {
    return (
      <Text style={[styles.text3, { fontSize: 13.5 }]}>
        {emptyText}
      </Text>
    )
  }
  return children
}

export function MetricRow({ items }) {
  const { gutter } = useResponsive()
  return (
    <View style={[styles.view4, { gap: 10, marginHorizontal: gutter }]}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.view5, SHADOW.card]}
        >
          <Text style={[styles.text4, { fontSize: 21 }]}>
            {item.value}
          </Text>
          <Text style={[styles.text5, { fontSize: 11, lineHeight: 14 }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

// A small red count on a header icon, "9+" past nine (as the web's bell).
function CountBadge({ count }) {
  if (!count) return null
  return (
    <View style={styles.view6}>
      <Text style={[styles.text6, { fontSize: 9 }]}>{count > 9 ? '9+' : count}</Text>
    </View>
  )
}

export default function DashboardShell({ children, refreshing, onRefresh, onOpenNotifications, onOpenLanguage }) {
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { gutter } = useResponsive()
  const navigation = useNavigation()
  const { unreadCount, unreadMessages } = useNotifications()
  const { isDark, toggleTheme } = useTheme()

  const roleLabelKey =
    {
      OWNER: 'role.owner',
      CONTRACTOR: 'role.contractor',
      SUPPLIER: 'role.supplier',
      ENGINEER: 'role.engineer',
    }[user?.role] || 'role.owner'

  return (
    <View style={styles.view7}>
      <View style={[styles.view8, { paddingTop: insets.top }]}>
        <ContentWrap>
        <View style={[styles.view9, { gap: 4, paddingHorizontal: gutter }]}>
          <View style={styles.view10}>
            {user?.profile_image_url ? (
              <Image source={imageSource(user.profile_image_url)} style={{ width: 44, height: 44 }} />
            ) : (
              <View style={styles.view11}>
                <Text style={[styles.text7, { fontSize: 16 }]}>
                  {(user?.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.scrollView}>
            <Text style={[styles.text7, { fontSize: 17, letterSpacing: -0.4 }]} numberOfLines={1}>
              {td(user?.name) || '—'}
            </Text>
            <Text style={[styles.text8, { fontSize: 12 }]}>
              {t(roleLabelKey)}
            </Text>
          </View>
          {/* Light / dark, as the web's header toggle: the icon shows the theme you switch to. */}
          <Pressable
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel={isDark ? t('ui.shared.switchToLightTheme') : t('ui.shared.switchToDarkTheme')}
            style={styles.pressable}
          >
            {isDark ? <Sun size={19} color="#c3dccd" /> : <Moon size={19} color="#c3dccd" />}
          </Pressable>
          <Pressable onPress={onOpenLanguage} accessibilityLabel={t('language.label')} style={styles.pressable}>
            <Globe size={19} color="#c3dccd" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Messages')} accessibilityLabel={t('dash.common.messages')} style={styles.pressable}>
            <MessageCircle size={19} color="#c3dccd" />
            <CountBadge count={unreadMessages} />
          </Pressable>
          <Pressable
            onPress={onOpenNotifications || (() => navigation.navigate('Notifications'))}
            accessibilityLabel={t('dash.common.notifications')}
            style={styles.pressable}
          >
            <Bell size={19} color="#c3dccd" />
            <CountBadge count={unreadCount} />
          </Pressable>
          <Pressable onPress={() => dispatch(logoutUser())} accessibilityLabel="Sign out" style={styles.pressable}>
            <LogOut size={19} color="#c3dccd" />
          </Pressable>
        </View>
        </ContentWrap>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.brand[700]} colors={[COLORS.brand[700]]} />
          ) : undefined
        }
      >
        <ContentWrap>{children}</ContentWrap>
      </ScrollView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 17.5 },
  view2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view3: { alignItems: 'center', paddingVertical: 28 },
  text2: { paddingVertical: 14, fontFamily: 'Inter_400Regular', color: '#dc2626' },
  text3: { paddingVertical: 14, fontFamily: 'Inter_400Regular', color: c.textFaint },
  view4: { marginBottom: 14, flexDirection: 'row' },
  view5: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 14 },
  text4: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  text5: { marginTop: 1.75, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view6: { position: 'absolute', right: 1.75, top: 1.75, height: 14, minWidth: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#dc2626', paddingHorizontal: 3.5 },
  text6: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view7: { flex: 1, backgroundColor: c.canvas },
  view8: { backgroundColor: '#134127', paddingBottom: 17.5 },
  view9: { flexDirection: 'row', alignItems: 'center', paddingTop: 10.5 },
  view10: { height: 38.5, width: 38.5, overflow: 'hidden', borderRadius: 9999, backgroundColor: '#236645' },
  view11: { height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' },
  text7: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  scrollView: { flex: 1 },
  text8: { fontFamily: 'Inter_500Medium', color: '#9dc5af' },
  pressable: { padding: 7 },
}))
