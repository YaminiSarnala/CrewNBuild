// Shared chrome for the four role dashboards: greeting header with the user's
// name and role, a notification bell wired to GET /notifications, pull-to-
// refresh, and consistent loading / error / empty states.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bell, LogOut, Globe } from 'lucide-react-native'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUser } from '../store/authSlice'
import { useLanguage } from '../i18n/LanguageContext'
import { imageUrl } from '../api/client'
import { useResponsive } from '../hooks/useResponsive'
import { ContentWrap } from './Responsive'
import { SHADOW } from '../theme/tokens'

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

export function Panel({ title, action, children, className = '' }) {
  const { gutter } = useResponsive()
  return (
    <View
      className={`mb-4 rounded-3xl border border-slate-200 bg-white p-5 ${className}`}
      style={[SHADOW.card, { marginHorizontal: gutter }]}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-display text-graphite" style={{ fontSize: 16, letterSpacing: -0.4 }}>
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
      <View className="items-center py-8">
        <ActivityIndicator color="#134127" />
      </View>
    )
  }
  if (error) {
    return (
      <Text className="py-4 font-sans text-warm" style={{ fontSize: 13, lineHeight: 19 }}>
        {error}
      </Text>
    )
  }
  if (empty) {
    return (
      <Text className="py-4 font-sans text-slate-400" style={{ fontSize: 13.5 }}>
        {emptyText}
      </Text>
    )
  }
  return children
}

export function MetricRow({ items }) {
  const { gutter } = useResponsive()
  return (
    <View className="mb-4 flex-row" style={{ gap: 10, marginHorizontal: gutter }}>
      {items.map((item) => (
        <View
          key={item.label}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-4"
          style={SHADOW.card}
        >
          <Text className="font-display text-brand-800" style={{ fontSize: 21 }}>
            {item.value}
          </Text>
          <Text className="mt-0.5 font-sansSemi text-slate-500" style={{ fontSize: 11, lineHeight: 14 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default function DashboardShell({ children, refreshing, onRefresh, onOpenNotifications, onOpenLanguage }) {
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { gutter } = useResponsive()

  const roleLabelKey =
    {
      OWNER: 'role.owner',
      CONTRACTOR: 'role.contractor',
      SUPPLIER: 'role.supplier',
      ENGINEER: 'role.engineer',
    }[user?.role] || 'role.owner'

  return (
    <View className="flex-1 bg-surface-deep">
      <View style={{ paddingTop: insets.top }} className="bg-brand-800 pb-5">
        <ContentWrap>
        <View className="flex-row items-center pt-3" style={{ gap: 12, paddingHorizontal: gutter }}>
          <View className="h-11 w-11 overflow-hidden rounded-full bg-brand-600">
            {user?.profile_image_url ? (
              <Image source={{ uri: imageUrl(user.profile_image_url) }} style={{ width: 44, height: 44 }} />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="font-display text-white" style={{ fontSize: 16 }}>
                  {(user?.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-display text-white" style={{ fontSize: 17, letterSpacing: -0.4 }} numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            <Text className="font-sansMedium text-brand-300" style={{ fontSize: 12 }}>
              {t(roleLabelKey)}
            </Text>
          </View>
          <Pressable onPress={onOpenLanguage} accessibilityLabel={t('language.label')} className="p-2">
            <Globe size={19} color="#c3dccd" />
          </Pressable>
          <Pressable onPress={onOpenNotifications} accessibilityLabel="Notifications" className="p-2">
            <Bell size={19} color="#c3dccd" />
          </Pressable>
          <Pressable onPress={() => dispatch(logoutUser())} accessibilityLabel="Sign out" className="p-2">
            <LogOut size={19} color="#c3dccd" />
          </Pressable>
        </View>
        </ContentWrap>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#134127" colors={['#134127']} />
          ) : undefined
        }
      >
        <ContentWrap>{children}</ContentWrap>
      </ScrollView>
    </View>
  )
}
