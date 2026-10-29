// "My Partners" — port of web contractorEngineerSections.jsx
// (MySiteEngineersSection: Site Engineers / Find Engineers / My Suppliers /
// Pending Requests, InviteEngineerDrawer, AssignProjectDrawer,
// UnassignProjectDrawer, ContractorEngineerProfileDrawer) and
// contractorSupplierSections.jsx (AssignSupplierDrawer, UnassignSupplierDrawer).
//
// Endpoints (all existing):
//   GET  /engineers/my-team            { active, pending_requests, invitations, outgoing_requests }
//   GET  /engineers/find               ?pincode&country&project_id&category=Site Engineer
//   POST /engineers/send-request       { engineer_id, project_id? }
//   POST /engineers/join-request/respond { relationship_id, action: ACCEPT|REJECT }
//   POST /engineers/invite             { phone, email }   POST /engineers/invite/revoke { invitation_id }
//   POST /projects/{id}/assign-engineer | unassign-engineer { engineer_id }
//   GET  /contractors/my-suppliers
//   POST /projects/{id}/assign-supplier | unassign-supplier { supplier_id, engineer_id }
//   GET  /suppliers/{id}/profile
// Strings come from the web translation keys (mobile.partners.* for mobile-only text).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { View, Text, Pressable, TextInput, Alert, Share } from 'react-native'
import { useSelector } from 'react-redux'
import { Check, X, Send, Users, Search, Truck, Clock, UserPlus, Share2, HardHat } from 'lucide-react-native'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchEngineerTeam,
  fetchNearbyEngineers,
  respondEngineerJoinRequest,
  sendContractorEngineerRequest,
  inviteEngineer,
  revokeEngineerInvitation,
  assignEngineerToProject,
  unassignEngineerFromProject,
  fetchContractorSuppliers,
  assignSupplierToProject,
  unassignSupplierFromProject,
} from '../../api/engineers'
import { fetchOwnerProjects } from '../../api/projects'
import { fetchSupplierProfile } from '../../api/profiles'
import {
  ActionButton, InfoRow, LabeledInput, Notice, SearchBox, Section, SegmentTabs, SheetModal, Badge,
} from '../../components/builder/BuilderUi'
import { SITE_ENGINEER_CATEGORY, apiErrorText, asList, projectStatusText, takenProjectIdsFor } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { userCountry } from '../../utils/countryConfig'
import { BUSINESS_TYPE_KEYS, SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../i18n/optionKeys'

const projectTitle = (project, t) => project?.title || project?.project_title || t('se.project')

// Stored engineer category -> display key (web profileConstants ENGINEER_CATEGORY_LABEL_KEYS).
const ENGINEER_CATEGORY_LABEL_KEYS = {
  'Site Engineer': 'role.engineer',
  'Soil Engineer': 'ui.profile.engCat.soilEngineer',
  'Survey Engineer': 'ui.profile.engCat.surveyEngineer',
  Architecture: 'ui.profile.engCat.architecture',
  'Structural Engineer': 'ui.profile.engCat.structuralEngineer',
  'Civil Engineer': 'ui.profile.engCat.civilEngineer',
  'Electrical Engineer': 'ui.profile.engCat.electricalEngineer',
  Plumbing: 'opt.category.plumbing',
  'Mechanical Engineer': 'ui.profile.engCat.mechanicalEngineer',
  HVAC: 'ui.profile.engCat.hvac',
  'Quantity Surveyor': 'ui.profile.engCat.quantitySurveyor',
  Safety: 'opt.category.safety',
  'Construction Safety': 'ui.profile.engCat.constructionSafety',
  'Finishing / Painter': 'ui.profile.engCat.finishingPainter',
}

// Stored supplier type -> display key (web optionKeys SUPPLIER_TYPE_KEYS).
const SUPPLIER_TYPE_KEYS = {
  'Material Supplier': 'opt.supplierType.material',
  'Labor Supplier': 'opt.supplierType.labor',
  'Equipment Supplier': 'opt.supplierType.equipment',
}

/** An engineer's category for display, falling back to "Site Engineer". */
const engineerCategory = (t, value) => (value ? optionLabel(t, ENGINEER_CATEGORY_LABEL_KEYS, value) : t('role.engineer'))

function Card({ children, onPress }) {
  const Wrapper = onPress ? Pressable : View
  return (
    <Wrapper onPress={onPress} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
      {children}
    </Wrapper>
  )
}

function Meta({ items }) {
  return (
    <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={2}>
      {items.filter(Boolean).join(' · ')}
    </Text>
  )
}

export default function ContractorEngineersScreen({ navigation }) {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const [tab, setTab] = useState('team')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)

  const team = useAsyncData(fetchEngineerTeam, [])
  const projects = useAsyncData(fetchOwnerProjects, [])
  const suppliers = useAsyncData(() => fetchContractorSuppliers(), [])
  useLiveRefresh(() => { team.reload(); projects.reload(); suppliers.reload() })

  const active = asList(team.data?.active)
  const pending = asList(team.data?.pending_requests)
  const invitations = asList(team.data?.invitations)
  const outgoing = asList(team.data?.outgoing_requests)
  const projectList = asList(projects.data, 'projects', 'items')
  const supplierList = asList(suppliers.data, 'suppliers', 'items')

  // Find Site Engineers
  const [findPincode, setFindPincode] = useState('')
  const [findProjectId, setFindProjectId] = useState(null)
  const [nearby, setNearby] = useState([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)
  const nearbyRequest = useRef(0)

  // Sheets
  const [engineerProfile, setEngineerProfile] = useState(null)
  const [assignTarget, setAssignTarget] = useState(null)
  const [unassignTarget, setUnassignTarget] = useState(null)
  const [supplierAssignTarget, setSupplierAssignTarget] = useState(null)
  const [supplierUnassignTarget, setSupplierUnassignTarget] = useState(null)
  const [supplierProfile, setSupplierProfile] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const activeProject = projectList.find((project) => project.id === findProjectId) || projectList[0] || null
  const country = activeProject?.project_country || userCountry(user)

  // Engineers the builder already asked: restored from outgoing_requests.
  useEffect(() => {
    if (!outgoing.length) return
    setSentIds((current) => {
      const next = new Set(current)
      outgoing.forEach((row) => next.add(row.user_id))
      return next
    })
  }, [outgoing])

  function loadNearby(pincode = findPincode) {
    // Only a full pincode is searched; empty falls back to the project's / builder's location.
    if (pincode && pincode.length !== 6) return
    const requestId = ++nearbyRequest.current
    setNearbyLoading(true)
    fetchNearbyEngineers(pincode, country, activeProject?.id || null, SITE_ENGINEER_CATEGORY)
      .then((rows) => { if (requestId === nearbyRequest.current) setNearby(asList(rows, 'engineers', 'items')) })
      .catch(() => { if (requestId === nearbyRequest.current) setNearby([]) })
      .finally(() => { if (requestId === nearbyRequest.current) setNearbyLoading(false) })
  }

  useEffect(() => {
    loadNearby()
    // Re-run when the active project (and so the country) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, user?.country_of_residence, user?.pincode])

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const reloadAll = async () => {
    await Promise.all([team.reload(), projects.reload(), suppliers.reload()])
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await reloadAll()
      loadNearby()
    } finally {
      setRefreshing(false)
    }
  }

  const needle = search.trim().toLowerCase()
  const matches = (...values) => !needle || values.some((value) => String(value || '').toLowerCase().includes(needle))

  // Project id -> engineer name, for projects that already have a Site Engineer.
  const assignedEngineerByProject = useMemo(() => active.reduce((map, engineer) => {
    ;(engineer.assigned_projects || []).forEach((project) => {
      if (project?.id && !map[project.id]) map[project.id] = engineer.name
    })
    return map
  }, {}), [active])

  // ---- actions ---------------------------------------------------------------
  async function respond(relationshipId, action) {
    if (!relationshipId || busy) return
    setBusy(true)
    try {
      await respondEngineerJoinRequest(relationshipId, action)
      setMessage({ tone: 'success', text: action === 'ACCEPT' ? t('dash.msg.engineerAdded') : t('dash.msg.joinRequestRejected') })
      await team.reload()
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('dash.err.updateJoinRequest')) })
    } finally {
      setBusy(false)
    }
  }

  async function sendEngineerRequest(engineer) {
    const id = engineer.user_id || engineer.id
    if (!id || sentIds.has(id) || sendingId === id) return
    setSendingId(id)
    try {
      await sendContractorEngineerRequest(id, activeProject?.id || null)
      setSentIds((current) => new Set(current).add(id))
      setMessage({ tone: 'success', text: t('dash.msg.engineerRequestSent') })
      team.reload()
    } catch (error) {
      const detail = apiErrorText(error, t('dash.err.sendRequest'))
      setMessage({ tone: 'error', text: detail })
      if (/already/i.test(detail)) setSentIds((current) => new Set(current).add(id))
    } finally {
      setSendingId(null)
    }
  }

  async function revokeInvitation(invitation) {
    Alert.alert(t('mobile.partners.revokeInviteTitle'), t('mobile.partners.revokeInviteBody'), [
      { text: t('ce.cancel'), style: 'cancel' },
      {
        text: t('ui.contractor.revoke'),
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeEngineerInvitation(invitation.id)
            setMessage({ tone: 'success', text: t('dash.msg.invitationRevoked') })
            await team.reload()
          } catch (error) {
            setMessage({ tone: 'error', text: apiErrorText(error, t('ui.contractor.errRevokeInvitation')) })
          }
        },
      },
    ])
  }

  const shareInvite = (invitation) => Share.share({
    message: inviteShareMessage(t, user?.name, invitation.invite_code, invitation.invite_link),
  }).catch(() => {})

  async function assignProject(project) {
    if (!assignTarget) return
    setBusy(true)
    try {
      await assignEngineerToProject(project.id, assignTarget.user_id || assignTarget.id)
      setMessage({ tone: 'success', text: t('ui.contractor.projectAssignedTo', { project: projectTitle(project, t), name: assignTarget.name || t('ce.engineerFallback') }) })
      setAssignTarget(null)
      await reloadAll()
    } catch (error) {
      Alert.alert(t('dash.err.assignEngineer'), apiErrorText(error, t('mobile.partners.tryAgain')))
    } finally {
      setBusy(false)
    }
  }

  async function unassignProject(project) {
    if (!unassignTarget) return
    setBusy(true)
    try {
      await unassignEngineerFromProject(project.id, unassignTarget.user_id || unassignTarget.id)
      setMessage({ tone: 'success', text: t('ui.contractor.unassignedFrom', { name: unassignTarget.name || t('ce.engineerFallback'), project: projectTitle(project, t) }) })
      setUnassignTarget(null)
      await reloadAll()
    } catch (error) {
      Alert.alert(t('dash.err.unassignEngineer'), apiErrorText(error, t('mobile.partners.tryAgain')))
    } finally {
      setBusy(false)
    }
  }

  async function assignSupplier(project, engineerId) {
    if (!supplierAssignTarget) return
    if (!engineerId) {
      Alert.alert(t('mobile.partners.chooseEngineerTitle'), t('mobile.partners.chooseEngineerBody'))
      return
    }
    setBusy(true)
    try {
      await assignSupplierToProject(project.id, supplierAssignTarget.user_id || supplierAssignTarget.id, engineerId)
      setMessage({ tone: 'success', text: t('ui.contractor.supplierAssignedTo', { supplier: supplierAssignTarget.store_name || supplierAssignTarget.name || t('role.supplier'), project: projectTitle(project, t) }) })
      setSupplierAssignTarget(null)
      await reloadAll()
    } catch (error) {
      Alert.alert(t('ui.contractor.errAssignSupplier'), apiErrorText(error, t('mobile.partners.tryAgain')))
    } finally {
      setBusy(false)
    }
  }

  async function unassignSupplier(assignment) {
    if (!supplierUnassignTarget) return
    // An assignment row names its project `project_id`, not `id`.
    const projectId = assignment.project_id ?? assignment.id
    setBusy(true)
    try {
      await unassignSupplierFromProject(projectId, supplierUnassignTarget.user_id || supplierUnassignTarget.id, assignment.engineer_id)
      setMessage({ tone: 'success', text: t('ui.contractor.unassignedFrom', { name: supplierUnassignTarget.store_name || supplierUnassignTarget.name || t('role.supplier'), project: assignment.project_title || assignment.title || t('se.project') }) })
      setSupplierUnassignTarget(null)
      await reloadAll()
    } catch (error) {
      Alert.alert(t('ui.contractor.errUnassignSupplier'), apiErrorText(error, t('mobile.partners.tryAgain')))
    } finally {
      setBusy(false)
    }
  }

  async function openSupplierProfile(supplier) {
    const id = supplier.user_id || supplier.id
    setSupplierProfile({ ...supplier, loading: true })
    try {
      const profile = await fetchSupplierProfile(id)
      setSupplierProfile({ ...supplier, ...profile, loading: false })
    } catch (error) {
      setSupplierProfile({ ...supplier, loading: false, error: apiErrorText(error, t('dash.err.loadSupplierProfileShort')) })
    }
  }

  const tabs = [
    { id: 'team', label: t('ui.siteEngineers'), count: active.length, icon: Users },
    { id: 'find', label: t('ui.findEngineers'), icon: Search },
    { id: 'suppliers', label: t('ce.mySuppliers'), count: supplierList.length, icon: Truck },
    { id: 'pending', label: t('ce.pendingRequests'), count: pending.length + invitations.length + outgoing.length, icon: Clock },
  ]

  const teamShown = active.filter((engineer) => matches(engineer.name, engineer.pincode, engineer.address, engineer.specialization))
  const findShown = nearby.filter((engineer) => matches(engineer.name, engineer.pincode, engineer.address, engineer.specialization))
  const suppliersShown = supplierList.filter((supplier) => matches(supplier.store_name, supplier.name, supplier.pincode, supplier.address, ...(supplier.categories || [])))
  const teamStatusOf = (engineer) => (active.some((item) => item.user_id === engineer.user_id)
    ? 'active'
    : pending.some((item) => item.user_id === engineer.user_id) ? 'pending' : null)

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
        <Section>
          <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
          <View className="mt-2 flex-row items-center gap-2">
            <View className="flex-1">
              <SearchBox value={search} onChangeText={setSearch} placeholder={t('ce.filter.searchPh')} />
            </View>
            <ActionButton small icon={UserPlus} label={t('ce.invite')} onPress={() => setInviteOpen(true)} />
          </View>
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />

          {tab === 'team' ? (
            <PanelState loading={team.loading} error={team.error} empty={!teamShown.length} emptyText={active.length ? t('ce.filter.noMatch') : t('ce.noActiveEngineers')}>
              {teamShown.map((engineer) => {
                const assigned = engineer.assigned_projects || []
                return (
                  <Card key={engineer.user_id} onPress={() => setEngineerProfile(engineer)}>
                    <View className="flex-row items-center gap-2">
                      <HardHat size={16} color={COLORS.brand[700]} />
                      <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{engineer.name || engineer.full_name}</Text>
                      {engineer.working_on_project || assigned.length ? <Badge label={t('ce.busy')} bg="#fffbeb" fg="#92400e" /> : <Badge label={t('ce.available')} bg="#ecfdf5" fg="#047857" />}
                    </View>
                    <Meta items={[engineerCategory(t, engineer.specialization || engineer.category), engineer.pincode, t('ui.contractor.yearsShort', { years: engineer.experience_years || 0 })]} />
                    <Text className="mt-1 text-xs font-semibold text-slate-600" numberOfLines={2}>
                      {assigned.length ? `${t('ui.projects')}: ${assigned.map((item) => projectTitle(item, t)).join(', ')}` : t('ui.contractor.noProjectsAssigned')}
                    </Text>
                    <View className="mt-3 flex-row gap-2">
                      <ActionButton small label={t('ce.assignProject')} tone="brandOutline" onPress={() => setAssignTarget(engineer)} className="flex-1" />
                      <ActionButton small label={t('ce.unassign')} tone="danger" disabled={!assigned.length} onPress={() => setUnassignTarget(engineer)} className="flex-1" />
                    </View>
                  </Card>
                )
              })}
            </PanelState>
          ) : null}

          {tab === 'find' ? (
            <>
              <View className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="mb-1 text-xs font-bold text-slate-600">{t('mobile.partners.findPincodeLabel')}</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={findPincode}
                    onChangeText={(value) => {
                      const next = value.replace(/\D/g, '').slice(0, 6)
                      setFindPincode(next)
                      if (!next || next.length === 6) loadNearby(next)
                    }}
                    keyboardType="number-pad"
                    placeholder={t('ui.shared.sixDigitPincode')}
                    placeholderTextColor={COLORS.slate[400]}
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
                  />
                  <ActionButton label={t('ce.find')} icon={Search} onPress={() => loadNearby()} />
                </View>
                {projectList.length ? (
                  <View className="mt-3">
                    <Text className="mb-1 text-xs font-bold text-slate-600">{t('mobile.partners.requestsForProject')}</Text>
                    <SegmentTabs dense tabs={projectList.map((project) => ({ id: project.id, label: projectTitle(project, t) }))} active={activeProject?.id} onChange={setFindProjectId} />
                  </View>
                ) : null}
              </View>
              <PanelState loading={nearbyLoading} empty={!findShown.length} emptyText={t('ce.noEngineersFound')}>
                {findShown.map((engineer) => {
                  const id = engineer.user_id || engineer.id
                  const status = teamStatusOf(engineer)
                  const sent = sentIds.has(id)
                  return (
                    <Card key={id} onPress={() => setEngineerProfile(engineer)}>
                      <Text className="text-[15px] font-extrabold text-graphite" numberOfLines={1}>{engineer.name || engineer.full_name}</Text>
                      <Meta items={[engineerCategory(t, engineer.specialization), engineer.pincode, t('ui.contractor.yearsShort', { years: engineer.experience_years || 0 }), t('ui.contractor.projectsWithCount', { count: engineer.project_count || 0 })]} />
                      <ActionButton
                        small
                        icon={Send}
                        className="mt-3 self-start"
                        tone={status || sent ? 'outline' : 'primary'}
                        disabled={Boolean(status) || sent || sendingId === id}
                        busy={sendingId === id}
                        label={status === 'active' ? t('ce.activeTeamMember') : status === 'pending' ? t('ce.joinRequestPending') : sent ? t('ce.requestSent') : t('ce.sendRequest')}
                        onPress={() => sendEngineerRequest(engineer)}
                      />
                    </Card>
                  )
                })}
              </PanelState>
            </>
          ) : null}

          {tab === 'suppliers' ? (
            <PanelState loading={suppliers.loading} error={suppliers.error} empty={!suppliersShown.length} emptyText={supplierList.length ? t('dash.engineer.suppliers.noMatch') : `${t('ce.noAcceptedSuppliers')}\n${t('ce.noAcceptedSuppliersSub')}`}>
              {suppliersShown.map((supplier) => {
                const assignments = supplier.assigned_projects || []
                return (
                  <Card key={supplier.user_id || supplier.id} onPress={() => openSupplierProfile(supplier)}>
                    <Text className="text-[10px] font-extrabold uppercase text-brand-700">{supplier.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category) : t('role.supplier')}</Text>
                    <Text className="mt-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{supplier.store_name || supplier.name || t('role.supplier')}</Text>
                    <Meta items={[(supplier.categories || []).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, category)).join(', '), supplier.pincode, t('dash.owner.supplierModal.rating', { rating: Number(supplier.rating || 0).toFixed(1) })]} />
                    {assignments.length ? (
                      <Text className="mt-1 text-xs font-semibold text-slate-600" numberOfLines={2}>{t('ui.projects')}: {assignments.map((row) => row.project_title).join(', ')}</Text>
                    ) : null}
                    <View className="mt-3 flex-row gap-2">
                      <ActionButton small label={t('ce.assignProject')} tone="brandOutline" onPress={() => setSupplierAssignTarget(supplier)} className="flex-1" />
                      <ActionButton small label={t('ce.unassign')} tone="danger" disabled={!assignments.length} onPress={() => setSupplierUnassignTarget(supplier)} className="flex-1" />
                    </View>
                  </Card>
                )
              })}
            </PanelState>
          ) : null}

          {tab === 'pending' ? (
            <PanelState loading={team.loading} error={team.error} empty={!pending.length && !invitations.length && !outgoing.length} emptyText={t('ce.noPendingRequests')}>
              {pending.length ? <Text className="mb-2 text-xs font-extrabold uppercase text-slate-500">{t('ce.pendingJoinRequests')}</Text> : null}
              {pending.filter((engineer) => matches(engineer.name, engineer.pincode)).map((engineer) => (
                <Card key={engineer.relationship_id || engineer.user_id}>
                  <Text className="text-[15px] font-extrabold text-graphite">{engineer.name || engineer.full_name}</Text>
                  <Meta items={[engineerCategory(t, engineer.specialization || engineer.category), engineer.pincode, t('ui.contractor.yearsShort', { years: engineer.experience_years || 0 })]} />
                  <View className="mt-3 flex-row gap-2">
                    <ActionButton small tone="danger" icon={X} label={t('ce.reject')} disabled={busy} onPress={() => respond(engineer.relationship_id, 'REJECT')} className="flex-1" />
                    <ActionButton small icon={Check} label={t('ce.accept')} disabled={busy} onPress={() => respond(engineer.relationship_id, 'ACCEPT')} className="flex-1" />
                  </View>
                </Card>
              ))}
              {invitations.length ? <Text className="mb-2 mt-1 text-xs font-extrabold uppercase text-slate-500">{t('ce.pendingInvitations')}</Text> : null}
              {invitations.filter((invitation) => matches(invitation.phone, invitation.email, invitation.invite_code)).map((invitation) => (
                <Card key={invitation.id}>
                  <Text className="text-[14px] font-extrabold text-graphite">{invitation.phone || invitation.email || t('ce.waitingForEngineer')}</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500">{t('ce.pend.inviteCode')}: <Text className="font-extrabold tracking-widest text-brand-900">{invitation.invite_code}</Text></Text>
                  <View className="mt-3 flex-row gap-2">
                    <ActionButton small icon={Share2} label={t('mobile.partners.share')} tone="brandOutline" onPress={() => shareInvite(invitation)} className="flex-1" />
                    <ActionButton small icon={X} label={t('ui.contractor.revoke')} tone="danger" onPress={() => revokeInvitation(invitation)} className="flex-1" />
                  </View>
                </Card>
              ))}
              {outgoing.length ? <Text className="mb-2 mt-1 text-xs font-extrabold uppercase text-slate-500">{t('ce.sentRequests')}</Text> : null}
              {outgoing.filter((engineer) => matches(engineer.name, engineer.pincode)).map((engineer) => (
                <Card key={`out-${engineer.user_id}`} onPress={() => setEngineerProfile(engineer)}>
                  <Text className="text-[14px] font-extrabold text-graphite">{engineer.name}</Text>
                  <Meta items={[engineerCategory(t, engineer.specialization), engineer.pincode, t('mobile.partners.awaitingAnswer')]} />
                </Card>
              ))}
            </PanelState>
          ) : null}
        </Section>
      </DashboardShell>

      {/* Engineer profile */}
      <SheetModal visible={!!engineerProfile} title={engineerProfile?.name || t('ce.engineerFallback')} subtitle={engineerCategory(t, engineerProfile?.specialization)} onClose={() => setEngineerProfile(null)}>
        {engineerProfile ? (
          <View>
            <InfoRow label={t('dash.supplier.category')} value={engineerProfile.specialization || engineerProfile.category ? engineerCategory(t, engineerProfile.specialization || engineerProfile.category) : ''} />
            <InfoRow label={t('ps.pincode')} value={engineerProfile.pincode} />
            <InfoRow label={t('ps.address')} value={engineerProfile.address} />
            <InfoRow label={t('ce.experience')} value={t('ce.yearsCount', { years: engineerProfile.experience_years || 0 })} />
            <InfoRow label={t('ui.projects')} value={engineerProfile.project_count ?? (engineerProfile.assigned_projects || []).length} />
            {engineerProfile.qualification ? <InfoRow label={t('ps.eng.qualification')} value={engineerProfile.qualification} /> : null}
            {engineerProfile.phone ? <InfoRow label={t('ps.phoneShort')} value={engineerProfile.phone} /> : null}
            {engineerProfile.email ? <InfoRow label={t('ps.email')} value={engineerProfile.email} /> : null}
            {(engineerProfile.assigned_projects || []).length ? (
              <InfoRow label={t('ce.assignedProject')} value={engineerProfile.assigned_projects.map((item) => projectTitle(item, t)).join(', ')} />
            ) : null}
            {!teamStatusOf(engineerProfile) ? (
              <ActionButton
                className="mt-4"
                icon={Send}
                label={sentIds.has(engineerProfile.user_id) ? t('ce.requestSent') : t('ce.sendRequest')}
                disabled={sentIds.has(engineerProfile.user_id) || sendingId === engineerProfile.user_id}
                busy={sendingId === engineerProfile.user_id}
                onPress={() => sendEngineerRequest(engineerProfile)}
              />
            ) : (
              <Text className="mt-4 text-xs font-bold text-brand-700">{teamStatusOf(engineerProfile) === 'active' ? t('ce.activeTeamMember') : t('ce.joinRequestPending')}</Text>
            )}
          </View>
        ) : null}
      </SheetModal>

      {/* Assign an engineer to a project */}
      <SheetModal visible={!!assignTarget} title={t('ce.assignProject')} subtitle={t('ui.contractor.chooseProjectToAssign', { name: assignTarget?.name || t('ce.thisEngineer') })} onClose={() => setAssignTarget(null)}>
        <PanelState loading={projects.loading} empty={!projectList.length} emptyText={t('mobile.partners.noProjectsToAssign')}>
          {projectList.map((project) => {
            const takenBy = assignedEngineerByProject[project.id]
            const mine = (assignTarget?.assigned_projects || []).some((item) => item.id === project.id)
            return (
              <View key={project.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{projectTitle(project, t)}</Text>
                  <Text className="text-xs font-semibold text-slate-500">
                    {t('ui.contractor.pincodeStatus', { pincode: project.pincode || '—', status: projectStatusText(project.status || 'active', t) })}{takenBy ? ` · ${t('ui.contractor.assignedToName', { name: takenBy })}` : ''}
                  </Text>
                </View>
                <ActionButton small label={mine ? t('dash.contractor.assigned') : takenBy ? t('ce.taken') : t('ce.assign')} disabled={Boolean(takenBy) || busy} onPress={() => assignProject(project)} />
              </View>
            )
          })}
        </PanelState>
      </SheetModal>

      {/* Unassign an engineer from one of their projects */}
      <SheetModal visible={!!unassignTarget} title={t('ce.unassignEngineer')} subtitle={t('ui.contractor.chooseProjectToRemove', { name: unassignTarget?.name || t('ce.thisEngineer') })} onClose={() => setUnassignTarget(null)}>
        {(unassignTarget?.assigned_projects || []).length === 0 ? (
          <Text className="text-[13px] font-semibold text-slate-500">{t('ce.noAssignedProjects')}</Text>
        ) : (unassignTarget?.assigned_projects || []).map((project) => (
          <View key={project.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
            <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{projectTitle(project, t)}</Text>
            <ActionButton
              small
              tone="danger"
              label={t('ce.unassign')}
              disabled={busy}
              onPress={() => Alert.alert(t('ce.unassignEngineer'), t('ui.contractor.unassignFromNamedProjectConfirm', { name: unassignTarget?.name || t('ce.thisEngineer'), project: projectTitle(project, t) }), [
                { text: t('ce.cancel'), style: 'cancel' },
                { text: t('ce.unassign'), style: 'destructive', onPress: () => unassignProject(project) },
              ])}
            />
          </View>
        ))}
      </SheetModal>

      <AssignSupplierSheet
        supplier={supplierAssignTarget}
        projectList={projectList}
        engineers={active}
        contractorSuppliers={supplierList}
        busy={busy}
        onClose={() => setSupplierAssignTarget(null)}
        onAssign={assignSupplier}
      />

      {/* Unassign a supplier from a project */}
      <SheetModal visible={!!supplierUnassignTarget} title={t('ce.unassignSupplier')} subtitle={t('ui.contractor.chooseProjectToRemove', { name: supplierUnassignTarget?.store_name || supplierUnassignTarget?.name || t('role.supplier') })} onClose={() => setSupplierUnassignTarget(null)}>
        {(supplierUnassignTarget?.assigned_projects || []).length === 0 ? (
          <Text className="text-[13px] font-semibold text-slate-500">{t('ui.contractor.noProjectsAssigned')}</Text>
        ) : (supplierUnassignTarget?.assigned_projects || []).map((row) => (
          <View key={`${row.project_id}-${row.engineer_id}`} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
            <View className="flex-1">
              <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{row.project_title || t('se.project')}</Text>
              <Text className="text-xs font-semibold text-slate-500">{t('ui.contractor.engineerName', { name: row.engineer_name || '—' })}</Text>
            </View>
            <ActionButton
              small
              tone="danger"
              label={t('ce.unassign')}
              disabled={busy}
              onPress={() => Alert.alert(t('ce.unassignSupplier'), t('ui.contractor.unassignFromNamedProjectConfirm', { name: supplierUnassignTarget?.store_name || supplierUnassignTarget?.name || t('role.supplier'), project: row.project_title || t('se.project') }), [
                { text: t('ce.cancel'), style: 'cancel' },
                { text: t('ce.unassign'), style: 'destructive', onPress: () => unassignSupplier(row) },
              ])}
            />
          </View>
        ))}
      </SheetModal>

      {/* Supplier profile */}
      <SheetModal visible={!!supplierProfile} tall title={supplierProfile?.store_name || supplierProfile?.name || t('role.supplier')} subtitle={supplierProfile?.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplierProfile.supplier_category) : t('role.supplier')} onClose={() => setSupplierProfile(null)}>
        {supplierProfile ? (
          <View>
            {supplierProfile.loading ? <Notice tone="info" text={t('dash.msg.loadingSupplierProfile')} /> : null}
            {supplierProfile.error ? <Notice tone="error" text={supplierProfile.error} /> : null}
            {supplierProfile.about ? <Text className="mb-2 text-[13px] leading-5 text-slate-600">{supplierProfile.about}</Text> : null}
            <InfoRow label={t('dash.owner.supplierModal.businessType')} value={supplierProfile.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, supplierProfile.business_type) : supplierProfile.business_type} />
            <InfoRow label={t('dash.common.categories')} value={(Array.isArray(supplierProfile.categories) ? supplierProfile.categories : String(supplierProfile.categories || '').split(',')).filter(Boolean).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, String(category).trim())).join(', ')} />
            <InfoRow label={t('ps.pincode')} value={supplierProfile.pincode} />
            <InfoRow label={t('ps.address')} value={supplierProfile.address} />
            <InfoRow label={t('ps.phoneShort')} value={supplierProfile.phone} />
            <InfoRow label={t('ps.email')} value={supplierProfile.email} />
            <InfoRow label={t('dash.contractor.gstLicense')} value={supplierProfile.gst_number || supplierProfile.license_number} />
            <InfoRow label={t('ce.sup.rating')} value={supplierProfile.rating || t('dash.common.new')} />
          </View>
        ) : null}
      </SheetModal>

      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} builderName={user?.name} onInvited={() => team.reload()} />
    </>
  )
}

/** Choose a project (one this supplier is not already on), then the engineer it goes through. */
function AssignSupplierSheet({ supplier, projectList, engineers, contractorSuppliers, busy, onClose, onAssign }) {
  const { t } = useLanguage()
  const [project, setProject] = useState(null)
  const [engineerId, setEngineerId] = useState(null)
  useEffect(() => { setProject(null); setEngineerId(null) }, [supplier])
  const taken = supplier ? takenProjectIdsFor({ supplier, projectList, contractorSuppliers }) : new Set()
  const available = projectList.filter((item) => !taken.has(String(item.id)))
  // The project's own Site Engineer first, then the rest of the team.
  const projectEngineerIds = new Set(engineers
    .filter((engineer) => (engineer.assigned_projects || []).some((item) => item.id === project?.id))
    .map((engineer) => engineer.user_id))
  const engineerOptions = [...engineers].sort((a, b) => Number(projectEngineerIds.has(b.user_id)) - Number(projectEngineerIds.has(a.user_id)))
  return (
    <SheetModal
      visible={!!supplier}
      title={t('ce.assignSupplier')}
      subtitle={project
        ? `${t('se.project')}: ${projectTitle(project, t)}`
        : t('ui.contractor.chooseProjectToAssignSupplier', { name: supplier?.store_name || supplier?.name || t('role.supplier') })}
      onClose={onClose}
      footer={project ? (
        <View className="flex-row gap-2">
          <ActionButton label={t('dash.common.back')} tone="outline" onPress={() => setProject(null)} className="flex-1" />
          <ActionButton label={t('ce.assign')} busy={busy} disabled={!engineerId} onPress={() => onAssign(project, engineerId)} className="flex-1" />
        </View>
      ) : null}
    >
      {!project ? (
        available.length ? available.map((item) => (
          <Pressable key={item.id} onPress={() => setProject(item)} className="border-b border-slate-100 py-3">
            <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{projectTitle(item, t)}</Text>
            <Text className="text-xs font-semibold text-slate-500">{t('ui.contractor.pincodeStatus', { pincode: item.pincode || '—', status: projectStatusText(item.status || 'active', t) })}</Text>
          </Pressable>
        )) : <Text className="text-[13px] font-semibold text-slate-500">{t('mobile.partners.supplierOnEveryProject')}</Text>
      ) : (
        <>
          <Text className="mb-2 text-xs font-bold text-slate-600">{t('ui.contractor.selectEngineerFor', { project: projectTitle(project, t) })}</Text>
          {engineerOptions.length ? engineerOptions.map((engineer) => {
            const on = engineerId === engineer.user_id
            return (
              <Pressable key={engineer.user_id} onPress={() => setEngineerId(engineer.user_id)} className={`mb-2 rounded-xl border px-3 py-2.5 ${on ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                <Text className="text-[14px] font-extrabold text-graphite">{engineer.name}</Text>
                <Text className="text-xs font-semibold text-slate-500">
                  {projectEngineerIds.has(engineer.user_id) ? t('mobile.partners.engineerOnThisProject') : (engineer.assigned_projects || []).map((item) => projectTitle(item, t)).join(', ') || t('ui.contractor.noProjectsAssigned')}
                </Text>
              </Pressable>
            )
          }) : <Text className="text-[13px] font-semibold text-slate-500">{t('team.noSiteEngineersSub')}</Text>}
        </>
      )}
    </SheetModal>
  )
}

/** The invitation text to share (web ce.shareMessage). */
function inviteShareMessage(t, builderName, code, link) {
  const name = builderName || t('ce.yourBuilder')
  return link
    ? t('ce.shareMessage', { name, code, link })
    : t('mobile.partners.shareInviteNoLink', { name, code })
}

function InviteSheet({ visible, onClose, builderName, onInvited }) {
  const { t } = useLanguage()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (visible) { setPhone(''); setEmail(''); setError(''); setResult(null) }
  }, [visible])

  async function generate() {
    if (!phone.trim()) { setError(t('mobile.partners.phoneRequired')); return }
    setBusy(true)
    setError('')
    try {
      const response = await inviteEngineer({ phone: phone.trim(), email: email.trim() })
      setResult(response)
      onInvited?.()
    } catch (failure) {
      setError(apiErrorText(failure, t('dash.err.generateInvitation')))
    } finally {
      setBusy(false)
    }
  }

  const share = () => Share.share({
    message: inviteShareMessage(t, builderName, result?.invite_code, result?.invite_link),
  }).catch(() => {})

  return (
    <SheetModal
      visible={visible}
      title={t('ce.inviteEngineer')}
      subtitle={t('ce.inviteSubtitle')}
      onClose={onClose}
      footer={result
        ? <ActionButton label={t('ce.done')} onPress={onClose} />
        : <ActionButton label={t('ce.generateInvitation')} busy={busy} disabled={!phone.trim()} onPress={generate} />}
    >
      {result ? (
        <View className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <Text className="text-xs font-bold text-brand-800">{t('ce.invitationGenerated')} — {t('ce.shareCode')}</Text>
          <Text className="mt-1 text-2xl font-extrabold tracking-widest text-brand-900">{result.invite_code || result.code}</Text>
          {result.invite_link ? <Text className="mt-1 text-xs text-slate-500" numberOfLines={2}>{result.invite_link}</Text> : null}
          <ActionButton label={t('mobile.partners.shareInvite')} icon={Share2} tone="brandOutline" onPress={share} className="mt-3" />
        </View>
      ) : (
        <>
          <LabeledInput label={`${t('ps.phone')} *`} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <LabeledInput label={`${t('ps.email')} (${t('ps.optional')})`} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {error ? <Notice tone="error" text={error} /> : null}
        </>
      )}
    </SheetModal>
  )
}
