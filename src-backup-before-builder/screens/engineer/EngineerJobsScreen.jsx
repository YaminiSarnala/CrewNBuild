// Port of the web engineer 'findOpportunities' section and its 4 sub-tabs:
// open opportunities (apply), discover builders (request to join), incoming
// requests from builders (ACCEPT/REJECT — same action strings as web), and
// join-by-invite-code.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert, ScrollView } from 'react-native'
import { useSelector } from 'react-redux'
import { Briefcase, HardHat, Inbox, KeyRound, Check, X, Send, MapPin } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchEngineerOpportunities, applyEngineerOpportunity, fetchEngineerTeam,
  respondEngineerJoinRequest, joinEngineerTeam, requestEngineerJoin,
} from '../../api/engineers'
import { fetchNearbyContractors } from '../../api/projects'
import { COLORS } from '../../theme/tokens'

const inr = (value) => (Number(value || 0) ? `₹${Number(value).toLocaleString('en-IN')}` : '')

export default function EngineerJobsScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [activeTab, setActiveTab] = useState('opportunities')
  const [refreshing, setRefreshing] = useState(false)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [sentBuilderIds, setSentBuilderIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)

  const opportunities = useAsyncData(() => fetchEngineerOpportunities(user?.country), [user?.country])
  const team = useAsyncData(fetchEngineerTeam, [])
  const builders = useAsyncData(() => fetchNearbyContractors(user?.pincode, user?.country), [user?.pincode, user?.country])

  const opportunityList = Array.isArray(opportunities.data) ? opportunities.data : []
  const incomingRequests = team.data?.incoming_requests || []
  const builderList = Array.isArray(builders.data) ? builders.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([opportunities.reload(), team.reload(), builders.reload()])
    setRefreshing(false)
  }

  async function apply(opportunity) {
    const id = opportunity.project_id
    setBusyId(id)
    try {
      await applyEngineerOpportunity(id)
      setAppliedIds((prev) => new Set(prev).add(id))
    } catch (error) {
      Alert.alert('Could not apply', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function requestJoin(builder) {
    const id = builder.user_id || builder.id
    setBusyId(id)
    try {
      await requestEngineerJoin(id)
      setSentBuilderIds((prev) => new Set(prev).add(id))
    } catch (error) {
      Alert.alert('Could not send', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function respond(relationshipId, action) {
    try {
      await respondEngineerJoinRequest(relationshipId, action)
      await team.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    }
  }

  async function joinByCode() {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      await joinEngineerTeam(inviteCode.trim())
      Alert.alert('Joined', 'You are now part of the builder\'s team.')
      setInviteCode('')
      await team.reload()
    } catch (error) {
      Alert.alert('Could not join', error?.response?.data?.detail || 'Check the invite code and try again.')
    } finally {
      setJoining(false)
    }
  }

  const tabs = [
    { id: 'opportunities', label: 'Openings', icon: Briefcase, count: opportunityList.length },
    { id: 'builders', label: 'Builders', icon: HardHat, count: builderList.length },
    { id: 'requests', label: 'Requests', icon: Inbox, count: incomingRequests.length },
    { id: 'joincode', label: 'Join code', icon: KeyRound },
  ]

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} className={`h-10 flex-row items-center gap-1.5 rounded-xl px-4 ${active ? 'bg-brand-700' : 'bg-white border border-slate-200'}`}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>
                {label}{count ? ` (${count})` : ''}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {activeTab === 'opportunities' && (
        <PanelState loading={opportunities.loading} error={opportunities.error} empty={!opportunityList.length} emptyText="No open opportunities in your area right now.">
          {opportunityList.map((opportunity) => {
            const applied = appliedIds.has(opportunity.project_id)
            return (
              <View key={opportunity.project_id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="text-[15px] font-extrabold text-graphite" numberOfLines={1}>{opportunity.title}</Text>
                {!!opportunity.company_name && (
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{opportunity.company_name}</Text>
                )}
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <MapPin size={11} color={COLORS.slate[400]} />
                  <Text className="flex-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                    {opportunity.address || 'Nearby'}{opportunity.pincode ? ` · ${opportunity.pincode}` : ''}
                  </Text>
                  {!!inr(opportunity.budget) && <Text className="text-[11px] font-extrabold text-slate-600">{inr(opportunity.budget)}</Text>}
                </View>
                <Pressable
                  onPress={() => apply(opportunity)}
                  disabled={applied || busyId === opportunity.project_id}
                  className={`mt-3 h-10 items-center justify-center rounded-full ${applied ? 'bg-brand-50' : 'bg-brand-700'} ${busyId === opportunity.project_id ? 'opacity-60' : ''}`}
                >
                  <Text className={`text-xs font-extrabold ${applied ? 'text-brand-700' : 'text-white'}`}>
                    {applied ? 'Applied' : 'Apply'}
                  </Text>
                </Pressable>
              </View>
            )
          })}
        </PanelState>
      )}

      {activeTab === 'builders' && (
        <PanelState loading={builders.loading} error={builders.error} empty={!builderList.length} emptyText="No builders found near your pincode.">
          {builderList.map((builder) => {
            const id = builder.user_id || builder.id
            const sent = sentBuilderIds.has(id)
            return (
              <View key={id} className="mb-3 flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{builder.name || builder.business_name || 'Builder'}</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                    {builder.company_name || builder.address || 'Nearby'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => requestJoin(builder)}
                  disabled={sent || busyId === id}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${sent ? 'bg-brand-50' : 'bg-brand-700'}`}
                >
                  <Send size={12} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text className={`text-[11px] font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>{sent ? 'Sent' : 'Join'}</Text>
                </Pressable>
              </View>
            )
          })}
        </PanelState>
      )}

      {activeTab === 'requests' && (
        <PanelState loading={team.loading} error={team.error} empty={!incomingRequests.length} emptyText="No builder requests waiting on you.">
          {incomingRequests.map((request) => (
            <View key={request.relationship_id || request.id} className="mb-3 flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                  {request.contractor_name || request.name || 'Builder'}
                </Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500">wants you on their team</Text>
              </View>
              <Pressable onPress={() => respond(request.relationship_id || request.id, 'ACCEPT')} className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <Check size={16} color={COLORS.brand[700]} />
              </Pressable>
              <Pressable onPress={() => respond(request.relationship_id || request.id, 'REJECT')} className="h-9 w-9 items-center justify-center rounded-full bg-rose-50">
                <X size={16} color="#e11d48" />
              </Pressable>
            </View>
          ))}
        </PanelState>
      )}

      {activeTab === 'joincode' && (
        <Panel title="Join with an invite code">
          <Text className="text-xs font-semibold text-slate-500">Got an invitation code from a builder? Enter it below to join their team instantly.</Text>
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Invite code"
            autoCapitalize="characters"
            className="mt-3 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-extrabold tracking-widest text-graphite"
            placeholderTextColor={COLORS.slate[400]}
          />
          <Pressable onPress={joinByCode} disabled={joining || !inviteCode.trim()} className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${joining || !inviteCode.trim() ? 'opacity-50' : ''}`}>
            <Text className="text-[13px] font-extrabold text-white">{joining ? 'Joining…' : 'Join team'}</Text>
          </Pressable>
        </Panel>
      )}
    </DashboardShell>
  )
}