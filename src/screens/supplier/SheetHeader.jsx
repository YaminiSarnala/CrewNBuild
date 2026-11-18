// The green bar with a back arrow that every pushed screen has
// (StackScreenShell), for the supplier's full-screen panels (order, project
// and profile details), so they read and close the same way.
import { View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

export default function SheetHeader({ title, subtitle, onBack }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('dash.common.back')} hitSlop={6} style={styles.back}>
          <ArrowLeft size={20} color="#ffffff" />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  )
}

const styles = createStyles(() => ({
  bar: { backgroundColor: '#134127' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  subtitle: { marginTop: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: '#9dc5af' },
}))
