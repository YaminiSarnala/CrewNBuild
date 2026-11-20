// The Site Engineer's Find Opportunities tab — port of the web
// EngineerDashboard 'findOpportunities' section and its four tabs:
//   Join Builder Team (invite code, my team, builders' requests to join, my
//   pending requests), Requests (owner and specialist project requests sent to
//   this engineer), Discover Builders (request to join) and Find Opportunities
//   (open projects needing a Site Engineer, apply).
// Wired to: GET /engineers/team, POST /engineers/join, POST /engineers/request-join,
// POST /engineers/requests/{id}/respond, GET /project-requests/incoming
// (+ accept / reject), GET /contractors/nearby, GET /contractors/{id}/profile,
// GET /engineers/opportunities, POST /engineers/opportunities/{id}/apply.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MapPin, Users } from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { Section, SegmentTabs } from '../../components/builder/BuilderUi'
import { toast } from '../../components/Toast'
import RequestsPanel from '../../components/RequestsPanel'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useProfileGate } from '../../hooks/useProfileGate'
import {
  applyEngineerOpportunity, fetchEngineerOpportunities, fetchEngineerTeam, joinEngineerTeam,
  requestEngineerJoin, respondEngineerJoinRequest,
} from '../../api/engineers'
import { acceptProjectRequest, fetchIncomingRequests, rejectProjectRequest } from '../../api/requests'
import { fetchNearbyContractors } from '../../api/projects'
import { fetchContractorProfile } from '../../api/profiles'
import { userCountry } from '../../utils/countryConfig'
import { apiErrorText } from '../../utils/builderHelpers'
import {
  ContractorProfileSheet, EmptyCard, EngineerContractors, EngineerJoinTeam, EngineerOpportunities, OpportunitySheet,
} from './engineerParts'
import { LocationSheet } from '../contractor/ContractorLeadsScreen'
import { mergeUser } from '../../store/authSlice'
import { createStyles } from '../../theme/createStyles'
import { COLORS } from '../../theme/tokens'

// "Later" on the location prompt hides it until the app restarts (the web keeps
// it for the browser session).
let locationPromptDismissed = false

// Applied opportunities are remembered on this device, as the web keeps them in localStorage.
const APPLIED_KEY = 'octabuild_applied_opportunities'
const readApplied = async () => {
  try { return JSON.parse((await AsyncStorage.getItem(APPLIED_KEY)) || '[]') } catch { return [] }
}
async function saveApplied(projectId) {
  const applied = await readApplied()
  if (!applied.includes(String(projectId))) {
    await AsyncStorage.setItem(APPLIED_KEY, JSON.stringify([...applied, String(projectId)])).catch(() => {})
  }
  return readApplied()
}

export default function EngineerJobsScreen({ navigation, route }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
    const dispatch = useDispatch()
  const country = userCountry(user)
  const { requireCompleteProfile } = useProfileGate()
  const [tab, setTab] = useState('joinTeam')
    // Web LocationLeadsPrompt: an Indian account sets the pincode it is matched on;
  // with none saved the prompt opens by itself.
  const locationEligible = Boolean(user?.id) && String(user?.country_of_residence || 'India').trim().toLowerCase() === 'india'
  const [locationOpen, setLocationOpen] = useState(false)
  useEffect(() => {
    if (locationEligible && !String(user?.pincode || '').trim() && !locationPromptDismissed) setLocationOpen(true)
  }, [locationEligible, user?.pincode])
  const closeLocation = () => { locationPromptDismissed = true; setLocationOpen(false) }
  const [refreshing, setRefreshing] = useState(false)
  const [appliedKeys, setAppliedKeys] = useState([])
  // Results show as a bottom toast; a missing invite code highlights its box.
  const [codeError, setCodeError] = useState('')
  const [selectedContractor, setSelectedContractor] = useState(null)
  const [contractorProfile, setContractorProfile] = useState(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)

  const team = useAsyncData(fetchEngineerTeam, [])
  const requests = useAsyncData(fetchIncomingRequests, [])
  const opportunities = useAsyncData(() => fetchEngineerOpportunities(country), [country])
  const contractors = useAsyncData(() => (user?.pincode ? fetchNearbyContractors(user.pincode, country) : Promise.resolve([])), [user?.pincode, country])
  const reloadAll = useCallback(() => Promise.all([team.reload(), requests.reload(), opportunities.reload(), contractors.reload()]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team.reload, requests.reload, opportunities.reload, contractors.reload])
  useLiveRefresh(reloadAll)
  useEffect(() => { readApplied().then(setAppliedKeys) }, [])

  // Another screen can open a given tab: navigate('EngineerJobsTab', { tab }).
  const requestedTab = route?.params?.tab
  useEffect(() => {
    if (!requestedTab) return
    setTab(requestedTab)
    navigation.setParams?.({ tab: undefined })
  }, [requestedTab, navigation])

  const teams = team.data?.teams || []
  const incomingRequests = team.data?.incoming_requests || []
  // Requests addressed TO this engineer (the incoming list holds both directions).
  const incomingRequestList = useMemo(
    () => (Array.isArray(requests.data) ? requests.data : []).filter((request) => request.is_receiver),
    [requests.data],
  )
  const pendingRequestCount = incomingRequestList.filter((request) => request.status === 'pending').length
  const opportunityList = Array.isArray(opportunities.data) ? opportunities.data : []
  const contractorList = Array.isArray(contractors.data) ? contractors.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    try { await reloadAll() } finally { setRefreshing(false) }
  }

  const teamStatusByContractor = (contractorId) => {
    const row = teams.find((item) => String(item.contractor_id) === String(contractorId))
    if (!row) return 'none'
    if (row.status === 'ACTIVE') return 'active'
    if (row.status === 'PENDING') return 'pending'
    return 'rejected'
  }

  async function joinTeam(code) {
    setCodeError('')
    if (!code) {
      setCodeError(t('dash.engineer.msg.enterCode'))
      toast.error(t('dash.engineer.msg.enterCode'))
      return
    }
    try {
      const result = await joinEngineerTeam(code)
      toast.success(t('dash.msg.joinedTeam', { company: td(result.company_name || result.contractor_name) }))
      reloadAll()
    } catch (error) {
      toast.error(apiErrorText(error, t('dash.engineer.msg.unableJoin')))
    }
  }

  async function sendJoinRequest(contractorId) {
    if (requireCompleteProfile(() => sendJoinRequest(contractorId))) return
    try {
      await requestEngineerJoin(contractorId)
      toast.success(t('dash.engineer.msg.joinRequestSent'))
      reloadAll()
    } catch (error) {
      toast.error(apiErrorText(error, t('dash.engineer.msg.unableJoinRequest')))
    }
  }

  async function respondToBuilderRequest(relationshipId, action) {
    // Joining a builder's team needs a complete profile; declining does not.
    if (action === 'ACCEPT' && requireCompleteProfile(() => respondToBuilderRequest(relationshipId, action))) return
    try {
      await respondEngineerJoinRequest(relationshipId, action)
      toast.success(action === 'ACCEPT' ? t('dash.msg.engineerRequestAccepted') : t('dash.msg.engineerRequestRejected'))
      reloadAll()
    } catch (error) {
      toast.error(apiErrorText(error, t('dash.engineer.msg.unableJoinRequest')))
    }
  }

  async function respondToProjectRequest(requestId, accept) {
    if (accept && requireCompleteProfile(() => respondToProjectRequest(requestId, accept))) return
    try {
      if (accept) await acceptProjectRequest(requestId)
      else await rejectProjectRequest(requestId)
      reloadAll()
    } catch (error) {
      toast.error(apiErrorText(error, t('dash.engineer.msg.unableJoinRequest')))
    }
  }

  async function applyOpportunity(opportunity) {
    if (requireCompleteProfile(() => applyOpportunity(opportunity))) return
    try {
      const result = await applyEngineerOpportunity(opportunity.project_id)
      setAppliedKeys(await saveApplied(opportunity.project_id))
      setSelectedOpportunity(null)
      toast.success(t('dash.msg.applicationSent', { name: td(result.receiver_name) || t('dash.theBuilder') }))
    } catch (error) {
      toast.error(apiErrorText(error, t('dash.engineer.msg.unableApply')))
      if (String(error?.response?.status) === '409') setAppliedKeys(await saveApplied(opportunity.project_id))
    }
  }

  async function viewContractorProfile(contractor) {
    setContractorProfile(null)
    setSelectedContractor(contractor)
    try {
      setContractorProfile(await fetchContractorProfile(contractor.user_id || contractor.id))
    } catch {
      setContractorProfile(null)
    }
  }

  const tabs = [
    { id: 'joinTeam', label: t('ui.joinTeam'), count: incomingRequests.length || undefined },
    { id: 'requests', label: t('ui.requests'), count: pendingRequestCount || undefined },
    { id: 'contractors', label: t('ui.discoverBuilders') },
    { id: 'opportunities', label: t('ui.findOpportunities') },
  ]

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
         <Section>
        <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
        {locationEligible ? (
          <Pressable onPress={() => setLocationOpen(true)} style={styles.location} accessibilityRole="button">
            <MapPin size={12} color={COLORS.brand[700]} />
            <Text style={styles.locationText}>
              {user?.pincode ? `${t('location.leadsFor', { pincode: user.pincode })} · ${t('location.change')}` : t('location.setLocation')}
            </Text>
          </Pressable>
        ) : null}
      </Section>

      <Section>
        {tab === 'joinTeam' ? (
          <EngineerJoinTeam
            teams={teams}
            incomingRequests={incomingRequests}
            onJoin={joinTeam}
            onRefresh={reloadAll}
            onRespondToBuilder={respondToBuilderRequest}
            codeError={codeError}
            onCodeChange={() => setCodeError('')}
          />
        ) : null}

        {tab === 'requests' ? (
          incomingRequestList.length ? (
            <View>
              <RequestsPanel
                requestList={incomingRequestList}
                onAccept={(requestId) => respondToProjectRequest(requestId, true)}
                onReject={(requestId) => respondToProjectRequest(requestId, false)}
              />
            </View>
          ) : (
            <EmptyCard icon={Users} title={t('ui.requests.noRequests')} body={t('dash.engineer.noRequestsSub')} />
          )
        ) : null}

        {tab === 'contractors' ? (
          <EngineerContractors
            contractors={contractorList}
            teamStatusByContractor={teamStatusByContractor}
            onViewContractor={viewContractorProfile}
            onRequestJoin={(contractor) => sendJoinRequest(contractor.user_id || contractor.id)}
          />
        ) : null}

        {tab === 'opportunities' ? (
          <EngineerOpportunities
            opportunities={opportunityList}
            appliedKeys={appliedKeys}
            onApply={applyOpportunity}
            onView={setSelectedOpportunity}
          />
        ) : null}
      </Section>

      <ContractorProfileSheet
        contractor={selectedContractor}
        profile={contractorProfile}
        onClose={() => { setSelectedContractor(null); setContractorProfile(null) }}
        onRequestJoin={(contractorId) => sendJoinRequest(contractorId)}
        requestState={selectedContractor ? teamStatusByContractor(selectedContractor.user_id || selectedContractor.id) : 'none'}
      />
      <OpportunitySheet
        opportunity={selectedOpportunity}
        applied={selectedOpportunity ? appliedKeys.includes(String(selectedOpportunity.project_id)) : false}
        onApply={applyOpportunity}
        onClose={() => setSelectedOpportunity(null)}
      />
            <LocationSheet
        visible={locationOpen}
        currentPincode={user?.pincode || ''}
        onClose={closeLocation}
        onSaved={(updatedUser) => {
          dispatch(mergeUser(updatedUser?.user || updatedUser || {}))
          setLocationOpen(false)
          setTab('opportunities')
        }}
      />
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  location: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5.25, alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  locationText: { fontSize: 12, fontWeight: '800', color: c.brandTextStrong },
}))