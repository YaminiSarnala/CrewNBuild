// A supplier's dashboard entry: the live supplier tabs for a kind that is open
// (config/modules SUPPLIER_LIVE_KINDS), the Coming soon screen for the others.
// The kind comes from the supplier profile (SupplierContext), so this waits for
// it once on launch.
import { View, Text, ActivityIndicator } from 'react-native'
import { SupplierTabs } from '../../navigation/RoleTabs'
import { ComingSoonRoleScreen } from '../../components/ComingSoon'
import { GhostButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { isAccountLive } from '../../config/modules'
import { useSupplier } from './SupplierContext'
import { useSelector } from 'react-redux'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function SupplierHome() {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { status, kind, reload } = useSupplier()

  if (status === 'idle' || status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.brand[700]} />
      </View>
    )
  }
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{t('dash.supplier.msg.unableLoadProfile')}</Text>
        <GhostButton label={t('dash.engineer.liveCamera.retry')} onPress={reload} />
      </View>
    )
  }
  return isAccountLive(user, kind) ? <SupplierTabs /> : <ComingSoonRoleScreen />
}

const styles = createStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: c.canvas },
  text: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_700Bold', color: '#be123c' },
}))
