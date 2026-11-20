// The Site Engineer's Dashboard tab — port of the web pages/engineer/
// EngineerDashboard.jsx 'dashboard' section and EngineerDashboardOverview.jsx:
//   the cream welcome banner with the project picker and today's date,
//   Quick Actions, the four budget figures, Budget Utilization, Cost Breakdown,
//   Daily Expenditure (7 / 30 days / this month / all), Site Activity Overview,
//   Recent Activities and Top Materials Usage.
// Wired to: GET /engineers/my-projects, GET /engineers/team,
// GET /material-requests/mine, GET /notifications and
// GET /cost-tool/projects/{id}/summary — the same calls as the web.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import {
  ArrowRight, BarChart3, Bell, BellRing, Briefcase, Building2, CalendarDays, ClipboardCheck, ClipboardList,
  FileText, FolderKanban, HandCoins, Hammer, Layers, Package, PackageSearch, PieChart, ReceiptText, ShoppingCart,
  Truck, Users, Wallet, Wrench, Zap,
} from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { Section, SelectChip } from '../../components/builder/BuilderUi'
import { BudgetRing, WelcomeBanner } from '../../components/builder/BuilderDashboardParts'
import { useLanguage } from '../../i18n/LanguageContext'
import { useNotifications } from '../../notifications/NotificationsContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchEngineerProjects, fetchEngineerTeam } from '../../api/engineers'
import { fetchMyMaterialRequests } from '../../api/materialRequests'
import { fetchCostToolSummary } from '../../api/costTool'
import { formatMoney } from '../../utils/countryConfig'
import { formatDate, formatRelativeTime, weekdayName } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const money = (value, country) => formatMoney(value, country)
const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2))) }
const UNIT_SYMBOLS = new Set(['m', 'm2', 'm3', 'mm', 'cm', 'km', 'sqm', 'sqft', 'cum', 'cft', 'rmt', 'kg', 'g', 'mt', 'l', 'ltr', 'ml', '%'])
const UNIT_WORD_KEYS = { ton: 'opt.unit.ton', bags: 'opt.unit.bags', nos: 'opt.unit.nos' }
const unitLabelFrom = (t, td) => (unit) => {
  const value = String(unit || '')
  if (!value) return ''
  if (UNIT_WORD_KEYS[value]) return t(UNIT_WORD_KEYS[value])
  return UNIT_SYMBOLS.has(value.toLowerCase()) ? value : td(value)
}

const RANGES = ['7', '30', 'month', 'all']
const ACTIVITY_ICONS = { supplier: Truck, material: Package, team: Users, task: ClipboardCheck, budget: HandCoins, message: Bell }
function activityIcon(notification) {
  const text = `${notification.module || ''} ${notification.title || ''}`.toLowerCase()
  const match = Object.keys(ACTIVITY_ICONS).find((key) => text.includes(key))
  return ACTIVITY_ICONS[match] || BellRing
}

function Panel({ icon: Icon, title, action, children }) {
  return (
    <Section>
      <View style={styles.ed7}>
        <View style={styles.ed8}>
          <View style={styles.ed9}>
            <Icon size={18} color={COLORS.brand[700]} />
            <Text style={styles.ed10} numberOfLines={1}>{title}</Text>
          </View>
          {action}
        </View>
        {children}
      </View>
    </Section>
  )
}

function LinkButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.ed11}>
      <Text style={styles.ed12}>{label}</Text>
      <ArrowRight size={13} color={COLORS.brand[700]} />
    </Pressable>
  )
}

function Empty({ children }) {
  return (
    <View style={styles.ed13}>
      <Text style={styles.ed14}>{children}</Text>
    </View>
  )
}

function Bar({ value, color }) {
  return (
    <View style={styles.ed15}>
      <View style={[styles.ed16, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  )
}

function Kpi({ icon: Icon, label, value, sub, chip, children }) {
  return (
    <View style={styles.ed17}>
           <View style={[styles.ed18, { backgroundColor: soft(chip.bg, chip.fg) }]}>
        <Icon size={16} color={ink(chip.fg)} />
      </View>
      <View style={styles.ed19}>
        <Text style={styles.ed20} numberOfLines={1}>{label}</Text>
        <Text style={styles.ed21} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {sub ? <Text style={styles.ed22} numberOfLines={1}>{sub}</Text> : null}
        {children}
      </View>
    </View>
  )
}

/** Daily Expenditure line (web EngineerAnalyticsSection DailyLine). */
function DailyLine({ series, country }) {
  const [width, setWidth] = useState(0)
  if (!series.length) return null
  const height = 170
  const padX = 34
  const padTop = 26
  const padBottom = 26
  const maxValue = Math.max(...series.map((point) => point.total), 1)
  const innerWidth = Math.max(width - padX * 2, 1)
  const innerHeight = height - padTop - padBottom
  const stepX = series.length > 1 ? innerWidth / (series.length - 1) : 0
  const points = series.map((point, index) => ({
    x: padX + (series.length > 1 ? index * stepX : innerWidth / 2),
    y: padTop + innerHeight - (point.total / maxValue) * innerHeight,
    ...point,
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  const areaPath = `${path} L${points[points.length - 1].x},${padTop + innerHeight} L${points[0].x},${padTop + innerHeight} Z`
  const labelEvery = Math.ceil(series.length / 4)
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="engLineFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#2e7d55" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#2e7d55" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Line x1={padX} y1={padTop + innerHeight} x2={width - padX} y2={padTop + innerHeight} stroke="#e2e8f0" strokeWidth="1" />
          <Path d={areaPath} fill="url(#engLineFill)" />
          <Path d={path} fill="none" stroke="#2e7d55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <Circle key={`p${index}`} cx={point.x} cy={point.y} r="3.5" fill="#ffffff" stroke="#2e7d55" strokeWidth="2" />
          ))}
          {series.length <= 6 && points.map((point, index) => (
            <SvgText key={`v${index}`} x={point.x} y={point.y - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill={ink('#475569')}>{money(point.total, country)}</SvgText>          ))}
          {points.map((point, index) => ((index % labelEvery === 0 || index === points.length - 1) ? (
            <SvgText key={`l${index}`} x={point.x} y={height - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">{point.label}</SvgText>
          ) : null))}
        </Svg>
      ) : null}
    </View>
  )
}

function QuickActionCard({ icon: Icon, label, hint, tone, onPress }) {
  return (
      <Pressable onPress={onPress} style={[styles.ed23, { backgroundColor: soft(tone.bg, tone.ink), borderColor: line(tone.border, tone.ink) }]}>
      <View style={[styles.ed24, { backgroundColor: soft(tone.chip, tone.ink) }]}>
        <Icon size={18} color={ink(tone.ink)} />
      </View>
      <Text style={styles.ed25} numberOfLines={1}>{label}</Text>
      <Text style={styles.ed26} numberOfLines={2}>{hint}</Text>
    </Pressable>
  )
}

const TONES = {
  order: { bg: '#fff7ed', border: '#fed7aa', chip: '#ffedd5', ink: '#ea580c' },
  construction: { bg: '#eff6ff', border: '#bfdbfe', chip: '#dbeafe', ink: '#1d4ed8' },
  buySell: { bg: '#faf5ff', border: '#e9d5ff', chip: '#f3e8ff', ink: '#7e22ce' },
}

export default function EngineerDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { notifications } = useNotifications()
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchEngineerProjects, [])
  const team = useAsyncData(fetchEngineerTeam, [])
  const materials = useAsyncData(fetchMyMaterialRequests, [])
  useLiveRefresh(() => { projects.reload(); team.reload(); materials.reload() })

  const projectList = Array.isArray(projects.data) ? projects.data : []
  const teams = team.data?.teams || []
  const materialRequests = Array.isArray(materials.data) ? materials.data : []

  // The project the figures are for: picked here, the first project until then.
  const [pickedProjectId, setPickedProjectId] = useState('')
  const projectId = pickedProjectId || (projectList[0] ? String(projectList[0].id) : '')
  const summary = useAsyncData(() => (projectId ? fetchCostToolSummary(projectId) : Promise.resolve(null)), [projectId])
  // As the web: the figures refresh when the engineer comes back to the tab.
  useFocusEffect(useCallback(() => { summary.reload() }, [summary.reload]))
  const [range, setRange] = useState('all')
  const [allMaterials, setAllMaterials] = useState(false)
  const unitLabel = unitLabelFrom(t, td)

  const onRefresh = async () => {
    setRefreshing(true)
    try { await Promise.all([projects.reload(), team.reload(), materials.reload(), summary.reload()]) } finally { setRefreshing(false) }
  }

  const project = projectList.find((item) => String(item.id) === String(projectId))
  const country = project?.project_country
  const data = summary.data
  const dash = data?.dashboard || {}
  const budget = Number(dash.estimated_budget || 0)
  const spent = Number(dash.spent_budget || 0)
  const remaining = budget - spent
  const pct = Number(dash.budget_percentage || 0)
  const days = data?.registers?.length || 0
  const ready = Boolean(projectId && data)
  const show = (value) => (ready ? value : summary.loading ? '…' : '—')

  const categories = [
    { key: 'material', label: t('dash.engineer.analytics.material'), value: Number(dash.material_cost || 0), icon: Building2, bar: '#1f7a4d', chip: { bg: '#f0f9ff', fg: '#0369a1' } },
    { key: 'labour', label: t('dash.engineer.analytics.labour'), value: Number(dash.labour_cost || 0), icon: Hammer, bar: '#fbbf24', chip: { bg: '#fffbeb', fg: '#d97706' } },
    { key: 'equipment', label: t('dash.engineer.analytics.equipment'), value: Number(dash.machinery_cost || 0), icon: Wrench, bar: '#38bdf8', chip: { bg: '#f0f9ff', fg: '#0284c7' } },
    { key: 'other', label: t('dash.engineer.analytics.otherExpenses'), value: Number(dash.expenses || 0), icon: Layers, bar: '#8b5cf6', chip: { bg: '#f5f3ff', fg: '#7c3aed' } },
  ]
  const categoryTotal = categories.reduce((sum, item) => sum + item.value, 0)

  const dailySeries = useMemo(() => {
    const now = new Date()
    const since = range === '7' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      : range === '30' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
        : range === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
          : null
    return [...(data?.registers || [])]
      .filter((register) => !since || new Date(`${String(register.work_date).slice(0, 10)}T00:00:00`) >= since)
      .sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)))
      .map((register) => ({
        label: formatDate(register.work_date, '', { day: '2-digit', month: 'short' }),
        total: Number(register.labour_cost || 0) + Number(register.material_cost || 0) + Number(register.equipment_cost || 0) + Number(register.total_expenses || 0),
      }))
      .filter((point) => point.total > 0)
  }, [data, range])
  const dailyTotal = dailySeries.reduce((sum, point) => sum + point.total, 0)

  const materialRows = useMemo(() => [...(data?.materials || [])]
    .map((item) => ({ ...item, cost: Number(item.total_used || 0) * Number(item.rate || 0) }))
    .sort((a, b) => b.cost - a.cost || Number(b.total_used || 0) - Number(a.total_used || 0)), [data])
  const shownMaterials = allMaterials ? materialRows : materialRows.slice(0, 4)
  const recent = notifications.slice(0, 4)

  const pendingTeamInvitationCount = teams.filter((item) => item.status === 'PENDING').length
  const pendingSupplierRequestCount = materialRequests.filter((request) => request.status === 'PENDING').length
  const unreadActivityCount = notifications.filter((notification) => !notification.is_read).length

  const goSuppliers = (tab) => navigation.navigate('EngineerSuppliersTab', tab ? { tab } : undefined)
  const goOpportunities = (tab) => navigation.navigate('EngineerJobsTab', tab ? { tab } : undefined)
  const quickActions = [
    // A Site Engineer's material is requested from the builder's Store Manager (Store).
    { id: 'order', tone: TONES.order, icon: ShoppingCart, label: t('owner.quick.order'), hint: t('owner.quick.orderSub'), onPress: () => goSuppliers('store') },
    { id: 'suppliers', tone: TONES.construction, icon: PackageSearch, label: t('dash.eng.viewSuppliers'), hint: t('dash.eng.viewSuppliersSub'), onPress: () => goSuppliers('home') },
    { id: 'opportunities', tone: TONES.buySell, icon: Briefcase, label: t('ui.findOpportunities'), hint: t('dash.eng.findOpportunitiesSub'), onPress: () => goOpportunities() },
  ]
  const activityTiles = [
    { id: 'projects', icon: Building2, label: t('ui.myProjects'), value: projectList.length, card: { bg: '#f0f9ff', border: '#e0f2fe' }, chip: { bg: '#e0f2fe', fg: '#0369a1' }, onPress: () => navigation.navigate('EngineerProjectsTab') },
    { id: 'invitations', icon: Users, label: t('dash.pendingTeamInvitations'), value: pendingTeamInvitationCount, note: t('dash.eng.pending'), card: { bg: '#fff7ed', border: '#ffedd5' }, chip: { bg: '#ffedd5', fg: '#ea580c' }, onPress: () => goOpportunities('joinTeam') },
    { id: 'supplierRequests', icon: Truck, label: t('dash.pendingSupplierRequests'), value: pendingSupplierRequestCount, note: t('dash.eng.pending'), card: { bg: '#f5f3ff', border: '#ede9fe' }, chip: { bg: '#ede9fe', fg: '#6d28d9' }, onPress: () => goSuppliers() },
    { id: 'unread', icon: Bell, label: t('dash.unreadActivity'), value: unreadActivityCount, note: t('dash.eng.notifications'), card: { bg: '#fffbeb', border: '#fef3c7' }, chip: { bg: '#fef3c7', fg: '#d97706' }, onPress: () => navigation.navigate('Notifications') },
  ]

  const today = new Date()
  const heroAside = (
    <View style={styles.ed27}>
      {projectList.length > 1 ? (
        <SelectChip
          placeholder={t('dash.engineer.analytics.selectProject')}
          value={projectId}
          onChange={(value) => setPickedProjectId(value)}
          options={projectList.map((item) => ({ value: String(item.id), label: td(item.title) }))}
        />
      ) : null}
      <View style={styles.ed28}>
        <CalendarDays size={20} color="#f97316" />
        <View>
          <Text style={[styles.ed29, { color: '#3d5246' }]}>{t('dash.eng.today')}</Text>
          <Text style={[styles.ed30, { color: '#083E2B' }]}>{formatDate(today)}</Text>
          <Text style={[styles.ed31, { color: '#3d5246' }]}>{weekdayName(today.getDay(), { weekday: 'long' })}</Text>
        </View>
      </View>
    </View>
  )

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Section>
        <WelcomeBanner
          role="ENGINEER"
          imagePath={user?.profile_image_url}
          title={t('dash.engineer.hero.welcome', { name: td(user?.name || '') || t('role.engineer') })}
          subtitle={t('dash.engineer.hero.sub')}
          aside={heroAside}
        />
      </Section>

      {/* Quick Actions */}
      <Section>
        <Text style={styles.ed32}>{t('dash.engineer.quickActions')}</Text>
        <View style={styles.ed33}>
          {quickActions.map((action) => <QuickActionCard key={action.id} {...action} />)}
        </View>
      </Section>

      {/* Budget figures for the chosen project */}
      <Section>
        <View style={styles.ed33}>
          <Kpi icon={ReceiptText} label={t('dash.engineer.analytics.projectBudget')} value={show(money(budget, country))} sub={td(project?.title || '')} chip={{ bg: '#ecfdf5', fg: '#047857' }}>
            {ready && budget > 0 ? (
              <View style={styles.ed34}>
                <View style={styles.ed19}><Bar value={pct} color={COLORS.brand[700]} /></View>
                <Text style={styles.ed35}>{t('dash.eng.usedPct', { pct })}</Text>
              </View>
            ) : null}
          </Kpi>
          <Kpi icon={Wallet} label={t('dash.engineer.analytics.totalSpent')} value={show(money(spent, country))}
            sub={ready ? (days ? t('dash.engineer.analytics.daysRecorded', { n: days }) : t('dash.engineer.analytics.noExpenses')) : ''}
            chip={{ bg: '#ffedd5', fg: '#ea580c' }} />
          <Kpi icon={PieChart} label={t('dash.engineer.analytics.remainingBudget')} value={show(money(Math.max(0, remaining), country))}
            sub={ready && budget > 0 ? (remaining < 0 ? t('dash.engineer.analytics.budgetExceeded') : t('dash.eng.remainingPct', { pct: Math.round((remaining / budget) * 10000) / 100 })) : ''}
            chip={{ bg: '#e0f2fe', fg: '#0284c7' }} />
          <Kpi icon={BarChart3} label={t('dash.engineer.analytics.budgetUtilization')} value={show(`${pct}%`)} chip={{ bg: '#ecfdf5', fg: '#059669' }}>
            {ready ? <View style={styles.ed36}><Bar value={pct} color={pct > 90 ? '#f43f5e' : pct > 75 ? '#fb923c' : '#fbbf24'} /></View> : null}
          </Kpi>
        </View>
        {!projectId ? <Empty>{t('dash.eng.noProject')}</Empty> : null}
      </Section>

      {/* Budget Utilization */}
      <Panel icon={BarChart3} title={t('dash.engineer.analytics.budgetUtilization')}>
        {ready && budget > 0 ? (
          <View style={styles.ed37}>
            <BudgetRing share={(spent / budget) * 100} size={124} thickness={15} centerValue={`${Math.round((spent / budget) * 100)}%`} centerLabel={t('dash.eng.used')} />
            <View style={styles.ed38}>
              <View style={styles.ed39}>
                <View style={styles.ed40}><View style={[styles.ed41, { backgroundColor: '#1f7a4d' }]} /><Text style={styles.ed42}>{t('dash.engineer.analytics.spent')}</Text></View>
                <Text style={styles.ed43}>{money(spent, country)}</Text>
              </View>
              <View style={styles.ed39}>
                <View style={styles.ed40}><View style={styles.ed44} /><Text style={styles.ed42}>{t('dash.engineer.analytics.remaining')}</Text></View>
                <Text style={styles.ed43}>{money(Math.max(0, remaining), country)}</Text>
              </View>
              <View style={styles.ed45}>
                <Text style={styles.ed43}>{t('dash.eng.totalBudget')}</Text>
                <Text style={styles.ed46}>{money(budget, country)}</Text>
              </View>
            </View>
          </View>
        ) : <Empty>{ready ? t('dash.engineer.analytics.noBudgetYet') : '—'}</Empty>}
      </Panel>

      {/* Cost Breakdown */}
      <Panel icon={HandCoins} title={t('dash.engineer.analytics.costBreakdown')}>
        {ready && categoryTotal > 0 ? categories.map((item) => {
          const share = categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 100) : 0
          return (
            <View key={item.key} style={styles.ed47}>
              <View style={[styles.ed18, { backgroundColor: soft(item.chip.bg, item.chip.fg) }]}><item.icon size={16} color={ink(item.chip.fg)} /></View>   
                         <View style={styles.ed19}>
                <View style={styles.ed48}>
                  <Text style={styles.ed49} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.ed50}>{money(item.value, country)}</Text>
                </View>
                <Bar value={share} color={item.bar} />
              </View>
              <Text style={styles.ed51}>{share}%</Text>
            </View>
          )
        }) : <Empty>{ready ? t('dash.engineer.analytics.noExpenses') : '—'}</Empty>}
      </Panel>

      {/* Daily Expenditure */}
      <Panel icon={FileText} title={t('dash.engineer.analytics.dailyExpenditure')}>
        {ready ? <Text style={styles.ed52}>{money(dailyTotal, country)}</Text> : null}
        <View style={styles.ed53}>
          {RANGES.map((item) => (
            <Pressable key={item} onPress={() => setRange(item)} style={[styles.ed1, range === item ? styles.ed2 : styles.ed3]}>
              <Text style={[styles.ed4, range === item ? styles.ed5 : styles.ed6]}>{t(`dash.eng.range.${item}`)}</Text>
            </Pressable>
          ))}
        </View>
        {dailySeries.length ? <DailyLine series={dailySeries} country={country} /> : <Empty>{ready ? t('dash.engineer.analytics.noExpenses') : '—'}</Empty>}
      </Panel>

      {/* Site Activity Overview */}
      <Panel icon={FolderKanban} title={t('dash.eng.siteActivity')}>
        <View style={styles.ed33}>
          {activityTiles.map((tile) => (
                       <Pressable key={tile.id} onPress={tile.onPress} style={[styles.ed54, { backgroundColor: soft(tile.card.bg, tile.chip.fg), borderColor: line(tile.card.border, tile.chip.fg) }]}>
              <View style={[styles.ed55, { backgroundColor: soft(tile.chip.bg, tile.chip.fg) }]}><tile.icon size={18} color={ink(tile.chip.fg)} /></View>
              <View style={styles.ed19}>
                <Text style={styles.ed56} numberOfLines={2}>{tile.label}</Text>
                <View style={styles.ed57}>
                  <Text style={styles.ed58}>{tile.value}</Text>
                  {tile.note ? <Text style={styles.ed59} numberOfLines={1}>{tile.note}</Text> : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </Panel>

      {/* Recent Activities: the latest notifications */}
      <Panel icon={ClipboardList} title={t('dash.eng.recentActivities')} action={<LinkButton label={t('dash.eng.viewAll')} onPress={() => navigation.navigate('Notifications')} />}>
        {recent.length ? recent.map((notification) => {
          const Icon = activityIcon(notification)
          return (
            <View key={notification.id} style={styles.ed60}>
              <View style={styles.ed61}><Icon size={16} color={ink('#047857')} /></View>     
                       <View style={styles.ed19}>
                <Text style={styles.ed62} numberOfLines={1}>{td(notification.title)}</Text>
                {notification.body ? <Text style={styles.ed63} numberOfLines={1}>{td(notification.body)}</Text> : null}
              </View>
              <Text style={styles.ed64}>{formatRelativeTime(notification.created_at)}</Text>
            </View>
          )
        }) : <Empty>{t('dash.eng.noActivity')}</Empty>}
      </Panel>

      {/* Top Materials Usage */}
      <Panel
        icon={Zap}
        title={t('dash.eng.topMaterials')}
        action={materialRows.length > 4 ? <LinkButton label={allMaterials ? t('dash.eng.showLess') : t('dash.eng.viewAll')} onPress={() => setAllMaterials((value) => !value)} /> : null}
      >
        {materialRows.length ? (
          <View>
            <View style={styles.ed65}>
              <Text style={styles.ed66}>{t('dash.engineer.analytics.material')}</Text>
              <Text style={styles.ed67}>{t('dash.engineer.analytics.used')}</Text>
              <Text style={styles.ed67}>{t('dash.engineer.analytics.remaining')}</Text>
              <Text style={styles.ed68}>{t('dash.engineer.analytics.cost')}</Text>
            </View>
            {shownMaterials.map((item) => (
              <View key={item.material} style={styles.ed69}>
                <Text style={styles.ed70} numberOfLines={1}>{td(item.material)}</Text>
                <Text style={styles.ed71} numberOfLines={1}>{`${formatQty(item.total_used)} ${unitLabel(item.unit)}`}</Text>
                <Text style={styles.ed71} numberOfLines={1}>{`${formatQty(item.remaining)} ${unitLabel(item.unit)}`}</Text>
                <Text style={styles.ed72} numberOfLines={1}>{item.cost > 0 ? money(item.cost, country) : '—'}</Text>
              </View>
            ))}
          </View>
        ) : <Empty>{ready ? t('dash.engineer.analytics.noMaterialRecords') : '—'}</Empty>}
      </Panel>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  ed1: { height: 28, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 10.5 },
  ed2: { backgroundColor: '#134127' },
  ed3: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  ed4: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  ed5: { color: '#ffffff' },
  ed6: { color: c.textSecondary },
  ed7: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  ed8: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10.5 },
  ed9: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  ed10: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  ed11: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  ed12: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.brandText },
  ed13: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 21 },
  ed14: { textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textFaint },
  ed15: { height: 7, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  ed16: { height: '100%', borderRadius: 9999 },
  ed17: { marginBottom: 8.75, width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 8.75, paddingVertical: 7 },
  ed18: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  ed19: { flex: 1 },
  ed20: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  ed21: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, lineHeight: 24, color: c.text },
  ed22: { fontSize: 11, color: c.textMuted },
  ed23: { marginBottom: 8.75, width: '48.5%', borderRadius: 16, borderWidth: 1, padding: 10.5 },
  ed24: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  ed25: { marginTop: 7, fontSize: 13, fontWeight: '800', color: c.text },
  ed26: { marginTop: 1.75, fontSize: 11, fontWeight: '500', color: c.textMuted },
  ed27: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  ed28: { flexDirection: 'row', alignItems: 'center', gap: 8.75, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingHorizontal: 10.5, paddingVertical: 5.25 },
  ed29: { fontSize: 10.5, fontWeight: '600' },
  ed30: { fontSize: 13, fontWeight: '800' },
  ed31: { fontSize: 10.5 },
  ed32: { marginBottom: 5.25, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: c.textMuted },
  ed33: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  ed34: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  ed35: { fontSize: 10, fontWeight: '700', color: c.brandText },
  ed36: { marginTop: 5.25 },
  ed37: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ed38: { flex: 1, gap: 8.75 },
  ed39: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  ed40: { flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  ed41: { height: 10.5, width: 10.5, borderRadius: 9999 },
  ed42: { fontSize: 12, lineHeight: 16, color: c.textSecondary },
  ed43: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSoft },
  ed44: { height: 10.5, width: 10.5, borderRadius: 9999, backgroundColor: '#fbbf24' },
  ed45: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
  ed46: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  ed47: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  ed48: { marginBottom: 3.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  ed49: { flex: 1, fontSize: 13, color: c.textSoft },
  ed50: { fontSize: 13, fontWeight: '600', color: c.textSoft },
  ed51: { width: 31.5, textAlign: 'right', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  ed52: { marginBottom: 7, fontFamily: 'Manrope_800ExtraBold', fontSize: 24, lineHeight: 32, color: c.text },
  ed53: { marginBottom: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 5.25 },
  ed54: { marginBottom: 8.75, width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8.75, borderRadius: 12, borderWidth: 1, padding: 10.5 },
  ed55: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  ed56: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  ed57: { flexDirection: 'row', alignItems: 'baseline', gap: 3.5 },
  ed58: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: c.text },
  ed59: { fontSize: 10, color: c.textMuted },
  ed60: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  ed61: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: soft('#ecfdf5', '#047857') },  ed62: { fontSize: 13, fontWeight: '600', color: c.text },
  ed63: { fontSize: 12, lineHeight: 16, color: c.textMuted },
  ed64: { fontSize: 11, color: c.textFaint },
  ed65: { flexDirection: 'row', backgroundColor: c.subtle, paddingHorizontal: 7, paddingVertical: 7 },
  ed66: { flex: 1.4, fontSize: 11, fontWeight: '600', color: c.textMuted },
  ed67: { flex: 1, fontSize: 11, fontWeight: '600', color: c.textMuted },
  ed68: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '600', color: c.textMuted },
  ed69: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 7, paddingVertical: 7 },
  ed70: { flex: 1.4, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSoft },
  ed71: { flex: 1, fontSize: 12, lineHeight: 16, color: c.textSecondary },
  ed72: { flex: 1, textAlign: 'right', fontSize: 12, lineHeight: 16, color: c.textSoft },
}))