// Port of web contractorFindClients.jsx. Two tabs: houseowner project leads
// (fetchNearbyProjects) and supplier leads (fetchNearbySuppliers). Sending a
// request uses the same payload the web builds in ContractorDashboard:
// { receiver_id, project_id, request_type }.
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import { House as Home, Truck, Send, CircleCheckBig } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchNearbyProjects, fetchNearbySuppliers } from '../../api/projects'
import { sendProjectRequest } from '../../api/requests'
import { COLORS } from '../../theme/tokens'

export default function ContractorLeadsScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [activeTab, setActiveTab] = useState('houseowners')
  const [refreshing, setRefreshing] = useState(false)
  const [sentKeys, setSentKeys] = useState(new Set())
  const [sendingKey, setSendingKey] = useState(null)

  const owners = useAsyncData(() => fetchNearbyProjects(user?.country), [user?.country])
  const suppliers = useAsyncData(() => fetchNearbySuppliers(user?.pincode, user?.country), [user?.pincode, user?.country])

  const ownerList = Array.isArray(owners.data) ? owners.data : []
  const supplierList = Array.isArray(suppliers.data) ? suppliers.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([owners.reload(), suppliers.reload()])
    setRefreshing(false)
  }

  async function sendRequest(client, requestType) {
    const receiverId = requestType === 'CONTRACTOR_TO_OWNER' ? client.owner_id : (client.user_id || client.id)
    const key = `${requestType}-${receiverId}-${client.project_id || client.id || 'profile'}`
    setSendingKey(key)
    try {
      await sendProjectRequest({
        receiver_id: receiverId,
        project_id: client.project_id || (requestType === 'CONTRACTOR_TO_OWNER' ? client.id : null),
        request_type: requestType,
      })
      setSentKeys((prev) => new Set(prev).add(key))
    } catch (error) {
      Alert.alert('Could not send request', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSendingKey(null)
    }
  }

  function LeadCard({ title, subtitle, footer, sent, sending, onSend }) {
    return (
      <View className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-center gap-1.5">
         < CircleCheckBig size={13}color={COLORS.brand[600]} />
          <Text className="text-[10px] font-extrabold uppercase tracking-wide text-brand-700">Verified lead</Text>
        </View>
        <Text className="mt-1.5 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{subtitle}</Text>}
        {!!footer && <Text className="mt-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>{footer}</Text>}
        <Pressable
          onPress={onSend}
          disabled={sent || sending}
          className={`mt-3 h-10 flex-row items-center justify-center gap-1.5 rounded-full ${sent ? 'bg-brand-50' : 'bg-brand-700'} ${sending ? 'opacity-60' : ''}`}
        >
          <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
          <Text className={`text-xs font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>
            {sent ? 'Request sent' : sending ? 'Sending…' : 'Send request'}
          </Text>
        </Pressable>
      </View>
    )
  }

  const tabs = [
    { id: 'houseowners', label: `Houseowners (${ownerList.length})`, icon: Home },
    { id: 'suppliers', label: `Suppliers (${supplierList.length})`, icon: Truck },
  ]

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

      {activeTab === 'houseowners' && (
        <PanelState loading={owners.loading} error={owners.error} empty={!ownerList.length} emptyText="No open houseowner projects near you right now.">
          {ownerList.map((project) => {
            const key = `CONTRACTOR_TO_OWNER-${project.owner_id}-${project.project_id || project.id || 'profile'}`
            return (
              <LeadCard
                key={project.id}
                title={project.project_title || project.title || 'Homeowner Project'}
                subtitle={project.owner_name || project.profile_title || 'Homeowner'}
                footer={`${project.address || 'Location not set'}${project.pincode ? ` - ${project.pincode}` : ''}${project.land_area ? ` · ${project.land_area} Sq.ft` : ''}`}
                sent={sentKeys.has(key)}
                sending={sendingKey === key}
                onSend={() => sendRequest(project, 'CONTRACTOR_TO_OWNER')}
              />
            )
          })}
        </PanelState>
      )}

      {activeTab === 'suppliers' && (
        <PanelState loading={suppliers.loading} error={suppliers.error} empty={!supplierList.length} emptyText="No suppliers found near you right now.">
          {supplierList.map((supplier) => {
            const key = `CONTRACTOR_TO_SUPPLIER-${supplier.user_id || supplier.id}-${supplier.project_id || supplier.id || 'profile'}`
            return (
              <LeadCard
                key={supplier.id || supplier.user_id}
                title={supplier.business_name || supplier.name || 'Supplier'}
                subtitle={supplier.material_types ? String(supplier.material_types) : 'Building materials'}
                footer={`${supplier.address || ''}${supplier.pincode ? ` - ${supplier.pincode}` : ''}`}
                sent={sentKeys.has(key)}
                sending={sendingKey === key}
                onSend={() => sendRequest(supplier, 'CONTRACTOR_TO_SUPPLIER')}
              />
            )
          })}
        </PanelState>
      )}
    </DashboardShell>
  )
}