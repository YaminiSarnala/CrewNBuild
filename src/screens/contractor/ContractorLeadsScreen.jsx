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
import { userCountry } from '../../utils/countryConfig'
import { createStyles } from '../../theme/createStyles'

export default function ContractorLeadsScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [activeTab, setActiveTab] = useState('houseowners')
  const [refreshing, setRefreshing] = useState(false)
  const [sentKeys, setSentKeys] = useState(new Set())
  const [sendingKey, setSendingKey] = useState(null)

  const owners = useAsyncData(() => fetchNearbyProjects(userCountry(user)), [userCountry(user)])
  const suppliers = useAsyncData(() => fetchNearbySuppliers(user?.pincode, userCountry(user)), [user?.pincode, userCountry(user)])

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
      <View style={styles.view}>
        <View style={styles.view2}>
         < CircleCheckBig size={13}color={COLORS.brand[600]} />
          <Text style={styles.text}>Verified lead</Text>
        </View>
        <Text style={styles.text2} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.text3} numberOfLines={1}>{subtitle}</Text>}
        {!!footer && <Text style={styles.text4} numberOfLines={1}>{footer}</Text>}
        <Pressable
          onPress={onSend}
          disabled={sent || sending}
          style={[styles.pressable, sent ? styles.pressable2 : styles.pressable3, sending ? styles.pressable4 : null]}
        >
          <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
          <Text style={[styles.text5, sent ? styles.text6 : styles.text7]}>
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
      <View style={styles.view3}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable5, active ? styles.pressable3 : null]}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text style={[styles.text8, active ? styles.text7 : styles.text9]}>{label}</Text>
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

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  text2: { marginTop: 5.25, fontSize: 15, fontWeight: '800', color: c.text },
  text3: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  text4: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textFaint },
  pressable: { marginTop: 10.5, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 9999 },
  pressable2: { backgroundColor: c.brandSoft },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.6 },
  text5: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text6: { color: c.brandText },
  text7: { color: '#ffffff' },
  view3: { marginBottom: 14, flexDirection: 'row', gap: 5.25, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5.25 },
  pressable5: { height: 35, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 10.5 },
  text8: { fontSize: 11, fontWeight: '800' },
  text9: { color: c.textMuted },
}))
