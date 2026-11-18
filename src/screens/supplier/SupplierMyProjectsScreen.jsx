// My Projects for a Material Supplier, opened from the Dashboard: the web
// SupplierMyProjects.
//
// The projects this supplier works on (GET /suppliers/my-projects), each with
// what was ordered for it from this supplier -- the same order rows the Orders
// tab shows (GET /supplier/material-requests), grouped per project with the
// same price × quantity total. Search, requester, status and date narrow the
// list; a project opens into its details and its order lines.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, Modal, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { ArrowRight, FolderKanban, Search, X } from 'lucide-react-native'
import { Section, SelectChip, StackScreenShell } from '../../components/builder/BuilderUi'
import { PanelState } from '../../components/DashboardShell'
import { fetchSupplierMyProjects } from '../../api/projects'
import { fetchSupplierMaterialRequests } from '../../api/materialRequests'
import { useLanguage } from '../../i18n/LanguageContext'
import { userAvatarSource } from '../../utils/avatars'
import { completionPercent, completionText } from '../../utils/builderHelpers'
import { formatDate } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import SheetHeader from './SheetHeader'
import { money, useSupplierCountry } from './products/productParts'
import { StatusPill, lineTotal, statusLabel } from './orders/orderParts'
import { Avatar } from './clients/clientParts'

const PROJECT_STATUS_DOT = { active: '#10b981', pending: '#fbbf24', completed: '#0ea5e9' }
const PROJECT_STATUS_KEYS = { active: 'ui.status.active', pending: 'ui.status.pending', completed: 'ui.status.completed' }
const EMPTY_METRICS = { rows: [], items: 0, products: 0, total: 0 }

// A project is completed exactly when the rest of the app says it is.
function statusOf(project) {
  if (String(project?.status || '').toLowerCase() === 'completed' || Number(project?.completion_percentage || 0) >= 100) return 'completed'
  return String(project?.status || '').toLowerCase() === 'pending' ? 'pending' : 'active'
}

export default function SupplierMyProjectsScreen({ navigation }) {
  const { t, td } = useLanguage()
  const country = useSupplierCountry()
  const [projects, setProjects] = useState([])
  const [orderRows, setOrderRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [requester, setRequester] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [open, setOpen] = useState(null)
  const fmt = (value) => money(value, country)

  const load = useCallback(async () => {
    const [projectResult, orderResult] = await Promise.allSettled([fetchSupplierMyProjects(), fetchSupplierMaterialRequests()])
    if (projectResult.status === 'fulfilled') setProjects(Array.isArray(projectResult.value) ? projectResult.value : [])
    if (orderResult.status === 'fulfilled') setOrderRows(Array.isArray(orderResult.value) ? orderResult.value : [])
    setStatus(projectResult.status === 'fulfilled' ? 'ready' : (current) => (current === 'ready' ? 'ready' : 'error'))
  }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const metricsByProject = useMemo(() => {
    const grouped = {}
    orderRows.forEach((row) => {
      const key = Number(row.project_id)
      if (!grouped[key]) grouped[key] = { rows: [], items: 0, products: new Set(), total: 0 }
      grouped[key].rows.push(row)
      grouped[key].items += 1
      if (row.product_id) grouped[key].products.add(row.product_id)
      grouped[key].total += lineTotal(row)
    })
    return Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, { ...value, products: value.products.size }]))
  }, [orderRows])
  const metricsFor = (project) => metricsByProject[Number(project.project_id)] || EMPTY_METRICS

  // Only requester types that actually occur, so no option leads nowhere.
  const requesterOptions = useMemo(() => {
    const roles = new Set(projects.map((project) => project.requester?.role).filter(Boolean))
    return [
      ...(roles.has('OWNER') ? [{ value: 'OWNER', label: t('role.owner') }] : []),
      ...(roles.has('CONTRACTOR') ? [{ value: 'CONTRACTOR', label: t('role.builder') }] : []),
    ]
  }, [projects, t])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (requester && project.requester?.role !== requester) return false
      if (projectStatus && statusOf(project) !== projectStatus) return false
      if (dateRange) {
        const assigned = project.assigned_on ? new Date(project.assigned_on) : null
        if (!assigned || assigned.getTime() < Date.now() - Number(dateRange) * 86400000) return false
      }
      if (term && ![project.title, project.requester?.name, project.requester?.company_name].some((value) => String(value || '').toLowerCase().includes(term))) return false
      return true
    })
  }, [projects, requester, projectStatus, dateRange, search])

  const requesterLabel = (role) => (role === 'CONTRACTOR' ? t('role.builder') : t('role.owner'))
  const filtered = Boolean(search.trim() || requester || projectStatus || dateRange)

  return (
    <StackScreenShell title={t('ui.myProjects')} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={onRefresh}>
      <Section style={{ gap: 12 }}>
        {status === 'loading' ? <PanelState loading skeleton="cards" /> : status === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Projects could not be loaded.</Text>
            <Pressable onPress={load} style={{ marginTop: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.empty}>
            <FolderKanban size={30} color={COLORS.brand[600]} />
            <Text style={styles.emptyTitle}>{t('dash.supplier.noMyProjects')}</Text>
            <Text style={styles.emptyText}>{t('dash.supplier.noMyProjectsSub')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchBox}>
              <Search size={16} color={COLORS.brand[800]} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('dash.supplier.searchMyProjects')}
                placeholderTextColor={COLORS.slate[400]}
                autoCorrect={false}
                style={styles.searchInput}
              />
              {search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><X size={15} color={COLORS.slate[500]} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <SelectChip placeholder={t('dash.supplier.allRequesters')} value={requester} options={requesterOptions} onChange={setRequester} />
              <SelectChip
                placeholder={t('dash.supplier.allStatus')}
                value={projectStatus}
                options={['active', 'pending', 'completed'].map((value) => ({ value, label: t(PROJECT_STATUS_KEYS[value]) }))}
                onChange={setProjectStatus}
              />
              <SelectChip
                placeholder={t('dash.supplier.allDates')}
                value={dateRange}
                options={[{ value: '30', label: t('dash.supplier.last30Days') }, { value: '90', label: t('dash.supplier.last90Days') }]}
                onChange={setDateRange}
              />
            </ScrollView>

            {visible.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('dash.supplier.noMyProjects')}</Text>
                {filtered ? (
                  <Pressable onPress={() => { setSearch(''); setRequester(''); setProjectStatus(''); setDateRange('') }} style={{ marginTop: 6 }}>
                    <Text style={styles.link}>Clear search and filters</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : visible.map((project) => {
              const role = project.requester?.role
              const state = statusOf(project)
              const company = td(project.requester?.company_name || '')
              return (
                <Pressable key={project.project_id} onPress={() => setOpen(project)} style={styles.card}>
                  <View style={styles.row}>
                    <Avatar source={userAvatarSource(project.requester, role)} size={44} square />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{td(project.requester?.name) || '—'}</Text>
                      {company ? <Text style={styles.company} numberOfLines={1}>{company}</Text> : null}
                      <Text style={styles.sub} numberOfLines={1}>{td(project.title)}</Text>
                    </View>
                  </View>
                  <View style={styles.pills}>
                    <View style={[styles.rolePill, role === 'CONTRACTOR' ? styles.rolePillBuilder : null]}>
                      <Text style={[styles.rolePillText, role === 'CONTRACTOR' ? styles.rolePillTextBuilder : null]}>{requesterLabel(role)}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <View style={[styles.dot, { backgroundColor: PROJECT_STATUS_DOT[state] }]} />
                      <Text style={styles.statusText}>{t(PROJECT_STATUS_KEYS[state])}</Text>
                    </View>
                    <Text style={styles.assigned}>{formatDate(project.assigned_on, '—')}</Text>
                  </View>
                  <View style={styles.cardFoot}>
                    <View>
                      <Text style={styles.footLabel}>{t('dash.supplier.totalValue')}</Text>
                      <Text style={styles.total}>{fmt(metricsFor(project).total)}</Text>
                    </View>
                    <View style={styles.viewButton}>
                      <Text style={styles.viewText}>{t('dash.supplier.viewDetails')}</Text>
                      <ArrowRight size={14} color="#ffffff" />
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </>
        )}
      </Section>

      <ProjectSheet
        project={open}
        metrics={open ? metricsFor(open) : EMPTY_METRICS}
        fmt={fmt}
        requesterLabel={requesterLabel}
        onClose={() => setOpen(null)}
      />
    </StackScreenShell>
  )
}

function ProjectSheet({ project, metrics, fmt, requesterLabel, onClose }) {
  const { t, td } = useLanguage()
  const insets = useSafeAreaInsets()
  if (!project) return null
  const role = project.requester?.role
  const state = statusOf(project)
  const company = td(project.requester?.company_name || '')
  const place = project.address
    ? `${td(project.address)}${project.pincode ? ` - ${project.pincode}` : ''}`
    : project.pincode ? `${t('dash.common.pincode')} ${project.pincode}` : ''
  const facts = [
    [t('dash.supplier.requesterType'), requesterLabel(role)],
    [t('dash.supplier.assignedOn'), formatDate(project.assigned_on, '—')],
    [t('dash.common.status'), t(PROJECT_STATUS_KEYS[state])],
    [t('dash.supplier.totalValue'), fmt(metrics.total)],
    // Completion only once it can be measured.
    ...(completionPercent(project) !== null ? [[t('dash.supplier.completion'), completionText(project, t)]] : []),
  ]
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <SheetHeader title={td(project.title) || t('ui.myProjects')} subtitle={t('dash.supplier.viewDetails')} onBack={onClose} />
        <View style={styles.sheetHead}>
          <Avatar source={userAvatarSource(project.requester, role)} size={48} square />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{td(project.requester?.name) || '—'}</Text>
            {company ? <Text style={styles.company} numberOfLines={1}>{company}</Text> : null}
            <Text style={styles.sub} numberOfLines={2}>{[td(project.title), place].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 12 }}>
          <View style={styles.facts}>
            {facts.map(([label, value]) => (
              <View key={label} style={styles.fact}>
                <Text style={styles.factLabel}>{label}</Text>
                <Text style={styles.factValue}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.sectionLabel}>{t('shop.orderDetails')}</Text>
          <View style={styles.lines}>
            {metrics.rows.length ? metrics.rows.map((row, index) => (
              <View key={row.id} style={[styles.line, index ? styles.lineBorder : null]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.lineName} numberOfLines={2}>{td(row.material_name)}</Text>
                  <Text style={styles.lineMeta}>{`${t('shop.quantity')}: ${row.quantity} ${td(row.unit || '')} · ${t('se.rate')}: ${fmt(row.price)}${row.unit ? `/${td(row.unit)}` : ''}`}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.lineTotal}>{fmt(lineTotal(row))}</Text>
                  <StatusPill status={row.status} label={statusLabel(row.status, t)} />
                </View>
              </View>
            )) : <Text style={[styles.emptyText, { padding: 16 }]}>{t('dash.supplier.material.none')}</Text>}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = createStyles((c) => ({
  searchBox: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  card: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  company: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  sub: { marginTop: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  pills: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  rolePill: { borderRadius: 999, borderWidth: 1, borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft, paddingHorizontal: 9, paddingVertical: 3 },
  rolePillBuilder: { borderColor: c.skyBorder, backgroundColor: c.skySoft },
  rolePillText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.emeraldText },
  rolePillTextBuilder: { color: c.skyText },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: c.subtle, paddingHorizontal: 9, paddingVertical: 3 },
  dot: { height: 6, width: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  assigned: { marginLeft: 'auto', fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textFaint },
  cardFoot: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 10 },
  footLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textMuted },
  total: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, borderRadius: 999, backgroundColor: '#236645', paddingHorizontal: 13 },
  viewText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { marginTop: 4, fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  sheet: { flex: 1, backgroundColor: c.canvas },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 9 },
  factLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  factValue: { marginTop: 3, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  sectionLabel: { marginTop: 4, fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.textFaint },
  lines: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  line: { flexDirection: 'row', gap: 10, padding: 12 },
  lineBorder: { borderTopWidth: 1, borderColor: c.borderSoft },
  lineName: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  lineMeta: { marginTop: 2, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  lineTotal: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
}))
