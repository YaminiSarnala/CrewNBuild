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
import { View, Text, Pressable, TextInput, Alert, Share, ScrollView } from 'react-native'
import { useSelector } from 'react-redux'
import { Check, X, Send, Users, Search, Truck, Clock, Share2, UserRound, LayoutGrid, List } from 'lucide-react-native'
import { Image } from 'expo-image'
import { userAvatarSource } from '../../utils/avatars'
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
  ActionButton, InfoRow, LabeledInput, Notice, SearchBox, Section, SegmentTabs, SheetModal, Badge, SelectChip, ViewToggle,} from '../../components/builder/BuilderUi'
import { SITE_ENGINEER_CATEGORY, apiErrorText, asList, projectStatusText, takenProjectIdsFor } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { userCountry } from '../../utils/countryConfig'
import { BUSINESS_TYPE_KEYS, SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../i18n/optionKeys'
import { createStyles } from '../../theme/createStyles'

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


// Experience bands (web MyTeamEngineers): 0–2, 3–5, 6–10, 10+ years.
const EXPERIENCE_BANDS = [
  { value: '0-2', from: 0, to: 2 },
  { value: '3-5', from: 3, to: 5 },
  { value: '6-10', from: 6, to: 10 },
  { value: '10+', from: 11, to: Infinity },
]

/** On a project (web isBusy). */
const isBusy = (engineer) => (typeof engineer.working_on_project === 'boolean'
  ? engineer.working_on_project
  : Number(engineer.project_count || 0) > 0 || (engineer.assigned_projects || []).length > 0)
/** An engineer's category for display, falling back to "Site Engineer". */
const engineerCategory = (t, value) => (value ? optionLabel(t, ENGINEER_CATEGORY_LABEL_KEYS, value) : t('role.engineer'))

function Card({ children, onPress }) {
  const Wrapper = onPress ? Pressable : View
  return (
    <Wrapper onPress={onPress} style={styles.view}>
      {children}
    </Wrapper>
  )
}

function Meta({ items }) {
  return (
    <Text style={styles.text} numberOfLines={2}>
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
  // My Site Engineers filters and view (web MyTeamEngineers).
  const [teamLocation, setTeamLocation] = useState('')
  const [teamExperience, setTeamExperience] = useState('')
  const [teamProjects, setTeamProjects] = useState('')
  const [teamStatus, setTeamStatus] = useState('')
  const [teamView, setTeamView] = useState('grid')
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

  const locationOptions = [...new Set(active.map((engineer) => engineer.pincode).filter(Boolean))].sort().map((pin) => ({ value: pin, label: String(pin) }))
  const teamShown = active.filter((engineer) => {
    if (!matches(engineer.name, engineer.pincode, engineer.address, engineer.specialization)) return false
    if (teamLocation && engineer.pincode !== teamLocation) return false
    if (teamExperience) {
      const band = EXPERIENCE_BANDS.find((item) => item.value === teamExperience)
      const years = Number(engineer.experience_years || 0)
      if (band && (years < band.from || years > band.to)) return false
    }
    const busy = isBusy(engineer)
    if (teamProjects === 'on' && !busy) return false
    if (teamProjects === 'off' && busy) return false
    if (teamStatus === 'busy' && !busy) return false
    if (teamStatus === 'active' && busy) return false
    return true
  })
    const findShown = nearby.filter((engineer) => matches(engineer.name, engineer.pincode, engineer.address, engineer.specialization))
  const suppliersShown = supplierList.filter((supplier) => matches(supplier.store_name, supplier.name, supplier.pincode, supplier.address, ...(supplier.categories || [])))
  const teamStatusOf = (engineer) => (active.some((item) => item.user_id === engineer.user_id)
    ? 'active'
    : pending.some((item) => item.user_id === engineer.user_id) ? 'pending' : null)

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
                <Section>
          {/* "Invite Site Engineer" at the top right, as on the web. */}
          <View style={styles.view2}>
            <ActionButton small icon={UserRound} label={t('ce.inviteEngineer')} onPress={() => setInviteOpen(true)} />
          </View>
          <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
          <View style={styles.scrollView}>
            <SearchBox value={search} onChangeText={setSearch} placeholder={t('ce.filter.searchPh')} />
          </View>
          {tab === 'team' ? (
            // The web's filter bar: Location, Experience, Projects, Status, Grid / List.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 8 }}>
              <SelectChip placeholder={t('ce.filter.allLocations')} value={teamLocation} onChange={setTeamLocation} options={locationOptions} />
              <SelectChip placeholder={t('ce.filter.experience')} value={teamExperience} onChange={setTeamExperience} options={EXPERIENCE_BANDS.map((band) => ({ value: band.value, label: band.to === Infinity ? t('ce.filter.yearsPlus', { from: band.from - 1 }) : t('ce.filter.yearsRange', { from: band.from, to: band.to }) }))} />
              <SelectChip placeholder={t('ce.filter.projects')} value={teamProjects} onChange={setTeamProjects} options={[{ value: 'on', label: t('ce.filter.onProject') }, { value: 'off', label: t('ce.filter.notOnProject') }]} />
              <SelectChip placeholder={t('ce.filter.status')} value={teamStatus} onChange={setTeamStatus} options={[{ value: 'active', label: t('ce.active') }, { value: 'busy', label: t('ce.busy') }]} />
              <ViewToggle
                options={[{ id: 'grid', label: t('ce.view.grid'), icon: LayoutGrid }, { id: 'list', label: t('ce.view.list'), icon: List }]}
                active={teamView}
                onChange={setTeamView}
              />
            </ScrollView>
          ) : null}
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />

          {tab === 'team' ? (
            <PanelState loading={team.loading} error={team.error} empty={!teamShown.length} emptyText={active.length ? t('ce.filter.noMatch') : t('ce.noActiveEngineers')}>
                            {teamShown.map((engineer) => {
                const assigned = engineer.assigned_projects || []
                const busy = isBusy(engineer)
                const area = String(engineer.address || '').split(',').map((part) => part.trim()).filter(Boolean).pop() || ''
                const action = engineer.working_on_other_project ? (
                  <Text style={styles.text2}>{t('ce.workingOnAnotherProject')}</Text>
                ) : assigned.length ? (
                  <ActionButton small tone="danger" label={t('ce.unassign')} onPress={() => setUnassignTarget(engineer)} />
                ) : (
                  <ActionButton small tone="brandOutline" label={t('ce.assignProject')} onPress={() => setAssignTarget(engineer)} />
                )
                if (teamView === 'list') {
                  return (
                    <Pressable key={engineer.user_id} onPress={() => setEngineerProfile(engineer)} style={styles.pressable}>
                      <Image source={userAvatarSource(engineer, 'ENGINEER')} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                      <View style={styles.actionButton}>
                        <Text style={styles.text3} numberOfLines={1}>{engineer.name || engineer.full_name}</Text>
                        <Text style={styles.text4} numberOfLines={1}>
                          {[engineer.pincode, t('ce.yearsCount', { years: engineer.experience_years || 0 }), `${t('ce.filter.projects')}: ${engineer.project_count ?? assigned.length}`].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {busy ? <Badge label={t('ce.busy')} bg="#fffbeb" fg="#92400e" /> : <Badge label={t('ce.active')} bg="#ecfdf5" fg="#047857" />}
                    </Pressable>
                  )
                }
                return (
                  <Pressable key={engineer.user_id} onPress={() => setEngineerProfile(engineer)} style={styles.pressable2}>
                    <View style={styles.view3}>
                      <View style={{ width: 5, backgroundColor: busy ? '#f59e0b' : '#10b981' }} />
                      <View style={styles.view4}>
                        <View style={styles.view5}>
                          <Image source={userAvatarSource(engineer, 'ENGINEER')} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                          <View style={styles.actionButton}>
                            <Text style={styles.text5} numberOfLines={1}>{engineer.name || engineer.full_name}</Text>
                            <Text style={styles.text6}>{engineerCategory(t, engineer.specialization || engineer.category)}</Text>
                          </View>
                          {busy ? <Badge label={t('ce.busy')} bg="#fffbeb" fg="#92400e" /> : <Badge label={t('ce.active')} bg="#ecfdf5" fg="#047857" />}
                        </View>
                        <View style={styles.view6}>
                          {[
                            [engineer.pincode || '—', area || t('ce.col.location')],
                            [String(engineer.experience_years || 0), t('ce.filter.experience')],
                            [String(engineer.project_count ?? assigned.length), t('ce.filter.projects')],
                          ].map(([value, label]) => (
                            <View key={label} style={styles.view7}>
                              <Text style={styles.text7} numberOfLines={1}>{value}</Text>
                              <Text style={styles.text8} numberOfLines={1}>{label}</Text>
                            </View>
                          ))}
                        </View>
                        {assigned.length ? (
                          <Text style={styles.text9} numberOfLines={2}>{assigned.map((item) => projectTitle(item, t)).join(', ')}</Text>
                        ) : null}
                        <View style={styles.actionButton2}>{action}</View>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </PanelState>
          ) : null}

          {tab === 'find' ? (
            <>
              <View style={styles.view}>
                <Text style={styles.text10}>{t('mobile.partners.findPincodeLabel')}</Text>
                <View style={styles.view8}>
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
                    style={styles.textInput}
                  />
                  <ActionButton label={t('ce.find')} icon={Search} onPress={() => loadNearby()} />
                </View>
                {projectList.length ? (
                  <View style={styles.actionButton2}>
                    <Text style={styles.text10}>{t('mobile.partners.requestsForProject')}</Text>
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
                      <Text style={styles.text5} numberOfLines={1}>{engineer.name || engineer.full_name}</Text>
                      <Meta items={[engineerCategory(t, engineer.specialization), engineer.pincode, t('ui.contractor.yearsShort', { years: engineer.experience_years || 0 }), t('ui.contractor.projectsWithCount', { count: engineer.project_count || 0 })]} />
                      <ActionButton
                        small
                        icon={Send}
                        style={styles.actionButton3}
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
                    <Text style={styles.text11}>{supplier.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category) : t('role.supplier')}</Text>
                    <Text style={styles.text12} numberOfLines={1}>{supplier.store_name || supplier.name || t('role.supplier')}</Text>
                    <Meta items={[(supplier.categories || []).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, category)).join(', '), supplier.pincode, t('dash.owner.supplierModal.rating', { rating: Number(supplier.rating || 0).toFixed(1) })]} />
                    {assignments.length ? (
                      <Text style={styles.text13} numberOfLines={2}>{t('ui.projects')}: {assignments.map((row) => row.project_title).join(', ')}</Text>
                    ) : null}
                    <View style={styles.view6}>
                      <ActionButton small label={t('ce.assignProject')} tone="brandOutline" onPress={() => setSupplierAssignTarget(supplier)} style={styles.actionButton} />
                      <ActionButton small label={t('ce.unassign')} tone="danger" disabled={!assignments.length} onPress={() => setSupplierUnassignTarget(supplier)} style={styles.actionButton} />
                    </View>
                  </Card>
                )
              })}
            </PanelState>
          ) : null}

          {tab === 'pending' ? (
            <PanelState loading={team.loading} error={team.error} empty={!pending.length && !invitations.length && !outgoing.length} emptyText={t('ce.noPendingRequests')}>
              {pending.length ? <Text style={styles.text14}>{t('ce.pendingJoinRequests')}</Text> : null}
              {pending.filter((engineer) => matches(engineer.name, engineer.pincode)).map((engineer) => (
                <Card key={engineer.relationship_id || engineer.user_id}>
                  <Text style={styles.text5}>{engineer.name || engineer.full_name}</Text>
                  <Meta items={[engineerCategory(t, engineer.specialization || engineer.category), engineer.pincode, t('ui.contractor.yearsShort', { years: engineer.experience_years || 0 })]} />
                  <View style={styles.view6}>
                    <ActionButton small tone="danger" icon={X} label={t('ce.reject')} disabled={busy} onPress={() => respond(engineer.relationship_id, 'REJECT')} style={styles.actionButton} />
                    <ActionButton small icon={Check} label={t('ce.accept')} disabled={busy} onPress={() => respond(engineer.relationship_id, 'ACCEPT')} style={styles.actionButton} />
                  </View>
                </Card>
              ))}
              {invitations.length ? <Text style={styles.text15}>{t('ce.pendingInvitations')}</Text> : null}
              {invitations.filter((invitation) => matches(invitation.phone, invitation.email, invitation.invite_code)).map((invitation) => (
                <Card key={invitation.id}>
                  <Text style={styles.text3}>{invitation.phone || invitation.email || t('ce.waitingForEngineer')}</Text>
                  <Text style={styles.text}>{t('ce.pend.inviteCode')}: <Text style={styles.text16}>{invitation.invite_code}</Text></Text>
                  <View style={styles.view6}>
                    <ActionButton small icon={Share2} label={t('mobile.partners.share')} tone="brandOutline" onPress={() => shareInvite(invitation)} style={styles.actionButton} />
                    <ActionButton small icon={X} label={t('ui.contractor.revoke')} tone="danger" onPress={() => revokeInvitation(invitation)} style={styles.actionButton} />
                  </View>
                </Card>
              ))}
              {outgoing.length ? <Text style={styles.text15}>{t('ce.sentRequests')}</Text> : null}
              {outgoing.filter((engineer) => matches(engineer.name, engineer.pincode)).map((engineer) => (
                <Card key={`out-${engineer.user_id}`} onPress={() => setEngineerProfile(engineer)}>
                  <Text style={styles.text3}>{engineer.name}</Text>
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
                style={styles.actionButton4}
                icon={Send}
                label={sentIds.has(engineerProfile.user_id) ? t('ce.requestSent') : t('ce.sendRequest')}
                disabled={sentIds.has(engineerProfile.user_id) || sendingId === engineerProfile.user_id}
                busy={sendingId === engineerProfile.user_id}
                onPress={() => sendEngineerRequest(engineerProfile)}
              />
            ) : (
              <Text style={styles.text17}>{teamStatusOf(engineerProfile) === 'active' ? t('ce.activeTeamMember') : t('ce.joinRequestPending')}</Text>
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
              <View key={project.id} style={styles.view9}>
                <View style={styles.actionButton}>
                  <Text style={styles.text3} numberOfLines={1}>{projectTitle(project, t)}</Text>
                  <Text style={styles.text6}>
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
          <Text style={styles.text18}>{t('ce.noAssignedProjects')}</Text>
        ) : (unassignTarget?.assigned_projects || []).map((project) => (
          <View key={project.id} style={styles.view9}>
            <Text style={styles.text19} numberOfLines={1}>{projectTitle(project, t)}</Text>
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
          <Text style={styles.text18}>{t('ui.contractor.noProjectsAssigned')}</Text>
        ) : (supplierUnassignTarget?.assigned_projects || []).map((row) => (
          <View key={`${row.project_id}-${row.engineer_id}`} style={styles.view9}>
            <View style={styles.actionButton}>
              <Text style={styles.text3} numberOfLines={1}>{row.project_title || t('se.project')}</Text>
              <Text style={styles.text6}>{t('ui.contractor.engineerName', { name: row.engineer_name || '—' })}</Text>
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
            {supplierProfile.about ? <Text style={styles.text20}>{supplierProfile.about}</Text> : null}
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
        <View style={styles.view8}>
          <ActionButton label={t('dash.common.back')} tone="outline" onPress={() => setProject(null)} style={styles.actionButton} />
          <ActionButton label={t('ce.assign')} busy={busy} disabled={!engineerId} onPress={() => onAssign(project, engineerId)} style={styles.actionButton} />
        </View>
      ) : null}
    >
      {!project ? (
        available.length ? available.map((item) => (
          <Pressable key={item.id} onPress={() => setProject(item)} style={styles.pressable3}>
            <Text style={styles.text3} numberOfLines={1}>{projectTitle(item, t)}</Text>
            <Text style={styles.text6}>{t('ui.contractor.pincodeStatus', { pincode: item.pincode || '—', status: projectStatusText(item.status || 'active', t) })}</Text>
          </Pressable>
        )) : <Text style={styles.text18}>{t('mobile.partners.supplierOnEveryProject')}</Text>
      ) : (
        <>
          <Text style={styles.text21}>{t('ui.contractor.selectEngineerFor', { project: projectTitle(project, t) })}</Text>
          {engineerOptions.length ? engineerOptions.map((engineer) => {
            const on = engineerId === engineer.user_id
            return (
              <Pressable key={engineer.user_id} onPress={() => setEngineerId(engineer.user_id)} style={[styles.pressable4, on ? styles.pressable5 : styles.pressable6]}>
                <Text style={styles.text3}>{engineer.name}</Text>
                <Text style={styles.text6}>
                  {projectEngineerIds.has(engineer.user_id) ? t('mobile.partners.engineerOnThisProject') : (engineer.assigned_projects || []).map((item) => projectTitle(item, t)).join(', ') || t('ui.contractor.noProjectsAssigned')}
                </Text>
              </Pressable>
            )
          }) : <Text style={styles.text18}>{t('team.noSiteEngineersSub')}</Text>}
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
        <View style={styles.view10}>
          <Text style={styles.text22}>{t('ce.invitationGenerated')} — {t('ce.shareCode')}</Text>
          <Text style={styles.text23}>{result.invite_code || result.code}</Text>
          {result.invite_link ? <Text style={styles.text24} numberOfLines={2}>{result.invite_link}</Text> : null}
          <ActionButton label={t('mobile.partners.shareInvite')} icon={Share2} tone="brandOutline" onPress={share} style={styles.actionButton2} />
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

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view2: { marginBottom: 7, flexDirection: 'row', justifyContent: 'flex-end' },
  scrollView: { marginTop: 7 },
  text2: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: c.textMuted },
  pressable: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, backgroundColor: c.card, paddingHorizontal: 3.5, paddingVertical: 10.5 },
  actionButton: { flex: 1 },
  text3: { fontSize: 14, fontWeight: '800', color: c.text },
  text4: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  pressable2: { marginBottom: 10.5, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view3: { flexDirection: 'row' },
  view4: { flex: 1, padding: 14 },
  view5: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  text5: { fontSize: 15, fontWeight: '800', color: c.text },
  text6: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view6: { marginTop: 10.5, flexDirection: 'row', gap: 7 },
  view7: { flex: 1, borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 7, paddingVertical: 7 },
  text7: { fontSize: 13, fontWeight: '800', color: c.text },
  text8: { fontSize: 10, fontWeight: '600', color: c.textMuted },
  text9: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  actionButton2: { marginTop: 10.5 },
  text10: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view8: { flexDirection: 'row', gap: 7 },
  textInput: { height: 38.5, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  actionButton3: { marginTop: 10.5, alignSelf: 'flex-start' },
  text11: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.brandText },
  text12: { marginTop: 3.5, fontSize: 15, fontWeight: '800', color: c.text },
  text13: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  text14: { marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase', color: c.textMuted },
  text15: { marginBottom: 7, marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase', color: c.textMuted },
  text16: { fontWeight: '800', letterSpacing: 1.6, color: c.brandTextDeep },
  actionButton4: { marginTop: 14 },
  text17: { marginTop: 14, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.brandText },
  view9: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text18: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  text19: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  text20: { marginBottom: 7, fontSize: 13, lineHeight: 17.5, color: c.textSecondary },
  pressable3: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text21: { marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  pressable4: { marginBottom: 7, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  pressable5: { borderColor: '#1a5038', backgroundColor: c.brandSoft },
  pressable6: { borderColor: c.border, backgroundColor: c.card },
  view10: { borderRadius: 16, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, padding: 14 },
  text22: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.brandTextStrong },
  text23: { marginTop: 3.5, fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: 1.6, color: c.brandTextDeep },
  text24: { marginTop: 3.5, fontSize: 12, lineHeight: 16, color: c.textMuted },
}))
