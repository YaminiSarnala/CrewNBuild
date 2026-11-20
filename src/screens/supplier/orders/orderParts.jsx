// Pieces shared by the supplier's Orders tab and Purchase Requests: grouping
// the rows of one checkout back into one order (web SupplierMaterialRequests /
// SupplierPurchaseRequests), status pills, the order sheet (web
// components/shop/OrderDetailCard.jsx, without the browser-only invoice
// download) and the role tabs.
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CalendarDays, Hash, House as Home, MapPin, Package, User } from 'lucide-react-native'
import { Image } from 'expo-image'
import { imageSource } from '../../../api/client'
import { avatarFromPath } from '../../../utils/avatars'
import { useLanguage } from '../../../i18n/LanguageContext'
import { formatDateTime, formatNumber } from '../../../utils/formatters'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import SheetHeader from '../SheetHeader'
import { ToastHost } from '../../../components/Toast'

// The stored status is unchanged; this only reads it back in a supplier's words.
const STATUS_LABEL_KEYS = {
  PENDING: 'ui.status.pending',
  ACCEPTED: 'ui.requests.accepted',
  FULFILLED: 'ui.status.completed',
  REJECTED: 'ui.requests.rejected',
}
export const statusLabel = (status, t) => (STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status)

export const ROLE_LABEL = { OWNER: 'House Owner', ENGINEER: 'Site Engineer', STORE_MANAGER: 'Store Manager' }

/** An order's overall status (Orders): rejected only when every line is. */
export function orderStatus(items) {
  const states = items.map((item) => item.status)
  if (states.every((state) => state === 'REJECTED')) return 'REJECTED'
  if (states.some((state) => state === 'PENDING')) return 'PENDING'
  if (states.every((state) => state === 'FULFILLED')) return 'FULFILLED'
  return 'ACCEPTED'
}

/** A purchase request's overall status: pending while any line waits. */
function requestStatus(lines) {
  const states = lines.map((line) => line.status)
  if (states.some((state) => state === 'PENDING')) return 'PENDING'
  if (states.every((state) => state === 'REJECTED')) return 'REJECTED'
  if (states.every((state) => state === 'FULFILLED')) return 'FULFILLED'
  return 'ACCEPTED'
}

export const lineTotal = (line) => Number(line.price || 0) * Number(line.quantity || 0)

/** Orders: rows sharing a request code are one checkout, newest first. */
export function groupOrders(rows = []) {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = row.request_code || `row-${row.id}`
    const order = grouped.get(key) || {
      code: key,
      buyer: row.engineer_name,
      // A House Owner buys for their own project; every other buyer orders for
      // a builder's project.
      buyerRole: row.engineer_role || '',
      project: row.project_name,
      projectId: row.project_id,
      owner: row.owner_name || '',
      pincode: row.project_pincode,
      city: row.project_city,
      placedAt: row.created_at,
      items: [],
    }
    order.items.push(row)
    grouped.set(key, order)
  })
  return [...grouped.values()]
    .map((order) => ({ ...order, status: orderStatus(order.items), total: order.items.reduce((sum, item) => sum + lineTotal(item), 0) }))
    .sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt)))
}

/** Purchase requests: one per Buy, pending first, then newest. */
export function groupPurchaseRequests(rows = []) {
  const byCode = new Map()
  for (const row of rows) {
    const key = row.request_code || `row-${row.id}`
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key).push(row)
  }
  return [...byCode.entries()]
    .map(([code, lines]) => {
      const first = lines[0]
      return {
        code,
        items: lines,
        status: requestStatus(lines),
        buyer: first.engineer_name,
        // A builder's Store Manager buys for the store: named as such.
        buyerRole: first.buyer_is_store_manager ? 'STORE_MANAGER' : first.engineer_role,
        project: first.project_name,
        pincode: first.project_pincode,
        city: first.project_city,
        placedAt: first.created_at,
        total: lines.reduce((sum, line) => sum + lineTotal(line), 0),
      }
    })
    .sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || String(b.placedAt || '').localeCompare(String(a.placedAt || '')))
}

export const pendingPurchaseCount = (rows = []) => groupPurchaseRequests(rows).filter((request) => request.status === 'PENDING').length

const PILL = {
  PENDING: 'pillPending',
  ACCEPTED: 'pillAccepted',
  FULFILLED: 'pillFulfilled',
  REJECTED: 'pillRejected',
  // Equipment requests: returned / delivered reads as done.
  COMPLETED: 'pillFulfilled',
}

export function StatusPill({ status, label }) {
  const tone = PILL[status] || 'pillNeutral'
  return (
    <View style={[styles.pill, styles[tone]]}>
      <View style={[styles.pillDot, styles[`${tone}Dot`]]} />
      <Text style={[styles.pillText, styles[`${tone}Text`]]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** All / House Owner / Builder (or any) tabs with counts. */
export function CountTabs({ tabs, active, onChange, newBadge = false }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map((tab) => {
        const on = active === tab.id
        return (
          <Pressable key={tab.id} onPress={() => onChange(tab.id)} accessibilityState={{ selected: on }} style={[styles.tab, on ? styles.tabOn : null]}>
            <Text style={[styles.tabText, on ? styles.tabTextOn : null]}>{tab.label}</Text>
            {tab.count > 0 ? (
              <View style={[styles.count, on ? styles.countOn : newBadge ? styles.countNew : null]}>
                <Text style={[styles.countText, on ? styles.countTextOn : null]}>{newBadge ? `${tab.count} new` : tab.count}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** The buyer's picture: their upload, else their role's avatar (an owner, or a site engineer / store manager). */
export function BuyerAvatar({ order, size = 34 }) {
  const first = order.items?.[0] || {}
  const role = order.buyerRole === 'OWNER' ? 'OWNER' : 'ENGINEER'
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>
      <Image source={avatarFromPath(first.engineer_profile_image_url || first.buyer_profile_image_url || '', role)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </View>
  )
}

function Fact({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}><Icon size={14} color={COLORS.brand[700]} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  )
}

/**
 * One order in full: who ordered it, for which project, every line, the
 * total, and `children` (the supplier's actions) at the bottom.
 */
export function OrderSheet({ order, title, counterpartyLabel, money, onClose, lineExtra, children }) {
  const { t, td } = useLanguage()
  const insets = useSafeAreaInsets()
  if (!order) return null
  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <SheetHeader title={title || t('shop.orderDetails')} subtitle={String(order.code || '').slice(0, 8).toUpperCase()} onBack={onClose} />
        <View style={styles.sheetHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{td(order.buyer) || 'Buyer'}</Text>
            <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <StatusPill status={order.status} label={statusLabel(order.status, t)} />
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          <View style={styles.facts}>
            <Fact icon={User} label={counterpartyLabel || t('shop.orderedBy')} value={[td(order.buyer), ROLE_LABEL[order.buyerRole] || (order.buyerRole === 'OWNER' ? t('role.owner') : t('role.builder'))].filter(Boolean).join(' · ')} />
            <Fact icon={Home} label={t('shop.deliverToProject')} value={td(order.project)} />
            <Fact icon={MapPin} label="Delivery location" value={[order.pincode, order.city].filter(Boolean).join(', ')} />
            <Fact icon={CalendarDays} label={t('shop.placedOn')} value={formatDateTime(order.placedAt)} />
            <Fact icon={Hash} label={t('shop.orderReference')} value={String(order.code || '').slice(0, 8).toUpperCase()} />
          </View>

          <Text style={styles.sectionLabel}>{t('shop.itemsOrdered')}</Text>
          <View style={styles.lines}>
            {order.items.map((item, index) => (
              <View key={item.id} style={[styles.line, index ? styles.lineBorder : null]}>
                <View style={styles.lineRow}>
                  {item.image_url ? (
                    <Image source={imageSource(item.image_url)} style={styles.lineImage} contentFit="contain" />
                  ) : (
                    <View style={[styles.lineImage, styles.lineImageEmpty]}><Package size={20} color={COLORS.slate[300]} /></View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.lineName} numberOfLines={2}>{td(item.material_name)}</Text>
                    {[item.brand, item.subcategory_name, item.size].filter(Boolean).length ? (
                      <Text style={styles.lineMeta} numberOfLines={1}>{[item.brand, item.subcategory_name, item.size].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                    <Text style={styles.lineMeta}>
                      {`${t('shop.quantity')}: ${formatNumber(item.quantity)} ${td(item.unit || '')} · ${t('se.rate')}: ${money(item.price)}${item.unit ? `/${td(item.unit)}` : ''}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.lineTotal}>{money(lineTotal(item))}</Text>
                    <StatusPill status={item.status} label={statusLabel(item.status, t)} />
                  </View>
                </View>
                {lineExtra ? lineExtra(item) : null}
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('shop.totalQuantity')}</Text>
              <Text style={styles.totalValue}>{formatNumber(totalQuantity)}</Text>
            </View>
            <View style={[styles.totalRow, { marginTop: 6 }]}>
              <Text style={styles.totalStrongLabel}>{t('shop.estimatedTotal')}</Text>
              <Text style={styles.totalStrong}>{money(order.total)}</Text>
            </View>
          </View>

          {children}
        </ScrollView>
      </View>
      <ToastHost />
    </Modal>
  )
}

const styles = createStyles((c) => ({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillDot: { height: 6, width: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  pillPending: { backgroundColor: c.amberSoft },
  pillPendingDot: { backgroundColor: '#d97706' },
  pillPendingText: { color: c.amberTextStrong },
  pillAccepted: { backgroundColor: c.skySoftStrong },
  pillAcceptedDot: { backgroundColor: '#0284c7' },
  pillAcceptedText: { color: c.skyTextStrong },
  pillFulfilled: { backgroundColor: c.emeraldSoftStrong },
  pillFulfilledDot: { backgroundColor: '#059669' },
  pillFulfilledText: { color: c.emeraldTextStrong },
  pillRejected: { backgroundColor: c.roseSoftStrong },
  pillRejectedDot: { backgroundColor: '#e11d48' },
  pillRejectedText: { color: c.roseText },
  pillNeutral: { backgroundColor: c.muted },
  pillNeutralDot: { backgroundColor: COLORS.slate[400] },
  pillNeutralText: { color: c.textMuted },
  tabs: { flexGrow: 1, gap: 6, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5 },
  tab: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 14 },
  tabOn: { backgroundColor: '#1a5038' },
  tabText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.textMuted },
  tabTextOn: { color: '#ffffff' },
  count: { borderRadius: 999, backgroundColor: c.brandSoft, paddingHorizontal: 6, paddingVertical: 1 },
  countOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  countNew: { backgroundColor: '#fcd34d' },
  countText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  countTextOn: { color: '#ffffff' },
  initials: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: c.brandSoft },
  sheet: { flex: 1, backgroundColor: c.canvas },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { marginTop: 2, fontSize: 19, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10 },
  factIcon: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.brandSoft },
  factLabel: { fontSize: 9.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.3, color: c.textFaint },
  factValue: { marginTop: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  sectionLabel: { marginTop: 16, marginBottom: 8, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.textFaint },
  lines: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  line: { padding: 12, gap: 10 },
  lineBorder: { borderTopWidth: 1, borderColor: c.borderSoft },
  lineRow: { flexDirection: 'row', gap: 10 },
  lineImage: { height: 54, width: 54, borderRadius: 11, backgroundColor: '#ffffff' },
  lineImageEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.subtle },
  lineName: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  lineMeta: { marginTop: 2, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  lineTotal: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  totals: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.textMuted },
  totalValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  totalStrongLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  totalStrong: { fontSize: 19, fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
}))
