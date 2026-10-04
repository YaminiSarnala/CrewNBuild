// Wired to GET /notifications and POST /notifications/read-all.
import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, BellOff } from 'lucide-react-native'
import { fetchNotifications, markNotificationsRead } from '../../api/notifications'
import { useAsyncData } from '../../components/DashboardShell'

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)
  const { data, loading, error, reload } = useAsyncData(fetchNotifications, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }, [reload])

  const list = Array.isArray(data) ? data : []

  return (
    <View className="flex-1 bg-surface-deep">
      <View style={{ paddingTop: insets.top }} className="bg-brand-800 pb-4">
        <View className="flex-row items-center px-4 pt-2" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back" className="p-2">
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <Text className="flex-1 font-display text-white" style={{ fontSize: 18, letterSpacing: -0.4 }}>
            Notifications
          </Text>
          {list.length > 0 ? (
            <Pressable
              onPress={async () => {
                await markNotificationsRead()
                reload()
              }}
              className="rounded-full bg-white/15 px-3 py-1.5"
            >
              <Text className="font-sansBold text-white" style={{ fontSize: 12 }}>
                Mark all read
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#134127" />}
      >
        {loading ? (
          <ActivityIndicator color="#134127" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text className="font-sans text-warm" style={{ fontSize: 13 }}>
            {error}
          </Text>
        ) : list.length === 0 ? (
          <View className="items-center pt-16">
            <BellOff size={30} color="#cbd5e1" />
            <Text className="mt-3 font-sans text-slate-400" style={{ fontSize: 14 }}>
              Nothing new right now.
            </Text>
          </View>
        ) : (
          list.map((item) => (
            <View
              key={item.id}
              className={`mb-3 rounded-2xl border p-4 ${
                item.is_read ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50'
              }`}
            >
              <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                {item.title || item.module || 'Update'}
              </Text>
              <Text className="mt-1 font-sans text-slate-600" style={{ fontSize: 13, lineHeight: 19 }}>
                {item.message || item.body}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
