// Port of the web src/pages/contractor/ContractorDashboard.jsx.
// Wired to: GET /contractors/find-clients, GET /project-requests/incoming,
// GET /engineers/my-team, plus accept/reject request actions.
import { useState, useCallback } from 'react'
import { View, Text, Pressable, Alert, Modal, TextInput } from 'react-native'
import { Users, Briefcase, Check, X } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, MetricRow, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { fetchNearbyProjects } from '../../api/projects'
import { fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest } from '../../api/requests'
import { fetchEngineerTeam } from '../../api/engineers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function ContractorDashboard({ navigation }) {
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
    const [quoteFor, setQuoteFor] = useState(null)   // the request being accepted with a quotation
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)

  const leads = useAsyncData(fetchNearbyProjects, [])
  const requests = useAsyncData(fetchIncomingRequests, [])
  const team = useAsyncData(fetchEngineerTeam, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([leads.reload(), requests.reload(), team.reload()])
    setRefreshing(false)
  }, [leads, requests, team])

   async function respond(request, accept) {
    // Accepting an owner's request submits a quotation — same as web.
    if (accept && String(request.request_type || '').startsWith('OWNER')) {
      setQuoteAmount('')
      setQuoteFor(request)
      return
    }
    try {
      if (accept) await acceptProjectRequest(request.id)
      else await rejectProjectRequest(request.id)
      await requests.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    }
  }

  async function submitQuotation() {
    const amount = Number(String(quoteAmount).replace(/,/g, '').trim())
    if (!amount || amount <= 0) {
      Alert.alert('Quotation needed', 'Enter the amount you are quoting for this project.')
      return
    }
    setQuoteBusy(true)
    try {
      await acceptProjectRequest(quoteFor.id, amount)
      setQuoteFor(null)
      await requests.reload()
    } catch (error) {
      Alert.alert('Could not accept', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setQuoteBusy(false)
    }
  }

  const requestList = Array.isArray(requests.data) ? requests.data : []
  const leadList = Array.isArray(leads.data) ? leads.data : []
  const teamList = Array.isArray(team.data) ? team.data : []

  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <MetricRow
          items={[
            { label: 'Open leads', value: String(leadList.length) },
            { label: 'Requests', value: String(requestList.length) },
            { label: 'Engineers', value: String(teamList.length) },
          ]}
        />

        <Panel title="Incoming requests">
          <PanelState
            loading={requests.loading}
            error={requests.error}
            empty={requestList.length === 0}
            emptyText="No pending requests right now."
          >
            {requestList.map((request) => (
              <View key={request.id} style={styles.view}>
                <Text style={[styles.text, { fontSize: 14.5 }]}>
                  {request.project_title || request.title || `Request #${request.id}`}
                </Text>
                <Text style={[styles.text2, { fontSize: 12.5 }]}>
                  {request.owner_name ? `From ${request.owner_name}` : ''} {request.status ? `· ${request.status}` : ''}
                </Text>
                <View style={[styles.view2, { gap: 10 }]}>
                  <Pressable
 onPress={() => respond(request, true)}
                    style={[styles.pressable, { gap: 6 }]}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text style={[styles.text3, { fontSize: 13 }]}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
onPress={() => respond(request, false)}
                    style={[styles.pressable2, { gap: 6 }]}
                  >
                    <X size={14} color="#dc2626" />
                    <Text style={[styles.text4, { fontSize: 13 }]}>
                      Decline
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel title="Find clients">
          <PanelState
            loading={leads.loading}
            error={leads.error}
            empty={leadList.length === 0}
            emptyText="No open projects in your service area yet."
          >
            {leadList.slice(0, 8).map((lead) => (
              <View key={lead.id} style={[styles.view3, { gap: 10 }]}>
                <View style={styles.view4}>
                  <Briefcase size={16} color={COLORS.brand[800]} />
                </View>
                <View style={styles.view5}>
                  <Text style={[styles.text, { fontSize: 14 }]} numberOfLines={1}>
                    {lead.title}
                  </Text>
                  <Text style={[styles.text5, { fontSize: 12 }]} numberOfLines={1}>
                    {lead.pincode} · {lead.building_type || '—'}
                    {lead.budget ? ` · ₹${Number(lead.budget).toLocaleString('en-IN')}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel title="My site engineers">
          <PanelState
            loading={team.loading}
            error={team.error}
            empty={teamList.length === 0}
            emptyText="No engineers on your team yet. Invite one from the web dashboard."
          >
            {teamList.map((member) => (
              <View key={member.id} style={[styles.view3, { gap: 10 }]}>
                <View style={styles.view6}>
                  <Users size={16} color="#475569" />
                </View>
                <View style={styles.view5}>
                  <Text style={[styles.text, { fontSize: 14 }]}>
                    {member.name}
                  </Text>
                  <Text style={[styles.text5, { fontSize: 12 }]}>
                    {member.status || 'Active'}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>
      </DashboardShell>
            <Modal visible={!!quoteFor} transparent animationType="fade" onRequestClose={() => setQuoteFor(null)}>
        <View style={styles.view7}>
          <View style={styles.view8}>
            <Text style={styles.text6}>Your quotation</Text>
            <Text style={styles.text7} numberOfLines={1}>
              {quoteFor?.project_title || quoteFor?.title || 'Project'}
            </Text>
            <TextInput
              value={quoteAmount}
              onChangeText={setQuoteAmount}
              keyboardType="numeric"
              placeholder="Amount (₹)"
              placeholderTextColor="#94a3b8"
              autoFocus
              style={styles.textInput}
            />
            <View style={styles.view9}>
              <Pressable onPress={() => setQuoteFor(null)} style={styles.pressable3}>
                <Text style={styles.text8}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitQuotation} disabled={quoteBusy} style={[styles.pressable4, quoteBusy ? styles.pressable5 : null]}>
                <Text style={styles.text9}>{quoteBusy ? 'Sending…' : 'Accept with quote'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, borderRadius: 14, backgroundColor: c.subtle, padding: 14 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view2: { marginTop: 10.5, flexDirection: 'row' },
  pressable: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#134127', paddingVertical: 8.75 },
  text3: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable2: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card, paddingVertical: 8.75 },
  text4: { fontFamily: 'Inter_700Bold', color: '#dc2626' },
  view3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  view4: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.brandSoft },
  view5: { flex: 1 },
  text5: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view6: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.muted },
  view7: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 21 },
  view8: { width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 17.5 },
  text6: { fontSize: 15, fontWeight: '800', color: c.text },
  text7: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  textInput: { marginTop: 10.5, height: 42, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 16, fontWeight: '800', color: c.text },
  view9: { marginTop: 14, flexDirection: 'row', gap: 7 },
  pressable3: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border },
  text8: { fontSize: 13, fontWeight: '800', color: c.textMuted },
  pressable4: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable5: { opacity: 0.5 },
  text9: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
}))
