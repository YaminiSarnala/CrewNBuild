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
              <View key={request.id} className="mb-4 rounded-2xl bg-slate-50 p-4">
                <Text className="font-sansBold text-graphite" style={{ fontSize: 14.5 }}>
                  {request.project_title || request.title || `Request #${request.id}`}
                </Text>
                <Text className="mt-1 font-sans text-slate-500" style={{ fontSize: 12.5 }}>
                  {request.owner_name ? `From ${request.owner_name}` : ''} {request.status ? `· ${request.status}` : ''}
                </Text>
                <View className="mt-3 flex-row" style={{ gap: 10 }}>
                  <Pressable
 onPress={() => respond(request, true)}
                    className="flex-1 flex-row items-center justify-center rounded-full bg-brand-800 py-2.5 active:bg-brand-700"
                    style={{ gap: 6 }}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text className="font-sansBold text-white" style={{ fontSize: 13 }}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
onPress={() => respond(request, false)}
                    className="flex-1 flex-row items-center justify-center rounded-full border border-slate-300 bg-white py-2.5 active:bg-slate-100"
                    style={{ gap: 6 }}
                  >
                    <X size={14} color="#dc2626" />
                    <Text className="font-sansBold text-warm" style={{ fontSize: 13 }}>
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
              <View key={lead.id} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <Briefcase size={16} color="#134127" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }} numberOfLines={1}>
                    {lead.title}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }} numberOfLines={1}>
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
              <View key={member.id} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Users size={16} color="#475569" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                    {member.name}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
                    {member.status || 'Active'}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>
      </DashboardShell>
            <Modal visible={!!quoteFor} transparent animationType="fade" onRequestClose={() => setQuoteFor(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-[15px] font-extrabold text-graphite">Your quotation</Text>
            <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
              {quoteFor?.project_title || quoteFor?.title || 'Project'}
            </Text>
            <TextInput
              value={quoteAmount}
              onChangeText={setQuoteAmount}
              keyboardType="numeric"
              placeholder="Amount (₹)"
              placeholderTextColor="#94a3b8"
              autoFocus
              className="mt-3 h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] font-extrabold text-graphite"
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => setQuoteFor(null)} className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-200">
                <Text className="text-[13px] font-extrabold text-slate-500">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitQuotation} disabled={quoteBusy} className={`h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 ${quoteBusy ? 'opacity-50' : ''}`}>
                <Text className="text-[13px] font-extrabold text-white">{quoteBusy ? 'Sending…' : 'Accept with quote'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}
