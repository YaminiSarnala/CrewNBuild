// A Material Supplier's Dashboard home (the web SupplierDashboard's
// "Dashboard" section):
//
//   welcome banner      the store's logo and name; a nudge while no product is published
//   four figure cards   requests, nearby clients, products, categories
//   My Projects / Find Clients   the supplier has no More tab, so they open from here
//   search              requests, projects and clients matching the words
//   Recent Activity, Top Products, Quick Actions, Recent Requests, Sales Overview
//
// Every figure comes from records loaded here: the supplier's listings, orders
// (GET /supplier/material-requests), client requests, projects and nearby clients.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Building2, ChevronRight, FileText, Package, Search, Tags, UserSearch, Users, X } from 'lucide-react-native'
import DashboardShell from '../../components/DashboardShell'
import { SkeletonStats } from '../../components/Skeleton'
import { StatCard, WelcomeBanner } from '../../components/builder/BuilderDashboardParts'
import { fetchSupplierMaterialRequests } from '../../api/materialRequests'
import { fetchIncomingRequests } from '../../api/requests'
import { fetchSupplierClients } from '../../api/profiles'
import { fetchSupplierMyProjects } from '../../api/projects'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { userCountry } from '../../utils/countryConfig'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { useSupplier } from './SupplierContext'
import { money, useSupplierListings } from './products/productParts'
import { QuickActions, RecentActivity, RecentRequests, SalesOverview, SearchResults, TopProducts } from './dashboard/dashboardParts'

// Records created in the last seven days, from the stored `created_at`.
const createdThisWeek = (list) => {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  return list.filter((item) => item.created_at && new Date(item.created_at).getTime() >= since).length
}

export default function SupplierDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const country = userCountry(user)
  const { gutter, width, maxContentWidth, isTablet } = useResponsive()
  const { profile } = useSupplier()
  const { products, status: productsStatus, reload: reloadProducts } = useSupplierListings()
  const [orders, setOrders] = useState([])
  const [requests, setRequests] = useState([])
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')

  // Each source loads on its own: one failing never blanks the others.
  const load = useCallback(async () => {
    const [orderResult, requestResult, projectResult, clientResult] = await Promise.allSettled([
      fetchSupplierMaterialRequests(),
      fetchIncomingRequests(),
      fetchSupplierMyProjects(),
      fetchSupplierClients(userCountry(user)),
      reloadProducts(),
    ])
    if (orderResult.status === 'fulfilled') setOrders(Array.isArray(orderResult.value) ? orderResult.value : [])
    if (requestResult.status === 'fulfilled') setRequests(Array.isArray(requestResult.value) ? requestResult.value : [])
    if (projectResult.status === 'fulfilled') setProjects(Array.isArray(projectResult.value) ? projectResult.value : [])
    if (clientResult.status === 'fulfilled') setClients(Array.isArray(clientResult.value) ? clientResult.value : [])
  }, [user, reloadProducts])
  useFocusEffect(useCallback(() => { load() }, [load]))
  useLiveRefresh(load)

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Nearby clients not yet linked to this supplier by a request (as Find Clients shows them).
  const discoverable = useMemo(() => {
    const linked = new Set()
    requests.forEach((request) => {
      if (request.status === 'withdrawn') return
      const other = request.is_sender ? request.receiver_id : request.sender_id
      if (['SUPPLIER_TO_OWNER', 'OWNER_TO_SUPPLIER'].includes(request.request_type)) linked.add(`OWNER:${other}`)
      else if (['SUPPLIER_TO_CONTRACTOR', 'CONTRACTOR_TO_SUPPLIER'].includes(request.request_type)) linked.add(`CONTRACTOR:${other}`)
    })
    return clients.filter((client) => !linked.has(`${client.type}:${client.user_id}`))
  }, [clients, requests])

  const openTab = (name) => navigation.navigate(name)
  const fmt = (value) => money(value, country)
  const published = products.filter((product) => product.is_published !== false).length
  const storeName = profile?.store_name || user?.name || t('role.supplier')

  const stats = [
    { title: t('dash.supplier.statRequests'), value: requests.length, sub: t('dash.sup.newThisWeek', { count: createdThisWeek(requests) }), icon: FileText, theme: 'blue', onPress: () => openTab('SupplierRequestsTab') },
    { title: t('dash.supplier.statClients'), value: discoverable.length, sub: ' ', icon: Users, theme: 'purple', onPress: () => navigation.navigate('SupplierFindClients') },
    { title: t('dash.supplier.statProducts'), value: products.length, sub: t('dash.sup.newThisWeek', { count: createdThisWeek(products) }), icon: Package, theme: 'green', onPress: () => openTab('SupplierProductsTab') },
    { title: t('dash.supplier.statCategories'), value: new Set(products.map((product) => product.category)).size, sub: ' ', icon: Tags, theme: 'orange', onPress: () => openTab('SupplierProductsTab') },
  ]
  const columns = isTablet ? 4 : 2
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  // Rounded down so two cards always fit one row on every screen density.
  const statWidth = Math.floor((inner - 10 * (columns - 1)) / columns)

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 14 }}>
        <WelcomeBanner
          // The store logo leads: this banner is the shop's own front.
          imagePath={profile?.store_logo_url || user?.profile_image_url || ''}
          role="SUPPLIER"
          name={storeName}
          title={t('dash.supplier.hero.welcome', { name: `, ${td(user?.name) || storeName}` })}
          subtitle={t('dash.supplier.hero.sub')}
        />
        {published === 0 ? (
          <Pressable onPress={() => navigation.navigate('SupplierAddProduct')} style={styles.nudge}>
            <Text style={styles.nudgeText}>{t('dash.supplier.hero.noProducts', { name: td(user?.name) || storeName })}</Text>
          </Pressable>
        ) : null}

        {/* Figures wait for the first load, so they never flash 0. */}
        {productsStatus === 'idle' ? (
          <SkeletonStats count={4} width={statWidth} />
        ) : (
          <View style={styles.stats}>
            {stats.map((stat) => (
              <StatCard key={stat.title} style={{ width: statWidth }} title={stat.title} value={String(stat.value)} sub={stat.sub} theme={stat.theme} icon={stat.icon} onPress={stat.onPress} />
            ))}
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

        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.slate[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`${t('ui.requests')}, ${t('ui.myProjects')}, ${t('ui.findClients')}`}
            placeholderTextColor={COLORS.slate[400]}
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search"><X size={15} color={COLORS.slate[500]} /></Pressable> : null}
        </View>
        {query.trim() ? (
          <SearchResults
            query={query.trim()}
            requests={requests}
            projects={projects}
            clients={discoverable}
            onRequests={() => openTab('SupplierRequestsTab')}
            onProjects={() => navigation.navigate('SupplierMyProjects')}
            onClients={() => navigation.navigate('SupplierFindClients')}
          />
        ) : null}

        <RecentActivity orders={orders} products={products} projects={projects} onViewAll={() => openTab('SupplierOrdersTab')} />
        <TopProducts orders={orders} money={fmt} onViewAll={() => openTab('SupplierProductsTab')} />
        <QuickActions
          onAddProduct={() => navigation.navigate('SupplierAddProduct')}
          onProducts={() => openTab('SupplierProductsTab')}
          onFindClients={() => navigation.navigate('SupplierFindClients')}
          onRequests={() => openTab('SupplierRequestsTab')}
        />
        <RecentRequests requests={requests} onOpen={() => openTab('SupplierRequestsTab')} />
        <SalesOverview orders={orders} money={fmt} onOrders={() => openTab('SupplierOrdersTab')} />
      </View>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  nudge: { borderRadius: 14, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 14, paddingVertical: 10 },
  nudgeText: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
  navCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 13 },
  navIcon: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.brandSoft },
  navText: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  searchBox: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: '100%', fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text },
}))
