// The green bar at the top of a full-screen page (one opened over the tabs):
// back, a title and an optional subtitle, in the dashboard header's colours.
import { View, Text, Pressable, I18nManager } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { useResponsive } from '../hooks/useResponsive'
import { createStyles } from '../theme/createStyles'

export default function ScreenHeader({ title, subtitle, onBack, right = null }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const { gutter } = useResponsive()
  return (
    <View style={[styles.view, { paddingTop: insets.top }]}>
      <View style={[styles.view2, { gap: 6, paddingHorizontal: Math.max(gutter - 8, 8) }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('dash.owner.projectDetails.backToProjects')}
            style={styles.pressable}
            hitSlop={8}
          >
            <ArrowLeft size={20} color="#ffffff" style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : null} />
          </Pressable>
        ) : null}
        <View style={styles.view3}>
          <Text style={[styles.text, { fontSize: 17, letterSpacing: -0.3 }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.text2, { fontSize: 12 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { backgroundColor: '#134127' },
  view2: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10.5, paddingTop: 7 },
  pressable: { padding: 7 },
  view3: { flex: 1 },
  text: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text2: { fontFamily: 'Inter_500Medium', color: '#9dc5af' },
}))
