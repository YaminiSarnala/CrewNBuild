// Port of web contractorProjectViews.jsx (ContractorProjectsTable +
// ContractorProjectDetail). Same data: fetchOwnerProjects (backend scopes to
// the contractor's assigned projects), per-project engineer + suppliers,
// timeline entries for Activity, escrow_milestones for Payments.
import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, HardHat, MapPin } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchOwnerProjects,
  fetchProjectTimelineEntries,
} from '../../api/projects'
import {
  fetchProjectEngineer, fetchProjectSuppliers, fetchContractorSuppliers,
  assignSupplierToProject, unassignSupplierFromProject,
} from '../../api/engineers'
import { COLORS } from '../../theme/tokens'

const TABS = [
  { id: 'details', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'team', label: 'Team' },
  { id: 'payments', label: 'Payments' },
]

function inr(value) {
  const amount = Number(value || 0)
  if (!amount) return '—'
  return `₹${amount.toLocaleString('en-IN')}`
}

function StatusChip({ label, tone = 'brand' }) {
  const bg = tone === 'positive' ? 'bg-brand-100' : tone === 'muted' ? 'bg-slate-100' : 'bg-brand-50'
  const fg = tone === 'muted' ? 'text-slate-500' : 'text-brand-800'
  return (
    <View className={`self-start rounded-full px-3 py-1 ${bg}`}>
      <Text className={`text-[11px] font-extrabold ${fg}`}>{label}</Text>
    </View>
  )
}

function ProjectCard({ project, onPress }) {
  const completion = Math.min(Number(project.completion_percentage || 0), 100)
  return (
    <Pressable onPress={onPress} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-2">
        <HardHat size={16} color={COLORS.brand[700]} />
        <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>
          {project.project_title || project.title || 'Project'}
        </Text>
        <StatusChip label={`${completion}%`} />
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
}

function DetailField({ label, value }) {
  return (
    <View className="w-[48%] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <Text className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</Text>
      <Text className="mt-0.5 text-xs font-bold text-graphite" numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
  )
}

function ProjectDetail({ project, onBack }) {
  const [activeTab, setActiveTab] = useState('details')
  const timeline = useAsyncData(() => fetchProjectTimelineEntries(project.id), [project.id])
  const engineer = useAsyncData(() => fetchProjectEngineer(project.id).catch(() => ({ engineer: null })), [project.id])
  const suppliers = useAsyncData(() => fetchProjectSuppliers(project.id).catch(() => []), [project.id])
    const mySuppliers = useAsyncData(() => fetchContractorSuppliers().catch(() => []), [])
  const [supplierBusyId, setSupplierBusyId] = useState(null)

  const mySupplierList = Array.isArray(mySuppliers.data) ? mySuppliers.data : []

  async function changeSupplier(supplier, assign) {
    const engineerId = (engineer.data?.engineer || {}).user_id
    if (assign && !engineerId) {
      Alert.alert('Assign an engineer first', 'A supplier is assigned to the site engineer — appoint one on this project before assigning suppliers.')
      return
    }
    const supplierId = supplier.user_id || supplier.id
    setSupplierBusyId(supplierId)
    try {
      if (assign) await assignSupplierToProject(project.id, supplierId, engineerId)
      else await unassignSupplierFromProject(project.id, supplierId, supplier.engineer_id || engineerId)
      await suppliers.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSupplierBusyId(null)
    }
  }

  const timelineList = Array.isArray(timeline.data) ? timeline.data : []
  const supplierList = Array.isArray(suppliers.data) ? suppliers.data : []
  const assignedEngineer = engineer.data?.engineer || null
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []

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

      {/* Sub-tab strip — same 4 tabs as web ContractorProjectDetail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ gap: 6 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 ${active ? 'bg-brand-700' : 'bg-white border border-slate-200'}`}
            >
              <Text className={`text-xs font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View className="mt-4">
        {activeTab === 'details' && (
          <View className="flex-row flex-wrap justify-between gap-y-2.5">
            <DetailField label="Construction" value={project.construction_type} />
            <DetailField label="Building type" value={project.building_type} />
            <DetailField label="Land area" value={project.land_area ? `${project.land_area} Sq.ft` : null} />
            <DetailField label="Floors" value={project.floors != null ? String(project.floors) : null} />
            <DetailField label="Budget" value={inr(project.budget)} />
            <DetailField label="Status" value={project.status} />
          </View>
        )}

        {activeTab === 'activity' && (
          <Panel title="Site activity">
            <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText="No site updates logged yet.">
              {timelineList.map((entry, index) => (
                <View key={entry.id || index} className="border-b border-slate-100 py-3">
                  <Text className="text-xs font-extrabold text-brand-700">
                    {String(entry.date || entry.work_date || '').slice(0, 10)}
                  </Text>
                  <Text className="mt-1 text-[13px] font-semibold text-graphite">
                    {entry.work_type || entry.description || 'Daily site record'}
                  </Text>
                  {!!(entry.images || []).length && (
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {(entry.images || []).length} photo(s)
                    </Text>
                  )}
                </View>
              ))}
            </PanelState>
          </Panel>
        )}

        {activeTab === 'team' && (
          <>
            <Panel title="Site engineer">
              <PanelState loading={engineer.loading} error={engineer.error} empty={!assignedEngineer} emptyText="No engineer assigned yet. Assign one from the Engineers tab.">
                {assignedEngineer && (
                  <View>
                    <Text className="text-[15px] font-extrabold text-graphite">{assignedEngineer.name || assignedEngineer.full_name}</Text>
                    <Text className="mt-0.5 text-xs font-semibold text-slate-500">{assignedEngineer.category || 'Site Engineer'}</Text>
                  </View>
                )}
              </PanelState>
            </Panel>
                        <Panel title="Suppliers on this project">
              <PanelState loading={suppliers.loading} error={suppliers.error} empty={!supplierList.length} emptyText="No suppliers assigned to this project.">
                {supplierList.map((supplier, index) => {
                  const id = supplier.user_id || supplier.id
                  return (
                    <View key={id || index} className="flex-row items-center gap-3 border-b border-slate-100 py-2.5">
                      <View className="flex-1">
                        <Text className="text-[14px] font-extrabold text-graphite">{supplier.business_name || supplier.name}</Text>
                        {!!supplier.material_types && (
                          <Text className="mt-0.5 text-xs font-semibold text-slate-500">{String(supplier.material_types)}</Text>
                        )}
                      </View>
                      <Pressable onPress={() => changeSupplier(supplier, false)} disabled={supplierBusyId === id} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5">
                        <Text className="text-[10px] font-extrabold text-rose-700">Remove</Text>
                      </Pressable>
                    </View>
                  )
                })}
              </PanelState>
            </Panel>
            <Panel title="Assign a supplier">
              <PanelState loading={mySuppliers.loading} empty={!mySupplierList.length} emptyText="No approved suppliers yet — accept a supplier partnership from the Home tab first.">
                {mySupplierList
                  .filter((s) => !supplierList.some((assigned) => (assigned.user_id || assigned.id) === (s.user_id || s.id)))
                  .map((supplier) => {
                    const id = supplier.user_id || supplier.id
                    return (
                      <View key={id} className="flex-row items-center gap-3 border-b border-slate-100 py-2.5">
                        <View className="flex-1">
                          <Text className="text-[14px] font-extrabold text-graphite">{supplier.business_name || supplier.name}</Text>
                        </View>
                        <Pressable onPress={() => changeSupplier(supplier, true)} disabled={supplierBusyId === id} className="rounded-lg bg-brand-700 px-3 py-1.5">
                          <Text className="text-[10px] font-extrabold text-white">Assign</Text>
                        </Pressable>
                      </View>
                    )
                  })}
              </PanelState>
            </Panel>
          </>
        )}

        {activeTab === 'payments' && (
          <Panel title="Escrow milestones">
            <PanelState empty={!milestones.length} emptyText="No milestones set up for this project yet.">
              {milestones.map((milestone) => (
                <View key={milestone.id} className="flex-row items-center justify-between border-b border-slate-100 py-3">
                  <Text className="flex-1 text-[14px] font-extrabold text-graphite">{milestone.name}</Text>
                  <View className="items-end">
                    <Text className="text-[15px] font-extrabold text-brand-700">{inr(milestone.amount)}</Text>
                    <StatusChip label={milestone.status || 'PENDING'} tone={milestone.status === 'RELEASED' ? 'positive' : 'muted'} />
                  </View>
                </View>
              ))}
            </PanelState>
          </Panel>
        )}
      </View>
    </View>
  )
}

export default function ContractorProjectsScreen({ navigation }) {
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
        <ProjectDetail project={selected} onBack={() => setSelected(null)} />
      ) : (
        <Panel title="Project sites">
          <PanelState loading={projects.loading} error={projects.error} empty={!projectList.length} emptyText="No projects assigned yet. Accept a request to get started.">
            {projectList.map((project) => (
              <ProjectCard key={project.id} project={project} onPress={() => setSelected(project)} />
            ))}
          </PanelState>
        </Panel>
      )}
    </DashboardShell>
  )
}