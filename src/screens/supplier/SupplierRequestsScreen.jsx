// Port of the web supplier 'incomingRequests' section: partnership requests
// split into Owner / Builder tabs by request_type, accept/reject via the same
// project-request endpoints.
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { House as Home, HardHat, Check, X } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest } from '../../api/requests'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function SupplierRequestsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('owner')
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const requests = useAsyncData(fetchIncomingRequests, [])
  const requestList = Array.isArray(requests.data) ? requests.data : []

  // Same split the web makes in SupplierDashboard
  const ownerRequests = requestList.filter((r) => String(r.request_type || '').startsWith('OWNER'))
  const builderRequests = requestList.filter((r) => String(r.request_type || '').startsWith('CONTRACTOR'))

  const onRefresh = async () => {
    setRefreshing(true)
    await requests.reload()
    setRefreshing(false)
  }

  async function respond(requestId, accept) {
    setBusyId(requestId)
    try {
      if (accept) await acceptProjectRequest(requestId)
      else await rejectProjectRequest(requestId)
      await requests.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    { id: 'owner', label: `Owners (${ownerRequests.length})`, icon: Home },
    { id: 'builder', label: `Builders (${builderRequests.length})`, icon: HardHat },
  ]
  const activeList = activeTab === 'owner' ? ownerRequests : builderRequests

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <View style={styles.view}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable, active ? styles.pressable2 : null]}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text style={[styles.text, active ? styles.text2 : styles.text3]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      <PanelState loading={requests.loading} error={requests.error} empty={!activeList.length} emptyText="No pending requests here right now.">
        {activeList.map((request) => {
          const pending = String(request.status || 'PENDING').toUpperCase() === 'PENDING'
          return (
            <View key={request.id} style={styles.view2}>
              <Text style={styles.text4} numberOfLines={1}>
                {request.sender_name || request.owner_name || request.contractor_name || 'New partner request'}
              </Text>
              <Text style={styles.text5} numberOfLines={1}>
                {request.project_title || 'Partnership request'}{request.status ? ` · ${request.status}` : ''}
              </Text>
              {pending && (
                <View style={styles.view3}>
                  <Pressable onPress={() => respond(request.id, false)} disabled={busyId === request.id} style={styles.pressable3}>
                    <X size={13} color="#e11d48" />
                    <Text style={styles.text6}>Reject</Text>
                  </Pressable>
                  <Pressable onPress={() => respond(request.id, true)} disabled={busyId === request.id} style={styles.pressable4}>
                    <Check size={13} color="#fff" />
                    <Text style={styles.text7}>Accept</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )
        })}
      </PanelState>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, flexDirection: 'row', gap: 5.25, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5.25 },
  pressable: { height: 35, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 10.5 },
  pressable2: { backgroundColor: '#1a5038' },
  text: { fontSize: 11, fontWeight: '800' },
  text2: { color: '#ffffff' },
  text3: { color: c.textMuted },
  view2: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text4: { fontSize: 14, fontWeight: '800', color: c.text },
  text5: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view3: { marginTop: 10.5, flexDirection: 'row', gap: 7 },
  pressable3: { height: 31.5, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3.5, borderRadius: 7, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  text6: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.roseText },
  pressable4: { height: 31.5, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3.5, borderRadius: 7, backgroundColor: '#1a5038' },
  text7: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#ffffff' },
}))
