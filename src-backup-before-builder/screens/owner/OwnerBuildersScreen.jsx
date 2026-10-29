// Port of the web owner's Builders section: nearby contractors by pincode,
// with the same OWNER_TO_CONTRACTOR request payload the web sends.
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import { HardHat, Send, MapPin } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchNearbyContractors, fetchOwnerProjects } from '../../api/projects'
import { sendProjectRequest } from '../../api/requests'
import { COLORS } from '../../theme/tokens'

export default function OwnerBuildersScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [refreshing, setRefreshing] = useState(false)
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)

  const contractors = useAsyncData(() => fetchNearbyContractors(user?.pincode, user?.country), [user?.pincode, user?.country])
  const projects = useAsyncData(fetchOwnerProjects, [])

  const contractorList = Array.isArray(contractors.data) ? contractors.data : []
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const firstProject = projectList[0] || null

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([contractors.reload(), projects.reload()])
    setRefreshing(false)
  }

  async function sendRequest(contractor) {
    const id = contractor.user_id || contractor.id
    setSendingId(id)
    try {
      await sendProjectRequest({
        receiver_id: id,
        project_id: firstProject?.id || null,
        request_type: 'OWNER_TO_CONTRACTOR',
      })
      setSentIds((prev) => new Set(prev).add(id))
    } catch (error) {
      Alert.alert('Could not send', error?.response?.data?.detail || 'Unable to send builder request.')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Panel title="Builders near you">
        <PanelState loading={contractors.loading} error={contractors.error} empty={!contractorList.length} emptyText="No builders found near your pincode yet.">
          {contractorList.map((contractor) => {
            const id = contractor.user_id || contractor.id
            const sent = sentIds.has(id)
            return (
              <View key={id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center gap-2">
                  <HardHat size={15} color={COLORS.brand[700]} />
                  <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>
                    {contractor.name || contractor.business_name || 'Builder'}
                  </Text>
                </View>
                {!!contractor.company_name && (
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{contractor.company_name}</Text>
                )}
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <MapPin size={11} color={COLORS.slate[400]} />
                  <Text className="flex-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                    {contractor.address || 'Nearby'}{contractor.pincode ? ` - ${contractor.pincode}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => sendRequest(contractor)}
                  disabled={sent || sendingId === id}
                  className={`mt-3 h-10 flex-row items-center justify-center gap-1.5 rounded-full ${sent ? 'bg-brand-50' : 'bg-brand-700'} ${sendingId === id ? 'opacity-60' : ''}`}
                >
                  <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text className={`text-xs font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>
                    {sent ? 'Request sent' : sendingId === id ? 'Sending…' : 'Send request'}
                  </Text>
                </Pressable>
              </View>
            )
          })}
        </PanelState>
      </Panel>
    </DashboardShell>
  )
}