// A Labour Supplier's Dashboard home: port of the web SupplierDashboard's
// Dashboard section for a Labor Supplier.
//
//   welcome banner        the store's logo and name, with the labour line
//   six figure cards      LaborSupplierStatsGrid: each opens its tab
//   My Projects / Find Clients   no More tab, so they open from here
//   Pending Labor Requests       the first four, answered in place
//   Recent Requests       the latest client (partnership) requests
//
// Every figure is summed from the backend's own per-trade and request figures
// (LabourContext); nothing is estimated.
import { useCallback, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Building2, CheckCircle2, ChevronRight, ClipboardList, HardHat, UserCheck, UserSearch, Users, Wrench } from 'lucide-react-native'
import DashboardShell from '../../components/DashboardShell'
import { SkeletonStats } from '../../components/Skeleton'
import { WelcomeBanner } from '../../components/builder/BuilderDashboardParts'
import { fetchIncomingRequests } from '../../api/requests'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { useSupplier } from './SupplierContext'
import { useLabour } from './labour/LabourContext'
import { labourTotals } from './labour/labourParts'
import LabourRequests from './labour/LabourRequests'
import { FigureStat } from './SupplierEquipmentDashboard'
import { RecentRequests } from './dashboard/dashboardParts'

export default function SupplierLabourDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { gutter, width, maxContentWidth, isTablet } = useResponsive()
  const { profile } = useSupplier()
  const { services, requests, servicesStatus, requestsStatus, reload } = useLabour()
  const [clientRequests, setClientRequests] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const loadClients = useCallback(async () => {
    try {
      const data = await fetchIncomingRequests()
      setClientRequests(Array.isArray(data) ? data : [])
    } catch {
      // Keeps the last list; the labour figures never depend on it.
    }
  }, [])
  useFocusEffect(useCallback(() => {
    reload()
    loadClients()
  }, [reload, loadClients]))
  useLiveRefresh(loadClients)

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([reload(), loadClients()])
    setRefreshing(false)
  }

  // A tab, or Assignments opened on one of its own tabs (`at` makes a repeat tap count).
  const openTab = (name, params) => navigation.navigate(name, params ? { ...params, at: Date.now() } : undefined)
  const toServices = () => openTab('SupplierLabourServicesTab')
  const toAssignments = (tab) => () => openTab('SupplierLabourAssignmentsTab', { tab })
  const toRequests = () => openTab('SupplierRequestsTab')

  const totals = labourTotals(services, requests)
  const stats = [
    { id: 'total', label: t('labor.stats.totalWorkers'), value: totals.total, icon: Users, tone: 'blue', onPress: toServices },
    { id: 'available', label: t('labor.stats.availableWorkers'), value: totals.available, icon: UserCheck, tone: 'green', onPress: toServices },
    { id: 'deployed', label: t('labor.stats.deployedWorkers'), value: totals.deployed, icon: HardHat, tone: 'orange', onPress: toAssignments('active') },
    { id: 'pending', label: t('labor.stats.pendingRequests'), value: totals.pending, icon: ClipboardList, tone: 'amber', onPress: toRequests },
    { id: 'active', label: t('labor.stats.activeAssignments'), value: totals.active, icon: Wrench, tone: 'purple', onPress: toAssignments('active') },
    { id: 'completed', label: t('labor.stats.completedAssignments'), value: totals.completed, icon: CheckCircle2, tone: 'sky', onPress: toAssignments('completed') },
  ]
  const columns = isTablet ? 3 : 2
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  // Rounded down so two cards always fit one row on every screen density.
  const statWidth = Math.floor((inner - 10 * (columns - 1)) / columns)
  const storeName = profile?.store_name || user?.name || t('role.supplier')

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 14 }}>
        <WelcomeBanner
          imagePath={profile?.store_logo_url || user?.profile_image_url || ''}
          role="SUPPLIER"
          name={storeName}
          title={t('dash.supplier.hero.welcome', { name: `, ${td(user?.name) || storeName}` })}
          subtitle={t('labor.supplier.heroSub')}
        />

        {/* Figures wait for the first load, so they never flash 0. */}
        {servicesStatus === 'idle' || requestsStatus === 'idle' ? (
          <SkeletonStats count={6} width={statWidth} />
        ) : (
          <View style={styles.stats}>
            {stats.map((stat) => <FigureStat key={stat.id} stat={stat} width={statWidth} />)}
          </View>
        )}

        {/* My Projects and Find Clients open from here (no More tab). */}
        <View style={styles.navRow}>
          {[
            { route: 'SupplierMyProjects', label: t('ui.myProjects'), icon: Building2 },
            { route: 'SupplierFindClients', label: t('ui.findClients'), icon: UserSearch },
          ].map(({ route, label, icon: Icon }) => (
            <Pressable key={route} onPress={() => navigation.navigate(route)} style={styles.navCard} accessibilityRole="button">
              <View style={styles.navIcon}><Icon size={18} color={COLORS.brand[800]} /></View>
              <Text style={styles.navText} numberOfLines={1}>{label}</Text>
              <ChevronRight size={16} color={COLORS.slate[400]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} numberOfLines={2}>{t('labor.supplier.pendingTitle')}</Text>
          <Pressable onPress={toRequests} style={styles.sectionLink} hitSlop={6} accessibilityRole="button">
            <Text style={styles.sectionLinkText}>{t('ui.requests')}</Text>
            <ChevronRight size={14} color={COLORS.brand[700]} />
          </Pressable>
        </View>
        <LabourRequests compact />

        <RecentRequests requests={clientRequests} onOpen={toRequests} />
      </View>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
  navCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 13 },
  navIcon: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.brandSoft },
  navText: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  sectionHead: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -2 },
  sectionTitle: { flex: 1, fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionLinkText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
}))
