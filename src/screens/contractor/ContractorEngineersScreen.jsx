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
import { userCountry } from '../../utils/countryConfig'
import { createStyles } from '../../theme/createStyles'

function IconButton({ onPress, icon: Icon, tone = 'brand', disabled }) {
  const bg = tone === 'danger' ? 'tone' : 'pressable'
  const color = tone === 'danger' ? '#e11d48' : COLORS.brand[700]
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.pressable2, styles[bg], disabled ? styles.pressable3 : null]}>
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
      const result = await fetchNearbyEngineers(pincode.trim(), userCountry(user))
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
            <View key={engineer.relationship_id || engineer.user_id} style={styles.view}>
              <View style={styles.view2}>
                <Text style={styles.text}>{engineer.name || engineer.full_name}</Text>
                <Text style={styles.text2}>{engineer.category || 'Site Engineer'}</Text>
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
            <View key={engineer.user_id} style={styles.view}>
              <View style={styles.view2}>
                <Text style={styles.text}>{engineer.name || engineer.full_name}</Text>
                <Text style={styles.text2}>
                  {engineer.category || 'Site Engineer'}{engineer.assigned_project_title ? ` · ${engineer.assigned_project_title}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setAssignTarget(engineer)} style={styles.pressable4}>
                <Text style={styles.text3}>Assign</Text>
              </Pressable>
            </View>
          ))}        </PanelState>
      </Panel>
            {assignTarget && (
        <Panel title={`Assign ${assignTarget.name || assignTarget.full_name} to…`} action={
          <Pressable onPress={() => setAssignTarget(null)}><Text style={styles.text4}>Cancel</Text></Pressable>
        }>
          <PanelState loading={projects.loading} empty={!projectList.length} emptyText="No projects to assign yet.">
            {projectList.map((project) => (
              <Pressable key={project.id} onPress={() => assignToProject(project.id)} disabled={assigning} style={styles.pressable5}>
                <Text style={styles.text} numberOfLines={1}>{project.project_title || project.title}</Text>
                <Text style={styles.text2} numberOfLines={1}>{project.address || 'Location not set'}</Text>
              </Pressable>
            ))}
          </PanelState>
        </Panel>
      )}

      <Panel title="Find site engineers">
        <View style={styles.view3}>
          <TextInput
            value={pincode}
            onChangeText={setPincode}
            placeholder="Search by pincode"
            keyboardType="number-pad"
            style={styles.textInput}
            placeholderTextColor={COLORS.slate[400]}
          />
          <Pressable onPress={searchNearby} disabled={searching} style={styles.pressable6}>
            <Search size={18} color="#fff" />
          </Pressable>
        </View>
        {nearby !== null && (
          <View style={styles.view4}>
            <PanelState loading={searching} empty={!nearby.length} emptyText="No engineers found near that pincode.">
              {nearby.map((engineer) => {
                const id = engineer.user_id || engineer.id
                const sent = sentIds.has(id)
                return (
                  <View key={id} style={styles.view}>
                    <View style={styles.view2}>
                      <Text style={styles.text}>{engineer.name || engineer.full_name}</Text>
                      <Text style={styles.text2}>{engineer.category || 'Site Engineer'}{engineer.pincode ? ` · ${engineer.pincode}` : ''}</Text>
                    </View>
                    <Pressable
                      onPress={() => sendRequest(engineer)}
                      disabled={sent || sendingId === id}
                      style={[styles.pressable7, sent ? styles.pressable : styles.pressable8]}
                    >
                      <Send size={12} color={sent ? COLORS.brand[700] : '#fff'} />
                      <Text style={[styles.text5, sent ? styles.text6 : styles.text7]}>
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
          style={styles.textInput2}
          placeholderTextColor={COLORS.slate[400]}
        />
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Email (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.textInput3}
          placeholderTextColor={COLORS.slate[400]}
        />
        <Pressable onPress={generateInvite} disabled={inviteBusy || !invitePhone.trim()} style={[styles.pressable9, styles[inviteBusy || !invitePhone.trim() ? 'pressable3' : '']]}>
          <Text style={styles.text8}>{inviteBusy ? 'Generating…' : 'Generate invitation'}</Text>
        </Pressable>
        {inviteResult && (
          <View style={styles.view5}>
            <Text style={styles.text9}>Invitation ready — share this code:</Text>
            <Text style={styles.text10}>
              {inviteResult.invite_code || inviteResult.code || JSON.stringify(inviteResult)}
            </Text>
          </View>
        )}
      </Panel>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.roseSoft },
  pressable: { backgroundColor: c.brandSoft },
  pressable2: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  pressable3: { opacity: 0.5 },
  view: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view2: { flex: 1 },
  text: { fontSize: 14, fontWeight: '800', color: c.text },
  text2: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  pressable4: { borderRadius: 7, borderWidth: 1, borderColor: c.brandBorderStrong, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  text3: { fontSize: 10, fontWeight: '800', color: c.brandTextStrong },
  text4: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.textFaint },
  pressable5: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view3: { flexDirection: 'row', gap: 7 },
  textInput: { height: 38.5, flex: 1, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  pressable6: { height: 38.5, width: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  view4: { marginTop: 10.5 },
  pressable7: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, paddingHorizontal: 12.25, paddingVertical: 7 },
  pressable8: { backgroundColor: '#1a5038' },
  text5: { fontSize: 11, fontWeight: '800' },
  text6: { color: c.brandText },
  text7: { color: '#ffffff' },
  textInput2: { height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  textInput3: { marginTop: 7, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  pressable9: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  text8: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  view5: { marginTop: 10.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, padding: 10.5 },
  text9: { fontSize: 10.5, lineHeight: 14, fontWeight: '700', color: c.brandTextStrong },
  text10: { marginTop: 3.5, fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', letterSpacing: 1.6, color: c.brandTextDeep },
}))
