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
import { userCountry } from '../../utils/countryConfig'
import { createStyles } from '../../theme/createStyles'

export default function OwnerBuildersScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user)
  const [refreshing, setRefreshing] = useState(false)
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)

  const contractors = useAsyncData(() => fetchNearbyContractors(user?.pincode, userCountry(user)), [user?.pincode, userCountry(user)])
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
              <View key={id} style={styles.view}>
                <View style={styles.view2}>
                  <HardHat size={15} color={COLORS.brand[700]} />
                  <Text style={styles.text} numberOfLines={1}>
                    {contractor.name || contractor.business_name || 'Builder'}
                  </Text>
                </View>
                {!!contractor.company_name && (
                  <Text style={styles.text2} numberOfLines={1}>{contractor.company_name}</Text>
                )}
                <View style={styles.view3}>
                  <MapPin size={11} color={COLORS.slate[400]} />
                  <Text style={styles.text3} numberOfLines={1}>
                    {contractor.address || 'Nearby'}{contractor.pincode ? ` - ${contractor.pincode}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => sendRequest(contractor)}
                  disabled={sent || sendingId === id}
                  style={[styles.pressable, sent ? styles.pressable2 : styles.pressable3, sendingId === id ? styles.pressable4 : null]}
                >
                  <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text style={[styles.text4, sent ? styles.text5 : styles.text6]}>
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

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  text2: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view3: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text3: { flex: 1, fontSize: 11, fontWeight: '600', color: c.textFaint },
  pressable: { marginTop: 10.5, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 9999 },
  pressable2: { backgroundColor: c.brandSoft },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.6 },
  text4: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text5: { color: c.brandText },
  text6: { color: '#ffffff' },
}))
