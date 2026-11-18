// An Equipment Supplier's Dashboard home: port of the web SupplierDashboard's
// Dashboard section for an Equipment Supplier.
//
//   welcome banner        the store's logo and name, with the equipment line
//   eight figure cards    EquipmentSupplierStatsGrid: each opens its tab
//   My Projects / Find Clients   no More tab, so they open from here
//   Pending Equipment Requests   the first four, answered in place
//   Recent Requests       the latest client (partnership) requests
//
// Every figure is counted from the backend's own items and requests
// (EquipmentContext); nothing is estimated.
import { useCallback, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import {
  Building2, ChevronRight, ClipboardList, Construction, Package, PackageCheck, ShoppingCart, Truck, Undo2, UserSearch, Wrench,
} from 'lucide-react-native'
import DashboardShell from '../../components/DashboardShell'
import { SkeletonStats } from '../../components/Skeleton'
import { WelcomeBanner } from '../../components/builder/BuilderDashboardParts'
import { fetchIncomingRequests } from '../../api/requests'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft, softStrong } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { useSupplier } from './SupplierContext'
import { useEquipment } from './equipment/EquipmentContext'
import { allowsBuy, allowsRent } from './equipment/equipmentParts'
import EquipmentRequests from './equipment/EquipmentRequests'
import { RecentRequests } from './dashboard/dashboardParts'

// Today as YYYY-MM-DD in the phone's own time zone (rental dates are calendar dates).
const localIsoDate = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The web's equipmentTotals: the backend's item and request figures, summed. */
export function equipmentTotals(items = [], requests = [], today = localIsoDate()) {
  const active = items.filter((item) => item.is_active !== false)
  const rents = (status) => requests.filter((request) => request.request_kind === 'RENT' && request.status === status)
  return {
    total: active.reduce((sum, item) => sum + Number(item.quantity_total || 0), 0),
    // Free today: rentable items by today's rental availability, sale-only items by stock.
    available: active.reduce((sum, item) => sum + (Number(allowsRent(item) ? item.available_to_rent : item.available_to_buy) || 0), 0),
    onRent: rents('ACCEPTED')
      .filter((request) => String(request.start_date) <= today)
      .reduce((sum, request) => sum + Number(request.quantity || 0), 0),
    forSale: active.filter(allowsBuy).reduce((sum, item) => sum + Number(item.available_to_buy || 0), 0),
    pending: requests.filter((request) => request.status === 'PENDING').length,
    activeRentals: rents('ACCEPTED').length,
    completedRentals: rents('COMPLETED').length,
    completedSales: requests.filter((request) => request.request_kind === 'BUY' && request.status === 'COMPLETED').length,
  }
}

// The web stat tones: card / chip background and the accent.
const TONES = {
  blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#1d4ed8'],
  green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#15803d'],
  orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#ea580c'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#0f766e'],
  amber: ['#fffbeb', '#fef3c7', '#fde68a', '#b45309'],
  purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#7e22ce'],
  sky: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#0369a1'],
  rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#be123c'],
}

export default function SupplierEquipmentDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { gutter, width, maxContentWidth, isTablet } = useResponsive()
  const { profile } = useSupplier()
  const { items, requests, itemsStatus, requestsStatus, reload } = useEquipment()
  const [clientRequests, setClientRequests] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const loadClients = useCallback(async () => {
    try {
      const data = await fetchIncomingRequests()
      setClientRequests(Array.isArray(data) ? data : [])
    } catch {
      // Keeps the last list; the equipment figures never depend on it.
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
  const toInventory = () => openTab('SupplierInventoryTab')
  const toAssignments = (tab) => () => openTab('SupplierAssignmentsTab', { tab })
  const toRequests = () => openTab('SupplierRequestsTab')

  const totals = equipmentTotals(items, requests)
  const stats = [
    { id: 'total', label: t('equipment.stats.total'), value: totals.total, icon: Construction, tone: 'blue', onPress: toInventory },
    { id: 'available', label: t('equipment.stats.available'), value: totals.available, icon: PackageCheck, tone: 'green', onPress: toInventory },
    { id: 'onRent', label: t('equipment.stats.onRent'), value: totals.onRent, icon: Truck, tone: 'orange', onPress: toAssignments('rentals') },
    { id: 'forSale', label: t('equipment.stats.forSale'), value: totals.forSale, icon: ShoppingCart, tone: 'teal', onPress: toInventory },
    { id: 'pending', label: t('equipment.stats.pending'), value: totals.pending, icon: ClipboardList, tone: 'amber', onPress: toRequests },
    { id: 'activeRentals', label: t('equipment.stats.activeRentals'), value: totals.activeRentals, icon: Wrench, tone: 'purple', onPress: toAssignments('rentals') },
    { id: 'completedRentals', label: t('equipment.stats.completedRentals'), value: totals.completedRentals, icon: Undo2, tone: 'sky', onPress: toAssignments('completed') },
    { id: 'completedSales', label: t('equipment.stats.completedSales'), value: totals.completedSales, icon: Package, tone: 'rose', onPress: toAssignments('completed') },
  ]
  const columns = isTablet ? 4 : 2
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
          subtitle={t('equipment.supplier.heroSub')}
        />

        {/* Figures wait for the first load, so they never flash 0. */}
        {itemsStatus === 'idle' || requestsStatus === 'idle' ? (
          <SkeletonStats count={8} width={statWidth} />
        ) : (
          <View style={styles.stats}>
            {stats.map((stat) => <EquipmentStat key={stat.id} stat={stat} width={statWidth} />)}
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
          <Text style={styles.sectionTitle} numberOfLines={2}>{t('equipment.supplier.pendingTitle')}</Text>
          <Pressable onPress={toRequests} style={styles.sectionLink} hitSlop={6} accessibilityRole="button">
            <Text style={styles.sectionLinkText}>{t('ui.requests')}</Text>
            <ChevronRight size={14} color={COLORS.brand[700]} />
          </Pressable>
        </View>
        <EquipmentRequests compact />

        <RecentRequests requests={clientRequests} onOpen={toRequests} />
      </View>
    </DashboardShell>
  )
}

/** One figure card: tone chip, a two-line label and the number (web EquipmentSupplierStatsGrid).
 * Also the Labour dashboard's card (exported as FigureStat). */
export function EquipmentStat({ stat, width }) {
  const [card, chip, border, accent] = TONES[stat.tone] || TONES.blue
  const Icon = stat.icon
  return (
    <Pressable
      onPress={stat.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${stat.label}: ${stat.value}`}
      style={[styles.stat, { width, backgroundColor: soft(card, accent), borderColor: line(border, accent) }]}
    >
      <View style={[styles.statChip, { backgroundColor: softStrong(chip, accent) }]}>
        <Icon size={18} color={ink(accent)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statLabel} numberOfLines={2}>{stat.label}</Text>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{String(stat.value)}</Text>
      </View>
    </Pressable>
  )
}

const styles = createStyles((c) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 11 },
  statChip: { height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  statLabel: { fontSize: 11.5, lineHeight: 15, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  statValue: { marginTop: 1, fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  navRow: { flexDirection: 'row', gap: 10 },
  navCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 13 },
  navIcon: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.brandSoft },
  navText: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  sectionHead: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -2 },
  sectionTitle: { flex: 1, fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionLinkText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
}))

export { EquipmentStat as FigureStat }
