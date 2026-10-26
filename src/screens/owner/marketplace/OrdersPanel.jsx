// Port of the web components/shop/OrdersPanel.jsx and OrderDetailCard.jsx.
//
// Buy requests are grouped by the request code they were sent under, so one
// checkout reads as one order rather than a row per material. Pending covers
// everything still in flight; Previous is the finished history. The web's
// "Download invoice" builds an HTML file in the browser and is not carried
// over to the app.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { CalendarDays, CheckCircle2, Clock, Hash, House as Home, Package, PackageSearch, RefreshCw, Search, Store, X, XCircle } from 'lucide-react-native'
import { PanelState } from '../../../components/DashboardShell'
import { DateField, SelectField } from '../../../components/form'
import { useLanguage } from '../../../i18n/LanguageContext'
import { fetchMyMaterialRequests } from '../../../api/materialRequests'
import { imageSource } from '../../../api/client'
import { formatMoney } from '../../../utils/countryConfig'
import { activeLocale, formatDate, formatDateTime, formatNumber } from '../../../utils/formatters'
import { SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../../i18n/optionKeys'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'

const STATUS_TONES = {
  PENDING: { box: 'tone', text: 'tone2', color: '#b45309' },
  ACCEPTED: { box: 'tone3', text: 'tone4', color: '#047857' },
  FULFILLED: { box: 'tone3', text: 'tone4', color: '#047857' },
  REJECTED: { box: 'tone5', text: 'tone6', color: '#be123c' },
}
const STATUS_ICONS = { PENDING: Clock, ACCEPTED: CheckCircle2, FULFILLED: CheckCircle2, REJECTED: XCircle }

const TAB_STATUSES = {
  pending: ['PENDING', 'ACCEPTED'],
  previous: ['FULFILLED', 'REJECTED'],
}

// One checkout was written as several rows sharing a request code.
export function groupOrders(rows) {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = row.request_code || `row-${row.id}`
    const order = grouped.get(key) || {
      code: key,
      supplierId: row.supplier_id,
      supplier: row.supplier_name,
      project: row.project_name,
      placedAt: row.created_at,
      items: [],
      total: 0,
    }
    order.items.push(row)
    order.total += Number(row.price || 0) * Number(row.quantity || 0)
    grouped.set(key, order)
  })
  return [...grouped.values()].sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt)))
}

export function orderStatus(items) {
  const states = items.map((item) => item.status)
  if (states.every((state) => state === 'REJECTED')) return 'REJECTED'
  if (states.some((state) => state === 'PENDING')) return 'PENDING'
  if (states.every((state) => state === 'FULFILLED')) return 'FULFILLED'
  return 'ACCEPTED'
}

// Which written form a count takes, by the reader's language's own plural rule.
function plural(count, one, many) {
  try {
    return new Intl.PluralRules(activeLocale()).select(Number(count)) === 'one' ? one : many
  } catch {
    return Number(count) === 1 ? one : many
  }
}

function StatusChip({ status, t }) {
  const tone = STATUS_TONES[status] || STATUS_TONES.PENDING
  const Icon = STATUS_ICONS[status] || Clock
  return (
    <View style={[styles.view, styles[tone.box], { gap: 4 }]}>
      <Icon size={12} color={tone.color} />
      <Text style={[styles.text, styles[tone.text], { fontSize: 11 }]}>{t(`shop.status.${status.toLowerCase()}`)}</Text>
    </View>
  )
}

function Fact({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <View style={[styles.view2, { gap: 10, flexBasis: '48%', flexGrow: 1 }]}>
      <View style={styles.view3}>
        <Icon size={14} color={COLORS.brand[700]} />
      </View>
      <View style={styles.view4}>
        <Text style={[styles.text2, { fontSize: 9.5 }]}>{label}</Text>
        <Text style={[styles.text3, { fontSize: 13 }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

function OrderDetailSheet({ order, country, onClose }) {
  const { t, td } = useLanguage()
  const insets = useSafeAreaInsets()
  if (!order) return null
  const lineTotal = (item) => Number(item.price || 0) * Number(item.quantity || 0)
  const total = order.items.reduce((sum, item) => sum + lineTotal(item), 0)
  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const money = (value) => formatMoney(value, country)

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.view5, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.view6, { gap: 10 }]}>
          <View style={styles.view4}>
            <Text style={[styles.text2, { fontSize: 10 }]}>{t('shop.orderDetails')}</Text>
            <Text style={[styles.text4, { fontSize: 19 }]}>
              {`${formatNumber(order.items.length)} ${plural(order.items.length, t('shop.itemOne'), t('shop.itemMany'))}`}
            </Text>
            {order.status ? <View style={styles.view7}><StatusChip status={order.status} t={t} /></View> : null}
          </View>
          <Pressable onPress={onClose} accessibilityLabel={t('dash.common.close')} style={styles.pressable}>
            <X size={16} color={COLORS.slate[500]} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={[styles.view8, { gap: 8 }]}>
            <Fact icon={Store} label={t('shop.soldBy')} value={td(order.supplier)} />
            <Fact icon={Home} label={t('shop.deliverToProject')} value={td(order.project)} />
            <Fact icon={CalendarDays} label={t('shop.placedOn')} value={formatDateTime(order.placedAt)} />
            <Fact icon={Hash} label={t('shop.orderReference')} value={String(order.code || '').slice(0, 8)} />
          </View>

          <Text style={[styles.text5, { fontSize: 10 }]}>{t('shop.itemsOrdered')}</Text>
          <View style={styles.view9}>
            {order.items.map((item, index) => (
              <View key={item.id} style={[styles.view10, index ? styles.view11 : null, { gap: 10 }]}>
                {item.image_url ? (
                  <Image source={imageSource(item.image_url)} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.slate[50] }} contentFit="contain" />
                ) : (
                  <View style={styles.view12}>
                    <Package size={22} color={COLORS.slate[300]} />
                  </View>
                )}
                <View style={styles.view4}>
                  <Text style={[styles.text3, { fontSize: 13.5 }]} numberOfLines={2}>{td(item.material_name)}</Text>
                  <Text style={[styles.text6, { fontSize: 11 }]} numberOfLines={1}>
                    {td([item.brand, item.size].filter(Boolean).join(' · ')) || optionLabel(t, SUPPLIER_CATEGORY_KEYS, item.category)}
                  </Text>
                  <Text style={[styles.text6, { fontSize: 11 }]}>{`${money(item.price)} ${t('dash.supplier.per')} ${td(item.unit)}`}</Text>
                </View>
                <View style={styles.view13}>
                  <Text style={[styles.text3, { fontSize: 13 }]}>{`${formatNumber(item.quantity)} ${td(item.unit)}`}</Text>
                  <Text style={[styles.text7, { fontSize: 11 }]}>{money(lineTotal(item))}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.view14}>
            <View style={styles.view15}>
              <Text style={[styles.text8, { fontSize: 13 }]}>{t('shop.totalQuantity')}</Text>
              <Text style={[styles.text3, { fontSize: 13 }]}>{formatNumber(totalQuantity)}</Text>
            </View>
            <View style={styles.view16}>
              <Text style={[styles.text3, { fontSize: 14 }]}>{t('shop.estimatedTotal')}</Text>
              <Text style={[styles.text9, { fontSize: 19 }]}>{money(total)}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function OrdersPanel({ projectId, country = 'India' }) {
  const { t, td } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openOrder, setOpenOrder] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('pending')
  const [status, setStatus] = useState('ALL')
  const [supplierId, setSupplierId] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState('newest')

  const load = () => {
    setLoading(true)
    fetchMyMaterialRequests(projectId)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { setSupplierId('ALL') }, [projectId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [projectId])

  const orders = useMemo(() => groupOrders(rows), [rows])

  // This project's suppliers, from the orders actually loaded.
  const orderSuppliers = useMemo(() => {
    const seen = new Map()
    orders.forEach((order) => {
      if (order.supplierId != null && !seen.has(order.supplierId)) seen.set(order.supplierId, order.supplier)
    })
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [orders])

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null
    const matching = orders.filter((order) => {
      const orderState = orderStatus(order.items)
      if (!TAB_STATUSES[tab].includes(orderState)) return false
      if (status !== 'ALL' && orderState !== status) return false
      if (supplierId !== 'ALL' && order.supplierId !== supplierId) return false
      if (from || to) {
        const placed = order.placedAt ? new Date(order.placedAt) : null
        if (!placed) return false
        if (from && placed < from) return false
        if (to && placed > to) return false
      }
      if (!needle) return true
      const haystack = [order.supplier, order.project, order.code, ...order.items.map((item) => item.material_name)]
      return haystack.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
    const byDate = (a, b) => String(b.placedAt).localeCompare(String(a.placedAt))
    if (sort === 'oldest') return [...matching].sort((a, b) => -byDate(a, b))
    if (sort === 'highest') return [...matching].sort((a, b) => b.total - a.total)
    if (sort === 'lowest') return [...matching].sort((a, b) => a.total - b.total)
    return [...matching].sort(byDate)
  }, [orders, tab, search, status, supplierId, fromDate, toDate, sort])

  const statusFilters = ['ALL', ...TAB_STATUSES[tab]]
  const countFor = (tabId) => orders.filter((order) => TAB_STATUSES[tabId].includes(orderStatus(order.items))).length
  const switchTab = (tabId) => { setTab(tabId); setStatus('ALL'); setSupplierId('ALL') }
  const filtered = Boolean(search || status !== 'ALL' || supplierId !== 'ALL' || fromDate || toDate)

  const chip = (key, label, active, onPress) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.pressable2, active ? styles.pressable3 : styles.pressable4]}
    >
      <Text style={[styles.text, active ? styles.text10 : styles.text11, { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.view17, { gap: 10 }]}>
        <View style={styles.view4}>
          <Text style={[styles.text9, { fontSize: 17 }]}>{t('shop.orders')}</Text>
          <Text style={[styles.text6, { fontSize: 11.5 }]}>{t('shop.ordersSubtitle')}</Text>
        </View>
        <Pressable onPress={load} style={[styles.pressable5, { gap: 5 }]}>
          <RefreshCw size={13} color={COLORS.slate[500]} />
          <Text style={[styles.text12, { fontSize: 12 }]}>{t('dash.engineer.refresh')}</Text>
        </Pressable>
      </View>

      <View style={[styles.view18, { gap: 6 }]}>
        {['pending', 'previous'].map((tabId) => {
          const active = tab === tabId
          return (
            <Pressable
              key={tabId}
              onPress={() => switchTab(tabId)}
              style={[styles.pressable6, active ? styles.pressable3 : null, { gap: 6 }]}
            >
              <Text style={[styles.text, active ? styles.text10 : styles.text11, { fontSize: 12.5 }]}>
                {t(tabId === 'pending' ? 'shop.pendingOrdersTab' : 'shop.previousOrdersTab')}
              </Text>
              <View style={[styles.view19, active ? styles.view20 : styles.view21]}>
                <Text style={[styles.text, active ? styles.text10 : styles.text11, { fontSize: 10 }]}>{countFor(tabId)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.view22}>
        <View style={[styles.view23, { gap: 8 }]}>
          <Search size={15} color={COLORS.slate[400]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('shop.searchOrders')}
            placeholderTextColor={COLORS.slate[400]}
            style={[styles.textInput, { fontSize: 13 }]}
            autoCorrect={false}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
          {statusFilters.map((item) => chip(item, item === 'ALL' ? t('shop.allOrders') : t(`shop.status.${item.toLowerCase()}`), status === item, () => setStatus(item)))}
        </ScrollView>
        {orderSuppliers.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
            {chip('ALL', t('shop.allOrders'), supplierId === 'ALL', () => setSupplierId('ALL'))}
            {orderSuppliers.map((item) => chip(String(item.id), td(item.name), supplierId === item.id, () => setSupplierId(item.id)))}
          </ScrollView>
        ) : null}
        <View style={[styles.view24, { gap: 8 }]}>
          <DateField containerStyle={{ flex: 1, marginBottom: 6 }} label={t('shop.from')} value={fromDate} max={toDate || undefined} onChange={setFromDate} />
          <DateField containerStyle={{ flex: 1, marginBottom: 6 }} label={t('shop.to')} value={toDate} min={fromDate || undefined} onChange={setToDate} />
        </View>
        <SelectField
          containerStyle={{ marginBottom: 0 }}
          value={sort}
          onChange={(value) => value && setSort(value)}
          options={[
            { value: 'newest', label: t('shop.sortNewest') },
            { value: 'oldest', label: t('shop.sortOldest') },
            { value: 'highest', label: t('shop.sortHighest') },
            { value: 'lowest', label: t('shop.sortLowest') },
          ]}
        />
        {filtered ? (
          <Pressable
            onPress={() => { setSearch(''); setStatus('ALL'); setSupplierId('ALL'); setFromDate(''); setToDate('') }}
            style={styles.pressable7}
          >
            <Text style={[styles.text12, { fontSize: 12 }]}>{t('shop.clearFilters')}</Text>
          </Pressable>
        ) : null}
      </View>

      <PanelState loading={loading}>
        {!visibleOrders.length ? (
          <View style={styles.view25}>
            <View style={styles.view26}>
              <PackageSearch size={20} color={COLORS.brand[700]} />
            </View>
            <Text style={[styles.text13, { fontSize: 16 }]}>
              {orders.length ? t('shop.noMatchingOrders') : t('shop.noOrders')}
            </Text>
            <Text style={[styles.text14, { fontSize: 12.5 }]}>
              {orders.length ? t('shop.clearFilters') : t('shop.noOrdersHint')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {visibleOrders.map((order) => {
              const state = orderStatus(order.items)
              return (
                <Pressable
                  key={order.code}
                  onPress={() => setOpenOrder({ ...order, status: state })}
                  accessibilityLabel={t('shop.orderDetails')}
                  style={styles.pressable8}
                >
                  <View style={[styles.view27, { gap: 10 }]}>
                    <View style={styles.view4}>
                      <Text style={[styles.text3, { fontSize: 14 }]} numberOfLines={1}>{td(order.supplier)}</Text>
                      <Text style={[styles.text8, { fontSize: 11.5 }]} numberOfLines={1}>
                        {`${formatDate(order.placedAt)} · ${td(order.project) || ''}`}
                      </Text>
                    </View>
                    <Text style={[styles.text3, { fontSize: 14 }]}>{formatMoney(order.total, country)}</Text>
                  </View>
                  <View style={styles.view28}>
                    <StatusChip status={state} t={t} />
                    <Text style={[styles.text8, { fontSize: 11.5 }]}>
                      {`${formatNumber(order.items.length)} ${plural(order.items.length, t('shop.itemOne'), t('shop.itemMany'))}`}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </PanelState>

      {openOrder ? <OrderDetailSheet order={openOrder} country={country} onClose={() => setOpenOrder(null)} /> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.amberSoft, borderColor: c.amberBorder },
  tone2: { color: c.amberText },
  tone3: { backgroundColor: c.emeraldSoft, borderColor: c.emeraldBorder },
  tone4: { color: c.emeraldText },
  tone5: { backgroundColor: c.roseSoft, borderColor: c.roseBorder },
  tone6: { color: c.roseText },
  view: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text: { fontFamily: 'Inter_700Bold' },
  view2: { flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view3: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view4: { flex: 1 },
  text2: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  text3: { fontFamily: 'Inter_700Bold', color: c.text },
  view5: { flex: 1, backgroundColor: c.card },
  view6: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: c.borderSoft, padding: 14 },
  text4: { marginTop: 3.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view7: { marginTop: 7 },
  pressable: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border },
  view8: { flexDirection: 'row', flexWrap: 'wrap' },
  text5: { marginTop: 17.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  view9: { marginTop: 7, overflow: 'hidden', borderRadius: 10.5, borderWidth: 1, borderColor: c.border },
  view10: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10.5, paddingVertical: 10.5 },
  view11: { borderTopWidth: 1, borderColor: c.borderSoft },
  view12: { height: 49, width: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.subtle },
  text6: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view13: { alignItems: 'flex-end' },
  text7: { fontFamily: 'Inter_700Bold', color: c.textFaint },
  view14: { marginTop: 14, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, padding: 10.5 },
  view15: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text8: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view16: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
  text9: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  pressable2: { height: 31.5, justifyContent: 'center', borderRadius: 9999, paddingHorizontal: 12.25 },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  text10: { color: '#ffffff' },
  text11: { color: c.textMuted },
  view17: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  pressable5: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  text12: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  view18: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5.25 },
  pressable6: { height: 35, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  view19: { height: 17.5, minWidth: 17.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, paddingHorizontal: 5.25 },
  view20: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  view21: { backgroundColor: c.muted },
  view22: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  view23: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  textInput: { flex: 1, fontFamily: 'Inter_600SemiBold', color: c.text },
  scrollView: { marginTop: 8.75 },
  view24: { marginTop: 10.5, flexDirection: 'row' },
  pressable7: { marginTop: 8.75, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border },
  view25: { alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 28 },
  view26: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.brandSoft },
  text13: { marginTop: 10.5, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text14: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable8: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view27: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  view28: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}))
