// A supplier's dashboard entry: the live supplier tabs for a kind that is open
// (config/modules SUPPLIER_LIVE_KINDS), the Coming soon screen for the others.
// The kind comes from the supplier profile (SupplierContext), so this waits for
// it once on launch.
import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SupplierEquipmentTabs, SupplierLabourTabs, SupplierTabs } from '../../navigation/RoleTabs'
import { ComingSoonRoleScreen } from '../../components/ComingSoon'
import { GhostButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { isAccountLive } from '../../config/modules'
import { useSupplier } from './SupplierContext'
import { EQUIPMENT, LABOUR } from './supplierKinds'
import { useSelector } from 'react-redux'
import { useResponsive } from '../../hooks/useResponsive'
import { SkeletonBlock, SkeletonList, SkeletonStats } from '../../components/Skeleton'
import { createStyles } from '../../theme/createStyles'

export default function SupplierHome() {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { status, kind, reload } = useSupplier()

  if (status === 'idle' || status === 'loading') return <DashboardSkeleton />
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{t('dash.supplier.msg.unableLoadProfile')}</Text>
        <GhostButton label={t('dash.engineer.liveCamera.retry')} onPress={reload} />
      </View>
    )
  }
  if (!isAccountLive(user, kind)) return <ComingSoonRoleScreen />
  if (kind === EQUIPMENT) return <SupplierEquipmentTabs />
  if (kind === LABOUR) return <SupplierLabourTabs />
  return <SupplierTabs />
}

/** The dashboard's outline (header, banner, figures, a list) while the profile loads. */
function DashboardSkeleton() {
  const insets = useSafeAreaInsets()
  const { width, maxContentWidth, gutter } = useResponsive()
  const statWidth = Math.floor((Math.min(width, maxContentWidth) - gutter * 2 - 10) / 2)
  return (
    <View style={styles.skeleton}>
      <View style={[styles.header, { height: insets.top + 66 }]} />
      <View style={{ padding: gutter, gap: 14 }}>
        <SkeletonBlock height={112} />
        <SkeletonStats count={4} width={statWidth} />
        <SkeletonList count={2} />
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  skeleton: { flex: 1, backgroundColor: c.canvas },
  header: { backgroundColor: '#134127' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: c.canvas },
  text: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_700Bold', color: '#be123c' },
}))
