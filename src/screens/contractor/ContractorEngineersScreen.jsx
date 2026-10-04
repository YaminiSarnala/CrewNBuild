// Port of web contractorEngineerSections.jsx (MySiteEngineersSection +
// FindSiteEngineersSection + InviteEngineerDrawer). Team payload shape matches
// web: { active: [], pending_requests: [] }; respond actions are 'ACCEPT' /
// 'REJECT'; invite payload is { phone, email }.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import { Check, X, Search, Send } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchEngineerTeam,
  fetchNearbyEngineers,
  respondEngineerJoinRequest,
  sendContractorEngineerRequest,
  inviteEngineer,
  assignEngineerToProject,
} from '../../api/engineers'
import { fetchOwnerProjects } from '../../api/projects'
import { COLORS } from '../../theme/tokens'

function IconButton({ onPress, icon: Icon, tone = 'brand', disabled }) {
  const bg = tone === 'danger' ? 'bg-rose-50' : 'bg-brand-50'
  const color = tone === 'danger' ? '#e11d48' : COLORS.brand[700]
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`h-9 w-9 items-center justify-center rounded-full ${bg} ${disabled ? 'opacity-50' : ''}`}>
      <Icon size={16} color={color} />
    </Pressable>
  )
}

export default function ContractorEngineersScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [refreshing, setRefreshing] = useState(false)
  const [pincode, setPincode] = useState('')
  const [nearby, setNearby] = useState(null)
  const [searching, setSearching] = useState(false)
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const team = useAsyncData(fetchEngineerTeam, [])
    const projects = useAsyncData(fetchOwnerProjects, [])
  const [assignTarget, setAssignTarget] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const projectList = Array.isArray(projects.data) ? projects.data : []

  async function assignToProject(projectId) {
    setAssigning(true)
    try {
      await assignEngineerToProject(projectId, assignTarget.user_id)
      setAssignTarget(null)
      await team.reload()
      Alert.alert('Assigned', 'Engineer assigned to the project.')
    } catch (error) {
      Alert.alert('Could not assign', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setAssigning(false)
    }
  }
  const active = team.data?.active || []
  const pending = team.data?.pending_requests || []

  const onRefresh = async () => {
    setRefreshing(true)
    await team.reload()
    setRefreshing(false)
  }

  async function respond(relationshipId, action) {
    try {
      await respondEngineerJoinRequest(relationshipId, action)
      await team.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    }
  }

  async function searchNearby() {
    if (!pincode.trim()) return
    setSearching(true)
    try {
      const result = await fetchNearbyEngineers(pincode.trim(), user?.country)
      setNearby(Array.isArray(result) ? result : [])
    } catch (error) {
      Alert.alert('Search failed', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSearching(false)
    }
  }

  async function sendRequest(engineer) {
    const id = engineer.user_id || engineer.id
    setSendingId(id)
    try {
      await sendContractorEngineerRequest(id)
      setSentIds((prev) => new Set(prev).add(id))
    } catch (error) {
      Alert.alert('Could not send', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSendingId(null)
    }
  }

  async function generateInvite() {
    setInviteBusy(true)
    setInviteResult(null)
    try {
      const result = await inviteEngineer({ phone: invitePhone.trim(), email: inviteEmail.trim() })
      setInviteResult(result)
      await team.reload()
    } catch (error) {
      Alert.alert('Could not generate invitation', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Panel title="Join requests">
        <PanelState loading={team.loading} error={team.error} empty={!pending.length} emptyText="No pending join requests.">
          {pending.map((engineer) => (
            <View key={engineer.relationship_id || engineer.user_id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-graphite">{engineer.name || engineer.full_name}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500">{engineer.category || 'Site Engineer'}</Text>
              </View>
              <IconButton icon={Check} onPress={() => respond(engineer.relationship_id, 'ACCEPT')} />
              <IconButton icon={X} tone="danger" onPress={() => respond(engineer.relationship_id, 'REJECT')} />
            </View>
          ))}
        </PanelState>
      </Panel>

      <Panel title="My site engineers">
        <PanelState loading={team.loading} error={team.error} empty={!active.length} emptyText="No engineers on your team yet. Find or invite one below.">
          {active.map((engineer) => (
            <View key={engineer.user_id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-graphite">{engineer.name || engineer.full_name}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500">
                  {engineer.category || 'Site Engineer'}{engineer.assigned_project_title ? ` · ${engineer.assigned_project_title}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setAssignTarget(engineer)} className="rounded-lg border border-brand-200 px-2.5 py-1.5">
                <Text className="text-[10px] font-extrabold text-brand-800">Assign</Text>
              </Pressable>
            </View>
          ))}        </PanelState>
      </Panel>
            {assignTarget && (
        <Panel title={`Assign ${assignTarget.name || assignTarget.full_name} to…`} action={
          <Pressable onPress={() => setAssignTarget(null)}><Text className="text-xs font-extrabold text-slate-400">Cancel</Text></Pressable>
        }>
          <PanelState loading={projects.loading} empty={!projectList.length} emptyText="No projects to assign yet.">
            {projectList.map((project) => (
              <Pressable key={project.id} onPress={() => assignToProject(project.id)} disabled={assigning} className="border-b border-slate-100 py-3">
                <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{project.project_title || project.title}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{project.address || 'Location not set'}</Text>
              </Pressable>
            ))}
          </PanelState>
        </Panel>
      )}

      <Panel title="Find site engineers">
        <View className="flex-row gap-2">
          <TextInput
            value={pincode}
            onChangeText={setPincode}
            placeholder="Search by pincode"
            keyboardType="number-pad"
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
            placeholderTextColor={COLORS.slate[400]}
          />
          <Pressable onPress={searchNearby} disabled={searching} className="h-11 w-11 items-center justify-center rounded-xl bg-brand-700">
            <Search size={18} color="#fff" />
          </Pressable>
        </View>
        {nearby !== null && (
          <View className="mt-3">
            <PanelState loading={searching} empty={!nearby.length} emptyText="No engineers found near that pincode.">
              {nearby.map((engineer) => {
                const id = engineer.user_id || engineer.id
                const sent = sentIds.has(id)
                return (
                  <View key={id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
                    <View className="flex-1">
                      <Text className="text-[14px] font-extrabold text-graphite">{engineer.name || engineer.full_name}</Text>
                      <Text className="mt-0.5 text-xs font-semibold text-slate-500">{engineer.category || 'Site Engineer'}{engineer.pincode ? ` · ${engineer.pincode}` : ''}</Text>
                    </View>
                    <Pressable
                      onPress={() => sendRequest(engineer)}
                      disabled={sent || sendingId === id}
                      className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${sent ? 'bg-brand-50' : 'bg-brand-700'}`}
                    >
                      <Send size={12} color={sent ? COLORS.brand[700] : '#fff'} />
                      <Text className={`text-[11px] font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>
                        {sent ? 'Sent' : 'Request'}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </PanelState>
          </View>
        )}
      </Panel>

      <Panel title="Invite an engineer">
        <TextInput
          value={invitePhone}
          onChangeText={setInvitePhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
          placeholderTextColor={COLORS.slate[400]}
        />
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Email (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
          className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
          placeholderTextColor={COLORS.slate[400]}
        />
        <Pressable onPress={generateInvite} disabled={inviteBusy || !invitePhone.trim()} className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${inviteBusy || !invitePhone.trim() ? 'opacity-50' : ''}`}>
          <Text className="text-[13px] font-extrabold text-white">{inviteBusy ? 'Generating…' : 'Generate invitation'}</Text>
        </Pressable>
        {inviteResult && (
          <View className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3">
            <Text className="text-xs font-bold text-brand-800">Invitation ready — share this code:</Text>
            <Text className="mt-1 text-lg font-extrabold tracking-widest text-brand-900">
              {inviteResult.invite_code || inviteResult.code || JSON.stringify(inviteResult)}
            </Text>
          </View>
        )}
      </Panel>
    </DashboardShell>
  )
}