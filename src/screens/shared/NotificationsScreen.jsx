// Port of the web NotificationBell's list, as a screen: the signed-in user's
// notifications (chat messages excluded), newest first, unread ones tinted,
// each with its module and time. Title and body are written by the backend in
// English and translated for display. Tapping one opens where it belongs.
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native'
import { useSelector } from 'react-redux'
import { BellOff } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../../components/ScreenHeader'
import { useLanguage } from '../../i18n/LanguageContext'
import { useNotifications } from '../../notifications/NotificationsContext'
import { formatDateTime } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

// Display names for the module codes the API infers for each notification.
const MODULE_KEYS = {
  message: 'ui.shared.moduleMessage',
  request: 'dash.common.request',
  project: 'dash.common.project',
  supplier: 'dash.common.supplier',
  contractor: 'ui.shared.moduleContractor',
  estimate: 'ui.shared.moduleEstimate',
  escrow: 'ui.escrow',
  engineers: 'ui.shared.moduleEngineers',
  general: 'dash.owner.requests.general',
  adverts: 'ui.shared.moduleAdverts',
}

// Where an owner's notification leads. Requests, builders, suppliers and
// escrow live inside a project, so those open the Projects list.
const OWNER_TABS = {
  project: 'OwnerProjectsTab',
  estimate: 'OwnerProjectsTab',
  request: 'OwnerProjectsTab',
  contractor: 'OwnerProjectsTab',
  supplier: 'OwnerProjectsTab',
  escrow: 'OwnerProjectsTab',
  general: 'OwnerProfileTab',
}

export default function NotificationsScreen({ navigation }) {
  // Full-screen pages draw under the Android navigation buttons; keep the end clear of them.
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { notifications, unreadCount, reload, markAllRead } = useNotifications()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }, [reload])

  const open = (notification) => {
    const content = `${notification.title || ''} ${notification.body || ''}`.toLowerCase()
    if (notification.module === 'message' || (content.includes('message') && !content.includes('request'))) {
      navigation.navigate('Messages')
      return
    }
    if (user?.role === 'OWNER' && OWNER_TABS[notification.module]) {
      navigation.navigate('OwnerHome', { screen: OWNER_TABS[notification.module] })
      return
    }
    navigation.goBack()
  }

  return (
    <View style={styles.view}>
      <ScreenHeader
        title={t('dash.common.notifications')}
        onBack={() => navigation.goBack()}
        right={unreadCount > 0 ? (
          <Pressable onPress={markAllRead} style={styles.pressable}>
            <Text style={[styles.text, { fontSize: 12 }]}>{t('dash.common.markAllRead')}</Text>
          </Pressable>
        ) : null}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand[700]} />}
      >
        {!notifications.length ? (
          <View style={styles.view2}>
            <BellOff size={30} color="#cbd5e1" />
            <Text style={[styles.text2, { fontSize: 15 }]}>{t('dash.common.noNotifications')}</Text>
            <Text style={[styles.text3, { fontSize: 12.5 }]}>{t('dash.common.noNotificationsSub')}</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => open(item)}
              style={[styles.pressable2, item.is_read ? styles.pressable3 : styles.pressable4]}
            >
              <View style={[styles.view3, { gap: 10 }]}>
                <Text style={[styles.text4, { fontSize: 14 }]}>{td(item.title)}</Text>
                <View style={styles.view4}>
                  <Text style={[styles.text5, { fontSize: 9.5 }]}>
                    {MODULE_KEYS[item.module] ? t(MODULE_KEYS[item.module]) : td(item.module)}
                  </Text>
                </View>
              </View>
              {item.body ? (
                <Text style={[styles.text6, { fontSize: 12.5, lineHeight: 18 }]}>{td(item.body)}</Text>
              ) : null}
              <Text style={[styles.text7, { fontSize: 10.5 }]}>{formatDateTime(item.created_at, item.created_at)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.canvas },
  pressable: { borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view2: { alignItems: 'center', paddingTop: 56 },
  text2: { marginTop: 10.5, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text3: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable2: { marginBottom: 8.75, borderRadius: 14, borderWidth: 1, padding: 12.25 },
  pressable3: { borderColor: c.border, backgroundColor: c.card },
  pressable4: { borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  view3: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  text4: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  view4: { borderRadius: 9999, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, paddingHorizontal: 7, paddingVertical: 1.75 },
  text5: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandText },
  text6: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  text7: { marginTop: 7, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
}))
