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
import { userCountry } from '../../utils/countryConfig'
import { createStyles } from '../../theme/createStyles'

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

  const opportunities = useAsyncData(() => fetchEngineerOpportunities(userCountry(user)), [userCountry(user)])
  const team = useAsyncData(fetchEngineerTeam, [])
  const builders = useAsyncData(() => fetchNearbyContractors(user?.pincode, userCountry(user)), [user?.pincode, userCountry(user)])

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable, active ? styles.pressable2 : styles.pressable3]}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text style={[styles.text, active ? styles.text2 : styles.text3]}>
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
              <View key={opportunity.project_id} style={styles.view}>
                <Text style={styles.text4} numberOfLines={1}>{opportunity.title}</Text>
                {!!opportunity.company_name && (
                  <Text style={styles.text5} numberOfLines={1}>{opportunity.company_name}</Text>
                )}
                <View style={styles.view2}>
                  <MapPin size={11} color={COLORS.slate[400]} />
                  <Text style={styles.text6} numberOfLines={1}>
                    {opportunity.address || 'Nearby'}{opportunity.pincode ? ` · ${opportunity.pincode}` : ''}
                  </Text>
                  {!!inr(opportunity.budget) && <Text style={styles.text7}>{inr(opportunity.budget)}</Text>}
                </View>
                <Pressable
                  onPress={() => apply(opportunity)}
                  disabled={applied || busyId === opportunity.project_id}
                  style={[styles.pressable4, applied ? styles.pressable5 : styles.pressable2, busyId === opportunity.project_id ? styles.pressable6 : null]}
                >
                  <Text style={[styles.text8, applied ? styles.text9 : styles.text2]}>
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
              <View key={id} style={styles.view3}>
                <View style={styles.view4}>
                  <Text style={styles.text10} numberOfLines={1}>{builder.name || builder.business_name || 'Builder'}</Text>
                  <Text style={styles.text5} numberOfLines={1}>
                    {builder.company_name || builder.address || 'Nearby'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => requestJoin(builder)}
                  disabled={sent || busyId === id}
                  style={[styles.pressable7, sent ? styles.pressable5 : styles.pressable2]}
                >
                  <Send size={12} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text style={[styles.text, sent ? styles.text9 : styles.text2]}>{sent ? 'Sent' : 'Join'}</Text>
                </Pressable>
              </View>
            )
          })}
        </PanelState>
      )}

      {activeTab === 'requests' && (
        <PanelState loading={team.loading} error={team.error} empty={!incomingRequests.length} emptyText="No builder requests waiting on you.">
          {incomingRequests.map((request) => (
            <View key={request.relationship_id || request.id} style={styles.view3}>
              <View style={styles.view4}>
                <Text style={styles.text10} numberOfLines={1}>
                  {request.contractor_name || request.name || 'Builder'}
                </Text>
                <Text style={styles.text5}>wants you on their team</Text>
              </View>
              <Pressable onPress={() => respond(request.relationship_id || request.id, 'ACCEPT')} style={styles.pressable8}>
                <Check size={16} color={COLORS.brand[700]} />
              </Pressable>
              <Pressable onPress={() => respond(request.relationship_id || request.id, 'REJECT')} style={styles.pressable9}>
                <X size={16} color="#e11d48" />
              </Pressable>
            </View>
          ))}
        </PanelState>
      )}

      {activeTab === 'joincode' && (
        <Panel title="Join with an invite code">
          <Text style={styles.text11}>Got an invitation code from a builder? Enter it below to join their team instantly.</Text>
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Invite code"
            autoCapitalize="characters"
            style={styles.textInput}
            placeholderTextColor={COLORS.slate[400]}
          />
          <Pressable onPress={joinByCode} disabled={joining || !inviteCode.trim()} style={[styles.pressable10, styles[joining || !inviteCode.trim() ? 'pressable11' : '']]}>
            <Text style={styles.text12}>{joining ? 'Joining…' : 'Join team'}</Text>
          </Pressable>
        </Panel>
      )}
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  scrollView: { marginBottom: 14 },
  pressable: { height: 35, flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 10.5, paddingHorizontal: 14 },
  pressable2: { backgroundColor: '#1a5038' },
  pressable3: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  text: { fontSize: 11, fontWeight: '800' },
  text2: { color: '#ffffff' },
  text3: { color: c.textMuted },
  view: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text4: { fontSize: 15, fontWeight: '800', color: c.text },
  text5: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view2: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text6: { flex: 1, fontSize: 11, fontWeight: '600', color: c.textFaint },
  text7: { fontSize: 11, fontWeight: '800', color: c.textSecondary },
  pressable4: { marginTop: 10.5, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  pressable5: { backgroundColor: c.brandSoft },
  pressable6: { opacity: 0.6 },
  text8: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text9: { color: c.brandText },
  view3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view4: { flex: 1 },
  text10: { fontSize: 14, fontWeight: '800', color: c.text },
  pressable7: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, paddingHorizontal: 12.25, paddingVertical: 7 },
  pressable8: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.brandSoft },
  pressable9: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.roseSoft },
  text11: { fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  textInput: { marginTop: 10.5, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 15, fontWeight: '800', letterSpacing: 1.6, color: c.text },
  pressable10: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable11: { opacity: 0.5 },
  text12: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
}))
