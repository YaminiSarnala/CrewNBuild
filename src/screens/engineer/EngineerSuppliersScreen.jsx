// The Site Engineer's supplier area — port of the web
// pages/engineer/EngineerSupplierHub.jsx. Opens on a choice of supplier type:
//   Store      the builder's Store Manager's products, a cart and the request
//              to that Store Manager (never to a supplier)
//   Material   Suppliers (all the Builder accepted), Product Catalog, Orders
//   Labor      the Labor panel
//   Equipment  the Equipment panel
// Another screen can open a type or tab: navigate('EngineerSuppliersTab', { tab }),
// tab = 'home' | 'store' | 'cart' | 'suppliers' | 'catalog' | 'orders' | 'labor' | 'equipment'.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import { ArrowLeft, Boxes, ChevronRight, Construction, HardHat, PackageSearch, Search, ShoppingBag, Warehouse } from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { Section } from '../../components/builder/BuilderUi'
import { useLanguage } from '../../i18n/LanguageContext'
import { fetchEngineerProjects } from '../../api/engineers'
import { fetchSiteStores } from '../../api/store'
import { soft, line, ink } from '../../theme/tint'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import EngineerStorePanel from './EngineerStorePanel'
import EngineerLaborPanel from './EngineerLaborPanel'
import EngineerEquipmentPanel from './EngineerEquipmentPanel'
import EngineerMaterialSuppliers from './EngineerMaterialSuppliers'
import EngineerProductCatalog from './EngineerProductCatalog'
import EngineerOrdersPanel from './EngineerOrdersPanel'

const MATERIAL_TABS = ['suppliers', 'catalog', 'orders']
export const supplierTypeOfTab = (tab) => {
  if (tab === 'labor') return 'labor'
  if (tab === 'equipment') return 'equipment'
  // A Site Engineer's material request is a store request.
  if (tab === 'store' || tab === 'cart') return 'store'
  if (MATERIAL_TABS.includes(tab)) return 'material'
  return null
}

const MATERIAL_TAB_ITEMS = [
  { id: 'suppliers', labelKey: 'ui.suppliers', icon: PackageSearch },
  { id: 'catalog', labelKey: 'ui.productCatalog', icon: Boxes },
  { id: 'orders', labelKey: 'shop.orders', icon: ShoppingBag },
]

const SUPPLIER_TYPES = [
  { id: 'store', tab: 'store', icon: Boxes, labelKey: 'store.engineer.type', subKey: 'store.engineer.typeSub', tone: ['#f5f3ff', '#6d28d9', '#ede9fe'] },
  { id: 'material', tab: 'suppliers', icon: Warehouse, labelKey: 'dash.engineer.suppliers.type.material', subKey: 'dash.engineer.suppliers.type.materialSub', tone: ['#f0f6f2', '#1a5038', '#d9ebe0'] },
  { id: 'labor', tab: 'labor', icon: HardHat, labelKey: 'dash.engineer.suppliers.type.labor', subKey: 'dash.engineer.suppliers.type.laborSub', tone: ['#fffbeb', '#b45309', '#fef3c7'] },
  { id: 'equipment', tab: 'equipment', icon: Construction, labelKey: 'dash.engineer.suppliers.type.equipment', subKey: 'dash.engineer.suppliers.type.equipmentSub', tone: ['#f0f9ff', '#0369a1', '#e0f2fe'] },
]

function TypeIcon({ type, size = 48 }) {
  const [bg, fg, border] = type.tone
  const Icon = type.icon
  return (
    <View style={[styles.typeIcon, { width: size, height: size, backgroundColor: soft(bg, fg), borderColor: line(border, fg) }]}>
      <Icon size={size / 2} color={ink(fg)} />
    </View>
  )
}

export default function EngineerSuppliersScreen({ navigation, route }) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'home')
  const requestedTab = route?.params?.tab
  useEffect(() => {
    if (!requestedTab) return
    setActiveTab(requestedTab)
    navigation.setParams?.({ tab: undefined })
  }, [requestedTab, navigation])

  const projects = useAsyncData(fetchEngineerProjects, [])
  const projectList = Array.isArray(projects.data) ? projects.data : []
  // undefined = not picked yet: follow the first project loaded.
  const [selectedProjectId, setSelectedProjectId] = useState(undefined)
  const effectiveProjectId = selectedProjectId === undefined ? (projectList[0]?.id ?? null) : selectedProjectId

  // A Labor or Equipment supplier's card (Material Suppliers) opens its own tab;
  // for Equipment the panel starts with that supplier unfolded.
  const [equipmentSupplierToOpen, setEquipmentSupplierToOpen] = useState(null)
  const openSupplierTab = (tab, supplierId) => {
    if (tab === 'equipment') setEquipmentSupplierToOpen(supplierId)
    setActiveTab(tab)
  }

  // The Material Suppliers search, drawn in the tab row.
  const [materialSearch, setMaterialSearch] = useState('')

  const [stores, setStores] = useState([])
  const projectKey = projectList.map((project) => project.id).join(',')
  const reloadStores = useCallback(() => fetchSiteStores().then((list) => setStores(Array.isArray(list) ? list : [])).catch(() => setStores([])), [])
  useEffect(() => { reloadStores() }, [reloadStores, projectKey])

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async () => {
    setRefreshing(true)
    try { await Promise.all([projects.reload(), reloadStores()]) } finally { setRefreshing(false) }
  }

  const supplierType = supplierTypeOfTab(activeTab)
  const typeInfo = SUPPLIER_TYPES.find((type) => type.id === supplierType)
  const panelProps = { projects: projectList, activeProjectId: effectiveProjectId, onProjectChange: setSelectedProjectId }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Section>
        {!typeInfo ? (
          // ------------------------------------------------ landing
          <View style={styles.landing}>
            {SUPPLIER_TYPES.map((type) => (
              <Pressable key={type.id} onPress={() => setActiveTab(type.tab)} style={styles.typeCard}>
                <TypeIcon type={type} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle} numberOfLines={1}>{t(type.labelKey)}</Text>
                  <Text style={styles.typeSub}>{t(type.subKey)}</Text>
                </View>
                <ChevronRight size={16} color={COLORS.slate[400]} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {/* The open type's heading, with the way back to the choices. */}
            <View style={styles.typeHeader}>
              <Pressable onPress={() => setActiveTab('home')} accessibilityLabel={t('dash.engineer.suppliers.type.allTypes')} style={styles.backButton}>
                <ArrowLeft size={14} color={COLORS.slate[600]} />
                <Text style={styles.backText}>{t('dash.engineer.suppliers.type.allTypes')}</Text>
              </Pressable>
              <TypeIcon type={typeInfo} size={32} />
              <Text style={styles.headerTitle} numberOfLines={1}>{t(typeInfo.labelKey)}</Text>
            </View>

            {supplierType === 'store' ? <EngineerStorePanel {...panelProps} stores={stores} onStoresChanged={reloadStores} /> : null}
            {supplierType === 'labor' ? <EngineerLaborPanel {...panelProps} /> : null}
            {supplierType === 'equipment' ? <EngineerEquipmentPanel {...panelProps} openSupplierOnLoad={equipmentSupplierToOpen} /> : null}
            {supplierType === 'material' ? (
              <View style={{ gap: 10 }}>
                {/* Suppliers / Product Catalog / Orders, with the supplier search beside them. */}
                <View style={styles.materialBar}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {MATERIAL_TAB_ITEMS.map((item) => {
                      const active = activeTab === item.id
                      const Icon = item.icon
                      return (
                        <Pressable key={item.id} onPress={() => setActiveTab(item.id)} style={[styles.materialTab, active ? styles.materialTabOn : null]}>
                          <Icon size={15} color={active ? '#ffffff' : COLORS.slate[500]} />
                          <Text style={[styles.materialTabText, active ? styles.materialTabTextOn : null]}>{t(item.labelKey)}</Text>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                  {activeTab === 'suppliers' ? (
                    <View style={styles.search}>
                      <Search size={15} color={COLORS.slate[400]} />
                      <TextInput
                        value={materialSearch}
                        onChangeText={setMaterialSearch}
                        accessibilityLabel={t('dash.engineer.suppliers.searchSupplier')}
                        placeholder={t('dash.engineer.suppliers.searchPlaceholder')}
                        placeholderTextColor={COLORS.slate[400]}
                        style={styles.searchInput}
                      />
                    </View>
                  ) : null}
                </View>
                {activeTab === 'suppliers' ? <EngineerMaterialSuppliers projects={projectList} search={materialSearch} onOpenSupplierTab={openSupplierTab} /> : null}
                {activeTab === 'catalog' ? <EngineerProductCatalog projects={projectList} /> : null}
                {activeTab === 'orders' ? <EngineerOrdersPanel projectId={effectiveProjectId} /> : null}
              </View>
            ) : null}
          </View>
        )}
      </Section>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  landing: { gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  typeIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  typeTitle: { fontSize: 14, fontWeight: '800', color: c.text },
  typeSub: { marginTop: 2, fontSize: 12, fontWeight: '600', lineHeight: 16, color: c.textMuted },
  typeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 9 },
  backButton: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 9 },
  backText: { fontSize: 11.5, fontWeight: '800', color: c.textSoft },
  materialBar: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 6 },
  materialTab: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 14 },
  materialTabOn: { backgroundColor: '#236645' },
  materialTabText: { fontSize: 12.5, fontWeight: '800', color: c.textMuted },
  materialTabTextOn: { color: '#ffffff' },
  search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  headerTitle: { flex: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
}))