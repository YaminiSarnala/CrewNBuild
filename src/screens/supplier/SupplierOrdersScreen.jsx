// The supplier's Orders tab: port of web pages/supplier/SupplierMaterialRequests.jsx.
//
// One checkout arrives as several rows sharing a request code, grouped back
// into one order here. Tapping an order opens everything about it; accept,
// reject and fulfil still act on the individual lines, because a supplier may
// serve part of an order and not the rest. All / House Owner / Builder split
// the orders by who placed them. The web's table becomes one card per order.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Check, ChevronRight, PackageCheck, Search, X } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { Notice } from '../../components/builder/BuilderUi'
import { fetchSupplierMaterialRequests, respondMaterialRequest } from '../../api/materialRequests'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { formatDate } from '../../utils/formatters'
import { apiErrorText } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { money, useSupplierCountry, useSupplierListings } from './products/productParts'
import { CountTabs, BuyerAvatar, OrderSheet, StatusPill, groupOrders, lineTotal, statusLabel } from './orders/orderParts'

export default function SupplierOrdersScreen() {
  const { t, td } = useLanguage()
  const country = useSupplierCountry()
  const { gutter } = useResponsive()
  const { requireCompleteProfile } = useProfileGate()
  // Fulfilling an order takes the stock off the listings: re-read them.
  const { reload: reloadProducts } = useSupplierListings()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState(null)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [openCode, setOpenCode] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setRows((await fetchSupplierMaterialRequests()) || [])
      setStatus('ready')
    } catch {
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
    }
  }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))
  // A new order, or a buyer's change, shows at once.
  useLiveRefresh(load)

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Accepting or fulfilling needs a complete profile; rejecting does not.
  async function respond(id, action) {
    if (action !== 'REJECT' && requireCompleteProfile(() => respond(id, action))) return
    setBusyId(id)
    try {
      await respondMaterialRequest(id, action)
      setMessage({
        tone: 'success',
        text: action === 'FULFILL' ? t('dash.supplier.material.fulfilled') : action === 'ACCEPT' ? t('dash.supplier.material.accepted') : t('dash.supplier.material.rejected'),
      })
      await load()
      setOpenCode(null)
      if (action === 'FULFILL') reloadProducts()
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('dash.supplier.material.unable'), t) })
    } finally {
      setBusyId(null)
    }
  }

  const orders = useMemo(() => groupOrders(rows), [rows])
  const words = query.trim().toLowerCase()
  const matches = (order) => !words || [order.buyer, order.project, order.owner, ...order.items.map((item) => item.material_name)]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(words))
  const allOrders = orders.filter(matches)
  const ownerOrders = allOrders.filter((order) => order.buyerRole === 'OWNER')
  const builderOrders = allOrders.filter((order) => order.buyerRole !== 'OWNER')
  const tabs = [
    { id: 'all', label: t('dash.contractor.filter.all'), count: allOrders.length },
    { id: 'owner', label: t('role.owner'), count: ownerOrders.length },
    { id: 'builder', label: t('role.contractor'), count: builderOrders.length },
  ]
  const visible = activeTab === 'owner' ? ownerOrders : activeTab === 'builder' ? builderOrders : allOrders
  const open = orders.find((order) => order.code === openCode) || null
  const fmt = (value) => money(value, country)

  const summary = (order) => {
    const names = [...new Set(order.items.map((item) => item.material_name).filter(Boolean))]
    return names.slice(0, 3).map(td).join(', ') + (names.length > 3 ? '…' : '')
  }

  // Each line's own decision, inside the order sheet.
  const lineActions = (item) => {
    const busy = busyId === item.id
    if (item.status === 'PENDING') {
      return (
        <View style={styles.lineActions}>
          <Pressable onPress={() => respond(item.id, 'REJECT')} disabled={busy} style={[styles.lineButton, styles.reject]}>
            <X size={14} color="#be123c" />
            <Text style={[styles.lineButtonText, styles.rejectText]}>{t('dash.common.reject')}</Text>
          </Pressable>
          <Pressable onPress={() => respond(item.id, 'ACCEPT')} disabled={busy} style={[styles.lineButton, styles.accept, busy ? { opacity: 0.6 } : null]}>
            <Check size={14} color="#ffffff" />
            <Text style={[styles.lineButtonText, { color: '#ffffff' }]}>{t('dash.common.accept')}</Text>
          </Pressable>
        </View>
      )
    }
    if (item.status === 'ACCEPTED') {
      return (
        <View style={styles.lineActions}>
          <Pressable onPress={() => respond(item.id, 'FULFILL')} disabled={busy} style={[styles.lineButton, styles.fulfil, busy ? { opacity: 0.6 } : null]}>
            <PackageCheck size={14} color="#ffffff" />
            <Text style={[styles.lineButtonText, { color: '#ffffff' }]}>{t('dash.supplier.material.markFulfilled')}</Text>
          </Pressable>
        </View>
      )
    }
    return null
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 12 }}>
        <Text style={styles.title}>{t('shop.orders')}</Text>
        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.slate[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search buyer, project or material"
            placeholderTextColor={COLORS.slate[400]}
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search"><X size={15} color={COLORS.slate[500]} /></Pressable>
          ) : null}
        </View>
        {message && !open ? (
          <Pressable onPress={() => setMessage(null)}><Notice tone={message.tone} text={message.text} /></Pressable>
        ) : null}
        <CountTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {status === 'loading' ? (
          <PanelState loading skeleton="cards" />
        ) : status === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Orders could not be loaded.</Text>
            <Pressable onPress={load} style={{ marginTop: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('dash.supplier.material.none')}</Text></View>
        ) : visible.map((order) => (
          <Pressable key={order.code} onPress={() => { setMessage(null); setOpenCode(order.code) }} style={styles.card} accessibilityRole="button" accessibilityLabel={t('shop.orderDetails')}>
            <View style={styles.cardTop}>
              <BuyerAvatar order={order} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.buyer} numberOfLines={1}>{td(order.buyer) || '—'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{order.buyerRole === 'OWNER' ? t('role.owner') : t('role.builder')}</Text>
              </View>
              <StatusPill status={order.status} label={statusLabel(order.status, t)} />
            </View>
            <View style={styles.rows}>
              <Row label={t('dash.common.project')} value={td(order.project) || '—'} />
              <Row
                label={t('dash.supplier.requestedItems')}
                value={`${order.items.length} ${order.items.length === 1 ? t('shop.itemOne') : t('shop.itemMany')}`}
                sub={summary(order)}
              />
              <Row label={t('dash.supplier.requestDate')} value={formatDate(order.placedAt, '—')} />
            </View>
            <View style={styles.cardBottom}>
              <View>
                <Text style={styles.meta}>{t('dash.supplier.estimatedCost')}</Text>
                <Text style={styles.total}>{fmt(order.items.reduce((sum, item) => sum + lineTotal(item), 0))}</Text>
              </View>
              <View style={styles.view}>
                <Text style={styles.viewText}>{t('dash.supplier.viewDetails')}</Text>
                <ChevronRight size={14} color={COLORS.brand[700]} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <OrderSheet order={open} counterpartyLabel={t('shop.orderedBy')} money={fmt} onClose={() => setOpenCode(null)} lineExtra={lineActions}>
        {message ? <View style={{ marginTop: 12 }}><Notice tone={message.tone} text={message.text} /></View> : null}
      </OrderSheet>
    </DashboardShell>
  )
}

function Row({ label, value, sub }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  searchBox: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  empty: { alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyText: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyer: { fontSize: 14.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  meta: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  rows: { marginTop: 10, gap: 6, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  rowValue: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text },
  rowSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textFaint },
  cardBottom: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 10 },
  total: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 32, borderRadius: 9, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 },
  viewText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  lineActions: { flexDirection: 'row', gap: 8 },
  lineButton: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10 },
  lineButtonText: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  reject: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  rejectText: { color: c.roseText },
  accept: { backgroundColor: '#236645' },
  fulfil: { backgroundColor: '#10b981' },
}))
