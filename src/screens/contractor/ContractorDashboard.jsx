// Port of the web src/pages/contractor/ContractorDashboard.jsx home section:
// the plan banner (FreeAccessBanner), "Your plan" (PlanSummaryCard), and the
// analytics the web shows below the welcome card (ContractorAnalyticsSection):
// figures, Projects by Category, Requests by Status, Project Progress, Recent
// Requests, Budget Overview and Quick Actions — plus the existing mobile panels
// (incoming requests, find clients, site engineers).
//
// Wired to: GET /owners/projects (+ /projects/{id}/engineer, /suppliers),
// GET /project-requests/incoming, GET /contractors/find-clients,
// GET /engineers/my-team, GET /cost-tool/projects/{id}/summary (budget),
// GET /subscriptions/me, and the accept / reject request actions.
// Strings come from the web translation keys (mobile-only ones: mobile.dashboard.*).
import { useState, useCallback, useEffect } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { View, Text, Pressable, Alert, Modal, TextInput } from 'react-native'
import { useSelector } from 'react-redux'
import { Users, Briefcase, Check, X, HardHat, ClipboardList, Search, ShoppingCart, Activity, Wallet } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, MetricRow, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { FreeAccessBanner, PlanSummaryCard, Section, Badge } from '../../components/builder/BuilderUi'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { fetchNearbyProjects, fetchBuilderProjectsWithAssignments } from '../../api/projects'
import { fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest } from '../../api/requests'
import { fetchEngineerTeam } from '../../api/engineers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { fetchCostToolSummary } from '../../api/costTool'
import {
  apiErrorText, asList, averageCompletion, averageSchedule, buildingCategoryCounts, categorizeRequest, findClientRequest,
  formatPercent, groupProjectsByCategory, money, newestRequests, relativeAge, scheduleWidth,
} from '../../utils/builderHelpers'
import { useLanguage } from '../../i18n/LanguageContext'

const REQUEST_COLORS = { accepted: '#1f7a4d', sent: '#38bdf8', pending: '#f5b31b', rejected: '#ef4444', withdrawn: '#94a3b8' }
const REQUEST_LABELS = { accepted: 'ui.status.accepted', sent: 'dash.contractor.status.proposalSent', pending: 'ui.status.pending', rejected: 'ui.status.rejected', withdrawn: 'ui.shared.statusWithdrawn' }
// Web ContractorAnalyticsSection category label keys.
const CATEGORY_KEYS = { residential: 'dash.common.residential', commercial: 'dash.common.commercial', renovation: 'site.projects.cat.renovation', interior: 'opt.category.interior', others: 'mobile.dashboard.others' }

function Bar({ value, color = COLORS.brand[600] }) {
  return (
    <View className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
      <View className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} />
    </View>
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
  const { t } = useLanguage()
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [quoteFor, setQuoteFor] = useState(null)   // the request being accepted with a quotation
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)

  const user = useSelector((state) => state.auth.user)
  const subscription = useBuilderSubscription()
  const projects = useAsyncData(fetchBuilderProjectsWithAssignments, [])
  // Discovery follows the active (first) project's country, then the builder's (web parity).
  const discoveryCountry = (Array.isArray(projects.data) && projects.data[0]?.project_country) || user?.country_of_residence || 'India'
  const leads = useAsyncData(() => fetchNearbyProjects(discoveryCountry), [discoveryCountry, user?.pincode])
  const requests = useAsyncData(fetchIncomingRequests, [])
  const team = useAsyncData(fetchEngineerTeam, [])
  // Web parity: an answer, counter-offer or assignment made elsewhere shows at once.
  useLiveRefresh(() => { projects.reload(); requests.reload(); team.reload(); leads.reload() })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        leads.reload(),
        requests.reload(),
        team.reload(),
        projects.reload(),
        subscription.refresh(),
      ])
    } finally {
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.reload, requests.reload, team.reload, projects.reload, subscription.refresh])

  async function respond(request, accept) {
    // Accepting an owner's request submits a quotation — same as web.
    if (accept && String(request.request_type || '').startsWith('OWNER')) {
      setQuoteAmount('')
      setQuoteFor(request)
      return
    }
    try {
      if (accept) await acceptProjectRequest(request.id)
      else await rejectProjectRequest(request.id)
      await requests.reload()
    } catch (error) {
      Alert.alert(t('mobile.dashboard.couldNotUpdate'), apiErrorText(error, t('award.error')))
    }
  }

  async function submitQuotation() {
    const amount = Number(String(quoteAmount).replace(/,/g, '').trim())
    if (!amount || amount <= 0) {
      Alert.alert(t('mobile.dashboard.quotationNeeded'), t('dash.contractor.quotationHint'))
      return
    }
    setQuoteBusy(true)
    try {
      await acceptProjectRequest(quoteFor.id, amount)
      setQuoteFor(null)
      await requests.reload()
    } catch (error) {
      Alert.alert(t('dash.err.acceptRequest'), apiErrorText(error, t('award.error')))
    } finally {
      setQuoteBusy(false)
    }
  }

  const requestList = asList(requests.data, 'items', 'requests')
  // Only requests waiting on THIS builder get Accept / Decline.
  const incomingPending = requestList.filter((request) => categorizeRequest(request) === 'pending')
  // Open leads only: a lead with a pending or accepted request lives on the Requests board.
  const leadList = asList(leads.data, 'projects', 'items').filter((lead) => {
    if (lead.client_type === 'SUPPLIER') return false
    const stored = findClientRequest(requestList, lead)
    return !stored || ['rejected', 'withdrawn'].includes(stored.status)
  })
  const teamList = Array.isArray(team.data)
    ? team.data
    : (team.data?.active || team.data?.members || team.data?.engineers || team.data?.team || [])
  const projectList = Array.isArray(projects.data) ? projects.data : []

  // ---- Analytics (web ContractorAnalyticsSection) ---------------------------
  const groups = groupProjectsByCategory(projectList)
  const averageProgress = averageCompletion(projectList) ?? averageSchedule(projectList.filter((project) => project.work_started === true))
  const requestCounts = { accepted: 0, pending: 0, sent: 0, rejected: 0, withdrawn: 0 }
  requestList.forEach((request) => { requestCounts[categorizeRequest(request)] += 1 })
  const totalRequests = requestList.length
  const categories = buildingCategoryCounts(projectList)
  const rankedProjects = [...projectList].sort((a, b) => Number(b.completion_percentage || 0) - Number(a.completion_percentage || 0)).slice(0, 3)
  const recentRequests = newestRequests(requestList, 3)
  const budget = useBudgetTotals(projectList)
  const country = projectList[0]?.project_country
  const spentShare = budget?.budget > 0 ? Math.round((budget.spent / budget.budget) * 100) : 0

  const goTab = (name, params) => navigation.navigate(name, params)
  const quickActions = [
    { id: 'catalog', label: t('owner.quick.order'), icon: HardHat, onPress: () => goTab('ContractorMoreTab', { section: 'catalog' }) },
    { id: 'partners', label: t('mobile.dashboard.findPartners'), icon: Users, onPress: () => goTab('ContractorPartnersTab') },
    { id: 'clients', label: t('ui.findClients'), icon: Search, onPress: () => goTab('ContractorMoreTab', { section: 'clients' }) },
    { id: 'buySell', label: t('ui.buySell'), icon: ShoppingCart, onPress: () => goTab('ContractorMoreTab', { section: 'shop' }) },
  ]

  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <FreeAccessBanner status={subscription.status} onViewPlans={() => navigation.navigate('BuilderSubscription')} />
        <PlanSummaryCard subscription={subscription} onOpen={() => navigation.navigate('BuilderSubscription')} />

        <MetricRow
          items={[
            { label: t('dash.contractor.activeProjects'), value: String(groups.current.length) },
            { label: t('dash.owner.overview.pendingRequests'), value: String(incomingPending.length) },
            { label: t('mobile.dashboard.openLeads'), value: String(leadList.length) },
            { label: t('ui.shared.moduleEngineers'), value: String(teamList.length) },
          ]}
        />
        <MetricRow
          items={[
            { label: t('dash.contractor.analytics.totalProjects'), value: String(projectList.length) },
            { label: t('dash.contractor.analytics.averageProgress'), value: averageProgress == null ? '—' : formatPercent(averageProgress) },
            { label: t('dash.contractor.analytics.acceptedRequests'), value: String(requestCounts.accepted) },
          ]}
        />

        <Panel title={t('mobile.dashboard.quickActions')}>
          <View className="flex-row flex-wrap justify-between gap-y-2.5">
            {quickActions.map(({ id, label, icon: Icon, onPress }) => (
              <Pressable key={id} onPress={onPress} className="w-[48%] flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-3">
                <Icon size={16} color={COLORS.brand[700]} />
                <Text className="flex-1 text-xs font-extrabold text-brand-800">{label}</Text>
              </Pressable>
            ))}
          </View>
        </Panel>

        <Panel title={t('mobile.dashboard.incomingRequests')} action={<Pressable onPress={() => goTab('ContractorRequestsTab')}><Text className="text-xs font-extrabold text-brand-700">{t('dash.viewAll')}</Text></Pressable>}>
          <PanelState
            loading={requests.loading}
            error={requests.error}
            empty={incomingPending.length === 0}
            emptyText={t('ce.noPendingRequests')}
          >
            {incomingPending.slice(0, 5).map((request) => (
              <View key={request.id} style={styles.view}>
                <Text style={[styles.text, { fontSize: 14.5 }]}>
                  {request.project_title || request.title || t('mobile.dashboard.requestNumber', { id: request.id })}
                </Text>
                <Text style={[styles.text2, { fontSize: 12.5 }]}>
                  {request.sender_name || request.owner_name ? t('mobile.dashboard.fromName', { name: request.sender_name || request.owner_name }) : ''}
                  {` · ${t(String(request.request_type || '').startsWith('SUPPLIER') ? 'role.supplier' : 'role.owner')}`}
                </Text>
                <View style={[styles.view2, { gap: 10 }]}>
                  <Pressable
                    onPress={() => respond(request, true)}
                    style={[styles.pressable, { gap: 6 }]}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text style={[styles.text3, { fontSize: 13 }]}>
                      {String(request.request_type || '').startsWith('OWNER') ? t('dash.contractor.quoteAccept') : t('dash.common.accept')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respond(request, false)}
                    style={[styles.pressable2, { gap: 6 }]}
                  >
                    <X size={14} color="#dc2626" />
                    <Text style={[styles.text4, { fontSize: 13 }]}>
                      {t('ce.reject')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel title={t('dash.contractor.analytics.requestBreakdown')} action={<ClipboardList size={16} color={COLORS.brand[700]} />}>
          <PanelState loading={requests.loading} empty={!totalRequests} emptyText={t('dash.contractor.empty.allTitle')}>
            {Object.keys(REQUEST_LABELS).filter((key) => key !== 'withdrawn' || requestCounts.withdrawn).map((key) => {
              const share = totalRequests ? Math.round((requestCounts[key] / totalRequests) * 100) : 0
              return (
                <View key={key} className="mb-2.5 flex-row items-center gap-3">
                  <Text className="w-24 text-xs font-semibold text-graphite">{t(REQUEST_LABELS[key])}</Text>
                  <Bar value={share} color={REQUEST_COLORS[key]} />
                  <Text className="w-16 text-right text-xs font-semibold text-graphite">{requestCounts[key]} ({share}%)</Text>
                </View>
              )
            })}
          </PanelState>
        </Panel>

        <Panel title={t('dash.contractor.analytics.projectMix')} action={<Activity size={16} color={COLORS.brand[700]} />}>
          <PanelState loading={projects.loading} error={projects.error} empty={!projectList.length} emptyText={t('dash.contractor.noAssignedProjects')}>
            {categories.map((row) => {
              const share = projectList.length ? Math.round((row.count / projectList.length) * 100) : 0
              return (
                <View key={row.id} className="mb-2.5 flex-row items-center gap-3">
                  <Text className="w-24 text-xs font-semibold text-graphite">{CATEGORY_KEYS[row.id] ? t(CATEGORY_KEYS[row.id]) : row.label}</Text>
                  <Bar value={share} />
                  <Text className="w-16 text-right text-xs font-semibold text-graphite">{row.count} ({share}%)</Text>
                </View>
              )
            })}
          </PanelState>
        </Panel>

        <Panel title={t('dash.contractor.analytics.projectProgress')} action={<Pressable onPress={() => goTab('ContractorProjectsTab')}><Text className="text-xs font-extrabold text-brand-700">{t('dash.viewAll')}</Text></Pressable>}>
          <PanelState loading={projects.loading} empty={!rankedProjects.length} emptyText={t('dash.contractor.noAssignedProjects')}>
            {rankedProjects.map((project) => {
              const started = project.work_started === true
              const percent = started ? scheduleWidth(project) : 0
              return (
                <View key={project.id} className="mb-3">
                  <Text className="text-[13px] font-bold text-graphite" numberOfLines={1}>{project.title || project.project_title}</Text>
                  {project.project_city || project.address ? <Text className="text-[11px] text-slate-500" numberOfLines={1}>{project.project_city || project.address}</Text> : null}
                  <View className="mt-1 flex-row items-center gap-2">
                    <Bar value={percent} />
                    <Text className="w-20 text-right text-[11px] font-semibold text-slate-600">
                      {!started ? t('progress.scheduleNotStarted') : ['in_progress', 'end_date_passed'].includes(project.schedule_status) ? formatPercent(percent) : t('progress.notAvailable')}
                    </Text>
                  </View>
                </View>
              )
            })}
          </PanelState>
        </Panel>

        <Panel title={t('mobile.dashboard.budgetOverview')} action={<Wallet size={16} color={COLORS.brand[700]} />}>
          <PanelState loading={projects.loading || (projectList.length > 0 && !budget)} empty={!projectList.length} emptyText={t('dash.contractor.noAssignedProjects')}>
            {budget ? (
              <>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500">{t('mobile.dashboard.totalBudget')}</Text>
                    <Text className="text-[16px] font-extrabold text-graphite">{money(budget.budget, country)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[11px] font-bold text-slate-500">{t('dash.engineer.analytics.spent')}</Text>
                    <Text className="text-[16px] font-extrabold text-graphite">{money(budget.spent, country)}</Text>
                  </View>
                </View>
                <View className="mt-2 flex-row items-center gap-2">
                  <Bar value={spentShare} />
                  <Text className="text-xs font-semibold text-slate-600">{spentShare}%</Text>
                </View>
                <Text className="mt-1 text-xs font-semibold text-slate-500">{t('dash.engineer.analytics.remaining')}: {money(Math.max(0, budget.budget - budget.spent), country)}</Text>
              </>
            ) : null}
          </PanelState>
        </Panel>

        <Panel title={t('dash.supplier.recentRequests')}>
          <PanelState loading={requests.loading} empty={!recentRequests.length} emptyText={t('dash.contractor.empty.allTitle')}>
            {recentRequests.map((request) => {
              const state = categorizeRequest(request)
              return (
                <View key={request.id} className="flex-row items-center gap-3 border-b border-slate-100 py-2.5">
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-graphite" numberOfLines={1}>{request.sender_name || request.profile_title || t('dash.common.request')}</Text>
                    <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                      {request.project_title || (String(request.request_type || '').includes('SUPPLIER') ? t('dash.common.supplierRequest') : t('dash.common.builderRequest'))}
                      {request.created_at ? ` · ${relativeAge(request.created_at_iso || request.created_at)}` : ''}
                    </Text>
                  </View>
                  <Badge label={state === 'sent' ? t('dash.contractor.filter.sent') : t(REQUEST_LABELS[state])} bg="#f1f5f9" fg={REQUEST_COLORS[state] || COLORS.slate[600]} />
                </View>
              )
            })}
          </PanelState>
        </Panel>

        <Panel title={t('ui.findClients')} action={<Pressable onPress={() => goTab('ContractorMoreTab', { section: 'clients' })}><Text className="text-xs font-extrabold text-brand-700">{t('mobile.dashboard.open')}</Text></Pressable>}>
          <PanelState
            loading={leads.loading}
            error={leads.error}
            empty={leadList.length === 0}
            emptyText={t('mobile.dashboard.noOpenLeads')}
          >
            {leadList.slice(0, 8).map((lead) => (
              <View key={`${lead.owner_id}-${lead.project_id || lead.id}`} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <Briefcase size={16} color="#134127" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }} numberOfLines={1}>
                    {lead.project_title || lead.title || t('dash.contractor.homeownerProject')}
                  </Text>
                  <Text style={[styles.text5, { fontSize: 12 }]} numberOfLines={1}>
                    {lead.pincode} · {lead.building_type || '—'}
                    {lead.budget ? ` · ${money(lead.budget, lead.project_country)}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel title={t('ui.siteEngineers')} action={<Pressable onPress={() => goTab('ContractorPartnersTab')}><Text className="text-xs font-extrabold text-brand-700">{t('mobile.dashboard.manage')}</Text></Pressable>}>
          <PanelState
            loading={team.loading}
            error={team.error}
            empty={teamList.length === 0}
            emptyText={t('mobile.dashboard.noEngineers')}
          >
            {teamList.map((member) => (
              <View key={member.user_id || member.id} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Users size={16} color="#475569" />
                </View>
                <View style={styles.view5}>
                  <Text style={[styles.text, { fontSize: 14 }]}>
                    {member.name}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
                    {(member.assigned_projects || []).length
                      ? t('mobile.dashboard.onProjects', { projects: (member.assigned_projects || []).map((project) => project.title || project.project_title).join(', ') })
                      : (member.specialization || member.status || t('ui.status.active'))}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>
        <Section><Text className="text-center text-[11px] font-semibold text-slate-400">{t('mobile.dashboard.pullToRefresh')}</Text></Section>
      </DashboardShell>
      <Modal visible={!!quoteFor} transparent animationType="fade" onRequestClose={() => setQuoteFor(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-[15px] font-extrabold text-graphite">{t('mobile.dashboard.yourQuotation')}</Text>
            <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
              {quoteFor?.project_title || quoteFor?.title || t('dash.common.project')}
            </Text>
            <TextInput
              value={quoteAmount}
              onChangeText={setQuoteAmount}
              keyboardType="numeric"
              placeholder={`${t('dash.contractor.amount')} (₹)`}
              placeholderTextColor="#94a3b8"
              autoFocus
              style={styles.textInput}
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => setQuoteFor(null)} className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-200">
                <Text className="text-[13px] font-extrabold text-slate-500">{t('dash.common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={submitQuotation} disabled={quoteBusy} className={`h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 ${quoteBusy ? 'opacity-50' : ''}`}>
                <Text className="text-[13px] font-extrabold text-white">{quoteBusy ? t('ce.sending') : t('dash.contractor.quoteAccept')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, borderRadius: 14, backgroundColor: c.subtle, padding: 14 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view2: { marginTop: 10.5, flexDirection: 'row' },
  pressable: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#134127', paddingVertical: 8.75 },
  text3: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable2: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card, paddingVertical: 8.75 },
  text4: { fontFamily: 'Inter_700Bold', color: '#dc2626' },
  view3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  view4: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.brandSoft },
  view5: { flex: 1 },
  text5: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view6: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.muted },
  view7: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 21 },
  view8: { width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 17.5 },
  text6: { fontSize: 15, fontWeight: '800', color: c.text },
  text7: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  textInput: { marginTop: 10.5, height: 42, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 16, fontWeight: '800', color: c.text },
  view9: { marginTop: 14, flexDirection: 'row', gap: 7 },
  pressable3: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border },
  text8: { fontSize: 13, fontWeight: '800', color: c.textMuted },
  pressable4: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable5: { opacity: 0.5 },
  text9: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
}))