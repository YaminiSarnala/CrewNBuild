// Port of the web src/pages/owner/OwnerOverviewSection.jsx (+ the quick actions
// and discovery strips from OwnerDashboard.jsx / ownerDiscovery.jsx).
//
// The House Owner's landing screen, read across every project at once:
//   welcome · four figures · quick actions · technicians · materials ·
//   recent activity · upcoming deadlines · project status · budget per project
//
// Wired to GET /owners/projects, GET /project-requests/incoming and
// GET /shop/products. Everything else is derived from those, as on the web.
// Money is never summed across countries: each project shows its own currency
// and the budget totals are one line per country.
import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from '@react-navigation/native'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useSelector } from 'react-redux'
import {
  Activity, ArrowRight, Calendar, Check, ClipboardList, HardHat, House as Home,
  Layers, Package, TrendingUp, Users, X,
} from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import StatusPill from '../../components/StatusPill'
import { fetchOwnerProjects } from '../../api/projects'
import { fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest } from '../../api/requests'
import { fetchShopProducts } from '../../api/shop'
import { imageSource, apiErrorMessage } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useResponsive } from '../../hooks/useResponsive'
import { userCountry } from '../../utils/countryConfig'
import { formatDateTime, todayCalendarDate } from '../../utils/formatters'
import { COLORS, SHADOW } from '../../theme/tokens'
import {
  clampPercent, constructionTypeText, countryText, currentProjectAmount, formatProjectDate,
  isProjectCompleted, money, projectBuilderContext, projectTitle, requestTypeLabel,
} from './ownerHelpers'
import { createStyles } from '../../theme/createStyles'
import { useComingSoon, SoonTag } from '../../components/ComingSoon'
import { COMING_SOON } from '../../config/modules'

const HERO_ART = require('../../../assets/octabuild/heroes/owner.png')

// Each quick action's tint, picture and accent — blue, purple, green, orange.
const QUICK_STYLE = {
  construction: { bg: '#dbeafe', border: '#93c5fd', chip: '#bfdbfe', ink: '#1d4ed8', image: require('../../../assets/octabuild/owner-quick/construction.png') },
  buySell: { bg: '#f3e8ff', border: '#d8b4fe', chip: '#e9d5ff', ink: '#7e22ce', image: require('../../../assets/octabuild/owner-quick/property.png') },
  technician: { bg: '#dcfce7', border: '#86efac', chip: '#bbf7d0', ink: '#15803d', image: require('../../../assets/octabuild/owner-quick/technician.png') },
  order: { bg: '#ffedd5', border: '#fdba74', chip: '#fed7aa', ink: '#c2410c', image: require('../../../assets/octabuild/owner-quick/materials.png') },
}

// Partner's four trades, in the web's order and tints. The code is what
// BookTechnicianScreen uses for its trade picker.
const TRADES = [
  { code: 'PAINTER', labelKey: 'owner.tech.painter', descKey: 'owner.tech.painterDesc', bg: '#ecfdf5', border: '#d1fae5', ink: '#047857', image: require('../../../assets/octabuild/owner-technicians/painter.png') },
  { code: 'PLUMBER', labelKey: 'owner.tech.plumber', descKey: 'owner.tech.plumberDesc', bg: '#f0f9ff', border: '#e0f2fe', ink: '#0369a1', image: require('../../../assets/octabuild/owner-technicians/plumber.png') },
  { code: 'ELECTRICIAN', labelKey: 'owner.tech.electrician', descKey: 'owner.tech.electricianDesc', bg: '#fffbeb', border: '#fef3c7', ink: '#b45309', image: require('../../../assets/octabuild/owner-technicians/electrician.png') },
  { code: 'CARPENTER', labelKey: 'owner.tech.carpenter', descKey: 'owner.tech.carpenterDesc', bg: '#fff1f2', border: '#ffe4e6', ink: '#be123c', image: require('../../../assets/octabuild/owner-technicians/carpenter.png') },
]

const MAX_PRODUCTS = 6
// Each list panel is bounded and scrolls inside itself, so one long list can
// never push the rest of the dashboard off the screen.
const PANEL_LIST_MAX = 260

const asList = (value) => (Array.isArray(value) ? value : [])

// ---------------------------------------------------------------------------

function Card({ title, icon: Icon, action, children, style }) {
  return (
    <View style={[styles.view, [SHADOW.card, style]]}>
      <View style={[styles.view2, { gap: 8 }]}>
        {Icon && <Icon size={17} color={COLORS.brand[600]} strokeWidth={2.2} />}
        <Text style={[styles.text, { fontSize: 15.5, letterSpacing: -0.3 }]} numberOfLines={1}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  )
}

function EmptyNote({ title, message }) {
  return (
    <View style={styles.view3}>
      <Text style={[styles.text2, { fontSize: 13.5 }]}>{title}</Text>
      <Text style={[styles.text3, { fontSize: 12, lineHeight: 17 }]}>{message}</Text>
    </View>
  )
}

function ViewAll({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.view4, { gap: 3 }]}>
      <Text style={[styles.text4, { fontSize: 12 }]}>{label}</Text>
      <ArrowRight size={13} color={COLORS.brand[600]} />
    </Pressable>
  )
}

function ProgressBar({ value }) {
  return (
    <View style={styles.view5}>
      <View style={[styles.view6, { width: `${clampPercent(value)}%` }]} />
    </View>
  )
}

function Hero({ user, t, td }) {
  // Translate the whole name, then take the first word: a first name alone
  // translates less reliably than the full name it came from.
  const firstName = String(td(user?.name || '')).trim().split(/\s+/)[0]
  return (
    <View style={[styles.view7, SHADOW.card]}>
      <View style={styles.view4}>
        <View style={styles.view8}>
          <Text style={[styles.text5, { fontSize: 20, letterSpacing: -0.5 }]} numberOfLines={2}>
            {t('dash.owner.hero.welcome', { name: firstName ? `, ${firstName}` : '' })}
          </Text>
          <Text style={[styles.text6, { fontSize: 12.5, lineHeight: 18 }]} numberOfLines={4}>
            {t('dash.owner.hero.sub')}
          </Text>
        </View>
        <Image source={HERO_ART} style={{ width: 128, height: 112 }} contentFit="contain" />
      </View>
    </View>
  )
}

function Metric({ icon: Icon, tint, label, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.pressable, SHADOW.card]}>
      <View style={[styles.view9, { backgroundColor: tint.bg }]}>
        <Icon size={16} color={tint.ink} strokeWidth={2.2} />
      </View>
      <Text style={[styles.text7, { fontSize: 21 }]}>{value}</Text>
      <Text style={[styles.text8, { fontSize: 11, lineHeight: 14 }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  )
}

function QuickAction({ id, label, hint, disabled, soon, onPress, width }) {
  const look = QUICK_STYLE[id]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.pressable2, [{ width, backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.55 : 1 }, SHADOW.card]]}
    >
      <Image source={look.image} style={{ width: '100%', height: 78 }} contentFit="contain" />
      {/* The card keeps its light pastel in both themes, so its ink stays dark. */}
      {/* Pastel card in both themes, so the ink stays dark. */}
      {soon ? <SoonTag style={{ position: 'absolute', top: 8, right: 8 }} /> : null}
      <Text style={[styles.text7, { fontSize: 14, color: '#1f2937' }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.text9, { fontSize: 11, lineHeight: 15, color: '#475569' }]} numberOfLines={2}>{hint}</Text>
      <View style={[styles.view10, { backgroundColor: look.chip }]}>
        <ArrowRight size={14} color={look.ink} strokeWidth={2.4} />
      </View>
    </Pressable>
  )
}

function TradeCard({ trade, t, onBook }) {
  return (
    <View style={[styles.view11, { width: 250, backgroundColor: trade.bg, borderColor: trade.border }]}>
      <Image source={trade.image} style={{ width: 76, height: 92 }} contentFit="contain" contentPosition="top" />
      <View style={styles.view12}>
        <Text style={[styles.text10, { fontSize: 13.5, color: '#1f2937' }]} numberOfLines={1}>{t(trade.labelKey)}</Text>
        <Text style={[styles.text11, { fontSize: 11, lineHeight: 15, color: '#64748b' }]} numberOfLines={2}>{t(trade.descKey)}</Text>
        <Pressable
          onPress={() => onBook(trade.code)}
          style={[styles.pressable3, { gap: 4, borderColor: trade.border, backgroundColor: '#ffffff' }]}
        >
          <Text style={[styles.text12, { fontSize: 11, color: trade.ink }]}>{t('owner.tech.bookNow')}</Text>
          <ArrowRight size={11} color={trade.ink} />
        </Pressable>
      </View>
    </View>
  )
}

function ProductCard({ product, country, onPress }) {
  const [broken, setBroken] = useState(false)
  const price = Number(product.discounted_price ?? product.price ?? 0)
  const src = product.display_image_url || product.image_url
  return (
    <Pressable onPress={onPress} style={[styles.pressable4, { width: 150 }]}>
      <View style={styles.view13}>
        {src && !broken ? (
          <Image source={imageSource(src)} style={{ width: '100%', height: '100%' }} contentFit="contain" onError={() => setBroken(true)} />
        ) : (
          <Package size={26} color={COLORS.slate[300]} />
        )}
      </View>
      <Text style={[styles.text13, { fontSize: 12.5 }]} numberOfLines={1}>{product.name}</Text>
      <Text style={[styles.text14, { fontSize: 10.5 }]} numberOfLines={1}>
        {[product.brand, product.category].filter(Boolean).join(' · ') || ' '}
      </Text>
      <Text style={[styles.text15, { fontSize: 13.5 }]}>
        {money(price, country)}
        {product.unit ? <Text style={[styles.text16, { fontSize: 10 }]}> / {product.unit}</Text> : null}
      </Text>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------

export default function OwnerDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const { requireCompleteProfile } = useProfileGate()
  const comingSoon = useComingSoon()
  const { gutter, isTablet, isLargeTablet, width, maxContentWidth } = useResponsive()
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [busyRequestId, setBusyRequestId] = useState(null)
  const [decisionMessage, setDecisionMessage] = useState('')

  const projects = useAsyncData(fetchOwnerProjects, [])
  const requests = useAsyncData(fetchIncomingRequests, [])
  const products = useAsyncData(() => fetchShopProducts().then((reply) => asList(reply?.products)), [])

  // Come back to fresh numbers after acting on another tab (e.g. assigning a
  // builder), the native stand-in for the web's live-refresh hints.
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      projects.reload()
      requests.reload()
    }, [projects.reload, requests.reload]),
  )

  // A request, quotation or assignment changed somewhere: reload, as the web does.
  useLiveRefresh(() => {
    projects.reload()
    requests.reload()
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([projects.reload(), requests.reload(), products.reload()])
    } finally {
      setRefreshing(false)
    }
  }, [projects.reload, requests.reload, products.reload])

  const projectList = asList(projects.data)
  const requestList = asList(requests.data)
  const productList = asList(products.data).slice(0, MAX_PRODUCTS)
  const residence = userCountry(user)

  const summary = useMemo(() => {
    const total = projectList.length
    const completed = projectList.filter(isProjectCompleted).length
    // In progress: the server's `started` flag, and not yet completed.
    const active = projectList.filter((p) => p.started === true && !isProjectCompleted(p)).length
    const averageProgress = total
      ? projectList.reduce((sum, p) => sum + clampPercent(p.completion_percentage), 0) / total
      : 0
    const statusCounts = projectList.reduce((counts, p) => {
      const status = String(p.status || 'active').toLowerCase()
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})
    const budgetByCountry = projectList.reduce((totals, p) => {
      const country = p.project_country || residence
      totals[country] = (totals[country] || 0) + (currentProjectAmount(p) || 0)
      return totals
    }, {})
    return { total, active, completed, averageProgress, statusCounts, budgetByCountry }
  }, [projectList, residence])

  const pendingRequestCount = requestList.filter((r) => String(r.status || '').toLowerCase() === 'pending').length

  const upcomingDeadlines = useMemo(() => {
    const today = todayCalendarDate()
    return projectList
      .filter((p) => p.end_date && p.end_date >= today)
      .sort((a, b) => (a.end_date < b.end_date ? -1 : a.end_date > b.end_date ? 1 : 0))
  }, [projectList])

  const budgetedProjects = projectList.filter((p) => currentProjectAmount(p) !== null)
  const largestBudget = Math.max(...budgetedProjects.map(currentProjectAmount), 1)

  // Materials are ordered for a self-construction project only (same rule as web).
  const orderProject = projectList.find((p) => p.construction_type === 'SELF_CONSTRUCTION') || null

  // --- navigation targets --------------------------------------------------
  const openProjects = () => navigation.navigate('OwnerProjectsTab')
  const openProject = (project, tab) => navigation.navigate('OwnerProject', { projectId: project.id, ...(tab ? { tab } : {}) })
  // Technicians, the materials marketplace and property buy & sell belong to
  // modules that are not live yet (src/config/modules.js).
  const bookTechnician = (trade = null) => {
    if (COMING_SOON.technician) return comingSoon.show('technician')
    navigation.navigate('BookTechnician', trade ? { trade } : undefined)
  }
  const openOrder = () => {
    if (COMING_SOON.marketplace) return comingSoon.show('marketplace')
    if (orderProject) openProject(orderProject, 'suppliers')
    else navigation.navigate('OwnerShopTab', { tab: 'suppliers' })
  }
  function startProject() {
    // Creating a project needs profile data, as on the web.
    if (requireCompleteProfile(startProject)) return
    navigation.navigate('CreateProject')
  }

  const quickActions = [
    { id: 'construction', label: t('owner.quick.construction'), hint: t('owner.quick.constructionSub'), onPress: startProject },
    {
      id: 'buySell', label: t('ui.buySell'), hint: t('owner.quick.buySellSub'), soon: COMING_SOON.property,
      onPress: () => (COMING_SOON.property ? comingSoon.show('property') : navigation.navigate('OwnerShopTab', { tab: 'property' })),
    },
    { id: 'technician', label: t('ui.owner.bookTechnician'), hint: t('owner.quick.technicianSub'), soon: COMING_SOON.technician, onPress: () => bookTechnician() },
    {
      id: 'order',
      label: t('owner.quick.order'),
      hint: orderProject || COMING_SOON.marketplace ? t('owner.quick.orderSub') : t('owner.quick.orderNeedsSelf'),
      disabled: !orderProject && !COMING_SOON.marketplace,
      soon: COMING_SOON.marketplace,
      onPress: openOrder,
    },
  ]

  // --- request decisions ---------------------------------------------------
  async function decide(request, accept) {
    // Accepting needs a complete profile (the API enforces it too).
    if (accept && requireCompleteProfile(() => decide(request, accept))) return
    setBusyRequestId(request.id)
    setDecisionMessage('')
    try {
      if (accept) await acceptProjectRequest(request.id)
      else await rejectProjectRequest(request.id)
      await Promise.all([requests.reload(), projects.reload()])
    } catch (error) {
      setDecisionMessage(apiErrorMessage(error, t('dash.common.request')))
    } finally {
      setBusyRequestId(null)
    }
  }

  function confirmReject(request) {
    Alert.alert(t('dash.common.reject'), requestTypeLabel(request.request_type, t), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      { text: t('dash.common.reject'), style: 'destructive', onPress: () => decide(request, false) },
    ])
  }

  // --- layout --------------------------------------------------------------
  const contentWidth = Math.min(width, maxContentWidth) - gutter * 2
  const quickColumns = isLargeTablet ? 4 : 2
  const quickWidth = (contentWidth - 12 * (quickColumns - 1)) / quickColumns
  const twoUp = isTablet // tablets show the list panels side by side
  const pairStyle = twoUp ? { flexDirection: 'row', gap: 16, alignItems: 'stretch' } : { gap: 16 }
  const half = twoUp ? { flex: 1 } : null

  const metricTints = {
    indigo: { bg: '#e0e7ff', ink: '#4338ca' },
    green: { bg: '#dcfce7', ink: '#15803d' },
    blue: { bg: '#dbeafe', ink: '#1d4ed8' },
    rose: { bg: '#ffe4e6', ink: '#be123c' },
  }

  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <View style={{ paddingHorizontal: gutter, gap: 16 }}>
          <Hero user={user} t={t} td={td} />

          {/* The four figures */}
          <View style={{ flexDirection: 'row', flexWrap: isTablet ? 'nowrap' : 'wrap', gap: 10 }}>
            {[
              { icon: Home, tint: metricTints.indigo, label: t('dash.owner.overview.totalProjects'), value: String(summary.total), onPress: openProjects },
              { icon: HardHat, tint: metricTints.green, label: t('dash.owner.overview.activeProjects'), value: String(summary.active), onPress: openProjects },
              { icon: TrendingUp, tint: metricTints.blue, label: t('dash.owner.overview.overallProgress'), value: `${clampPercent(summary.averageProgress)}%`, onPress: openProjects },
              { icon: ClipboardList, tint: metricTints.rose, label: t('dash.owner.overview.pendingRequests'), value: String(pendingRequestCount) },
            ].map((metric) => (
              <View key={metric.label} style={isTablet ? { flex: 1 } : { width: (contentWidth - 10) / 2 }}>
                <Metric {...metric} />
              </View>
            ))}
          </View>

          {/* Quick actions */}
          <View>
            <Text style={[styles.text17, { fontSize: 11, letterSpacing: 0.8 }]}>
              {t('owner.quick.title')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {quickActions.map((action) => (
                <QuickAction key={action.id} {...action} width={quickWidth} />
              ))}
            </View>
          </View>

          {/* Technicians (Partner trades) */}
          <Card
            title={t('owner.tech.availableTitle')}
            icon={Users}
            action={<ViewAll label={t('owner.viewAll')} onPress={() => bookTechnician()} />}
          >
            <Text style={[styles.text18, { fontSize: 12 }]}>{t('owner.tech.subtitle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TRADES.map((trade) => (
                <TradeCard key={trade.code} trade={trade} t={t} onBook={bookTechnician} />
              ))}
            </ScrollView>
          </Card>

          {/* Construction materials */}
          <Card
            title={t('owner.materials.title')}
            icon={Layers}
            action={<ViewAll label={t('owner.viewAll')} onPress={openOrder} />}
          >
            <Text style={[styles.text18, { fontSize: 12 }]}>{t('owner.materials.subtitle')}</Text>
            {products.loading ? (
              <ActivityIndicator color={COLORS.brand[800]} style={{ paddingVertical: 20 }} />
            ) : productList.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {productList.map((product) => (
                  <ProductCard key={product.id} product={product} country={residence} onPress={openOrder} />
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.text19, { fontSize: 12.5 }]}>{t('owner.materials.empty')}</Text>
            )}
          </Card>

          {/* Recent activity beside upcoming deadlines */}
          <View style={pairStyle}>
            <Card title={t('dash.owner.overview.activityTitle')} icon={Activity} style={half}>
              {!!decisionMessage && (
                <View style={styles.view14}>
                  <Text style={[styles.text20, { fontSize: 12 }]}>{decisionMessage}</Text>
                </View>
              )}
              {requests.loading ? (
                <ActivityIndicator color={COLORS.brand[800]} style={{ paddingVertical: 20 }} />
              ) : requestList.length ? (
                <ScrollView style={{ maxHeight: PANEL_LIST_MAX }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {requestList.map((request) => {
                    // Only a pending request somebody else sent can be acted on.
                    const canAct = String(request.status).toLowerCase() === 'pending' && !request.is_sender
                    const busy = busyRequestId === request.id
                    return (
                      <View key={request.id} style={styles.pressable5}>
                        <View style={[styles.view4, { gap: 8 }]}>
                          <View style={styles.view15}>
                            <Text style={[styles.text2, { fontSize: 13 }]} numberOfLines={1}>
                              {requestTypeLabel(request.request_type, t)}
                            </Text>
                            <Text style={[styles.text8, { fontSize: 11 }]} numberOfLines={1}>
                              {td(request.sender_name)}
                              {request.project_title ? ` · ${request.project_title}` : ''}
                            </Text>
                          </View>
                          <StatusPill status={request.status} />
                        </View>
                        <View style={[styles.view16, { gap: 8 }]}>
                          <Text style={[styles.text21, { fontSize: 10.5 }]}>
                            {formatDateTime(request.created_at_iso || request.created_at)}
                          </Text>
                          {canAct && (
                            <View style={[styles.view17, { gap: 6 }]}>
                              <Pressable
                                onPress={() => decide(request, true)}
                                disabled={busy}
                                style={[styles.pressable6, { gap: 4, opacity: busy ? 0.6 : 1 }]}
                              >
                                <Check size={13} color="#fff" />
                                <Text style={[styles.text22, { fontSize: 11.5 }]}>{t('dash.common.accept')}</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => confirmReject(request)}
                                disabled={busy}
                                style={[styles.pressable7, { gap: 4, opacity: busy ? 0.6 : 1 }]}
                              >
                                <X size={13} color="#e11d48" />
                                <Text style={[styles.text23, { fontSize: 11.5 }]}>{t('dash.common.reject')}</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : (
                <EmptyNote title={t('dash.owner.overview.activityEmptyTitle')} message={t('dash.owner.overview.activityEmptySub')} />
              )}
            </Card>

            <Card title={t('dash.owner.overview.deadlinesTitle')} icon={Calendar} style={half}>
              {upcomingDeadlines.length ? (
                <ScrollView style={{ maxHeight: PANEL_LIST_MAX }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {upcomingDeadlines.map((project) => (
                    <Pressable
                      key={project.id}
                      onPress={() => openProject(project)}
                      style={[styles.pressable8, { gap: 8 }]}
                    >
                      <View style={styles.view15}>
                        <Text style={[styles.text2, { fontSize: 13 }]} numberOfLines={1}>{td(projectTitle(project, t))}</Text>
                        <Text style={[styles.text8, { fontSize: 11 }]}>{t('dash.owner.projectDetails.endDate')}</Text>
                      </View>
                      <View style={styles.view18}>
                        <Text style={[styles.text24, { fontSize: 11 }]}>{formatProjectDate(project.end_date, t)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <EmptyNote title={t('dash.owner.overview.deadlinesEmptyTitle')} message={t('dash.owner.overview.deadlinesEmptySub')} />
              )}
            </Card>
          </View>

          {/* Project status beside budget across projects */}
          <View style={pairStyle}>
            <Card title={t('dash.owner.overview.statusTitle')} icon={ClipboardList} style={half}>
              {projects.loading ? (
                <ActivityIndicator color={COLORS.brand[800]} style={{ paddingVertical: 20 }} />
              ) : projects.error ? (
                <Text style={[styles.text25, { fontSize: 12.5 }]}>{projects.error}</Text>
              ) : projectList.length ? (
                <>
                  <View style={[styles.view19, { gap: 6 }]}>
                    {Object.entries(summary.statusCounts).map(([status, count]) => (
                      <View key={status} style={[styles.view20, { gap: 6 }]}>
                        <StatusPill status={status} />
                        <Text style={[styles.text2, { fontSize: 11 }]}>{count}</Text>
                      </View>
                    ))}
                  </View>
                  <ScrollView style={{ maxHeight: PANEL_LIST_MAX }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {projectList.map((project) => {
                      const context = projectBuilderContext(project)
                      const builderLabel = context.kind === 'self'
                        ? constructionTypeText(project.construction_type, t)
                        : context.kind === 'builder' ? td(context.name) : t('dash.owner.projectList.notAssigned')
                      const completion = clampPercent(project.completion_percentage)
                      return (
                        <Pressable
                          key={project.id}
                          onPress={() => openProject(project)}
                          style={styles.pressable5}
                        >
                          <View style={[styles.view4, { gap: 8 }]}>
                            <View style={styles.view15}>
                              <Text style={[styles.text2, { fontSize: 13 }]} numberOfLines={1}>{td(projectTitle(project, t))}</Text>
                              <Text style={[styles.text8, { fontSize: 11 }]} numberOfLines={1}>{builderLabel}</Text>
                            </View>
                            <StatusPill status={project.status || 'active'} />
                          </View>
                          <View style={[styles.view21, { gap: 8 }]}>
                            <ProgressBar value={completion} />
                            <Text style={[styles.text26, { fontSize: 10.5 }]}>{completion}%</Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                </>
              ) : (
                <EmptyNote title={t('dash.owner.overview.emptyTitle')} message={t('dash.owner.overview.emptySub')} />
              )}
            </Card>

            <Card title={t('dash.owner.overview.budgetTitle')} icon={Home} style={half}>
              {budgetedProjects.length ? (
                <>
                  <ScrollView style={{ maxHeight: PANEL_LIST_MAX }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {budgetedProjects.map((project) => {
                      const amount = currentProjectAmount(project)
                      const share = Math.max(4, Math.round((amount / largestBudget) * 100))
                      return (
                        <View key={project.id} style={styles.view22}>
                          <View style={[styles.view23, { gap: 8 }]}>
                            <Text style={[styles.text27, { fontSize: 12 }]} numberOfLines={1}>{td(projectTitle(project, t))}</Text>
                            <Text style={[styles.text26, { fontSize: 11.5 }]}>{money(amount, project.project_country || residence)}</Text>
                          </View>
                          <View style={styles.view24}>
                            <View style={[styles.view6, { width: `${share}%` }]} />
                          </View>
                        </View>
                      )
                    })}
                  </ScrollView>
                  {/* One total per project country — currencies are never added together. */}
                  <View style={[styles.view25, { columnGap: 16, rowGap: 2 }]}>
                    {Object.entries(summary.budgetByCountry)
                      .filter(([, amount]) => amount > 0)
                      .map(([country, amount]) => (
                        <Text key={country} style={[styles.text8, { fontSize: 11.5 }]}>
                          {countryText(country, t)}: <Text style={styles.text2}>{money(amount, country)}</Text>
                        </Text>
                      ))}
                  </View>
                </>
              ) : (
                projectList.length ? (
                  // Projects exist but none carries a budget yet: say that, not "No projects yet".
                  <EmptyNote title={`${t('dash.common.budget')}: ${t('dash.common.notSet')}`} message={null} />
                ) : (
                  <EmptyNote title={t('dash.owner.overview.emptyTitle')} message={t('dash.owner.overview.emptySub')} />
                )
              )}
            </Card>
          </View>
        </View>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view3: { alignItems: 'center', paddingVertical: 17.5 },
  text2: { fontFamily: 'Inter_700Bold', color: c.text },
  text3: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  view4: { flexDirection: 'row', alignItems: 'center' },
  text4: { fontFamily: 'Inter_700Bold', color: c.brandTextSoft },
  view5: { height: 5.25, flex: 1, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view6: { height: '100%', borderRadius: 9999, backgroundColor: '#2e7d55' },
  view7: { overflow: 'hidden', borderRadius: 21, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft },
  view8: { flex: 1, padding: 14, paddingRight: 7 },
  text5: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextDeep },
  text6: { marginTop: 5.25, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  pressable: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  view9: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  text7: { marginTop: 7, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text8: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  pressable2: { borderRadius: 14, borderWidth: 1, padding: 10.5 },
  text9: { marginTop: 1.75, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view10: { marginTop: 7, height: 24.5, width: 24.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  view11: { marginRight: 10.5, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 14, borderWidth: 1, paddingVertical: 7, paddingLeft: 3.5, paddingRight: 10.5 },
  view12: { marginLeft: 3.5, flex: 1 },
  text10: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text11: { marginTop: 1.75, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable3: { marginTop: 7, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text12: { fontFamily: 'Inter_700Bold' },
  pressable4: { marginRight: 10.5, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 8.75 },
  view13: { height: 70, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10.5, backgroundColor: c.subtle },
  text13: { marginTop: 7, fontFamily: 'Inter_700Bold', color: c.text },
  text14: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text15: { marginTop: 3.5, fontFamily: 'Manrope_800ExtraBold', color: c.brandText },
  text16: { fontFamily: 'Inter_400Regular', color: c.textFaint },
  text17: { marginBottom: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textMuted },
  text18: { marginTop: -7, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  text19: { paddingVertical: 10.5, fontFamily: 'Inter_400Regular', color: c.textFaint },
  view14: { marginBottom: 7, borderRadius: 10.5, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text20: { fontFamily: 'Inter_600SemiBold', color: c.roseText },
  pressable5: { marginBottom: 7, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view15: { flex: 1 },
  view16: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text21: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view17: { flexDirection: 'row' },
  pressable6: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, backgroundColor: '#236645', paddingHorizontal: 8.75 },
  text22: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable7: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 8.75 },
  text23: { fontFamily: 'Inter_700Bold', color: c.roseTextSoft },
  pressable8: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view18: { borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.paper, paddingHorizontal: 7, paddingVertical: 1.75 },
  text24: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text25: { paddingVertical: 10.5, fontFamily: 'Inter_400Regular', color: '#dc2626' },
  view19: { marginBottom: 7, flexDirection: 'row', flexWrap: 'wrap' },
  view20: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.paper, paddingHorizontal: 7, paddingVertical: 3.5 },
  view21: { marginTop: 7, flexDirection: 'row', alignItems: 'center' },
  text26: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  view22: { marginBottom: 10.5 },
  view23: { marginBottom: 3.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text27: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  view24: { height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view25: { marginTop: 3.5, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
}))
