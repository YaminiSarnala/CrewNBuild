// Port of the web src/pages/contractor/ContractorDashboard.jsx home section, in
// the web's order: the plan banner (FreeAccessBanner), the cream "Welcome,
// {name}" banner (contractorTopSection), "Your plan" (PlanSummaryCard), then
// ContractorAnalyticsSection — the four coloured figure cards and the six
// panels: Projects by Category, Recent Requests, Quick Actions, Project
// Progress, Requests by Status (donut) and Budget Overview (ring).
//
// Wired to: GET /owners/projects (+ /projects/{id}/engineer, /suppliers),
// GET /project-requests/incoming, GET /cost-tool/projects/{id}/summary (budget)
// and GET /subscriptions/me. Strings are the web's keys (dash.bld.*, dash.contractor.*).
import { useState, useCallback, useEffect } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { useSelector } from 'react-redux'
import {
  Layers, ClipboardList, Send, BarChart3, HardHat, Users, UserSearch, ShoppingCart,
  Home, Building2, Wrench, Monitor, MoreHorizontal,
} from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { FreeAccessBanner, PlanSummaryCard, Section, Badge } from '../../components/builder/BuilderUi'
import { BudgetRing, DonutChart, StatCard, WelcomeBanner } from '../../components/builder/BuilderDashboardParts'
import { House3DCard } from '../../components/builder/House3D'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { fetchBuilderProjectsWithAssignments } from '../../api/projects'
import { fetchIncomingRequests } from '../../api/requests'
import { fetchCostToolSummary } from '../../api/costTool'
import { imageSource } from '../../api/client'
import { COLORS } from '../../theme/tokens'
import {
  asList, averageCompletion, averageSchedule, buildingCategoryCounts, categorizeRequest, formatPercent,
  groupProjectsByCategory, money, newestRequests, relativeAge, scheduleWidth,
} from '../../utils/builderHelpers'
import { requestTypeLabel } from '../../utils/roleLabels'
import { useLanguage } from '../../i18n/LanguageContext'
import { ink, line, soft, softStrong } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

// web contractorConstants.defaultProjectImage
const DEFAULT_PROJECT_IMAGE = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80'

const REQUEST_COLORS = { accepted: '#1f7a4d', sent: '#38bdf8', pending: '#f5b31b', rejected: '#ef4444', withdrawn: '#94a3b8' }
// Donut slice labels (web Requests by Status).
const SLICE_LABELS = { accepted: 'ui.status.accepted', sent: 'dash.contractor.status.proposalSent', pending: 'ui.status.pending', rejected: 'ui.status.rejected', withdrawn: 'ui.shared.statusWithdrawn' }
// Recent Requests pill colours (web ContractorAnalyticsSection: bg-*-50 text-*-700).
const PILL_TONES = {
  accepted: { bg: '#ecfdf5', fg: '#047857' },
  pending: { bg: '#fffbeb', fg: '#b45309' },
  sent: { bg: '#f0f9ff', fg: '#0369a1' },
  rejected: { bg: '#fff1f2', fg: '#be123c' },
  withdrawn: { bg: '#f1f5f9', fg: '#475569' },
}
// Recent Requests pill labels.
const PILL_LABELS = { accepted: 'ui.status.accepted', pending: 'ui.status.pending', sent: 'dash.bld.sent', rejected: 'ui.status.rejected', withdrawn: 'ui.shared.statusWithdrawn' }
// Projects by Category rows: label, icon, bar colour (web order).
const CATEGORY_ROWS = {
  residential: { labelKey: 'dash.common.residential', icon: Home, color: '#1f7a4d' },
  commercial: { labelKey: 'dash.common.commercial', icon: Building2, color: '#f97316' },
  renovation: { labelKey: 'dash.bld.renovation', icon: Wrench, color: '#0ea5e9' },
  interior: { labelKey: 'dash.bld.interior', icon: Monitor, color: '#f59e0b' },
  others: { labelKey: 'dash.bld.others', icon: MoreHorizontal, color: '#fbbf24' },
}

function Bar({ value, color = COLORS.brand[600] }) {
  return (
    <View style={styles.view}>
      <View style={[styles.view2, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  )
}

function EmptyPanel({ title, body }) {
  return (
    <View style={styles.view3}>
      <Text style={styles.text}>{title}</Text>
      {body ? <Text style={styles.text2}>{body}</Text> : null}
    </View>
  )
}

function ViewAll({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Text style={styles.text3}>{label}</Text>
    </Pressable>
  )
}

/** Total budget against what the builder's projects have spent (web useBudgetTotals). */
function useBudgetTotals(projectList) {
  const [totals, setTotals] = useState(null)
  const ids = projectList.map((project) => project.id).join(',')
  useEffect(() => {
    if (!projectList.length) { setTotals(null); return undefined }
    let active = true
    Promise.allSettled(projectList.map((project) => fetchCostToolSummary(project.id))).then((results) => {
      if (!active) return
      const sum = { budget: 0, spent: 0 }
      results.forEach((result, index) => {
        const dash = result.status === 'fulfilled' ? result.value?.dashboard || {} : {}
        sum.budget += Number(dash.estimated_budget ?? projectList[index].budget ?? 0)
        sum.spent += Number(dash.spent_budget || 0)
      })
      setTotals(sum)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])
  return totals
}

export default function ContractorDashboard({ navigation }) {
  const { t, td } = useLanguage()
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const user = useSelector((state) => state.auth.user)
  const subscription = useBuilderSubscription()
  const projects = useAsyncData(fetchBuilderProjectsWithAssignments, [])
  const requests = useAsyncData(fetchIncomingRequests, [])
  // Web parity: an answer, counter-offer or assignment made elsewhere shows at once.
  useLiveRefresh(() => { projects.reload(); requests.reload() })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([requests.reload(), projects.reload(), subscription.refresh()])
    } finally {
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests.reload, projects.reload, subscription.refresh])

  const requestList = asList(requests.data, 'items', 'requests')
  const projectList = Array.isArray(projects.data) ? projects.data : []

  // ---- Figures (web ContractorAnalyticsSection) -----------------------------
  const groups = groupProjectsByCategory(projectList)
  const averageProgress = averageCompletion(projectList) ?? averageSchedule(projectList.filter((project) => project.work_started === true))
  const counts = { accepted: 0, pending: 0, sent: 0, rejected: 0, withdrawn: 0 }
  requestList.forEach((request) => { counts[categorizeRequest(request)] += 1 })
  const totalRequests = requestList.length
  const categories = buildingCategoryCounts(projectList, t)
  const rankedProjects = [...projectList].sort((a, b) => Number(b.completion_percentage || 0) - Number(a.completion_percentage || 0)).slice(0, 3)
   const recentRequests = newestRequests(requestList, 3)
  // Live 3D build view: each project with its progress (completion %, else schedule %).
  const buildProjects = projectList.map((project) => {
    const completion = Number(project.completion_percentage)
    const percent = Number.isFinite(completion) && completion > 0
      ? completion
      : project.work_started === true ? scheduleWidth(project) : 0
    return {
      id: project.id,
      title: project.title || project.project_title || t('dash.common.project'),
      place: project.project_city || project.address || '',
      percent,
      image: project.cover_image_url ? imageSource(project.cover_image_url) : null,
    }
  })
  const budget = useBudgetTotals(projectList)
  const country = projectList[0]?.project_country
  const spentShare = budget?.budget > 0 ? Math.round((budget.spent / budget.budget) * 100) : 0

  const goTab = (name, params) => navigation.navigate(name, params)
  const goProjects = () => goTab('ContractorProjectsTab')
  const goRequests = () => goTab('ContractorRequestsTab')

  const quickActions = [
        // Web tones: border-*-200, bg-*-100/60, a *-100 icon chip and *-700 text.
    { id: 'catalog', label: t('owner.quick.order'), icon: HardHat, bg: '#e8f8f0', chip: '#d1fae5', border: '#a7f3d0', fg: '#047857', onPress: () => goTab('ContractorMoreTab', { section: 'catalog' }) },
    { id: 'partners', label: t('dash.bld.findPartners'), icon: Users, bg: '#fff3e5', chip: '#ffedd5', border: '#fed7aa', fg: '#ea580c', onPress: () => goTab('ContractorPartnersTab') },
    { id: 'clients', label: t('ui.findClients'), icon: UserSearch, bg: '#ebf6fe', chip: '#e0f2fe', border: '#bae6fd', fg: '#0369a1', onPress: () => goTab('ContractorMoreTab', { section: 'clients' }) },
    { id: 'buySell', label: t('dash.bld.buySellMaterials'), icon: ShoppingCart, bg: '#f2effe', chip: '#ede9fe', border: '#ddd6fe', fg: '#6d28d9', onPress: () => goTab('ContractorMoreTab', { section: 'shop' }) },
  ]

  const slices = ['accepted', 'sent', 'pending', 'rejected', 'withdrawn']
    .filter((id) => id !== 'withdrawn' || counts.withdrawn > 0)
    .map((id) => ({ id, value: counts[id], color: REQUEST_COLORS[id] }))

  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <FreeAccessBanner status={subscription.status} onViewPlans={() => navigation.navigate('BuilderSubscription')} />

        <Section>
          <WelcomeBanner
            title={t('dash.contractor.hero.welcome', { name: td(user?.name) || t('role.builder') })}
            subtitle={t('dash.contractor.hero.sub')}
            imagePath={user?.profile_image_url}
          />
        </Section>

        <PlanSummaryCard subscription={subscription} onOpen={() => navigation.navigate('BuilderSubscription')} />

        {/* The four coloured figure cards, as on the web. */}
        <Section>
          <View style={styles.view4}>
            <StatCard theme="blue" icon={Layers} title={t('dash.bld.totalProjects')} value={String(projectList.length)} sub={t('dash.bld.currentProjectsSub', { count: groups.current.length })} onPress={goProjects} />
            <StatCard theme="purple" icon={ClipboardList} title={t('dash.bld.acceptedRequests')} value={String(counts.accepted)} sub={t('dash.contractor.analytics.pendingSub', { count: counts.pending })} onPress={goRequests} />
            <StatCard theme="green" icon={Send} title={t('dash.bld.proposalsSent')} value={String(counts.sent)} sub={t('dash.contractor.analytics.rejectedSub', { count: counts.rejected })} onPress={goRequests} />
            <StatCard theme="orange" icon={BarChart3} title={t('dash.bld.averageProgress')} value={averageProgress == null ? t('progress.notAvailable') : formatPercent(averageProgress)} sub={t('dash.contractor.analytics.upcomingSub', { count: groups.upcoming.length })} onPress={goProjects} />
          </View>
        </Section>

        {/* Live 3D build view: a house that builds itself to each project's progress. */}
        <Panel title={t('mobile.house3d.title')}>
          <House3DCard t={t} projects={buildProjects} />
        </Panel>

        {/* Projects by Category */}
                <Panel title={t('dash.bld.projectsByCategory')} action={<ViewAll label={t('dash.bld.viewAll')} onPress={goProjects} />}>
          {projects.loading && !projectList.length ? (
            <PanelState loading />
          ) : !projectList.length ? (
            <EmptyPanel title={t('dash.contractor.noAssignedProjects')} body={t('dash.contractor.analytics.noProjectData')} />
          ) : categories.map((row) => {
            const meta = CATEGORY_ROWS[row.id] || CATEGORY_ROWS.others
            const share = projectList.length ? Math.round((row.count / projectList.length) * 100) : 0
            const Icon = meta.icon
            return (
              <View key={row.id} style={styles.view5}>
                <Icon size={14} color={meta.color} />
                <Text style={styles.text4} numberOfLines={1}>{t(meta.labelKey)}</Text>
                <Bar value={share} color={meta.color} />
                <Text style={styles.text5}>{row.count} ({share}%)</Text>
              </View>
            )
          })}
        </Panel>

        {/* Recent Requests */}
        <Panel title={t('dash.bld.recentRequests')} action={<ViewAll label={t('dash.bld.viewAll')} onPress={goRequests} />}>
          {requests.loading && !requestList.length ? (
            <PanelState loading />
          ) : !recentRequests.length ? (
            <EmptyPanel title={t('dash.contractor.empty.allTitle')} body={t('dash.contractor.analytics.noRequestData')} />
          ) : recentRequests.map((request) => {
                       const state = categorizeRequest(request)
            return (
              <View key={request.id} style={styles.view6}>
                <View style={styles.view7}>
                  <Text style={styles.text6} numberOfLines={1}>{requestTypeLabel(request.request_type, t)}</Text>
                  <Text style={styles.text7} numberOfLines={1}>
                    {request.project_title || (request.is_sender ? request.receiver_name : request.sender_name) || t('dash.common.request')}
                    {request.created_at ? ` · ${relativeAge(request.created_at_iso || request.created_at, undefined, t)}` : ''}
                  </Text>
                </View>
                              <Badge label={t(PILL_LABELS[state])} {...(PILL_TONES[state] || PILL_TONES.withdrawn)} />
              </View>
            )
          })}
        </Panel>

        {/* Quick Actions */}
        <Panel title={t('dash.engineer.quickActions')}>
          <View style={styles.view4}>
                       {quickActions.map(({ id, label, icon: Icon, bg, chip, border, fg, onPress }) => (
              <Pressable
                key={id}
                onPress={onPress}
                style={[styles.pressable2, { backgroundColor: soft(bg, fg), borderColor: line(border, fg) }]}
              >
                <View style={[styles.view8, { backgroundColor: softStrong(chip, fg), borderColor: line(border, fg) }]}>
                  <Icon size={18} color={ink(fg)} />
                </View>
                <Text style={[styles.text8, { color: ink(fg) }]} numberOfLines={2}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Panel>

        {/* Project Progress */}
        <Panel title={t('dash.bld.projectProgress')} action={<ViewAll label={t('dash.bld.viewAll')} onPress={goProjects} />}>
          {projects.loading && !projectList.length ? (
            <PanelState loading />
          ) : !rankedProjects.length ? (
            <EmptyPanel title={t('dash.contractor.noAssignedProjects')} body={t('dash.contractor.analytics.noProgressData')} />
          ) : rankedProjects.map((project) => {
            const started = project.work_started === true
            const percent = started ? scheduleWidth(project) : 0
            return (
              <View key={project.id} style={styles.view9}>
                <Image
                  source={project.cover_image_url ? imageSource(project.cover_image_url) : { uri: DEFAULT_PROJECT_IMAGE }}
                  style={{ width: 46, height: 46, borderRadius: 12 }}
                  contentFit="cover"
                />
                <View style={styles.view7}>
                  <Text style={styles.text6} numberOfLines={1}>{project.title || project.project_title}</Text>
                  <Text style={styles.text7} numberOfLines={1}>{project.project_city || project.address || project.pincode || ''}</Text>
                  <View style={styles.view10}>
                    <Bar value={percent} />
                    <Text style={styles.text9} numberOfLines={1}>
                      {!started ? t('progress.scheduleNotStarted') : ['in_progress', 'end_date_passed'].includes(project.schedule_status) ? formatPercent(percent) : t('progress.notAvailable')}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </Panel>

        {/* Requests by Status */}
        <Panel title={t('dash.bld.requestsByStatus')} action={<ViewAll label={t('dash.bld.viewAll')} onPress={goRequests} />}>
          {requests.loading && !requestList.length ? (
            <PanelState loading />
          ) : !totalRequests ? (
            <EmptyPanel title={t('dash.contractor.empty.allTitle')} body={t('dash.contractor.analytics.noRequestData')} />
          ) : (
            <View style={styles.view11}>
              <DonutChart slices={slices} centerValue={String(totalRequests)} centerLabel={t('dash.bld.totalRequests')} />
              <View style={styles.view12}>
                {slices.map((slice) => {
                  const share = totalRequests ? Math.round((slice.value / totalRequests) * 100) : 0
                  return (
                    <View key={slice.id} style={styles.view13}>
                      <View style={[styles.view14, { backgroundColor: slice.color }]} />
                      <Text style={styles.text10} numberOfLines={1}>{t(SLICE_LABELS[slice.id])}</Text>
                      <Text style={styles.text11}>{slice.value} ({share}%)</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        </Panel>

        {/* Budget Overview */}
        <Panel title={t('dash.bld.budgetOverview')}>
          {!projectList.length ? (
            projects.loading ? <PanelState loading /> : <EmptyPanel title={t('dash.contractor.noAssignedProjects')} body={t('dash.contractor.analytics.noProjectData')} />
          ) : !budget ? (
            <EmptyPanel title={t('dash.bld.budgetOverview')} body={t('shop.loading')} />
          ) : budget.budget <= 0 && budget.spent <= 0 ? (
            <EmptyPanel title={t('dash.bld.budgetOverview')} body={t('dash.engineer.analytics.noBudgetYet')} />
          ) : (
            <View style={styles.view11}>
              <BudgetRing share={spentShare} centerValue={money(budget.budget, country)} centerLabel={t('dash.bld.totalBudget')} />
              <View style={styles.view15}>
                <View>
                  <View style={styles.view13}>
                    <View style={[styles.view14, { backgroundColor: '#1f7a4d' }]} />
                    <Text style={styles.text12}>{t('dash.engineer.analytics.spent')} ({spentShare}%)</Text>
                  </View>
                  <Text style={styles.text13}>{money(budget.spent, country)}</Text>
                </View>
                <View>
                  <View style={styles.view13}>
                    <View style={[styles.view14, { backgroundColor: '#f5b31b' }]} />
                    <Text style={styles.text12}>{t('dash.engineer.analytics.remaining')} ({Math.max(0, 100 - spentShare)}%)</Text>
                  </View>
                  <Text style={styles.text13}>{money(Math.max(0, budget.budget - budget.spent), country)}</Text>
                </View>
              </View>
            </View>
          )}
        </Panel>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { height: 7, flex: 1, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view2: { height: '100%', borderRadius: 9999 },
  view3: { alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 14, paddingVertical: 24.5 },
  text: { textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.text },
  text2: { marginTop: 3.5, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  pressable: { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text3: { fontSize: 11, fontWeight: '700', color: c.text },
  view4: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8.75 },
  view5: { marginBottom: 8.75, flexDirection: 'row', alignItems: 'center', gap: 7 },
  text4: { width: 84, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.text },
  text5: { width: 56, textAlign: 'right', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.text },
  view6: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view7: { flex: 1 },
  text6: { fontSize: 13, fontWeight: '700', color: c.text },
  text7: { fontSize: 11, color: c.textMuted },
  pressable2: { width: '48.5%', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 14 },
  view8: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1 },
  text8: { marginTop: 7, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  view9: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  view10: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 7 },
  text9: { width: 70, textAlign: 'right', fontSize: 11, fontWeight: '600', color: c.textSecondary },
  view11: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  view12: { flex: 1, gap: 5.25 },
  view13: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  view14: { height: 8.75, width: 8.75, borderRadius: 9999 },
  text10: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.text },
  text11: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  view15: { flex: 1, gap: 7 },
  text12: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textMuted },
  text13: { marginLeft: 14, fontSize: 14, fontWeight: '800', color: c.text },
}))
