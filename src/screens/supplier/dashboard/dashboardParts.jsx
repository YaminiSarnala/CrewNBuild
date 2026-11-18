// The panels of a Material Supplier's Dashboard home, built from records the
// dashboard already loads (orders, listings, requests, projects) -- no API of
// their own and nothing invented. Native versions of the web
// SupplierRecentSection (Recent Activity, Recent Requests) and
// SupplierAnalyticsDashboard (Sales Overview, Top Products, Quick Actions).
//
// Revenue counts orders the supplier accepted or fulfilled: a pending order
// is not money yet, and a rejected one never will be.
import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, Boxes, Building2, ChevronRight, ClipboardList, FolderKanban,
  House as Home, IndianRupee, Package, Search, ShoppingCart, Tags, Users, Zap,
} from 'lucide-react-native'
import { imageSource } from '../../../api/client'
import { useLanguage } from '../../../i18n/LanguageContext'
import { SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../../i18n/optionKeys'
import { userAvatarSource } from '../../../utils/avatars'
import { formatDate, formatNumber, formatRelativeTime } from '../../../utils/formatters'
import { useTheme } from '../../../theme/ThemeContext'
import { ink, soft } from '../../../theme/tint'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import { Avatar, REQUEST_STATUS_KEYS } from '../clients/clientParts'
import { lineTotal } from '../orders/orderParts'

const EARNED = new Set(['ACCEPTED', 'FULFILLED'])

export function Panel({ icon: Icon, tint = 'brand', title, action, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View style={styles.panelTitleRow}>
          <View style={[styles.panelIcon, styles[`tint_${tint}`]]}><Icon size={16} color={TINT_INK[tint]} /></View>
          <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  )
}
const TINT_INK = { brand: '#1a5038', emerald: '#047857', amber: '#b45309', sky: '#0369a1' }

function ViewAll({ onPress }) {
  const { t } = useLanguage()
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.viewAll}>
      <Text style={styles.viewAllText}>{t('dash.viewAll')}</Text>
      <ArrowRight size={13} color={COLORS.brand[700]} />
    </Pressable>
  )
}

const Empty = ({ text }) => <Text style={styles.empty}>{text}</Text>

// ---------------------------------------------------------------- recent activity

const KIND_META = {
  order: { icon: ShoppingCart, tint: 'amber', labelKey: 'dash.supplier.actOrder' },
  product: { icon: Package, tint: 'emerald', labelKey: 'dash.supplier.actProduct' },
  project: { icon: FolderKanban, tint: 'sky', labelKey: 'dash.supplier.actProject' },
}

/** The newest real orders (one per checkout), listings and project assignments, as a timeline. */
export function RecentActivity({ orders, products, projects, onViewAll }) {
  const { t, td } = useLanguage()
  const items = useMemo(() => {
    const events = []
    const byCode = new Map()
    orders.forEach((row) => {
      const code = row.request_code || `row-${row.id}`
      const existing = byCode.get(code)
      if (existing) existing.lines += 1
      else byCode.set(code, { ...row, lines: 1 })
    })
    byCode.forEach((order) => events.push({
      at: order.created_at,
      kind: 'order',
      title: td(order.engineer_name || order.owner_name) || t('dash.supplier.requester'),
      context: td(order.project_name || ''),
      detail: order.lines > 1 ? `${order.lines} ${t('shop.itemMany')}` : td(order.material_name || ''),
    }))
    ;[...products]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 5)
      .forEach((product) => events.push({
        at: product.created_at,
        kind: 'product',
        title: product.name ? td(product.name) : t('dash.supplier.actProduct'),
        context: product.category ? optionLabel(t, SUPPLIER_CATEGORY_KEYS, product.category) : '',
      }))
    projects.forEach((project) => events.push({
      at: project.assigned_on,
      kind: 'project',
      title: project.title ? td(project.title) : t('dash.supplier.actProject'),
      context: td(project.requester?.name || ''),
    }))
    return events.filter((event) => event.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5)
  }, [orders, products, projects, t, td])

  return (
    <Panel icon={Activity} tint="emerald" title={t('dash.common.recentActivity')} action={orders.length ? <ViewAll onPress={onViewAll} /> : null}>
      {items.length ? items.map((event, index) => {
        const meta = KIND_META[event.kind]
        const Icon = meta.icon
        const last = index === items.length - 1
        return (
          <View key={`${event.kind}-${event.title}-${event.at}`} style={styles.timelineRow}>
            {/* A dot per entry, joined by a line. */}
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {!last ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={[styles.rowIcon, styles[`tint_${meta.tint}`]]}><Icon size={15} color={TINT_INK[meta.tint]} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{t(meta.labelKey)}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{[event.title, event.context, event.detail].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={styles.rowTime}>{formatRelativeTime(event.at)}</Text>
          </View>
        )
      }) : <Empty text={t('dash.common.noRecentActivity')} />}
    </Panel>
  )
}

// ---------------------------------------------------------------- recent requests

const REQUEST_PILL = { pending: 'amber', accepted: 'emerald', rejected: 'rose', withdrawn: 'slate', sent: 'sky' }

export function RecentRequests({ requests, onOpen }) {
  const { t, td } = useLanguage()
  const recent = useMemo(
    () => [...requests].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 4),
    [requests],
  )
  return (
    <Panel icon={ClipboardList} title={t('dash.supplier.recentRequests')} action={requests.length ? <ViewAll onPress={onOpen} /> : null}>
      {recent.length ? recent.map((request) => {
        const raw = String(request.status || '').toLowerCase()
        const status = request.is_sender && raw === 'pending' ? 'sent' : raw
        const tone = REQUEST_PILL[status] || 'slate'
        return (
          <Pressable key={request.id} onPress={onOpen} style={styles.requestRow}>
            <Avatar source={userAvatarSource(request)} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{td(request.profile_name || request.sender_name) || t('dash.supplier.requester')}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {[request.sender_role === 'OWNER' ? t('role.owner') : t('role.builder'), td(request.project_title || '')].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={[styles.pill, styles[`pill_${tone}`]]}>
                <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>
                  {status === 'sent' ? t('dash.sent') : REQUEST_STATUS_KEYS[status] ? t(REQUEST_STATUS_KEYS[status]) : status}
                </Text>
              </View>
              <Text style={styles.rowTime}>{formatDate(request.created_at, '—')}</Text>
            </View>
            <ChevronRight size={15} color={COLORS.slate[400]} />
          </Pressable>
        )
      }) : <Empty text={t('ui.requests.noRequests')} />}
    </Panel>
  )
}

// ---------------------------------------------------------------- top products

const BAR_COLORS = ['#fb923c', '#059669', '#0ea5e9', '#8b5cf6']

/** Best sellers by what accepted and fulfilled orders earned (value compares fairly across units). */
export function TopProducts({ orders, money, onViewAll }) {
  const { t, td } = useLanguage()
  const top = useMemo(() => {
    const byProduct = new Map()
    orders.forEach((row) => {
      if (!EARNED.has(row.status)) return
      const key = row.product_id || row.material_name
      const entry = byProduct.get(key) || { key, name: row.material_name, unit: row.unit, image: row.image_url, quantity: 0, value: 0 }
      entry.quantity += Number(row.quantity || 0)
      entry.value += lineTotal(row)
      byProduct.set(key, entry)
    })
    const list = [...byProduct.values()].filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 4)
    const best = list[0]?.value || 1
    return list.map((item) => ({ ...item, share: Math.round((item.value / best) * 100) }))
  }, [orders])

  return (
    <Panel icon={Package} title={t('dash.sup.topProducts')} action={<ViewAll onPress={onViewAll} />}>
      {top.length ? top.map((item, index) => (
        <View key={String(item.key)} style={styles.topRow}>
          <View style={styles.topImage}>
            {item.image ? <Image source={imageSource(item.image)} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Package size={18} color={COLORS.slate[300]} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{td(item.name)}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              <Text style={styles.strong}>{money(item.value)}</Text>
              {` · ${formatNumber(item.quantity)} ${td(item.unit || '')}`}
            </Text>
            <View style={styles.barRow}>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: `${item.share}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }]} /></View>
              <Text style={styles.barPct}>{`${item.share}%`}</Text>
            </View>
          </View>
        </View>
      )) : <Empty text={t('dash.sup.noTopProducts')} />}
    </Panel>
  )
}

// ---------------------------------------------------------------- quick actions

export function QuickActions({ onAddProduct, onProducts, onFindClients, onRequests }) {
  const { t } = useLanguage()
  const actions = [
    { id: 'add', label: t('dash.sup.addProduct'), icon: Package, tone: 'emerald', onPress: onAddProduct },
    { id: 'categories', label: t('dash.sup.manageCategories'), icon: Tags, tone: 'orange', onPress: onProducts },
    { id: 'clients', label: t('dash.sup.findClients'), icon: Users, tone: 'blue', onPress: onFindClients },
    { id: 'requests', label: t('dash.sup.viewRequests'), icon: ClipboardList, tone: 'violet', onPress: onRequests },
  ]
  return (
    <Panel icon={Zap} title={t('dash.engineer.quickActions')}>
      <View style={{ gap: 8 }}>
        {actions.map(({ id, label, icon: Icon, tone, onPress }) => (
          <Pressable key={id} onPress={onPress} style={[styles.action, { backgroundColor: soft(ACTION_BG[tone], ACTION_INK[tone]) }]}>
            <Icon size={17} color={ink(ACTION_INK[tone])} />
            <Text style={[styles.actionText, { color: ink(ACTION_INK[tone]) }]} numberOfLines={1}>{label}</Text>
            <ChevronRight size={15} color={ink(ACTION_INK[tone])} />
          </Pressable>
        ))}
      </View>
    </Panel>
  )
}
const ACTION_INK = { emerald: '#065f46', orange: '#c2410c', blue: '#1e40af', violet: '#5b21b6' }
const ACTION_BG = { emerald: '#ecfdf5', orange: '#fff7ed', blue: '#eff6ff', violet: '#f5f3ff' }

// ---------------------------------------------------------------- sales overview

const RANGES = [
  { id: 'day', buckets: 14 },
  { id: 'week', buckets: 12 },
  { id: 'month', buckets: 12 },
  { id: 'year', buckets: 5 },
]

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}
function bucketStart(date, range) {
  const day = startOfDay(date)
  if (range === 'day') return day
  if (range === 'week') {
    day.setDate(day.getDate() - day.getDay())
    return day
  }
  if (range === 'month') return new Date(day.getFullYear(), day.getMonth(), 1)
  return new Date(day.getFullYear(), 0, 1)
}
function stepBack(date, range, steps) {
  const copy = new Date(date)
  if (range === 'day') copy.setDate(copy.getDate() - steps)
  else if (range === 'week') copy.setDate(copy.getDate() - steps * 7)
  else if (range === 'month') copy.setMonth(copy.getMonth() - steps)
  else copy.setFullYear(copy.getFullYear() - steps)
  return copy
}
function bucketLabel(date, range) {
  if (range === 'day' || range === 'week') return formatDate(date, '', { day: 'numeric', month: 'short' })
  if (range === 'month') return formatDate(date, '', { month: 'short' })
  return String(date.getFullYear())
}

/** Revenue per period as a line, the last point labelled; tap to read a point. */
function SalesLine({ series, money }) {
  const { isDark } = useTheme()
  const [width, setWidth] = useState(0)
  const [picked, setPicked] = useState(null)
  const height = 170
  const pad = { top: 18, right: 12, bottom: 24, left: 12 }
  const plotWidth = Math.max(0, width - pad.left - pad.right)
  const plotHeight = height - pad.top - pad.bottom
  const max = Math.max(...series.map((point) => point.total), 1)
  const x = (index) => pad.left + (series.length > 1 ? (index / (series.length - 1)) * plotWidth : plotWidth / 2)
  const y = (value) => pad.top + plotHeight - (value / max) * plotHeight
  const path = series.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.total).toFixed(1)}`).join(' ')
  const area = series.length > 1 ? `${path} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const shown = picked ?? series.length - 1
  const color = '#1a5038'
  const muted = isDark ? '#94a3b8' : '#64748b'
  // Four evenly spaced dates, first and last included, so no two labels touch.
  const labelled = new Set([0, Math.round((series.length - 1) / 3), Math.round(((series.length - 1) * 2) / 3), series.length - 1])

  const pick = (event) => {
    const pointerX = event.nativeEvent.locationX
    let nearest = 0
    series.forEach((_, index) => { if (Math.abs(x(index) - pointerX) < Math.abs(x(nearest) - pointerX)) nearest = index })
    setPicked((current) => (current === nearest ? null : nearest))
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {width > 0 ? (
        <Pressable onPress={pick}>
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((share) => (
              <Line key={share} x1={pad.left} x2={width - pad.right} y1={y(max * share)} y2={y(max * share)} stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth={1} />
            ))}
            {area ? <Path d={area} fill={color} opacity={0.1} /> : null}
            <Path d={path} fill="none" stroke={isDark ? '#82c29e' : color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {series.map((point, index) => (labelled.has(index) ? (
              <SvgText key={point.label + index} x={x(index)} y={height - 6} textAnchor={index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'} fontSize={10} fill={muted}>
                {point.label}
              </SvgText>
            ) : null))}
            <Line x1={x(shown)} x2={x(shown)} y1={pad.top} y2={pad.top + plotHeight} stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth={1} strokeDasharray="3,3" />
            <Circle cx={x(shown)} cy={y(series[shown].total)} r={4.5} fill={isDark ? '#82c29e' : color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
            <SvgText
              x={x(shown)}
              y={Math.max(12, y(series[shown].total) - 10)}
              textAnchor={shown > series.length / 2 ? 'end' : 'start'}
              fontSize={11}
              fontWeight="800"
              fill={isDark ? '#e2e8f0' : '#1f2937'}
            >
              {`${series[shown].label}: ${money(series[shown].total)}`}
            </SvgText>
          </Svg>
        </Pressable>
      ) : null}
    </View>
  )
}

export function SalesOverview({ orders, money, onOrders }) {
  const { t } = useLanguage()
  const [range, setRange] = useState('day')

  const series = useMemo(() => {
    const config = RANGES.find((item) => item.id === range) || RANGES[0]
    const now = new Date()
    const buckets = []
    for (let step = config.buckets - 1; step >= 0; step -= 1) {
      const start = bucketStart(stepBack(now, range, step), range)
      buckets.push({ key: start.getTime(), label: bucketLabel(start, range), orders: 0, revenue: 0, quantity: 0 })
    }
    const index = new Map(buckets.map((bucket) => [bucket.key, bucket]))
    orders.forEach((row) => {
      if (!row.created_at) return
      const bucket = index.get(bucketStart(new Date(row.created_at), range).getTime())
      if (!bucket) return
      bucket.orders += 1
      bucket.quantity += Number(row.quantity || 0)
      if (EARNED.has(row.status)) bucket.revenue += lineTotal(row)
    })
    return buckets
  }, [orders, range])

  const current = series[series.length - 1]?.revenue || 0
  const previous = series[series.length - 2]?.revenue || 0
  // This period's revenue against the one before it.
  const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null
  const windowRevenue = series.reduce((sum, bucket) => sum + bucket.revenue, 0)
  const windowOrders = series.reduce((sum, bucket) => sum + bucket.orders, 0)
  const windowQuantity = series.reduce((sum, bucket) => sum + bucket.quantity, 0)
  const allRevenue = orders.filter((row) => EARNED.has(row.status)).reduce((sum, row) => sum + lineTotal(row), 0)
  const hasSales = series.some((bucket) => bucket.revenue > 0)
  const chips = [
    { icon: ShoppingCart, value: formatNumber(windowOrders), label: t('shop.orders'), onPress: onOrders },
    { icon: IndianRupee, value: money(allRevenue), label: t('dash.sup.totalRevenue') },
    { icon: Boxes, value: formatNumber(windowQuantity), label: t('dash.sup.totalQuantity') },
  ]

  return (
    <Panel icon={BarChart3} title={t('dash.sup.salesOverview')}>
      <View style={styles.ranges}>
        {RANGES.map((item) => (
          <Pressable key={item.id} onPress={() => setRange(item.id)} accessibilityState={{ selected: range === item.id }} style={[styles.range, range === item.id ? styles.rangeOn : null]}>
            <Text style={[styles.rangeText, range === item.id ? styles.rangeTextOn : null]}>{t(`shop.range.${item.id}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.bigMoney}>{money(windowRevenue)}</Text>
      {change != null ? (
        <View style={styles.change}>
          {change >= 0 ? <ArrowUp size={13} color="#047857" /> : <ArrowDown size={13} color="#e11d48" />}
          <Text style={[styles.changeText, { color: change >= 0 ? '#047857' : '#e11d48' }]}>
            {t('dash.sup.vsPrevious', { pct: Math.abs(change), range: t(`shop.range.${range}`) })}
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {chips.map(({ icon: Icon, value, label, onPress }) => (
          <Pressable key={label} onPress={onPress} disabled={!onPress} style={styles.chip}>
            {/* Icon above the figure: three side by side never fit a phone's width otherwise. */}
            <View style={styles.chipIcon}><Icon size={15} color="#f97316" /></View>
            <Text style={styles.chipValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.chipLabel} numberOfLines={2}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 8 }}>
        {hasSales ? <SalesLine series={series.map((bucket) => ({ label: bucket.label, total: bucket.revenue }))} money={money} /> : (
          <View style={styles.noSales}>
            <Text style={styles.noSalesTitle}>{t('shop.noOrders')}</Text>
            <Text style={styles.empty}>{t('shop.noOrdersHint')}</Text>
          </View>
        )}
      </View>
    </Panel>
  )
}

// ---------------------------------------------------------------- dashboard search

/** Requests, projects and clients matching the dashboard search, each opening where it lives. */
export function SearchResults({ query, requests, projects, clients, onRequests, onProjects, onClients }) {
  const { t, td } = useLanguage()
  const words = query.trim().toLowerCase()
  const matches = (...fields) => fields.filter(Boolean).some((field) => String(field).toLowerCase().includes(words))
  const groups = [
    {
      label: t('ui.requests'),
      rows: requests.filter((request) => matches(request.profile_name, request.sender_name, request.project_title, request.status)).slice(0, 6).map((request) => {
        const key = REQUEST_STATUS_KEYS[String(request.status || '').toLowerCase()]
        return { key: `req-${request.id}`, icon: Building2, tint: 'sky', title: td(request.profile_name || request.sender_name), sub: `${td(request.project_title || '')}${key ? ` · ${t(key)}` : ''}`, onPress: onRequests }
      }),
    },
    {
      label: t('ui.myProjects'),
      rows: projects.filter((project) => matches(project.title, project.requester?.name)).slice(0, 6).map((project) => (
        { key: `project-${project.project_id}`, icon: FolderKanban, tint: 'emerald', title: td(project.title), sub: td(project.requester?.name), onPress: onProjects }
      )),
    },
    {
      label: t('ui.findClients'),
      rows: clients.filter((client) => matches(client.name, client.company_name, client.project_title, client.pincode)).slice(0, 6).map((client) => ({
        key: `client-${client.type}-${client.user_id}`,
        icon: client.type === 'OWNER' ? Home : Building2,
        tint: 'amber',
        title: td(client.name || client.company_name),
        sub: client.type === 'OWNER' ? (client.project_title ? td(client.project_title) : t('role.owner')) : t('role.builder'),
        onPress: onClients,
      })),
    },
  ].filter((group) => group.rows.length)

  return (
    <Panel icon={Search} title={t('dash.supplier.searchResults', { query })}>
      {groups.length ? groups.map((group) => (
        <View key={group.label} style={{ gap: 6, marginBottom: 6 }}>
          <Text style={styles.groupLabel}>{`${group.label} · ${group.rows.length}`}</Text>
          {group.rows.map(({ key, icon: Icon, tint, title, sub, onPress }) => (
            <Pressable key={key} onPress={onPress} style={styles.resultRow}>
              <View style={[styles.rowIcon, styles[`tint_${tint}`]]}><Icon size={15} color={TINT_INK[tint]} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{title || '—'}</Text>
                {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
              </View>
              <ChevronRight size={15} color={COLORS.slate[400]} />
            </Pressable>
          ))}
        </View>
      )) : <Empty text={t('dash.supplier.noSearchResults', { query })} />}
    </Panel>
  )
}

const styles = createStyles((c) => ({
  panel: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14, gap: 10 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  panelTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  panelIcon: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  panelTitle: { flexShrink: 1, fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  tint_brand: { backgroundColor: c.brandSoft },
  tint_emerald: { backgroundColor: c.emeraldSoft },
  tint_amber: { backgroundColor: c.amberSoft },
  tint_sky: { backgroundColor: c.skySoft },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  empty: { paddingVertical: 14, textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  timelineRail: { alignSelf: 'stretch', width: 11, alignItems: 'center' },
  timelineDot: { marginTop: 13, height: 11, width: 11, borderRadius: 6, borderWidth: 2, borderColor: c.card, backgroundColor: '#059669' },
  timelineLine: { position: 'absolute', top: 24, bottom: -12, width: 1, backgroundColor: c.emeraldBorder },
  rowIcon: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  rowTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  rowSub: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  rowTime: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textFaint },
  strong: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: c.borderSoft, paddingVertical: 9 },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  pill_amber: { backgroundColor: c.amberSoft },
  pillText_amber: { color: c.amberText },
  pill_emerald: { backgroundColor: c.emeraldSoft },
  pillText_emerald: { color: c.emeraldText },
  pill_rose: { backgroundColor: c.roseSoft },
  pillText_rose: { color: c.roseText },
  pill_slate: { backgroundColor: c.muted },
  pillText_slate: { color: c.textMuted },
  pill_sky: { backgroundColor: c.skySoft },
  pillText_sky: { color: c.skyText },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  topImage: { height: 46, width: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle },
  barRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: c.muted },
  barFill: { height: '100%', borderRadius: 3 },
  barPct: { width: 34, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textMuted },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
  actionText: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold' },
  ranges: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 2 },
  range: { height: 30, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12 },
  rangeOn: { backgroundColor: '#134127' },
  rangeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  rangeTextOn: { color: '#ffffff' },
  bigMoney: { fontSize: 27, letterSpacing: -0.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  change: { marginTop: -6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, gap: 4, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 9 },
  chipIcon: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.orangeSoft },
  chipValue: { fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  chipLabel: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  noSales: { alignItems: 'center', gap: 2, borderRadius: 12, backgroundColor: c.subtle, paddingVertical: 18 },
  noSalesTitle: { fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  groupLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.textFaint },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
}))
