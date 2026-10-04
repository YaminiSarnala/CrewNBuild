// Port of web OwnerProjectWorkspace.jsx + ownerSections: each project opens as
// its own workspace with a section strip. Sections follow the web rule:
//   builder-managed project   -> Overview / Requests / Builders / Escrow
//   self-construction project -> Overview / Requests / Engineer / Suppliers / Escrow
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import {
  ChevronLeft, House as Home, MapPin, LayoutDashboard, FileText,
  HardHat, Truck, Wallet, Send, Check, X,
} from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchOwnerProjects, fetchProjectTimelineEntries, fetchNearbyContractors } from '../../api/projects'
import {
  fetchIncomingRequests, acceptProjectRequest, rejectProjectRequest,
  assignProjectToContractor, sendProjectRequest,
} from '../../api/requests'
import { fetchProjectEngineer, assignEngineerToProject } from '../../api/engineers'
import { COLORS } from '../../theme/tokens'

const inr = (value) => (Number(value || 0) ? `₹${Number(value).toLocaleString('en-IN')}` : '—')

// Same conditional section list as web projectSectionIds()
function sectionsFor(project) {
  const self = project?.construction_type === 'SELF_CONSTRUCTION'
  return [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'requests', label: 'Requests', icon: FileText },
    ...(self
      ? [{ id: 'engineer', label: 'Engineer', icon: HardHat }, { id: 'suppliers', label: 'Suppliers', icon: Truck }]
      : [{ id: 'builders', label: 'Builders', icon: HardHat }]),
    { id: 'escrow', label: 'Escrow', icon: Wallet },
  ]
}

function DetailField({ label, value }) {
  return (
    <View className="w-[48%] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <Text className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</Text>
      <Text className="mt-0.5 text-xs font-bold text-graphite" numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
  )
}

function OverviewSection({ project }) {
  const timeline = useAsyncData(() => fetchProjectTimelineEntries(project.id), [project.id])
  const timelineList = Array.isArray(timeline.data) ? timeline.data : []
  const completion = Math.min(Number(project.completion_percentage || 0), 100)
  return (
    <View>
      <Panel title={`Progress · ${completion}%`}>
        <View className="h-2 overflow-hidden rounded-full bg-slate-100">
          <View className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
        </View>
      </Panel>
      <View className="mb-4 flex-row flex-wrap justify-between gap-y-2.5">
        <DetailField label="Construction" value={project.construction_type} />
        <DetailField label="Building type" value={project.building_type} />
        <DetailField label="Land area" value={project.land_area ? `${project.land_area} Sq.ft` : null} />
        <DetailField label="Floors" value={project.floors != null ? String(project.floors) : null} />
        <DetailField label="Budget" value={inr(project.budget)} />
        <DetailField label="Builder" value={project.contractor_name || (project.contractor_id ? 'Appointed' : 'Not appointed')} />
      </View>
      <Panel title="Site activity">
        <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText="No site updates yet.">
          {timelineList.map((entry, index) => (
            <View key={entry.id || index} className="border-b border-slate-100 py-3">
              <Text className="text-xs font-extrabold text-brand-700">{String(entry.date || entry.work_date || '').slice(0, 10)}</Text>
              <Text className="mt-1 text-[13px] font-semibold text-graphite">{entry.work_type || entry.description || 'Daily site record'}</Text>
            </View>
          ))}
        </PanelState>
      </Panel>
    </View>
  )
}

function RequestsSection({ project, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const requests = useAsyncData(fetchIncomingRequests, [])
  const list = (Array.isArray(requests.data) ? requests.data : []).filter((r) => r.project_id === project.id)
  const pending = list.filter((r) => String(r.status).toLowerCase() === 'pending')
  const quotes = list.filter((r) => String(r.status).toLowerCase() === 'accepted' && Number(r.quotation_amount || 0) > 0)

  async function run(action, id) {
    setBusyId(id)
    try {
      await action()
      await requests.reload()
      onChanged?.()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View>
      <Panel title="Incoming requests">
        <PanelState loading={requests.loading} error={requests.error} empty={!pending.length} emptyText="No pending requests on this project.">
          {pending.map((request) => (
            <View key={request.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{request.sender_name || 'Request'}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500">{String(request.request_type || '').replace(/_/g, ' ')}</Text>
              </View>
              <Pressable onPress={() => run(() => acceptProjectRequest(request.id), request.id)} disabled={busyId === request.id} className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <Check size={16} color={COLORS.brand[700]} />
              </Pressable>
              <Pressable onPress={() => run(() => rejectProjectRequest(request.id), request.id)} disabled={busyId === request.id} className="h-9 w-9 items-center justify-center rounded-full bg-rose-50">
                <X size={16} color="#e11d48" />
              </Pressable>
            </View>
          ))}
        </PanelState>
      </Panel>

      <Panel title="Quotations received">
        <PanelState empty={!quotes.length} emptyText="No builder quotations yet.">
          {quotes.map((request) => (
            <View key={request.id} className="border-b border-slate-100 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{request.sender_name || 'Builder'}</Text>
                <Text className="text-[15px] font-extrabold text-brand-700">{inr(request.quotation_amount)}</Text>
              </View>
              {!project.contractor_id && (
                <Pressable
                  onPress={() => run(() => assignProjectToContractor(request.id), request.id)}
                  disabled={busyId === request.id}
                  className={`mt-2 h-10 items-center justify-center rounded-full bg-brand-700 ${busyId === request.id ? 'opacity-60' : ''}`}
                >
                  <Text className="text-xs font-extrabold text-white">Appoint this builder</Text>
                </Pressable>
              )}
            </View>
          ))}
        </PanelState>
      </Panel>
    </View>
  )
}

function BuildersSection({ project }) {
  const user = useSelector((state) => state.auth.user)
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)
  const contractors = useAsyncData(() => fetchNearbyContractors(user?.pincode, user?.country), [user?.pincode, user?.country])
  const list = Array.isArray(contractors.data) ? contractors.data : []

  async function sendRequest(contractor) {
    const id = contractor.user_id || contractor.id
    setSendingId(id)
    try {
      await sendProjectRequest({ receiver_id: id, project_id: project.id, request_type: 'OWNER_TO_CONTRACTOR' })
      setSentIds((prev) => new Set(prev).add(id))
    } catch (error) {
      Alert.alert('Could not send', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <Panel title="Builders near you">
      <PanelState loading={contractors.loading} error={contractors.error} empty={!list.length} emptyText="No builders found near your pincode.">
        {list.map((contractor) => {
          const id = contractor.user_id || contractor.id
          const sent = sentIds.has(id)
          return (
            <View key={id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{contractor.name || contractor.company_name || 'Builder'}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{contractor.company_name || contractor.address || 'Nearby'}</Text>
              </View>
              <Pressable onPress={() => sendRequest(contractor)} disabled={sent || sendingId === id} className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${sent ? 'bg-brand-50' : 'bg-brand-700'}`}>
                <Send size={12} color={sent ? COLORS.brand[700] : '#fff'} />
                <Text className={`text-[11px] font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>{sent ? 'Sent' : 'Request'}</Text>
              </Pressable>
            </View>
          )
        })}
      </PanelState>
    </Panel>
  )
}

function EngineerSection({ project }) {
  const [busyId, setBusyId] = useState(null)
  const engineer = useAsyncData(() => fetchProjectEngineer(project.id).catch(() => ({ engineer: null })), [project.id])
  const requests = useAsyncData(fetchIncomingRequests, [])
  const assigned = engineer.data?.engineer || null
  // Engineers the owner may appoint: accepted OWNER_TO_ENGINEER requests on this project
  const candidates = (Array.isArray(requests.data) ? requests.data : []).filter(
    (r) => r.project_id === project.id && String(r.request_type).includes('ENGINEER') && String(r.status).toLowerCase() === 'accepted',
  )

  async function appoint(request) {
    const engineerId = request.receiver_id
    setBusyId(request.id)
    try {
      await assignEngineerToProject(project.id, engineerId)
      await engineer.reload()
      Alert.alert('Assigned', 'Site engineer assigned to this project.')
    } catch (error) {
      Alert.alert('Could not assign', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View>
      <Panel title="Site engineer">
        <PanelState loading={engineer.loading} empty={!assigned} emptyText="No engineer assigned yet.">
          {assigned && (
            <View>
              <Text className="text-[15px] font-extrabold text-graphite">{assigned.name || assigned.full_name}</Text>
              <Text className="mt-0.5 text-xs font-semibold text-slate-500">{assigned.category || 'Site Engineer'}</Text>
            </View>
          )}
        </PanelState>
      </Panel>
      {!assigned && (
        <Panel title="Ready to appoint">
          <PanelState loading={requests.loading} empty={!candidates.length} emptyText="Send a request to an engineer first — accepted engineers appear here.">
            {candidates.map((request) => (
              <View key={request.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
                <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{request.receiver_name || request.sender_name || 'Engineer'}</Text>
                <Pressable onPress={() => appoint(request)} disabled={busyId === request.id} className="rounded-full bg-brand-700 px-3.5 py-2">
                  <Text className="text-[11px] font-extrabold text-white">Assign</Text>
                </Pressable>
              </View>
            ))}
          </PanelState>
        </Panel>
      )}
    </View>
  )
}

function EscrowSection({ project }) {
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []
  return (
    <Panel title="Escrow milestones">
      <PanelState empty={!milestones.length} emptyText="No milestones on this project.">
        {milestones.map((milestone) => (
          <View key={milestone.id} className="flex-row items-center justify-between border-b border-slate-100 py-3">
            <Text className="flex-1 text-[14px] font-extrabold text-graphite">{milestone.name}</Text>
            <View className="items-end">
              <Text className="text-[15px] font-extrabold text-brand-700">{inr(milestone.amount)}</Text>
              <Text className="mt-0.5 text-[10px] font-extrabold text-slate-400">{milestone.status || 'PENDING'}</Text>
            </View>
          </View>
        ))}
      </PanelState>
    </Panel>
  )
}

function ProjectWorkspace({ project, onBack, navigation, onChanged }) {
  const sections = sectionsFor(project)
  const [section, setSection] = useState('overview')

  return (
    <View>
      <Pressable onPress={onBack} className="mb-3 flex-row items-center gap-1">
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text className="text-sm font-extrabold text-brand-700">All projects</Text>
      </Pressable>
      <Text className="text-xl font-extrabold text-graphite">{project.project_title || project.title}</Text>
      <Text className="mt-1 text-xs font-semibold text-slate-500">
        {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
      </Text>

      {/* The project's own navigation — same strip as web OwnerProjectWorkspace */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 mb-4" contentContainerStyle={{ gap: 6 }}>
        {sections.map(({ id, label, icon: Icon }) => {
          const active = section === id
          return (
            <Pressable key={id} onPress={() => setSection(id)} className={`h-9 flex-row items-center gap-1.5 rounded-xl px-3.5 ${active ? 'bg-brand-700' : 'bg-white border border-slate-200'}`}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text className={`text-xs font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {section === 'overview' && <OverviewSection project={project} />}
      {section === 'requests' && <RequestsSection project={project} onChanged={onChanged} />}
      {section === 'builders' && <BuildersSection project={project} />}
      {section === 'engineer' && <EngineerSection project={project} />}
      {section === 'suppliers' && (
        <Panel title="Suppliers & materials">
          <Text className="text-xs font-semibold text-slate-500">Browse approved suppliers, build your cart, and send buy requests for this project from the Buy & Sell tab.</Text>
          <Pressable onPress={() => navigation.navigate('OwnerShopTab')} className="mt-3 h-11 items-center justify-center rounded-xl bg-brand-700">
            <Text className="text-[13px] font-extrabold text-white">Open Buy & Sell</Text>
          </Pressable>
        </Panel>
      )}
      {section === 'escrow' && <EscrowSection project={project} />}
    </View>
  )
}

export default function OwnerProjectsScreen({ navigation }) {
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchOwnerProjects, [])
  const projectList = Array.isArray(projects.data) ? projects.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await projects.reload()
    setRefreshing(false)
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      {selected ? (
        <ProjectWorkspace
          project={projectList.find((p) => p.id === selected.id) || selected}
          onBack={() => setSelected(null)}
          navigation={navigation}
          onChanged={() => projects.reload()}
        />
      ) : (
        <Panel title="My projects">
          <PanelState loading={projects.loading} error={projects.error} empty={!projectList.length} emptyText="No projects yet. Create one from the estimate calculator.">
            {projectList.map((project) => {
              const completion = Math.min(Number(project.completion_percentage || 0), 100)
              return (
                <Pressable key={project.id} onPress={() => setSelected(project)} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-center gap-2">
                    <Home size={16} color={COLORS.brand[700]} />
                    <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{project.project_title || project.title || 'Project'}</Text>
                    <Text className="text-xs font-extrabold text-brand-700">{completion}%</Text>
                  </View>
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <MapPin size={12} color={COLORS.slate[400]} />
                    <Text className="flex-1 text-xs font-semibold text-slate-500" numberOfLines={1}>
                      {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
                    </Text>
                  </View>
                  <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <View className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
                  </View>
                </Pressable>
              )
            })}
          </PanelState>
        </Panel>
      )}
    </DashboardShell>
  )
}