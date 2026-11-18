// The Site Engineer's Orders (Suppliers > Material > Orders) — port of the web
// pages/engineer/EngineerOrdersPanel.jsx. The same /material-requests/mine feed,
// grouped by request code into one order per checkout, Pending / Previous tabs,
// the filter card (applied with Apply Filters), sort, and the order details with
// Download Invoice. Nothing new is fetched or saved.
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, Share } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import {
  ArrowUpDown, CalendarDays, CheckCircle2, Clock, Download, Eye, FileText, Filter, Hash, Home, MapPin, PackageSearch,
  RefreshCw, Search, Store, XCircle,
} from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchMyMaterialRequests } from '../../api/materialRequests'
import { formatMoney } from '../../utils/countryConfig'
import { formatDate, formatDateTime, formatNumber, formatTime } from '../../utils/formatters'
import { TAB_STATUSES, displayCode, groupOrders, orderStatus } from '../../utils/orderHelpers'
import { SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../i18n/optionKeys'
import { ActionButton, SelectChip, SheetModal } from '../../components/builder/BuilderUi'
import { DateField } from '../../components/form'
import { SmartImage } from './materialParts'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const STATUS_ICONS = { PENDING: Clock, ACCEPTED: CheckCircle2, FULFILLED: CheckCircle2, REJECTED: XCircle }
const STATUS_PILLS = {
  PENDING: ['#fef3c7', '#b45309'],
  ACCEPTED: ['#e0f2fe', '#0369a1'],
  FULFILLED: ['#d1fae5', '#047857'],
  REJECTED: ['#ffe4e6', '#be123c'],
}
const EMPTY_FILTERS = { status: 'ALL', fromDate: '', toDate: '', category: 'ALL', supplierId: 'ALL', projectId: 'ALL' }
const SORTS = ['newest', 'oldest', 'highest', 'lowest']
const SORT_KEYS = { newest: 'shop.sortNewest', oldest: 'shop.sortOldest', highest: 'shop.sortHighest', lowest: 'shop.sortLowest' }

function StatusPill({ status }) {
  const { t } = useLanguage()
  const [bg, fg] = STATUS_PILLS[status] || STATUS_PILLS.PENDING
  const Icon = STATUS_ICONS[status] || Clock
  return (
        <View style={[styles.statusPill, { backgroundColor: soft(bg, fg) }]}>
      <Icon size={12} color={ink(fg)} />
      <Text style={[styles.statusText, { color: ink(fg) }]}>{t(`shop.status.${String(status).toLowerCase()}`)}</Text>
    </View>
  )
}

function Fact({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}><Icon size={14} color={COLORS.brand[700]} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

/** Everything about one order (web OrderDetailCard). */
function OrderDetail({ order, onClose }) {
  const { t, td } = useLanguage()
  if (!order) return null
  const lineTotal = (item) => Number(item.price || 0) * Number(item.quantity || 0)
  const total = order.items.reduce((sum, item) => sum + lineTotal(item), 0)
  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const money = (value) => formatMoney(value)

  // The web downloads an .html invoice; here it is written to the app's cache and shared.
  const downloadInvoice = async () => {
    const escape = (value) => String(value ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
    const rows = order.items.map((item) => `<tr><td>${escape(td(item.material_name))}</td><td class="n">${escape(item.quantity)} ${escape(td(item.unit || ''))}</td><td class="n">${escape(money(item.price))}</td><td class="n">${escape(money(lineTotal(item)))}</td></tr>`).join('')
    const meta = [
      order.supplier ? [t('shop.soldBy'), td(order.supplier)] : null,
      order.project ? [t('dash.common.project'), td(order.project)] : null,
      order.placedAt ? [t('dash.common.date'), formatDate(order.placedAt)] : null,
      order.code ? [t('shop.orderCode'), order.code] : null,
    ].filter(Boolean).map(([label, value]) => `<p><b>${escape(label)}:</b> ${escape(value)}</p>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(t('shop.orderDetails'))} ${escape(order.code || '')}</title>
<style>body{font-family:system-ui,Arial,sans-serif;color:#0f172a;margin:32px}h1{font-size:20px;margin:0 0 16px}p{margin:2px 0;font-size:13px}
table{border-collapse:collapse;width:100%;margin-top:18px;font-size:13px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}.n{text-align:right}tfoot td{font-weight:700}</style></head><body>
<h1>${escape(t('shop.orderDetails'))}</h1>${meta}<table><thead><tr><th>${escape(t('dash.supplier.product'))}</th><th class="n">${escape(t('dash.common.quantity'))}</th><th class="n">${escape(t('dash.supplier.price'))}</th><th class="n">${escape(t('shop.estimatedTotal'))}</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td colspan="3">${escape(t('shop.estimatedTotal'))}</td><td class="n">${escape(money(total))}</td></tr></tfoot></table></body></html>`
    const name = `${t('shop.invoiceFilename')}-${String(order.code || '').replace(/[^A-Za-z0-9_-]+/g, '-') || 'order'}.html`.replace(/[^\w.-]+/g, '-')
    try {
      if (await Sharing.isAvailableAsync()) {
        const file = new File(Paths.cache, name)
        if (file.exists) file.delete()
        file.create()
        file.write(html)
        await Sharing.shareAsync(file.uri, { mimeType: 'text/html', UTI: 'public.html', dialogTitle: name })
        return
      }
    } catch {
      // fall back to sharing the text
    }
    await Share.share({ title: name, message: html })
  }

  return (
    <SheetModal
      visible
      tall
      title={`${formatNumber(order.items.length)} ${order.items.length === 1 ? t('shop.itemOne') : t('shop.itemMany')}`}
      subtitle={t('shop.orderDetails')}
      onClose={onClose}
      footer={<ActionButton tone="outline" icon={Download} label={t('shop.downloadInvoice')} onPress={downloadInvoice} />}
    >
      <View style={{ marginBottom: 10, flexDirection: 'row' }}><StatusPill status={order.status} /></View>
      <View style={{ gap: 8 }}>
        <Fact icon={Store} label={t('shop.soldBy')} value={td(order.supplier)} />
        <Fact icon={Home} label={t('shop.deliverToProject')} value={td(order.project)} />
        <Fact icon={CalendarDays} label={t('shop.placedOn')} value={formatDateTime(order.placedAt)} />
        <Fact icon={Hash} label={t('shop.orderReference')} value={String(order.code || '').slice(0, 8)} />
      </View>
      <Text style={styles.eyebrow}>{t('shop.itemsOrdered')}</Text>
      <View style={styles.items}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <SmartImage src={item.image_url} style={styles.itemImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>{td(item.material_name)}</Text>
              <Text style={styles.meta} numberOfLines={1}>{td([item.brand, item.size].filter(Boolean).join(' · ')) || optionLabel(t, SUPPLIER_CATEGORY_KEYS, item.category)}</Text>
              <Text style={styles.meta}>{`${money(item.price)} ${t('dash.supplier.per')} ${td(item.unit)}`}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.itemName}>{`${formatNumber(item.quantity)} ${td(item.unit)}`}</Text>
              <Text style={styles.meta}>{money(lineTotal(item))}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.meta}>{t('shop.totalQuantity')}</Text><Text style={styles.itemName}>{formatNumber(totalQuantity)}</Text></View>
        <View style={[styles.totalRow, styles.totalGrand]}><Text style={styles.itemName}>{t('shop.estimatedTotal')}</Text><Text style={styles.grand}>{money(total)}</Text></View>
      </View>
    </SheetModal>
  )
}

export default function EngineerOrdersPanel({ projectId }) {
  const { t, td } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openCode, setOpenCode] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('pending')
  const [sort, setSort] = useState('newest')
  // The filter row is edited as a draft and takes effect on Apply Filters.
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const seq = useRef(0)
  const load = ({ quiet = false } = {}) => {
    seq.current += 1
    const mine = seq.current
    if (!quiet) setLoading(true)
    fetchMyMaterialRequests(projectId)
      .then((data) => { if (mine === seq.current) setRows(Array.isArray(data) ? data : []) })
      .catch(() => { if (mine === seq.current && !quiet) setRows([]) })
      .finally(() => { if (mine === seq.current) setLoading(false) })
  }

  useEffect(() => {
    setDraft((current) => ({ ...current, supplierId: 'ALL', projectId: 'ALL' }))
    setFilters((current) => ({ ...current, supplierId: 'ALL', projectId: 'ALL' }))
    load()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  // The supplier accepting, rejecting or fulfilling an order sends a live hint.
  useLiveRefresh(() => load({ quiet: true }))

  const orders = useMemo(() => groupOrders(rows).map((order) => ({
    ...order,
    projectId: order.items[0]?.project_id ?? null,
    city: order.items[0]?.project_city || order.items[0]?.project_pincode || '',
  })), [rows])
  const shownOrder = useMemo(() => {
    const order = openCode ? orders.find((item) => item.code === openCode) : null
    return order ? { ...order, status: orderStatus(order.items) } : null
  }, [openCode, orders])

  // Every dropdown lists only what the orders on screen actually carry.
  const options = useMemo(() => {
    const suppliers = new Map()
    const projects = new Map()
    const categories = new Set()
    orders.forEach((order) => {
      if (order.supplierId != null && !suppliers.has(order.supplierId)) suppliers.set(order.supplierId, order.supplier)
      if (order.projectId != null && !projects.has(order.projectId)) projects.set(order.projectId, order.project)
      order.items.forEach((item) => { if (item.category) categories.add(item.category) })
    })
    const byName = (a, b) => String(a.name).localeCompare(String(b.name))
    return {
      suppliers: [...suppliers].map(([id, name]) => ({ id, name })).sort(byName),
      projects: [...projects].map(([id, name]) => ({ id, name })).sort(byName),
      categories: [...categories].sort(),
    }
  }, [orders])
  const categoryLabel = (value) => {
    const label = optionLabel(t, SUPPLIER_CATEGORY_KEYS, value)
    return label === value ? td(value) : label
  }

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : null
    const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59`) : null
    const matching = orders.filter((order) => {
      const state = orderStatus(order.items)
      if (!TAB_STATUSES[tab].includes(state)) return false
      if (filters.status !== 'ALL' && state !== filters.status) return false
      if (filters.supplierId !== 'ALL' && String(order.supplierId) !== filters.supplierId) return false
      if (filters.projectId !== 'ALL' && String(order.projectId) !== filters.projectId) return false
      if (filters.category !== 'ALL' && !order.items.some((item) => item.category === filters.category)) return false
      if (from || to) {
        const placed = order.placedAt ? new Date(order.placedAt) : null
        if (!placed) return false
        if (from && placed < from) return false
        if (to && placed > to) return false
      }
      if (!needle) return true
      const haystack = [order.supplier, order.project, order.code, displayCode(order.code), ...order.items.flatMap((item) => [item.material_name, item.brand])]
      return haystack.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
    const byDate = (a, b) => String(b.placedAt).localeCompare(String(a.placedAt))
    if (sort === 'oldest') return [...matching].sort((a, b) => -byDate(a, b))
    if (sort === 'highest') return [...matching].sort((a, b) => b.total - a.total)
    if (sort === 'lowest') return [...matching].sort((a, b) => a.total - b.total)
    return [...matching].sort(byDate)
  }, [orders, tab, search, filters, sort])

  const countFor = (tabId) => orders.filter((order) => TAB_STATUSES[tabId].includes(orderStatus(order.items))).length
  const switchTab = (tabId) => {
    setTab(tabId)
    setDraft((current) => ({ ...current, status: 'ALL', supplierId: 'ALL' }))
    setFilters((current) => ({ ...current, status: 'ALL', supplierId: 'ALL' }))
  }
  const setDraftField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value || 'ALL' }))
  const setDraftDate = (field) => (value) => setDraft((current) => ({ ...current, [field]: value || '' }))
  const clearAll = () => { setSearch(''); setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS) }
  const reverseSort = () => setSort((current) => ({ newest: 'oldest', oldest: 'newest', highest: 'lowest', lowest: 'highest' })[current])
  const chipValue = (value) => (value === 'ALL' ? '' : value)
  const allOption = { value: 'ALL', label: t('shop.eo.all') }
  const tabs = [
    { id: 'pending', label: t('shop.eo.pendingTab'), icon: Clock, count: countFor('pending') },
    { id: 'previous', label: t('shop.eo.previousTab'), icon: FileText, count: countFor('previous') },
  ]

  return (
    <View style={styles.panel}>
      {/* Pending / Previous */}
      <View style={styles.tabs}>
        {tabs.map((item) => {
          const active = item.id === tab
          const Icon = item.icon
          return (
            <Pressable key={item.id} onPress={() => switchTab(item.id)} style={[styles.tab, active ? styles.tabOn : null]}>
              <Icon size={15} color={active ? COLORS.brand[700] : COLORS.slate[500]} />
              <Text style={[styles.tabText, active ? styles.tabTextOn : null]}>{item.label}</Text>
              <View style={[styles.tabCount, active ? styles.tabCountOn : null]}><Text style={[styles.tabCountText, active ? { color: '#ffffff' } : null]}>{formatNumber(item.count)}</Text></View>
            </Pressable>
          )
        })}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <View style={styles.search}>
          <Search size={15} color={COLORS.slate[400]} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('shop.eo.searchPlaceholder')} placeholderTextColor={COLORS.slate[400]} style={styles.searchInput} />
        </View>
        <View style={styles.chipRow}>
          <SelectChip placeholder={t('shop.eo.orderStatus')} value={chipValue(draft.status)} onChange={setDraftField('status')}
            options={[allOption, ...TAB_STATUSES[tab].map((item) => ({ value: item, label: t(`shop.status.${item.toLowerCase()}`) }))]} />
          <SelectChip placeholder={t('shop.eo.productCategory')} value={chipValue(draft.category)} onChange={setDraftField('category')}
            options={[allOption, ...options.categories.map((item) => ({ value: item, label: categoryLabel(item) }))]} />
          <SelectChip placeholder={t('shop.eo.supplier')} value={chipValue(draft.supplierId)} onChange={setDraftField('supplierId')}
            options={[allOption, ...options.suppliers.map((item) => ({ value: String(item.id), label: td(item.name) }))]} />
          <SelectChip placeholder={t('dash.common.project')} value={chipValue(draft.projectId)} onChange={setDraftField('projectId')}
            options={[allOption, ...options.projects.map((item) => ({ value: String(item.id), label: td(item.name) }))]} />
        </View>
        <View style={styles.dates}>
          <DateField label={`${t('shop.eo.orderDate')} · ${t('shop.from')}`} value={draft.fromDate} max={draft.toDate || undefined} onChange={setDraftDate('fromDate')} containerStyle={{ flex: 1, marginBottom: 0 }} />
          <DateField label={`${t('shop.eo.orderDate')} · ${t('shop.to')}`} value={draft.toDate} min={draft.fromDate || undefined} onChange={setDraftDate('toDate')} containerStyle={{ flex: 1, marginBottom: 0 }} />
        </View>
        <View style={styles.filterActions}>
          <ActionButton small icon={Filter} label={t('shop.eo.applyFilters')} onPress={() => setFilters(draft)} style={{ flex: 1 }} />
          <ActionButton small tone="outline" label={t('shop.eo.clear')} onPress={clearAll} />
        </View>
      </View>

      {/* Orders */}
      <View style={styles.listHead}>
        <Text style={[styles.meta, { flex: 1 }]}>
          {t(tab === 'pending' ? 'shop.eo.showingPending' : 'shop.eo.showingPrevious', {
            from: formatNumber(visibleOrders.length ? 1 : 0), to: formatNumber(visibleOrders.length), total: formatNumber(visibleOrders.length),
          })}
        </Text>
        <SelectChip placeholder={t('shop.eo.sortBy')} value={sort} onChange={(value) => setSort(value || 'newest')} options={SORTS.map((id) => ({ value: id, label: t(SORT_KEYS[id]) }))} />
        <Pressable onPress={reverseSort} accessibilityLabel={t('shop.eo.reverseSort')} style={styles.iconButton}><ArrowUpDown size={15} color={COLORS.slate[600]} /></Pressable>
        <Pressable onPress={() => load()} accessibilityLabel={t('dash.engineer.refresh')} style={styles.iconButton}><RefreshCw size={15} color={COLORS.slate[600]} /></Pressable>
      </View>

      {loading ? (
        <Text style={styles.loading}>{t('shop.loading')}</Text>
      ) : !visibleOrders.length ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><PackageSearch size={20} color={COLORS.brand[700]} /></View>
          <Text style={styles.emptyTitle}>{orders.length ? t('shop.noMatchingOrders') : t('shop.noOrders')}</Text>
          <Text style={styles.emptyHint}>{orders.length ? t('shop.clearFilters') : t('shop.noOrdersHint')}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {visibleOrders.map((order) => {
            const status = orderStatus(order.items)
            const first = order.items[0] || {}
            const extra = order.items.length - 1
            const detail = [first.brand, first.size].filter(Boolean).join(' ') || first.subcategory_name || (first.category ? categoryLabel(first.category) : '')
            return (
              <Pressable key={order.code} onPress={() => setOpenCode(order.code)} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{displayCode(order.code)}</Text>
                    <Text style={styles.meta}>{`${formatDate(order.placedAt)} · ${formatTime(order.placedAt)}`}</Text>
                  </View>
                  <StatusPill status={status} />
                </View>
                <View style={styles.cardProduct}>
                  <SmartImage src={first.image_url} style={styles.productImage} contentFit="cover" iconSize={16} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{td(first.material_name)}</Text>
                    {detail ? <Text style={styles.meta} numberOfLines={1}>{td(detail)}</Text> : null}
                    {extra > 0 ? <Text style={styles.more}>{t('shop.eo.moreItems', { count: formatNumber(extra) })}</Text> : null}
                  </View>
                </View>
                <View style={styles.cardGrid}>
                  <View style={styles.cell}><Text style={styles.cellLabel}>{t('shop.eo.supplier')}</Text><Text style={styles.cellValue} numberOfLines={1}>{td(order.supplier)}</Text></View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>{t('dash.common.project')}</Text>
                    <Text style={styles.cellValue} numberOfLines={1}>{td(order.project)}</Text>
                    {order.city ? <View style={styles.inline}><MapPin size={11} color={COLORS.slate[500]} /><Text style={styles.meta} numberOfLines={1}>{td(order.city)}</Text></View> : null}
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>{t('shop.eo.quantity')}</Text>
                    <Text style={styles.cellValue}>{order.items.length === 1 ? `${formatNumber(first.quantity)} ${first.unit || ''}`.trim() : `${formatNumber(order.items.length)} ${t('shop.itemMany')}`}</Text>
                  </View>
                  <View style={styles.cell}><Text style={styles.cellLabel}>{t('shop.eo.amount')}</Text><Text style={styles.cellValue}>{formatMoney(order.total)}</Text></View>
                </View>
                <View style={styles.viewRow}>
                  <View style={styles.viewButton}><Eye size={13} color={COLORS.slate[700]} /><Text style={styles.viewText}>{t('shop.eo.view')}</Text></View>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}

      <OrderDetail order={shownOrder} onClose={() => setOpenCode(null)} />
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabs: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderColor: c.borderSoft },
  tab: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottomWidth: 3, borderColor: 'transparent' },
  tabOn: { borderColor: '#236645' },
  tabText: { fontSize: 13, fontWeight: '700', color: c.textMuted },
  tabTextOn: { color: c.brandTextStrong },
  tabCount: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: c.subtle, paddingHorizontal: 5 },
  tabCountOn: { backgroundColor: '#236645' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: c.textMuted },
  filters: { gap: 10, borderBottomWidth: 1, borderColor: c.borderSoft, paddingBottom: 12 },
  search: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dates: { flexDirection: 'row', gap: 8 },
  filterActions: { flexDirection: 'row', gap: 8 },
  listHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  iconButton: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  loading: { overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, padding: 24, textAlign: 'center', fontSize: 13, fontWeight: '600', color: c.textMuted },
  empty: { alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: c.subtle, padding: 24 },
  emptyIcon: { height: 46, width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: c.brandSoft },
  emptyTitle: { marginTop: 6, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: c.text },
  emptyHint: { textAlign: 'center', fontSize: 13, fontWeight: '500', color: c.textMuted },
  card: { gap: 10, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  code: { fontSize: 14, fontWeight: '800', color: c.text },
  cardProduct: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productImage: { height: 44, width: 44, borderRadius: 8, borderWidth: 1, borderColor: c.borderSoft },
  more: { fontSize: 11, fontWeight: '700', color: c.brandText },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 8 },
  cell: { width: '50%', paddingRight: 6 },
  cellLabel: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  cellValue: { fontSize: 13, fontWeight: '700', color: c.text },
  viewRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewButton: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10 },
  viewText: { fontSize: 12, fontWeight: '700', color: c.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  meta: { fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  eyebrow: { marginTop: 14, marginBottom: 6, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8 },
  factIcon: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  factLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  factValue: { fontSize: 13.5, fontWeight: '800', color: c.text },
  items: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.borderSoft, padding: 10 },
  itemImage: { height: 56, width: 56, borderRadius: 10, backgroundColor: c.subtle },
  itemName: { fontSize: 13, fontWeight: '800', color: c.text },
  totals: { marginTop: 12, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalGrand: { borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 6 },
  grand: { fontFamily: 'Manrope_800ExtraBold', fontSize: 19, color: c.text },
}))