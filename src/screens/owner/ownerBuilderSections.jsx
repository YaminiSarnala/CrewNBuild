// Phase 3: hiring a builder for one project. Ports of the web
//   OwnerContractorsSection  -> FindBuildersSection
//   OwnerRequestsSection     -> RequestsSection
//   ProjectDetailPanel's "assignedBuilders" view -> AssignBuilderSection
// plus useBuilderHiring(), the request list and handlers the web keeps in
// OwnerDashboard, scoped here to the open project.
//
// The rules are the server's and the web's:
//   - Accepting a request only shortlists the builder; Assign appoints them,
//     and Negotiate opens an offer instead. The builder then confirms.
//   - One live award per project; nothing can be assigned, negotiated or
//     cancelled once the project has started.
//   - A builder's phone stays hidden until the request is accepted.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { Image } from 'expo-image'
import { ArrowRight, BadgeCheck, Check, Eye, MapPin, Sparkles, Star, X } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import { FormNotice } from '../../components/form'
import StatusPill from '../../components/StatusPill'
import Dialog, { DialogButton, DialogRow } from '../../components/Dialog'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useLiveVersion } from '../../hooks/useLiveRefresh'
import {
  acceptProjectRequest, assignProjectToContractor, fetchIncomingRequests, fetchProjectAward, negotiateQuotation,
  rejectProjectRequest, sendProjectRequest, withdrawProjectRequest,
} from '../../api/requests'
import { fetchNearbyContractors } from '../../api/projects'
import { SERVICE_OPTION_KEYS, optionLabel } from '../../i18n/optionKeys'
import { requestTypeLabel as sharedRequestTypeLabel } from '../../utils/roleLabels'
import { ratingLabel } from '../../utils/ratingLabel'
import { userAvatarSource } from '../../utils/avatars'
import { userCountry } from '../../utils/countryConfig'
import { COLORS } from '../../theme/tokens'
import { apiDetail, builderIdOnRequest, buildingTypeText, constructionTypeText, money } from './ownerHelpers'
import AwardPanel, { NegotiateDialog } from './AwardPanel'
import { FLOW_TONES, flowStyles, findBuilderRequest, hasAssignmentFlow, OWNER_BUILDER_REQUEST_TYPES, requestFlowStatus, useRequestAwards } from './requestAwards'
import { createStyles } from '../../theme/createStyles'

const SENDER_ROLE_KEYS = {
  OWNER: 'role.owner',
  CONTRACTOR: 'role.contractor',
  SUPPLIER: 'role.supplier',
  ENGINEER: 'role.engineer',
}

export function requestTypeLabel(requestType, t, td) {
  const mapped = {
    CONTRACTOR_TO_OWNER: t('dash.common.builderRequest'),
    OWNER_TO_CONTRACTOR: t('dash.common.builderRequest'),
    OWNER_TO_SUPPLIER: t('dash.common.supplierRequest'),
    SUPPLIER_TO_OWNER: t('dash.common.supplierRequest'),
    OWNER_TO_ENGINEER: t('ui.owner.engineerRequest'),
  }[requestType]
  if (mapped) return mapped
  if (!requestType) return t('dash.common.request')
  const shared = sharedRequestTypeLabel(requestType, t)
  if (shared && shared !== requestType) return shared
  const spelled = String(requestType).replace(/_/g, ' ').toLowerCase()
  const readable = spelled.charAt(0).toUpperCase() + spelled.slice(1)
  return td ? td(readable) : readable
}

function FlowPill({ flow, t }) {
  const tone = FLOW_TONES[flow.tone]
  return (
    <View style={[styles.view, flowStyles[tone.box], { gap: 4 }]}>
      {flow.actionRequired ? <View style={styles.view2} /> : null}
      <Text style={[styles.text, flowStyles[tone.text], { fontSize: 10 }]}>{t(flow.key)}</Text>
    </View>
  )
}

function SmallButton({ label, icon: Icon, onPress, look = 'primary', disabled = false, style }) {
  const looks = {
    primary: { box: 'tone', text: 'tone2', icon: '#ffffff' },
    outline: { box: 'tone3', text: 'tone4', icon: COLORS.graphite },
    danger: { box: 'tone5', text: 'tone6', icon: '#dc2626' },
  }
  const { box, text, icon } = looks[look]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.pressable, styles[box], disabled ? styles.pressable2 : null, [{ gap: 5 }, style]]}
    >
      {Icon ? <Icon size={13} color={icon} /> : null}
      <Text style={[styles.text2, styles[text], { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  )
}

/**
 * The open project's requests and every hiring action, as the web dashboard
 * keeps them. Accept and Send need a complete profile (the server refuses
 * them otherwise); each action reloads the requests and the project.
 */
export function useBuilderHiring(project, reloadProject) {
  const { t } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const [requestList, setRequestList] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [decisionMessage, setDecisionMessage] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [assignMessage, setAssignMessage] = useState('')
  const [sendingReceiverId, setSendingReceiverId] = useState(null)
  const [assigningRequestId, setAssigningRequestId] = useState(null)
  const projectId = project?.id

  const reloadRequests = useCallback(async () => {
    try {
      const list = await fetchIncomingRequests()
      // Strictly this project's own requests, as on the web.
      setRequestList((Array.isArray(list) ? list : []).filter((request) => String(request.project_id) === String(projectId)))
    } catch {
      setRequestList([])
    } finally {
      setRequestsLoading(false)
    }
  }, [projectId])

  useEffect(() => { if (projectId) reloadRequests() }, [projectId, reloadRequests])

  const refreshAll = useCallback(async () => {
    await Promise.all([reloadRequests(), reloadProject?.()])
  }, [reloadRequests, reloadProject])

  const decisionError = (error, fallbackKey) => {
    const detail = error?.response?.data?.detail
    return typeof detail === 'string' && detail ? detail : t(fallbackKey)
  }

  const acceptRequest = async (requestId) => {
    if (requireCompleteProfile(() => acceptRequest(requestId))) return
    setDecisionMessage('')
    try {
      await acceptProjectRequest(requestId)
    } catch (error) {
      setDecisionMessage(decisionError(error, 'dash.err.acceptRequest'))
    }
    // Refreshed either way, so a request answered elsewhere shows its real state.
    refreshAll()
  }

  const rejectRequest = (requestId) => {
    Alert.alert(t('dash.common.reject'), '', [
      { text: t('dash.common.cancel'), style: 'cancel' },
      {
        text: t('dash.common.reject'),
        style: 'destructive',
        onPress: async () => {
          setDecisionMessage('')
          try {
            await rejectProjectRequest(requestId)
          } catch (error) {
            setDecisionMessage(decisionError(error, 'dash.err.rejectRequest'))
          }
          refreshAll()
        },
      },
    ])
  }

  // The owner's own pending request can be taken back; it stays as Withdrawn.
  const withdrawRequest = async (requestId) => {
    setDecisionMessage('')
    try {
      await withdrawProjectRequest(requestId)
    } catch (error) {
      setDecisionMessage(decisionError(error, 'dash.err.withdrawRequest'))
    }
    refreshAll()
  }

  const sendBuilderRequest = async (contractor) => {
    if (requireCompleteProfile(() => sendBuilderRequest(contractor))) return
    setRequestMessage('')
    setSendingReceiverId(contractor.user_id)
    try {
      await sendProjectRequest({ receiver_id: contractor.user_id, project_id: projectId, request_type: 'OWNER_TO_CONTRACTOR' })
      // No "sent" note: the card itself turns to Request Pending.
      await reloadRequests()
    } catch (error) {
      setRequestMessage(apiDetail(error, t('dash.err.sendBuilderRequest')))
    } finally {
      setSendingReceiverId(null)
    }
  }

  const assignBuilder = async (requestId) => {
    setAssignMessage('')
    setAssigningRequestId(requestId)
    try {
      await assignProjectToContractor(requestId)
      await refreshAll()
    } catch (error) {
      setAssignMessage(apiDetail(error, t('quote.assignFailed')))
    } finally {
      setAssigningRequestId(null)
    }
  }

  // The dialog shows a refusal; the data is reloaded either way.
  const negotiateBuilder = async (requestId, amount, note) => {
    setAssignMessage('')
    try {
      await negotiateQuotation(requestId, amount, note)
    } finally {
      await refreshAll()
    }
  }

  return {
    requestList,
    requestsLoading,
    reloadRequests,
    refreshAll,
    decisionMessage,
    requestMessage,
    assignMessage,
    sendingReceiverId,
    assigningRequestId,
    acceptRequest,
    rejectRequest,
    withdrawRequest,
    sendBuilderRequest,
    assignBuilder,
    negotiateBuilder,
  }
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

function RequestDetails({ request, project, awards, canChoose, onNegotiate, onAwardChanged }) {
  const { t, td } = useLanguage()
  const country = project?.project_country || 'India'
  const tile = (label, value) => (
    <View style={[styles.view3, { flexGrow: 1, flexBasis: '30%' }]}>
      <Text style={[styles.text3, { fontSize: 9.5 }]}>{label}</Text>
      <Text style={[styles.text4, { fontSize: 12 }]}>{value}</Text>
    </View>
  )
  const detail = (label, value) => (
    <View style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Text style={[styles.text5, { fontSize: 11 }]}>{label}</Text>
      <Text style={[styles.text6, { fontSize: 12.5 }]}>{value || '—'}</Text>
    </View>
  )
  return (
    <View style={[styles.view4, { gap: 10 }]}>
      <View style={styles.view5}>
        <View style={[styles.view6, { gap: 10 }]}>
          <Image source={userAvatarSource(request)} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
          <View style={styles.view7}>
            <Text style={[styles.text7, { fontSize: 15 }]} numberOfLines={1}>{td(request.sender_name)}</Text>
            <Text style={[styles.text8, { fontSize: 11.5 }]}>
              {SENDER_ROLE_KEYS[request.sender_role] ? t(SENDER_ROLE_KEYS[request.sender_role]) : td(request.sender_role)}
            </Text>
            {request.profile_about ? (
              <Text style={[styles.text9, { fontSize: 11.5, lineHeight: 16 }]} numberOfLines={2}>{td(request.profile_about)}</Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.view8, { gap: 8 }]}>
          {tile(t('dash.common.rating'), String(request.profile_rating || 0))}
          {tile(t('dash.common.pincode'), request.profile_pincode || request.sender_pincode || '—')}
          {/* The phone is shared only once the request is accepted. */}
          {tile(t('dash.common.phone'), request.status === 'accepted' ? request.profile_phone || '—' : t('dash.common.lockedUntilAccepted'))}
        </View>
      </View>

      <View style={styles.view5}>
        <Text style={[styles.text3, { fontSize: 10, letterSpacing: 1.2 }]}>{t('dash.common.requestDetails')}</Text>
        <View style={[styles.view9, { rowGap: 8, columnGap: 10 }]}>
          {detail(t('dash.common.type'), requestTypeLabel(request.request_type, t, td))}
          {detail(t('dash.common.construction'), constructionTypeText(request.construction_type, t))}
          {detail(t('dash.common.building'), buildingTypeText(request.building_type, t))}
          {detail(t('dash.common.budget'), Number(request.budget || 0) ? money(request.budget, country) : '—')}
          {Number(request.quotation_amount || 0) > 0 ? detail(t('dash.common.quotation'), money(request.quotation_amount, country)) : null}
        </View>
        <View style={styles.view10}>
          {detail(t('dash.common.address'), td(request.project_address || request.sender_address))}
        </View>
      </View>

      {/* A quotation not chosen yet: Negotiate. Assigning is done in the
          project's Assign Builder tab, never here. */}
      {canChoose ? (
        <View style={styles.view5}>
          <View style={[styles.view11, { gap: 10 }]}>
            <View style={styles.view7}>
              <Text style={[styles.text5, { fontSize: 11 }]}>{t('request.flow.builderQuotation')}</Text>
              <Text style={[styles.text6, { fontSize: 13 }]}>{money(request.quotation_amount, country)}</Text>
            </View>
            <View style={styles.view7}>
              <Text style={[styles.text5, { fontSize: 11 }]}>{t('award.negotiateModal.yourBudget')}</Text>
              <Text style={[styles.text6, { fontSize: 13 }]}>
                {Number(project.original_budget ?? project.budget) > 0 ? money(project.original_budget ?? project.budget, country) : t('dash.common.notSet')}
              </Text>
            </View>
          </View>
          <SmallButton label={t('quote.negotiate')} look="outline" onPress={() => onNegotiate(request)} style={{ marginTop: 10 }} />
        </View>
      ) : null}

      {/* The assignment made on this request: the owner's side of the
          negotiation (accept / reject / counter) and cancel. */}
      {hasAssignmentFlow(request) && request.id in awards ? (
        <AwardPanel key={awards[request.id]?.id || 'none'} projectId={request.project_id} requestId={request.id} onChanged={onAwardChanged} />
      ) : null}
    </View>
  )
}

export function RequestsSection({ project, hiring, initialRequestId = null }) {
  const { t, td } = useLanguage()
  const { requestList, requestsLoading, decisionMessage, acceptRequest, rejectRequest, withdrawRequest, negotiateBuilder, refreshAll } = hiring
  const [expandedRequestId, setExpandedRequestId] = useState(initialRequestId)
  const [negotiating, setNegotiating] = useState(null)
  const [awards, reloadAwards] = useRequestAwards(requestList)
  const country = project?.project_country || 'India'

  const awardChanged = () => {
    reloadAwards()
    refreshAll()
  }

  // A negotiation not yet assigned holds the project's one live award.
  const liveNegotiation = Object.values(awards).some((award) => award && award.assigned === false && ['negotiating', 'awaiting_builder'].includes(award.status))
  // A quotation the owner can still choose: the rules /project-requests/assign applies.
  const canChooseQuotation = (request) => Boolean(project)
    && hasAssignmentFlow(request)
    && Number(request.quotation_amount || 0) > 0
    && request.id in awards
    && (!awards[request.id] || awards[request.id].phase === 'cancelled')
    && !project.contractor_id
    && !liveNegotiation
    && project.started !== true
    && builderIdOnRequest(request) != null

  const count = requestList.length

  return (
    <Panel
      title={t('ui.requests')}
      action={(
        <View style={styles.view12}>
          <Text style={[styles.text10, { fontSize: 11 }]}>
            {`${count} ${count === 1 ? t('dash.owner.requests.one') : t('dash.owner.requests.many')}`}
          </Text>
        </View>
      )}
    >
      <Text style={[styles.text11, { fontSize: 12.5 }]}>{t('dash.owner.requests.sub')}</Text>
      <FormNotice message={decisionMessage} tone="error" style={{ marginBottom: 10 }} />
      <PanelState
        loading={requestsLoading}
        empty={!count}
        emptyText={`${t('dash.owner.requests.emptyTitle')}. ${t('dash.owner.requests.emptySub')}`}
      >
        {requestList.map((request) => {
          const pending = request.status === 'pending'
          const canAct = pending && !request.is_sender
          const expanded = expandedRequestId === request.id
          const flow = requestFlowStatus(request, awards[request.id], 'owner')
          return (
            <View key={request.id} style={styles.view13}>
              <View style={[styles.view6, { gap: 10 }]}>
                <Image source={userAvatarSource(request)} style={{ width: 36, height: 36, borderRadius: 10 }} contentFit="cover" />
                <View style={styles.view7}>
                  <Text style={[styles.text6, { fontSize: 14 }]} numberOfLines={1}>{td(request.sender_name)}</Text>
                  <Text style={[styles.text8, { fontSize: 11.5 }]} numberOfLines={1}>
                    {`${requestTypeLabel(request.request_type, t, td)} · ${td(request.project_title) || t('dash.owner.requests.general')}`}
                  </Text>
                  <View style={[styles.view14, { gap: 8 }]}>
                    {flow ? <FlowPill flow={flow} t={t} /> : <StatusPill status={request.status} />}
                    {Number(request.quotation_amount || 0) > 0 ? (
                      <Text style={[styles.text6, { fontSize: 11.5 }]}>
                        {`${t('dash.common.quotation')}: ${money(request.quotation_amount, country)}`}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={[styles.view15, { gap: 8 }]}>
                {canAct ? (
                  <>
                    <SmallButton label={t('dash.common.accept')} icon={Check} onPress={() => acceptRequest(request.id)} />
                    <SmallButton label={t('dash.common.reject')} icon={X} look="danger" onPress={() => rejectRequest(request.id)} />
                  </>
                ) : (
                  <>
                    {pending && request.is_sender ? (
                      <SmallButton label={t('property.action.withdraw')} look="outline" onPress={() => withdrawRequest(request.id)} />
                    ) : null}
                    <SmallButton
                      label={expanded ? t('dash.common.hide') : flow ? t('request.flow.viewRequest') : t('dash.common.view')}
                      icon={Eye}
                      look={flow?.actionRequired ? 'primary' : 'outline'}
                      onPress={() => setExpandedRequestId(expanded ? null : request.id)}
                    />
                  </>
                )}
              </View>

              {expanded ? (
                <RequestDetails
                  request={request}
                  project={project}
                  awards={awards}
                  canChoose={canChooseQuotation(request)}
                  onNegotiate={setNegotiating}
                  onAwardChanged={awardChanged}
                />
              ) : null}
            </View>
          )
        })}
      </PanelState>

      <NegotiateDialog
        visible={Boolean(negotiating)}
        quotation={negotiating?.quotation_amount}
        builderName={negotiating?.sender_name}
        budget={project?.original_budget ?? project?.budget}
        country={country}
        onSubmit={async (amount, note) => {
          try {
            await negotiateBuilder(negotiating.id, amount, note)
          } finally {
            reloadAwards()
          }
        }}
        onClose={() => setNegotiating(null)}
      />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Find Builders
// ---------------------------------------------------------------------------

const SERVICE_TONES = [
  { box: 'tone7', text: 'tone8' },
  { box: 'tone9', text: 'tone10' },
  { box: 'tone11', text: 'tone12' },
  { box: 'tone13', text: 'tone14' },
]

function ServicePills({ services = [] }) {
  const { t, td } = useLanguage()
  if (!services?.length) return <Text style={[styles.text5, { fontSize: 11 }]}>—</Text>
  const label = (service) => {
    const known = optionLabel(t, SERVICE_OPTION_KEYS, service)
    return known === service ? td(service) : known
  }
  return (
    <View style={[styles.view16, { gap: 4 }]}>
      {services.slice(0, 2).map((service, index) => {
        const tone = SERVICE_TONES[index % SERVICE_TONES.length]
        return (
          <View key={service} style={[styles.view17, styles[tone.box], { maxWidth: '70%' }]}>
            <Text style={[styles.text12, styles[tone.text], { fontSize: 10 }]} numberOfLines={1}>{label(service)}</Text>
          </View>
        )
      })}
      {services.length > 2 ? (
        <View style={styles.view18}>
          <Text style={[styles.text13, { fontSize: 10 }]}>{`+${services.length - 2}`}</Text>
        </View>
      ) : null}
    </View>
  )
}

// A builder who joined within this window (2 days) is marked "Newly joined".
const NEWLY_JOINED_MS = 2 * 24 * 60 * 60 * 1000

export function FindBuildersSection({ project, user, hiring, onViewProfile }) {
  const { t, td } = useLanguage()
  const { columns } = useResponsive()
  const { requestList, requestMessage, decisionMessage, sendingReceiverId, sendBuilderRequest, acceptRequest, rejectRequest } = hiring
  const [contractors, setContractors] = useState([])
  const [loading, setLoading] = useState(true)
  const [awards] = useRequestAwards(requestList)

  // Builder discovery is read for this project's site.
  const sitePincode = project.pincode || user?.pincode
  const siteCountry = project.project_country || userCountry(user)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchNearbyContractors(sitePincode, siteCountry, project.id)
      .then((list) => { if (alive) setContractors(Array.isArray(list) ? list : []) })
      .catch(() => { if (alive) setContractors([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sitePincode, siteCountry, project.id])

  // A project with an assigned builder cannot take another: every OTHER card is disabled.
  const assignedBuilderId = project?.contractor_id
  const builderAlreadyAssigned = Boolean(assignedBuilderId)
  const projectMeta = [
    project?.land_area ? t('dash.owner.sqft', { area: project.land_area }) : '',
    project?.floors ? (Number(project.floors) === 1 ? t('dash.owner.contractors.floorsOne', { n: project.floors }) : t('dash.owner.contractors.floorsMany', { n: project.floors })) : '',
  ].filter(Boolean).join(' · ')
  const cardWidth = columns > 1 ? `${(100 - (columns - 1) * 2) / columns}%` : '100%'

  const renderBuilder = (contractor) => {
    const sending = sendingReceiverId === contractor.user_id
    const builderName = td(contractor.name || contractor.company_name) || t('role.builder')
    const companyName = contractor.company_name && td(contractor.company_name) !== builderName ? td(contractor.company_name) : ''
    // User ids are UUIDs: compared as strings.
    const isAssignedBuilder = builderAlreadyAssigned && String(contractor.user_id) === String(assignedBuilderId)
    const unavailable = builderAlreadyAssigned && !isAssignedBuilder
    // The request already between the owner and THIS builder for THIS project,
    // matched in both directions, so the card never offers a duplicate.
    const existingRequest = findBuilderRequest(requestList, contractor.user_id, project.id)
    const requestStatus = existingRequest?.status || 'none'
    const award = existingRequest ? awards[existingRequest.id] : null
    const flow = requestStatus === 'accepted' ? requestFlowStatus(existingRequest, award, 'owner') : null
    // A builder who wrote to the owner first: the owner answers here.
    const incomingPendingRequest = requestStatus === 'pending'
      ? requestList.find((request) => (
        OWNER_BUILDER_REQUEST_TYPES.includes(request.request_type)
        && request.status === 'pending'
        && request.is_receiver
        && String(request.sender_id) === String(contractor.user_id)
      ))
      : null
    const newlyJoined = contractor.joined_at && Date.now() - new Date(contractor.joined_at).getTime() <= NEWLY_JOINED_MS

    let action
    if (unavailable) {
      action = (
        <View>
          <SmallButton label={t('dash.common.sendRequest')} icon={ArrowRight} disabled />
          <Text style={[styles.text14, { fontSize: 10.5 }]}>{t('dash.owner.contractors.builderAssignedNote')}</Text>
        </View>
      )
    } else if (requestStatus === 'accepted') {
      const tone = flow ? FLOW_TONES[flow.tone] : FLOW_TONES.confirmed
      action = (
        <View style={[styles.view19, flowStyles[tone.box]]}>
          <Text style={[styles.text2, flowStyles[tone.text], { fontSize: 11.5 }]} numberOfLines={1}>{flow ? t(flow.key) : t('dash.common.accepted')}</Text>
        </View>
      )
    } else if (incomingPendingRequest) {
      action = (
        <View style={[styles.view11, { gap: 6 }]}>
          <SmallButton label={t('dash.common.accept')} icon={Check} onPress={() => acceptRequest(incomingPendingRequest.id)} style={{ flex: 1 }} />
          <SmallButton label={t('dash.common.reject')} icon={X} look="danger" onPress={() => rejectRequest(incomingPendingRequest.id)} style={{ flex: 1 }} />
        </View>
      )
    } else if (requestStatus === 'pending') {
      action = (
        <View style={[styles.view20, { gap: 5 }]}>
          <View style={styles.view21} />
          <Text style={[styles.text15, { fontSize: 11.5 }]}>{t('dash.common.requestPending')}</Text>
        </View>
      )
    } else {
      // After a rejected or withdrawn request a new one may be sent.
      action = (
        <SmallButton
          label={sending ? t('dash.common.sending') : t('dash.common.sendRequest')}
          icon={ArrowRight}
          onPress={() => sendBuilderRequest(contractor)}
          disabled={sending}
        />
      )
    }

    return (
      <Pressable
        key={contractor.id || contractor.user_id}
        onPress={() => !unavailable && onViewProfile(contractor)}
        disabled={unavailable}
        style={[styles.pressable3, unavailable ? styles.pressable2 : null, { width: cardWidth }]}
      >
        {newlyJoined ? (
          <View style={[styles.view22, { gap: 3 }]}>
            <Sparkles size={10} color="#ffffff" />
            <Text style={[styles.text16, { fontSize: 10 }]}>{t('dash.owner.contractors.newlyJoined')}</Text>
          </View>
        ) : null}
        <View style={[styles.view23, { gap: 10 }]}>
          <Image source={userAvatarSource(contractor, 'CONTRACTOR')} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          <View style={styles.view7}>
            <Text style={[styles.text6, { fontSize: 14.5 }]} numberOfLines={1}>{builderName}</Text>
            <View style={[styles.view23, { gap: 5 }]}>
              <Text style={[styles.text17, { fontSize: 10.5 }]} numberOfLines={1}>{companyName || ' '}</Text>
              {contractor.is_verified === true ? (
                <View style={[styles.view24, { gap: 2 }]}>
                  <BadgeCheck size={10} color={COLORS.brand[700]} />
                  <Text style={[styles.text18, { fontSize: 9.5 }]}>{t('dash.common.verified')}</Text>
                </View>
              ) : null}
            </View>
            {projectMeta ? <Text style={[styles.text5, { fontSize: 10.5 }]}>{projectMeta}</Text> : null}
          </View>
        </View>

        <View style={styles.view25}>
          {[
            [t('dash.owner.contractors.colExperience'), t('dash.owner.contractors.yearsShort', { n: Number(contractor.experience_years || 0) })],
            [t('dash.owner.contractors.colCompleted'), String(Number(contractor.completed_projects || 0))],
          ].map(([label, value]) => (
            <View key={label} style={styles.view26}>
              <Text style={[styles.text19, { fontSize: 9.5 }]} numberOfLines={1}>{label}</Text>
              <Text style={[styles.text6, { fontSize: 12 }]}>{value}</Text>
            </View>
          ))}
          <View style={styles.view27}>
            <Text style={[styles.text19, { fontSize: 9.5 }]}>{t('dash.owner.contractors.colRating')}</Text>
            <View style={[styles.view23, { gap: 3 }]}>
              <Star size={11} color="#fbbf24" fill="#fbbf24" />
              <Text style={[styles.text6, { fontSize: 12 }]}>{ratingLabel(contractor.rating, contractor.review_count, t)}</Text>
            </View>
            <Text style={[styles.text5, { fontSize: 9 }]}>{t('dash.owner.contractors.reviews', { count: Number(contractor.review_count || 0) })}</Text>
          </View>
        </View>

        <View style={[styles.view10, { minHeight: 20 }]}>
          <ServicePills services={contractor.services_offered} />
        </View>

        <View style={[styles.view28, { gap: 6 }]}>
          <View style={styles.view7}>{action}</View>
          <SmallButton label={t('dash.owner.contractors.view')} icon={Eye} look="outline" onPress={() => onViewProfile(contractor)} disabled={unavailable} />
        </View>
      </Pressable>
    )
  }

  return (
    <Panel title={t('dash.owner.contractors.title')}>
      <View style={[styles.view29, { gap: 4 }]}>
        <MapPin size={12} color={COLORS.slate[400]} />
        <Text style={[styles.text8, { fontSize: 12 }]}>
          {t('dash.owner.contractors.pincodeLabel', { pincode: sitePincode || t('dash.common.notSet') })}
        </Text>
      </View>
      <FormNotice message={decisionMessage || requestMessage} tone="error" style={{ marginBottom: 10 }} />
      <PanelState
        loading={loading}
        empty={!contractors.length}
        emptyText={`${t('dash.owner.contractors.emptyTitle')}. ${t('dash.owner.contractors.emptySub')}`}
      >
        <Text style={[styles.text20, { fontSize: 12.5 }]}>
          {contractors.length === 1
            ? t('dash.owner.contractors.inAreaOne', { count: contractors.length })
            : t('dash.owner.contractors.inAreaMany', { count: contractors.length })}
        </Text>
        <View style={styles.view30}>{contractors.map(renderBuilder)}</View>
      </PanelState>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Assign Builder
// ---------------------------------------------------------------------------

export function AssignBuilderSection({ project, hiring }) {
  const { t, td } = useLanguage()
  const { requestList, assignMessage, assigningRequestId, assignBuilder, negotiateBuilder } = hiring
  const [declinedRequestIds, setDeclinedRequestIds] = useState([])
  const [currentAward, setCurrentAward] = useState(null)
  const [panelVersion, setPanelVersion] = useState(0)
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignBusy, setAssignBusy] = useState(false)
  const [negotiating, setNegotiating] = useState(null)
  const liveVersion = useLiveVersion()
  const country = project.project_country || 'India'

  // Every accepted quotation on THIS project, whichever side opened it.
  const quotations = useMemo(() => requestList.filter((request) => (
    OWNER_BUILDER_REQUEST_TYPES.includes(request.request_type)
    && request.status === 'accepted'
    && Number(request.quotation_amount || 0) > 0
  )), [requestList])

  // The project's current award and the quotations whose builder declined it.
  useEffect(() => {
    let alive = true
    fetchProjectAward(project.id)
      .then((response) => {
        if (!alive) return
        setDeclinedRequestIds(response?.declined_request_ids || [])
        setCurrentAward(response?.award || null)
      })
      .catch(() => { if (alive) setCurrentAward(null) })
    return () => { alive = false }
  }, [project.id, project.contractor_id, panelVersion, requestList, liveVersion])

  // A negotiation not turned into an assignment holds the project's one live award.
  const liveNegotiation = currentAward && currentAward.assigned === false && ['negotiating', 'awaiting_builder'].includes(currentAward.status)
    ? currentAward
    : null
  const blocked = Boolean(project.contractor_id) || Boolean(liveNegotiation) || project.started === true

  return (
    <Panel
      title={t('ui.assignedBuilders')}
      action={project.contractor_id ? (
        <View style={[styles.view31, { gap: 5 }]}>
          <View style={styles.view32} />
          <Text style={[styles.text21, { fontSize: 11 }]}>{t('quote.builderAssigned')}</Text>
        </View>
      ) : (
        <View style={styles.view33}>
          <Text style={[styles.text22, { fontSize: 11 }]}>{t('quote.awaitingSelection')}</Text>
        </View>
      )}
    >
      <Text style={[styles.text11, { fontSize: 12.5 }]}>{t('quote.acceptedQuotationsSub')}</Text>
      {!quotations.length ? (
        <Text style={[styles.text23, { fontSize: 12.5 }]}>{t('quote.noneYet')}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {quotations.map((quotation) => {
            const isAssigned = String(project.contractor_id) === String(builderIdOnRequest(quotation))
            const isLive = liveNegotiation?.request_id === quotation.id
            return (
              <View key={quotation.id} style={styles.view34}>
                <Text style={[styles.text6, { fontSize: 14 }]} numberOfLines={1}>{td(quotation.sender_name)}</Text>
                <Text style={[styles.text23, { fontSize: 12 }]}>
                  {`${t('dash.common.quotation')}: `}
                  <Text style={styles.text6}>{money(quotation.quotation_amount, country)}</Text>
                </Text>
                {isLive && liveNegotiation.agreed_offer_id ? (
                  <Text style={[styles.text23, { fontSize: 12 }]}>
                    {`${t('award.agreedQuotation')}: `}
                    <Text style={styles.text6}>{money(liveNegotiation.agreed_amount, country)}</Text>
                  </Text>
                ) : null}

                <View style={[styles.view35, { gap: 8 }]}>
                  {isAssigned ? (
                    <View style={[styles.view36, { gap: 5 }]}>
                      <View style={styles.view32} />
                      <Text style={[styles.text21, { fontSize: 11.5 }]}>{t('quote.assigned')}</Text>
                    </View>
                  ) : declinedRequestIds.includes(quotation.id) ? (
                    <View style={styles.view37}>
                      <Text style={[styles.text24, { fontSize: 11.5 }]}>{t('award.declinedNotEligible')}</Text>
                    </View>
                  ) : isLive ? (
                    // Negotiating, not assigned. Assign is offered only when the server allows it.
                    <>
                      <View style={styles.view38}>
                        <Text style={[styles.text25, { fontSize: 11.5 }]}>
                          {t(liveNegotiation.phase === 'quotation_agreed' ? 'request.flow.readyToAssign' : 'quote.inNegotiation')}
                        </Text>
                      </View>
                      {(liveNegotiation.actions || []).includes('assign') ? (
                        <SmallButton
                          label={t('quote.assignProject')}
                          disabled={project.started === true || assigningRequestId === quotation.id}
                          onPress={() => setAssignTarget({
                            quotation,
                            amount: liveNegotiation.agreed_amount,
                            amountLabel: liveNegotiation.agreed_offer_id ? 'award.agreedQuotation' : 'request.flow.builderQuotation',
                          })}
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <SmallButton
                        label={t('quote.negotiate')}
                        look="outline"
                        disabled={blocked || assigningRequestId === quotation.id}
                        onPress={() => setNegotiating(quotation)}
                        style={{ flex: 1 }}
                      />
                      <SmallButton
                        label={t('quote.assignProject')}
                        disabled={blocked || assigningRequestId === quotation.id}
                        onPress={() => setAssignTarget({ quotation, amount: quotation.quotation_amount, amountLabel: 'request.flow.builderQuotation' })}
                        style={{ flex: 1 }}
                      />
                    </>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}
      {liveNegotiation && quotations.some((quotation) => quotation.id !== liveNegotiation.request_id) ? (
        <Text style={[styles.text26, { fontSize: 12 }]}>
          {t('quote.negotiationActive', { name: td(liveNegotiation.builder_name) })}
        </Text>
      ) : null}
      <FormNotice message={assignMessage} tone="error" style={{ marginTop: 10 }} />

      <Dialog
        visible={Boolean(assignTarget)}
        busy={assignBusy}
        onClose={() => setAssignTarget(null)}
        title={t('quote.assignBuilder')}
        footer={(
          <>
            <DialogButton look="secondary" label={t('award.dialog.back')} onPress={() => setAssignTarget(null)} disabled={assignBusy} />
            <DialogButton
              label={t('quote.assignProject')}
              disabled={assignBusy}
              onPress={async () => {
                setAssignBusy(true)
                try {
                  await assignBuilder(assignTarget.quotation.id)
                } finally {
                  setAssignBusy(false)
                  setAssignTarget(null)
                  setPanelVersion((version) => version + 1)
                }
              }}
            />
          </>
        )}
      >
        {assignTarget ? (
          <>
            <View style={styles.view4}>
              <DialogRow label={t('award.builder')} value={td(assignTarget.quotation.sender_name)} />
              <DialogRow label={t('award.project')} value={td(project.title)} />
              <DialogRow label={t(assignTarget.amountLabel)} value={money(assignTarget.amount, country)} strong />
            </View>
            <Text style={[styles.text27, { fontSize: 13, lineHeight: 19 }]}>
              {t('award.dialog.assignBody', { name: td(assignTarget.quotation.sender_name), amount: money(assignTarget.amount, country) })}
            </Text>
          </>
        ) : null}
      </Dialog>

      <NegotiateDialog
        visible={Boolean(negotiating)}
        quotation={negotiating?.quotation_amount}
        builderName={negotiating?.sender_name}
        budget={project.original_budget ?? project.budget}
        country={country}
        onSubmit={async (amount, note) => {
          try {
            await negotiateBuilder(negotiating.id, amount, note)
          } finally {
            setPanelVersion((version) => version + 1)
          }
        }}
        onClose={() => setNegotiating(null)}
      />
    </Panel>
  )
}

const styles = createStyles((c) => ({
  view: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1.75 },
  view2: { height: 5.25, width: 5.25, borderRadius: 9999, backgroundColor: '#dc2626' },
  text: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  tone: { backgroundColor: '#1a5038' },
  tone2: { color: '#ffffff' },
  tone3: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  tone4: { color: c.text },
  tone5: { borderWidth: 1, borderColor: c.redBorder, backgroundColor: c.redSoft },
  tone6: { color: c.redTextSoft },
  pressable: { height: 31.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 10.5 },
  pressable2: { opacity: 0.5 },
  text2: { fontFamily: 'Inter_700Bold' },
  view3: { borderRadius: 7, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text3: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  text4: { marginTop: 1.75, fontFamily: 'Inter_700Bold', color: c.text },
  text5: { fontFamily: 'Inter_400Regular', color: c.textFaint },
  text6: { fontFamily: 'Inter_700Bold', color: c.text },
  view4: { marginTop: 10.5 },
  view5: { borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  view6: { flexDirection: 'row', alignItems: 'flex-start' },
  view7: { flex: 1 },
  text7: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text8: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text9: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view8: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap' },
  view9: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap' },
  view10: { marginTop: 7 },
  view11: { flexDirection: 'row' },
  view12: { borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  text10: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text11: { marginTop: -3.5, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view13: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view14: { marginTop: 5.25, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  view15: { marginTop: 8.75, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  tone7: { backgroundColor: c.skySoft },
  tone8: { color: c.skyText },
  tone9: { backgroundColor: c.emeraldSoft },
  tone10: { color: c.emeraldText },
  tone11: { backgroundColor: c.orangeSoft },
  tone12: { color: c.orangeText },
  tone13: { backgroundColor: c.violetSoft },
  tone14: { color: c.violetText },
  view16: { flexDirection: 'row', flexWrap: 'wrap' },
  view17: { borderRadius: 5.25, paddingHorizontal: 5.25, paddingVertical: 1.75 },
  text12: { fontFamily: 'Inter_600SemiBold' },
  view18: { borderRadius: 5.25, backgroundColor: c.muted, paddingHorizontal: 5.25, paddingVertical: 1.75 },
  text13: { fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  text14: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view19: { height: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, paddingHorizontal: 7 },
  view20: { height: 31.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.amberBorderSoft, backgroundColor: c.amberSoft, paddingHorizontal: 7 },
  view21: { height: 5.25, width: 5.25, borderRadius: 9999, backgroundColor: '#fbbf24' },
  text15: { fontFamily: 'Inter_700Bold', color: c.amberText },
  pressable3: { marginBottom: 10.5, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view22: { position: 'absolute', right: 0, top: 0, flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 10.5, backgroundColor: '#059669', paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text16: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view23: { flexDirection: 'row', alignItems: 'center' },
  text17: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', color: c.textFaint },
  view24: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 5.25, paddingVertical: 1.75 },
  text18: { fontFamily: 'Inter_600SemiBold', color: c.brandText },
  view25: { marginTop: 8.75, flexDirection: 'row', borderRadius: 7, backgroundColor: c.subtle, paddingVertical: 5.25 },
  view26: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: c.border },
  text19: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view27: { flex: 1, alignItems: 'center' },
  view28: { marginTop: 8.75, flexDirection: 'row', alignItems: 'flex-start' },
  view29: { marginTop: -3.5, marginBottom: 7, flexDirection: 'row', alignItems: 'center' },
  text20: { marginBottom: 7, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view30: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  view31: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  view32: { height: 5.25, width: 5.25, borderRadius: 9999, backgroundColor: '#10b981' },
  text21: { fontFamily: 'Inter_700Bold', color: c.emeraldText },
  view33: { borderRadius: 9999, backgroundColor: c.muted, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text22: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  text23: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view34: { borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  view35: { marginTop: 8.75, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  view36: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  view37: { borderRadius: 9999, borderWidth: 1, borderColor: c.redBorderSoft, backgroundColor: c.redSoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text24: { fontFamily: 'Inter_700Bold', color: c.redText },
  view38: { borderRadius: 9999, borderWidth: 1, borderColor: c.skyBorder, backgroundColor: c.skySoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text25: { fontFamily: 'Inter_700Bold', color: c.skyTextStrong },
  text26: { marginTop: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text27: { marginTop: 10.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
}))
