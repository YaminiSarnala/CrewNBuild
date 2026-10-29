// Port of the web supplier 'incomingRequests' section: partnership requests
// split into Owner / Builder tabs by request_type, accept/reject via the same
// project-request endpoints.
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { House as Home, HardHat, Check, X } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest } from '../../api/requests'
import { COLORS } from '../../theme/tokens'

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
      <View className="mb-4 flex-row gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-brand-700' : ''}`}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      <PanelState loading={requests.loading} error={requests.error} empty={!activeList.length} emptyText="No pending requests here right now.">
        {activeList.map((request) => {
          const pending = String(request.status || 'PENDING').toUpperCase() === 'PENDING'
          return (
            <View key={request.id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
              <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                {request.sender_name || request.owner_name || request.contractor_name || 'New partner request'}
              </Text>
              <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                {request.project_title || 'Partnership request'}{request.status ? ` · ${request.status}` : ''}
              </Text>
              {pending && (
                <View className="mt-3 flex-row gap-2">
                  <Pressable onPress={() => respond(request.id, false)} disabled={busyId === request.id} className="h-9 flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50">
                    <X size={13} color="#e11d48" />
                    <Text className="text-xs font-extrabold text-rose-700">Reject</Text>
                  </Pressable>
                  <Pressable onPress={() => respond(request.id, true)} disabled={busyId === request.id} className="h-9 flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-brand-700">
                    <Check size={13} color="#fff" />
                    <Text className="text-xs font-extrabold text-white">Accept</Text>
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